import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

// Lists worlds the logged-in user is a member of.
// TODO: add "join via invite code" and "create world" flows.
export default function WorldSelector() {
  const [worlds, setWorlds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWorlds() {
      const { data, error } = await supabase
        .from('worlds')
        .select('id, name, description');

      if (error) {
        console.error('Error fetching worlds:', error);
      } else {
        setWorlds(data ?? []);
      }
      setLoading(false);
    }

    fetchWorlds();
  }, []);

  if (loading) return <p>Loading worlds…</p>;

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Your Worlds</h1>
      {worlds.length === 0 && <p>You haven't joined any worlds yet.</p>}
      <ul>
        {worlds.map((world) => (
          <li key={world.id}>
            <Link to={`/worlds/${world.id}`}>{world.name}</Link>
          </li>
        ))}
      </ul>
      {/* TODO: button to redeem an invite code, button to create a new world */}
    </div>
  );
}
