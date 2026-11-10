-- ProjectFM: user-editable settings + career images (crest, kits)
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

-- ---------------------------------------------------------------------------
-- Settings: one JSON document per key per user
-- keys used by the app: 'statuses', 'attributes', 'layout'
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key         text not null,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  unique (user_id, key)
);

alter table public.app_settings enable row level security;

create policy "own rows" on public.app_settings for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.app_settings to authenticated;
revoke all on public.app_settings from anon;

create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Career images: public URLs of files in the 'career-images' bucket
-- ---------------------------------------------------------------------------
alter table public.careers
  add column crest_url      text,
  add column kit_home_url   text,
  add column kit_away_url   text,
  add column kit_third_url  text;

-- Public bucket: anyone with the exact URL can view an image (URLs contain random IDs).
-- Only the owner can upload, replace or delete, and only inside their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('career-images', 'career-images', true, 2097152,
        array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']);

create policy "career images: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'career-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "career images: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'career-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "career images: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'career-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "career images: owner select" on storage.objects for select to authenticated
  using (bucket_id = 'career-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
