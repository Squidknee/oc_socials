import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';
import PlatformProfile from '../components/profiles/PlatformProfile.jsx';

// A single platform account's own page (its "Instagram profile", "Twitter
// profile", etc.) — linked to from CharacterProfile's Accounts list.
export default function PlatformAccountProfile() {
  const { accountId } = useParams();
  const { user } = useAuth();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAccount() {
      const { data, error } = await supabase
        .from('platform_accounts')
        .select('id, handle, display_name, avatar_url, bio, verified, world_id, character_id, characters ( owner_id ), platforms ( * )')
        .eq('id', accountId)
        .single();

      if (error) {
        console.error('Error fetching platform account:', error);
      }
      setAccount(data ?? null);
      setLoading(false);
    }

    fetchAccount();
  }, [accountId]);

  if (loading) return <p style={{ padding: '1rem' }}>Loading…</p>;
  if (!account) return <p style={{ padding: '1rem' }}>Account not found.</p>;

  return (
    <PlatformProfile
      account={account}
      isOwner={account.characters?.owner_id === user.id}
      onAccountUpdated={setAccount}
    />
  );
}
