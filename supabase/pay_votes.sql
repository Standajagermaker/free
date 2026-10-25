-- Run in Supabase SQL Editor after pay_requests.sql.
-- Only reviewed/approved projects can appear in the public leaderboard.
create table if not exists public.pay_votes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  project_id uuid not null references public.pay_requests(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists pay_votes_project_id_idx on public.pay_votes(project_id);
alter table public.pay_votes enable row level security;
revoke all on public.pay_votes from anon, authenticated;
grant insert (user_id,project_id) on public.pay_votes to authenticated;
grant select (user_id,project_id) on public.pay_votes to authenticated;
drop policy if exists "one verified user one vote" on public.pay_votes;
create policy "one verified user one vote" on public.pay_votes for insert to authenticated
with check (user_id=auth.uid() and exists (select 1 from public.pay_requests p where p.id=project_id and p.status='approved'));
drop policy if exists "read own vote" on public.pay_votes;
create policy "read own vote" on public.pay_votes for select to authenticated using (user_id=auth.uid());
-- Read-only aggregate. Never exposes pending requests or voter identities.
create or replace function public.pay_leaderboard()
returns table(id uuid,title text,story text,category text,amount numeric,nominee text,hashtag text,votes bigint)
language sql stable security definer set search_path=public
as $$
 select p.id,p.title,p.story,p.category,p.amount,p.nominee,p.hashtag,count(v.user_id)::bigint
 from public.pay_requests p left join public.pay_votes v on v.project_id=p.id
 where p.status='approved'
 group by p.id,p.title,p.story,p.category,p.amount,p.nominee,p.hashtag
 order by count(v.user_id) desc,p.created_at asc
$$;
revoke all on function public.pay_leaderboard() from public;
grant execute on function public.pay_leaderboard() to anon,authenticated;
