import { splitHashtags } from '../../lib/postDisplay.js';

// Renders caption text with hashtags styled distinctly — plain text, never
// a real link; hashtags here are decorative only.
export default function HashtagText({ text }) {
  return splitHashtags(text).map((part, i) =>
    part.isHashtag ? (
      <span key={i} className="hashtag">{part.text}</span>
    ) : (
      <span key={i}>{part.text}</span>
    )
  );
}
