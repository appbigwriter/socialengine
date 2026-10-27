import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCharacterKit} from '../src/character-kit.ts';
import {workspaceSchema} from '../src/validation.ts';

test('English Character Bible fills persona fields without inventing brand colors or timezone',()=>{
  const {fields}=parseCharacterKit('# Valentina Reyes — Character Bible v2\n\n**Language:** EN-US\n**Audience:** Small-business owners\n## 1. Core Identity\n**Name:** Valentina Reyes\n**Public positioning:** Retail Growth & Storefront Strategist\n**Primary promise:** Help independent business owners.\n## 3. Voice\n### Voice formula\n**Perceptive + practical + warm + precise.**\n### Sentence habits\n- Short paragraphs');
  assert.equal(fields.name,'Valentina Reyes');assert.equal(fields.niche,'Retail Growth & Storefront Strategist');assert.equal(fields.audience,'Small-business owners');assert.equal(fields.objectives,'Help independent business owners.');assert.equal(fields.brand?.voice,'Perceptive + practical + warm + precise.');assert.equal(fields.blog?.language,'EN-US');assert.equal(fields.brand?.color,undefined);assert.equal(fields.timezone,undefined);
});
test('Portuguese headings, accent normalization and explicit palette are supported',()=>{
  const {fields}=parseCharacterKit('# Character Kit\n## Nome\nMaria Silva\n## Nicho\nCiência\n## Público-alvo\nProfessores\n## Objetivos\nEnsinar com clareza\n## Tom de voz\nPróximo e cuidadoso\n## Cor da marca\n#123abc\n## Fuso horário\nAmerica/Sao_Paulo');
  assert.equal(fields.name,'Maria Silva');assert.equal(fields.audience,'Professores');assert.equal(fields.brand?.color,'#123abc');assert.equal(fields.timezone,'America/Sao_Paulo');
});
test('unstructured kits remain attachable, invalid and oversized input cannot overwrite fields',()=>{
  assert.deepEqual(parseCharacterKit('A thoughtful fictional editorial persona.').fields,{});
  assert.throws(()=>parseCharacterKit(' '));assert.throws(()=>parseCharacterKit('x'.repeat(50001)));
  assert(!workspaceSchema.safeParse({name:'Persona',characterKit:{text:'x'.repeat(50001)}}).success);
});
