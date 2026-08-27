import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { useAuth } from './AuthContext.jsx';

// Fetches the `platforms` table (Instagram/Twitter/iMessage + their
// feature flags) ONCE per app session and shares it via context, instead
// of every component that needs a platform's config running its own
// query. This is the same "fetch once, read many times" pattern as
// AuthContext — platforms rarely change, so there's no need to re-fetch
// per component.
const PlatformsContext = createContext(null);

export function PlatformsProvider({ children }) {
  const { user } = useAuth();
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);

  // The RLS policy on `platforms` requires an authenticated request, so
  // re-run the fetch once `user` actually becomes available — this
  // provider sits above the whole app (including /login), and would
  // otherwise try to fetch before anyone's logged in and get nothing back.
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchPlatforms() {
      setLoading(true);
      const { data, error } = await supabase.from('platforms').select('*');

      if (error) {
        console.error('Error fetching platforms:', error);
      } else {
        setPlatforms(data ?? []);
      }
      setLoading(false);
    }

    fetchPlatforms();
  }, [user]);

  // Look up a platform by its slug (e.g. "instagram") instead of by its
  // raw UUID everywhere in the app — reads better and avoids scattering
  // literal UUID strings across components.
  function getPlatform(slug) {
    return platforms.find((p) => p.slug === slug) ?? null;
  }

  return (
    <PlatformsContext.Provider value={{ platforms, loading, getPlatform }}>
      {children}
    </PlatformsContext.Provider>
  );
}

export function usePlatforms() {
  const ctx = useContext(PlatformsContext);
  if (!ctx) throw new Error('usePlatforms must be used within a PlatformsProvider');
  return ctx;
}
