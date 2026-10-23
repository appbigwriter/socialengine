import {readConfig} from './config.ts';
import {createDatabase} from './db.ts';
import {createApplication} from './app.ts';
import {migrate} from '../scripts/migrate.ts';
import {initializeSandbox} from './sandbox.ts';
import {runWorkerOnce} from './engine/index.ts';

const config=readConfig();const db=await createDatabase(config);
if(config.sandbox){await migrate(db);await initializeSandbox(config,db);}
const {app,deps}=await createApplication(config,db);
let running=false;
const interval=setInterval(async()=>{if(running)return;running=true;try{for(let i=0;i<5;i++)if(!await runWorkerOnce(deps))break;}catch(error){app.log.warn({code:(error as {code?:string}).code??'WORKER_UNAVAILABLE'},'Worker waiting for dependencies');}finally{running=false;}},10000);
interval.unref();
async function shutdown(){clearInterval(interval);await app.close();await db.close();process.exitCode=0;}
process.on('SIGINT',()=>void shutdown());process.on('SIGTERM',()=>void shutdown());
await app.listen({host:config.host,port:config.port});
console.log(`SocialEngine ${config.sandbox?'SANDBOX (dados de teste locais)':'production'}: http://${config.host}:${config.port}`);
