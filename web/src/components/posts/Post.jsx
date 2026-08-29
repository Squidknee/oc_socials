import InstagramPost from './skins/InstagramPost.jsx';
import TwitterPost from './skins/TwitterPost.jsx';

// Maps a platform's slug to the skin that knows how to render a post on
// it. The post data shape is the same regardless of platform — adding a
// new platform means adding a skin file and one entry here, not touching
// whatever already renders the others.
const SKINS = {
  instagram: InstagramPost,
  twitter: TwitterPost,
};

// candidateAccounts is optional — WorldFeed's mixed feed and
// PlatformFeedPage's single-platform timeline both supply it, since
// arriving at either doesn't establish who you're acting as. Pages that
// do have an established identity (a character's own profile) pass a
// real viewerAccountId instead and just don't pass this, and the skins
// treat an empty candidate list as "nothing to offer."
export default function Post({ post, viewerAccountId, candidateAccounts }) {
  const slug = post.platform_accounts?.platforms?.slug;
  const Skin = SKINS[slug];

  if (!Skin) {
    console.warn(`No post skin registered for platform "${slug}"`);
    return null;
  }

  return <Skin post={post} viewerAccountId={viewerAccountId} candidateAccounts={candidateAccounts} />;
}
