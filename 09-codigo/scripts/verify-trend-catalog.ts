import {writeFile,mkdir} from 'node:fs/promises';
import {trendSourceCatalog} from '../src/engine/source-catalog.ts';
import {collectSource} from '../src/engine/trends.ts';

// Explicit opt-in network check, using the production collector and its robots/SSRF limits.
const results:object[]=[];let index=0;
async function worker(){while(index<trendSourceCatalog.length){const source=trendSourceCatalog[index++];const checkedAt=new Date().toISOString();try{
  const items=await collectSource({...source,exclusions:[],enabled:true,accessAcknowledged:true});
  const result={id:source.id,url:source.url,checkedAt,ok:true,items:items.length};results.push(result);console.log(JSON.stringify(result));
}catch(error){const result={id:source.id,url:source.url,checkedAt,ok:false,error:error instanceof Error?error.message:String(error)};results.push(result);console.log(JSON.stringify(result));}}}
await Promise.all([worker(),worker(),worker()]);
await mkdir('.data',{recursive:true});await writeFile('.data/trend-catalog-check.json',JSON.stringify(results,null,2)+'\n');
if(results.some(result=>!(result as {ok:boolean}).ok))process.exitCode=1;
