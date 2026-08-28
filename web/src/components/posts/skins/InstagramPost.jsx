import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient.js';
import { useAuth } from '../../../lib/AuthContext.jsx';
import { formatRelativeTime } from '../../../lib/postDisplay.js';
import { usePostInteractions } from '../usePostInteractions.js';
import HashtagText from '../HashtagText.jsx';
import VerifiedBadge from '../../VerifiedBadge.jsx';
import PostComposer from '../../composer/PostComposer.jsx';
import '../posts.css';

// Renders one post the way this world's "Instagram" would show it.
export default function InstagramPost({ post: postProp, viewerAccountId }) {
  const { user } = useAuth();
  // Local copy so a successful edit reflects immediately without needing
  // to thread an update callback up through every page that renders a
  // post list — same "isolated, self-contained" reasoning as the rest of
  // this component's own state.
  const [post, setPost] = useState(postProp);
  useEffect(() => setPost(postProp), [postProp]);

  const account = post.platform_accounts;
  // True ownership, not viewerAccountId — that's "which account you're
  // acting as" for likes/comments, and can be a different character than
  // this post's author even when you own both (no real character
  // switcher yet).
  const isOwnPost = account?.characters?.owner_id === user.id;
  const [mediaIndex, setMediaIndex] = useState(0);
  const [likedByName, setLikedByName] = useState(null);
  const [editing, setEditing] = useState(false);

  const {
    extraMedia, realLikeCount, viewerHasLiked, likeBusy, toggleLike, likeRows,
    commentCount, commentsOpen, comments, toggleComments,
    newComment, setNewComment, postingComment, handleAddComment,
  } = usePostInteractions(post, viewerAccountId);

  // "Liked by" prefers someone the viewer actually follows, so it reads as
  // a genuine social signal rather than a random name — Instagram-only,
  // since Twitter's spec didn't call for this.
  useEffect(() => {
    async function fetchLikedByFollow() {
      if (!viewerAccountId || likeRows.length === 0) {
        setLikedByName(null);
        return;
      }
      const { data: followed } = await supabase
        .from('follows')
        .select('followed_account_id')
        .eq('follower_account_id', viewerAccountId)
        .in('followed_account_id', likeRows.map((r) => r.platform_account_id));

      const followedIds = new Set((followed ?? []).map((f) => f.followed_account_id));
      const match = likeRows.find((r) => followedIds.has(r.platform_account_id));
      setLikedByName(match?.platform_accounts?.display_name ?? null);
    }
    fetchLikedByFollow();
  }, [viewerAccountId, likeRows]);

  const media = [
    ...(post.media_url ? [{ media_url: post.media_url, kind: post.media_kind ?? 'image' }] : []),
    ...extraMedia,
  ];
  const current = media[mediaIndex];
  const displayedLikeCount = post.base_like_count + realLikeCount;

  return (
    <>
    <article className="ig-post">
      <header className="ig-post-header">
        <Link className="ig-post-avatar" to={`/accounts/${account?.id}`}>
          {account?.avatar_url ? (
            <img src={account.avatar_url} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            account?.handle?.[0]?.toUpperCase()
          )}
        </Link>
        <div className="ig-post-headerinfo">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Link className="ig-post-handle" to={`/accounts/${account?.id}`}>{account?.handle}</Link>
            {account?.verified && <VerifiedBadge size={13} />}
          </span>
          <span className="ig-post-time">{formatRelativeTime(post.created_at)}</span>
        </div>
        <span className="ig-platform-chip">{account?.platforms?.name}</span>
      </header>

      {current && (
        <div className="ig-post-media">
          {current.kind === 'video' ? (
            <video src={current.media_url} controls />
          ) : (
            <img src={current.media_url} alt="" />
          )}
          {media.length > 1 && (
            <>
              <button className="ig-carousel-nav prev" type="button" onClick={() => setMediaIndex((i) => (i - 1 + media.length) % media.length)} aria-label="Previous">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button className="ig-carousel-nav next" type="button" onClick={() => setMediaIndex((i) => (i + 1) % media.length)} aria-label="Next">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
              </button>
              <span className="ig-carousel-counter">{mediaIndex + 1}/{media.length}</span>
              <div className="ig-carousel-dots">
                {media.map((_, i) => (
                  <span key={i} className={`ig-carousel-dot${i === mediaIndex ? ' active' : ''}`} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="ig-post-actions">
        <button className={`ig-action-btn${viewerHasLiked ? ' is-liked' : ''}`} type="button" onClick={toggleLike} disabled={!viewerAccountId || likeBusy} title={viewerAccountId ? undefined : 'Pick a character to act as first'}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill={viewerHasLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20s-7.2-4.4-9.5-9A5.4 5.4 0 0 1 12 6.2 5.4 5.4 0 0 1 21.5 11c-2.3 4.6-9.5 9-9.5 9z" />
          </svg>
          {displayedLikeCount}
        </button>
        <button className="ig-action-btn" type="button" onClick={toggleComments}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H8l-4 4V5z" /></svg>
          {commentCount}
        </button>
        <button className="ig-action-btn" type="button" disabled title="Not functional yet">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></svg>
        </button>
        <button className="ig-action-btn share" type="button" disabled title="Not functional yet">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
        </button>
        {isOwnPost && (
          <button className="ig-action-btn" type="button" onClick={() => setEditing((v) => !v)} aria-label="Edit post" title="Edit post">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L20 8l-4-4L4 16z" /></svg>
          </button>
        )}
      </div>

      <p className="ig-post-likes">
        {likedByName
          ? `Liked by ${likedByName}${displayedLikeCount > 1 ? ` and ${displayedLikeCount - 1} others` : ''}`
          : `${displayedLikeCount} like${displayedLikeCount === 1 ? '' : 's'}`}
      </p>

      {post.content && (
        <p className="ig-post-caption">
          <strong>{account?.handle}</strong> <HashtagText text={post.content} />
        </p>
      )}

      <button className="ig-post-comments-toggle" type="button" onClick={toggleComments}>
        {commentCount > 0 ? `View all ${commentCount} comments` : 'No comments yet'}
      </button>

      {commentsOpen && (
        <div className="ig-post-comments">
          {comments.map((c) => (
            <p className="ig-post-comment" key={c.id}>
              <span className="ig-comment-avatar">
                {c.platform_accounts?.avatar_url ? (
                  <img src={c.platform_accounts.avatar_url} alt="" />
                ) : (
                  c.platform_accounts?.handle?.[0]?.toUpperCase()
                )}
              </span>
              <span>
                <strong>{c.platform_accounts?.handle}</strong> {c.content}
              </span>
            </p>
          ))}
          <form className="ig-comment-form" onSubmit={handleAddComment}>
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={viewerAccountId ? 'Add a comment…' : 'Pick a character to act as first'}
              disabled={!viewerAccountId || postingComment}
            />
            <button type="submit" disabled={!viewerAccountId || !newComment.trim() || postingComment}>
              Post
            </button>
          </form>
        </div>
      )}
    </article>

    {editing && (
      <PostComposer
        account={account}
        post={post}
        onPosted={(updated) => {
          setPost((prev) => ({ ...prev, ...updated }));
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    )}
    </>
  );
}
