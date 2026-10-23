import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import http from 'node:http';
import https from 'node:https';

export const USER_AGENT='SocialEngineBot/1.0';
const originAccess=new Map<string,number>();
const originQueue=new Map<string,Promise<void>>();
async function limitOrigin(origin:string,robotsText:string){
 // Crawl-delay is not standardized by RFC 9309; honor the most conservative
 // value advertised by this origin instead of silently ignoring it.
 const delays=[...robotsText.matchAll(/^\s*crawl-delay\s*:\s*([\d.]+)/gim)].map(m=>Number(m[1])).filter(Number.isFinite);
 const delay=Math.max(1,...delays);if(delay>30)throw new Error('Origem exige Crawl-delay superior ao limite do coletor; configure uma API/feed alternativo.');
 const previous=originQueue.get(origin)??Promise.resolve();const next=previous.catch(()=>{}).then(async()=>{const wait=Math.max(0,(originAccess.get(origin)??0)+delay*1000-Date.now());if(wait)await new Promise(resolve=>setTimeout(resolve,wait));originAccess.set(origin,Date.now());});originQueue.set(origin,next);
 try{await next;}finally{if(originQueue.get(origin)===next)originQueue.delete(origin);}
 if(originAccess.size>1000)for(const [key,at]of originAccess)if(at<Date.now()-60_000)originAccess.delete(key);
}
export function publicAddress(address:string):boolean {
  if(isIP(address)===4){
    const [a,b,c]=address.split('.').map(Number);
    return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19)||a===192&&b===0||a===192&&b===2||a===198&&b===51&&c===100||a===203&&b===0&&c===113);
  }
  // Only global unicast IPv6; reject mapped IPv4, local, multicast and transition ranges.
  if(isIP(address)===6){const s=address.toLowerCase();return /^[23][0-9a-f]{3}:/.test(s)&&!s.startsWith('2001:')&&!s.startsWith('2002:')&&!s.startsWith('3fff:');}
  return false;
}
export function publicUrl(input:string):URL {
  const url=new URL(input);
  const host=url.hostname.replace(/^\[|\]$/g,'').toLowerCase();
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port&&!['80','443'].includes(url.port)||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||isIP(host)&&!publicAddress(host))throw new Error('URL pública HTTP/HTTPS obrigatória; rede interna bloqueada.');
  url.hash='';return url;
}
export interface PublicResponse {url:string;status:number;headers:http.IncomingHttpHeaders;bytes:Buffer}
export async function fetchPublic(input:string,options:{maxBytes?:number;timeoutMs?:number;redirects?:number;authorizeTarget?:(url:URL)=>Promise<void>}={}):Promise<PublicResponse>{
  let url=publicUrl(input);const maxBytes=options.maxBytes??2_000_000;
  for(let hop=0;hop<=(options.redirects??4);hop++){
    if(options.authorizeTarget)await options.authorizeTarget(url);
    const hostname=url.hostname.replace(/^\[|\]$/g,'');
    const addresses=isIP(hostname)?[{address:hostname,family:isIP(hostname)}]:await lookup(hostname,{all:true,verbatim:true});
    if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new Error('Destino DNS não público bloqueado.');
    const chosen=addresses[0];
    const result=await new Promise<PublicResponse>((resolve,reject)=>{
      // Pin the validated DNS address in the actual socket: prevents DNS rebinding.
      const requestOptions:https.RequestOptions&{autoSelectFamily:boolean}={method:'GET',agent:false,family:chosen.family,autoSelectFamily:false,headers:{'user-agent':USER_AGENT,accept:'text/html, application/rss+xml, application/atom+xml, application/xml, text/plain;q=0.9','accept-encoding':'identity'},lookup:((_h:unknown,_o:unknown,cb:(e:null,a:string,f:number)=>void)=>cb(null,chosen.address,chosen.family)) as never};
      const req=(url.protocol==='https:'?https:http).request(url,requestOptions,res=>{
        const chunks:Buffer[]=[];let size=0;
        if(Number(res.headers['content-length']??0)>maxBytes){res.destroy();reject(new Error('Fonte excede limite de tamanho.'));return;}
        res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>maxBytes){res.destroy();reject(new Error('Fonte excede limite de tamanho.'));}else chunks.push(chunk);});
        res.on('error',reject);res.on('end',()=>resolve({url:url.href,status:res.statusCode??0,headers:res.headers,bytes:Buffer.concat(chunks)}));
      });
      const deadline=setTimeout(()=>req.destroy(new Error('Tempo total de coleta excedido.')),options.timeoutMs??12_000);
      req.on('close',()=>clearTimeout(deadline));req.setTimeout(options.timeoutMs??12_000,()=>req.destroy(new Error('Tempo de coleta excedido.')));req.on('error',reject);req.end();
    });
    if([301,302,303,307,308].includes(result.status)&&result.headers.location){url=publicUrl(new URL(result.headers.location,url).href);continue;}
    return result;
  }
  throw new Error('Limite de redirecionamentos excedido.');
}

export function robotsAllowed(text:string,path:string):boolean {
  type Group={agents:string[];rules:{allow:boolean;path:string}[]};const groups:Group[]=[];let group:Group={agents:[],rules:[]};
  for(const raw of text.split(/\r?\n/)){
    const line=raw.split('#')[0].trim();const at=line.indexOf(':');if(at<0)continue;
    const key=line.slice(0,at).trim().toLowerCase(),value=line.slice(at+1).trim();
    if(key==='user-agent'){if(group.rules.length){groups.push(group);group={agents:[],rules:[]};}group.agents.push(value.toLowerCase());}
    else if((key==='allow'||key==='disallow')&&value)group.rules.push({allow:key==='allow',path:value});
  }
  groups.push(group);const specific=groups.filter(g=>g.agents.some(a=>a!=='*'&&USER_AGENT.toLowerCase().startsWith(a)));
  const active=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
  const matches=active.flatMap(g=>g.rules).filter(r=>{const regex=r.path.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\\\$$/,'$');return new RegExp('^'+regex).test(path);}).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));
  return matches[0]?.allow??true;
}
export async function fetchSource(input:string):Promise<PublicResponse>{
  const robotsCache=new Map<string,PublicResponse>();
  const result=await fetchPublic(input,{authorizeTarget:async url=>{
   let robots=robotsCache.get(url.origin);if(!robots){robots=await fetchPublic(new URL('/robots.txt',url).href,{maxBytes:250_000});robotsCache.set(url.origin,robots);}
   if(robots.status!==404&&(robots.status!==200||!robotsAllowed(robots.bytes.toString('utf8'),url.pathname+url.search)))throw new Error('Coleta bloqueada pelas regras de acesso da origem.');
   await limitOrigin(url.origin,robots.status===200?robots.bytes.toString('utf8'):'');
  }});
  if(result.status!==200)throw new Error(`Fonte indisponível (HTTP ${result.status}).`);
  const type=String(result.headers['content-type']??'');if(!/text\/|xml|json/.test(type))throw new Error('Formato da fonte não suportado.');
  return result;
}
