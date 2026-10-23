import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {z,ZodError} from 'zod';
import type {Actor,Database,Job,Kind,PostData,RuntimeConfig,Scope,Role,Workspace} from './contracts.ts';
import {Repository} from './repository.ts';
import {authenticate,AppError,fail,productionBlockers,requireRoles,uuid,verifyAuthority} from './security.ts';
import {workspaceSchema,sourceSchema,postSchema,roleSchema} from './validation.ts';
import {PrivateFiles} from './files.ts';
import {Vault} from './vault.ts';
import {registerEngineRoutes,capabilities,extractPdf,fetchSource,extractHtml} from './engine/index.ts';
import type {EngineDeps} from './engine/index.ts';
import {registerSocialRoutes} from './social/index.ts';

export async function createApplication(config:RuntimeConfig,db:Database){
  const app=Fastify({bodyLimit:1024*1024,logger:{level:config.sandbox?'warn':'info',redact:['req.headers.authorization','req.headers.cookie','body.password','body.key','body.token'],serializers:{req:req=>({method:req.method,url:req.url.startsWith('/api/social/')?'/api/social/[redacted]':req.url.split('?')[0],hostname:req.hostname})}}});
  const repo=new Repository(db),files=new PrivateFiles(db,config),vault=new Vault(db,config);
  const actors=new WeakMap<object,Actor>();
  const limits=new Map<string,{count:number;expires:number}>();
  app.addHook('onRequest',async(req,reply)=>{
    reply.header('X-Content-Type-Options','nosniff').header('Referrer-Policy','same-origin').header('X-Frame-Options','DENY');
    if(req.url.startsWith('/api/'))reply.header('Cache-Control','no-store');
    const now=Date.now();if(limits.size>10000)for(const [key,value]of limits)if(value.expires<now)limits.delete(key);
    const key=req.ip;const count=limits.get(key);if(!count||count.expires<now)limits.set(key,{count:1,expires:now+60000});else{count.count++;if(count.count>240)fail(429,'RATE_LIMIT','Muitas requisições. Aguarde um momento.');}
  });
  app.setErrorHandler((error,_req,reply)=>{
    if(error instanceof ZodError)return reply.code(400).send({error:{code:'VALIDATION_ERROR',message:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')}});
    const e=error as Error&{statusCode?:number;code?:string};
    const known=e instanceof AppError||e.statusCode;
    const status=known?e.statusCode??500:500;
    const safeMessage=status<500?(e.message==='FORBIDDEN'?'Acesso negado ao espaço.':e.message==='REVISION_CONFLICT'?'Este conteúdo foi atualizado. Recarregue antes de salvar.':e.message):e instanceof AppError||/^(SOCIAL_|INTEGRATION_|TIKTOK_|YOUTUBE_)/.test(e.code??'')?e.message:'Operação indisponível. Consulte o registro de execução.';
    if(status>=500)app.log.warn({errorCode:e.code??e.name},'Operation failed');
    return reply.code(status).send({error:{code:known?e.code??e.message:'INTERNAL_ERROR',message:safeMessage}});
  });
  async function actorFor(req:Parameters<typeof authenticate>[0]){let actor=actors.get(req);if(!actor){actor=await authenticate(req,config);actors.set(req,actor);}return actor;}
  async function readyActor(req:Parameters<typeof authenticate>[0]){const actor=await actorFor(req);const blockers=await productionBlockers(config,db);if(blockers.length)fail(503,'SETUP_REQUIRED','O ambiente aguarda configuração de identidade e infraestrutura.');await verifyAuthority(config,actor.id);return actor;}
  const scopeFor:EngineDeps['scopeFor']=async(req,allowed)=>{const actor=await readyActor(req);const {id}=req.params as {id:string};const scope=await repo.getScope(actor.id,config.projectId,config.ownerId!,uuid(id));if(allowed)requireRoles(scope,allowed);return scope;};
  const deps:EngineDeps={config,db,repo,scopeFor,files,vault,authorizeJob:async(scope)=>{if(!config.sandbox){if((await productionBlockers(config,db)).length)fail(503,'SETUP_REQUIRED','Ambiente indisponível para execução de trabalhos.');await verifyAuthority(config,scope.actorId);}return repo.getScope(scope.actorId,scope.projectId,scope.ownerId,scope.tenantId);}};
  await app.register(multipart,{limits:{fileSize:config.maxUploadBytes,files:1,fields:10}});
  app.get('/live',async()=>({alive:true,service:'SocialEngine'}));
  app.get('/health',async(_req,reply)=>{const blockers=await productionBlockers(config,db);try{await db.health();}catch{blockers.push('Banco indisponível.');}return reply.code(blockers.length?503:200).send({service:'SocialEngine',ready:!blockers.length,mode:config.sandbox?'sandbox':'production',blockers});});
  app.get('/api/runtime',async()=>({sandbox:config.sandbox,authConfigured:config.sandbox||!!(config.supabaseUrl&&config.supabaseAnonKey),supabaseUrl:config.supabaseUrl??'',supabaseAnonKey:config.supabaseAnonKey??'',...(config.sandbox?{sandboxToken:'sandbox-admin'}:{}),blockers:await productionBlockers(config,db),capabilities:capabilities()}));
  app.get('/api/workspaces',async req=>{const actor=await readyActor(req);return {workspaces:await repo.listWorkspaces(actor.id,config.projectId,config.ownerId!)};});
  app.post('/api/workspaces',async req=>{const actor=await readyActor(req);const existing=await repo.listWorkspaces(actor.id,config.projectId,config.ownerId!);if(!config.sandbox&&!config.bootstrapUserIds.includes(actor.id)&&!existing.some(w=>w.roles.includes('admin')))fail(403,'ADMIN_REQUIRED','Solicite ao administrador a criação do seu espaço.');const input=workspaceSchema.parse(req.body);const workspace=await repo.createWorkspace(actor.id,config.projectId,config.ownerId!,input);const scope=await repo.getScope(actor.id,config.projectId,config.ownerId!,workspace.id);await repo.audit(scope,'workspace.created',workspace.id);return {workspace};});
  app.get('/api/tenants/:id/dataset',async req=>{
    const scope=await scopeFor(req);const keys={posts:'post',sources:'source',versions:'post_version',accounts:'social_account',publications:'publication',metrics:'metric_snapshot',trends:'trend_topic',trendSources:'trend_source',trendItems:'trend_item',trendObservations:'trend_observation',trendExtractions:'trend_extraction',usage:'ai_usage',campaigns:'campaign'} as const;
    const pairs=await Promise.all(Object.entries(keys).map(async([key,kind])=>[key,await repo.list(scope,kind)]));const result=Object.fromEntries(pairs);
    const workspace=(await repo.listWorkspaces(scope.actorId,scope.projectId,scope.ownerId)).find(w=>w.id===scope.tenantId)!;
    const settings=await db.scoped(scope,async tx=>(await tx.query<{value:unknown}>('select value from custom_socialengine.settings where key=$1',[`${scope.tenantId}:ai`])).rows[0]);
    const jobs=await db.scoped(scope,async tx=>(await tx.query<Record<string,unknown>>('select id,event_type,state,attempts,run_at,lease_until,idempotency_key,last_error,created_at from custom_socialengine.events order by created_at desc limit 200')).rows.map(r=>({id:r.id,type:r.event_type,state:r.state,attempts:r.attempts,runAt:r.run_at,leaseUntil:r.lease_until,idempotencyKey:r.idempotency_key,lastError:r.last_error})));
    const audit=(await repo.listAudit(scope)).map((a:Record<string,unknown>)=>({id:a.id,action:a.action,resourceId:a.resource_id,metadata:a.metadata,createdAt:a.created_at}));
    // Explicitly whitelist account metadata; OAuth state and credentials never join the dataset.
    result.accounts=(result.accounts??[]).map((row:{data:Record<string,unknown>})=>({...row,data:Object.fromEntries(['platform','handle','name','state','externalId','providerId','connectedAt','capabilities'].filter(k=>row.data[k]!==undefined).map(k=>[k,row.data[k]]))}));
    return {...result,workspace:{...workspace,ai:settings?.value},jobs,members:await repo.listMembers(scope),audit,credentials:scope.roles.includes('admin')?await vault.list(scope):[],capabilities:capabilities()};
  });
  app.patch('/api/tenants/:id/settings',async req=>{const scope=await scopeFor(req,['admin']);const input=workspaceSchema.parse(req.body);if(input.brand.logoFileId)await files.read(scope,input.brand.logoFileId);const max=Number(process.env.AI_MONTHLY_REQUEST_LIMIT??100);if(input.ai&&input.ai.monthlyRequests>max)fail(400,'QUOTA_LIMIT','A cota solicitada ultrapassa o limite da plataforma.');await db.scoped(scope,async tx=>{const workspace=(await tx.query<{metadata:Workspace}>('select metadata from custom_socialengine.entities where id=$1',[scope.tenantId])).rows[0];if(!workspace)fail(404,'WORKSPACE_NOT_FOUND','Espaço não encontrado.');await tx.query('update custom_socialengine.entities set name=$1,metadata=$2,updated_at=now() where id=$3',[input.name,{...workspace.metadata,...input},scope.tenantId]);if(input.ai)await tx.query('insert into custom_socialengine.settings(id,key,value,is_public,project_id,owner_id,tenant_id) values(gen_random_uuid(),$1,$2,false,$3,$4,$5) on conflict(key) do update set value=excluded.value,updated_at=now()',[`${scope.tenantId}:ai`,input.ai,scope.projectId,scope.ownerId,scope.tenantId]);});await repo.audit(scope,'workspace.updated',scope.tenantId);return {workspace:(await repo.listWorkspaces(scope.actorId,scope.projectId,scope.ownerId)).find(w=>w.id===scope.tenantId)};});
  app.post('/api/tenants/:id/members',async req=>{const scope=await scopeFor(req,['admin']);const input=z.object({userId:z.string().uuid(),roles:z.array(roleSchema).max(5)}).parse(req.body);if(!config.sandbox){const exists=await db.system(async tx=>(await tx.query('select id from auth.users where id=$1',[input.userId])).rows[0]);if(!exists)fail(400,'MEMBER_NOT_FOUND','O membro precisa ter uma conta existente.');}await repo.setMember(scope,input.userId,[...new Set(input.roles)]);return {members:await repo.listMembers(scope)};});
  app.post('/api/tenants/:id/sources',async req=>{const scope=await scopeFor(req,['admin','editor']);const request=z.object({accessAcknowledged:z.boolean().optional()}).passthrough().parse(req.body);const input=sourceSchema.parse(req.body);if(input.fileId){const {file,bytes}=await files.read(scope,input.fileId);if(file.mimeType==='text/plain')input.text=bytes.toString('utf8').slice(0,100000);else if(file.mimeType==='application/pdf')input.text=(await extractPdf(bytes)).slice(0,100000);}else if(input.url&&input.kind==='news'&&request.accessAcknowledged===true&&!input.text.trim()){const result=await fetchSource(input.url);input.text=extractHtml(result.bytes.toString('utf8'),result.url).text.slice(0,100000);}input.extractionState=input.text.trim()?'extracted':'metadata_only';const source=await repo.insert(scope,'source',input);await repo.audit(scope,'source.created',source.id);return {source};});
  app.post('/api/tenants/:id/files',async req=>{const scope=await scopeFor(req,['admin','editor']);const part=await req.file();if(!part)fail(400,'FILE_REQUIRED','Selecione um arquivo.');const bytes=await part!.toBuffer();const file=await files.put(scope,bytes,part!.filename,part!.mimetype);await repo.audit(scope,'file.uploaded',file.id);return {file};});
  app.get('/api/tenants/:id/files/:fileId',async(req,reply)=>{const scope=await scopeFor(req);const {fileId}=req.params as {fileId:string};const {file,bytes}=await files.read(scope,fileId);return reply.header('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`).type(file.mimeType).send(bytes);});
  async function assertReferences(scope:Scope,data:PostData){for(const id of data.sourceIds)if(!await repo.get(scope,'source',id))fail(400,'SOURCE_NOT_FOUND','Uma fonte não pertence a este espaço.');for(const slide of data.slides)if(slide.imageFileId)await files.read(scope,slide.imageFileId);if(data.referenceFileId)await files.read(scope,data.referenceFileId);if(data.video?.audioFileId)await files.read(scope,data.video.audioFileId);if(data.video?.fileId)await files.read(scope,data.video.fileId);}
  app.post('/api/tenants/:id/posts',async req=>{const scope=await scopeFor(req,['admin','editor']);const input=postSchema.parse(req.body);if(input.status!=='draft')fail(400,'DRAFT_REQUIRED','Novos conteúdos começam como rascunho.');delete input.approvedBy;delete input.approvedAt;delete input.approvedRevision;await assertReferences(scope,input);return {post:await repo.insert(scope,'post',input)};});
  app.put('/api/tenants/:id/posts/:postId',async req=>{const scope=await scopeFor(req,['admin','editor']);const {postId}=req.params as {postId:string};const input=z.object({revision:z.number().int().positive(),data:postSchema}).parse(req.body);await assertReferences(scope,input.data);input.data.status='draft';delete input.data.approvedBy;delete input.data.approvedAt;delete input.data.approvedRevision;return {post:await repo.update(scope,'post',uuid(postId),input.data,input.revision)};});
  app.post('/api/tenants/:id/posts/:postId/review',async req=>{const scope=await scopeFor(req);const input=z.object({revision:z.number().int().positive(),action:z.enum(['submit','approve','request_changes']),comment:z.string().max(3000).optional()}).parse(req.body);const {postId}=req.params as {postId:string};const post=await repo.get<PostData>(scope,'post',uuid(postId));if(!post)fail(404,'POST_NOT_FOUND','Conteúdo não encontrado.');if(post!.revision!==input.revision)fail(409,'REVISION_CONFLICT','A versão foi alterada. Recarregue antes de revisar.');
    if(input.action==='submit'){requireRoles(scope,['admin','editor']);if(!['draft','changes_requested'].includes(post!.data.status))fail(409,'INVALID_TRANSITION','Apenas rascunhos e ajustes podem ser enviados à revisão.');}
    else{requireRoles(scope,['admin','reviewer']);if(post!.data.status!=='in_review')fail(409,'INVALID_TRANSITION','O conteúdo precisa estar em revisão.');}
    const status=input.action==='submit'?'in_review':input.action==='approve'?'approved':'changes_requested';const data:PostData={...post!.data,status,reviewComment:input.comment};
    return {post:await repo.update(scope,'post',post!.id,data,input.revision)};
  });
  app.post('/api/tenants/:id/credentials',async req=>{const scope=await scopeFor(req,['admin']);const input=z.object({provider:z.enum(['openai','anthropic']),key:z.string().trim().min(12).max(2000)}).parse(req.body);const credential=await vault.save(scope,input.provider,input.key);await repo.audit(scope,'credential.saved',credential.id,{provider:input.provider});return {credential};});
  app.delete('/api/tenants/:id/credentials/:credentialId',async req=>{const scope=await scopeFor(req,['admin']);const {credentialId}=req.params as {credentialId:string};await vault.revoke(scope,uuid(credentialId));await repo.audit(scope,'credential.revoked',credentialId);return {ok:true};});
  app.post('/api/tenants/:id/credentials/:credentialId/test',async req=>{const scope=await scopeFor(req,['admin']);const {credentialId}=req.params as {credentialId:string};const result=await vault.test(scope,uuid(credentialId));await repo.audit(scope,'credential.tested',credentialId,{ok:result.ok});return result;});
  await registerEngineRoutes(app,deps);
  await registerSocialRoutes(app,deps);
  const staticRoot=resolve(process.cwd(),'dist/client');
  if(existsSync(staticRoot)){await app.register(fastifyStatic,{root:staticRoot,prefix:'/',index:['index.html']});}
  app.setNotFoundHandler((req,reply)=>req.url.startsWith('/api/')?reply.code(404).send({error:{code:'NOT_FOUND',message:'Recurso não encontrado.'}}):reply.code(404).type('text/html').send('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Página não encontrada · SocialEngine</title><body><h1>Página não encontrada</h1><p>Este endereço não existe no SocialEngine.</p><a href="/">Voltar ao painel</a></body></html>'));
  return {app,deps,repo,files,vault};
}
