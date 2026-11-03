-- Apply during maintenance BEFORE deploying the matching server routes.
-- Transaction rolls back on schema/dependency errors. Back up first.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
-- Abort rather than accidentally depend on an unexpected extension location.
do $$ begin
 if not exists (select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto' and n.nspname='extensions') then
  raise exception 'pgcrypto must be installed in extensions; review extension placement before migration';
 end if;
end $$;

alter table public.ads add column if not exists password_hash text;
-- Preserve existing passwords, including legacy short passwords. New ads require 12+.
-- Fail explicitly for passwords bcrypt would truncate. Resolve these ads privately first.
do $$ begin
 if exists (select 1 from public.ads where password is not null and octet_length(password)>72) then
  raise exception 'Legacy password exceeds 72 bytes; arrange a private reset before migration';
 end if;
end $$;
update public.ads set password_hash=extensions.crypt(password,extensions.gen_salt('bf',12))
where password_hash is null and password is not null and password<>'';
-- Fail closed: only the explicit public mode is public. Legacy ambiguous ads stay secret.
update public.ads set response_mode='secret' where response_mode is null or response_mode not in ('public','secret');
alter table public.ads drop column password;

-- Defense in depth: remove table AND pre-existing column grants and all old policies.
alter table public.ads enable row level security;
alter table public.responses enable row level security;
revoke all on public.ads,public.responses from public,anon,authenticated;
do $$ declare r record; begin
 for r in select table_name,column_name from information_schema.columns where table_schema='public' and table_name in ('ads','responses') loop
  execute format('revoke all (%I) on public.%I from public,anon,authenticated',r.column_name,r.table_name);
 end loop;
 for r in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('ads','responses') loop
  execute format('drop policy %I on public.%I',r.policyname,r.tablename);
 end loop;
end $$;
grant select,insert on public.ads,public.responses to service_role;
grant update(id) on public.ads to service_role;
grant usage on schema extensions to service_role;
-- Also support identity/serial primary keys in an existing installation.
do $$ declare t text; seq text; begin
 foreach t in array array['ads','responses'] loop
  seq := pg_get_serial_sequence('public.' || t,'id');
  if seq is not null then execute format('grant usage on sequence %s to service_role',seq); end if;
 end loop;
end $$;

-- A durable per-ad budget shared by ALL server instances. No caller-supplied IP trust.
create table public.ff_reply_attempts (
 ad_id text primary key,
 window_start timestamptz not null,
 attempts integer not null
);
alter table public.ff_reply_attempts enable row level security;
revoke all on public.ff_reply_attempts from public,anon,authenticated;
grant select,insert,update on public.ff_reply_attempts to service_role;

create function public.ff_list_ads() returns jsonb
language sql security invoker set search_path='' as $$
 with listing as (
  select a.id,a.title,a.description,a.city,a.lat,a.lng,a.event_date,a.event_time,
         a.response_mode,case when a.response_mode='public' then a.public_contact else null end as public_contact,
         a.image_url,a.created_at
  from public.ads a order by a.created_at desc
 ), counts as (select r.ad_id,count(*) as total from public.responses r group by r.ad_id)
 select jsonb_build_object('ads',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from listing l),'[]'::jsonb),
 'counts',coalesce((select jsonb_object_agg(ad_id::text,total) from counts),'{}'::jsonb))
$$;

create function public.ff_create_ad(p_ad jsonb) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if p_ad->>'response_mode' not in ('public','secret') or p_ad->>'response_mode' is null then raise exception 'Invalid mode'; end if;
 if p_ad->>'response_mode'='secret' and (coalesce(length(p_ad->>'password'),0)<12 or octet_length(p_ad->>'password')>72) then raise exception 'Invalid password'; end if;
 if p_ad->>'response_mode'='public' and coalesce(trim(p_ad->>'public_contact'),'')='' then raise exception 'Missing contact'; end if;
 insert into public.ads(title,description,city,lat,lng,event_date,event_time,response_mode,public_contact,password_hash,image_url)
 values (p_ad->>'title',p_ad->>'description',p_ad->>'city',(p_ad->>'lat')::double precision,(p_ad->>'lng')::double precision,
 nullif(p_ad->>'event_date',''),nullif(p_ad->>'event_time',''),p_ad->>'response_mode',
 case when p_ad->>'response_mode'='public' then p_ad->>'public_contact' else null end,
 case when p_ad->>'response_mode'='secret' then extensions.crypt(p_ad->>'password',extensions.gen_salt('bf',12)) else null end,p_ad->>'image_url');
end $$;

create function public.ff_send_reply(p_ad_id text,p_message text,p_contact text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 insert into public.responses(ad_id,message,contact)
 select a.id,p_message,p_contact from public.ads a where a.id::text=p_ad_id;
 if not found then raise exception 'Ad unavailable'; end if;
end $$;

create function public.ff_read_replies(p_ad_id text,p_password text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare ad public.ads%rowtype; used integer; result jsonb;
begin
 -- Lock the ad across authentication and retrieval; a concurrent mode change cannot
 -- authorize a private read using a stale public mode.
 select * into ad from public.ads a where a.id::text=p_ad_id for share;
 if not found then return jsonb_build_object('status',403,'error','Ad unavailable or incorrect password.'); end if;
 if ad.response_mode is distinct from 'public' then
  insert into public.ff_reply_attempts as t(ad_id,window_start,attempts)
  values(p_ad_id,clock_timestamp(),1)
  on conflict(ad_id) do update set
   attempts=case when t.window_start < clock_timestamp()-interval '15 minutes' then 1 else least(t.attempts+1,31) end,
   window_start=case when t.window_start < clock_timestamp()-interval '15 minutes' then clock_timestamp() else t.window_start end
  returning attempts into used;
  -- Return errors, don't raise: failed attempts must commit to the budget.
  if used>30 then return jsonb_build_object('status',429,'error','Too many attempts for this ad. Try again in 15 minutes.'); end if;
  if p_password is null or octet_length(p_password)>72 or ad.password_hash is null
     or extensions.crypt(p_password,ad.password_hash) is distinct from ad.password_hash then
   return jsonb_build_object('status',403,'error','Ad unavailable or incorrect password.');
  end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'message',r.message,'contact',r.contact,'created_at',r.created_at) order by r.created_at desc),'[]'::jsonb)
 into result from public.responses r where r.ad_id=ad.id;
 return jsonb_build_object('replies',result);
end $$;

revoke all on function public.ff_list_ads(),public.ff_create_ad(jsonb),public.ff_send_reply(text,text,text),public.ff_read_replies(text,text) from public,anon,authenticated;
grant execute on function public.ff_list_ads(),public.ff_create_ad(jsonb),public.ff_send_reply(text,text,text),public.ff_read_replies(text,text) to service_role;
notify pgrst,'reload schema';
commit;
