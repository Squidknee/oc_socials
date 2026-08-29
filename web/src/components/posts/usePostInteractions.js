import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';

// Shared like/comment/media logic for every platform's post skin —
// pulled out once Twitter needed the same real likes+comments mechanic
// Instagram already had, so the two skins don't drift out of sync.
//
// likedAsAccountId/onLikedAsAccountIdChange are only supplied by pages
// with no fixed viewerAccountId (World overview, platform feeds) — there,
// nothing here would otherwise have anything to compare likeRows against
// after a picked character likes a post, and the heart would never fill
// in. Lifting this to the CALLING PAGE (rather than keeping it as local
// state in this hook) means it survives this post's own component
// remounting/re-rendering for any reason, and only actually resets when
// the page itself unmounts (navigating away) or the browser reloads —
// not some incidental side effect of how the list happens to re-render.
export function usePostInteractions(post, viewerAccountId, { likedAsAccountId, onLikedAsAccountIdChange } = {}) {
  const effectiveLikedAsAccountId = likedAsAccountId ?? viewerAccountId;
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
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'comments', filter: `post_id=eq.${post.id}` },
        (payload) => {
          // The sole place commentCount is decremented — deleteComment
          // below relies on this same event firing for its own deletion
          // too (RLS lets you see your own writes), rather than also
          // decrementing itself. seenCommentIds has no record of comments
          // loaded before this component mounted (fetchCommentCount only
          // ever got a number, never ids), so a dedupe-by-seen check here
          // would silently skip decrementing exactly those — simpler and
          // correct to just always decrement once, in this one spot.
          setCommentCount((n) => Math.max(0, n - 1));
          setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [post.id]);

  const viewerHasLiked = effectiveLikedAsAccountId
    ? likeRows.some((r) => r.platform_account_id === effectiveLikedAsAccountId)
    : false;
  const realLikeCount = likeRows.length;

  // overrideAccountId lets a caller act as a character it just picked for
  // this one action (World overview's per-interaction "act as" picker),
  // without needing viewerAccountId itself to become a persistent choice.
  // Every other page just calls toggleLike() and gets the old behavior.
  async function toggleLike(overrideAccountId) {
    const accountId = overrideAccountId ?? viewerAccountId;
    if (!accountId || likeBusy) return;
    setLikeBusy(true);
    onLikedAsAccountIdChange?.(accountId);

    // Checked against likeRows (not re-fetched) so this never fires a
    // redundant insert for an account that's already liked — the local
    // state IS kept honest with the database below, by only ever
    // applying an optimistic change once its own request actually
    // succeeded, instead of assuming success and reconciling afterward.
    const hasLiked = likeRows.some((r) => r.platform_account_id === accountId);
    if (hasLiked) {
      const { error } = await supabase.from('likes').delete().eq('post_id', post.id).eq('platform_account_id', accountId);
      if (!error) setLikeRows((rows) => rows.filter((r) => r.platform_account_id !== accountId));
    } else {
      // Needs the real row back (not just an optimistic placeholder) so
      // the live INSERT echo for this same like can recognize it by id
      // and skip re-adding it.
      const { data, error } = await supabase
        .from('likes')
        .insert({ post_id: post.id, platform_account_id: accountId })
        .select('id, platform_account_id, platform_accounts ( display_name )')
        .single();
      if (data) setLikeRows((rows) => [...rows, data]);
      // 23505 = unique_violation — a like row for this account already
      // exists (likeRows was stale), so this account really is liked;
      // reflect that instead of leaving the heart looking unliked.
      else if (error?.code === '23505') {
        const { data: existing } = await supabase
          .from('likes')
          .select('id, platform_account_id, platform_accounts ( display_name )')
          .eq('post_id', post.id)
          .eq('platform_account_id', accountId)
          .maybeSingle();
        if (existing) setLikeRows((rows) => (rows.some((r) => r.id === existing.id) ? rows : [...rows, existing]));
      }
    }

    setLikeBusy(false);
  }

  async function loadComments() {
    // characters ( owner_id ) is what a delete button actually gates on —
    // same reasoning as posts' isOwnPost: viewerAccountId is "which
    // account you're acting as," not true ownership, and this app has no
    // real character switcher yet.
    const { data } = await supabase
      .from('comments')
      .select('id, content, created_at, platform_accounts ( handle, avatar_url, characters ( owner_id ) )')
      .eq('post_id', post.id)
      .order('created_at');
    setComments(data ?? []);
  }

  async function deleteComment(commentId) {
    // comments_delete_own_platform_account (0026) is the real
    // enforcement. commentCount isn't touched here — the realtime DELETE
    // handler above does it, since it fires for this deletion too and is
    // the one place that avoids double-decrementing.
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) {
      alert(`Couldn't delete comment: ${error.message}`);
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  function toggleComments() {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    if (opening && comments.length === 0) loadComments();
  }

  // Same overrideAccountId pattern as toggleLike, for the same reason.
  async function handleAddComment(e, overrideAccountId) {
    e.preventDefault();
    const accountId = overrideAccountId ?? viewerAccountId;
    if (!accountId || !newComment.trim()) return;
    setPostingComment(true);

    // Needs the real row's id back so it can be marked "seen" before the
    // live INSERT echo for this same comment arrives — otherwise it'd get
    // counted twice, once here and once by the realtime handler.
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: post.id, platform_account_id: accountId, content: newComment.trim() })
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
    deleteComment,
  };
}
