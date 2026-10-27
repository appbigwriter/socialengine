import {createCipheriv,createDecipheriv,randomBytes,timingSafeEqual} from 'node:crypto';
import type {FastifyRequest} from 'fastify';
import type {Actor,Database,Role,RuntimeConfig,Scope} from './contracts.ts';
import {SANDBOX_ACTOR,SANDBOX_SECOND_ACTOR} from './config.ts';

export class AppError extends Error {constructor(public statusCode:number,public code:string,message:string){super(message);}}
export const fail=(status:number,code:string,message:string):never=>{throw new AppError(status,code,message);};
export function requireRoles(scope:Scope,allowed:Role[]){if(!allowed.some(r=>scope.roles.includes(r)))fail(403,'FORBIDDEN','Sua permissão não permite esta ação.');}
export function uuid(value:string){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))fail(400,'INVALID_ID','Identificador inválido.');return value;}
export function maskSecret(value:string){return value.length>8?`••••••••${value.slice(-4)}`:'••••••••';}
function encryptionKey(config:RuntimeConfig):Buffer {
  const raw=config.encryptionKey;
  if(!raw)fail(503,'ENCRYPTION_NOT_CONFIGURED','Armazenamento de credenciais aguarda configuração segura.');
  const key=/^[a-f0-9]{64}$/i.test(raw!)?Buffer.from(raw!,'hex'):Buffer.from(raw!,'base64');
  if(key.length!==32)fail(503,'ENCRYPTION_NOT_CONFIGURED','A chave de criptografia deve ter 32 bytes.');return key;
}
export function seal(config:RuntimeConfig,scope:Scope,provider:string,plain:string):string {
  const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',encryptionKey(config),iv);
  cipher.setAAD(Buffer.from(`${scope.projectId}:${scope.ownerId}:${scope.tenantId}:${provider}`));
  const result=Buffer.concat([cipher.update(plain,'utf8'),cipher.final()]);
  return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),result.toString('base64')].join('.');
}
export function unseal(config:RuntimeConfig,scope:Scope,provider:string,value:string):string {
  const [version,iv,tag,data]=value.split('.');if(version!=='v1'||!iv||!tag||!data)throw new AppError(503,'SECRET_INVALID','Não foi possível ler a credencial protegida.');
  const cipher=createDecipheriv('aes-256-gcm',encryptionKey(config),Buffer.from(iv,'base64'));cipher.setAuthTag(Buffer.from(tag,'base64'));
  cipher.setAAD(Buffer.from(`${scope.projectId}:${scope.ownerId}:${scope.tenantId}:${provider}`));
  try{return Buffer.concat([cipher.update(Buffer.from(data,'base64')),cipher.final()]).toString('utf8');}catch{throw new AppError(503,'SECRET_INVALID','Não foi possível ler a credencial protegida.');}
}
export async function authenticate(request:FastifyRequest,config:RuntimeConfig):Promise<Actor>{
  const auth=request.headers.authorization;
  if(!auth?.startsWith('Bearer '))fail(401,'AUTHENTICATION_REQUIRED','Entre na sua conta para continuar.');
  const token=auth!.slice(7);
  if(config.sandbox&&!config.production){
    if(token==='sandbox-admin')return {id:SANDBOX_ACTOR,mode:'sandbox'};
    if(token==='sandbox-second')return {id:SANDBOX_SECOND_ACTOR,mode:'sandbox'};
    fail(401,'INVALID_SANDBOX_SESSION','Sessão de teste inválida.');
  }
  if(token.startsWith('sandbox-'))fail(401,'INVALID_SESSION','Sessão inválida.');
  if(!config.supabaseUrl||!config.supabaseAnonKey)fail(503,'AUTH_NOT_CONFIGURED','Autenticação ainda não configurada.');
  let res:Response;
  try{res=await fetch(`${config.supabaseUrl}/auth/v1/user`,{headers:{apikey:config.supabaseAnonKey!,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});}catch{fail(503,'AUTH_UNAVAILABLE','O serviço de autenticação está indisponível.');}
  if(!res!.ok)fail(401,'INVALID_SESSION','Sessão inválida ou expirada.');
  const user=await res!.json() as {id?:string;is_anonymous?:boolean};
  if(!user.id||user.is_anonymous)fail(401,'INVALID_SESSION','Entre com uma conta válida.');
  return {id:uuid(user.id!),mode:'supabase'};
}
export async function verifyAuthority(config:RuntimeConfig,actorId:string):Promise<void>{
  if(config.sandbox)return;
  if(config.bootstrapUserIds.includes(actorId))return;
  if(!config.ownerId||!config.authorityVerifierUrl||!config.authorityOperatorToken)fail(503,'AUTHORITY_NOT_CONFIGURED','Ownership e validação do Authority aguardam configuração.');
  // Explicit adapter contract, to be aligned with Authority. No guessed endpoint.
  const url=new URL(config.authorityVerifierUrl!);if(url.protocol!=='https:')fail(503,'AUTHORITY_NOT_CONFIGURED','O verificador Authority exige HTTPS.');
  let res:Response;
  try{res=await fetch(url,{method:'POST',redirect:'error',headers:{'content-type':'application/json',Authorization:`Bearer ${config.authorityOperatorToken}`},body:JSON.stringify({project_id:config.projectId,owner_id:config.ownerId,user_id:actorId}),signal:AbortSignal.timeout(10000)});}catch{fail(503,'AUTHORITY_UNAVAILABLE','O verificador de acesso está indisponível.');}
  if(res!.status===401)fail(503,'AUTHORITY_NOT_CONFIGURED','A credencial de integração com o Authority não foi reconhecida. Solicite a revisão da configuração do servidor.');
  if(res!.status===404)fail(503,'AUTHORITY_NOT_CONFIGURED','O endpoint de verificação do Authority não foi encontrado. Solicite a revisão da configuração do servidor.');
  if(res!.status===403)fail(403,'AUTHORITY_DENIED','Acesso não autorizado pelo Authority.');
  if(!res!.ok)fail(503,'AUTHORITY_UNAVAILABLE','O verificador de acesso está indisponível.');
  const result=await res!.json() as Record<string,unknown>;
  if(result.authorized!==true||result.project_id!==config.projectId||result.owner_id!==config.ownerId||result.user_id!==actorId)fail(403,'AUTHORITY_DENIED','O vínculo de identidade não foi confirmado.');
}
export async function productionBlockers(config:RuntimeConfig,db?:Database):Promise<string[]>{
  if(config.sandbox)return [];
  const blockers:string[]=[];
  if(!config.ownerId)blockers.push('Authority: owner_id ainda não configurado.');
  if(!config.authorityVerifierUrl)blockers.push('Authority: contrato do verificador ainda não configurado.');
  if(!config.encryptionKey)blockers.push('Chave de criptografia de credenciais ausente.');
  if(!config.supabaseUrl||!config.supabaseAnonKey)blockers.push('Autenticação Supabase não configurada.');
  if(!db)blockers.push('Banco de dados indisponível.');
  else {
    try{await db.health();const row=await db.system(async tx=>(await tx.query<{authority_owner_id:string|null;schema_name:string}>('select authority_owner_id,schema_name from public.projects where id=$1',[config.projectId])).rows[0]);if(!row||row.schema_name!=='custom_socialengine'||!row.authority_owner_id||row.authority_owner_id!==config.ownerId)blockers.push('Ownership do catálogo ainda não confirmado.');}catch{blockers.push('Conexão ou contrato do banco indisponível.');}
  }
  return blockers;
}
export function constantMatch(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
