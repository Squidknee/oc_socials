import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient.js';
import UploadButton from '../../UploadButton.jsx';
import '../composer.css';

function toDatetimeLocal(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Unlike Instagram, media is optional here (a tweet can be text-only) and
// there's no "liked by" — instead there's a fabricated retweet count and
// a "posted via ___" label, neither of which Instagram's composer has.
export default function TwitterComposer({ account, onPosted, onCancel }) {
  const platform = account.platforms;

  const [mediaItems, setMediaItems] = useState([]);
  const [caption, setCaption] = useState('');
  const [baseLikeCount, setBaseLikeCount] = useState(0);
  const [retweetCount, setRetweetCount] = useState(0);
  const [clientLabel, setClientLabel] = useState('');
  const [postedAt, setPostedAt] = useState(() => toDatetimeLocal(new Date()));
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function updateMediaItem(index, patch) {
    setMediaItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeMediaItem(index) {
    setMediaItems((items) => items.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const filledMedia = mediaItems.filter((m) => m.url.trim());

    if (platform.requires_media && filledMedia.length === 0) {
      setError('This platform requires at least one photo or video.');
      return;
    }
    if (!caption.trim() && filledMedia.length === 0) {
      setError('Write something or attach media.');
      return;
    }
    if (platform.max_caption_length && caption.length > platform.max_caption_length) {
      setError(`Tweet exceeds the ${platform.max_caption_length} character limit.`);
      return;
    }

    setSubmitting(true);

    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({
        platform_account_id: account.id,
        platform_id: platform.id,
        world_id: account.world_id,
        content: caption || null,
        media_url: filledMedia[0]?.url || null,
        media_kind: filledMedia[0]?.kind || null,
        base_like_count: Number(baseLikeCount) || 0,
        retweet_count: Number(retweetCount) || 0,
        client_label: clientLabel || null,
        created_at: new Date(postedAt).toISOString(),
      })
      .select()
      .single();

    if (postError) {
      setSubmitting(false);
      setError(postError.message);
      return;
    }

    if (filledMedia.length > 1) {
      const { error: mediaError } = await supabase.from('post_media').insert(
        filledMedia.slice(1).map((m, i) => ({
          post_id: post.id,
          media_url: m.url,
          kind: m.kind,
          position: i + 1,
        }))
      );
      if (mediaError) console.error('Error saving extra media:', mediaError);
    }

    setSubmitting(false);
    onPosted?.(post);
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="composer-as">
        <span className="composer-as-avatar">
          {account.avatar_url ? <img src={account.avatar_url} alt="" /> : account.handle?.[0]?.toUpperCase()}
        </span>
        <span className="composer-as-text">
          <span className="composer-as-label">Posting as</span>
          <span className="composer-as-handle">@{account.handle}</span>
        </span>
        <span className="composer-platform-chip">{platform.name}</span>
      </div>

      <div className="composer-body">
        <textarea
          className="composer-caption"
          placeholder="What's happening?"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />

        <div className="composer-toolbar">
          <button
            type="button"
            className="composer-media-btn"
            onClick={() => setMediaItems((items) => [...items, { url: '', kind: 'image' }])}
            disabled={mediaItems.length >= 4}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="9.5" r="1.6" />
              <path d="M4 17l5-5 4 4 3-3 4 4" />
            </svg>
            Add media
          </button>
          <span className="composer-hint">up to 4</span>
          {platform.max_caption_length && (
            <span className={`composer-charcount${caption.length > platform.max_caption_length ? ' over' : ''}`}>
              {caption.length}/{platform.max_caption_length}
            </span>
          )}
        </div>

        {mediaItems.length > 0 && (
          <div className="composer-media-list">
            {mediaItems.map((item, i) => (
              <div className="composer-media-row" key={i}>
                <input
                  type="url"
                  placeholder="Image or video URL"
                  value={item.url}
                  onChange={(e) => updateMediaItem(i, { url: e.target.value })}
                />
                <select value={item.kind} onChange={(e) => updateMediaItem(i, { kind: e.target.value })}>
                  <option value="image">Photo</option>
                  <option value="video">Video</option>
                </select>
                <UploadButton
                  className="composer-upload-btn"
                  onUploaded={(url, kind) => updateMediaItem(i, { url, kind })}
                  onError={setError}
                />
                <button type="button" className="composer-remove-media" onClick={() => removeMediaItem(i)} aria-label="Remove">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="composer-fakes">
          <span className="composer-fakes-label">Fake the numbers</span>
          <div className="composer-row">
            <label>
              Likes
              <input type="number" min="0" value={baseLikeCount} onChange={(e) => setBaseLikeCount(e.target.value)} />
            </label>
            <label>
              Retweets
              <input type="number" min="0" value={retweetCount} onChange={(e) => setRetweetCount(e.target.value)} />
            </label>
            <label className="wide">
              Posted via
              <input type="text" placeholder="Twitter for iPhone" value={clientLabel} onChange={(e) => setClientLabel(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="composer-schedule">
          {scheduleOpen ? (
            <label className="composer-row-single">
              <input type="datetime-local" value={postedAt} onChange={(e) => setPostedAt(e.target.value)} />
            </label>
          ) : (
            <>
              <button type="button" className="composer-schedule-toggle" onClick={() => setScheduleOpen(true)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" />
                </svg>
                Post at a different time
              </button>
              <span className="composer-schedule-hint">
                now · {new Date(postedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            </>
          )}
        </div>

        {error && <p className="composer-error">{error}</p>}
      </div>

      <div className="composer-actions">
        <button type="button" className="composer-cancel" onClick={onCancel}>Cancel</button>
        <button type="submit" className="composer-submit" disabled={submitting}>
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </form>
  );
}
