import {createHash} from 'node:crypto';
import Parser from 'rss-parser';
import {load} from 'cheerio';
import {fetchSource,publicUrl} from './network.ts';

export interface TrendSource {name:string;url:string;type:'rss'|'html';keywords:string[];exclusions:string[];region:string;language:string;intervalMinutes:number;enabled:boolean;accessAcknowledged?:boolean;lastCollectedAt?:string;lastError?:string}
export interface ExtractedItem {title:string;titleOrigin?:'feed'|'content_excerpt';url:string;text:string;publishedAt?:string;author?:string;externalId?:string;discoveryKey?:string;fingerprint:string;method:string;language?:string;searchSignal?:{provider:'google_trends';rawApproximateTraffic:string;growthComparable:false}}
export function sameTrendItem(left:ExtractedItem,right:ExtractedItem):boolean {
  // Google uses one feed URL for multiple queries. A query-country identity must win.
  if(left.discoveryKey||right.discoveryKey)return Boolean(left.discoveryKey&&left.discoveryKey===right.discoveryKey);
  return left.url===right.url||left.fingerprint===right.fingerprint;
}
export const normal=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const fingerprint=(s:string)=>createHash('sha256').update(normal(s)).digest('hex');
export function canonicalUrl(input:string):string {const u=publicUrl(input);for(const key of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid)/i.test(key))u.searchParams.delete(key);u.searchParams.sort();return u.href;}
export function extractHtml(html:string,url:string):ExtractedItem {
  const $=load(html);$('script,style,nav,footer,header,aside,form,iframe,noscript').remove();
  const title=$('meta[property="og:title"]').attr('content')||$('h1').first().text()||$('title').text();
  const root=$('article').first().length?$('article').first():$('main').first().length?$('main').first():$('body');
  const text=root.find('p').map((_i,e)=>$(e).text().trim()).get().filter(Boolean).join('\n').slice(0,24_000);
  if(!title.trim()||text.length<80)throw new Error('Página sem conteúdo principal suficiente; forneça texto ou arquivo.');
  const date=$('meta[property="article:published_time"]').attr('content');
  return {title:title.trim().slice(0,300),url:canonicalUrl(url),text,publishedAt:date&&!isNaN(Date.parse(date))?new Date(date).toISOString():undefined,author:$('meta[name="author"]').attr('content'),fingerprint:fingerprint(text),method:'html-cheerio-v1',language:$('html').attr('lang')};
}
export async function collectSource(source:TrendSource):Promise<ExtractedItem[]> {
  if(!source.accessAcknowledged)throw new Error('Confirme as condições de acesso e reutilização da fonte antes da coleta.');
  const response=await fetchSource(source.url),body=response.bytes.toString('utf8');
  if(source.type==='html')return [extractHtml(body,response.url)];
  return parseFeed(body,response.url);
}
export async function parseFeed(body:string,origin?:string):Promise<ExtractedItem[]> {
  const parser=new Parser<Record<string,unknown>,{approxTraffic?:string}>({timeout:10_000,customFields:{item:[['ht:approx_traffic','approxTraffic']]}});const feed=await parser.parseString(body);
  const originUrl=origin?new URL(origin):undefined;
  const googleTrends=originUrl?.protocol==='https:'&&originUrl.hostname==='trends.google.com'&&originUrl.pathname==='/trending/rss';
  const result:ExtractedItem[]=[];
  for(const item of feed.items.slice(0,40)){
    if(!item.link)continue;
    try {const text=load(item.content??item.contentSnippet??item.summary??'').text().trim().slice(0,24_000);
      const originalTitle=item.title?.trim()||undefined;if(!originalTitle&&text.length<20)continue;
      // Public social RSS often has no title. Keep an explicit excerpt provenance.
      const title=originalTitle?.slice(0,300)??text.replace(/\s+/g,' ').slice(0,140),url=canonicalUrl(item.link);
      const searchSignal=googleTrends&&typeof item.approxTraffic==='string'&&/^\d[\d,.]*\s*[KMB]?\+?$/i.test(item.approxTraffic.trim())?{provider:'google_trends' as const,rawApproximateTraffic:item.approxTraffic.trim().slice(0,40),growthComparable:false as const}:undefined;
      result.push({title,titleOrigin:originalTitle?'feed':'content_excerpt',url,text,publishedAt:item.isoDate&&!isNaN(Date.parse(item.isoDate))?new Date(item.isoDate).toISOString():undefined,author:item.creator,externalId:item.guid,...(googleTrends?{discoveryKey:`google_trends:${originUrl!.searchParams.get('geo')??'default'}:${fingerprint(title)}`} : {}),fingerprint:fingerprint(text.length>100?text:title),method:'rss-parser-v2',...(searchSignal?{searchSignal}:{})});
    }catch{/* Invalid or internal feed links are excluded. */}
  }
  if(!result.length)throw new Error('Feed sem itens válidos; extração não confirmada.');return result;
}
export interface Observation {observedAt:string;value?:number;unit?:string;windowMinutes?:number;coverageComplete:boolean;sourceId:string}
export function rankItem(item:Pick<ExtractedItem,'title'|'text'|'publishedAt'>,source:Pick<TrendSource,'keywords'|'exclusions'>,observations:Observation[],now=Date.now()){
  const content=normal(item.title+' '+item.text),matches=source.keywords.filter(k=>content.includes(normal(k))),excluded=source.exclusions.some(k=>content.includes(normal(k)));
  const age=item.publishedAt?Math.max(0,(now-Date.parse(item.publishedAt))/3_600_000):null;
  const relevance=excluded?0:Math.round(70*(matches.length/Math.max(1,source.keywords.length))+30*(age===null?0.2:Math.exp(-age/72)));
  const comparable=observations.filter(o=>o.coverageComplete&&o.value!==undefined&&o.unit&&o.windowMinutes).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
  const first=comparable.at(-2),last=comparable.at(-1);let growth:number|null=null;
  if(first&&last&&first.unit===last.unit&&first.windowMinutes===last.windowMinutes&&first.sourceId===last.sourceId&&first.value!>0&&last.value!>=0&&Date.parse(last.observedAt)>Date.parse(first.observedAt))growth=(last.value!-first.value!)/first.value!;
  const state=growth===null?'recent_opportunity':growth>0.2?'growing':growth<-.2?'decelerating':'stable';
  // Duplicate sightings across feeds do not count as independent reporting.
  return {version:'editorial-v1',relevance,confidence:20+(observations.length?15:0)+(growth!==null?15:0),growth,state,matchedKeywords:matches,reasons:[matches.length?`Termos do nicho: ${matches.join(', ')}`:'Sem correspondência com termos configurados',growth===null?'Histórico sem sinal quantitativo comparável; crescimento não comprovado.':`Variação ${(growth*100).toFixed(1)}% na mesma unidade e janela.`],excluded};
}
export function latestMetricSnapshots<T extends {publicationId:string;observedAt:string;metrics:Record<string,number|null>}>(snapshots:T[]):T[]{const latest=new Map<string,T>();for(const row of snapshots)if(!latest.has(row.publicationId)||Date.parse(latest.get(row.publicationId)!.observedAt)<Date.parse(row.observedAt))latest.set(row.publicationId,row);return [...latest.values()];}
