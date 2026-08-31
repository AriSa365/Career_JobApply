-- Phase 2: persist GPT job analyses. Raw CV text is intentionally NOT stored here.

create table if not exists public.job_analyses (
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id text not null,
  recommendation text not null,
  eligibility text not null,
  sponsorship text not null,
  cv_match integer,
  overall_fit integer,
  model text not null,
  analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create index if not exists job_analyses_user_updated_idx on public.job_analyses(user_id, updated_at desc);

alter table public.job_analyses enable row level security;

drop policy if exists "Users can read own job analyses" on public.job_analyses;
create policy "Users can read own job analyses"
on public.job_analyses for select
to authenticated
using (auth.uid() = user_id);

-- Writes are performed only by the server-side Edge Function using the secret/service key.
