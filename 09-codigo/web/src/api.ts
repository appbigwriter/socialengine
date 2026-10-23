import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import type {Workspace,RecordRow,PostData,SourceData,Job,Role} from '../../src/contracts';
export interface Runtime {sandbox:boolean;authConfigured:boolean;supabaseUrl?:string;supabaseAnonKey?:string;sandboxToken?:string;blockers:string[];capabilities:Record<string,unknown>}
export type GenericRow=RecordRow<Record<string,unknown>>;
export interface Dataset {workspace:Workspace;posts:RecordRow<PostData>[];sources:RecordRow<SourceData>[];versions:GenericRow[];accounts:GenericRow[];publications:GenericRow[];metrics:GenericRow[];trends:GenericRow[];trendSources:GenericRow[];trendItems:GenericRow[];usage:GenericRow[];campaigns:GenericRow[];jobs:Job[];members:{userId:string;roles:Role[]}[];audit:{id:string;action:string;resourceId:string;metadata:Record<string,unknown>;createdAt:string}[];credentials:{id:string;provider:string;kind:string;maskedHint:string;state:string}[];capabilities:Record<string,unknown>}
export class ApiError extends Error{constructor(public code:string,message:string,public status:number){super(message);}}
export async function request<T>(path:string,token:string,options:RequestInit={}):Promise<T>{
  const headers=new Headers(options.headers);if(token)headers.set('Authorization',`Bearer ${token}`);if(options.body&&!(options.body instanceof FormData))headers.set('Content-Type','application/json');
  const response=await fetch(path,{...options,headers,cache:'no-store'});
  if(!response.ok){const body=await response.json().catch(()=>null);throw new ApiError(body?.error?.code??'HTTP_ERROR',body?.error?.message??`Falha na solicitação (${response.status}).`,response.status);}
  return response.status===204?undefined as T:response.json();
}
export async function downloadFile(path:string,token:string,name:string){const r=await fetch(path,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});if(!r.ok){const b=await r.json().catch(()=>null);throw new Error(b?.error?.message??'Não foi possível exportar o arquivo.');}const blob=await r.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export function authClient(runtime:Runtime):SupabaseClient|null{return runtime.supabaseUrl&&runtime.supabaseAnonKey?createClient(runtime.supabaseUrl,runtime.supabaseAnonKey):null;}
export function text(value:unknown,fallback='—'){return typeof value==='string'||typeof value==='number'?String(value):fallback;}
export function num(value:unknown):number|null{return typeof value==='number'&&Number.isFinite(value)?value:null;}
export function arr(value:unknown):unknown[]{return Array.isArray(value)?value:[];}
export function obj(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
