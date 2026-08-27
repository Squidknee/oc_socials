import InstagramProfile from './skins/InstagramProfile.jsx';
import TwitterProfile from './skins/TwitterProfile.jsx';

// Same dispatch pattern as Post.jsx and PostComposer.jsx — a platform
// account's profile is rendered by whichever skin matches its platform.
const SKINS = {
  instagram: InstagramProfile,
  twitter: TwitterProfile,
};

export default function PlatformProfile({ account, isOwner, onAccountUpdated }) {
  const slug = account.platforms?.slug;
  const Skin = SKINS[slug];

  if (!Skin) {
    console.warn(`No profile skin registered for platform "${slug}"`);
    return null;
  }

  return <Skin account={account} isOwner={isOwner} onAccountUpdated={onAccountUpdated} />;
}
