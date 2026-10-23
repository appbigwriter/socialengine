import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceIdentity,trendSourceCatalog} from '../src/engine/source-catalog.ts';
import {publicUrl} from '../src/engine/network.ts';

test('English source directory has distinct public feeds across editorial niches',()=>{
  assert.ok(trendSourceCatalog.length>=20);
  assert.equal(new Set(trendSourceCatalog.map(source=>source.id)).size,trendSourceCatalog.length);
  assert.equal(new Set(trendSourceCatalog.map(source=>sourceIdentity(source.url))).size,trendSourceCatalog.length);
  assert.ok(new Set(trendSourceCatalog.map(source=>source.publisher)).size>=8);
  for(const category of ['Tecnologia e IA','Negócios','Saúde','Ciência e ambiente','Cultura e lifestyle','Marketing e creators','Educação','Notícias','Redes sociais','Fóruns','Espiritualidade','Viagens'])assert.ok(trendSourceCatalog.filter(source=>source.category===category).length>=(['Educação'].includes(category)?1:2),category);
  for(const source of trendSourceCatalog){assert.equal(source.language,'en');assert.equal(source.type,'rss');assert.equal(publicUrl(source.url).protocol,'https:');assert.ok(source.keywords.length>0);assert.ok(source.intervalMinutes>=30);assert.ok(source.accessNote);assert.ok(publicUrl(source.referenceUrl));assert.equal('enabled' in source,false);assert.equal('accessAcknowledged' in source,false);}
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
