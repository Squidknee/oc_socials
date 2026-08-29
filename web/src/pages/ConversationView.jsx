import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { usePlatforms } from '../lib/PlatformsContext.jsx';
import { clusterMessages, fetchConversationSummaries, formatMessageTime } from '../lib/messaging.js';
import UploadButton from '../components/UploadButton.jsx';
import EditGroupForm from '../components/EditGroupForm.jsx';
import './messages.css';

export default function ConversationView() {
  const { characterId, platformSlug, conversationId } = useParams();
  const { user } = useAuth();
  const { getPlatform } = usePlatforms();
  const platform = getPlatform(platformSlug);

  const [character, setCharacter] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [otherUnreadCount, setOtherUnreadCount] = useState(0);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // The photo I've personally chosen to see for the other character in
  // this DM — lives on my own conversation_participants row so it never
  // touches their actual profile (like overriding a contact's photo in a
  // phone's address book).
  const [myContactPhotoUrl, setMyContactPhotoUrl] = useState(null);

  const [draft, setDraft] = useState('');
  const [pendingImageUrl, setPendingImageUrl] = useState(null);
  const [sending, setSending] = useState(false);

  const bottomRef = useRef(null);

  useEffect(() => {
    async function load() {
      const { data: characterRow } = await supabase
        .from('characters')
        .select('id, owner_id')
        .eq('id', characterId)
        .single();
      setCharacter(characterRow);
      if (!characterRow || characterRow.owner_id !== user.id) {
        setLoading(false);
        return;
      }

      const [{ data: conversationRow }, { data: participantRows }, { data: messageRows }] = await Promise.all([
        supabase.from('conversations').select('id, kind, name, avatar_url, read_receipts_enabled').eq('id', conversationId).single(),
        supabase
          .from('conversation_participants')
          .select('character_id, contact_photo_url, characters ( id, handle, display_name, avatar_url )')
          .eq('conversation_id', conversationId),
        supabase
          .from('messages')
          .select('id, sender_character_id, content, media_url, read_at, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true }),
      ]);

      setConversation(conversationRow);
      setParticipants((participantRows ?? []).map((r) => r.characters));
      setMyContactPhotoUrl((participantRows ?? []).find((r) => r.character_id === characterId)?.contact_photo_url ?? null);
      setMessages(messageRows ?? []);
      setLoading(false);

      // Opening a conversation marks it read for this character.
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('character_id', characterId);
    }

    load();
  }, [characterId, conversationId, user.id]);

  // Live delivery: messages_select_participant (0014) still gates what
  // this client actually receives, so a channel scoped to just this
  // conversation is enough — no separate realtime auth to worry about.
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          // The sender's own send already appended this optimistically —
          // skip it here so it doesn't show up twice.
          setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    async function fetchOtherUnread() {
      if (!platform) return;
      const summaries = await fetchConversationSummaries({ characterId, platformId: platform.id });
      setOtherUnreadCount(summaries.filter((c) => c.id !== conversationId && c.unreadCount > 0).length);
    }
    fetchOtherUnread();
  }, [characterId, platform?.id, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function handleSend(e) {
    e.preventDefault();
    if (!draft.trim() && !pendingImageUrl) return;
    setSending(true);

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_character_id: characterId,
        content: draft.trim() || null,
        media_url: pendingImageUrl || null,
      })
      .select()
      .single();

    setSending(false);
    if (error) {
      alert(`Couldn't send: ${error.message}`);
      return;
    }

    setMessages((prev) => [...prev, message]);
    setDraft('');
    setPendingImageUrl(null);
  }

  async function toggleReadReceipts() {
    const { data } = await supabase
      .from('conversations')
      .update({ read_receipts_enabled: !conversation.read_receipts_enabled })
      .eq('id', conversationId)
      .select()
      .single();
    if (data) setConversation(data);
  }

  async function handleContactPhotoUploaded(url) {
    const { data } = await supabase
      .from('conversation_participants')
      .update({ contact_photo_url: url })
      .eq('conversation_id', conversationId)
      .eq('character_id', characterId)
      .select()
      .single();
    if (data) setMyContactPhotoUrl(data.contact_photo_url);
  }

  async function handleRemoveContactPhoto() {
    const { data } = await supabase
      .from('conversation_participants')
      .update({ contact_photo_url: null })
      .eq('conversation_id', conversationId)
      .eq('character_id', characterId)
      .select()
      .single();
    if (data) setMyContactPhotoUrl(data.contact_photo_url);
  }

  if (loading) return <p style={{ padding: '1rem' }}>Loading…</p>;
  if (!character || character.owner_id !== user.id) return <p style={{ padding: '1rem' }}>You can only view your own messages.</p>;
  if (!conversation) return <p style={{ padding: '1rem' }}>Conversation not found.</p>;

  const otherParticipants = participants.filter((p) => p?.id !== characterId);
  const title = conversation.kind === 'direct'
    ? otherParticipants[0]?.display_name
    : conversation.name || otherParticipants.map((p) => p.display_name).join(', ');

  // My contact-photo override only ever applies to the one other person
  // in a direct conversation — group chats keep everyone's real avatar.
  const otherAvatarUrl = conversation.kind === 'direct'
    ? myContactPhotoUrl || otherParticipants[0]?.avatar_url
    : null;

  const clusters = clusterMessages(messages);
  const lastCluster = clusters[clusters.length - 1];
  const lastClusterIsOwnDirect = conversation.kind === 'direct' && lastCluster?.senderCharacterId === characterId;
  const lastMessageOfLastCluster = lastCluster?.messages[lastCluster.messages.length - 1];

  return (
    <div className="msg-page">
      <div className="msg-convo-header">
        <Link className="msg-back-btn" to={`/characters/${characterId}/messages/${platformSlug}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          {otherUnreadCount > 0 && otherUnreadCount}
        </Link>
        <div className="msg-convo-title">
          <div className="msg-convo-avatar">
            {conversation.kind === 'group' && conversation.avatar_url ? (
              <img src={conversation.avatar_url} alt="" />
            ) : conversation.kind === 'direct' && otherAvatarUrl ? (
              <img src={otherAvatarUrl} alt="" />
            ) : (
              title?.[0]?.toUpperCase()
            )}
          </div>
          <span className="msg-convo-name">{title}</span>
        </div>
        {conversation.kind === 'group' ? (
          <button className="msg-back-btn" type="button" onClick={() => setEditGroupOpen((v) => !v)}>
            {editGroupOpen ? 'Cancel' : 'Edit'}
          </button>
        ) : (
          <button className="msg-back-btn" type="button" onClick={() => setDetailsOpen((v) => !v)}>
            {detailsOpen ? 'Cancel' : 'Edit'}
          </button>
        )}
      </div>

      {editGroupOpen && (
        <EditGroupForm
          conversation={conversation}
          onSaved={(updated) => { setConversation((prev) => ({ ...prev, ...updated })); setEditGroupOpen(false); }}
          onCancel={() => setEditGroupOpen(false)}
        />
      )}

      {detailsOpen && (
        <div className="msg-details-panel">
          <div className="msg-details-row">
            <span>Read Receipts</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={conversation.read_receipts_enabled} onChange={toggleReadReceipts} />
              <span className="toggle-switch-track">
                <span className="toggle-switch-knob" />
              </span>
            </label>
          </div>

          <div className="msg-contact-photo-section">
            <span className="msg-details-row-label">Contact Photo</span>
            <div className="msg-contact-photo-edit">
              <div className="msg-contact-photo-preview">
                {otherAvatarUrl ? <img src={otherAvatarUrl} alt="" /> : otherParticipants[0]?.display_name?.[0]?.toUpperCase()}
              </div>
              <div className="msg-contact-photo-actions">
                <UploadButton accept="image/*" className="msg-details-btn" onUploaded={handleContactPhotoUploaded}>
                  Choose Photo
                </UploadButton>
                {myContactPhotoUrl && (
                  <button type="button" className="msg-details-btn" onClick={handleRemoveContactPhoto}>
                    Use Original Photo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="msg-bubbles">
        {clusters.map((cluster, i) => {
          const isOwn = cluster.senderCharacterId === characterId;
          const isLastCluster = i === clusters.length - 1;
          const sender = participants.find((p) => p?.id === cluster.senderCharacterId);
          return (
            <div key={i}>
              <div className="msg-cluster-time">{formatMessageTime(cluster.messages[0].created_at)}</div>
              <div className={`msg-cluster ${isOwn ? 'own' : 'other'}`}>
                {!isOwn && (
                  <div className="msg-cluster-avatar">
                    {(conversation.kind === 'direct' ? otherAvatarUrl : sender?.avatar_url) ? (
                      <img src={conversation.kind === 'direct' ? otherAvatarUrl : sender.avatar_url} alt="" />
                    ) : (
                      sender?.display_name?.[0]?.toUpperCase()
                    )}
                  </div>
                )}
                <div className="msg-cluster-bubbles">
                  {cluster.messages.map((m) => (
                    <div key={m.id} className={`msg-bubble${m.media_url ? ' msg-bubble-media' : ''}`}>
                      {m.media_url && <img src={m.media_url} alt="" />}
                      {m.content}
                    </div>
                  ))}
                  {isLastCluster && lastClusterIsOwnDirect && lastMessageOfLastCluster && (
                    <div className="msg-read-status">
                      {conversation.read_receipts_enabled ? (
                        lastMessageOfLastCluster.read_at ? (
                          <span>Read {formatMessageTime(lastMessageOfLastCluster.read_at)}</span>
                        ) : (
                          <span>Not read yet</span>
                        )
                      ) : (
                        <span>Delivered</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {pendingImageUrl && (
        <div className="msg-pending-image">
          <img src={pendingImageUrl} alt="" />
          <button type="button" onClick={() => setPendingImageUrl(null)}>Remove</button>
        </div>
      )}

      <form className="msg-compose-bar" onSubmit={handleSend}>
        <UploadButton accept="image/*" className="msg-attach-btn" onUploaded={(url) => setPendingImageUrl(url)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
        </UploadButton>
        <textarea
          className="msg-compose-input"
          placeholder="Text Message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
          rows={1}
        />
        <button className="msg-send-btn" type="submit" disabled={sending || (!draft.trim() && !pendingImageUrl)} aria-label="Send">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2 12l19-9-7 20-3-8-9-3z" /></svg>
        </button>
      </form>
    </div>
  );
}
