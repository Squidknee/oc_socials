// Tracks the last world you visited this browser session, so the
// "Characters" nav tab knows where to send you without a world id in
// its own URL. Session-scoped (not localStorage) — clears when the tab
// closes, same lifetime as being logged in for the day.
const CURRENT_WORLD_KEY = 'oc-social:currentWorldId';

export function setCurrentWorldId(worldId) {
  sessionStorage.setItem(CURRENT_WORLD_KEY, worldId);
}

export function getCurrentWorldId() {
  return sessionStorage.getItem(CURRENT_WORLD_KEY);
}
