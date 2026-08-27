import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';

// Whether the viewer's own account (on this platform, in this world)
// follows the account they're looking at, plus a toggle. Shared between
// every profile skin the same way usePostInteractions is shared between
// post skins.
export function useFollow({ followedAccountId, viewerAccountId, worldId }) {
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!viewerAccountId || viewerAccountId === followedAccountId) {
      setFollowing(false);
      return;
    }

    async function fetchFollow() {
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_account_id', viewerAccountId)
        .eq('followed_account_id', followedAccountId)
        .maybeSingle();
      setFollowing(!!data);
    }

    fetchFollow();
  }, [followedAccountId, viewerAccountId]);

  async function toggleFollow() {
    if (!viewerAccountId || busy) return;
    setBusy(true);

    if (following) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_account_id', viewerAccountId)
        .eq('followed_account_id', followedAccountId);
      setFollowing(false);
    } else {
      const { error } = await supabase.from('follows').insert({
        follower_account_id: viewerAccountId,
        followed_account_id: followedAccountId,
        world_id: worldId,
      });
      if (!error) setFollowing(true);
    }

    setBusy(false);
  }

  return { following, toggleFollow, busy };
}
