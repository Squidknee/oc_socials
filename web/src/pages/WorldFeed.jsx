import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import CharacterManager from '../components/CharacterManager.jsx';

// Feed of posts for a single world, newest first.
// TODO: character switcher (post-as-character), new post composer,
// comments/likes on each post.
export default function WorldFeed() {
  const { worldId } = useParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPosts() {
      const { data, error } = await supabase
        .from('posts')
        .select('id, content, created_at, characters ( handle, display_name, avatar_url )')
        .eq('world_id', worldId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching posts:', error);
      } else {
        setPosts(data ?? []);
      }
      setLoading(false);
    }

    fetchPosts();
  }, [worldId]);

  return (
    <div style={{ padding: '1rem' }}>
      <h1>World Feed</h1>

      <CharacterManager worldId={worldId} />

      {loading ? (
        <p>Loading feed…</p>
      ) : (
        <>
          {posts.length === 0 && <p>No posts yet in this world.</p>}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {posts.map((post) => (
              <li key={post.id} style={{ borderBottom: '1px solid #eee', padding: '0.75rem 0' }}>
                <strong>@{post.characters?.handle}</strong>
                <p>{post.content}</p>
              </li>
            ))}
          </ul>
        </>
      )}
      {/* TODO: new post composer, character switcher */}
    </div>
  );
}
