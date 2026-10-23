import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {readConfig} from '../src/config.ts';
import {createDatabase} from '../src/db.ts';
import {Repository} from '../src/repository.ts';
import {migrate} from '../scripts/migrate.ts';
import {enqueue,runWorkerOnce} from '../src/engine/jobs.ts';
import type {EngineDeps} from '../src/engine/types.ts';
import type {TrendSource} from '../src/engine/trends.ts';

test('opt-in live RSS and HTML: extraction, tenant ranking, historical evidence and next schedule',{skip:process.env.RUN_LIVE_TRENDS!=='true',timeout:90_000},async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'socialengine-live-'));const config={...readConfig(true),dataDir,projectId:randomUUID(),ownerId:randomUUID()};const db=await createDatabase(config);
 try{
  await migrate(db);const repo=new Repository(db),actor=randomUUID();
  const deps:EngineDeps={config,db,repo,scopeFor:async()=>{throw new Error('unused');},authorizeJob:s=>repo.getScope(s.actorId,s.projectId,s.ownerId,s.tenantId),files:{put:async()=>{throw new Error('unused');},read:async()=>{throw new Error('unused');}},vault:{reveal:async()=>null}};
  const cases:[string,'rss'|'html',string,string[]][]=[['Tecnologia','rss','https://feeds.bbci.co.uk/news/technology/rss.xml',['ai','technology']],['Domínios de internet','html','https://example.com/',['domain']]];
  for(const [niche,type,url,keywords]of cases){
   const workspace=await repo.createWorkspace(actor,config.projectId,config.ownerId,{name:niche,niche});const scope=await repo.getScope(actor,config.projectId,config.ownerId,workspace.id);
   const source=await repo.insert<TrendSource>(scope,'trend_source',{name:niche,type,url,keywords,exclusions:[],region:'GB',language:'en',intervalMinutes:360,enabled:true,accessAcknowledged:true});
   const job=await enqueue(deps,scope,'trends.collect',{sourceId:source.id},'live-proof');assert.equal(await runWorkerOnce(deps),true);
   const state=(await db.system(tx=>tx.query<{state:string;last_error:string}>('SELECT state,last_error FROM custom_socialengine.events WHERE id=$1',[job.id]))).rows[0];assert.equal(state.state,'succeeded',state.last_error);
   const items=await repo.list(scope,'trend_item'),topics=await repo.list(scope,'trend_topic'),history=await repo.list(scope,'trend_observation');assert.ok(items.length>0);assert.ok(topics.length>0);assert.ok(history.length>0);assert.ok(topics.every(x=>x.data.state==='recent_opportunity'&&x.data.growth===null));
   const schedules=await db.scoped(scope,tx=>tx.query<{run_at:string}>("SELECT run_at FROM custom_socialengine.events WHERE state='queued'"));assert.equal(schedules.rows.length,1);assert.ok(Date.parse(schedules.rows[0].run_at)>Date.now());
   console.log(JSON.stringify({liveConnectorProof:true,niche,type,url,items:items.length,topics:topics.length,observations:history.length,nextRunAt:schedules.rows[0].run_at}));
  }
 }finally{await db.close();await rm(dataDir,{recursive:true,force:true});}
});
