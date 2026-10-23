import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import type {Scope} from '../contracts.ts';
import type {EngineDeps} from '../engine/types.ts';
import {uuid} from '../security.ts';
import {socialError} from './protocol.ts';
const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
export async function deliveryUrl(deps:EngineDeps,s:Scope,fileId:string):Promise<string>{
 const url=new URL(deps.config.publicUrl);if(url.protocol!=='https:')throw socialError('PUBLIC_MEDIA_REQUIRED','A rede exige entrega temporária de mídia em domínio HTTPS público.');
 const nonce=randomBytes(32).toString('base64url');const record=await deps.repo.insert(s,'oauth_state',{purpose:'media_delivery',actorId:s.actorId,fileId,nonceHash:digest(nonce),expiresAt:new Date(Date.now()+20*60000).toISOString()});return new URL(`/api/social/media/${record.id}/${nonce}`,url).toString();
}
export function registerMediaDelivery(app:FastifyInstance,deps:EngineDeps){
 app.get<{Params:{deliveryId:string;nonce:string}}>('/api/social/media/:deliveryId/:nonce',async(req,reply)=>{
  const id=uuid(req.params.deliveryId);if(!/^[A-Za-z0-9_-]{43}$/.test(req.params.nonce))throw socialError('NOT_FOUND','Mídia indisponível.',404);
  const record=await deps.db.system(async tx=>(await tx.query<{data:{purpose:string;fileId:string;actorId:string;nonceHash:string;expiresAt:string};project_id:string;owner_id:string;tenant_id:string}>("SELECT data,project_id,owner_id,tenant_id FROM custom_socialengine.records WHERE id=$1 AND project_id=$2 AND owner_id=$3 AND kind='oauth_state'",[id,deps.config.projectId,deps.config.ownerId??null])).rows[0]);
  if(!record||record.data.purpose!=='media_delivery'||Date.parse(record.data.expiresAt)<=Date.now())throw socialError('NOT_FOUND','Mídia indisponível.',404);
  const a=Buffer.from(digest(req.params.nonce)),b=Buffer.from(record.data.nonceHash);if(a.length!==b.length||!timingSafeEqual(a,b))throw socialError('NOT_FOUND','Mídia indisponível.',404);
  const scope=await deps.authorizeJob({actorId:record.data.actorId,projectId:record.project_id,ownerId:record.owner_id,tenantId:record.tenant_id,roles:[]});
  const file=await deps.files.read(scope,record.data.fileId);return reply.header('cache-control','no-store').header('x-content-type-options','nosniff').header('referrer-policy','no-referrer').type(file.file.mimeType).send(file.bytes);
 });
}
