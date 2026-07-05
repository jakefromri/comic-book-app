-- comic book app — storage buckets (04b)
-- path convention: {user_id}/... so ownership can be checked from the
-- first path segment. panels is the only public-read bucket (share
-- viewers load panel images directly; drawings/characters/temp-audio
-- stay private and are only ever touched by the owner or server-side
-- service-role code).

insert into storage.buckets (id, name, public)
values
  ('drawings', 'drawings', false),
  ('panels', 'panels', true),
  ('characters', 'characters', false),
  ('temp-audio', 'temp-audio', false);

create policy owner_all_drawings on storage.objects
  for all
  to authenticated
  using (bucket_id = 'drawings' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'drawings' and auth.uid()::text = (storage.foldername(name))[1]);

create policy owner_write_panels on storage.objects
  for all
  to authenticated
  using (bucket_id = 'panels' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'panels' and auth.uid()::text = (storage.foldername(name))[1]);

create policy public_read_panels on storage.objects
  for select
  to anon
  using (bucket_id = 'panels');

create policy owner_all_characters on storage.objects
  for all
  to authenticated
  using (bucket_id = 'characters' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'characters' and auth.uid()::text = (storage.foldername(name))[1]);

create policy owner_all_temp_audio on storage.objects
  for all
  to authenticated
  using (bucket_id = 'temp-audio' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'temp-audio' and auth.uid()::text = (storage.foldername(name))[1]);
