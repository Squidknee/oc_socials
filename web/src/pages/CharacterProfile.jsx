import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

// A single character's profile page: bio + their posts.
export default function CharacterProfile() {
  const { characterId } = useParams();
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCharacter() {
      const { data, error } = await supabase
        .from('characters')
        .select('id, handle, display_name, bio, avatar_url')
        .eq('id', characterId)
        .single();

      if (error) {
        console.error('Error fetching character:', error);
      } else {
        setCharacter(data);
      }
      setLoading(false);
    }

    fetchCharacter();
  }, [characterId]);

  if (loading) return <p>Loading character…</p>;
  if (!character) return <p>Character not found.</p>;

  return (
    <div style={{ padding: '1rem' }}>
      <h1>{character.display_name}</h1>
      <p>@{character.handle}</p>
      <p>{character.bio}</p>
      {/* TODO: this character's posts, edit button if owned by current user */}
    </div>
  );
}
