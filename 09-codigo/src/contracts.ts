export type Role='admin'|'editor'|'reviewer'|'publisher'|'viewer';
export type Platform='instagram'|'facebook'|'linkedin'|'tiktok'|'youtube';
export type Kind='source'|'post'|'post_version'|'social_account'|'publication'|'metric_snapshot'|'trend_source'|'trend_item'|'trend_extraction'|'trend_observation'|'trend_topic'|'trend_decision'|'ai_usage'|'oauth_state'|'campaign';
export interface Actor {id:string; mode:'supabase'|'sandbox'|'authority'}
export interface Scope {projectId:string;ownerId:string;tenantId:string;actorId:string;roles:Role[]}
export interface Blog {url:string;status:'undefined'|'provisioning'|'active'|'inactive';platform:string;feedUrl:string;language:string;integrationState:'not_configured'|'connected'|'error'}
export interface Workspace {id:string;name:string;niche:string;audience:string;objectives:string;timezone:string;brand:{color:string;voice:string;logoFileId?:string};blog:Blog;roles:Role[];createdAt:string}
export interface Slide {id:string;title:string;body:string;imageFileId?:string}
export interface PostData {title:string;format:'carousel'|'video'|'text';slides:Slide[];caption:string;cta:string;sourceIds:string[];structure:string;referenceUrl?:string;referenceFileId?:string;color:string;platforms:Platform[];plannedAt?:string;status:'draft'|'in_review'|'changes_requested'|'approved';reviewComment?:string;approvedBy?:string;approvedAt?:string;approvedRevision?:number;video?:{sceneDurations:number[];audioFileId?:string;fileId?:string}}
export interface RecordRow<T=Record<string,unknown>> {id:string;tenantId:string;kind:Kind;data:T;revision:number;createdAt:string;updatedAt:string}
export interface SourceData {title:string;kind:'text'|'news'|'youtube'|'instagram'|'pdf'|'video';url?:string;text:string;fileId?:string;extractionState:'metadata_only'|'extracted'|'failed'|'pending';error?:string}
export interface Job {id:string;projectId:string;ownerId:string;tenantId:string;type:string;payload:Record<string,unknown>;state:'queued'|'processing'|'succeeded'|'failed'|'uncertain'|'cancelled';attempts:number;runAt:string;leaseToken?:string;leaseUntil?:string;idempotencyKey:string;lastError?:string}
export interface QueryResult<T>{rows:T[];rowCount:number}
export interface Tx {query<T=Record<string,unknown>>(sql:string,params?:unknown[]):Promise<QueryResult<T>>}
export interface Database {
  scoped<T>(scope:Scope,fn:(tx:Tx)=>Promise<T>):Promise<T>;
  system<T>(fn:(tx:Tx)=>Promise<T>):Promise<T>;
  health():Promise<void>;
  close():Promise<void>;
}
export interface RuntimeConfig {
  sandbox:boolean;production:boolean;host:string;port:number;projectId:string;ownerId?:string;
  databaseUrl?:string;supabaseUrl?:string;supabaseAnonKey?:string;supabaseServiceKey?:string;
  authorityVerifierUrl?:string;authorityOperatorToken?:string;encryptionKey?:string;dataDir:string;publicUrl:string;
  maxUploadBytes:number;allowRegistrations:boolean;bootstrapUserIds:string[];
}
export const TABLE='custom_socialengine';
export const platformNames:Record<Platform,string>={instagram:'Instagram',facebook:'Facebook',linkedin:'LinkedIn',tiktok:'TikTok',youtube:'YouTube'};
export const roles:Role[]=['admin','editor','reviewer','publisher','viewer'];
export const statusNames:Record<PostData['status'],string>={draft:'Rascunho',in_review:'Em revisão',changes_requested:'Ajustes solicitados',approved:'Aprovado'};
