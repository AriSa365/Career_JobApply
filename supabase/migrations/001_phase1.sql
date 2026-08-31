-- Phase 1 persistence for the HEOR Career Agent.
-- Run this in Supabase SQL Editor or via `supabase db push`.

create table if not exists public.search_runs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  searched_at timestamptz not null default now(),
  raw_count integer not null default 0,
  strict_count integer not null default 0,
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.job_postings (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  company text not null,
  location text,
  category text,
  posted_at timestamptz,
  posted_label text,
  days_old integer,
  match_score integer,
  apply_url text,
  source text,
  description text,
  payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (id, user_id)
);

create index if not exists job_postings_user_last_seen_idx on public.job_postings(user_id, last_seen_at desc);
create index if not exists search_runs_user_searched_idx on public.search_runs(user_id, searched_at desc);

alter table public.search_runs enable row level security;
alter table public.job_postings enable row level security;

create policy "Users can read own search runs"
on public.search_runs for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can read own jobs"
on public.job_postings for select
to authenticated
using (auth.uid() = user_id);

-- Writes are performed only by the server-side Edge Function using the secret/service key.
