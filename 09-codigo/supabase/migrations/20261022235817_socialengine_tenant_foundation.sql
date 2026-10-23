-- Additive migration: never touches governance in public.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='socialengine_app') THEN CREATE ROLE socialengine_app NOLOGIN NOBYPASSRLS; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='socialengine_worker') THEN CREATE ROLE socialengine_worker NOLOGIN NOBYPASSRLS; END IF;
END $$;
ALTER ROLE socialengine_app NOBYPASSRLS;
ALTER ROLE socialengine_worker NOBYPASSRLS;
-- Self-hosted Supabase's postgres role may have CREATEROLE without SUPERUSER.
-- Explicit membership is necessary for SET LOCAL ROLE during scoped requests.
DO $$ BEGIN EXECUTE format('GRANT socialengine_app TO %I',current_user); END $$;
GRANT USAGE ON SCHEMA custom_socialengine TO socialengine_app,socialengine_worker;
DO $$ DECLARE t text; missing_count bigint; BEGIN
 FOREACH t IN ARRAY ARRAY['entities','entity_relations','records','files','settings','audit_logs','events'] LOOP
  EXECUTE format('ALTER TABLE custom_socialengine.%I ADD COLUMN IF NOT EXISTS project_id uuid, ADD COLUMN IF NOT EXISTS owner_id uuid, ADD COLUMN IF NOT EXISTS tenant_id uuid',t);
  IF EXISTS(SELECT FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='custom_socialengine' AND c.relname=t) THEN
   EXECUTE format('SELECT count(*) FROM custom_socialengine.%I WHERE project_id IS NULL OR owner_id IS NULL OR tenant_id IS NULL',t) INTO missing_count;
   IF missing_count>0 THEN RAISE EXCEPTION 'Unscoped rows require explicit ownership migration: %',t; END IF;
  END IF;
  EXECUTE format('ALTER TABLE custom_socialengine.%I ALTER COLUMN project_id SET NOT NULL, ALTER COLUMN owner_id SET NOT NULL, ALTER COLUMN tenant_id SET NOT NULL',t);
  EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON custom_socialengine.%I(project_id,owner_id,tenant_id,id)',t||'_scope_id',t);
 END LOOP;
END $$;
ALTER TABLE custom_socialengine.entities ADD CONSTRAINT entities_tenant_identity CHECK(id=tenant_id);
ALTER TABLE custom_socialengine.records ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'source', ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE custom_socialengine.events ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'queued', ADD COLUMN IF NOT EXISTS run_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS idempotency_key text, ADD COLUMN IF NOT EXISTS lease_token uuid, ADD COLUMN IF NOT EXISTS lease_until timestamptz, ADD COLUMN IF NOT EXISTS last_error text;
CREATE UNIQUE INDEX IF NOT EXISTS events_idempotency ON custom_socialengine.events(project_id,owner_id,tenant_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_due ON custom_socialengine.events(state,run_at);
CREATE INDEX IF NOT EXISTS records_kind_scope ON custom_socialengine.records(project_id,owner_id,tenant_id,kind);
CREATE TABLE IF NOT EXISTS custom_socialengine.memberships (
 tenant_id uuid NOT NULL,user_id uuid NOT NULL,roles text[] NOT NULL,project_id uuid NOT NULL,owner_id uuid NOT NULL,
 PRIMARY KEY(project_id,owner_id,tenant_id,user_id),
 CHECK(cardinality(roles)>0 AND roles <@ ARRAY['admin','editor','reviewer','publisher','viewer']::text[]),
 FOREIGN KEY(project_id,owner_id,tenant_id,tenant_id) REFERENCES custom_socialengine.entities(project_id,owner_id,tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS custom_socialengine.credentials (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,project_id uuid NOT NULL,owner_id uuid NOT NULL,
 provider text NOT NULL,kind text NOT NULL,ciphertext text NOT NULL,masked_hint text NOT NULL,state text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 
 FOREIGN KEY(project_id,owner_id,tenant_id,tenant_id) REFERENCES custom_socialengine.entities(project_id,owner_id,tenant_id,id) ON DELETE CASCADE
);
DO $$ DECLARE t text; missing_count bigint; BEGIN
 FOREACH t IN ARRAY ARRAY['entity_relations','records','files','settings','audit_logs','events'] LOOP
  EXECUTE format('ALTER TABLE custom_socialengine.%I ADD CONSTRAINT %I FOREIGN KEY(project_id,owner_id,tenant_id,tenant_id) REFERENCES custom_socialengine.entities(project_id,owner_id,tenant_id,id)',t,t||'_tenant_fk');
 END LOOP;
END $$;
ALTER TABLE custom_socialengine.records ADD CONSTRAINT records_entity_scope_fk FOREIGN KEY(project_id,owner_id,tenant_id,entity_id) REFERENCES custom_socialengine.entities(project_id,owner_id,tenant_id,id);
ALTER TABLE custom_socialengine.entity_relations ADD CONSTRAINT relations_source_scope_fk FOREIGN KEY(project_id,owner_id,tenant_id,source_entity_id) REFERENCES custom_socialengine.entities(project_id,owner_id,tenant_id,id);
ALTER TABLE custom_socialengine.entity_relations ADD CONSTRAINT relations_target_scope_fk FOREIGN KEY(project_id,owner_id,tenant_id,target_entity_id) REFERENCES custom_socialengine.entities(project_id,owner_id,tenant_id,id);
CREATE OR REPLACE FUNCTION custom_socialengine.scope_matches(p uuid,o uuid,t uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT p::text=current_setting('se.project_id',true) AND o::text=current_setting('se.owner_id',true) AND t::text=current_setting('se.tenant_id',true)
$$;
-- SECURITY DEFINER predicate avoids recursive membership RLS. Search path pinned and inputs scoped.
CREATE OR REPLACE FUNCTION custom_socialengine.has_membership(p uuid,o uuid,t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,custom_socialengine AS $$
 SELECT custom_socialengine.scope_matches(p,o,t) AND EXISTS(SELECT 1 FROM custom_socialengine.memberships m WHERE m.project_id=p AND m.owner_id=o AND m.tenant_id=t AND m.user_id::text=current_setting('se.actor_id',true))
$$;
REVOKE ALL ON FUNCTION custom_socialengine.has_membership(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION custom_socialengine.has_membership(uuid,uuid,uuid),custom_socialengine.scope_matches(uuid,uuid,uuid) TO socialengine_app,socialengine_worker;
DO $$ DECLARE t text; missing_count bigint; BEGIN
 FOREACH t IN ARRAY ARRAY['entities','entity_relations','records','files','settings','audit_logs','events','memberships','credentials'] LOOP
  EXECUTE format('ALTER TABLE custom_socialengine.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_scope ON custom_socialengine.%I TO socialengine_app USING(custom_socialengine.has_membership(project_id,owner_id,tenant_id)) WITH CHECK(custom_socialengine.has_membership(project_id,owner_id,tenant_id))',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON custom_socialengine.%I TO socialengine_app',t);
 END LOOP;
END $$;
REVOKE INSERT,UPDATE,DELETE ON custom_socialengine.audit_logs FROM socialengine_app;
REVOKE INSERT,UPDATE,DELETE ON custom_socialengine.memberships FROM socialengine_app;
REVOKE ALL ON custom_socialengine.credentials FROM socialengine_app;

-- Membership rows are private to the actor; administrators may inspect their own tenant team.
CREATE OR REPLACE FUNCTION custom_socialengine.is_tenant_admin(p uuid,o uuid,t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,custom_socialengine AS $$
 SELECT custom_socialengine.scope_matches(p,o,t) AND EXISTS(SELECT 1 FROM custom_socialengine.memberships m WHERE m.project_id=p AND m.owner_id=o AND m.tenant_id=t AND m.user_id::text=current_setting('se.actor_id',true) AND 'admin'=ANY(m.roles))
$$;
REVOKE ALL ON FUNCTION custom_socialengine.is_tenant_admin(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION custom_socialengine.is_tenant_admin(uuid,uuid,uuid) TO socialengine_app;
DROP POLICY tenant_scope ON custom_socialengine.memberships;
CREATE POLICY membership_read ON custom_socialengine.memberships FOR SELECT TO socialengine_app USING(custom_socialengine.has_membership(project_id,owner_id,tenant_id) AND (user_id::text=current_setting('se.actor_id',true) OR custom_socialengine.is_tenant_admin(project_id,owner_id,tenant_id)));
ALTER TABLE custom_socialengine.credentials ADD CONSTRAINT credentials_state CHECK(state IN ('active','revoked'));
ALTER TABLE custom_socialengine.credentials ADD CONSTRAINT credentials_kind CHECK(kind IN ('api_key','oauth'));
ALTER TABLE custom_socialengine.events ADD CONSTRAINT events_state CHECK(state IN ('queued','processing','succeeded','failed','uncertain','cancelled'));
ALTER TABLE custom_socialengine.records ADD CONSTRAINT records_revision_positive CHECK(revision>0);

CREATE UNIQUE INDEX credentials_active_provider ON custom_socialengine.credentials(project_id,owner_id,tenant_id,provider,kind) WHERE state='active';
CREATE OR REPLACE FUNCTION custom_socialengine.keep_scope_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
  RAISE EXCEPTION 'Scope identity is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['entities','entity_relations','records','files','settings','audit_logs','events','memberships','credentials'] LOOP
  EXECUTE format('CREATE TRIGGER immutable_scope BEFORE UPDATE ON custom_socialengine.%I FOR EACH ROW EXECUTE FUNCTION custom_socialengine.keep_scope_identity()',t);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION custom_socialengine.actor_roles(p uuid,o uuid,t uuid) RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,custom_socialengine AS $$
 SELECT m.roles FROM custom_socialengine.memberships m WHERE m.project_id=p AND m.owner_id=o AND m.tenant_id=t AND m.user_id::text=current_setting('se.actor_id',true)
$$;
REVOKE ALL ON FUNCTION custom_socialengine.actor_roles(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION custom_socialengine.actor_roles(uuid,uuid,uuid) TO socialengine_app;
CREATE OR REPLACE FUNCTION custom_socialengine.guard_records() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,custom_socialengine AS $$
DECLARE r text[]; changed_content boolean; requested_status text; previous_status text;
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.kind='post_version' THEN RAISE EXCEPTION 'Versions are immutable' USING ERRCODE='42501'; END IF;
  r:=custom_socialengine.actor_roles(OLD.project_id,OLD.owner_id,OLD.tenant_id);
  IF NOT coalesce(r && ARRAY['admin','editor'],false) THEN RAISE EXCEPTION 'Editor role required' USING ERRCODE='42501'; END IF;
  RETURN OLD;
 END IF;
 IF NEW.kind='post_version' THEN
  IF TG_OP<>'INSERT' OR pg_trigger_depth()<2 THEN RAISE EXCEPTION 'Versions are managed transactionally' USING ERRCODE='42501'; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.revision<>OLD.revision+1) THEN RAISE EXCEPTION 'Record updates require next revision and stable ID' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND NEW.kind IS DISTINCT FROM OLD.kind THEN RAISE EXCEPTION 'Record kind immutable' USING ERRCODE='23514'; END IF;
 r:=custom_socialengine.actor_roles(NEW.project_id,NEW.owner_id,NEW.tenant_id);
 IF NEW.kind='post' THEN
  requested_status:=coalesce(NEW.data->>'status','draft');
  IF requested_status NOT IN ('draft','in_review','changes_requested','approved') THEN RAISE EXCEPTION 'Invalid editorial status' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN
   IF NOT coalesce(r && ARRAY['admin','editor'],false) OR requested_status<>'draft' THEN RAISE EXCEPTION 'New posts require editor and draft status' USING ERRCODE='42501'; END IF;
   NEW.data:=NEW.data - ARRAY['approvedBy','approvedAt','approvedRevision'];
  ELSE
   previous_status:=OLD.data->>'status';
   changed_content:=(NEW.data - ARRAY['status','reviewComment','approvedBy','approvedAt','approvedRevision']) IS DISTINCT FROM (OLD.data - ARRAY['status','reviewComment','approvedBy','approvedAt','approvedRevision']);
   IF changed_content THEN
    IF NOT coalesce(r && ARRAY['admin','editor'],false) THEN RAISE EXCEPTION 'Editor role required for content' USING ERRCODE='42501'; END IF;
    NEW.data:=(NEW.data - ARRAY['approvedBy','approvedAt','approvedRevision']) || jsonb_build_object('status','draft');
   ELSE
    IF requested_status IN ('approved','changes_requested') THEN
     IF NOT coalesce(r && ARRAY['admin','reviewer'],false) THEN RAISE EXCEPTION 'Reviewer role required' USING ERRCODE='42501'; END IF;
     IF requested_status='approved' THEN
      IF previous_status NOT IN ('in_review','approved') THEN RAISE EXCEPTION 'Submit before approval' USING ERRCODE='23514'; END IF;
      NEW.data:=NEW.data || jsonb_build_object('approvedBy',current_setting('se.actor_id',true),'approvedAt',now(),'approvedRevision',NEW.revision);
     END IF;
    ELSIF NOT coalesce(r && ARRAY['admin','editor'],false) THEN RAISE EXCEPTION 'Editor role required' USING ERRCODE='42501'; END IF;
    IF requested_status<>'approved' THEN NEW.data:=NEW.data - ARRAY['approvedBy','approvedAt','approvedRevision']; END IF;
   END IF;
  END IF;
 ELSIF NEW.kind IN ('publication','campaign','metric_snapshot','oauth_state','social_account') THEN
  IF NOT coalesce(r && ARRAY['admin','editor','publisher'],false) THEN RAISE EXCEPTION 'Distribution role required' USING ERRCODE='42501'; END IF;
 ELSE
  IF NOT coalesce(r && ARRAY['admin','editor'],false) THEN RAISE EXCEPTION 'Editor role required' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER records_permissions BEFORE INSERT OR UPDATE OR DELETE ON custom_socialengine.records FOR EACH ROW EXECUTE FUNCTION custom_socialengine.guard_records();
CREATE OR REPLACE FUNCTION custom_socialengine.snapshot_post() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,custom_socialengine AS $$
BEGIN
 IF NEW.kind='post' THEN
  INSERT INTO custom_socialengine.records(id,entity_id,data,kind,project_id,owner_id,tenant_id) VALUES(gen_random_uuid(),NEW.tenant_id,jsonb_build_object('postId',NEW.id,'revision',NEW.revision,'data',NEW.data),'post_version',NEW.project_id,NEW.owner_id,NEW.tenant_id);
  INSERT INTO custom_socialengine.audit_logs(id,action,resource_id,metadata,project_id,owner_id,tenant_id) VALUES(gen_random_uuid(),CASE WHEN TG_OP='INSERT' THEN 'post.created' ELSE 'post.updated' END,NEW.id::text,jsonb_build_object('actorId',current_setting('se.actor_id',true),'revision',NEW.revision,'status',NEW.data->>'status'),NEW.project_id,NEW.owner_id,NEW.tenant_id);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER post_snapshot AFTER INSERT OR UPDATE ON custom_socialengine.records FOR EACH ROW EXECUTE FUNCTION custom_socialengine.snapshot_post();

CREATE UNIQUE INDEX post_version_snapshot_once ON custom_socialengine.records(project_id,owner_id,tenant_id,(data->>'postId'),(data->>'revision')) WHERE kind='post_version';
