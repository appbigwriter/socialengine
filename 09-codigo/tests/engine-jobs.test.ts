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

test('persistent queue deduplicates, claims once, blocks revoked actor, and quarantines expired publications',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'socialengine-queue-'));const config={...readConfig(true),dataDir,projectId:randomUUID(),ownerId:randomUUID()};const db=await createDatabase(config);
 try{
  await migrate(db);const repo=new Repository(db),actor=randomUUID(),workspace=await repo.createWorkspace(actor,config.projectId,config.ownerId,{name:'Queue'}),scope=await repo.getScope(actor,config.projectId,config.ownerId,workspace.id);
  const deps:EngineDeps={config,db,repo,scopeFor:async()=>scope,authorizeJob:s=>repo.getScope(s.actorId,s.projectId,s.ownerId,s.tenantId),files:{put:async()=>{throw new Error('unused');},read:async()=>{throw new Error('unused');}},vault:{reveal:async()=>null}};
  const source=await repo.insert(scope,'trend_source',{name:'Disabled',enabled:false});
  const first=await enqueue(deps,scope,'trends.collect',{sourceId:source.id},'same-key');const second=await enqueue(deps,scope,'trends.collect',{sourceId:source.id},'same-key');assert.equal(first.id,second.id);
  const results=await Promise.all([runWorkerOnce(deps),runWorkerOnce(deps)]);assert.equal(results.filter(Boolean).length,1);
  const row=await db.system(tx=>tx.query<{state:string;attempts:number}>('SELECT state,attempts FROM custom_socialengine.events WHERE id=$1',[first.id]));assert.equal(row.rows[0].state,'succeeded');assert.equal(row.rows[0].attempts,1);
  const publish=await enqueue(deps,scope,'publication.publish',{postId:randomUUID()},'expired');
  await db.system(tx=>tx.query("UPDATE custom_socialengine.events SET state='processing',lease_token=$1,lease_until=now()-interval '1 minute' WHERE id=$2",[randomUUID(),publish.id]));
  assert.equal(await runWorkerOnce(deps),false);
  assert.equal((await db.system(tx=>tx.query<{state:string}>('SELECT state FROM custom_socialengine.events WHERE id=$1',[publish.id]))).rows[0].state,'uncertain');
  const editor=randomUUID();await repo.setMember(scope,editor,['editor']);const former=await repo.getScope(editor,config.projectId,config.ownerId,workspace.id);const revoked=await enqueue(deps,former,'trends.collect',{sourceId:source.id},'revoked');await repo.setMember(scope,editor,[]);
  assert.equal(await runWorkerOnce(deps),true);
  const failed=(await db.system(tx=>tx.query<{state:string;last_error:string}>('SELECT state,last_error FROM custom_socialengine.events WHERE id=$1',[revoked.id]))).rows[0];assert.notEqual(failed.state,'succeeded');assert.equal(failed.last_error,'FORBIDDEN');
 }finally{await db.close();await rm(dataDir,{recursive:true,force:true});}
});
