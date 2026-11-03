-- Read-only. Run BEFORE and AFTER the migration and retain the results privately.
select c.relname,c.relrowsecurity,c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('ads','responses','ff_reply_attempts');
select * from pg_policies where schemaname='public' and tablename in ('ads','responses','ff_reply_attempts');
select * from information_schema.role_table_grants where table_schema='public' and table_name in ('ads','responses','ff_reply_attempts');
select * from information_schema.role_column_grants where table_schema='public' and table_name in ('ads','responses','ff_reply_attempts');
-- Review every exposed view and SECURITY DEFINER function for indirect access.
select schemaname,viewname,definition from pg_views where schemaname='public';
select n.nspname,p.proname,p.prosecdef,p.proacl,pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f';
