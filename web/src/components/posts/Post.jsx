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

// candidateAccounts is optional — only WorldFeed's mixed feed supplies
// it, for its per-interaction "act as" picker. Pages with a
// single-platform default viewerAccountId just don't pass it, and the
// skins treat an empty candidate list as "nothing to offer."
export default function Post({ post, viewerAccountId, candidateAccounts }) {
  const slug = post.platform_accounts?.platforms?.slug;
  const Skin = SKINS[slug];

  if (!Skin) {
    console.warn(`No post skin registered for platform "${slug}"`);
    return null;
  }

  return <Skin post={post} viewerAccountId={viewerAccountId} candidateAccounts={candidateAccounts} />;
}
