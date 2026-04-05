-- Private buckets and object policies: path must be {case_id}/... where the attorney owns the case.

insert into storage.buckets (id, name, public)
values
  ('raw-uploads', 'raw-uploads', false),
  ('analysis-outputs', 'analysis-outputs', false)
on conflict (id) do nothing;

-- Helper expression: first path segment is case UUID; must belong to auth.uid().
-- Invalid UUID in segment causes cast failure and denies access.

create policy attorney_storage_objects_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id in ('raw-uploads', 'analysis-outputs')
    and exists (
      select 1
      from public.cases c
      where c.id = split_part(name, '/', 1)::uuid
        and c.attorney_id = (select auth.uid())
    )
  );

create policy attorney_storage_objects_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id in ('raw-uploads', 'analysis-outputs')
    and exists (
      select 1
      from public.cases c
      where c.id = split_part(name, '/', 1)::uuid
        and c.attorney_id = (select auth.uid())
    )
  );

create policy attorney_storage_objects_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id in ('raw-uploads', 'analysis-outputs')
    and exists (
      select 1
      from public.cases c
      where c.id = split_part(name, '/', 1)::uuid
        and c.attorney_id = (select auth.uid())
    )
  )
  with check (
    bucket_id in ('raw-uploads', 'analysis-outputs')
    and exists (
      select 1
      from public.cases c
      where c.id = split_part(name, '/', 1)::uuid
        and c.attorney_id = (select auth.uid())
    )
  );

create policy attorney_storage_objects_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id in ('raw-uploads', 'analysis-outputs')
    and exists (
      select 1
      from public.cases c
      where c.id = split_part(name, '/', 1)::uuid
        and c.attorney_id = (select auth.uid())
    )
  );
