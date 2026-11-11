// Watched channel ids, persisted to a JSON file (WATCHED_FILE, default data/watched.json).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const file = process.env.WATCHED_FILE ?? new URL('../data/watched.json', import.meta.url).pathname;
const ids = new Set();
try { for (const id of JSON.parse(readFileSync(file, 'utf8'))) ids.add(String(id)); } catch { /* none yet */ }
for (const id of (process.env.CHANNELS ?? '').split(',').map((s) => s.trim()).filter(Boolean)) ids.add(id);

function save() {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify([...ids], null, 2) + '\n');
}

export const watched = {
  has: (id) => ids.has(id),
  add: (id) => { const fresh = !ids.has(id); ids.add(id); save(); return fresh; },
  remove: (id) => { const had = ids.delete(id); save(); return had; },
  all: () => [...ids],
  size: () => ids.size,
};
