import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import type {Database,RuntimeConfig,Scope,Tx,QueryResult} from './contracts.js';

export async function createDatabase(config:RuntimeConfig):Promise<Database>{
  let chain:Promise<unknown>=Promise.resolve();
  const local=config.sandbox ? (await mkdir(config.dataDir,{recursive:true}), new PGlite(join(config.dataDir,'postgres'))) : undefined;
  const pool=local?undefined:new pg.Pool({connectionString:config.databaseUrl,max:10,connectionTimeoutMillis:8000,idleTimeoutMillis:30000,statement_timeout:15000,application_name:'socialengine'});
  if(!local&&!config.databaseUrl) throw new Error('DATABASE_URL_REQUIRED');
  const transaction=async<T>(scope:Scope|undefined,fn:(tx:Tx)=>Promise<T>):Promise<T>=>{
    const run=async()=>{
      const client=pool?await pool.connect():undefined;
      const query=async<R=Record<string,unknown>>(sql:string,params:unknown[]=[]):Promise<QueryResult<R>>=>{
        if(client){const r=await client.query(sql,params);return {rows:r.rows as R[],rowCount:r.rowCount??0};}
        if(!params.length){const results=await local!.exec(sql);const r=results.at(-1);return {rows:(r?.rows??[]) as R[],rowCount:r?.rows.length||r?.affectedRows||0};}
        const r=await local!.query<R>(sql,params);return {rows:r.rows,rowCount:r.rows.length||r.affectedRows||0};
      };
      try{
        await query('BEGIN');
        if(scope){
          for(const value of [scope.projectId,scope.ownerId,scope.tenantId,scope.actorId]) if(!value) throw new Error('INVALID_SCOPE');
          await query("SELECT set_config('se.project_id',$1,true),set_config('se.owner_id',$2,true),set_config('se.tenant_id',$3,true),set_config('se.actor_id',$4,true)",[scope.projectId,scope.ownerId,scope.tenantId,scope.actorId]);
          await query('SET LOCAL ROLE socialengine_app');
        }
        const result=await fn({query});await query('COMMIT');return result;
      }catch(error){await query('ROLLBACK');throw error;}finally{client?.release();}
    };
    if(!local)return run();
    const pending=chain.then(run,run);chain=pending.catch(()=>{});return pending;
  };
  return {scoped:(s,f)=>transaction(s,f),system:f=>transaction(undefined,f),health:async()=>{await transaction(undefined,async t=>{await t.query('SELECT 1');});},close:async()=>{await chain;if(local)await local.close();else await pool!.end();}};
}

