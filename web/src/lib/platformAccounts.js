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
