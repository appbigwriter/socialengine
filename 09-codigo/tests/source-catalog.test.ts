import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceIdentity,trendSourceCatalog} from '../src/engine/source-catalog.ts';
import {publicUrl} from '../src/engine/network.ts';

test('English source directory has distinct public feeds across editorial niches',()=>{
  assert.ok(trendSourceCatalog.length>=20);
  assert.equal(new Set(trendSourceCatalog.map(source=>source.id)).size,trendSourceCatalog.length);
  assert.equal(new Set(trendSourceCatalog.map(source=>sourceIdentity(source.url))).size,trendSourceCatalog.length);
  assert.ok(new Set(trendSourceCatalog.map(source=>source.publisher)).size>=8);
  for(const category of ['Tecnologia e IA','Negócios','Saúde','Ciência e ambiente','Cultura e lifestyle','Marketing e creators','Educação'])assert.ok(trendSourceCatalog.some(source=>source.category===category),category);
  for(const source of trendSourceCatalog){assert.equal(source.language,'en');assert.equal(source.type,'rss');assert.equal(publicUrl(source.url).protocol,'https:');assert.ok(source.keywords.length>0);assert.ok(source.intervalMinutes>=30);assert.ok(source.accessNote);assert.ok(publicUrl(source.referenceUrl));assert.equal('enabled' in source,false);assert.equal('accessAcknowledged' in source,false);}
});

test('source identity recognizes tracking variations without merging different topic feeds',()=>{
  const url='https://feeds.npr.org/1006/rss.xml';
  assert.equal(sourceIdentity(url+'?utm_source=test&fbclid=test#heading'),sourceIdentity(url));
  assert.notEqual(sourceIdentity(url),sourceIdentity('https://feeds.npr.org/1007/rss.xml'));
  assert.equal(sourceIdentity('invalid'),'invalid');
});
