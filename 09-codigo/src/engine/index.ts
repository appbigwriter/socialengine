import {randomUUID} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import type {PostData,SourceData,Scope,Platform,Slide} from '../contracts.ts';
import {generateOpenAI} from './ai.ts';
import {publicUrl} from './network.ts';
import {renderSlide,renderVideo,videoCapability} from './media.ts';
import {enqueue,jobRow} from './jobs.ts';
import type {EngineDeps} from './types.ts';
import {ensureSocialCapability,requireApproved,socialCapabilities,unavailable} from './social.ts';
import type {TrendSource,ExtractedItem} from './trends.ts';
export type {EngineDeps} from './types.ts';
export {runWorkerOnce} from './jobs.ts';
export {extractPdf} from './media.ts';
export {extractHtml} from './trends.ts';
export {fetchSource,publicUrl} from './network.ts';
export const capabilities=()=>({social:socialCapabilities,ai:{provider:'openai',requiresTenantKey:true,requiresExplicitModel:true},trends:{connectors:['rss','html'],requiresAccessAcknowledgement:true},media:{png:true,video:'requires_ffmpeg'}});

const idSchema=z.string().uuid();
const editors:('admin'|'editor')[]=['admin','editor'];
const sourceSchema=z.object({name:z.string().min(1).max(120),url:z.string().url().max(2000),type:z.enum(['rss','html']),keywords:z.array(z.string().min(1).max(80)).min(1).max(30),exclusions:z.array(z.string().min(1).max(80)).max(30).default([]),region:z.string().max(80).default('BR'),language:z.string().max(30).default('pt-BR'),intervalMinutes:z.number().int().min(30).max(10080).default(360),accessAcknowledged:z.boolean().default(false),enabled:z.boolean().default(true)});
const invalid=(message:string,statusCode=422)=>Object.assign(new Error(message),{statusCode});
async function postFor(deps:EngineDeps,s:Scope,id:string){const post=await deps.repo.get<PostData>(s,'post',idSchema.parse(id));if(!post)throw invalid('Conteúdo não encontrado.',404);return post;}
export async function registerEngineRoutes(app:FastifyInstance,deps:EngineDeps){
 app.get('/api/tenants/:id/capabilities',async req=>{await deps.scopeFor(req);return {social:socialCapabilities,ai:{provider:'openai',configuredPerTenant:true},video:{available:await videoCapability()},trends:{connectors:['rss','html'],accessAcknowledgementRequired:true}};});
 app.post<{Body:unknown}>('/api/tenants/:id/trend-sources',async req=>{
  const scope=await deps.scopeFor(req,editors),data=sourceSchema.parse(req.body);publicUrl(data.url);
  if((await deps.repo.list(scope,'trend_source')).length>=30)throw invalid('Limite de 30 fontes por influenciador atingido.');
  const source=await deps.repo.insert(scope,'trend_source',data);await deps.repo.audit(scope,'trend_source.created',source.id);
  if(data.enabled&&data.accessAcknowledged)await enqueue(deps,scope,'trends.collect',{sourceId:source.id},`collect:${source.id}:initial`);
  return {source};
 });
 app.patch<{Params:{id:string;sourceId:string};Body:unknown}>('/api/tenants/:id/trend-sources/:sourceId',async req=>{
  const scope=await deps.scopeFor(req,editors),source=await deps.repo.get<TrendSource>(scope,'trend_source',idSchema.parse(req.params.sourceId));if(!source)throw invalid('Fonte não encontrada.',404);
  const patch=sourceSchema.partial().extend({revision:z.number().int().positive()}).parse(req.body);const {revision,...changes}=patch;const data={...source.data,...changes};publicUrl(data.url);
  const updated=await deps.repo.update(scope,'trend_source',source.id,data,revision);await deps.repo.audit(scope,'trend_source.updated',source.id);
  if(data.enabled&&data.accessAcknowledged&&!source.data.enabled)await enqueue(deps,scope,'trends.collect',{sourceId:source.id},`collect:${source.id}:resume:${updated.revision}`);return {source:updated};
 });
 app.post<{Params:{id:string;sourceId:string}}>('/api/tenants/:id/trend-sources/:sourceId/collect',async req=>{
  const scope=await deps.scopeFor(req,editors),source=await deps.repo.get<TrendSource>(scope,'trend_source',idSchema.parse(req.params.sourceId));if(!source)throw invalid('Fonte não encontrada.',404);if(!source.data.enabled||!source.data.accessAcknowledged)throw invalid('Ative a fonte e confirme as condições de acesso.');
  const window=Math.floor(Date.now()/1_800_000);return {job:await enqueue(deps,scope,'trends.collect',{sourceId:source.id},`collect:${source.id}:manual:${window}`)};
 });
 app.post<{Params:{id:string;trendId:string};Body:unknown}>('/api/tenants/:id/trends/:trendId/decision',async req=>{
  const scope=await deps.scopeFor(req,editors),{action}=z.object({action:z.enum(['save','discard','create_post'])}).parse(req.body);
  const topic=await deps.repo.get<{itemId:string}>(scope,'trend_topic',idSchema.parse(req.params.trendId));
  const trend=await deps.repo.get<ExtractedItem>(scope,'trend_item',topic?.data.itemId??req.params.trendId);if(!trend)throw invalid('Oportunidade não encontrada.',404);
  let post;
  if(action==='create_post'){
   const source=await deps.repo.insert<SourceData>(scope,'source',{title:trend.data.title,kind:'news',url:trend.data.url,text:trend.data.text,extractionState:trend.data.text.length>=80?'extracted':'metadata_only'});
   post=await deps.repo.insert<PostData>(scope,'post',{title:trend.data.title,format:'carousel',slides:[{id:randomUUID(),title:trend.data.title,body:''}],caption:'',cta:'',sourceIds:[source.id],structure:'problem_solution',color:'#8057f5',platforms:['instagram'],status:'draft'});
  }
  await deps.repo.insert(scope,'trend_decision',{trendId:trend.id,action,actorId:scope.actorId,postId:post?.id,decidedAt:new Date().toISOString()});await deps.repo.audit(scope,'trend.decided',trend.id,{action});return {post};
 });
 app.post<{Body:unknown}>('/api/tenants/:id/generate',async req=>{
  const scope=await deps.scopeFor(req,editors),body=z.object({postId:idSchema,revision:z.number().int().positive(),sourceIds:z.array(idSchema).min(1).max(8),structure:z.string().min(1).max(120),slideIndex:z.number().int().min(0).max(11).optional()}).parse(req.body);
  const post=await postFor(deps,scope,body.postId);if(post.revision!==body.revision)throw invalid('Conteúdo alterado; recarregue antes de gerar.',409);
  if(body.slideIndex!==undefined&&!post.data.slides[body.slideIndex])throw invalid('Slide inexistente.');
  const sources:SourceData[]=[];for(const id of body.sourceIds){const source=await deps.repo.get<SourceData>(scope,'source',id);if(!source||source.data.extractionState!=='extracted'||!source.data.text.trim())throw invalid('Todas as fontes devem ter texto extraído; forneça material complementar.');sources.push({...source.data,text:source.data.text.slice(0,16000)});}
  const prefs=await deps.db.scoped(scope,async tx=>(await tx.query<{value:{provider?:string;model?:string;monthlyRequests?:number}}>(`SELECT value FROM custom_socialengine.settings WHERE key=$1`,[`${scope.tenantId}:ai`])).rows[0]?.value);
  if(prefs?.provider&&prefs.provider!=='openai')throw unavailable('Provedor configurado ainda não suportado. Selecione OpenAI.');
  const model=prefs?.model||process.env.OPENAI_MODEL;if(!model)throw unavailable('Configure um modelo OpenAI nas preferências do influenciador.');
  const key=await deps.vault.reveal(scope,'openai');if(!key)throw unavailable('Cadastre uma chave OpenAI para este influenciador.');
  const hardLimit=Math.max(0,Math.min(10000,Number(process.env.AI_MONTHLY_REQUEST_LIMIT??100)||0));const limit=Math.max(0,Math.min(hardLimit,Math.floor(prefs?.monthlyRequests??hardLimit)));
  const usageId=randomUUID(),at=new Date().toISOString(),month=at.slice(0,7);
  await deps.db.scoped(scope,async tx=>{
   await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`socialengine:ai:${scope.projectId}:${scope.ownerId}:${scope.tenantId}:${month}`]);
   const used=(await tx.query<{count:string}>(`SELECT count(*)::text AS count FROM custom_socialengine.records WHERE kind='ai_usage' AND data->>'month'=$1`,[month])).rows[0];if(Number(used?.count??0)>=limit)throw invalid('Cota mensal de geração atingida.',429);
   await tx.query(`INSERT INTO custom_socialengine.records(id,entity_id,kind,data,project_id,owner_id,tenant_id) VALUES($1,$2,'ai_usage',$3,$4,$5,$2)`,[usageId,scope.tenantId,{month,provider:'openai',model,state:'reserved',requestedAt:at,postId:post.id},scope.projectId,scope.ownerId]);
  });
  try{
   const workspace=(await deps.repo.listWorkspaces(scope.actorId,scope.projectId,scope.ownerId)).find(w=>w.id===scope.tenantId);
   const result=await generateOpenAI(key,model,sources,{brand:workspace?.brand,niche:workspace?.niche,audience:workspace?.audience,structure:body.structure,slideIndex:body.slideIndex,previousSlides:body.slideIndex===undefined?undefined:post.data.slides});
   const usage=await deps.repo.get(scope,'ai_usage',usageId);if(usage)await deps.repo.update(scope,'ai_usage',usage.id,{...usage.data,state:'succeeded',usage:result.usage,inputTokens:result.usage?.input_tokens??null,outputTokens:result.usage?.output_tokens??null,totalTokens:result.usage?.total_tokens??null,cost:null,providerId:result.providerId,completedAt:new Date().toISOString()},usage.revision);
   let slides:Slide[]=result.content.slides.map(s=>({...s,id:randomUUID()}));if(body.slideIndex!==undefined){slides=[...post.data.slides];slides[body.slideIndex]={...slides[body.slideIndex],...result.content.slides[0]};}
   const next=await deps.repo.update(scope,'post',post.id,{...post.data,title:body.slideIndex===undefined?result.content.title:post.data.title,slides,caption:body.slideIndex===undefined?result.content.caption:post.data.caption,cta:body.slideIndex===undefined?result.content.cta:post.data.cta,sourceIds:body.sourceIds,structure:body.structure,status:'draft',approvedBy:undefined,approvedAt:undefined,approvedRevision:undefined,video:undefined},body.revision);
   await deps.repo.audit(scope,'post.generated',post.id,{usageId});return {post:next};
  }catch(error){const usage=await deps.repo.get(scope,'ai_usage',usageId);if(usage&&usage.data.state==='reserved')await deps.repo.update(scope,'ai_usage',usage.id,{...usage.data,state:'failed',completedAt:new Date().toISOString()},usage.revision);throw error;}
 });
 app.get<{Params:{id:string;postId:string};Querystring:{format?:string;slide?:string}}>('/api/tenants/:id/posts/:postId/export',async(req,reply)=>{
  const scope=await deps.scopeFor(req),post=await postFor(deps,scope,req.params.postId),format=req.query.format??'png';await deps.repo.audit(scope,'post.exported',post.id,{format});
  if(format==='json')return reply.header('content-disposition',`attachment; filename="post-${post.id}.json"`).send(post);
  if(format==='video'){if(!post.data.video?.fileId)throw invalid('Renderize e revise o vídeo primeiro.');const file=await deps.files.read(scope,post.data.video.fileId);return reply.type('video/mp4').header('content-disposition',`attachment; filename="post-${post.id}.mp4"`).send(file.bytes);}
  if(format!=='png')throw invalid('Formato de exportação inválido.');const index=Number(req.query.slide??0);if(!Number.isInteger(index)||index<0||!post.data.slides[index])throw invalid('Slide inexistente.');
  const slide=post.data.slides[index],image=slide.imageFileId?(await deps.files.read(scope,slide.imageFileId)).bytes:undefined;return reply.type('image/png').header('content-disposition',`attachment; filename="slide-${index+1}.png"`).send(await renderSlide(slide,post.data.color,index,image));
 });
 app.post<{Body:unknown}>('/api/tenants/:id/videos/render',async req=>{
  const scope=await deps.scopeFor(req,editors),body=z.object({postId:idSchema,revision:z.number().int().positive()}).parse(req.body),post=await postFor(deps,scope,body.postId);if(post.revision!==body.revision)throw invalid('Revisão alterada.',409);
  if(post.data.slides.some(s=>s.imageFileId)||post.data.video?.audioFileId)throw invalid('Renderizador básico atual suporta cenas de texto sem áudio; remova os arquivos ou exporte para edição externa.');
  const durations=post.data.video?.sceneDurations??post.data.slides.map(()=>5),bytes=await renderVideo(post.data.slides,durations,post.data.color),file=await deps.files.put(scope,bytes,`video-${post.id}.mp4`,'video/mp4');
  const next=await deps.repo.update(scope,'post',post.id,{...post.data,format:'video',video:{sceneDurations:durations,fileId:file.id},status:'draft',approvedBy:undefined,approvedAt:undefined,approvedRevision:undefined},body.revision);await deps.repo.audit(scope,'video.rendered',post.id,{fileId:file.id});return {post:next};
 });
 app.post<{Params:{id:string;postId:string};Body:unknown}>('/api/tenants/:id/posts/:postId/publish',async req=>{
  const scope=await deps.scopeFor(req,['admin','publisher']),body=z.object({revision:z.number().int().positive(),accountIds:z.array(idSchema).min(1).max(5),scheduledAt:z.string().datetime().optional(),socialOptions:z.record(idSchema,z.record(z.string(),z.unknown())).optional()}).parse(req.body),post=await postFor(deps,scope,req.params.postId);requireApproved(post,body.revision);
  const accounts=[];for(const id of new Set(body.accountIds)){const account=await deps.repo.get(scope,'social_account',id);if(!account||account.data.state!=='connected')throw invalid('Conta indisponível ou desconectada.');ensureSocialCapability(account.data.platform as Platform,post.data.format);accounts.push(account);}
  const jobs=[];for(const account of accounts)jobs.push(await enqueue(deps,scope,'publication.publish',{postId:post.id,revision:post.revision,accountId:account.id,explicitDestination:true,socialOptions:body.socialOptions?.[account.id]??{}},`publish:${post.id}:${post.revision}:${account.id}`,body.scheduledAt));await deps.repo.audit(scope,'publication.authorized',post.id,{accountIds:body.accountIds,revision:body.revision});return {jobs};
 });
 app.get('/api/tenants/:id/jobs',async req=>{const scope=await deps.scopeFor(req);return {jobs:await deps.db.scoped(scope,async tx=>(await tx.query<any>('SELECT * FROM custom_socialengine.events ORDER BY created_at DESC LIMIT 100')).rows.map(jobRow))};});
 app.post<{Params:{id:string;jobId:string}}>('/api/tenants/:id/jobs/:jobId/cancel',async req=>{const scope=await deps.scopeFor(req,['admin','publisher','editor']);const id=idSchema.parse(req.params.jobId);const canPublish=scope.roles.some(r=>r==='admin'||r==='publisher');const cancelled=await deps.db.scoped(scope,tx=>tx.query(`UPDATE custom_socialengine.events SET state='cancelled' WHERE id=$1 AND state='queued' AND (event_type<>'publication.publish' OR $2::boolean) RETURNING id`,[id,canPublish]));if(!cancelled.rowCount)throw invalid('Trabalho ausente, sem permissão ou já em execução.',409);await deps.repo.audit(scope,'job.cancelled',id);return {ok:true};});
}
