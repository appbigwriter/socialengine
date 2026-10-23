import {randomUUID} from 'node:crypto';
import type {Database,Scope,Kind,RecordRow,Workspace,Role} from './contracts.js';
type Raw={id:string;tenant_id:string;kind:Kind;data:unknown;revision:number;created_at:Date|string;updated_at:Date|string};
const iso=(v:Date|string)=>new Date(v).toISOString();
const row=<T>(r:Raw):RecordRow<T>=>({id:r.id,tenantId:r.tenant_id,kind:r.kind,data:r.data as T,revision:r.revision,createdAt:iso(r.created_at),updatedAt:iso(r.updated_at)});
export class Repository{
 constructor(readonly db:Database){}
 async listWorkspaces(actorId:string,projectId:string,ownerId:string):Promise<Workspace[]>{return this.db.system(async t=>{const r=await t.query<{id:string;name:string;metadata:Workspace;roles:Role[];created_at:string}>('SELECT e.id,e.name,e.metadata,e.created_at,m.roles FROM custom_socialengine.entities e JOIN custom_socialengine.memberships m ON m.project_id=e.project_id AND m.owner_id=e.owner_id AND m.tenant_id=e.id WHERE m.user_id=$1 AND e.project_id=$2 AND e.owner_id=$3 ORDER BY e.created_at',[actorId,projectId,ownerId]);return r.rows.map(x=>({...x.metadata,id:x.id,name:x.name,roles:x.roles,createdAt:iso(x.created_at)}));});}
 async getScope(actorId:string,projectId:string,ownerId:string,tenantId:string):Promise<Scope>{if(!ownerId)throw new Error('OWNER_UNRESOLVED');return this.db.system(async t=>{const r=await t.query<{roles:Role[]}>('SELECT roles FROM custom_socialengine.memberships WHERE user_id=$1 AND project_id=$2 AND owner_id=$3 AND tenant_id=$4',[actorId,projectId,ownerId,tenantId]);if(!r.rows[0])throw Object.assign(new Error('FORBIDDEN'),{statusCode:403});return {actorId,projectId,ownerId,tenantId,roles:r.rows[0].roles};});}
 async createWorkspace(actorId:string,projectId:string,ownerId:string,input:Partial<Workspace>):Promise<Workspace>{
  if(!ownerId)throw new Error('OWNER_UNRESOLVED');const id=randomUUID();const createdAt=new Date().toISOString();
  const workspace:Workspace={id,name:input.name??'Influenciador',niche:input.niche??'',audience:input.audience??'',objectives:input.objectives??'',timezone:input.timezone??'America/Sao_Paulo',brand:input.brand??{color:'#8057f5',voice:''},blog:input.blog??{url:'',status:'undefined',platform:'',feedUrl:'',language:'pt-BR',integrationState:'not_configured'},roles:['admin'],createdAt};
  const {roles:_,...metadata}=workspace;
  return this.db.system(async t=>{await t.query('INSERT INTO custom_socialengine.entities(id,key,name,type,metadata,project_id,owner_id,tenant_id) VALUES($1,$2,$3,$4,$5,$6,$7,$1)',[id,id,workspace.name,'influencer',metadata,projectId,ownerId]);await t.query('INSERT INTO custom_socialengine.memberships(tenant_id,user_id,roles,project_id,owner_id) VALUES($1,$2,$3,$4,$5)',[id,actorId,['admin'],projectId,ownerId]);return workspace;});
 }
 async list<T=Record<string,unknown>>(s:Scope,kind:Kind):Promise<RecordRow<T>[]>{return this.db.scoped(s,async t=>(await t.query<Raw>('SELECT * FROM custom_socialengine.records WHERE kind=$1 ORDER BY created_at DESC',[kind])).rows.map(row<T>));}
 async get<T=Record<string,unknown>>(s:Scope,kind:Kind,id:string):Promise<RecordRow<T>|undefined>{return this.db.scoped(s,async t=>{const x=(await t.query<Raw>('SELECT * FROM custom_socialengine.records WHERE kind=$1 AND id=$2',[kind,id])).rows[0];return x?row<T>(x):undefined;});}
 async insert<T=Record<string,unknown>>(s:Scope,kind:Kind,data:T,id:string=randomUUID()):Promise<RecordRow<T>>{return this.db.scoped(s,async t=>row<T>((await t.query<Raw>('INSERT INTO custom_socialengine.records(id,entity_id,data,kind,project_id,owner_id,tenant_id) VALUES($1,$2,$3,$4,$5,$6,$2) RETURNING *',[id,s.tenantId,data,kind,s.projectId,s.ownerId])).rows[0]!));}
 async update<T=Record<string,unknown>>(s:Scope,kind:Kind,id:string,data:T,expectedRevision:number):Promise<RecordRow<T>>{return this.db.scoped(s,async t=>{const r=await t.query<Raw>('UPDATE custom_socialengine.records SET data=$1,revision=revision+1,updated_at=now() WHERE id=$2 AND kind=$3 AND revision=$4 RETURNING *',[data,id,kind,expectedRevision]);if(!r.rows[0])throw Object.assign(new Error('REVISION_CONFLICT'),{statusCode:409});return row<T>(r.rows[0]);});}
 async audit(s:Scope,action:string,resourceId:string,metadata:Record<string,unknown>={}):Promise<void>{await this.getScope(s.actorId,s.projectId,s.ownerId,s.tenantId);await this.db.system(async t=>{await t.query('INSERT INTO custom_socialengine.audit_logs(id,action,resource_id,metadata,project_id,owner_id,tenant_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),action,resourceId,{...metadata,actorId:s.actorId},s.projectId,s.ownerId,s.tenantId]);});}
 async listMembers(s:Scope){return this.db.scoped(s,async t=>(await t.query<{user_id:string;roles:Role[]}>('SELECT user_id,roles FROM custom_socialengine.memberships ORDER BY user_id')).rows.map(x=>({userId:x.user_id,roles:x.roles})));}
 async setMember(s:Scope,userId:string,roles:Role[]){
  await this.db.system(async t=>{
   await t.query('SELECT id FROM custom_socialengine.entities WHERE id=$1 AND project_id=$2 AND owner_id=$3 FOR UPDATE',[s.tenantId,s.projectId,s.ownerId]);
   const members=(await t.query<{user_id:string;roles:Role[]}>('SELECT user_id,roles FROM custom_socialengine.memberships WHERE project_id=$1 AND owner_id=$2 AND tenant_id=$3',[s.projectId,s.ownerId,s.tenantId])).rows;
   if(!members.some(m=>m.user_id===s.actorId&&m.roles.includes('admin')))throw Object.assign(new Error('FORBIDDEN'),{statusCode:403});
   if(!roles.includes('admin')&&members.some(m=>m.user_id===userId&&m.roles.includes('admin'))&&members.filter(m=>m.roles.includes('admin')).length===1)throw Object.assign(new Error('LAST_ADMIN_REQUIRED'),{statusCode:409});
   if(!roles.length)await t.query('DELETE FROM custom_socialengine.memberships WHERE project_id=$1 AND owner_id=$2 AND tenant_id=$3 AND user_id=$4',[s.projectId,s.ownerId,s.tenantId,userId]);
   else await t.query('INSERT INTO custom_socialengine.memberships(project_id,owner_id,tenant_id,user_id,roles) VALUES($1,$2,$3,$4,$5) ON CONFLICT(project_id,owner_id,tenant_id,user_id) DO UPDATE SET roles=EXCLUDED.roles',[s.projectId,s.ownerId,s.tenantId,userId,roles]);
   await t.query('INSERT INTO custom_socialengine.audit_logs(id,action,resource_id,metadata,project_id,owner_id,tenant_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),'membership.changed',userId,{actorId:s.actorId,roles},s.projectId,s.ownerId,s.tenantId]);
  });
 }

 async appendVersion<T>(s:Scope,post:RecordRow<T>){const versions=await this.list<{postId:string;revision:number;data:T}>(s,'post_version');const version=versions.find(v=>v.data.postId===post.id&&v.data.revision===post.revision);if(!version)throw new Error('VERSION_SNAPSHOT_MISSING');return version;}
 async listAudit(s:Scope){return this.db.scoped(s,async t=>(await t.query('SELECT id,action,resource_id,metadata,created_at FROM custom_socialengine.audit_logs ORDER BY created_at DESC LIMIT 100')).rows);}
}

