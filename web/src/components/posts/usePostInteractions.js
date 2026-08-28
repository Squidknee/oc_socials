import { useEffect, useRef, useState } from 'react';
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

  // Lets the comments realtime handler (subscribed once per post.id, not
  // once per open/close) read the current panel state without needing to
  // resubscribe every time it's toggled.
  const commentsOpenRef = useRef(commentsOpen);
  useEffect(() => {
    commentsOpenRef.current = commentsOpen;
  }, [commentsOpen]);

  // Comment ids already counted (by either the poster's own optimistic
  // update or an earlier realtime event) — a plain count has no "have I
  // seen this row" check the way likeRows' own list does, so this stands
  // in for one to stop your own comment being counted twice.
  const seenCommentIds = useRef(new Set());

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
        .select('id, platform_account_id, platform_accounts ( display_name )')
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

  // Live likes: messages_select_participant's counterpart here is
  // likes_select_member (0001) — unchanged, still the real gate on what
  // this client receives. INSERT is deduped against likeRows by id since
  // toggleLike already adds your own like optimistically.
  useEffect(() => {
    const channel = supabase
      .channel(`likes:${post.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'likes', filter: `post_id=eq.${post.id}` },
        (payload) => {
          setLikeRows((rows) =>
            rows.some((r) => r.id === payload.new.id)
              ? rows
              : [...rows, { id: payload.new.id, platform_account_id: payload.new.platform_account_id, platform_accounts: null }]
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'likes', filter: `post_id=eq.${post.id}` },
        (payload) => {
          setLikeRows((rows) => rows.filter((r) => r.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [post.id]);

  // Live comments: only refetches the full (joined) list when the panel
  // is actually open — otherwise just bumps the count, same cost as the
  // original head-count-only fetch.
  useEffect(() => {
    const channel = supabase
      .channel(`comments:${post.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${post.id}` },
        (payload) => {
          if (seenCommentIds.current.has(payload.new.id)) return;
          seenCommentIds.current.add(payload.new.id);
          setCommentCount((n) => n + 1);
          if (commentsOpenRef.current) loadComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      // Needs the real row back (not just an optimistic placeholder) so
      // the live INSERT echo for this same like can recognize it by id
      // and skip re-adding it.
      const { data } = await supabase
        .from('likes')
        .insert({ post_id: post.id, platform_account_id: viewerAccountId })
        .select('id, platform_account_id, platform_accounts ( display_name )')
        .single();
      if (data) setLikeRows((rows) => [...rows, data]);
    }

    setLikeBusy(false);
  }

  async function loadComments() {
    const { data } = await supabase
      .from('comments')
      .select('id, content, created_at, platform_accounts ( handle, avatar_url )')
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

    // Needs the real row's id back so it can be marked "seen" before the
    // live INSERT echo for this same comment arrives — otherwise it'd get
    // counted twice, once here and once by the realtime handler.
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: post.id, platform_account_id: viewerAccountId, content: newComment.trim() })
      .select('id')
      .single();

    setPostingComment(false);
    if (!error) {
      setNewComment('');
      if (data && !seenCommentIds.current.has(data.id)) {
        seenCommentIds.current.add(data.id);
        setCommentCount((n) => n + 1);
      }
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
