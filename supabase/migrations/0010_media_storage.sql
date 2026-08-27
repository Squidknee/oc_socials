-- Public storage bucket for real file uploads (avatars, post media),
-- replacing pasted URLs as the primary way to attach media. Public was a
-- deliberate choice: simple, no expiring signed URLs, at the cost of an
-- image URL itself not being world-gated the way everything else in this
-- app is — acceptable here since posts/likes/etc. are already fabricated
-- content, not sensitive data.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  26214400, -- 25 MB
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do nothing;

-- Objects are stored under {auth.uid()}/{filename} — storage RLS only
-- needs to check "is this your own folder," not which character/post the
-- file ends up attached to. That part is already enforced by the normal
-- RLS on characters/platform_accounts/posts when the resulting URL gets
-- saved onto a row.
create policy "media_insert_own_folder" on storage.objects for insert with check (
  bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "media_update_own_folder" on storage.objects for update using (
  bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "media_delete_own_folder" on storage.objects for delete using (
  bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
);

-- The bucket is public, so unauthenticated GETs already bypass RLS via
-- the public object endpoint — this just covers authenticated SDK calls
-- (e.g. listing) with the same "authenticated" pattern used elsewhere.
create policy "media_select_authenticated" on storage.objects for select using (
  bucket_id = 'media' and auth.role() = 'authenticated'
);
