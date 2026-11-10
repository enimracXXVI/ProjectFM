-- ProjectFM: world database file (all players from an FMSuperScout dump, compressed)
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

-- Private bucket: only the owner can read or write files in their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('world-data', 'world-data', false, 52428800,
        array['application/gzip', 'application/octet-stream']);

create policy "world data: owner select" on storage.objects for select to authenticated
  using (bucket_id = 'world-data' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "world data: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'world-data' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "world data: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'world-data' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "world data: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'world-data' and (storage.foldername(name))[1] = (select auth.uid())::text);
