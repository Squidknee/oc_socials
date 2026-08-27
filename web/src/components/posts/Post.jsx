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

export default function Post({ post, viewerAccountId }) {
  const slug = post.platform_accounts?.platforms?.slug;
  const Skin = SKINS[slug];

  if (!Skin) {
    console.warn(`No post skin registered for platform "${slug}"`);
    return null;
  }

  return <Skin post={post} viewerAccountId={viewerAccountId} />;
}
