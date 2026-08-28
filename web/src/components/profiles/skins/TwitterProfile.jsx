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

export default function TwitterProfile({ account, isOwner, onAccountUpdated }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewerAccountId, setViewerAccountId] = useState(null);
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

  useEffect(() => {
    fetchPosts();
    fetchViewerAccountId({ worldId: account.world_id, platformSlug: 'twitter', userId: user.id }).then(setViewerAccountId);
  }, [account.id, account.world_id, user.id]);

  return (
    <div className="profile-page">
      <Link className="profile-crumb" to={`/characters/${account.character_id}`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        {account.characters?.display_name}{account.worlds?.name ? ` · ${account.worlds.name}` : ''}
      </Link>

      <div className="profile-tabs">
        <span className="profile-tab active">Profile</span>
        <Link className="profile-tab" to={`/worlds/${account.world_id}/platforms/twitter`}>World feed</Link>
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
              <h1 className="profile-handle">{account.display_name}</h1>
              {account.verified && <VerifiedBadge size={17} />}
              <span className="profile-platform-chip">{account.platforms?.name}</span>
            </div>
            <p className="profile-name">@{account.handle}</p>
            {account.bio && <p className="profile-bio">{account.bio}</p>}
          </div>
        </div>

        {isOwner ? (
          <div className="profile-actions">
            <button className="profile-edit-btn" type="button" onClick={() => setEditOpen((v) => !v)}>
              {editOpen ? 'Cancel' : 'Edit Profile'}
            </button>
            <button className="profile-newpost" type="button" onClick={() => setComposerOpen((v) => !v)}>
              {composerOpen ? 'Cancel' : '+ New Tweet'}
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
          <p>Loading tweets…</p>
        ) : posts.length === 0 ? (
          <p className="profile-empty">No tweets yet.</p>
        ) : (
          posts.map((post) => <Post key={post.id} post={post} viewerAccountId={viewerAccountId} />)
        )}
      </div>
    </div>
  );
}
