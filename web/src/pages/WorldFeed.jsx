import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { usePlatforms } from '../lib/PlatformsContext.jsx';
import CharacterManager from '../components/CharacterManager.jsx';

// Hub for a world: links into each platform's own world-wide feed, plus
// managing your own characters here. Actual posts live on each platform's
// feed page (PlatformFeedPage) and profile pages, not mixed into a single
// list here.
export default function WorldFeed() {
  const { worldId } = useParams();
  const { platforms } = usePlatforms();
  const [world, setWorld] = useState(null);

  useEffect(() => {
    async function fetchWorld() {
      const { data } = await supabase.from('worlds').select('name').eq('id', worldId).single();
      setWorld(data);
    }

    fetchWorld();
  }, [worldId]);

  const feedPlatforms = platforms.filter((p) => p.kind === 'feed');

  return (
    <div style={{ padding: '1rem' }}>
      <h1>{world?.name ?? 'World'}</h1>

      <span className="section-label">Platforms</span>
      <div className="account-list" style={{ marginBottom: '1.5rem', marginTop: '0.5rem' }}>
        {feedPlatforms.map((platform) => (
          <Link className="account-card" to={`/worlds/${worldId}/platforms/${platform.slug}`} key={platform.id}>
            <div className="account-info">
              <span className="platform-chip">{platform.name}</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </Link>
        ))}
      </div>

      <CharacterManager worldId={worldId} />
    </div>
  );
}
