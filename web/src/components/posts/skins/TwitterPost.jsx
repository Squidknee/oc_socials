import { Link } from 'react-router-dom';
import { formatRelativeTime } from '../../../lib/postDisplay.js';
import { usePostInteractions } from '../usePostInteractions.js';
import HashtagText from '../HashtagText.jsx';
import VerifiedBadge from '../../VerifiedBadge.jsx';
import './twitter.css';

export default function TwitterPost({ post, viewerAccountId }) {
  const account = post.platform_accounts;

  const {
    extraMedia, realLikeCount, viewerHasLiked, likeBusy, toggleLike,
    commentCount, commentsOpen, comments, toggleComments,
    newComment, setNewComment, postingComment, handleAddComment,
  } = usePostInteractions(post, viewerAccountId);

  const media = [
    ...(post.media_url ? [{ media_url: post.media_url, kind: post.media_kind ?? 'image' }] : []),
    ...extraMedia,
  ].slice(0, 4);

  const displayedLikeCount = post.base_like_count + realLikeCount;

  return (
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
          <button className="tw-action" type="button" disabled title="Not functional yet">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></svg>
            {post.retweet_count}
          </button>
          <button
            className={`tw-action${viewerHasLiked ? ' is-liked' : ''}`}
            type="button"
            onClick={toggleLike}
            disabled={!viewerAccountId || likeBusy}
            title={viewerAccountId ? undefined : 'Pick a character to act as first'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={viewerHasLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20s-7.2-4.4-9.5-9A5.4 5.4 0 0 1 12 6.2 5.4 5.4 0 0 1 21.5 11c-2.3 4.6-9.5 9-9.5 9z" />
            </svg>
            {displayedLikeCount}
          </button>
          <button className="tw-action share" type="button" disabled title="Not functional yet">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
          </button>
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
              </p>
            ))}
            <form className="tw-comment-form" onSubmit={handleAddComment}>
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={viewerAccountId ? 'Post your reply' : 'Pick a character to act as first'}
                disabled={!viewerAccountId || postingComment}
              />
              <button type="submit" disabled={!viewerAccountId || !newComment.trim() || postingComment}>
                Reply
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}
