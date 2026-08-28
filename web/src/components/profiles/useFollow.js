import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';

// Whether the viewer's own account (on this platform, in this world)
// follows the account they're looking at, plus a toggle. Shared between
// every profile skin the same way usePostInteractions is shared between
// post skins.
export function useFollow({ followedAccountId, viewerAccountId, worldId }) {
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

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

  // The profile's own stat-row counts — who follows it, who it follows —
  // independent of whichever account the current viewer happens to be
  // acting as, so these load even for a viewer with no account here yet.
  useEffect(() => {
    async function fetchCounts() {
      const [{ count: followers }, { count: followingTotal }] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_account_id', followedAccountId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_account_id', followedAccountId),
      ]);
      setFollowerCount(followers ?? 0);
      setFollowingCount(followingTotal ?? 0);
    }

    fetchCounts();
  }, [followedAccountId]);

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
      setFollowerCount((n) => Math.max(0, n - 1));
    } else {
      const { error } = await supabase.from('follows').insert({
        follower_account_id: viewerAccountId,
        followed_account_id: followedAccountId,
        world_id: worldId,
      });
      if (!error) {
        setFollowing(true);
        setFollowerCount((n) => n + 1);
      }
    }

    setBusy(false);
  }

  return { following, toggleFollow, busy, followerCount, followingCount };
}
