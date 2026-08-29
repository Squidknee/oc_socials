import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient.js';
import { useAuth } from '../../../lib/AuthContext.jsx';
import { formatRelativeTime, formatCount } from '../../../lib/postDisplay.js';
import { usePostInteractions } from '../usePostInteractions.js';
import HashtagText from '../HashtagText.jsx';
import VerifiedBadge from '../../VerifiedBadge.jsx';
import PostComposer from '../../composer/PostComposer.jsx';
import './twitter.css';

export default function TwitterPost({ post: postProp, viewerAccountId, candidateAccounts = [] }) {
  const { user } = useAuth();
  // Local copy so a successful edit reflects immediately without needing
  // to thread an update callback up through every page that renders a
  // post list.
  const [post, setPost] = useState(postProp);
  useEffect(() => setPost(postProp), [postProp]);

  const account = post.platform_accounts;
  // True ownership, not viewerAccountId — that's "which account you're
  // acting as" for likes/comments, and can be a different character than
  // this post's author even when you own both (no real character
  // switcher yet).
  const isOwnPost = account?.characters?.owner_id === user.id;
  const [editing, setEditing] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Nothing here ever persists a chosen account — every like/comment
  // interaction prompts fresh, by design (World overview's per-post
  // picker, not a switcher you set once). pendingAction tracks which
  // interaction the dropdown is currently answering for, since liking
  // and commenting react to a pick differently: a like fires immediately,
  // a comment just unlocks the input for one submission.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'like' | 'comment'
  const [commentAsAccountId, setCommentAsAccountId] = useState(null);
  const canPickAccount = !viewerAccountId && candidateAccounts.length > 0;
  const effectiveCommentAccountId = viewerAccountId ?? commentAsAccountId;

  function pickAccount(accountId) {
    setPickerOpen(false);
    if (pendingAction === 'like') toggleLike(accountId);
    else if (pendingAction === 'comment') setCommentAsAccountId(accountId);
    setPendingAction(null);
  }

  const {
    extraMedia, realLikeCount, viewerHasLiked, likeBusy, toggleLike,
    commentCount, commentsOpen, comments, toggleComments,
    newComment, setNewComment, postingComment, handleAddComment, deleteComment,
  } = usePostInteractions(post, viewerAccountId);

  function handleLikeClick() {
    if (canPickAccount) {
      setPendingAction('like');
      setPickerOpen((v) => !v);
      return;
    }
    toggleLike();
  }

  function handleCommentInputFocus(e) {
    if (!effectiveCommentAccountId && candidateAccounts.length > 0) {
      e.target.blur();
      setPendingAction('comment');
      setPickerOpen(true);
    }
  }

  async function submitComment(e) {
    await handleAddComment(e, effectiveCommentAccountId);
    // Forgotten immediately after use — the next comment has to pick again.
    setCommentAsAccountId(null);
  }

  async function handleDelete() {
    const confirmed = window.confirm("Delete this post? This can't be undone.");
    if (!confirmed) return;

    setDeleting(true);
    // posts_delete_own_platform_account (0024) is the real enforcement;
    // comments/likes/post_media all cascade-delete from here.
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    setDeleting(false);

    if (error) {
      alert(`Couldn't delete post: ${error.message}`);
      return;
    }
    setDeleted(true);
  }

  // Every hook above must run every render regardless — only bail out to
  // nothing once React's own bookkeeping for this render is done.
  if (deleted) return null;

  const media = [
    ...(post.media_url ? [{ media_url: post.media_url, kind: post.media_kind ?? 'image' }] : []),
    ...extraMedia,
  ].slice(0, 4);

  const displayedLikeCount = post.base_like_count + realLikeCount;

  return (
    <>
    <article className="tw-post">
      <Link className="tw-post-avatar" to={`/accounts/${account?.id}`}>
        {account?.avatar_url ? (
          <img src={account.avatar_url} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
        ) : (
          account?.handle?.[0]?.toUpperCase()
        )}
      </Link>

      <div className="tw-post-body">
        <div className="tw-post-header">
          <div className="tw-post-identity">
            <div className="tw-post-nameline">
              <Link className="tw-post-name" to={`/accounts/${account?.id}`}>{account?.display_name}</Link>
              {account?.verified && <VerifiedBadge size={14} />}
            </div>
            <div className="tw-post-metaline">
              <Link className="tw-post-handle" to={`/accounts/${account?.id}`}>@{account?.handle}</Link>
              <span className="tw-post-dot" />
              <span>{formatRelativeTime(post.created_at)}</span>
              {post.client_label && (
                <>
                  <span className="tw-post-dot" />
                  <span>{post.client_label}</span>
                </>
              )}
            </div>
          </div>
          <span className="tw-platform-chip">{account?.platforms?.name}</span>
        </div>

        {post.content && (
          <p className="tw-post-text">
            <HashtagText text={post.content} />
          </p>
        )}

        {media.length > 0 && (
          <div className={`tw-post-media count-${media.length}`}>
            {media.map((item, i) =>
              item.kind === 'video' ? (
                <video key={i} src={item.media_url} controls />
              ) : (
                <img key={i} src={item.media_url} alt="" />
              )
            )}
          </div>
        )}

        <div className="tw-post-actions">
          <button className="tw-action" type="button" onClick={toggleComments}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H8l-4 4V5z" /></svg>
            {commentCount}
          </button>
          <button className="tw-action reblog" type="button" disabled title="Not functional yet">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></svg>
            {formatCount(post.retweet_count)}
          </button>
          <button
            className={`tw-action${viewerHasLiked ? ' is-liked' : ''}`}
            type="button"
            onClick={handleLikeClick}
            disabled={(!viewerAccountId && !canPickAccount) || likeBusy}
            title={viewerAccountId ? undefined : canPickAccount ? 'Pick a character to act as' : 'Pick a character to act as first'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={viewerHasLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20s-7.2-4.4-9.5-9A5.4 5.4 0 0 1 12 6.2 5.4 5.4 0 0 1 21.5 11c-2.3 4.6-9.5 9-9.5 9z" />
            </svg>
            {formatCount(displayedLikeCount)}
          </button>
          <button className="tw-action share" type="button" disabled title="Not functional yet">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
          </button>
          {isOwnPost && (
            <>
              <button className="tw-action" type="button" onClick={() => setEditing((v) => !v)} aria-label="Edit post" title="Edit post">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L20 8l-4-4L4 16z" /></svg>
              </button>
              <button className="tw-action" type="button" onClick={handleDelete} disabled={deleting} aria-label="Delete post" title="Delete post">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 13h10l1-13" /></svg>
              </button>
            </>
          )}

          {pickerOpen && (
            <div className="tw-account-dropdown">
              <span className="tw-account-dropdown-label">Act as</span>
              {candidateAccounts.map((c) => (
                <button key={c.accountId} type="button" className="tw-account-dropdown-item" onClick={() => pickAccount(c.accountId)}>
                  <span className="tw-account-dropdown-avatar">
                    {c.avatarUrl ? <img src={c.avatarUrl} alt="" /> : c.displayName?.[0]?.toUpperCase()}
                  </span>
                  {c.displayName}
                </button>
              ))}
            </div>
          )}
        </div>

        {commentsOpen && (
          <div className="tw-post-comments">
            {comments.map((c) => (
              <p className="tw-post-comment" key={c.id}>
                <span className="tw-comment-avatar">
                  {c.platform_accounts?.avatar_url ? (
                    <img src={c.platform_accounts.avatar_url} alt="" />
                  ) : (
                    c.platform_accounts?.handle?.[0]?.toUpperCase()
                  )}
                </span>
                <span>
                  <strong>{c.platform_accounts?.handle}</strong> {c.content}
                </span>
                {c.platform_accounts?.characters?.owner_id === user.id && (
                  <button className="tw-comment-delete" type="button" onClick={() => deleteComment(c.id)} aria-label="Delete comment" title="Delete comment">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                  </button>
                )}
              </p>
            ))}
            <form className="tw-comment-form" onSubmit={submitComment}>
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onFocus={handleCommentInputFocus}
                placeholder={effectiveCommentAccountId ? 'Post your reply' : candidateAccounts.length > 0 ? 'Pick a character to act as' : 'Pick a character to act as first'}
                disabled={(!effectiveCommentAccountId && candidateAccounts.length === 0) || postingComment}
              />
              <button type="submit" disabled={!effectiveCommentAccountId || !newComment.trim() || postingComment}>
                Reply
              </button>
            </form>
          </div>
        )}
      </div>
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
