import type {Platform,PostData,RecordRow,Scope,Job} from '../contracts.ts';
import type {EngineDeps} from '../engine/types.ts';
import {renderSlide} from '../engine/media.ts';
import {appConfig,jsonResponse,socialError,transport,type Transport,type TokenSet} from './protocol.ts';
import {OAuthTokens,type SocialAccount} from './oauth.ts';
import {deliveryUrl} from './delivery.ts';
export const socialCapabilities:Record<Platform,{formats:string[];available:boolean;reason:string;docs:string}>=Object.fromEntries((['instagram','facebook','linkedin','tiktok','youtube'] as Platform[]).map(platform=>{
 return [platform,{get available(){try{appConfig(platform);return true;}catch{return false;}},get reason(){try{appConfig(platform);return 'Integração implementada; requer conta autorizada e homologação real.';}catch(e){return (e as Error).message;}},formats:platform==='youtube'||platform==='tiktok'?['video']:platform==='linkedin'?['text','carousel']:platform==='instagram'?['carousel','video']:['text','carousel'],docs:platform==='youtube'?'https://developers.google.com/youtube/data/reference/rest/v3/videos/insert':platform==='tiktok'?'https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post':platform==='linkedin'?'https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api':'https://developers.facebook.com/docs/'}];
})) as Record<Platform,{formats:string[];available:boolean;reason:string;docs:string}>;
export function assertCanPublish(platform:Platform,format:string){appConfig(platform);if(!socialCapabilities[platform]?.formats.includes(format))throw socialError('SOCIAL_FORMAT_UNSUPPORTED','Prepare e aprove um formato suportado para este destino.',422);}
export interface PublishInput {platform:Platform;externalId:string;tokens:TokenSet;post:PostData;imageUrls:string[];images:Buffer[];videoBytes?:Buffer;videoUrl?:string;options?:Record<string,unknown>}
export interface RemoteResult {remoteId?:string;containerId?:string;state:'published'|'processing';url?:string;privacy?:string}
const bearer=(token:string)=>({Authorization:`Bearer ${token}`});
async function send(fetcher:Transport,url:string,body:URLSearchParams|Record<string,unknown>|Buffer,token:string,headers:Record<string,string>={}):Promise<{response:Response;data:Record<string,any>}>{
 let response:Response;try{response=await fetcher(url,{method:'POST',headers:{...bearer(token),'content-type':body instanceof URLSearchParams?'application/x-www-form-urlencoded':Buffer.isBuffer(body)?'application/octet-stream':'application/json',...headers},body:(body instanceof URLSearchParams?body:Buffer.isBuffer(body)?new Uint8Array(body):JSON.stringify(body)) as BodyInit});}catch{throw socialError('SOCIAL_RESULT_UNCERTAIN','A rede não confirmou o resultado. Reconcilie antes de reenviar.',502,true);}
 const data=response.status===201&&response.headers.has('x-restli-id')?{}:await jsonResponse(response,true);return {response,data};
}
export async function publishRemote(input:PublishInput,fetcher:Transport=transport):Promise<RemoteResult>{
 const app=appConfig(input.platform),token=input.tokens.accessToken,text=[input.post.caption,input.post.cta].filter(Boolean).join('\n\n');
 if(input.platform==='facebook'){
  const base=`https://graph.facebook.com/${app.version}/${encodeURIComponent(input.externalId)}`;const body=new URLSearchParams({message:text});
  if(input.post.format==='carousel'){
   if(input.imageUrls.length<1)throw socialError('SOCIAL_MEDIA_MISSING','A publicação exige imagens.',422);
   for(let i=0;i<input.imageUrls.length;i++){const {data}=await send(fetcher,`${base}/photos`,new URLSearchParams({url:input.imageUrls[i],published:'false'}),token);if(!data.id)throw socialError('SOCIAL_RESULT_UNCERTAIN','Upload de foto sem identificador.',502,true);body.set(`attached_media[${i}]`,JSON.stringify({media_fbid:data.id}));}
  }
  const {data}=await send(fetcher,`${base}/feed`,body,token);if(!data.id)throw socialError('SOCIAL_RESULT_UNCERTAIN','Publicação sem identificador.',502,true);return {remoteId:data.id,state:'published',url:`https://www.facebook.com/${data.id}`};
 }
 if(input.platform==='instagram'){
  const base=`https://graph.instagram.com/${app.version}/${encodeURIComponent(input.externalId)}`;let containerId:string;
  if(input.post.format==='video'){
   if(!input.videoUrl)throw socialError('SOCIAL_MEDIA_MISSING','Reel exige vídeo aprovado e URL de entrega.',422);const {data}=await send(fetcher,`${base}/media`,new URLSearchParams({media_type:'REELS',video_url:input.videoUrl,caption:text}),token);containerId=data.id;
  }else{
   if(input.imageUrls.length<2||input.imageUrls.length>10)throw socialError('SOCIAL_MEDIA_INVALID','Carrossel Instagram exige 2 a 10 imagens.',422);
   const children:string[]=[];for(const image of input.imageUrls){const {data}=await send(fetcher,`${base}/media`,new URLSearchParams({image_url:image,is_carousel_item:'true'}),token);if(!data.id)throw socialError('SOCIAL_RESULT_UNCERTAIN','Container sem identificador.',502,true);children.push(data.id);}
   const {data}=await send(fetcher,`${base}/media`,new URLSearchParams({media_type:'CAROUSEL',children:children.join(','),caption:text}),token);containerId=data.id;
  }
  if(!containerId)throw socialError('SOCIAL_RESULT_UNCERTAIN','Container sem identificador.',502,true);
  for(let attempt=0;attempt<6;attempt++){
   const status=await jsonResponse(await fetcher(`https://graph.instagram.com/${app.version}/${containerId}?fields=status_code`,{headers:bearer(token)}));
   if(status.status_code==='ERROR'||status.status_code==='EXPIRED')throw socialError('SOCIAL_MEDIA_REJECTED','A rede recusou o processamento da mídia.',422);
   if(status.status_code==='FINISHED'){
    const {data}=await send(fetcher,`${base}/media_publish`,new URLSearchParams({creation_id:containerId}),token);if(!data.id)throw socialError('SOCIAL_RESULT_UNCERTAIN','Publicação sem confirmação.',502,true);
    const media=await jsonResponse(await fetcher(`https://graph.instagram.com/${app.version}/${data.id}?fields=id,permalink`,{headers:bearer(token)}));return {remoteId:data.id,containerId,state:'published',url:media.permalink};
   }
   // Persist the container and reconcile processing instead of holding a worker indefinitely.
   if(attempt===0)return {containerId,state:'processing'};
  }
  return {containerId,state:'processing'};
 }
 if(input.platform==='linkedin'){
  const headers={'LinkedIn-Version':app.version!,'X-Restli-Protocol-Version':'2.0.0'};const author=`urn:li:person:${input.externalId}`;let content:Record<string,unknown>|undefined;
  if(input.post.format==='carousel'){
   if(input.images.length<2||input.images.length>20)throw socialError('SOCIAL_MEDIA_INVALID','LinkedIn multiimagem exige 2 a 20 imagens.',422);const images=[];
   for(const bytes of input.images){const {data}=await send(fetcher,'https://api.linkedin.com/rest/images?action=initializeUpload',{initializeUploadRequest:{owner:author}},token,headers);const uploadUrl=data.value?.uploadUrl,image=data.value?.image;
    if(!uploadUrl||!image||!validLinkedInUpload(uploadUrl))throw socialError('SOCIAL_UPLOAD_INVALID','Upload LinkedIn não confirmado.',502,true);
    let result:Response;try{result=await fetcher(uploadUrl,{method:'PUT',headers:bearer(token),body:new Uint8Array(bytes)});}catch{throw socialError('SOCIAL_RESULT_UNCERTAIN','Upload sem confirmação.',502,true);}if(!result.ok)throw socialError('SOCIAL_UPLOAD_REJECTED','Upload recusado pelo LinkedIn.',502,true);images.push({id:image});
   }
   content={multiImage:{images}};
  }
  const body={author,commentary:text,visibility:'PUBLIC',distribution:{feedDistribution:'MAIN_FEED',targetEntities:[],thirdPartyDistributionChannels:[]},lifecycleState:'PUBLISHED',isReshareDisabledByAuthor:false,...(content?{content}:{})};
  const {response}=await send(fetcher,'https://api.linkedin.com/rest/posts',body,token,headers);const id=response.headers.get('x-restli-id');if(!id)throw socialError('SOCIAL_RESULT_UNCERTAIN','LinkedIn não retornou o identificador da publicação.',502,true);return {remoteId:id,state:'published',url:`https://www.linkedin.com/feed/update/${encodeURIComponent(id)}/`};
 }
 if(input.platform==='tiktok'){
  const options=input.options??{};if(options.explicitConsent!==true||typeof options.privacyLevel!=='string')throw socialError('TIKTOK_CONSENT_REQUIRED','TikTok exige consentimento explícito e privacidade escolhida após consultar os dados atuais do criador.',422);
  if(!input.videoUrl)throw socialError('SOCIAL_MEDIA_MISSING','Vídeo aprovado e domínio de entrega verificado são necessários.',422);
  const info=await jsonResponse(await fetcher('https://open.tiktokapis.com/v2/post/publish/creator_info/query/',{method:'POST',headers:{...bearer(token),'content-type':'application/json'},body:'{}'}));
  if(!info.data?.privacy_level_options?.includes(options.privacyLevel))throw socialError('TIKTOK_PRIVACY_INVALID','Privacidade não disponível para este criador.',422);
  if(options.privacyLevel!=='SELF_ONLY'&&process.env.TIKTOK_PUBLIC_POSTING_APPROVED!=='true')throw socialError('TIKTOK_AUDIT_REQUIRED','Publicação pública aguarda auditoria do aplicativo.',503);
  const {data}=await send(fetcher,'https://open.tiktokapis.com/v2/post/publish/video/init/',{post_info:{title:text,privacy_level:options.privacyLevel,disable_comment:options.disableComment===true,disable_duet:options.disableDuet===true,disable_stitch:options.disableStitch===true},source_info:{source:'PULL_FROM_URL',video_url:input.videoUrl}},token);
  if(!data.data?.publish_id)throw socialError('SOCIAL_RESULT_UNCERTAIN','TikTok não retornou identificador de processamento.',502,true);return {containerId:data.data.publish_id,state:'processing',privacy:String(options.privacyLevel)};
 }
 if(!input.videoBytes)throw socialError('SOCIAL_MEDIA_MISSING','YouTube exige vídeo renderizado e aprovado.',422);
 const privacy=input.options?.privacyStatus;if(!['public','private','unlisted'].includes(String(privacy)))throw socialError('YOUTUBE_PRIVACY_REQUIRED','Escolha explicitamente a visibilidade do vídeo.',422);
 const metadata={snippet:{title:input.post.title.slice(0,100),description:text.slice(0,5000)},status:{privacyStatus:privacy,selfDeclaredMadeForKids:input.options?.madeForKids===true}};
 let response:Response;try{response=await fetcher('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{method:'POST',headers:{...bearer(token),'content-type':'application/json','x-upload-content-length':String(input.videoBytes.length),'x-upload-content-type':'video/mp4'},body:JSON.stringify(metadata)});}catch{throw socialError('SOCIAL_RESULT_UNCERTAIN','Sessão de upload sem confirmação.',502,true);}
 if(!response.ok)await jsonResponse(response,true);const location=response.headers.get('location');if(!location)throw socialError('SOCIAL_RESULT_UNCERTAIN','Sessão YouTube sem endereço de upload.',502,true);const target=new URL(location);if(target.protocol!=='https:'||!(target.hostname==='www.googleapis.com'||target.hostname.endsWith('.googleapis.com')))throw socialError('SOCIAL_UPLOAD_INVALID','Destino de upload inválido.',502,true);
 let uploaded:Response;try{uploaded=await fetcher(location,{method:'PUT',headers:{...bearer(token),'content-type':'video/mp4','content-length':String(input.videoBytes.length)},body:new Uint8Array(input.videoBytes)});}catch{throw socialError('SOCIAL_RESULT_UNCERTAIN','Upload YouTube sem confirmação. Reconciliação necessária.',502,true);}
 const data=await jsonResponse(uploaded,true);if(!data.id)throw socialError('SOCIAL_RESULT_UNCERTAIN','YouTube não confirmou o identificador.',502,true);return {remoteId:data.id,state:'processing',privacy:String(privacy),url:`https://www.youtube.com/watch?v=${data.id}`};
}

function validLinkedInUpload(value:string){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='www.linkedin.com'&&u.pathname.startsWith('/dms-uploads/');}catch{return false;}}
export async function reconcileRemote(platform:Platform,account:SocialAccount,tokens:TokenSet,result:RemoteResult,fetcher:Transport=transport):Promise<RemoteResult>{
 const app=appConfig(platform),headers=bearer(tokens.accessToken);
 if(platform==='instagram'){
  if(result.remoteId){const data=await jsonResponse(await fetcher(`https://graph.instagram.com/${app.version}/${encodeURIComponent(result.remoteId)}?fields=id,permalink`,{headers}));return {...result,state:data.id?'published':'processing',url:data.permalink};}
  if(!result.containerId)return result;const data=await jsonResponse(await fetcher(`https://graph.instagram.com/${app.version}/${encodeURIComponent(result.containerId)}?fields=status_code`,{headers}));
  if(data.status_code==='ERROR'||data.status_code==='EXPIRED')throw socialError('SOCIAL_MEDIA_REJECTED','O processamento da mídia falhou.',422);
  if(data.status_code==='FINISHED'){
   const published=await send(fetcher,`https://graph.instagram.com/${app.version}/${encodeURIComponent(account.externalId)}/media_publish`,new URLSearchParams({creation_id:result.containerId}),tokens.accessToken);if(!published.data.id)throw socialError('SOCIAL_RESULT_UNCERTAIN','Publicação sem confirmação.',502,true);return reconcileRemote(platform,account,tokens,{...result,remoteId:published.data.id,state:'processing'},fetcher);
  }
  if(data.status_code==='PUBLISHED')throw socialError('SOCIAL_RESULT_UNCERTAIN','Container publicado sem ID de mídia confirmado. Requer verificação manual.',502,true);return result;
 }
 if(platform==='tiktok'){
  const data=await jsonResponse(await fetcher('https://open.tiktokapis.com/v2/post/publish/status/fetch/',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({publish_id:result.containerId})}));
  if(data.data?.status==='FAILED')throw socialError('SOCIAL_MEDIA_REJECTED','O TikTok recusou o processamento.',422);const ids=data.data?.publicaly_available_post_id??data.data?.publicly_available_post_id;
  return data.data?.status==='PUBLISH_COMPLETE'?{...result,remoteId:Array.isArray(ids)?String(ids[0]??'')||undefined:undefined,state:'published'}:result;
 }
 if(platform==='youtube'){
  const data=await jsonResponse(await fetcher(`https://www.googleapis.com/youtube/v3/videos?part=status,processingDetails&id=${encodeURIComponent(result.remoteId??'')}`,{headers}));const video=data.items?.[0];if(['failed','rejected','deleted'].includes(video?.status?.uploadStatus))throw socialError('SOCIAL_MEDIA_REJECTED','O YouTube recusou o vídeo.',422);
  return video?.status?.uploadStatus==='processed'&&video.status.privacyStatus===result.privacy?{...result,state:'published'}:result;
 }
 if(!result.remoteId)return result;
 const url=platform==='linkedin'?`https://api.linkedin.com/rest/posts/${encodeURIComponent(result.remoteId)}`:`https://graph.facebook.com/${app.version}/${encodeURIComponent(result.remoteId)}?fields=id,permalink_url`;
 const data=await jsonResponse(await fetcher(url,{headers:{...headers,...(platform==='linkedin'?{'LinkedIn-Version':app.version!,'X-Restli-Protocol-Version':'2.0.0'}:{})}}));return {...result,state:platform==='linkedin'?(data.lifecycleState==='PUBLISHED'?'published':'processing'):(data.id?'published':'processing'),url:data.permalink_url??result.url};
}
interface Publication extends RemoteResult {jobId:string;postId:string;revision:number;accountId:string;platform:Platform;authorizedBy:string;startedAt:string;lastCheckedAt?:string;error?:string;reconciliationState?:string}
export async function publishDestination(deps:EngineDeps,scope:Scope,job:Job,fetcher:Transport=transport):Promise<void>{
 const s=await deps.authorizeJob(scope);if(!s.roles.some(r=>r==='admin'||r==='publisher'))throw socialError('FORBIDDEN','Permissão de publicação revogada.',403);
 if(job.payload.explicitDestination!==true)throw socialError('DESTINATION_NOT_AUTHORIZED','Destino não autorizado.',403);
 const post=await deps.repo.get<PostData>(s,'post',String(job.payload.postId)),account=await deps.repo.get<SocialAccount>(s,'social_account',String(job.payload.accountId));
 if(!post||post.revision!==job.payload.revision||post.data.status!=='approved'||post.data.approvedRevision!==post.revision)throw socialError('APPROVAL_CHANGED','A versão aprovada foi alterada. Autorize novamente.',409);
 if(!account||account.data.state!=='connected')throw socialError('SOCIAL_RECONNECT_REQUIRED','Conta desconectada.',409);assertCanPublish(account.data.platform,post.data.format);
 const prior=(await deps.repo.list<Publication>(s,'publication')).find(p=>p.data.jobId===job.id);
 if(prior){if(prior.data.state==='published')return;if(prior.data.state==='processing'&&(prior.data.remoteId||prior.data.containerId)){await reconcilePublication(deps,s,prior.id,fetcher);return;}throw socialError('SOCIAL_RESULT_UNCERTAIN','Tentativa anterior exige reconciliação antes de reenvio.',409,true);}
 const vault=new OAuthTokens(deps,fetcher),tokens=await vault.load(s,account.data),images:Buffer[]=[],imageUrls:string[]=[];
 let videoBytes:Buffer|undefined,videoUrl:string|undefined;
 if(post.data.format==='carousel')for(let i=0;i<post.data.slides.length;i++){
  const slide=post.data.slides[i],image=slide.imageFileId?(await deps.files.read(s,slide.imageFileId)).bytes:undefined,bytes=await renderSlide(slide,post.data.color,i,image);images.push(bytes);
  if(account.data.platform!=='linkedin'){const file=await deps.files.put(s,bytes,`approved-${post.id}-${post.revision}-${i}.png`,'image/png');imageUrls.push(await deliveryUrl(deps,s,file.id));}
 }
 if(post.data.format==='video'){
  if(!post.data.video?.fileId)throw socialError('SOCIAL_MEDIA_MISSING','Renderize o vídeo antes de aprovar.',422);videoBytes=(await deps.files.read(s,post.data.video.fileId)).bytes;
  if(account.data.platform!=='youtube')videoUrl=await deliveryUrl(deps,s,post.data.video.fileId);
 }
 const publication=await deps.repo.insert<Publication>(s,'publication',{jobId:job.id,postId:post.id,revision:post.revision,accountId:account.id,platform:account.data.platform,state:'processing',authorizedBy:s.actorId,startedAt:new Date().toISOString()});
 try{
  const result=await publishRemote({platform:account.data.platform,externalId:account.data.externalId,tokens,post:post.data,images,imageUrls,videoBytes,videoUrl,options:job.payload.socialOptions as Record<string,unknown>|undefined},fetcher);
  await deps.repo.update(s,'publication',publication.id,{...publication.data,...result},publication.revision);await deps.repo.audit(s,'publication.result',publication.id,{state:result.state,remoteId:result.remoteId});
 }catch(error){const current=await deps.repo.get<Publication>(s,'publication',publication.id);if(current)await deps.repo.update(s,'publication',current.id,{...current.data,error:(error as Error).message},current.revision);throw error;}
}
export async function reconcilePublication(deps:EngineDeps,scope:Scope,id:string,fetcher:Transport=transport){
 const s=await deps.authorizeJob(scope);if(!s.roles.some(r=>r==='admin'||r==='publisher'))throw socialError('FORBIDDEN','Permissão de publicação necessária.',403);
 const publication=await deps.repo.get<Publication>(s,'publication',id);if(!publication)throw socialError('NOT_FOUND','Publicação não encontrada.',404);if(publication.data.state==='published')return publication;
 if(publication.data.reconciliationState==='sending'&&!publication.data.remoteId)throw socialError('SOCIAL_RESULT_UNCERTAIN','Reconciliação anterior sem confirmação; verificação manual necessária.',409,true);
 const approved=await deps.repo.get<PostData>(s,'post',publication.data.postId);if(!approved||approved.revision!==publication.data.revision||approved.data.status!=='approved'||approved.data.approvedRevision!==approved.revision)throw socialError('APPROVAL_CHANGED','A versão autorizada mudou; a reconciliação não pode iniciar nova publicação.',409);
 if(!publication.data.remoteId&&!publication.data.containerId)throw socialError('SOCIAL_RESULT_UNCERTAIN','Não há identificador remoto; verificação manual necessária.',409,true);
 const account=await deps.repo.get<SocialAccount>(s,'social_account',publication.data.accountId);if(!account||account.data.state!=='connected')throw socialError('SOCIAL_RECONNECT_REQUIRED','Conta desconectada.',409);
 const tokens=await new OAuthTokens(deps,fetcher).load(s,account.data);
 // Claim the reconciliation operation before a possible Instagram media_publish effect.
 const claimed=await deps.repo.update(s,'publication',publication.id,{...publication.data,lastCheckedAt:new Date().toISOString(),reconciliationState:publication.data.platform==='instagram'&&!publication.data.remoteId?'sending':'checking'},publication.revision);
 const result=await reconcileRemote(account.data.platform,account.data,tokens,claimed.data,fetcher);
 return deps.repo.update(s,'publication',claimed.id,{...claimed.data,...result,reconciliationState:result.remoteId?'confirmed':'ready'},claimed.revision);
}
export async function collectPublicationMetrics(deps:EngineDeps,scope:Scope,id:string,fetcher:Transport=transport){
 const s=await deps.authorizeJob(scope),publication=await deps.repo.get<Publication>(s,'publication',id);if(!publication||!publication.data.remoteId)throw socialError('NOT_FOUND','Publicação confirmada não encontrada.',404);
 const account=await deps.repo.get<SocialAccount>(s,'social_account',publication.data.accountId);if(!account||account.data.state!=='connected')throw socialError('SOCIAL_RECONNECT_REQUIRED','Conta desconectada.',409);
 const tokens=await new OAuthTokens(deps,fetcher).load(s,account.data),app=appConfig(account.data.platform),headers=bearer(tokens.accessToken),remoteId=encodeURIComponent(publication.data.remoteId),values:Record<string,number|null>={views:null,likes:null,comments:null,shares:null,saves:null,reach:null};let data:Record<string,any>={};
 if(account.data.platform==='instagram'){
  data=await jsonResponse(await fetcher(`https://graph.instagram.com/${app.version}/${remoteId}?fields=id,like_count,comments_count`,{headers}));values.likes=typeof data.like_count==='number'?data.like_count:null;values.comments=typeof data.comments_count==='number'?data.comments_count:null;
 }else if(account.data.platform==='facebook'){
  data=await jsonResponse(await fetcher(`https://graph.facebook.com/${app.version}/${remoteId}?fields=id,reactions.summary(true).limit(0),comments.summary(true).limit(0),shares`,{headers}));values.likes=data.reactions?.summary?.total_count??null;values.comments=data.comments?.summary?.total_count??null;values.shares=data.shares?.count??null;
 }else if(account.data.platform==='youtube'){
  data=await jsonResponse(await fetcher(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${remoteId}`,{headers}));const stats=data.items?.[0]?.statistics??{};for(const [key,field] of [['views','viewCount'],['likes','likeCount'],['comments','commentCount']])if(stats[field]!==undefined&&Number.isFinite(Number(stats[field])))values[key]=Number(stats[field]);
 }else if(account.data.platform==='tiktok'){
  data=await jsonResponse(await fetcher('https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({filters:{video_ids:[publication.data.remoteId]}})}));const stats=data.data?.videos?.[0]??{};for(const [key,field] of [['views','view_count'],['likes','like_count'],['comments','comment_count'],['shares','share_count']])values[key]=typeof stats[field]==='number'?stats[field]:null;
 }
 const bucket=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString(),prior=(await deps.repo.list<{publicationId:string;observedAt:string}>(s,'metric_snapshot')).find(r=>r.data.publicationId===id&&r.data.observedAt===bucket);if(prior)return prior;
 return deps.repo.insert(s,'metric_snapshot',{publicationId:id,postId:publication.data.postId,platform:account.data.platform,observedAt:bucket,collectedAt:new Date().toISOString(),source:'official_api',unit:'cumulative_count',values,availability:account.data.platform==='linkedin'?'unavailable_permissions':'partial'});
}
