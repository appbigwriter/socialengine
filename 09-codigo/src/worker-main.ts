import {setTimeout} from 'node:timers/promises';
import {readConfig} from './config.ts';
import {createDatabase} from './db.ts';
import {createApplication} from './app.ts';
import {runWorkerOnce} from './engine/index.ts';
const config=readConfig();if(config.sandbox)throw new Error('Use npm run dev for sandbox.');
const db=await createDatabase(config);const {app,deps}=await createApplication(config,db);
let stopping=false;process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
try{while(!stopping){try{if(!await runWorkerOnce(deps))await setTimeout(10000);}catch{console.warn('Worker waiting for configuration or dependencies.');await setTimeout(30000);}}}finally{await app.close();await db.close();}
