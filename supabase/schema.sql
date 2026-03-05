-- Supabase schema for Gele AI MVP

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  username text,
  full_name text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text,
  gele_color text,
  storage_path text not null,
  model text,
  duration_ms integer,
  is_free boolean not null default true,
  usage_day date not null default ((now() at time zone 'Africa/Lagos')::date),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists generations_one_free_per_day
  on public.generations(user_id, usage_day)
  where is_free = true;

create index if not exists generations_user_created_at_idx
  on public.generations(user_id, created_at desc);

create index if not exists generations_expires_at_idx
  on public.generations(expires_at);

alter table public.profiles enable row level security;
alter table public.generations enable row level security;

create policy "users can read own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id);

create policy "users can read own generations"
  on public.generations
  for select
  using (auth.uid() = user_id);

-- Profiles trigger: create one profile per auth user
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_full_name text;
  derived_username text;
begin
  raw_full_name := coalesce(new.raw_user_meta_data->>'full_name', '');
  derived_username := split_part(trim(raw_full_name), ' ', 1);

  insert into public.profiles (id, email, username, full_name, country)
  values (
    new.id,
    new.email,
    case
      when derived_username = '' then 'user'
      else lower(regexp_replace(derived_username, '[^a-zA-Z0-9_]', '', 'g'))
    end,
    nullif(raw_full_name, ''),
    nullif(new.raw_user_meta_data->>'country', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Optional: automatic cleanup if pg_cron is enabled on your project.
-- select cron.schedule('delete_expired_generations_daily', '5 0 * * *', $$
--   delete from public.generations where expires_at <= now();
-- $$);
