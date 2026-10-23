-- Execute only in an isolated verification database after restoring the base schema.
begin;
insert into custom_socialengine.entities(id,key,name,type,metadata,project_id,owner_id,tenant_id) values
('cc01aa11-1111-4111-8111-111111111111','test-a','Tenant A','influencer','{}','91e9e57d-37a9-44bd-91c9-815b099d87c1','cd02ca43-c4e6-4b13-bd81-84b886a195bc','cc01aa11-1111-4111-8111-111111111111'),
('cc02aa22-2222-4222-8222-222222222222','test-b','Tenant B','influencer','{}','91e9e57d-37a9-44bd-91c9-815b099d87c1','cd02ca43-c4e6-4b13-bd81-84b886a195bc','cc02aa22-2222-4222-8222-222222222222');
insert into custom_socialengine.memberships(project_id,owner_id,tenant_id,user_id,roles) values
('91e9e57d-37a9-44bd-91c9-815b099d87c1','cd02ca43-c4e6-4b13-bd81-84b886a195bc','cc01aa11-1111-4111-8111-111111111111','cc0a3e51-bab3-414c-b55b-7b37d7cfc6fb','{admin}'),
('91e9e57d-37a9-44bd-91c9-815b099d87c1','cd02ca43-c4e6-4b13-bd81-84b886a195bc','cc02aa22-2222-4222-8222-222222222222','1eabcbf5-d559-469a-886a-fc1dc49401c3','{admin}');
select set_config('se.project_id','91e9e57d-37a9-44bd-91c9-815b099d87c1',true),set_config('se.owner_id','cd02ca43-c4e6-4b13-bd81-84b886a195bc',true),set_config('se.tenant_id','cc01aa11-1111-4111-8111-111111111111',true),set_config('se.actor_id','cc0a3e51-bab3-414c-b55b-7b37d7cfc6fb',true);
set local role socialengine_app;
do $$begin
 if (select count(*) from custom_socialengine.entities)<>1 then raise exception 'RLS isolation failed'; end if;
 if exists(select 1 from custom_socialengine.entities where id='cc02aa22-2222-4222-8222-222222222222') then raise exception 'Cross-tenant read'; end if;
 begin
  insert into custom_socialengine.records(entity_id,data,kind,project_id,owner_id,tenant_id) values('cc02aa22-2222-4222-8222-222222222222','{}','source','91e9e57d-37a9-44bd-91c9-815b099d87c1','cd02ca43-c4e6-4b13-bd81-84b886a195bc','cc02aa22-2222-4222-8222-222222222222');
  raise exception 'Cross-tenant insert was accepted';
 exception when insufficient_privilege then null; end;
end$$;
insert into custom_socialengine.records(id,entity_id,data,kind,project_id,owner_id,tenant_id) values('cc03aa33-3333-4333-8333-333333333333','cc01aa11-1111-4111-8111-111111111111','{"title":"Verification draft","status":"draft","slides":[],"caption":"test"}','post','91e9e57d-37a9-44bd-91c9-815b099d87c1','cd02ca43-c4e6-4b13-bd81-84b886a195bc','cc01aa11-1111-4111-8111-111111111111');
do $$begin
 if (select count(*) from custom_socialengine.records where kind='post_version')<>1 then raise exception 'Version missing'; end if;
 begin
  update custom_socialengine.records set data='{}' where kind='post_version';
  raise exception 'Immutable version changed';
 exception when insufficient_privilege then null; end;
end$$;
reset role;
rollback;
select 'postgres_verification_passed' as result;
