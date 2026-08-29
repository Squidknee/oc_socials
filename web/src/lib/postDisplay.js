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

// Abbreviates large counts the way Twitter/Instagram do (1.2k, 15k, 3.4m)
// instead of ever showing a raw string of digits.
export function formatCount(count) {
  const abs = Math.abs(count);
  if (abs < 1000) return String(count);

  const units = [
    [1_000_000_000, 'b'],
    [1_000_000, 'm'],
    [1_000, 'k'],
  ];
  const [divisor, suffix] = units.find(([div]) => abs >= div);
  const truncated = Math.floor((count / divisor) * 10) / 10;
  const value = Number.isInteger(truncated) ? truncated : truncated.toFixed(1);
  return `${value}${suffix}`;
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
