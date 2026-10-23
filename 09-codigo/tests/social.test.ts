import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import {createDatabase} from '../src/db.ts';
import {readConfig} from '../src/config.ts';
import {Repository} from '../src/repository.ts';
import {migrate} from '../scripts/migrate.ts';
import {OAuthFlow,OAuthTokens} from '../src/social/oauth.ts';
import {appConfig,authorizationUrl,exchangeCode,type Transport} from '../src/social/protocol.ts';
import {publishRemote,type PublishInput} from '../src/social/publishing.ts';
import type {EngineDeps} from '../src/engine/types.ts';
import type {PostData} from '../src/contracts.ts';
const json=(data:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json',...headers}});
const env={YOUTUBE_CLIENT_ID:'test-google-id',YOUTUBE_CLIENT_SECRET:'test-google-secret',TIKTOK_CLIENT_KEY:'test-tiktok-key',TIKTOK_CLIENT_SECRET:'test-tiktok-secret',LINKEDIN_CLIENT_ID:'test-linkedin-id',LINKEDIN_CLIENT_SECRET:'test-linkedin-secret',LINKEDIN_VERSION:'202610',INSTAGRAM_CLIENT_ID:'test-ig-id',INSTAGRAM_CLIENT_SECRET:'test-ig-secret',META_GRAPH_VERSION:'v25.0'};
Object.assign(process.env,env);
const post:PostData={title:'Título aprovado',format:'text',slides:[],caption:'Legenda',cta:'Saiba mais',sourceIds:[],structure:'analysis',color:'#8057f5',platforms:['linkedin'],status:'approved',approvedRevision:2};
const input=(platform:PublishInput['platform']):PublishInput=>({platform,externalId:'verified-account',tokens:{accessToken:'private-oauth-token'},post,images:[],imageUrls:[]});
test('OAuth protocol uses exact form fields, server secret, PKCE and provider state',async()=>{
 const google=appConfig('youtube'),url=new URL(authorizationUrl(google,'https://social.test/callback','random-state','pkce-hash'));
 assert.equal(url.searchParams.get('state'),'random-state');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('access_type'),'offline');assert.equal(url.searchParams.get('client_secret'),null);
 const mock:Transport=async(url,init)=>{assert.equal(url,'https://oauth2.googleapis.com/token');const body=init?.body as URLSearchParams;assert.equal(body.get('code_verifier'),'private-verifier');assert.equal(body.get('client_secret'),'test-google-secret');assert.equal(body.get('redirect_uri'),'https://social.test/callback');return json({access_token:'private-access',refresh_token:'private-refresh',expires_in:3600});};
 const tokens=await exchangeCode(google,'auth-code','https://social.test/callback','private-verifier',mock);assert.equal(tokens.accessToken,'private-access');assert.equal(tokens.refreshToken,'private-refresh');
 const tiktok=appConfig('tiktok'),tiktokUrl=new URL(authorizationUrl(tiktok,'https://social.test/callback','state'));assert.equal(tiktokUrl.searchParams.get('client_key'),'test-tiktok-key');assert.equal(tiktokUrl.searchParams.get('client_id'),null);
});
test('durable OAuth state binds cookie/tenant/actor, consumes once and keeps tokens encrypted',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'social-oauth-')),config={...readConfig(true),dataDir:dir,encryptionKey:randomBytes(32).toString('hex'),publicUrl:'https://social.test'};const db=await createDatabase(config);
 try{
  await migrate(db);const repo=new Repository(db),alice=randomUUID(),bob=randomUUID();const a=await repo.createWorkspace(alice,config.projectId,config.ownerId!,{name:'Alice'}),b=await repo.createWorkspace(bob,config.projectId,config.ownerId!,{name:'Bob'}),sa=await repo.getScope(alice,config.projectId,config.ownerId!,a.id),sb=await repo.getScope(bob,config.projectId,config.ownerId!,b.id);let calls=0;
  const deps={config,db,repo,authorizeJob:(s:any)=>repo.getScope(s.actorId,s.projectId,s.ownerId,s.tenantId)} as EngineDeps;
  const fetcher:Transport=async(url,init)=>{calls++;if(url==='https://oauth2.googleapis.com/token')return json({access_token:'real-private-access',refresh_token:'real-private-refresh',expires_in:3600});if(url.includes('/youtube/v3/channels')){assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer real-private-access');return json({items:[{id:'verified-channel',snippet:{title:'Canal real'}}]});}throw new Error('Unexpected request');};
  const flow=new OAuthFlow(deps,fetcher),first=await flow.begin(sa,'youtube'),other=await flow.begin(sb,'youtube');assert.ok(first.cookieHeader.includes('HttpOnly'));assert.ok(first.cookieHeader.includes('SameSite=Lax'));
  const state=new URL(first.url).searchParams.get('state')!;await assert.rejects(flow.complete('youtube',state,other.cookieHeader,'code'));assert.equal(calls,0);
  const result=await flow.complete('youtube',state,first.cookieHeader,'code');assert.equal(result.scope.tenantId,a.id);assert.equal(result.accounts[0].data.externalId,'verified-channel');assert.equal(calls,2);await assert.rejects(flow.complete('youtube',state,first.cookieHeader,'code'));assert.equal(calls,2);
  assert.equal((await repo.list(sb,'social_account')).length,0);assert.ok(!JSON.stringify(await repo.list(sa,'social_account')).includes('real-private'));
  const stored=await db.system(async tx=>(await tx.query<{ciphertext:string}>('SELECT ciphertext FROM custom_socialengine.credentials')).rows[0]);assert.ok(!stored.ciphertext.includes('real-private'));
  const vault=new OAuthTokens(deps,fetcher);assert.equal((await vault.load(sa,result.accounts[0].data)).accessToken,'real-private-access');await assert.rejects(vault.load(sb,result.accounts[0].data));await vault.revoke(sa,result.accounts[0].data);await assert.rejects(vault.load(sa,result.accounts[0].data));
  const expired=await flow.begin(sb,'youtube'),expiredId=new URL(expired.url).searchParams.get('state')!.split('.')[0];await db.scoped(sb,tx=>tx.query("UPDATE custom_socialengine.records SET revision=revision+1,data=jsonb_set(data,'{expiresAt}',to_jsonb('2000-01-01T00:00:00.000Z'::text)) WHERE id=$1",[expiredId]));await assert.rejects(flow.complete('youtube',new URL(expired.url).searchParams.get('state')!,expired.cookieHeader,'code'));assert.equal(calls,2);
 }finally{await db.close();await rm(dir,{recursive:true,force:true});}
});
test('LinkedIn text publishes real Posts API payload and consumes header ID with empty 201 body',async()=>{
 const mock:Transport=async(url,init)=>{assert.equal(url,'https://api.linkedin.com/rest/posts');assert.equal(init?.method,'POST');const body=JSON.parse(String(init?.body));assert.equal(body.author,'urn:li:person:verified-account');assert.equal(body.lifecycleState,'PUBLISHED');assert.equal(body.commentary,'Legenda\n\nSaiba mais');assert.equal((init?.headers as Record<string,string>)['LinkedIn-Version'],'202610');return new Response(null,{status:201,headers:{'x-restli-id':'urn:li:share:123'}});};
 const result=await publishRemote(input('linkedin'),mock);assert.equal(result.remoteId,'urn:li:share:123');assert.equal(result.state,'published');
});
test('Instagram carousels upload unpublished children, build container and publish only when ready',async()=>{
 const endpoints:string[]=[];const mock:Transport=async(url,init)=>{endpoints.push(url);if(url.endsWith('/media')){const form=init?.body as URLSearchParams;if(form.get('media_type')==='CAROUSEL'){assert.equal(form.get('children'),'child-1,child-2');return json({id:'container'});}assert.equal(form.get('is_carousel_item'),'true');return json({id:`child-${endpoints.length}`});}if(url.includes('status_code'))return json({status_code:'FINISHED'});if(url.endsWith('/media_publish'))return json({id:'published-id'});return json({id:'published-id',permalink:'https://instagram.com/p/test/'});};
 const result=await publishRemote({...input('instagram'),post:{...post,format:'carousel'},imageUrls:['https://safe.test/a.png','https://safe.test/b.png']},mock);assert.equal(result.remoteId,'published-id');assert.equal(result.state,'published');assert.equal(endpoints.length,6);
});
test('YouTube upload requires explicit visibility and returns processing until external confirmation',async()=>{
 const args={...input('youtube'),post:{...post,format:'video' as const},videoBytes:Buffer.from('video')};let count=0;
 const mock:Transport=async(url,init)=>{count++;if(init?.method==='POST'){assert.equal(JSON.parse(String(init.body)).status.privacyStatus,'private');return new Response(null,{status:200,headers:{location:'https://www.googleapis.com/upload/session'}});}assert.equal(url,'https://www.googleapis.com/upload/session');assert.equal(init?.method,'PUT');return json({id:'video-id'},201);};
 await assert.rejects(publishRemote(args,mock));assert.equal(count,0);const result=await publishRemote({...args,options:{privacyStatus:'private',madeForKids:false}},mock);assert.equal(result.remoteId,'video-id');assert.equal(result.state,'processing');assert.equal(result.privacy,'private');
});
test('TikTok never silently picks privacy or consent and network ambiguity is explicit',async()=>{
 let requests=0;const mock:Transport=async()=>{requests++;throw new Error('network lost');};await assert.rejects(publishRemote({...input('tiktok'),post:{...post,format:'video'},videoUrl:'https://verified.test/video.mp4'},mock));assert.equal(requests,0);
 await assert.rejects(publishRemote(input('linkedin'),mock),(error:any)=>error.uncertain===true);assert.equal(requests,1);
});
