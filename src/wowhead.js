// Wowhead "WoW Forever" item lookup.
// Search page: https://www.wowhead.com/forever/search?q=<name>
//   embeds WH.Gatherer.addData(3, 16, {"<id>":{"name_enus":..,"quality":..,"icon":..}, ...})
//   (3 = items, 16 = the Forever data environment)
// Tooltip:     https://nether.wowhead.com/tooltip/item/<id>?dataEnv=16&locale=0
//   -> {name, quality, icon, tooltip (html)}
// Icon image:  https://wow.zamimg.com/images/wow/icons/large/<icon>.jpg

const BASE = 'https://www.wowhead.com/forever';
const DATA_ENV = 16;
const UA = 'wowhead-forever-discord-bot/0.1 (+discord item cards)';
const TTL_MS = 24 * 60 * 60 * 1000;

const QUALITY = {
  0: { name: 'Poor', color: 0x9d9d9d },
  1: { name: 'Common', color: 0xffffff },
  2: { name: 'Uncommon', color: 0x1eff00 },
  3: { name: 'Rare', color: 0x0070dd },
  4: { name: 'Epic', color: 0xa335ee },
  5: { name: 'Legendary', color: 0xff8000 },
  6: { name: 'Artifact', color: 0xe6cc80 },
  7: { name: 'Heirloom', color: 0xe6cc80 },
};

const cache = new Map(); // normalised name -> {at, value|null}

export function normName(s) {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function itemUrl(id, name) {
  return `${BASE}/item=${id}/${slug(name)}`;
}

export function iconUrl(icon, size = 'large') {
  return `https://wow.zamimg.com/images/wow/icons/${size}/${icon}.jpg`;
}

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

// Pull the JSON object that follows `WH.Gatherer.addData(3, 16, ` with a brace scan
// (the page is JS, not JSON, so we cannot JSON.parse the whole thing).
function extractGathererItems(html) {
  const key = `WH.Gatherer.addData(3, ${DATA_ENV}, `;
  const out = {};
  let from = 0;
  for (;;) {
    const i = html.indexOf(key, from);
    if (i < 0) break;
    let j = i + key.length;
    if (html[j] !== '{') { from = j; continue; }
    let depth = 0, inStr = false, esc = false, k = j;
    for (; k < html.length; k++) {
      const c = html[k];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { k++; break; } }
    }
    try { Object.assign(out, JSON.parse(html.slice(j, k))); } catch { /* skip a broken block */ }
    from = k;
  }
  return out;
}

export async function searchItems(query) {
  const html = await get(`${BASE}/search?q=${encodeURIComponent(query)}`);
  const data = extractGathererItems(html);
  return Object.entries(data)
    .filter(([, v]) => v && v.name_enus)
    .map(([id, v]) => ({ id: Number(id), name: v.name_enus, quality: v.quality ?? 1, icon: v.icon }));
}

export async function fetchTooltip(id) {
  const txt = await get(`https://nether.wowhead.com/tooltip/item/${id}?dataEnv=${DATA_ENV}&locale=0`);
  return JSON.parse(txt);
}

// Wowhead tooltip HTML -> plain lines for a Discord embed description.
export function tooltipToText(html) {
  if (!html) return '';
  let s = html
    .replace(/<!--.*?-->/gs, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(tr|table|div)[^>]*>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  // Sell price comes out as "Sell Price: 17 17"; make it readable.
  s = s.replace(/Sell Price:\s*((?:\d+\s*)+)/, (_, nums) => {
    const parts = nums.trim().split(/\s+/);
    const units = ['g', 's', 'c'].slice(3 - parts.length);
    return 'Sell Price: ' + parts.map((p, i) => p + units[i]).join(' ');
  });
  const lines = s.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  // The first line is the item name, already in the embed title.
  return lines.slice(1).join('\n').slice(0, 1800);
}

// Resolve a bracketed name to a full card, or null when Wowhead knows no such item.
export async function lookupItem(rawName) {
  const key = normName(rawName);
  if (!key) return null;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let value = null;
  try {
    const results = await searchItems(key);
    let pick = results.find((r) => normName(r.name) === key);
    if (!pick && results.length) {
      // No exact name: take the result that starts with the query, else the shortest name.
      const starts = results.filter((r) => normName(r.name).startsWith(key));
      pick = (starts.length ? starts : results).sort((a, b) => a.name.length - b.name.length)[0];
    }
    if (pick) {
      let tooltip = null;
      try { tooltip = await fetchTooltip(pick.id); } catch { /* card without tooltip text */ }
      const q = QUALITY[tooltip?.quality ?? pick.quality] ?? QUALITY[1];
      value = {
        id: pick.id,
        name: tooltip?.name ?? pick.name,
        exact: normName(pick.name) === key,
        quality: q,
        icon: tooltip?.icon ?? pick.icon,
        iconUrl: iconUrl(tooltip?.icon ?? pick.icon),
        url: itemUrl(pick.id, tooltip?.name ?? pick.name),
        text: tooltipToText(tooltip?.tooltip),
        tooltipHtml: tooltip?.tooltip ?? '',
      };
    }
  } catch (err) {
    console.error('wowhead lookup failed', rawName, err.message);
    return null; // do not cache failures of the network kind
  }
  cache.set(key, { at: Date.now(), value });
  return value;
}

// [Item Name] occurrences in a chat message, deduplicated, in order.
export function extractItemNames(content, max = 3) {
  const names = [];
  const seen = new Set();
  const re = /\[([^\[\]\n]{2,80})\]/g;
  let m;
  while ((m = re.exec(content)) && names.length < max) {
    const n = m[1].trim();
    if (!/[a-z]/i.test(n)) continue; // skip [1], [ ], etc.
    const k = normName(n);
    if (seen.has(k)) continue;
    seen.add(k);
    names.push(n);
  }
  return names;
}
