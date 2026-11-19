-- Kantong MySpace migration: restore the file_path column expected by the app.
-- Safe to run more than once. Existing rows and files are not deleted.

alter table public.myspace_items
  add column if not exists file_path text;

-- Refresh PostgREST's schema cache so the browser API sees the new column.
notify pgrst, 'reload schema';
