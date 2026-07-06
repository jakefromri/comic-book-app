-- comic book app — narration audio (COM-5)
-- Cached TTS narration per page. narration_audio_text_hash lets /api/tts skip
-- regenerating (and re-billing OpenAI) when the cached audio still matches the
-- current narration_bar_text/enhanced_narration.

alter table pages
  add column narration_audio_url text,
  add column narration_audio_text_hash text;

-- public-read like panels: the share viewer plays narration audio with no auth.
insert into storage.buckets (id, name, public)
values ('narration-audio', 'narration-audio', true);

create policy owner_write_narration_audio on storage.objects
  for all
  to authenticated
  using (bucket_id = 'narration-audio' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'narration-audio' and auth.uid()::text = (storage.foldername(name))[1]);

create policy public_read_narration_audio on storage.objects
  for select
  to anon
  using (bucket_id = 'narration-audio');
