import {randomBytes,randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import type {Scope,Platform,RecordRow} from '../contracts.ts';
import type {EngineDeps} from '../engine/types.ts';
import {seal,unseal,uuid} from '../security.ts';
import {appConfig,authorizationUrl,exchangeCode,identities,refreshTokens,socialError,transport,type Transport,type TokenSet} from './protocol.ts';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const eq=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export const platforms:Platform[]=['instagram','facebook','linkedin','tiktok','youtube'];
export const platformFor=(s:string)=>{if(!platforms.includes(s as Platform))throw socialError('SOCIAL_PLATFORM_INVALID','Rede inválida.',400);return s as Platform;};
export interface SocialAccount {platform:Platform;externalId:string;name:string;state:'connected'|'disconnected';credentialProvider:string;credentialId:string;connectedAt:string;expiresAt?:string}
export class OAuthTokens{
 constructor(private deps:EngineDeps,private fetcher:Transport=transport){}
 private async member(s:Scope){await this.deps.repo.getScope(s.actorId,s.projectId,s.ownerId,s.tenantId);}
 async save(s:Scope,platform:Platform,externalId:string,tokens:TokenSet):Promise<{id:string;provider:string}>{
  await this.member(s);const id=randomUUID(),provider=`${platform}:${externalId}`,ciphertext=seal(this.deps.config,s,provider,JSON.stringify(tokens));
  await this.deps.db.system(async tx=>{
   await tx.query('SELECT id FROM custom_socialengine.entities WHERE project_id=$1 AND owner_id=$2 AND tenant_id=$3 FOR UPDATE',[s.projectId,s.ownerId,s.tenantId]);
   await tx.query("UPDATE custom_socialengine.credentials SET state='revoked',updated_at=now() WHERE project_id=$1 AND owner_id=$2 AND tenant_id=$3 AND provider=$4 AND kind='oauth' AND state='active'",[s.projectId,s.ownerId,s.tenantId,provider]);
   await tx.query("INSERT INTO custom_socialengine.credentials(id,project_id,owner_id,tenant_id,provider,kind,ciphertext,masked_hint,state) VALUES($1,$2,$3,$4,$5,'oauth',$6,'OAuth ••••••••','active')",[id,s.projectId,s.ownerId,s.tenantId,provider,ciphertext]);
  });return {id,provider};
 }
 async load(s:Scope,account:SocialAccount):Promise<TokenSet>{
  await this.member(s);const stored=await this.deps.db.system(async tx=>(await tx.query<{ciphertext:string}>("SELECT ciphertext FROM custom_socialengine.credentials WHERE id=$1 AND project_id=$2 AND owner_id=$3 AND tenant_id=$4 AND provider=$5 AND kind='oauth' AND state='active'",[account.credentialId,s.projectId,s.ownerId,s.tenantId,account.credentialProvider])).rows[0]);
  if(!stored)throw socialError('SOCIAL_RECONNECT_REQUIRED','Reconecte esta conta para continuar.');
  const original=JSON.parse(unseal(this.deps.config,s,account.credentialProvider,stored.ciphertext)) as TokenSet;
  const refreshed=await refreshTokens(appConfig(account.platform),original,this.fetcher);
  if(refreshed!==original){const ciphertext=seal(this.deps.config,s,account.credentialProvider,JSON.stringify(refreshed));await this.deps.db.system(tx=>tx.query("UPDATE custom_socialengine.credentials SET ciphertext=$1,updated_at=now() WHERE id=$2 AND project_id=$3 AND owner_id=$4 AND tenant_id=$5 AND state='active'",[ciphertext,account.credentialId,s.projectId,s.ownerId,s.tenantId]));}
  return refreshed;
 }
 async revoke(s:Scope,account:SocialAccount){await this.member(s);await this.deps.db.system(tx=>tx.query("UPDATE custom_socialengine.credentials SET state='revoked',updated_at=now() WHERE id=$1 AND project_id=$2 AND owner_id=$3 AND tenant_id=$4 AND kind='oauth'",[account.credentialId,s.projectId,s.ownerId,s.tenantId]));}
}
interface StateData {platform:Platform;actorId:string;nonceHash:string;cookieHash:string;verifierCiphertext:string;expiresAt:string;consumedAt?:string;purpose:'oauth'}
export class OAuthFlow{
 constructor(private deps:EngineDeps,private fetcher:Transport=transport){}
 callback(platform:Platform){const base=new URL(this.deps.config.publicUrl);if(!this.deps.config.sandbox&&base.protocol!=='https:')throw socialError('SOCIAL_HTTPS_REQUIRED','OAuth exige domínio público HTTPS.');return new URL(`/api/social/${platform}/callback`,base).toString();}
 async begin(s:Scope,platform:Platform){
  const current=await this.deps.authorizeJob(s);if(!current.roles.includes('admin'))throw socialError('FORBIDDEN','Administrador necessário.',403);
  const app=appConfig(platform),nonce=randomBytes(32).toString('base64url'),cookie=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
  const data:StateData={purpose:'oauth',platform,actorId:s.actorId,nonceHash:hash(nonce),cookieHash:hash(cookie),verifierCiphertext:seal(this.deps.config,s,'oauth-pkce',verifier),expiresAt:new Date(Date.now()+600000).toISOString()};
  const record=await this.deps.repo.insert(s,'oauth_state',data);const state=`${record.id}.${seal(this.deps.config,s,'oauth-state-url',nonce)}`;
  const name=`se_oauth_${record.id.replaceAll('-','')}`;const cookieHeader=`${name}=${cookie}; HttpOnly; SameSite=Lax; Path=/api/social/${platform}/callback; Max-Age=600${this.deps.config.sandbox?'':'; Secure'}`;
  return {url:authorizationUrl(app,this.callback(platform),state,hashBase64(verifier)),cookieHeader,expiresAt:data.expiresAt};
 }
 async complete(platform:Platform,state:string,cookieHeader:string|undefined,code:string):Promise<{scope:Scope;accounts:RecordRow<SocialAccount>[]} >{
  if(state.length>3000||code.length>4096)throw socialError('OAUTH_STATE_INVALID','Autorização inválida.',400);
  const split=state.indexOf('.');if(split<1)throw socialError('OAUTH_STATE_INVALID','Estado OAuth inválido.',400);const id=uuid(state.slice(0,split));
  const stored=await this.deps.db.system(async tx=>(await tx.query<{data:StateData;project_id:string;owner_id:string;tenant_id:string}>("SELECT data,project_id,owner_id,tenant_id FROM custom_socialengine.records WHERE id=$1 AND kind='oauth_state' AND project_id=$2 AND owner_id=$3",[id,this.deps.config.projectId,this.deps.config.ownerId??null])).rows[0]);
  if(!stored||stored.data.purpose!=='oauth'||stored.data.platform!==platform||stored.data.consumedAt||Date.parse(stored.data.expiresAt)<=Date.now())throw socialError('OAUTH_STATE_INVALID','Autorização expirada ou já utilizada.',400);
  const s=await this.deps.repo.getScope(stored.data.actorId,stored.project_id,stored.owner_id,stored.tenant_id);await this.deps.authorizeJob(s);if(!s.roles.includes('admin'))throw socialError('FORBIDDEN','Administrador necessário.',403);
  let nonce:string;try{nonce=unseal(this.deps.config,s,'oauth-state-url',state.slice(split+1));}catch{throw socialError('OAUTH_STATE_INVALID','Estado OAuth inválido.',400);}
  const name=`se_oauth_${id.replaceAll('-','')}`;const cookie=cookieHeader?.split(';').map(c=>c.trim().split('=')).find(([k])=>k===name)?.[1];
  if(!cookie||!eq(hash(cookie),stored.data.cookieHash)||!eq(hash(nonce),stored.data.nonceHash))throw socialError('OAUTH_STATE_INVALID','Esta autorização pertence a outra sessão.',400);
  const consumed=await this.deps.db.scoped(s,tx=>tx.query("UPDATE custom_socialengine.records SET data=data||jsonb_build_object('consumedAt',$1::text),revision=revision+1,updated_at=now() WHERE id=$2 AND kind='oauth_state' AND data->>'consumedAt' IS NULL RETURNING id",[new Date().toISOString(),id]));
  if(!consumed.rowCount)throw socialError('OAUTH_STATE_REPLAY','Autorização já utilizada.',400);
  if(!code)throw socialError('OAUTH_DENIED','A autorização foi cancelada.',400);
  const app=appConfig(platform),tokens=await exchangeCode(app,code,this.callback(platform),unseal(this.deps.config,s,'oauth-pkce',stored.data.verifierCiphertext),this.fetcher);
  const identitiesFound=await identities(app,tokens,this.fetcher);if(!identitiesFound.length)throw socialError('SOCIAL_IDENTITY_UNCONFIRMED','Nenhuma conta publicável foi autorizada.');
  const vault=new OAuthTokens(this.deps,this.fetcher),accounts:RecordRow<SocialAccount>[]=[];
  for(const identity of identitiesFound.slice(0,25)){
   const credential=await vault.save(s,platform,identity.externalId,identity.tokens);
   const data:SocialAccount={platform,externalId:identity.externalId,name:identity.name,state:'connected',credentialProvider:credential.provider,credentialId:credential.id,connectedAt:new Date().toISOString(),expiresAt:identity.tokens.expiresAt};
   const existing=(await this.deps.repo.list<SocialAccount>(s,'social_account')).find(a=>a.data.platform===platform&&a.data.externalId===identity.externalId);
   accounts.push(existing?await this.deps.repo.update(s,'social_account',existing.id,data,existing.revision):await this.deps.repo.insert(s,'social_account',data));
  }
  await this.deps.repo.audit(s,'social.connected',platform,{count:accounts.length});return {scope:s,accounts};
 }
}
const hashBase64=(s:string)=>createHash('sha256').update(s).digest('base64url');
export async function registerSocialRoutes(app:FastifyInstance,deps:EngineDeps,fetcher:Transport=transport){
 const flow=new OAuthFlow(deps,fetcher),vault=new OAuthTokens(deps,fetcher);
 app.get<{Params:{id:string;platform:string}}>('/api/tenants/:id/accounts/:platform/connect',async(req,reply)=>{const scope=await deps.scopeFor(req,['admin']),result=await flow.begin(scope,platformFor(req.params.platform));return reply.header('set-cookie',result.cookieHeader).header('cache-control','no-store').send({authorizationUrl:result.url,expiresAt:result.expiresAt});});
 app.get<{Params:{platform:string};Querystring:{state?:string;code?:string;error?:string}}>('/api/social/:platform/callback',async(req,reply)=>{
  const platform=platformFor(req.params.platform);await flow.complete(platform,req.query.state??'',req.headers.cookie,req.query.error?'':req.query.code??'');
  return reply.header('cache-control','no-store').header('referrer-policy','no-referrer').redirect('/?social=connected');
 });
 app.delete<{Params:{id:string;accountId:string}}>('/api/tenants/:id/accounts/:accountId',async req=>{
  const s=await deps.scopeFor(req,['admin']),account=await deps.repo.get<SocialAccount>(s,'social_account',uuid(req.params.accountId));if(!account)throw socialError('NOT_FOUND','Conta não encontrada.',404);
  await vault.revoke(s,account.data);await deps.repo.update(s,'social_account',account.id,{...account.data,state:'disconnected'},account.revision);
  await deps.db.scoped(s,tx=>tx.query("UPDATE custom_socialengine.events SET state='cancelled',last_error='Conta desconectada' WHERE state='queued' AND event_type='publication.publish' AND payload->>'accountId'=$1",[account.id]));await deps.repo.audit(s,'social.disconnected',account.id);return {ok:true};
 });
}
