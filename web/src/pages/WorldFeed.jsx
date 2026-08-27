import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';
import CharacterManager from '../components/CharacterManager.jsx';
import Post from '../components/posts/Post.jsx';
import { fetchViewerAccountsBySlug } from '../lib/platformAccounts.js';

// Feed of posts for a single world, newest first, mixing every platform.
// TODO: proper character switcher (post-as-character) and a post composer
// entry point here — viewerAccountsBySlug is a stand-in (the user's first
// account per platform in this world) until that switcher exists.
export default function WorldFeed() {
  const { worldId } = useParams();
  const { user } = useAuth();
  const [world, setWorld] = useState(null);
  const [posts, setPosts] = useState([]);
  const [viewerAccountsBySlug, setViewerAccountsBySlug] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWorld() {
      const { data } = await supabase.from('worlds').select('name').eq('id', worldId).single();
      setWorld(data);
    }

    async function fetchPosts() {
      const { data, error } = await supabase
        .from('posts')
        .select(
          'id, content, created_at, base_like_count, retweet_count, client_label, media_url, media_kind, platform_accounts ( id, handle, display_name, avatar_url, verified, platforms ( slug, name ) )'
        )
        .eq('world_id', worldId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching posts:', error);
      } else {
        setPosts(data ?? []);
      }
      setLoading(false);
    }

    fetchWorld();
    fetchPosts();
    fetchViewerAccountsBySlug({ worldId, userId: user.id }).then(setViewerAccountsBySlug);
  }, [worldId, user.id]);

  return (
    <div style={{ padding: '1rem' }}>
      <h1>{world?.name ?? 'World Feed'}</h1>

      <CharacterManager worldId={worldId} />

      {loading ? (
        <p>Loading feed…</p>
      ) : (
        <>
          {posts.length === 0 && <p>No posts yet in this world.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            {posts.map((post) => (
              <Post
                key={post.id}
                post={post}
                viewerAccountId={viewerAccountsBySlug[post.platform_accounts?.platforms?.slug] ?? null}
              />
            ))}
          </div>
        </>
      )}
      {/* TODO: new post composer, character switcher */}
    </div>
  );
}
