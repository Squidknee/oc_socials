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
//
// likedAsAccountId/onLikedAsAccountIdChange are the same idea applied to
// the heart's filled state specifically: a candidateAccounts page has no
// fixed viewerAccountId to compare against after a picked character
// likes a post, so the CALLING PAGE remembers "which account did I like
// this post as" per post id and feeds it back in here — kept at the page
// level (not local to this post's own component) so it survives the
// list re-rendering/reordering and only actually resets when the page
// itself unmounts or the browser reloads.
export default function Post({ post, viewerAccountId, candidateAccounts, likedAsAccountId, onLikedAsAccountIdChange }) {
  const slug = post.platform_accounts?.platforms?.slug;
  const Skin = SKINS[slug];

  if (!Skin) {
    console.warn(`No post skin registered for platform "${slug}"`);
    return null;
  }

  return (
    <Skin
      post={post}
      viewerAccountId={viewerAccountId}
      candidateAccounts={candidateAccounts}
      likedAsAccountId={likedAsAccountId}
      onLikedAsAccountIdChange={onLikedAsAccountIdChange}
    />
  );
}
