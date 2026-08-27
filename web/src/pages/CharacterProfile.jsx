import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { downloadCharacterFile } from '../lib/characterFile.js';
import VerifiedBadge from '../components/VerifiedBadge.jsx';

function getInitials(name) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// A single character's profile page: their master identity, plus one
// account card per platform they have a presence on (Instagram, Twitter,
// ...). Each account's own posts live behind that platform's own page,
// not mixed together here — this profile is the index into them, not a
// feed itself. Messaging-kind platforms (iMessage) aren't listed since
// DMs are private, not something a visiting world member browses.
export default function CharacterProfile() {
  const { characterId } = useParams();
  const { user } = useAuth();
  const [character, setCharacter] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCharacter() {
      const { data, error } = await supabase
        .from('characters')
        .select('id, handle, display_name, bio, avatar_url, owner_id')
        .eq('id', characterId)
        .single();

      if (error) {
        console.error('Error fetching character:', error);
      } else {
        setCharacter(data);
      }
      setLoading(false);
    }

    async function fetchAccounts() {
      const { data, error } = await supabase
        .from('platform_accounts')
        .select('id, handle, avatar_url, verified, platforms ( name, slug )')
        .eq('character_id', characterId);

      if (error) {
        console.error('Error fetching platform accounts:', error);
      } else {
        setAccounts(data ?? []);
      }
    }

    fetchCharacter();
    fetchAccounts();
  }, [characterId]);

  if (loading) return <p>Loading character…</p>;
  if (!character) return <p>Character not found.</p>;

  return (
    <div className="page-center">
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        <div className="panel">
          <div className="header-top">
            <div className="avatar">
              {character.avatar_url ? (
                <img src={character.avatar_url} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
              ) : (
                getInitials(character.display_name)
              )}
            </div>
            <div className="identity">
              <h1 className="display-name">{character.display_name}</h1>
              <p className="handle">@{character.handle}</p>
            </div>
            {character.owner_id === user.id && (
              <div className="icon-actions">
                <button className="icon-btn" type="button" aria-label="Export character" onClick={() => downloadCharacterFile(character)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
                </button>
              </div>
            )}
          </div>
          {character.bio && <p className="bio">{character.bio}</p>}
        </div>

        <span className="section-label">Accounts</span>

        <div className="account-list">
          {accounts.length === 0 && <p style={{ color: 'rgba(255,255,255,0.6)' }}>No platform accounts yet.</p>}
          {accounts.map((account) => (
            <Link className="account-card" to={`/accounts/${account.id}`} key={account.id}>
              <div className="account-avatar">
                {account.avatar_url ? (
                  <img src={account.avatar_url} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
                ) : (
                  getInitials(character.display_name)
                )}
              </div>
              <div className="account-info">
                <span className="platform-chip">{account.platforms?.name}</span>
                <span className="account-handle" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  @{account.handle}
                  {account.verified && <VerifiedBadge size={13} />}
                </span>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
