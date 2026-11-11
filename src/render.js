// Render a Wowhead-style tooltip card to PNG with headless Chromium.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';

const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: transparent; font: 12px/1.35 Verdana, Arial, "DejaVu Sans", sans-serif; color: #fff; }
  #card { display: inline-flex; align-items: flex-start; gap: 6px; padding: 4px; }
  .icon { position: relative; width: 58px; height: 58px; flex: none; }
  .icon img.ic { position: absolute; left: 7px; top: 7px; width: 44px; height: 44px; border-radius: 3px; }
  .icon img.frame { position: absolute; left: 0; top: 0; width: 58px; height: 58px; }
  .tt { max-width: 340px; min-width: 200px; padding: 6px 9px 7px 9px; border: 1px solid #4d5468; border-radius: 5px;
        background: linear-gradient(180deg, #121a32 0%, #0b1024 60%, #070b1c 100%); box-shadow: 0 0 0 1px #000, 0 3px 8px rgba(0,0,0,.6); }
  table { border-collapse: collapse; width: 100%; }
  td, th { padding: 0; font-weight: normal; text-align: left; vertical-align: top; }
  th { text-align: right; white-space: nowrap; padding-left: 12px; }
  b { font-weight: normal; font-size: 14px; }
  a { color: inherit; text-decoration: none; }
  .q { color: #ffd100; } .q0 { color: #9d9d9d; } .q1 { color: #fff; } .q2 { color: #1eff00; } .q3 { color: #0070dd; }
  .q4 { color: #a335ee; } .q5 { color: #ff8000; } .q6, .q7 { color: #e6cc80; } .q10 { color: #ff8000; }
  .whtt-sellprice { margin-top: 3px; }
  .moneygold, .moneysilver, .moneycopper { display: inline-block; padding-right: 15px; background-repeat: no-repeat; background-position: right center; }
  .moneygold { background-image: url(https://wow.zamimg.com/images/icons/money-gold.gif); }
  .moneysilver { background-image: url(https://wow.zamimg.com/images/icons/money-silver.gif); }
  .moneycopper { background-image: url(https://wow.zamimg.com/images/icons/money-copper.gif); }
  .whtt-extra { }
`;

let browserP = null;
function exe() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const home = homedir();
  for (const p of [
    `${home}/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`,
    `${home}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
  ]) if (existsSync(p)) return p;
  return undefined; // let playwright-core resolve its own registry
}
async function browser() {
  if (!browserP) {
    browserP = chromium.launch({ executablePath: exe(), args: ['--no-sandbox'] }).then((b) => {
      b.on('disconnected', () => { browserP = null; });
      return b;
    });
  }
  return browserP;
}

function cardHtml(item, tooltipHtml) {
  const html = tooltipHtml.replace(/href="\/(forever\/[^"]*)"/g, 'href="https://www.wowhead.com/$1"');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
<div id="card">
  <div class="icon"><img class="ic" src="${item.iconUrl}"><img class="frame" src="https://wow.zamimg.com/images/Icon/large/border/default.png"></div>
  <div class="tt">${html}</div>
</div></body></html>`;
}

export async function renderCard(item, tooltipHtml) {
  const b = await browser();
  const page = await b.newPage({ viewport: { width: 500, height: 400 }, deviceScaleFactor: 2 });
  try {
    await page.setContent(cardHtml(item, tooltipHtml), { waitUntil: 'networkidle' });
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
    return await page.locator('#card').screenshot({ type: 'png', omitBackground: true });
  } finally {
    await page.close();
  }
}

export async function closeBrowser() {
  if (browserP) { const b = await browserP; browserP = null; await b.close(); }
}
