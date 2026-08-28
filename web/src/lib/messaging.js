import { supabase } from './supabaseClient.js';

// Builds one summary per conversation a character is in on a given
// platform — other participants, the latest message (for a preview),
// and an unread count. Shared by MessagesOverview (the full list) and
// ConversationView (just the total unread badge on the back button).
export async function fetchConversationSummaries({ characterId, platformId }) {
  const { data: participantRows } = await supabase
    .from('conversation_participants')
    .select('conversation_id, pinned, last_read_at, conversations!inner ( id, kind, name, avatar_url, platform_id )')
    .eq('character_id', characterId)
    .eq('conversations.platform_id', platformId);

  const rows = participantRows ?? [];
  const conversationIds = rows.map((r) => r.conversation_id);
  if (conversationIds.length === 0) return [];

  const [{ data: otherRows }, { data: messageRows }] = await Promise.all([
    supabase
      .from('conversation_participants')
      .select('conversation_id, character_id, characters ( id, handle, display_name, avatar_url )')
      .in('conversation_id', conversationIds)
      .neq('character_id', characterId),
    supabase
      .from('messages')
      .select('id, conversation_id, sender_character_id, content, media_url, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false }),
  ]);

  const combined = rows.map((row) => {
    const conv = row.conversations;
    const others = (otherRows ?? []).filter((r) => r.conversation_id === conv.id).map((r) => r.characters);
    const messagesForConvo = (messageRows ?? []).filter((m) => m.conversation_id === conv.id);
    const lastMessage = messagesForConvo[0] ?? null;
    const unreadCount = messagesForConvo.filter(
      (m) => m.sender_character_id !== characterId && new Date(m.created_at) > new Date(row.last_read_at)
    ).length;

    return {
      id: conv.id,
      kind: conv.kind,
      name: conv.name,
      avatarUrl: conv.avatar_url,
      pinned: row.pinned,
      otherParticipants: others,
      lastMessage,
      unreadCount,
    };
  });

  combined.sort((a, b) => new Date(b.lastMessage?.created_at ?? 0) - new Date(a.lastMessage?.created_at ?? 0));
  return combined;
}

// Consecutive messages from the same sender within this gap collapse
// into one visual cluster (avatar/timestamp shown once), same as real
// iMessage — otherwise a quick back-and-forth reads like a wall of
// separate bubbles with redundant chrome.
const CLUSTER_GAP_MS = 5 * 60 * 1000;

export function clusterMessages(messages) {
  const clusters = [];

  for (const message of messages) {
    const last = clusters[clusters.length - 1];
    const lastMessage = last?.messages[last.messages.length - 1];

    if (
      last &&
      last.senderCharacterId === message.sender_character_id &&
      new Date(message.created_at) - new Date(lastMessage.created_at) < CLUSTER_GAP_MS
    ) {
      last.messages.push(message);
    } else {
      clusters.push({ senderCharacterId: message.sender_character_id, messages: [message] });
    }
  }

  return clusters;
}

// Clock time for today's messages, "Mon, 2:45 PM" style for older ones —
// reads better for a chat transcript than postDisplay's relative "2h".
export function formatMessageTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  if (date.toDateString() === now.toDateString()) return time;
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
}
