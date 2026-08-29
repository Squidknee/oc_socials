// Finds (and, with --delete, removes) files in the "media" storage bucket
// that no row in the database actually references anymore — the leftovers
// from UploadButton uploading a file immediately on selection, before the
// surrounding form is ever submitted (change your mind, pick a different
// file, or just cancel, and the first upload just sits there orphaned).
//
// Needs the service_role key, not the anon key: this has to read across
// every user's data (RLS would otherwise only show you your own) and
// delete objects outside your own storage folder. Put it in
// web/.env.local as SUPABASE_SERVICE_ROLE_KEY=... (no VITE_ prefix, so it
// never gets bundled into the client app) and never commit it.
//
// Usage (from web/):
//   node scripts/cleanup-orphaned-media.js            # dry run, lists what it found
//   node scripts/cleanup-orphaned-media.js --delete   # actually deletes the orphans

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(path) {
  try {
    // Windows-edited .env files use CRLF — split on \r\n first (LF alone
    // still splits any of those apart fine too), so a trailing \r never
    // ends up inside the matched value or breaking the regex outright.
    const text = readFileSync(path, 'utf8');
    for (const line of text.split(/\r\n|\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].trim();
    }
  } catch {
    // fine if a given file doesn't exist
  }
}

loadEnv(new URL('../.env', import.meta.url));
loadEnv(new URL('../.env.local', import.meta.url));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL (web/.env) or SUPABASE_SERVICE_ROLE_KEY (web/.env.local).');
  process.exit(1);
}

// This script never subscribes to a realtime channel, but supabase-js
// still constructs its RealtimeClient eagerly and throws immediately if
// no WebSocket implementation is available — true on Node 20, which has
// no native WebSocket. A stub is enough since it's never actually asked
// to connect.
class NoopWebSocket {}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { realtime: { transport: NoopWebSocket } });
const BUCKET = 'media';

// Every column in the schema that can hold a URL into this bucket.
const MEDIA_URL_COLUMNS = [
  ['worlds', 'avatar_url'],
  ['characters', 'avatar_url'],
  ['platform_accounts', 'avatar_url'],
  ['posts', 'media_url'],
  ['post_media', 'media_url'],
  ['conversations', 'avatar_url'],
  ['messages', 'media_url'],
  ['conversation_participants', 'contact_photo_url'],
];

const PUBLIC_URL_MARKER = `/storage/v1/object/public/${BUCKET}/`;

async function collectUsedPaths() {
  const used = new Set();
  for (const [table, column] of MEDIA_URL_COLUMNS) {
    const { data, error } = await supabase.from(table).select(column).not(column, 'is', null);
    if (error) throw new Error(`Reading ${table}.${column}: ${error.message}`);
    for (const row of data) {
      const url = row[column];
      const idx = url?.indexOf(PUBLIC_URL_MARKER) ?? -1;
      if (idx === -1) continue; // not a URL into this bucket (or null)
      used.add(decodeURIComponent(url.slice(idx + PUBLIC_URL_MARKER.length)));
    }
  }
  return used;
}

// Objects live under {userId}/{filename} — one list() call per top-level
// folder, since list() isn't recursive.
async function listAllObjects() {
  const objects = [];
  const { data: topLevel, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000 });
  if (error) throw new Error(`Listing bucket root: ${error.message}`);

  for (const entry of topLevel) {
    if (entry.id !== null) continue; // a real file directly at the root shouldn't exist, but skip if so
    const { data: files, error: filesError } = await supabase.storage.from(BUCKET).list(entry.name, { limit: 10000 });
    if (filesError) throw new Error(`Listing ${entry.name}/: ${filesError.message}`);
    for (const file of files ?? []) {
      objects.push({ path: `${entry.name}/${file.name}`, size: file.metadata?.size ?? 0 });
    }
  }
  return objects;
}

async function main() {
  const [used, allObjects] = await Promise.all([collectUsedPaths(), listAllObjects()]);
  const orphaned = allObjects.filter((o) => !used.has(o.path));
  const orphanedBytes = orphaned.reduce((sum, o) => sum + o.size, 0);

  console.log(`Objects in storage: ${allObjects.length}`);
  console.log(`Referenced in the database: ${used.size}`);
  console.log(`Orphaned: ${orphaned.length} (${(orphanedBytes / 1024 / 1024).toFixed(2)} MB)`);

  if (orphaned.length > 0) {
    console.log('\nOrphaned files:');
    for (const o of orphaned) console.log(`  ${o.path}  (${(o.size / 1024).toFixed(1)} KB)`);
  }

  if (!process.argv.includes('--delete')) {
    console.log(orphaned.length > 0 ? '\nDry run only — re-run with --delete to actually remove these.' : '\nNothing to clean up.');
    return;
  }

  if (orphaned.length === 0) return;

  const { error } = await supabase.storage.from(BUCKET).remove(orphaned.map((o) => o.path));
  if (error) throw new Error(`Deleting: ${error.message}`);
  console.log(`\nDeleted ${orphaned.length} orphaned file(s).`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
