import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import type {Database,PostData,RuntimeConfig,Scope} from './contracts.ts';
import {Repository} from './repository.ts';
import {SANDBOX_ACTOR,SANDBOX_SECOND_ACTOR} from './config.ts';
export async function initializeSandbox(config:RuntimeConfig,db:Database){
  if(!config.sandbox||config.production)throw new Error('Sandbox initialization prohibited.');
  await mkdir(config.dataDir,{recursive:true});const keyPath=resolve(config.dataDir,'master.key');
  try{config.encryptionKey=await readFile(keyPath,'utf8');}catch{config.encryptionKey=randomBytes(32).toString('base64');await writeFile(keyPath,config.encryptionKey,{mode:0o600,flag:'wx'});}
  const repo=new Repository(db);
  const seed=[{actor:SANDBOX_ACTOR,name:'Ana · Ideias em movimento',niche:'Criatividade e hábitos',color:'#c9f177'},{actor:SANDBOX_SECOND_ACTOR,name:'Lucas · Um olhar para o futuro',niche:'Tecnologia e inovação',color:'#b5c2f7'}];
  for(const item of seed){
    if((await repo.listWorkspaces(item.actor,config.projectId,config.ownerId!)).length)continue;
    const workspace=await repo.createWorkspace(item.actor,config.projectId,config.ownerId!,{name:item.name,niche:item.niche,audience:'Pessoas curiosas que buscam aprender com exemplos práticos',objectives:'Compartilhar conhecimento original',brand:{color:item.color,voice:'Próximo, claro e curioso'},blog:{url:'',status:'provisioning',platform:'',feedUrl:'',language:'pt-BR',integrationState:'not_configured'}});
    const scope=await repo.getScope(item.actor,config.projectId,config.ownerId!,workspace.id);
    const source=await repo.insert(scope,'source',{title:'Anotações para uma nova ideia',kind:'text',text:'Uma ideia começa com uma pergunta. Observar o cotidiano ajuda a reconhecer oportunidades. Escolha um pequeno experimento e registre o que aprendeu. Compartilhe sua descoberta com exemplos próprios.',extractionState:'extracted'});
    const post:PostData={title:'Sua próxima ideia começa com uma pergunta',format:'carousel',slides:[{id:randomUUID(),title:'Uma boa pergunta pode mudar seu próximo passo.',body:'Um convite para observar o cotidiano com curiosidade.'},{id:randomUUID(),title:'Comece pelo que está perto.',body:'Escolha uma situação da sua rotina. O que você gostaria de entender melhor?'},{id:randomUUID(),title:'Transforme curiosidade em um pequeno experimento.',body:'Experimente uma ação. Observe o resultado. Registre o aprendizado.'}],caption:'Qual pergunta você gostaria de explorar hoje?',cta:'Leve uma ideia com você.',sourceIds:[source.id],structure:'educational',color:item.color,platforms:['instagram'],status:'draft'};
    await repo.insert(scope,'post',post);await repo.audit(scope,'sandbox.seeded',workspace.id,{testData:true});
  }
}
