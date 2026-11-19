-- Kantong cloud schema
-- Run this whole file in Supabase Dashboard > SQL Editor > New query.
-- This schema gives each signed-in user access only to their own records.

create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"tx":[],"bud":{},"goals":[],"debts":[],"tasks":[],"next":""}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;
revoke all on public.user_data from anon, public;
grant select, insert, update, delete on public.user_data to authenticated;

drop policy if exists "Users read their own Kantong data" on public.user_data;
create policy "Users read their own Kantong data"
  on public.user_data for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users create their own Kantong data" on public.user_data;
create policy "Users create their own Kantong data"
  on public.user_data for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update their own Kantong data" on public.user_data;
create policy "Users update their own Kantong data"
  on public.user_data for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete their own Kantong data" on public.user_data;
create policy "Users delete their own Kantong data"
  on public.user_data for delete to authenticated
  using (auth.uid() = user_id);


create table if not exists public.myspace_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  type text not null check (type in ('note', 'material')),
  title varchar(120) not null,
  subject varchar(80) not null default '',
  content text,
  file_path text,
  file_name text,
  mime text,
  size bigint not null default 0 check (size >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint myspace_item_content_check check (
    (type = 'note' and content is not null) or
    (type = 'material' and file_path is not null and file_name is not null and mime is not null)
  )
);

-- CREATE TABLE IF NOT EXISTS does not update a table created by an older version.
-- Keep every column used by supabase-client.js present on existing installations too.
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

create unique index if not exists myspace_items_user_id_id_uidx
  on public.myspace_items (user_id, id);

-- The current app only requires these fields on every row.
-- Other columns are optional depending on whether an item is a note or material.
-- Older Kantong databases may also contain legacy fields (for example item_type)
-- that the current app does not send. Make those fields nullable rather than
-- forcing the browser client to invent old-schema values.
do $compat$
declare
  legacy_column record;
begin
  for legacy_column in
    select attribute.attname as column_name
    from pg_attribute as attribute
    where attribute.attrelid = 'public.myspace_items'::regclass
      and attribute.attnum > 0
      and not attribute.attisdropped
      and attribute.attnotnull
      and attribute.attname <> all (array[
        'user_id',
        'id',
        'type',
        'title',
        'subject',
        'size',
        'created_at',
        'updated_at'
      ])
  loop
    execute format(
      'alter table public.myspace_items alter column %I drop not null',
      legacy_column.column_name
    );
  end loop;
end
$compat$;

create index if not exists myspace_items_user_updated_idx
  on public.myspace_items (user_id, updated_at desc);

alter table public.myspace_items enable row level security;
revoke all on public.myspace_items from anon, public;
grant select, insert, update, delete on public.myspace_items to authenticated;

drop policy if exists "Users manage their own MySpace items" on public.myspace_items;
create policy "Users manage their own MySpace items"
  on public.myspace_items for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- Private file bucket. Each file path starts with the owner's auth user ID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'myspace',
  'myspace',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users read their own MySpace files" on storage.objects;
create policy "Users read their own MySpace files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'myspace'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users upload their own MySpace files" on storage.objects;
create policy "Users upload their own MySpace files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'myspace'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update their own MySpace files" on storage.objects;
create policy "Users update their own MySpace files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'myspace'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'myspace'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete their own MySpace files" on storage.objects;
create policy "Users delete their own MySpace files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'myspace'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- Enable Realtime for cross-device financial updates, without duplicating publication entries.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_data'
  ) then
    alter publication supabase_realtime add table public.user_data;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'myspace_items'
  ) then
    alter publication supabase_realtime add table public.myspace_items;
  end if;
end
$$;

notify pgrst, 'reload schema';
