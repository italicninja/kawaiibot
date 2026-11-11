import { lookupItem } from './wowhead.js';
import { renderCard, closeBrowser } from './render.js';
import { writeFileSync } from 'node:fs';
for (const n of process.argv.slice(2)) {
  const it = await lookupItem(n);
  const png = await renderCard(it, it.tooltipHtml);
  const f = `/tmp/claude-1000/-home-metra--t3-worktrees-browserproject-t3-bd14c0a5/30bb1871-95dc-46c4-a2d9-515423c810d5/scratchpad/${it.id}.png`;
  writeFileSync(f, png); console.log(f, png.length);
}
await closeBrowser();
