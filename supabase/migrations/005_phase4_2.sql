-- Phase 4.2: application eligibility guardrails + company-resolution audit state.

alter table public.applications
  add column if not exists eligibility_override boolean not null default false,
  add column if not exists eligibility_override_reason text not null default '',
  add column if not exists company_resolution text not null default 'UNRESOLVED';

update public.applications
set company_resolution = case
  when coalesce(job_snapshot->>'company', '') ~* '^(company not parsed|unknown company|unknown)$' then 'UNRESOLVED'
  else 'ORIGINAL'
end
where company_resolution = 'UNRESOLVED';

alter table public.applications
  drop constraint if exists applications_company_resolution_check;

alter table public.applications
  add constraint applications_company_resolution_check
  check (company_resolution in ('ORIGINAL', 'RECOVERED', 'MANUAL', 'UNRESOLVED'));
