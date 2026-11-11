// CLI check: node src/lookup.js "Cozy Sleeping Bag" "Thunderfury"
import { lookupItem } from './wowhead.js';

const names = process.argv.slice(2);
if (!names.length) { console.error('usage: node src/lookup.js "<item name>" ...'); process.exit(2); }
for (const n of names) {
  const r = await lookupItem(n);
  if (!r) { console.log(`[${n}] -> not found`); continue; }
  console.log(`[${n}] -> #${r.id} ${r.name} (${r.quality.name}${r.exact ? '' : ', inexact'})\n  ${r.url}\n  ${r.iconUrl}\n  ${r.text.split('\n').join('\n  ')}\n`);
}
