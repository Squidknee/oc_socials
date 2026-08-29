import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { usePlatforms } from '../lib/PlatformsContext.jsx';
import { POST_SELECT, fetchPostById } from '../lib/posts.js';
import Post from '../components/posts/Post.jsx';
import '../components/profiles/profiles.css';

// A world-wide timeline for one platform — every post from every account
// on that platform in this world, newest first. Distinct from a platform
// account's own profile (just their posts) and from WorldFeed (a hub
// linking out to these, not a feed itself).
export default function PlatformFeedPage() {
  const { worldId, slug } = useParams();
  const { user } = useAuth();
  const { getPlatform } = usePlatforms();
  const platform = getPlatform(slug);

  const [posts, setPosts] = useState([]);
  // Candidates for each post's own "act as" picker (see InstagramPost/
  // TwitterPost) — every character you own here with an account on this
  // platform. Same "never silently default, never persist a choice"
  // model as WorldFeed's "What's New", since arriving at a platform feed
  // doesn't establish who you're acting as any more than that does.
  const [myAccounts, setMyAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  // Which account each post was liked as, for the heart's filled state
  // (see Post.jsx) — kept here at the page level so it survives posts
  // re-rendering/reordering and only resets on navigating away or a
  // browser reload, same reasoning as WorldFeed's own copy of this.
  const [likedAsAccountByPost, setLikedAsAccountByPost] = useState({});

  useEffect(() => {
    if (!platform) return;

    async function fetchPosts() {
      const { data, error } = await supabase
        .from('posts')
        .select(POST_SELECT)
        .eq('world_id', worldId)
        .eq('platform_id', platform.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching platform feed:', error);
      } else {
        setPosts(data ?? []);
      }
      setLoading(false);
    }

    async function fetchMyAccounts() {
      // Every character you own here, PLUS every public/shared character
      // (can_act_as_character, 0029, is the real enforcement) — same
      // candidate pool WorldFeed's "What's New" offers.
      const { data } = await supabase
        .from('characters')
        .select('id, display_name, avatar_url, platform_accounts ( id, platform_id )')
        .eq('world_id', worldId)
        .or(`owner_id.eq.${user.id},is_public.eq.true`);

      const accounts = [];
      for (const character of data ?? []) {
        for (const account of character.platform_accounts ?? []) {
          if (account.platform_id !== platform.id) continue;
          accounts.push({
            accountId: account.id,
            characterId: character.id,
            displayName: character.display_name,
            avatarUrl: character.avatar_url,
          });
        }
      }
      setMyAccounts(accounts);
    }

    fetchPosts();
    fetchMyAccounts();
  }, [worldId, slug, platform?.id, user.id]);

  // Live timeline: postgres_changes can only filter on one column, so this
  // subscribes per-world and drops anything not on this platform itself.
  useEffect(() => {
    if (!platform) return;

    const channel = supabase
      .channel(`platform-feed:${worldId}:${platform.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts', filter: `world_id=eq.${worldId}` },
        async (payload) => {
          if (payload.new.platform_id !== platform.id) return;
          const post = await fetchPostById(payload.new.id);
          if (!post) return;
          setPosts((prev) => (prev.some((p) => p.id === post.id) ? prev : [post, ...prev]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [worldId, platform?.id]);

  if (!platform) return <p style={{ padding: '1rem' }}>Unknown platform.</p>;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-header-main">
          <div className="profile-info">
            <h1 className="profile-handle">{platform.name}</h1>
            <p className="profile-name">Everyone's posts in this world</p>
          </div>
        </div>
        <div className="profile-actions">
          <Link className="feed-back-link" to={`/worlds/${worldId}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            Back to world
          </Link>
        </div>
      </div>

      <div className="profile-posts">
        {loading ? (
          <p>Loading feed…</p>
        ) : posts.length === 0 ? (
          <p className="profile-empty">No posts yet.</p>
        ) : (
          posts.map((post) => (
            <Post
              key={post.id}
              post={post}
              viewerAccountId={null}
              candidateAccounts={myAccounts}
              likedAsAccountId={likedAsAccountByPost[post.id]}
              onLikedAsAccountIdChange={(accountId) =>
                setLikedAsAccountByPost((prev) => ({ ...prev, [post.id]: accountId }))
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
