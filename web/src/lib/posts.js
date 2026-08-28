import { supabase } from './supabaseClient.js';

// Every feed page joins the same shape (author's platform persona + the
// platform it's on) — shared here so WorldFeed/PlatformFeedPage's initial
// fetch and their realtime "hydrate a newly inserted post" fetch can't
// drift out of sync with each other.
export const POST_SELECT =
  'id, content, created_at, base_like_count, retweet_count, client_label, media_url, media_kind, platform_accounts ( id, handle, display_name, avatar_url, verified, platforms ( slug, name ) )';

// postgres_changes only delivers the raw posts row on INSERT, not the
// platform_accounts/platforms join — this re-fetches one post with that
// join so a live-arriving post renders exactly like one from the initial
// page load.
export async function fetchPostById(postId) {
  const { data } = await supabase.from('posts').select(POST_SELECT).eq('id', postId).single();
  return data;
}
