// Shared formatting helpers used by every platform's post skin, so "2h" vs
// "3d" vs a real date, and hashtag detection, never drift between platforms.

export function formatRelativeTime(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;

  return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Splits caption text into plain-text and hashtag segments so a skin can
// style hashtags (e.g. in blue) without them being clickable — hashtags
// are a display-only concern, never stored as their own column.
export function splitHashtags(text) {
  if (!text) return [];
  return text.split(/(#[a-zA-Z0-9_]+)/g).filter(Boolean).map((part) => ({
    text: part,
    isHashtag: part.startsWith('#'),
  }));
}
