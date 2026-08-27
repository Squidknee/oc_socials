import { supabase } from './supabaseClient.js';

const BUCKET = 'media';

// Uploads a file into the shared public bucket under the uploader's own
// folder (see 0010_media_storage.sql) and returns its public URL — the
// same kind of string avatar_url/media_url already store today, whether
// it came from a paste or a real upload.
export async function uploadMedia(file, userId) {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
