import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import type {RuntimeConfig} from './contracts.ts';

export const SANDBOX_PROJECT='91e9e57d-37a9-44bd-91c9-815b099d87c1';
export const SANDBOX_OWNER='cd02ca43-c4e6-4b13-bd81-84b886a195bc';
export const SANDBOX_ACTOR='cc0a3e51-bab3-414c-b55b-7b37d7cfc6fb';
export const SANDBOX_SECOND_ACTOR='1eabcbf5-d559-469a-886a-fc1dc49401c3';
function publicKey(value:string|undefined):string|undefined{
  if(!value)return undefined;
  if(value.startsWith('sb_publishable_'))return value;
  try{const payload=JSON.parse(Buffer.from(value.split('.')[1]??'','base64url').toString('utf8'));return payload.role==='anon'?value:undefined;}catch{return undefined;}
}
export function readConfig(sandbox=process.argv.includes('--sandbox')):RuntimeConfig {
  if(!sandbox){const envPath=resolve(process.cwd(),'../.env.local');if(existsSync(envPath))process.loadEnvFile(envPath);}
  const production=process.env.NODE_ENV==='production'||process.env.APP_ENV==='production';
  if(sandbox&&production)throw new Error('Sandbox authentication is prohibited in production.');
  const host=sandbox?'127.0.0.1':process.env.HOST??'0.0.0.0';
  const schema=process.env.CONTROL_TOWER_SCHEMA_NAME??'custom_socialengine';
  if(schema!=='custom_socialengine')throw new Error('Schema must be custom_socialengine.');
  const config:RuntimeConfig={
    sandbox,production,host,port:Number(process.env.PORT??3000),
    projectId:sandbox?SANDBOX_PROJECT:process.env.CONTROL_TOWER_PROJECT_ID??'6dccc6dd-880f-4148-921a-08cbe8a1f219',
    ownerId:sandbox?SANDBOX_OWNER:process.env.AUTHORITY_OWNER_ID,
    databaseUrl:sandbox?undefined:process.env.DATABASE_URL,
    supabaseUrl:process.env.SUPABASE_URL,supabaseAnonKey:publicKey(process.env.SUPABASE_ANON_KEY),
    supabaseServiceKey:process.env.SUPABASE_SERVICE_ROLE_KEY,
    authorityVerifierUrl:process.env.AUTHORITY_VERIFIER_URL,
    authorityOperatorToken:process.env.AUTHORITY_OPERATOR_TOKEN,
    encryptionKey:process.env.SOCIALENGINE_ENCRYPTION_KEY,
    dataDir:resolve(process.env.SOCIALENGINE_DATA_DIR??(sandbox?'.data/sandbox':'.data/production')),
    publicUrl:sandbox?'http://127.0.0.1:3000':process.env.SOCIALENGINE_PUBLIC_URL??'https://socialengine.fbr.news',
    maxUploadBytes:25*1024*1024,
    allowRegistrations:process.env.SOCIALENGINE_ALLOW_REGISTRATION==='true',
    bootstrapUserIds:(process.env.SOCIALENGINE_ADMIN_USER_IDS??'').split(',').filter(Boolean)
  };
  if(!Number.isInteger(config.port)||config.port<1||config.port>65535)throw new Error('Invalid PORT.');
  return config;
}
