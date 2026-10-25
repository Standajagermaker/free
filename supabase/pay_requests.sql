-- Execute once in Supabase SQL Editor. Public read is intentionally disabled.
create table if not exists public.pay_requests (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 title text not null check (char_length(title) between 3 and 90),
 story text not null check (char_length(story) between 15 and 700),
 amount numeric(10,2) not null check (amount between 1 and 100000),
 category text not null check (category in ('Essentials','Housing','Education','Health','Other')),
 nominee text not null default '' check (char_length(nominee)<=80),
 hashtag text not null default '' check (char_length(hashtag)<=60),
 status text not null default 'pending' check (status in ('pending','approved','rejected'))
);
alter table public.pay_requests enable row level security;
revoke all on public.pay_requests from anon, authenticated;
grant usage on schema public to anon;
grant insert (title,story,amount,category,nominee,hashtag) on public.pay_requests to anon;
drop policy if exists "public can submit for review" on public.pay_requests;
create policy "public can submit for review" on public.pay_requests for insert to anon with check (status='pending');
-- No SELECT policy. Review submissions privately in Supabase.
