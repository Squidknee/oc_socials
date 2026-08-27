// Shared across every platform skin and the character's account list —
// a plain generic badge shape (filled circle + checkmark), not modeled on
// any one real platform's specific verification mark.
export default function VerifiedBadge({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Verified" style={{ flexShrink: 0, position: 'relative', top: '1px' }}>
      <circle cx="12" cy="12" r="10" fill="#3b82f6" />
      <path d="M8 12.3l2.6 2.6 5-5.4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
