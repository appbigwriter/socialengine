import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceIdentity,trendSourceCatalog} from '../src/engine/source-catalog.ts';
import {publicUrl} from '../src/engine/network.ts';
import {discoveryDirectory} from '../src/engine/discovery-directory.ts';

test('English source directory has distinct public feeds across editorial niches',()=>{
  assert.ok(trendSourceCatalog.length>=20);
  assert.equal(new Set(trendSourceCatalog.map(source=>source.id)).size,trendSourceCatalog.length);
  assert.equal(new Set(trendSourceCatalog.map(source=>sourceIdentity(source.url))).size,trendSourceCatalog.length);
  assert.ok(new Set(trendSourceCatalog.map(source=>source.publisher)).size>=8);
  for(const category of ['Tecnologia e IA','Negócios','Saúde','Ciência e ambiente','Cultura e lifestyle','Marketing e creators','Educação','Notícias','Redes sociais','Fóruns','Espiritualidade','Viagens'])assert.ok(trendSourceCatalog.filter(source=>source.category===category).length>=(['Educação'].includes(category)?1:2),category);
  for(const source of trendSourceCatalog){assert.equal(source.language,'en');assert.equal(source.type,'rss');assert.equal(publicUrl(source.url).protocol,'https:');assert.ok(source.keywords.length>0);assert.ok(source.intervalMinutes>=30);assert.ok(source.accessNote);assert.ok(publicUrl(source.referenceUrl));assert.equal('enabled' in source,false);assert.equal('accessAcknowledged' in source,false);}
});

test('global publishers, social discussion and discovery tools expose their real access status',()=>{
  const requested=['reuters','ap','nyt','wsj','washington-post','guardian','ft','le-monde','bbc','cnn','al-jazeera','dw','france24','reddit-worldnews','reddit-news','reddit-geopolitics','x','google-trends','tiktok-creative-center','pinterest-trends','perplexity'];
  assert.equal(new Set(discoveryDirectory.map(provider=>provider.id)).size,discoveryDirectory.length);
  for(const id of requested)assert.ok(discoveryDirectory.some(provider=>provider.id===id),id);
  for(const provider of discoveryDirectory){assert.ok(publicUrl(provider.url));assert.ok(publicUrl(provider.referenceUrl));
    if(provider.access==='feed'){const source=trendSourceCatalog.find(source=>source.id===provider.sourceId);assert.ok(source,provider.name);assert.equal(source.type,'rss');}
    else assert.equal(provider.sourceId,undefined,'unimplemented or restricted providers cannot open a subscription form');
  }
  for(const id of ['reuters','ap','reddit-worldnews','reddit-news','reddit-geopolitics','x','pinterest-trends','perplexity'])assert.equal(discoveryDirectory.find(provider=>provider.id===id)?.access,'api');
  assert.equal(discoveryDirectory.find(provider=>provider.id==='tiktok-creative-center')?.access,'manual');
  assert.equal(discoveryDirectory.find(provider=>provider.id==='guardian')?.access,'license');
  assert.equal(discoveryDirectory.find(provider=>provider.id==='le-monde')?.access,'license');
});

test('community topics and direct social posts are distinct from coverage about platforms',()=>{
  assert.equal(trendSourceCatalog.find(source=>source.id==='mastodon-official')?.sourceKind,'social_posts');
  assert.equal(trendSourceCatalog.find(source=>source.id==='social-media-today')?.sourceKind,'editorial');
  assert.equal(trendSourceCatalog.find(source=>source.id==='hacker-news')?.sourceKind,'forum_topics');
  assert.equal(trendSourceCatalog.find(source=>source.id==='discourse-meta')?.sourceKind,'forum_topics');
});

test('source identity recognizes tracking variations without merging different topic feeds',()=>{
  const url='https://feeds.npr.org/1006/rss.xml';
  assert.equal(sourceIdentity(url+'?utm_source=test&fbclid=test#heading'),sourceIdentity(url));
  assert.notEqual(sourceIdentity(url),sourceIdentity('https://feeds.npr.org/1007/rss.xml'));
  assert.equal(sourceIdentity('invalid'),'invalid');
});
