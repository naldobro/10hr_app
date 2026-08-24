/*
  # Storage bucket for Vision / Planner doc images

  Planner docs embed images by reference (a URL in the doc HTML) instead of
  inline base64, so editing stays snappy and rows stay small no matter how many
  screenshots pile up over the years.

  This creates a PUBLIC bucket. Permanent public URLs (a) never expire, so the
  URLs saved inside doc HTML keep working forever, and (b) drop straight into an
  <img src>. Object paths use random UUIDs, so they're unguessable — a better
  posture than the rest of this app's data, which lives under the guessable
  'single-user' id. If you ever want images private, switch the bucket to
  private and move to signed URLs (they expire and must be regenerated on load).

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor.
*/

-- Create the bucket (idempotent).
insert into storage.buckets (id, name, public)
values ('vision-images', 'vision-images', true)
on conflict (id) do update set public = true;

-- Policies on storage.objects, scoped to just this bucket, for the anon
-- 'public' role — matching the single-user model used by the data tables.
drop policy if exists "vision_images_select" on storage.objects;
drop policy if exists "vision_images_insert" on storage.objects;
drop policy if exists "vision_images_delete" on storage.objects;

create policy "vision_images_select" on storage.objects
  for select to public using (bucket_id = 'vision-images');
create policy "vision_images_insert" on storage.objects
  for insert to public with check (bucket_id = 'vision-images');
create policy "vision_images_delete" on storage.objects
  for delete to public using (bucket_id = 'vision-images');
