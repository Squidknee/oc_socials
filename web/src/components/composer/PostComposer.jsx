import InstagramComposer from './skins/InstagramComposer.jsx';
import TwitterComposer from './skins/TwitterComposer.jsx';

// Same dispatch pattern as Post.jsx — the composer is skinned per platform
// too, since where/how you'd write a post differs by platform (a caption
// under a photo vs. a short text box), not just how it's displayed after.
const SKINS = {
  instagram: InstagramComposer,
  twitter: TwitterComposer,
};

// post is optional — when given, the skin renders in edit mode: fields
// seed from the existing post and submit updates it instead of creating
// a new one.
export default function PostComposer({ account, post, onPosted, onCancel }) {
  const slug = account.platforms?.slug;
  const Skin = SKINS[slug];

  if (!Skin) {
    console.warn(`No composer skin registered for platform "${slug}"`);
    return null;
  }

  return <Skin account={account} post={post} onPosted={onPosted} onCancel={onCancel} />;
}
