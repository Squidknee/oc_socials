// Two-letter monogram tile shown on world/character avatars that don't
// have one. Takes the first TWO WORDS (not first-and-last, the way
// CharacterProfile's getInitials does), since names like "Modern Coffee
// Shop AU" end in qualifiers that make a poor second letter.
export function monogram(name) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
