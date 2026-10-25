-- Run once in Supabase SQL Editor after pay_requests.sql.
-- Only image files; no bills or PDFs. Public read only after a project is approved.
alter table public.pay_requests add column if not exists image_url text;
create or replace function public.pay_leaderboard()
returns table(id uuid,title text,story text,category text,amount numeric,nominee text,hashtag text,votes bigint,image_url text)
language sql stable security definer set search_path=public
as $$
 select p.id,p.title,p.story,p.category,p.amount,p.nominee,p.hashtag,count(v.user_id)::bigint,p.image_url
 from public.pay_requests p left join public.pay_votes v on v.project_id=p.id
 where p.status='approved'
 group by p.id,p.title,p.story,p.category,p.amount,p.nominee,p.hashtag,p.image_url
 order by count(v.user_id) desc,p.created_at asc
$$;
revoke all on function public.pay_leaderboard() from public;
grant execute on function public.pay_leaderboard() to anon,authenticated;
-- Create a private bucket in Storage called pay-images using Supabase dashboard.
-- For pilot simplicity, public images are not supported: do not publish private object paths.

-- Private storage bucket. No public read policy is created.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('pay-images','pay-images',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;
-- The server uses the anon key. Permit uploads only; never permit SELECT.
drop policy if exists "pay images private upload only" on storage.objects;
create policy "pay images private upload only" on storage.objects for insert to anon
with check (bucket_id='pay-images');
grant insert (image_url) on public.pay_requests to anon;
