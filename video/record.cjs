// Records a scripted motion walkthrough of the live dashboard via CDP screencast.
// Output: video/frames/*.jpg + manifest, assembled to clips/motion.mp4 by build.sh.
const puppeteer = require('/Users/yonko/node_modules/puppeteer');
const fs = require('fs');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://localhost:8099';
const OUT = path.join(__dirname, 'frames');
const W = 1920, H = 1080;

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new', executablePath: CHROME,
    args: ['--no-sandbox', `--window-size=${W},${H}`, '--hide-scrollbars', '--force-device-scale-factor=1'],
    defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  const client = await page.target().createCDPSession();

  let n = 0;
  const manifest = [];
  client.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const ts = metadata.timestamp;
    const file = path.join(OUT, `f${String(n).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    manifest.push({ n, ts });
    n++;
    try { await client.send('Page.screencastFrameAck', { sessionId }); } catch (e) {}
  });

  // smooth scroll helper: scroll to target Y over `dur` ms with easing
  async function scrollTo(targetY, dur) {
    await page.evaluate(async (targetY, dur) => {
      const startY = window.scrollY;
      const dist = targetY - startY;
      const t0 = performance.now();
      await new Promise(res => {
        function step(now) {
          const p = Math.min(1, (now - t0) / dur);
          const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // easeInOut
          window.scrollTo(0, startY + dist * e);
          if (p < 1) requestAnimationFrame(step); else res();
        }
        requestAnimationFrame(step);
      });
    }, targetY, dur);
  }

  async function startCast() {
    await client.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1, maxWidth: W, maxHeight: H });
  }
  async function stopCast() { await client.send('Page.stopScreencast'); }

  // tiny continuous drift so a "hold" still emits screencast frames
  async function dwell(ms, px = 26) {
    const y0 = await page.evaluate(() => window.scrollY);
    await scrollTo(y0 + px, ms);
  }

  // ---- SEGMENT A: home walkthrough (continuous slow scroll) ----
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle0' });
  await sleep(1600); // let reveal animations + data load settle
  await startCast();
  await dwell(3200, 14);             // hero settle (9,400 / Most failed)
  await scrollTo(820, 4200);         // findings (6,934 spam cluster)
  await dwell(2600, 18);
  await scrollTo(1560, 4200);        // sybil section (1,797 sock puppets)
  await dwell(3000, 18);
  await scrollTo(2360, 4200);        // pipeline / scoring
  await dwell(2400, 18);
  await scrollTo(3160, 4200);        // proof section (3,541 written)
  await dwell(3200, 14);
  await stopCast();
  fs.writeFileSync(path.join(OUT, 'segA.json'), JSON.stringify({ end: n }));

  // ---- SEGMENT B: methodology — 5 layers + circuit breakers ----
  await page.goto(`${BASE}/methodology.html`, { waitUntil: 'networkidle0' });
  await sleep(1600);
  await startCast();
  await dwell(2600, 14);
  await scrollTo(700, 5000);
  await dwell(2600, 16);
  await scrollTo(1500, 5000);
  await dwell(2600, 16);
  await stopCast();
  fs.writeFileSync(path.join(OUT, 'segB.json'), JSON.stringify({ end: n }));

  // ---- SEGMENT C: registry search + expand (money shot) ----
  await page.goto(`${BASE}/registry.html`, { waitUntil: 'networkidle0' });
  await sleep(1800);
  await startCast();
  await dwell(1600, 10);
  const q = 'MASS_REGISTRATION';
  await page.click('#search');
  for (const ch of q) { await page.type('#search', ch, { delay: 95 }); }
  await dwell(3000, 14);             // results filter to the clone cluster
  const row = await page.$('#agent-table-body tr[data-expand]');
  if (row) { await row.click(); await dwell(3600, 18); } // reveal score + layers + celoscan
  const curY = await page.evaluate(() => window.scrollY);
  await scrollTo(curY + 180, 1800);
  await dwell(2600, 14);
  await stopCast();
  fs.writeFileSync(path.join(OUT, 'segC.json'), JSON.stringify({ end: n }));

  // ---- SEGMENT D: close drift on real hero ----
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle0' });
  await sleep(1500);
  await startCast();
  await dwell(3600, 16);
  await stopCast();

  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));
  await browser.close();
  console.log('captured frames:', n);
})().catch(e => { console.error(e); process.exit(1); });
