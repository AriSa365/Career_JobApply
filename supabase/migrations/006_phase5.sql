-- Phase 5: recruiter / hiring-manager intelligence and outreach tracking.

create table if not exists public.networking_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  job_id text not null,
  name text not null,
  title text not null default '',
  company text not null default '',
  location text not null default '',
  linkedin_url text not null default '',
  source_url text not null default '',
  source_snippet text not null default '',
  public_email text not null default '',
  role_category text not null default 'OTHER',
  relevance_score integer not null default 0 check (relevance_score between 0 and 100),
  relevance_reasons jsonb not null default '[]'::jsonb,
  discovery_query text not null default '',
  status text not null default 'Discovered',
  follow_up_at date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists networking_contacts_user_job_linkedin_unique
  on public.networking_contacts(user_id, job_id, linkedin_url)
  where linkedin_url <> '';
create index if not exists networking_contacts_user_job_score_idx
  on public.networking_contacts(user_id, job_id, relevance_score desc, updated_at desc);

alter table public.networking_contacts enable row level security;

drop policy if exists "Users can read own networking contacts" on public.networking_contacts;
create policy "Users can read own networking contacts"
on public.networking_contacts for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own networking contacts" on public.networking_contacts;
create policy "Users can insert own networking contacts"
on public.networking_contacts for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own networking contacts" on public.networking_contacts;
create policy "Users can update own networking contacts"
on public.networking_contacts for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own networking contacts" on public.networking_contacts;
create policy "Users can delete own networking contacts"
on public.networking_contacts for delete
to authenticated
using (auth.uid() = user_id);

create table if not exists public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  job_id text not null,
  contact_id uuid references public.networking_contacts(id) on delete cascade,
  model text not null,
  linkedin_connection_note text not null default '',
  linkedin_follow_up text not null default '',
  email_subject text not null default '',
  email_body text not null default '',
  personalization_points jsonb not null default '[]'::jsonb,
  fact_lock_passed boolean not null default false,
  verified_evidence integer not null default 0,
  rejected_items jsonb not null default '[]'::jsonb,
  status text not null default 'Draft',
  sent_at timestamptz,
  follow_up_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outreach_messages_user_job_created_idx
  on public.outreach_messages(user_id, job_id, created_at desc);

alter table public.outreach_messages enable row level security;

drop policy if exists "Users can read own outreach messages" on public.outreach_messages;
create policy "Users can read own outreach messages"
on public.outreach_messages for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own outreach messages" on public.outreach_messages;
create policy "Users can insert own outreach messages"
on public.outreach_messages for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own outreach messages" on public.outreach_messages;
create policy "Users can update own outreach messages"
on public.outreach_messages for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own outreach messages" on public.outreach_messages;
create policy "Users can delete own outreach messages"
on public.outreach_messages for delete
to authenticated
using (auth.uid() = user_id);
