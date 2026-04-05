-- Row Level Security and table grants (append-only: no DELETE grants or policies).

alter table public.cases enable row level security;
alter table public.messages enable row level security;
alter table public.behavioral_flags enable row level security;
alter table public.exports enable row level security;
alter table public.audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- cases: attorney owns their rows
-- ---------------------------------------------------------------------------
create policy cases_select_own
  on public.cases
  for select
  to authenticated
  using (attorney_id = (select auth.uid()));

create policy cases_insert_own
  on public.cases
  for insert
  to authenticated
  with check (attorney_id = (select auth.uid()));

create policy cases_update_own
  on public.cases
  for update
  to authenticated
  using (attorney_id = (select auth.uid()))
  with check (attorney_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- messages, behavioral_flags, exports: scoped via owning case
-- ---------------------------------------------------------------------------
create policy messages_select_case_owned
  on public.messages
  for select
  to authenticated
  using (
    case_id in (
      select c.id from public.cases c where c.attorney_id = (select auth.uid())
    )
  );

create policy messages_insert_case_owned
  on public.messages
  for insert
  to authenticated
  with check (
    case_id in (
      select c.id from public.cases c where c.attorney_id = (select auth.uid())
    )
  );

create policy messages_update_case_owned
  on public.messages
  for update
  to authenticated
  using (
    case_id in (
      select c.id from public.cases c where c.attorney_id = (select auth.uid())
    )
  )
  with check (
    case_id in (
      select c.id from public.cases c where c.attorney_id = (select auth.uid())
    )
  );

create policy behavioral_flags_select_case_owned
  on public.behavioral_flags
  for select
  to authenticated
  using (
    case_id in (
      select c.id from public.cases c where c.attorney_id = (select auth.uid())
    )
  );

create policy behavioral_flags_insert_case_owned
  on public.behavioral_flags
  for insert
  to authenticated
  with check (
    case_id in (
      select c.id from public.cases c where c.attorney_id = (select auth.uid())
    )
  );

create policy behavioral_flags_update_case_owned
  on public.behavioral_flags
  for update
  to authenticated
  using (
    case_id in (
      select c.id from public.cases c where c.attorney_id = (select auth.uid())
    )
  )
  with check (
    case_id in (
      select c.id from public.cases c where c.attorney_id = (select auth.uid())
    )
  );

create policy exports_select_case_owned
  on public.exports
  for select
  to authenticated
  using (
    case_id in (
      select c.id from public.cases c where c.attorney_id = (select auth.uid())
    )
  );

create policy exports_insert_case_owned
  on public.exports
  for insert
  to authenticated
  with check (
    case_id in (
      select c.id from public.cases c where c.attorney_id = (select auth.uid())
    )
  );

create policy exports_update_case_owned
  on public.exports
  for update
  to authenticated
  using (
    case_id in (
      select c.id from public.cases c where c.attorney_id = (select auth.uid())
    )
  )
  with check (
    case_id in (
      select c.id from public.cases c where c.attorney_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- audit_log: insert as self; read own rows only
-- ---------------------------------------------------------------------------
create policy audit_log_insert_self
  on public.audit_log
  for insert
  to authenticated
  with check (actor_id = (select auth.uid()));

create policy audit_log_select_own
  on public.audit_log
  for select
  to authenticated
  using (actor_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants: authenticated may read/write (no DELETE); service_role retains full access via ownership
-- ---------------------------------------------------------------------------
grant select, insert, update on table public.cases to authenticated;
grant select, insert, update on table public.messages to authenticated;
grant select, insert, update on table public.behavioral_flags to authenticated;
grant select, insert, update on table public.exports to authenticated;
grant select, insert, update on table public.audit_log to authenticated;
