-- Attorney profiles: Stripe billing fields, bar metadata, auth.users sync.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text not null default 'inactive',
  subscription_plan text,
  bar_number text,
  bar_verified boolean not null default false,
  created_at timestamptz not null default now(),
  constraint profiles_subscription_status_check check (
    subscription_status in ('inactive', 'active', 'past_due', 'cancelled', 'beta')
  ),
  constraint profiles_subscription_plan_check check (
    subscription_plan is null
    or subscription_plan in ('monthly', 'annual', 'beta')
  )
);

create index profiles_stripe_customer_id_idx on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create index profiles_stripe_subscription_id_idx on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select, update on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- New user → profile row (bar fields from signup metadata)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bn text;
  bv text;
  bv_bool boolean;
begin
  bn := nullif(trim(new.raw_user_meta_data->>'bar_number'), '');
  bv := new.raw_user_meta_data->>'bar_verified';
  if bv is null then
    bv_bool := false;
  else
    bv_bool := bv in ('true', 't', '1', 'yes');
  end if;

  insert into public.profiles (id, bar_number, bar_verified)
  values (new.id, bn, bv_bool);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Backfill existing auth users
-- ---------------------------------------------------------------------------
insert into public.profiles (id, bar_number, bar_verified)
select
  u.id,
  nullif(trim(u.raw_user_meta_data->>'bar_number'), ''),
  coalesce(
    case
      when u.raw_user_meta_data->>'bar_verified' is null then false
      when lower(trim(u.raw_user_meta_data->>'bar_verified')) in ('true', 't', '1', 'yes') then true
      else false
    end,
    false
  )
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
