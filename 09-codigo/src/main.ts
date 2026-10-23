import {readConfig} from './config.ts';
import {createDatabase} from './db.ts';
import {createApplication} from './app.ts';
import {migrate} from '../scripts/migrate.ts';
import {initializeSandbox} from './sandbox.ts';
import {runWorkerOnce} from './engine/index.ts';
import {productionBlockers} from './security.ts';

const config=readConfig();const db=await createDatabase(config);
if(config.sandbox){await migrate(db);await initializeSandbox(config,db);}
const {app,deps}=await createApplication(config,db);
let running=false;let closing=false;let currentTick:Promise<void>=Promise.resolve();
const interval=setInterval(()=>{if(running||closing||process.env.SOCIALENGINE_WORKER_ENABLED==='false')return;running=true;currentTick=(async()=>{try{if(!config.sandbox&&(await productionBlockers(config,db)).length)return;for(let i=0;i<5&&!closing;i++)if(!await runWorkerOnce(deps))break;}catch(error){app.log.warn({code:(error as {code?:string}).code??'WORKER_UNAVAILABLE'},'Worker waiting for dependencies');}finally{running=false;}})();},10000);
interval.unref();
async function shutdown(){if(closing)return;closing=true;clearInterval(interval);await app.close();await currentTick;await db.close();process.exitCode=0;}
process.on('SIGINT',()=>void shutdown());process.on('SIGTERM',()=>void shutdown());
await app.listen({host:config.host,port:config.port});
console.log(`SocialEngine ${config.sandbox?'SANDBOX (dados de teste locais)':'production'}: http://${config.host}:${config.port}`);
