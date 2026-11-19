-- Kantong: repair an existing MySpace table without deleting user data.
-- Safe to rerun. Adds every field read or written by supabase-client.js.
-- Existing rows and objects in the private Storage bucket are not deleted.

alter table public.myspace_items
  add column if not exists user_id uuid,
  add column if not exists id text,
  add column if not exists type text,
  add column if not exists title varchar(120),
  add column if not exists subject varchar(80) not null default '',
  add column if not exists content text,
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists mime text,
  add column if not exists size bigint not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- The app upserts items on the (user_id, id) pair. Ensure old tables have
-- a matching unique index even if their original primary key was different.
create unique index if not exists myspace_items_user_id_id_uidx
  on public.myspace_items (user_id, id);

-- Keep the query used by MySpace list views efficient.
create index if not exists myspace_items_user_updated_idx
  on public.myspace_items (user_id, updated_at desc);

-- These fields are intentionally NULL for one of the two item types:
-- notes have no file metadata; materials have no text content.
-- Legacy versions sometimes created them as NOT NULL.
do $compat$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'myspace_items'
      and column_name = 'content'
  ) then
    alter table public.myspace_items alter column content drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'myspace_items'
      and column_name = 'file_path'
  ) then
    alter table public.myspace_items alter column file_path drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'myspace_items'
      and column_name = 'file_name'
  ) then
    alter table public.myspace_items alter column file_name drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'myspace_items'
      and column_name = 'mime'
  ) then
    alter table public.myspace_items alter column mime drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'myspace_items'
      and column_name = 'item_type'
  ) then
    alter table public.myspace_items alter column item_type drop not null;
  end if;
end
$compat$;

-- Ask PostgREST (the Supabase Data API) to reload its column metadata.
notify pgrst, 'reload schema';
