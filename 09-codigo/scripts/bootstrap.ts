import {readConfig,SANDBOX_ACTOR} from '../src/config.js';
import {createDatabase} from '../src/db.js';
import {Repository} from '../src/repository.js';
import {migrate} from './migrate.js';
const config=readConfig();
if(!config.ownerId)throw new Error('Owner unresolved: configure catalog-derived AUTHORITY_OWNER_ID before bootstrap.');
if(!config.sandbox&&!config.bootstrapUserIds.length)throw new Error('Explicit administrator user IDs required.');
const db=await createDatabase(config);
try{
 if(!config.sandbox){
  await db.system(async tx=>{
   const project=(await tx.query<{authority_owner_id:string|null;schema_name:string}>('SELECT authority_owner_id,schema_name FROM public.projects WHERE id=$1',[config.projectId])).rows[0];
   if(!project||project.authority_owner_id!==config.ownerId||project.schema_name!=='custom_socialengine')throw new Error('Catalog ownership not confirmed; bootstrap denied.');
   for(const actor of config.bootstrapUserIds){const user=(await tx.query('SELECT id FROM auth.users WHERE id=$1 AND deleted_at IS NULL AND is_anonymous IS NOT TRUE',[actor])).rows[0];if(!user)throw new Error('Bootstrap administrator must be an existing authenticated user.');}
  });
 }
 await migrate(db);const repository=new Repository(db);
 const actors=config.sandbox?[SANDBOX_ACTOR]:config.bootstrapUserIds;
 for(const actor of actors){if(!(await repository.listWorkspaces(actor,config.projectId,config.ownerId)).length)await repository.createWorkspace(actor,config.projectId,config.ownerId,{name:config.sandbox?'Influenciador Sandbox':'Meu influenciador',niche:config.sandbox?'Tecnologia':''});}
 console.log('Bootstrap complete.');
}finally{await db.close();}
