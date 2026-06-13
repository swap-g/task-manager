-- Personal Task Manager — Supabase schema
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

-- 1. Key/value store, one row per (user, key).
create table if not exists public.app_kv (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  key        text        not null,
  value      text,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- 2. Row Level Security: users may only touch their own rows.
alter table public.app_kv enable row level security;

-- Drop first so this script is safe to re-run.
drop policy if exists "app_kv owner access" on public.app_kv;

create policy "app_kv owner access"
  on public.app_kv
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Realtime: broadcast changes on this table so other devices stay in sync.
--    (Wrapped so re-running doesn't error if the table is already added.)
do $$
begin
  alter publication supabase_realtime add table public.app_kv;
exception
  when duplicate_object then null;
end
$$;
