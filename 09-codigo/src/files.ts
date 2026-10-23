import {mkdir,writeFile,readFile,realpath,unlink} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {Database,RuntimeConfig,Scope} from './contracts.ts';
import {fail,uuid} from './security.ts';
export interface FileRow {id:string;name:string;mimeType:string;sizeBytes:number}
export function sniffType(bytes:Buffer,name:string):string {
  if(bytes.subarray(0,5).toString()==='%PDF-')return 'application/pdf';
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return 'image/webp';
  if(bytes.subarray(4,8).toString()==='ftyp')return 'video/mp4';
  if(/\.txt$/i.test(name)&&!bytes.includes(0))return 'text/plain';
  return fail(400,'UNSUPPORTED_FILE','Use PDF, TXT, PNG, JPEG, WebP ou MP4 válidos.');
}
export class PrivateFiles {
  constructor(private db:Database,private config:RuntimeConfig){}
  async put(scope:Scope,bytes:Buffer,name:string,mimeType:string):Promise<FileRow>{
    if(!bytes.length||bytes.length>this.config.maxUploadBytes)fail(400,'FILE_SIZE','O arquivo deve ter entre 1 byte e 25 MB.');
    const verified=sniffType(bytes,name);if(mimeType&&mimeType!=='application/octet-stream'&&mimeType!==verified)fail(400,'FILE_TYPE','O conteúdo do arquivo não corresponde ao formato informado.');
    const id=randomUUID();const safeName=name.replace(/[\r\n/\\\x00-\x1f]/g,'_').slice(0,200);
    const dir=resolve(this.config.dataDir,'files',uuid(scope.projectId),uuid(scope.tenantId));await mkdir(dir,{recursive:true});const path=resolve(dir,id);
    await writeFile(path,bytes,{flag:'wx',mode:0o600});
    try{await this.db.scoped(scope,async tx=>{await tx.query('insert into custom_socialengine.files(id,project_id,owner_id,tenant_id,name,path,mime_type,size_bytes,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,scope.projectId,scope.ownerId,scope.tenantId,safeName,path,verified,bytes.length,JSON.stringify({uploadedBy:scope.actorId})]);});}catch(error){await unlink(path).catch(()=>{});throw error;}
    return {id,name:safeName,mimeType:verified,sizeBytes:bytes.length};
  }
  async read(scope:Scope,id:string):Promise<{file:FileRow;bytes:Buffer}>{
    uuid(id);const row=await this.db.scoped(scope,async tx=>(await tx.query<{id:string;name:string;path:string;mime_type:string;size_bytes:string}>('select id,name,path,mime_type,size_bytes from custom_socialengine.files where id=$1',[id])).rows[0]);
    if(!row)fail(404,'FILE_NOT_FOUND','Arquivo não encontrado neste espaço.');
    const root=await realpath(resolve(this.config.dataDir,'files',uuid(scope.projectId),uuid(scope.tenantId))).catch(()=>fail(404,'FILE_NOT_FOUND','Arquivo indisponível.'));
    const path=await realpath(row!.path).catch(()=>fail(404,'FILE_NOT_FOUND','Arquivo indisponível.'));
    if(!path.startsWith(root+sep))fail(403,'FILE_ACCESS_DENIED','Acesso ao arquivo negado.');
    const bytes=await readFile(path);return {file:{id:row!.id,name:row!.name,mimeType:row!.mime_type,sizeBytes:Number(row!.size_bytes)},bytes};
  }
}
