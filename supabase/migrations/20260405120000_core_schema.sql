-- Arbor core schema: tables, constraints, triggers, indexes.
-- gen_random_uuid() is available via pgcrypto on Supabase; ensure extension exists.
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- cases
-- ---------------------------------------------------------------------------
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  attorney_id uuid not null references auth.users (id) on delete cascade,
  case_code text not null,
  jurisdiction text not null,
  status text not null default 'pending',
  severity_score integer,
  message_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cases_status_check check (
    status in ('pending', 'ingesting', 'analyzing', 'ready', 'error')
  ),
  constraint cases_severity_score_check check (
    severity_score is null or (severity_score >= 0 and severity_score <= 100)
  )
);

create index cases_attorney_id_idx on public.cases (attorney_id);

create or replace function public.set_cases_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger cases_set_updated_at
  before update on public.cases
  for each row
  execute function public.set_cases_updated_at();

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  sent_at timestamptz not null,
  sender_role text not null,
  body_text text not null,
  platform_source text not null,
  raw_hash text not null,
  created_at timestamptz not null default now(),
  constraint messages_sender_role_check check (
    sender_role in ('parent_a', 'parent_b', 'unknown')
  ),
  constraint messages_platform_source_check check (
    platform_source in ('ourfamilywizard', 'talkingparents', 'generic')
  ),
  constraint messages_case_id_raw_hash_unique unique (case_id, raw_hash)
);

create index messages_case_id_idx on public.messages (case_id);

-- ---------------------------------------------------------------------------
-- behavioral_flags
-- ---------------------------------------------------------------------------
create table public.behavioral_flags (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  indicator_category text not null,
  confidence text not null,
  reasoning_text text not null,
  quoted_excerpt text,
  attorney_status text not null default 'pending',
  reclassified_as text,
  claude_model_version text not null,
  created_at timestamptz not null default now(),
  constraint behavioral_flags_indicator_category_check check (
    indicator_category in (
      'denigration',
      'access_blocking',
      'communication_interference',
      'parentification',
      'false_allegations',
      'loyalty_conflict',
      'isolation',
      'noncompliance'
    )
  ),
  constraint behavioral_flags_confidence_check check (
    confidence in ('high', 'medium', 'low')
  ),
  constraint behavioral_flags_attorney_status_check check (
    attorney_status in ('pending', 'accepted', 'rejected', 'reclassified')
  )
);

create index behavioral_flags_case_id_idx on public.behavioral_flags (case_id);
create index behavioral_flags_message_id_idx on public.behavioral_flags (message_id);

create or replace function public.behavioral_flags_message_case_matches()
returns trigger
language plpgsql
as $$
declare
  msg_case uuid;
begin
  select m.case_id into msg_case
  from public.messages m
  where m.id = new.message_id;

  if msg_case is null then
    raise exception 'messages row not found for message_id %', new.message_id;
  end if;

  if new.case_id is distinct from msg_case then
    raise exception 'behavioral_flags.case_id must match messages.case_id for message_id';
  end if;

  return new;
end;
$$;

create trigger behavioral_flags_message_case_matches
  before insert or update on public.behavioral_flags
  for each row
  execute function public.behavioral_flags_message_case_matches();

-- ---------------------------------------------------------------------------
-- exports
-- ---------------------------------------------------------------------------
create table public.exports (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  export_type text not null,
  file_path text not null,
  watermarked boolean not null default true,
  attorney_acknowledged boolean not null default false,
  created_at timestamptz not null default now(),
  constraint exports_export_type_check check (
    export_type in ('timeline_pdf', 'exhibit_pdf', 'motion_docx')
  )
);

create index exports_case_id_idx on public.exports (case_id);

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users (id),
  case_id uuid references public.cases (id) on delete set null,
  action_type text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_actor_id_idx on public.audit_log (actor_id);
create index audit_log_case_id_idx on public.audit_log (case_id);
