import {randomUUID} from 'node:crypto';
import type {Job,Scope} from '../contracts.ts';
import type {EngineDeps} from './types.ts';
import {collectSource,rankItem,sameTrendItem,type TrendSource,type ExtractedItem,type Observation} from './trends.ts';
import {publishDestination,reconcilePublication,collectPublicationMetrics} from '../social/index.ts';

interface RawJob {id:string;project_id:string;owner_id:string;tenant_id:string;event_type:string;payload:Record<string,unknown>;state:Job['state'];run_at:string;attempts:number;idempotency_key:string;lease_token?:string;lease_until?:string;last_error?:string}
export const jobRow=(r:RawJob):Job=>({id:r.id,projectId:r.project_id,ownerId:r.owner_id,tenantId:r.tenant_id,type:r.event_type,payload:r.payload,state:r.state,runAt:new Date(r.run_at).toISOString(),attempts:r.attempts,idempotencyKey:r.idempotency_key,leaseToken:r.lease_token,leaseUntil:r.lease_until,lastError:r.last_error});
export async function enqueue(deps:EngineDeps,s:Scope,type:string,payload:Record<string,unknown>,key:string,runAt=new Date().toISOString()):Promise<Job>{return deps.db.scoped(s,async tx=>{const r=await tx.query<RawJob>(`INSERT INTO custom_socialengine.events(id,project_id,owner_id,tenant_id,event_type,payload,state,run_at,attempts,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,'queued',$7,0,$8) ON CONFLICT(project_id,owner_id,tenant_id,idempotency_key) WHERE idempotency_key IS NOT NULL DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING *`,[randomUUID(),s.projectId,s.ownerId,s.tenantId,type,{...payload,actorId:s.actorId,actorRoles:s.roles},runAt,key]);return jobRow(r.rows[0]);});}
async function collect(deps:EngineDeps,scope:Scope,job:Job){
 const source=await deps.repo.get<TrendSource>(scope,'trend_source',String(job.payload.sourceId));if(!source||!source.data.enabled)return;
 const now=new Date().toISOString();
 try {
  const items=await collectSource(source.data);const existing=await deps.repo.list<ExtractedItem&{sourceIds:string[];observedAt:string;ranking:unknown}>(scope,'trend_item');
  for(const item of items){
   const same=existing.find(x=>sameTrendItem(x.data,item));
   const topicId=same?.id??randomUUID();
   const observation:Observation&{itemId:string;method:string}={itemId:topicId,observedAt:now,coverageComplete:true,sourceId:source.id,method:item.method};
   // Presence observation has no invented quantitative signal; repeated polls cannot prove growth.
   const history=(await deps.repo.list<Observation&{itemId:string}>(scope,'trend_observation')).filter(x=>x.data.itemId===topicId).map(x=>x.data);
   const ranking=rankItem(item,source.data,[...history,observation]);
   const data={...item,sourceIds:[...new Set([...(same?.data.sourceIds??[]),source.id])],observedAt:now,ranking};
   if(same){const updated=await deps.repo.update(scope,'trend_item',same.id,data,same.revision);Object.assign(same,updated);}else {const inserted=await deps.repo.insert(scope,'trend_item',data,topicId);existing.push(inserted);}
   const alreadyObserved=(await deps.repo.list<{jobId:string;itemId:string}>(scope,'trend_extraction')).some(x=>x.data.jobId===job.id&&x.data.itemId===topicId);
   if(!alreadyObserved)await deps.repo.insert(scope,'trend_extraction',{itemId:topicId,sourceId:source.id,method:item.method,state:item.text.length>=80?'extracted':'metadata_only',excerpt:item.text.slice(0,1200),observedAt:now,jobId:job.id});
   const priorObservation=(await deps.repo.list<{jobId:string;itemId:string}>(scope,'trend_observation')).some(x=>x.data.jobId===job.id&&x.data.itemId===topicId);
   if(!priorObservation)await deps.repo.insert(scope,'trend_observation',{...observation,jobId:job.id});
   if(ranking.excluded)continue;
   const topic=(await deps.repo.list<{itemId:string}>(scope,'trend_topic')).find(x=>x.data.itemId===topicId);
   const topicData={itemId:topicId,title:item.title,summary:item.text.slice(0,300),...(item.searchSignal?{searchSignal:item.searchSignal}:{}),sourceIds:data.sourceIds,sources:[{url:item.url,method:item.method}],firstObservedAt:topic?.createdAt??now,lastObservedAt:now,state:ranking.state,relevance:ranking.relevance,confidence:ranking.confidence,intensity:null,growth:ranking.growth,reason:ranking.reasons.join('. '),rankingVersion:ranking.version};
   if(topic)await deps.repo.update(scope,'trend_topic',topic.id,topicData,topic.revision);else await deps.repo.insert(scope,'trend_topic',topicData);
  }
  await deps.repo.update(scope,'trend_source',source.id,{...source.data,lastCollectedAt:now,lastError:undefined},source.revision);
  const latest=await deps.repo.get<TrendSource>(scope,'trend_source',source.id);
  if(latest?.data.enabled){const interval=source.data.intervalMinutes*60_000;const next=new Date((Math.floor(Date.now()/interval)+1)*interval).toISOString();await enqueue(deps,scope,'trends.collect',{sourceId:source.id},`collect:${source.id}:${next}`,next);}
  await deps.repo.audit(scope,'trends.collected',source.id,{items:items.length,jobId:job.id});
 }catch(error){const latest=await deps.repo.get<TrendSource>(scope,'trend_source',source.id);if(latest)await deps.repo.update(scope,'trend_source',source.id,{...latest.data,lastError:error instanceof Error?error.message:'Falha de coleta'},latest.revision);throw error;}
}
export async function runWorkerOnce(deps:EngineDeps):Promise<boolean>{
 const token=randomUUID();
 const job=await deps.db.system(async tx=>{
  // Expired publication leases are uncertain, never retried blindly after a crash.
  await tx.query(`UPDATE custom_socialengine.events SET state=CASE WHEN event_type='publication.publish' THEN 'uncertain' WHEN attempts>=4 THEN 'failed' ELSE 'queued' END,lease_token=NULL,lease_until=NULL,last_error='Reserva expirada; publicação exige reconciliação.' WHERE project_id=$1 AND state='processing' AND lease_until<now()`,[deps.config.projectId]);
  const r=await tx.query<RawJob>(`WITH candidate AS (SELECT id FROM custom_socialengine.events WHERE project_id=$1 AND state='queued' AND run_at<=now() AND attempts<4 ORDER BY CASE WHEN event_type='publication.publish' THEN 0 ELSE 1 END,run_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE custom_socialengine.events e SET state='processing',attempts=e.attempts+1,lease_token=$2,lease_until=now()+interval '5 minutes' FROM candidate WHERE e.id=candidate.id RETURNING e.*`,[deps.config.projectId,token]);return r.rows[0]?jobRow(r.rows[0]):null;
 });
 if(!job)return false;
 let scope:Scope={projectId:job.projectId,ownerId:job.ownerId,tenantId:job.tenantId,actorId:String(job.payload.actorId??''),roles:[]};
 try{
  scope=await deps.authorizeJob(scope);
  if(!scope.roles.some(x=>x==='admin'||x===(job.type.startsWith('publication.')?'publisher':'editor')))throw new Error('Permissão do autor foi revogada.');
  if(job.type==='trends.collect')await collect(deps,scope,job);
  else if(job.type==='publication.publish'){
   await publishDestination(deps,scope,job);
   const publication=(await deps.repo.list(scope,'publication')).find(p=>p.data.jobId===job.id);
   if(publication)await followPublication(deps,scope,publication.id,publication.data,0);
  }
  else if(job.type==='publication.reconcile'){
   const publication=await reconcilePublication(deps,scope,String(job.payload.publicationId));
   await followPublication(deps,scope,publication.id,publication.data,Number(job.payload.pollCount??0)+1);
  }
  else if(job.type==='publication.metrics'){
   const id=String(job.payload.publicationId);await collectPublicationMetrics(deps,scope,id);
   const next=new Date(Date.now()+6*3_600_000).toISOString();await enqueue(deps,scope,'publication.metrics',{publicationId:id},`metrics:${id}:${next.slice(0,13)}`,next);
  }
  else throw Object.assign(new Error('Tipo de trabalho não suportado.'),{permanent:true});
  await finish(deps,job,token,'succeeded');
 }catch(error){const details=error as {permanent?:boolean;uncertain?:boolean;statusCode?:number};const permanent=details.permanent||[400,401,403,404,409,422,503].includes(details.statusCode??0);const message=error instanceof Error?error.message:'Falha de processamento';await finish(deps,job,token,details.uncertain?'uncertain':permanent||job.attempts>=4?'failed':'queued',message);}
 return true;
}
async function followPublication(deps:EngineDeps,scope:Scope,id:string,data:{state?:unknown;remoteId?:unknown;containerId?:unknown},pollCount:number){
 if(data.state==='published')await enqueue(deps,scope,'publication.metrics',{publicationId:id},`metrics:${id}:${new Date().toISOString().slice(0,13)}`);
 else if(data.remoteId||data.containerId){
  if(pollCount>=12)throw Object.assign(new Error('A rede ainda processa a publicação; reconciliação manual necessária.'),{uncertain:true});
  await enqueue(deps,scope,'publication.reconcile',{publicationId:id,pollCount},`reconcile:${id}:${pollCount}`,new Date(Date.now()+60_000).toISOString());
 }
}
async function finish(deps:EngineDeps,job:Job,token:string,state:Job['state'],message?:string){await deps.db.system(async tx=>{await tx.query(`UPDATE custom_socialengine.events SET state=$1,last_error=$2,lease_token=NULL,lease_until=NULL,run_at=CASE WHEN $1='queued' THEN now()+($3::text||' seconds')::interval ELSE run_at END WHERE id=$4 AND project_id=$5 AND owner_id=$6 AND tenant_id=$7 AND lease_token=$8 AND state='processing'`,[state,message??null,Math.min(3600,30*2**job.attempts),job.id,job.projectId,job.ownerId,job.tenantId,token]);});}
