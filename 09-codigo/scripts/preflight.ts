import {mkdir,writeFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {readConfig} from '../src/config.ts';
import {createDatabase} from '../src/db.ts';
import {productionBlockers} from '../src/security.ts';

const config=readConfig();
if(config.sandbox)throw new Error('Use preflight with production configuration, not sandbox.');
let db:Awaited<ReturnType<typeof createDatabase>>|undefined;
const checks:{name:string;ok:boolean;message?:string}[]=[];
try{
  try{db=await createDatabase(config);}catch{checks.push({name:'database',ok:false,message:'Configure DATABASE_URL acessível pelo container.'});}
  const blockers=await productionBlockers(config,db);
  for(const message of blockers)checks.push({name:'runtime_contract',ok:false,message});
  if(db){try{await db.system(async tx=>{const rows=await tx.query<{count:string}>("select count(*)::text as count from information_schema.tables where table_schema='custom_socialengine' and table_name in ('memberships','credentials','records','events')");if(Number(rows.rows[0]?.count)!==4)throw new Error('Migrations required');});checks.push({name:'migrations',ok:true});}catch{checks.push({name:'migrations',ok:false,message:'Valide conexão e migrations do schema custom_socialengine.'});}}
  try{const url=new URL(config.publicUrl);if(url.protocol!=='https:')throw new Error();checks.push({name:'public_https',ok:true});}catch{checks.push({name:'public_https',ok:false,message:'Configure SOCIALENGINE_PUBLIC_URL como domínio HTTPS.'});}
  try{await mkdir(config.dataDir,{recursive:true});const path=join(config.dataDir,`.preflight-${randomUUID()}`);await writeFile(path,'volume-check',{flag:'wx',mode:0o600});await unlink(path);checks.push({name:'private_volume_writable',ok:true});}catch{checks.push({name:'private_volume_writable',ok:false,message:'O volume privado deve permitir escrita pelo UID 1000.'});}
  if(config.supabaseUrl&&config.supabaseAnonKey){try{const response=await fetch(`${config.supabaseUrl}/auth/v1/health`,{headers:{apikey:config.supabaseAnonKey},signal:AbortSignal.timeout(8000)});checks.push({name:'supabase_auth',ok:response.ok});}catch{checks.push({name:'supabase_auth',ok:false});}}
  const ok=!checks.some(check=>!check.ok);console.log(JSON.stringify({ready:ok,checks},null,2));process.exitCode=ok?0:1;
}finally{await db?.close();}
