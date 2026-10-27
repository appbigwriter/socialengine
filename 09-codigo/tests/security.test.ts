import test from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';
import {readConfig} from '../src/config.ts';import {seal,unseal} from '../src/security.ts';import {blogSchema} from '../src/validation.ts';
import {verifyAuthority,AppError} from '../src/security.ts';

test('Authority integration failures are unavailable, while explicit access denials remain forbidden',async t=>{
  const config={...readConfig(true),sandbox:false,authorityVerifierUrl:'https://authority.example/api/verify',authorityOperatorToken:'test-operator',bootstrapUserIds:[]};
  const originalFetch=globalThis.fetch;
  try{
    for(const status of [401,404,500,503,403]){
      await t.test(`HTTP ${status}`,async()=>{
        globalThis.fetch=async()=>new Response('{}',{status});
        await assert.rejects(()=>verifyAuthority(config,'test-actor'),(error:unknown)=>error instanceof AppError&&error.statusCode===(status===403?403:503));
      });
    }
  }finally{globalThis.fetch=originalFetch;}
});
test('credential encryption is bound to tenant and provider and rejects tampering',()=>{const config={...readConfig(true),encryptionKey:randomBytes(32).toString('base64')};const scope={projectId:'p',ownerId:'o',tenantId:'t',actorId:'a',roles:['admin'] as const};const s={...scope,roles:['admin' as const]};const encrypted=seal(config,s,'openai','test-private-key');assert(!encrypted.includes('test-private-key'));assert.equal(unseal(config,s,'openai',encrypted),'test-private-key');assert.throws(()=>unseal(config,{...s,tenantId:'different'},'openai',encrypted));assert.throws(()=>unseal(config,s,'anthropic',encrypted));assert.throws(()=>unseal({...config,encryptionKey:randomBytes(32).toString('base64')},s,'openai',encrypted));});
test('blog can be pending without URL, active requires an HTTP URL and cannot forge connected state',()=>{assert(blogSchema.safeParse({status:'provisioning'}).success);assert(!blogSchema.safeParse({status:'active',url:''}).success);assert(!blogSchema.safeParse({status:'active',url:'javascript:alert(1)'}).success);assert(blogSchema.safeParse({status:'active',url:'https://blog.example'}).success);assert(!blogSchema.safeParse({url:'https://blog.example',integrationState:'connected'}).success);});
test('sandbox identity cannot be enabled in production',()=>{const before=process.env.NODE_ENV;process.env.NODE_ENV='production';try{assert.throws(()=>readConfig(true),/prohibited/);}finally{if(before===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=before;}});
