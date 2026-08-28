import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { usePlatforms } from '../lib/PlatformsContext.jsx';
import { fetchConversationSummaries, formatMessageTime } from '../lib/messaging.js';
import './messages.css';

const MAX_PINNED = 6;

function otherPartyLabel(conversation) {
  if (conversation.kind === 'direct') {
    return conversation.otherParticipants[0]?.display_name ?? 'Unknown';
  }
  return conversation.name || conversation.otherParticipants.map((p) => p.display_name).join(', ');
}

export default function MessagesOverview() {
  const { characterId, platformSlug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { getPlatform } = usePlatforms();
  const platform = getPlatform(platformSlug);

  const [character, setCharacter] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [otherCharacters, setOtherCharacters] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    async function fetchCharacter() {
      const { data } = await supabase
        .from('characters')
        .select('id, handle, display_name, world_id, owner_id')
        .eq('id', characterId)
        .single();
      setCharacter(data);

      if (data && platform) {
        const summaries = await fetchConversationSummaries({ characterId, platformId: platform.id });
        setConversations(summaries);
      }
      setLoading(false);
    }

    fetchCharacter();
  }, [characterId, platform?.id]);

  // Live-updates the list preview/unread dots when a message lands in any
  // of this character's conversations. Can't filter postgres_changes by
  // "conversation_id in (my conversations)", so this subscribes to every
  // message change and lets messages_select_participant (0014) decide
  // what actually reaches this client — then just re-derives the
  // summaries rather than hand-patching unread counts/previews in place.
  useEffect(() => {
    if (!character || !platform) return;

    const channel = supabase
      .channel(`messages-overview:${characterId}:${platform.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchConversationSummaries({ characterId, platformId: platform.id }).then(setConversations);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [character, characterId, platform?.id]);

  async function togglePinned(conversation) {
    if (!conversation.pinned && conversations.filter((c) => c.pinned).length >= MAX_PINNED) {
      alert(`You can only pin up to ${MAX_PINNED} conversations.`);
      return;
    }

    await supabase
      .from('conversation_participants')
      .update({ pinned: !conversation.pinned })
      .eq('conversation_id', conversation.id)
      .eq('character_id', characterId);

    setConversations((prev) => prev.map((c) => (c.id === conversation.id ? { ...c, pinned: !c.pinned } : c)));
  }

  async function openPicker() {
    setPickerOpen(true);
    if (otherCharacters.length > 0) return;
    const { data } = await supabase
      .from('characters')
      .select('id, handle, display_name')
      .eq('world_id', character.world_id)
      .neq('id', characterId);
    setOtherCharacters(data ?? []);
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleStartConversation() {
    if (selectedIds.length === 0) return;
    setStarting(true);

    // Reopen an existing direct conversation instead of creating a
    // duplicate thread with the same person.
    if (selectedIds.length === 1) {
      const existing = conversations.find(
        (c) => c.kind === 'direct' && c.otherParticipants.some((p) => p.id === selectedIds[0])
      );
      if (existing) {
        setStarting(false);
        navigate(`/characters/${characterId}/messages/${platformSlug}/${existing.id}`);
        return;
      }
    }

    const { data: convo, error } = await supabase
      .from('conversations')
      .insert({
        world_id: character.world_id,
        platform_id: platform.id,
        kind: selectedIds.length === 1 ? 'direct' : 'group',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      setStarting(false);
      alert(`Couldn't start conversation: ${error.message}`);
      return;
    }

    await supabase.from('conversation_participants').insert([
      { conversation_id: convo.id, character_id: characterId },
      ...selectedIds.map((id) => ({ conversation_id: convo.id, character_id: id })),
    ]);

    setStarting(false);
    navigate(`/characters/${characterId}/messages/${platformSlug}/${convo.id}`);
  }

  if (loading || !character || !platform) return <p style={{ padding: '1rem' }}>Loading…</p>;
  if (character.owner_id !== user.id) return <p style={{ padding: '1rem' }}>You can only view your own messages.</p>;

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    return otherPartyLabel(c).toLowerCase().includes(search.trim().toLowerCase());
  });
  const pinned = filtered.filter((c) => c.pinned);
  const unpinned = filtered.filter((c) => !c.pinned);

  return (
    <div className="msg-page">
      <h1 className="msg-heading">Messages</h1>

      {pinned.length > 0 && (
        <div className="msg-pinned-row">
          {pinned.map((conversation) => (
            <div className="msg-pinned-item" key={conversation.id}>
              {conversation.unreadCount > 0 && conversation.lastMessage && (
                <div className="msg-pinned-bubble">{conversation.lastMessage.content || 'Sent an image'}</div>
              )}
              <Link to={`/characters/${characterId}/messages/${platformSlug}/${conversation.id}`} className="msg-pinned-avatar" style={{ textDecoration: 'none' }}>
                {conversation.otherParticipants[0]?.avatar_url ? (
                  <img src={conversation.otherParticipants[0].avatar_url} alt="" />
                ) : (
                  otherPartyLabel(conversation)[0]?.toUpperCase()
                )}
              </Link>
              <div className="msg-pinned-name-row">
                <span className="msg-pinned-name">{otherPartyLabel(conversation)}</span>
                {conversation.unreadCount > 0 && <span className="msg-unread-dot" />}
              </div>
              <button type="button" onClick={() => togglePinned(conversation)} style={{ background: 'none', border: 'none', color: '#8e8e93', fontSize: '0.7rem', cursor: 'pointer' }}>
                Unpin
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="msg-list">
        {unpinned.length === 0 && pinned.length === 0 && <p className="msg-empty">No messages yet.</p>}
        {unpinned.map((conversation) => (
          <div className="msg-list-item" key={conversation.id}>
            <Link to={`/characters/${characterId}/messages/${platformSlug}/${conversation.id}`} className="msg-list-avatar-wrap" style={{ textDecoration: 'none', color: 'inherit', flexGrow: 1, display: 'flex' }}>
              {conversation.unreadCount > 0 && <span className="msg-unread-dot" />}
              <div className="msg-list-avatar">
                {conversation.otherParticipants[0]?.avatar_url ? (
                  <img src={conversation.otherParticipants[0].avatar_url} alt="" />
                ) : (
                  otherPartyLabel(conversation)[0]?.toUpperCase()
                )}
              </div>
              <div className="msg-list-info">
                <span className="msg-list-name">{otherPartyLabel(conversation)}</span>
                <span className="msg-list-preview">
                  {conversation.lastMessage
                    ? conversation.lastMessage.content || 'Sent an image'
                    : 'No messages yet'}
                </span>
              </div>
            </Link>
            <div className="msg-list-meta">
              {conversation.lastMessage && <span>{formatMessageTime(conversation.lastMessage.created_at)}</span>}
              <button type="button" onClick={() => togglePinned(conversation)} style={{ background: 'none', border: 'none', color: '#8e8e93', cursor: 'pointer', fontSize: '0.7rem' }}>
                Pin
              </button>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </div>
          </div>
        ))}
      </div>

      {pickerOpen && (
        <div className="msg-picker">
          <p className="msg-picker-title">New message to…</p>
          {otherCharacters.map((c) => (
            <label className="msg-picker-item" key={c.id}>
              <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelected(c.id)} />
              {c.display_name} (@{c.handle})
            </label>
          ))}
          <div className="msg-picker-actions">
            <button className="msg-picker-start" type="button" onClick={handleStartConversation} disabled={selectedIds.length === 0 || starting}>
              {starting ? 'Starting…' : 'Start'}
            </button>
            <button className="msg-picker-cancel" type="button" onClick={() => { setPickerOpen(false); setSelectedIds([]); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="msg-bottom-bar">
        <input
          className="msg-search-input"
          type="text"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="msg-new-btn" type="button" onClick={openPicker} aria-label="New message">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20c4.5 0 8-3.1 8-7s-3.5-7-8-7-8 3.1-8 7c0 1.7.6 3.2 1.7 4.4L4 20l4.3-1.2c1.1.5 2.4.8 3.7.8z" />
            <path d="M12 9v4" /><path d="M10 11h4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
