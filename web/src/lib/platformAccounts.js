import { supabase } from './supabaseClient.js';

// Every character gets one platform_accounts row per "feed" platform at
// creation time, seeded from their master profile — this is the app-level
// half of what 0007_platforms.sql's comments describe: seeded from the
// character, then independently editable, with no ongoing sync back.
// "messaging" platforms (iMessage) aren't seeded since DMs aren't built yet.
// Called from every place that inserts a `characters` row (new, copied,
// or imported) so the profile's account list is never empty.
export async function seedPlatformAccounts({ character, worldId, platforms }) {
  const feedPlatforms = platforms.filter((p) => p.kind === 'feed');
  if (feedPlatforms.length === 0) return;

  const { error } = await supabase.from('platform_accounts').insert(
    feedPlatforms.map((platform) => ({
      character_id: character.id,
      platform_id: platform.id,
      world_id: worldId,
      handle: character.handle,
      display_name: character.display_name,
      avatar_url: character.avatar_url,
      bio: character.bio,
    }))
  );

  if (error) {
    console.error('Error seeding platform accounts:', error);
  }
}

// Stand-in for a real character-switcher: picks the first platform account
// the current user owns on the given platform, in the given world, to act
// as while liking/commenting. Used anywhere a feed or profile needs to
// know "who am I browsing as" until an actual switcher exists.
export async function fetchViewerAccountId({ worldId, platformSlug, userId }) {
  const { data } = await supabase
    .from('platform_accounts')
    .select('id, characters!inner ( owner_id ), platforms!inner ( slug )')
    .eq('world_id', worldId)
    .eq('characters.owner_id', userId)
    .eq('platforms.slug', platformSlug)
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

// Same stand-in, but for a feed that mixes posts from multiple platforms
// at once (WorldFeed's "What's New") — one viewer account per platform
// slug, since "who am I acting as" is different on Instagram than Twitter.
export async function fetchViewerAccountsBySlug({ worldId, userId }) {
  const { data } = await supabase
    .from('platform_accounts')
    .select('id, characters!inner ( owner_id ), platforms!inner ( slug )')
    .eq('world_id', worldId)
    .eq('characters.owner_id', userId);

  const bySlug = {};
  for (const row of data ?? []) {
    const slug = row.platforms?.slug;
    if (slug && !(slug in bySlug)) bySlug[slug] = row.id;
  }
  return bySlug;
}
