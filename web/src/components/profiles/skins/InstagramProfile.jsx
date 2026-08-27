import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient.js';
import { useAuth } from '../../../lib/AuthContext.jsx';
import { fetchViewerAccountId } from '../../../lib/platformAccounts.js';
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
  // Same stand-in as WorldFeed: not necessarily this account itself — the
  // real user's OWN Instagram account in this world, whoever's profile
  // they're currently looking at, so they can like/comment as themselves.
  const [viewerAccountId, setViewerAccountId] = useState(null);
  const { following, toggleFollow, busy: followBusy } = useFollow({
    followedAccountId: account.id,
    viewerAccountId,
    worldId: account.world_id,
  });

  async function fetchPosts() {
    const { data } = await supabase
      .from('posts')
      .select(
        'id, content, created_at, base_like_count, media_url, media_kind, platform_accounts ( id, handle, display_name, avatar_url, verified, platforms ( slug, name ) )'
      )
      .eq('platform_account_id', account.id)
      .order('created_at', { ascending: false });
    setPosts(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchPosts();
    fetchViewerAccountId({ worldId: account.world_id, platformSlug: 'instagram', userId: user.id }).then(setViewerAccountId);
  }, [account.id, account.world_id, user.id]);

  return (
    <div className="profile-page">
      <div className="profile-tabs">
        <span className="profile-tab active">Profile</span>
        <Link className="profile-tab" to={`/worlds/${account.world_id}/platforms/instagram`}>Feed</Link>
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
            </div>
            <p className="profile-name">{account.display_name}</p>
            {account.bio && <p className="profile-bio">{account.bio}</p>}
            <p className="profile-count">{posts.length} post{posts.length === 1 ? '' : 's'}</p>
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

      <div className="profile-posts">
        {loading ? (
          <p>Loading posts…</p>
        ) : posts.length === 0 ? (
          <p className="profile-empty">No posts yet.</p>
        ) : (
          posts.map((post) => <Post key={post.id} post={post} viewerAccountId={viewerAccountId} />)
        )}
      </div>
    </div>
  );
}
