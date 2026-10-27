import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import Fastify from 'fastify';
import {readConfig} from '../src/config.ts';
import {createDatabase} from '../src/db.ts';
import {Repository} from '../src/repository.ts';
import {migrate} from '../scripts/migrate.ts';
import {registerEngineRoutes,type EngineDeps} from '../src/engine/index.ts';
import type {PostData,SourceData} from '../src/contracts.ts';

test('generation reserves per-tenant quota atomically, persists real usage and invalidates approval',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'socialengine-generation-'));const config={...readConfig(true),dataDir,projectId:randomUUID(),ownerId:randomUUID()};const db=await createDatabase(config),app=Fastify(),realFetch=globalThis.fetch;
 try{
  await migrate(db);const repo=new Repository(db),actor=randomUUID(),workspace=await repo.createWorkspace(actor,config.projectId,config.ownerId,{name:'Generation',characterKit:{text:'Persona editorial: tom preciso, sem promessas de resultados.'},objectives:'Ensinar com clareza',blog:{url:'',status:'undefined',platform:'',feedUrl:'',language:'EN-US',integrationState:'not_configured'}}),scope=await repo.getScope(actor,config.projectId,config.ownerId,workspace.id);
  const deps:EngineDeps={config,db,repo,scopeFor:async()=>scope,authorizeJob:s=>repo.getScope(s.actorId,s.projectId,s.ownerId,s.tenantId),files:{put:async()=>{throw new Error('unused');},read:async()=>{throw new Error('unused');}},vault:{reveal:async()=>'test-key-not-real'}};
  await registerEngineRoutes(app,deps);
  const source=await repo.insert<SourceData>(scope,'source',{title:'Research',kind:'text',text:'Texto de pesquisa disponível e autorizado.',extractionState:'extracted'});
  const post=await repo.insert<PostData>(scope,'post',{title:'Old title',format:'carousel',slides:[{id:randomUUID(),title:'Old',body:'Old'}],caption:'',cta:'',sourceIds:[source.id],structure:'problem_solution',color:'#8057f5',platforms:['instagram'],status:'draft'});
  const otherPost=await repo.insert<PostData>(scope,'post',post.data);
  await db.scoped(scope,tx=>tx.query('INSERT INTO custom_socialengine.settings(key,value,project_id,owner_id,tenant_id) VALUES($1,$2,$3,$4,$5)',[`${scope.tenantId}:ai`,{provider:'openai',model:'test-model',monthlyRequests:1},scope.projectId,scope.ownerId,scope.tenantId]));
  let calls=0;globalThis.fetch=async(_url,options)=>{calls++;const input=JSON.parse(JSON.parse(String(options?.body)).input);assert.equal(input.context.characterKit,workspace.characterKit?.text);assert.equal(input.context.language,'EN-US');assert.equal(input.context.objectives,'Ensinar com clareza');return new Response(JSON.stringify({id:'resp-test',status:'completed',usage:{input_tokens:12,output_tokens:20,total_tokens:32},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({title:'Generated title',slides:[{title:'Generated',body:'Verified facts'}],caption:'Caption',cta:'Read'})}]}]}),{status:200});};
  const payload={postId:post.id,revision:post.revision,sourceIds:[source.id],structure:'problem_solution'};
  const responses=await Promise.all([app.inject({method:'POST',url:`/api/tenants/${scope.tenantId}/generate`,payload}),app.inject({method:'POST',url:`/api/tenants/${scope.tenantId}/generate`,payload:{...payload,postId:otherPost.id}})]);
  assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,429]);assert.equal(calls,1);
  const updated=await repo.get<PostData>(scope,'post',post.id);assert.equal(updated?.revision,2);assert.equal(updated?.data.title,'Generated title');assert.equal(updated?.data.status,'draft');assert.equal(updated?.data.approvedRevision,undefined);
  const usage=await repo.list(scope,'ai_usage');assert.equal(usage.length,1);assert.equal(usage[0].data.state,'succeeded');assert.equal(usage[0].data.totalTokens,32);assert.equal((await repo.list(scope,'post_version')).length,3);
 }finally{globalThis.fetch=realFetch;await app.close();await db.close();await rm(dataDir,{recursive:true,force:true});}
});
