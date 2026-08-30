import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient.js';
import { useAuth } from '../../../lib/AuthContext.jsx';
import { fetchViewerAccountId } from '../../../lib/platformAccounts.js';
import { POST_SELECT } from '../../../lib/posts.js';
import Post from '../../posts/Post.jsx';
import PostComposer from '../../composer/PostComposer.jsx';
import VerifiedBadge from '../../VerifiedBadge.jsx';
import EditAccountForm from '../EditAccountForm.jsx';
import { useFollow } from '../useFollow.js';
import '../profiles.css';

export default function InstagramProfile({ account, isOwner, onAccountUpdated }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  // Only ever used for the Follow button below — "which of my accounts am
  // I following as" tolerates a silent first-match guess better than post
  // interactions do (see interactionAccountId below).
  const [viewerAccountId, setViewerAccountId] = useState(null);
  const [candidateAccounts, setCandidateAccounts] = useState([]);
  // This account's own page is NOT an ambiguous context the way a mixed
  // feed is — you're looking at Grant's profile, so commenting here is
  // obviously as Grant, no picker needed. isOwner already means "you can
  // act as this account" (own it, or it's public — platform_accounts_
  // update_shared/posts_insert_own_platform_account, 0029, are the real
  // enforcement). Only falls through to the candidateAccounts picker
  // (letting you reply as one of your OWN characters) when it's actually
  // someone else's account and there's a real choice to make.
  const interactionAccountId = isOwner ? account.id : null;
  // Which account each post was liked as, for the heart's filled state
  // (see Post.jsx) — same reasoning as WorldFeed/PlatformFeedPage's own
  // copy of this.
  const [likedAsAccountByPost, setLikedAsAccountByPost] = useState({});
  const { following, toggleFollow, busy: followBusy, followerCount, followingCount } = useFollow({
    followedAccountId: account.id,
    viewerAccountId,
    worldId: account.world_id,
  });

  async function fetchPosts() {
    const { data } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('platform_account_id', account.id)
      .order('created_at', { ascending: false });
    setPosts(data ?? []);
    setLoading(false);
  }

  async function fetchCandidateAccounts() {
    // Every character you own here, PLUS every public/shared character
    // (can_act_as_character, 0029, is the real enforcement) — same
    // candidate pool WorldFeed/PlatformFeedPage offer.
    const { data } = await supabase
      .from('characters')
      .select('id, display_name, avatar_url, platform_accounts ( id, platform_id )')
      .eq('world_id', account.world_id)
      .or(`owner_id.eq.${user.id},is_public.eq.true`);

    const accounts = [];
    for (const character of data ?? []) {
      for (const acc of character.platform_accounts ?? []) {
        // account.platform_id itself isn't selected anywhere this account
        // prop comes from — only the joined platforms(*) object is —
        // so this compares against the joined platform's own id instead.
        if (acc.platform_id !== account.platforms?.id) continue;
        accounts.push({
          accountId: acc.id,
          characterId: character.id,
          displayName: character.display_name,
          avatarUrl: character.avatar_url,
        });
      }
    }
    setCandidateAccounts(accounts);
  }

  useEffect(() => {
    fetchPosts();
    fetchCandidateAccounts();
    fetchViewerAccountId({ worldId: account.world_id, platformSlug: 'instagram', userId: user.id }).then(setViewerAccountId);
  }, [account.id, account.world_id, account.platforms?.id, user.id]);

  return (
    <div className="profile-page">
      <Link className="profile-crumb" to={`/characters/${account.character_id}`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        {account.characters?.display_name}{account.worlds?.name ? ` · ${account.worlds.name}` : ''}
      </Link>

      <div className="profile-tabs">
        <span className="profile-tab active">Profile</span>
        <Link className="profile-tab" to={`/worlds/${account.world_id}/platforms/instagram`}>World feed</Link>
      </div>

      <div className="profile-header">
        <div className="profile-header-main">
          <div className="profile-avatar">
            {account.avatar_url ? (
              <img src={account.avatar_url} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              account.handle?.[0]?.toUpperCase()
            )}
          </div>
          <div className="profile-info">
            <div className="profile-handle-row">
              <h1 className="profile-handle">{account.handle}</h1>
              {account.verified && <VerifiedBadge size={17} />}
              <span className="profile-platform-chip">{account.platforms?.name}</span>
            </div>
            <p className="profile-name">{account.display_name}</p>
            {account.bio && <p className="profile-bio">{account.bio}</p>}
          </div>
        </div>

        {isOwner ? (
          <div className="profile-actions">
            <button className="profile-edit-btn" type="button" onClick={() => setEditOpen((v) => !v)}>
              {editOpen ? 'Cancel' : 'Edit Profile'}
            </button>
            <button className="profile-newpost" type="button" onClick={() => setComposerOpen((v) => !v)}>
              {composerOpen ? 'Cancel' : '+ New Post'}
            </button>
          </div>
        ) : viewerAccountId && (
          <div className="profile-actions">
            <button
              className={following ? 'profile-edit-btn' : 'profile-newpost'}
              type="button"
              onClick={toggleFollow}
              disabled={followBusy}
            >
              {following ? 'Following' : 'Follow'}
            </button>
          </div>
        )}
      </div>

      {editOpen && (
        <EditAccountForm
          account={account}
          onSaved={(updated) => { onAccountUpdated?.(updated); setEditOpen(false); }}
          onCancel={() => setEditOpen(false)}
        />
      )}

      {composerOpen && (
        <PostComposer
          account={account}
          onPosted={() => { setComposerOpen(false); fetchPosts(); }}
          onCancel={() => setComposerOpen(false)}
        />
      )}

      <div className="profile-stats">
        <div className="profile-stat">
          <span className="profile-stat-value">{posts.length}</span>
          <span className="profile-stat-label">posts</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">{followerCount}</span>
          <span className="profile-stat-label">followers</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">{followingCount}</span>
          <span className="profile-stat-label">following</span>
        </div>
      </div>

      <div className="profile-posts">
        {loading ? (
          <p>Loading posts…</p>
        ) : posts.length === 0 ? (
          <p className="profile-empty">No posts yet.</p>
        ) : (
          posts.map((post) => (
            <Post
              key={post.id}
              post={post}
              viewerAccountId={interactionAccountId}
              candidateAccounts={candidateAccounts}
              likedAsAccountId={likedAsAccountByPost[post.id]}
              onLikedAsAccountIdChange={(accountId) =>
                setLikedAsAccountByPost((prev) => ({ ...prev, [post.id]: accountId }))
              }
              browsingAsAccountId={viewerAccountId}
            />
          ))
        )}
      </div>
    </div>
  );
}
