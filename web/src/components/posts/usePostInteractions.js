import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';

// Shared like/comment/media logic for every platform's post skin —
// pulled out once Twitter needed the same real likes+comments mechanic
// Instagram already had, so the two skins don't drift out of sync.
export function usePostInteractions(post, viewerAccountId) {
  const [extraMedia, setExtraMedia] = useState([]);
  const [likeRows, setLikeRows] = useState([]);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => {
    async function fetchMedia() {
      const { data } = await supabase
        .from('post_media')
        .select('media_url, kind, position')
        .eq('post_id', post.id)
        .order('position');
      setExtraMedia(data ?? []);
    }

    async function fetchLikes() {
      const { data } = await supabase
        .from('likes')
        .select('platform_account_id, platform_accounts ( display_name )')
        .eq('post_id', post.id);
      setLikeRows(data ?? []);
    }

    async function fetchCommentCount() {
      const { count } = await supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', post.id);
      setCommentCount(count ?? 0);
    }

    fetchMedia();
    fetchLikes();
    fetchCommentCount();
  }, [post.id]);

  const viewerHasLiked = viewerAccountId ? likeRows.some((r) => r.platform_account_id === viewerAccountId) : false;
  const realLikeCount = likeRows.length;

  async function toggleLike() {
    if (!viewerAccountId || likeBusy) return;
    setLikeBusy(true);

    if (viewerHasLiked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('platform_account_id', viewerAccountId);
      setLikeRows((rows) => rows.filter((r) => r.platform_account_id !== viewerAccountId));
    } else {
      await supabase.from('likes').insert({ post_id: post.id, platform_account_id: viewerAccountId });
      setLikeRows((rows) => [...rows, { platform_account_id: viewerAccountId, platform_accounts: null }]);
    }

    setLikeBusy(false);
  }

  async function loadComments() {
    const { data } = await supabase
      .from('comments')
      .select('id, content, created_at, platform_accounts ( handle )')
      .eq('post_id', post.id)
      .order('created_at');
    setComments(data ?? []);
  }

  function toggleComments() {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    if (opening && comments.length === 0) loadComments();
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!viewerAccountId || !newComment.trim()) return;
    setPostingComment(true);

    const { error } = await supabase
      .from('comments')
      .insert({ post_id: post.id, platform_account_id: viewerAccountId, content: newComment.trim() });

    setPostingComment(false);
    if (!error) {
      setNewComment('');
      setCommentCount((n) => n + 1);
      loadComments();
    }
  }

  return {
    extraMedia,
    likeRows,
    realLikeCount,
    viewerHasLiked,
    likeBusy,
    toggleLike,
    commentCount,
    commentsOpen,
    comments,
    toggleComments,
    newComment,
    setNewComment,
    postingComment,
    handleAddComment,
  };
}
