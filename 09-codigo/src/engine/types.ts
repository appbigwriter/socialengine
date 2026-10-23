import type {FastifyRequest} from 'fastify';
import type {RuntimeConfig,Database,Role,Scope} from '../contracts.ts';
import type {Repository} from '../repository.ts';
export interface EngineDeps {
 config:RuntimeConfig;db:Database;repo:Repository;
 scopeFor:(request:FastifyRequest,roles?:Role[])=>Promise<Scope>;
 authorizeJob:(scope:Scope)=>Promise<Scope>;
 files:{put(scope:Scope,bytes:Buffer,name:string,mimeType:string):Promise<{id:string;name:string;mimeType:string;sizeBytes:number}>;read(scope:Scope,id:string):Promise<{file:{id:string;name:string;mimeType:string;sizeBytes:number};bytes:Buffer}>};
 vault:{reveal(scope:Scope,provider:string):Promise<string|null>};
}
