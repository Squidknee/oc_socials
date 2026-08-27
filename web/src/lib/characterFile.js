// Shared logic for character import/export, used by both CharacterManager
// (export button) and ImportCharacterForm (parsing an uploaded file).
// Keeping this in one place means the export shape and the import
// validation can never drift out of sync with each other.

// "format" is a version tag for the file itself — if we ever change what
// an export contains, bumping this lets old files still be recognized (or
// rejected with a clear message) instead of silently breaking.
const FILE_FORMAT = 'oc-social-character-v1';

export function characterToExportPayload(character) {
  return {
    format: FILE_FORMAT,
    handle: character.handle,
    display_name: character.display_name,
    avatar_url: character.avatar_url ?? null,
    bio: character.bio ?? null,
  };
}

// Triggers a browser file download with no server involved: build the JSON
// as a Blob (an in-memory file-like object), give it a temporary object
// URL, click a throwaway <a download> link pointing at it, then clean up.
export function downloadCharacterFile(character) {
  const payload = characterToExportPayload(character);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${character.handle}.oc-character.json`;
  link.click();

  URL.revokeObjectURL(url);
}

// Validates an uploaded file's text content and throws a user-readable
// Error if anything's wrong, so callers can just try/catch and show the
// message directly rather than re-implementing these checks themselves.
export function parseCharacterFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file isn\'t valid JSON.');
  }

  if (data.format !== FILE_FORMAT) {
    throw new Error('That file doesn\'t look like an OC Social character export.');
  }
  if (!data.handle || !data.display_name) {
    throw new Error('The file is missing a handle or display name.');
  }

  return data;
}
