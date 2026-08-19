-- ============================================================
--  POTLUCK — database setup
--  Paste this whole file into Supabase → SQL Editor → Run.
--  You only ever need to do this once.
-- ============================================================

-- 1. The polls table: one row per meeting poll someone creates.
create table if not exists public.polls (
  id          text primary key,
  title       text not null,
  organizer   text not null,
  location    text,
  notes       text,
  duration    integer not null,
  slots       jsonb not null,
  created_at  timestamptz not null default now()
);

-- 2. The votes table: one row per person who responds.
create table if not exists public.votes (
  id          uuid primary key default gen_random_uuid(),
  poll_id     text not null references public.polls(id) on delete cascade,
  name        text not null,
  choices     jsonb not null,
  comment     text,
  created_at  timestamptz not null default now()
);

create index if not exists votes_poll_id_idx on public.votes(poll_id);

-- 3. Turn on row level security (Supabase requires this).
alter table public.polls enable row level security;
alter table public.votes enable row level security;

-- 4. Access rules.
--    Polls are readable by anyone with the link, and anyone can create one.
--    Polls can NOT be edited or deleted from the browser.
drop policy if exists "anyone can read polls"   on public.polls;
drop policy if exists "anyone can create polls" on public.polls;

create policy "anyone can read polls"
  on public.polls for select using (true);

create policy "anyone can create polls"
  on public.polls for insert with check (true);

--    Votes are readable by anyone with the link, anyone can add one,
--    and anyone can change or remove a vote (so people can fix mistakes).
drop policy if exists "anyone can read votes"   on public.votes;
drop policy if exists "anyone can add votes"    on public.votes;
drop policy if exists "anyone can edit votes"   on public.votes;
drop policy if exists "anyone can delete votes" on public.votes;

create policy "anyone can read votes"
  on public.votes for select using (true);

create policy "anyone can add votes"
  on public.votes for insert with check (true);

create policy "anyone can edit votes"
  on public.votes for update using (true) with check (true);

create policy "anyone can delete votes"
  on public.votes for delete using (true);

-- Done. You should see "Success. No rows returned."
