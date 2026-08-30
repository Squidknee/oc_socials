import { useEffect } from 'react';

// Closes an open "act as" picker (or similar popover) on a click anywhere
// outside its container ref — shared between TwitterPost/InstagramPost,
// neither of which had any way to dismiss the picker except actually
// picking an option.
export function useClickOutside(ref, active, onOutside) {
  useEffect(() => {
    if (!active) return;

    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [active, onOutside]);
}
