import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readConfig} from '../src/config.ts';
import {createDatabase} from '../src/db.ts';
import {migrate} from '../scripts/migrate.ts';
import {createApplication} from '../src/app.ts';

test('production liveness is distinct from readiness and missing ownership never grants access',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'socialengine-deployment-'));
  const local={...readConfig(true),dataDir:directory};const db=await createDatabase(local);await migrate(db);
  const production={...local,sandbox:false,production:true,ownerId:undefined,authorityVerifierUrl:undefined,encryptionKey:undefined,supabaseUrl:undefined,supabaseAnonKey:undefined};
  const {app}=await createApplication(production,db);
  try{
    const live=await app.inject('/live');assert.equal(live.statusCode,200);assert.equal(live.json().alive,true);
    const health=await app.inject('/health');assert.equal(health.statusCode,503);assert.equal(health.json().ready,false);assert(health.json().blockers.length>0);
    const runtime=await app.inject('/api/runtime');assert.equal(runtime.json().sandbox,false);assert.equal(runtime.json().sandboxToken,undefined);assert.equal(runtime.json().supabaseServiceKey,undefined);assert.equal(runtime.json().encryptionKey,undefined);
    const privateRoute=await app.inject({url:'/api/workspaces',headers:{authorization:'Bearer sandbox-admin'}});assert.equal(privateRoute.statusCode,401);
  }finally{await app.close();await db.close();await rm(directory,{recursive:true,force:true});}
});

test('a mistakenly configured secret key is never exposed as a public Supabase key',()=>{
  const previous=process.env.SUPABASE_ANON_KEY;
  try{process.env.SUPABASE_ANON_KEY='sb_secret_private-value-for-test';assert.equal(readConfig(true).supabaseAnonKey,undefined);process.env.SUPABASE_ANON_KEY='sb_publishable_public-value-for-test';assert.equal(readConfig(true).supabaseAnonKey,'sb_publishable_public-value-for-test');}
  finally{if(previous===undefined)delete process.env.SUPABASE_ANON_KEY;else process.env.SUPABASE_ANON_KEY=previous;}
});
