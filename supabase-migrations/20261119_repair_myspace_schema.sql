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

-- Ask PostgREST (the Supabase Data API) to reload its column metadata.
notify pgrst, 'reload schema';
