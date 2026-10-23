import type {Platform} from '../contracts.ts';
export type Transport=(url:string,init?:RequestInit)=>Promise<Response>;
export const transport:Transport=(url,init)=>fetch(url,{...init,redirect:'error',signal:init?.signal??AbortSignal.timeout(20000)});
export const socialError=(code:string,message:string,statusCode=503,uncertain=false)=>Object.assign(new Error(message),{code,statusCode,uncertain});
export interface SocialApp {platform:Platform;id:string;secret:string;authorizeUrl:string;tokenUrl:string;scopes:string[];pkce:boolean;version?:string}
export function appConfig(platform:Platform,env:NodeJS.ProcessEnv=process.env):SocialApp{
 const prefix=platform.toUpperCase();const id=env[`${prefix}_${platform==='tiktok'?'CLIENT_KEY':'CLIENT_ID'}`],secret=env[`${prefix}_CLIENT_SECRET`];
 if(!id||!secret)throw socialError('SOCIAL_APP_NOT_CONFIGURED',`Aplicativo OAuth ${platform} aguarda credenciais de servidor.`);
 const version=platform==='linkedin'?env.LINKEDIN_VERSION:env.META_GRAPH_VERSION;
 if((platform==='instagram'||platform==='facebook')&&(!version||!/^v\d+\.\d+$/.test(version)))throw socialError('SOCIAL_VERSION_REQUIRED','Configure META_GRAPH_VERSION conforme a versão aprovada do aplicativo.');
 if(platform==='linkedin'&&(!version||!/^\d{6}$/.test(version)))throw socialError('SOCIAL_VERSION_REQUIRED','Configure LINKEDIN_VERSION conforme a versão suportada.');
 const configs:Record<Platform,Omit<SocialApp,'id'|'secret'|'platform'>>={
  instagram:{authorizeUrl:'https://www.instagram.com/oauth/authorize',tokenUrl:'https://api.instagram.com/oauth/access_token',scopes:['instagram_business_basic','instagram_business_content_publish','instagram_business_manage_insights'],pkce:false,version},
  facebook:{authorizeUrl:`https://www.facebook.com/${version}/dialog/oauth`,tokenUrl:`https://graph.facebook.com/${version}/oauth/access_token`,scopes:['pages_show_list','pages_read_engagement','pages_manage_posts','read_insights'],pkce:false,version},
  linkedin:{authorizeUrl:'https://www.linkedin.com/oauth/v2/authorization',tokenUrl:'https://www.linkedin.com/oauth/v2/accessToken',scopes:['openid','profile','w_member_social'],pkce:false,version},
  tiktok:{authorizeUrl:'https://www.tiktok.com/v2/auth/authorize/',tokenUrl:'https://open.tiktokapis.com/v2/oauth/token/',scopes:['user.info.basic','video.publish','video.list'],pkce:false},
  youtube:{authorizeUrl:'https://accounts.google.com/o/oauth2/v2/auth',tokenUrl:'https://oauth2.googleapis.com/token',scopes:['https://www.googleapis.com/auth/youtube.upload','https://www.googleapis.com/auth/youtube.readonly'],pkce:true}
 };
 return {platform,id,secret,...configs[platform]};
}
export function authorizationUrl(app:SocialApp,redirectUri:string,state:string,challenge?:string):string{
 const url=new URL(app.authorizeUrl);url.searchParams.set(app.platform==='tiktok'?'client_key':'client_id',app.id);url.searchParams.set('redirect_uri',redirectUri);url.searchParams.set('response_type','code');url.searchParams.set('state',state);url.searchParams.set('scope',app.scopes.join(app.platform==='tiktok'||app.platform==='instagram'?',':' '));
 if(app.pkce&&challenge){url.searchParams.set('code_challenge',challenge);url.searchParams.set('code_challenge_method','S256');}
 if(app.platform==='youtube'){url.searchParams.set('access_type','offline');url.searchParams.set('prompt','consent');url.searchParams.set('include_granted_scopes','true');}
 return url.toString();
}
export async function jsonResponse(res:Response,uncertain=false):Promise<Record<string,any>>{
 let value:Record<string,any>;try{value=await res.json() as Record<string,any>;}catch{throw socialError('SOCIAL_INVALID_RESPONSE','Resposta inválida da rede social.',502,uncertain);}
 if(!res.ok||value.error&&(typeof value.error!=='object'||value.error.code&&value.error.code!=='ok'))throw socialError('SOCIAL_API_REJECTED',`A rede social recusou a operação (HTTP ${res.status}).`,res.status===429?429:502,uncertain&&res.status>=500);
 return value;
}
export interface TokenSet {accessToken:string;refreshToken?:string;expiresAt?:string;scope?:string;openId?:string}
export async function exchangeCode(app:SocialApp,code:string,redirectUri:string,verifier:string,fetcher:Transport=transport):Promise<TokenSet>{
 const body=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:redirectUri,client_secret:app.secret,[app.platform==='tiktok'?'client_key':'client_id']:app.id});if(app.pkce)body.set('code_verifier',verifier);
 let response:Response;try{response=await fetcher(app.tokenUrl,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});}catch{throw socialError('SOCIAL_EXCHANGE_FAILED','Não foi possível concluir a autorização. Reconecte a conta.');}
 let data=await jsonResponse(response);if(!data.access_token)throw socialError('SOCIAL_TOKEN_MISSING','A rede não confirmou o token de acesso.');
 if(app.platform==='instagram'){
  const url=new URL('https://graph.instagram.com/access_token');url.searchParams.set('grant_type','ig_exchange_token');url.searchParams.set('client_secret',app.secret);url.searchParams.set('access_token',data.access_token);
  data={...data,...await jsonResponse(await fetcher(url.toString()))};
 }
 return {accessToken:data.access_token,refreshToken:data.refresh_token,expiresAt:data.expires_in?new Date(Date.now()+Number(data.expires_in)*1000).toISOString():undefined,scope:data.scope,openId:data.open_id};
}
export async function refreshTokens(app:SocialApp,tokens:TokenSet,fetcher:Transport=transport):Promise<TokenSet>{
 if(!tokens.expiresAt||Date.parse(tokens.expiresAt)>Date.now()+120000)return tokens;
 if(app.platform==='instagram'){
  const url=new URL('https://graph.instagram.com/refresh_access_token');url.searchParams.set('grant_type','ig_refresh_token');url.searchParams.set('access_token',tokens.accessToken);const data=await jsonResponse(await fetcher(url.toString()));return {...tokens,accessToken:data.access_token,expiresAt:new Date(Date.now()+Number(data.expires_in)*1000).toISOString()};
 }
 if(!tokens.refreshToken||app.platform==='facebook'||app.platform==='linkedin')throw socialError('SOCIAL_RECONNECT_REQUIRED','A autorização expirou. Reconecte esta conta.');
 const body=new URLSearchParams({grant_type:'refresh_token',refresh_token:tokens.refreshToken,client_secret:app.secret,[app.platform==='tiktok'?'client_key':'client_id']:app.id});const data=await jsonResponse(await fetcher(app.tokenUrl,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body}));if(!data.access_token)throw socialError('SOCIAL_RECONNECT_REQUIRED','A rede não renovou a autorização.');return {...tokens,accessToken:data.access_token,refreshToken:data.refresh_token??tokens.refreshToken,expiresAt:new Date(Date.now()+Number(data.expires_in)*1000).toISOString()};
}
export interface AccountIdentity {externalId:string;name:string;tokens:TokenSet}
export async function identities(app:SocialApp,tokens:TokenSet,fetcher:Transport=transport):Promise<AccountIdentity[]>{
 const headers={Authorization:`Bearer ${tokens.accessToken}`};
 if(app.platform==='facebook'){const data=await jsonResponse(await fetcher(`https://graph.facebook.com/${app.version}/me/accounts?fields=id,name,access_token,tasks`,{headers}));return (data.data??[]).filter((a:any)=>a.id&&a.access_token&&(a.tasks??[]).some((t:string)=>['CREATE_CONTENT','MANAGE'].includes(t))).map((a:any)=>({externalId:String(a.id),name:String(a.name??a.id),tokens:{...tokens,accessToken:a.access_token}}));}
 const url=app.platform==='instagram'?`https://graph.instagram.com/${app.version}/me?fields=user_id,username`:app.platform==='linkedin'?'https://api.linkedin.com/v2/userinfo':app.platform==='tiktok'?'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name':'https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true';
 const data=await jsonResponse(await fetcher(url,{headers}));
 if(app.platform==='youtube')return (data.items??[]).filter((i:any)=>i.id).map((i:any)=>({externalId:String(i.id),name:String(i.snippet?.title??i.id),tokens}));
 const user=app.platform==='tiktok'?data.data?.user:data;const id=app.platform==='linkedin'?user?.sub:app.platform==='tiktok'?user?.open_id:user?.user_id??user?.id;
 if(!id)throw socialError('SOCIAL_IDENTITY_UNCONFIRMED','A rede não confirmou a identidade da conta.');return [{externalId:String(id),name:String(user.name??user.username??user.display_name??id),tokens}];
}
