import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import type {Database} from '../src/contracts.js';
export async function migrate(db:Database):Promise<void>{
 await db.system(async t=>{
  await t.query(`CREATE SCHEMA IF NOT EXISTS custom_socialengine;
CREATE TABLE IF NOT EXISTS custom_socialengine.entities(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),key text NOT NULL UNIQUE,name text,type text,metadata jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS custom_socialengine.entity_relations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_entity_id uuid,target_entity_id uuid,relation_type text,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS custom_socialengine.records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity_id uuid,data jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS custom_socialengine.files(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,path text,mime_type text,size_bytes bigint,metadata jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS custom_socialengine.settings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),key text NOT NULL UNIQUE,value jsonb NOT NULL DEFAULT '{}',is_public boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS custom_socialengine.audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),action text,resource_id text,metadata jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS custom_socialengine.events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_type text,payload jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS custom_socialengine.migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now());`);
  const directory=fileURLToPath(new URL('../supabase/migrations/',import.meta.url));
  for(const name of (await readdir(directory)).filter(x=>x.endsWith('.sql')).sort()){
   if((await t.query('SELECT name FROM custom_socialengine.migrations WHERE name=$1',[name])).rowCount)continue;
   await t.query(await readFile(join(directory,name),'utf8'));await t.query('INSERT INTO custom_socialengine.migrations(name) VALUES($1)',[name]);
  }
 });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const {createDatabase}=await import('../src/db.js');const {readConfig}=await import('../src/config.js');
 const db=await createDatabase(readConfig());try{await migrate(db);console.log('Migrations applied.');}finally{await db.close();}
}


