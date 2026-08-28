import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { usePlatforms } from '../lib/PlatformsContext.jsx';
import { fetchViewerAccountId } from '../lib/platformAccounts.js';
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
  const [viewerAccountId, setViewerAccountId] = useState(null);
  const [loading, setLoading] = useState(true);

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

    fetchPosts();
    fetchViewerAccountId({ worldId, platformSlug: slug, userId: user.id }).then(setViewerAccountId);
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
          posts.map((post) => <Post key={post.id} post={post} viewerAccountId={viewerAccountId} />)
        )}
      </div>
    </div>
  );
}
