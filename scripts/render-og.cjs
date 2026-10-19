// Renders the link-preview image (Open Graph, 1200×630) and the Apple touch icon from prototype/og/*.html.
// Usage: NODE_PATH=$(npm root -g) node scripts/render-og.cjs   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.goto('file://' + root + '/prototype/og/og.html'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: root + '/prototype/og/og-image.png' });
  const q = await b.newPage({ viewport: { width: 180, height: 180 } });
  await q.setContent(`<html><body style="margin:0"><svg width="180" height="180" viewBox="0 0 64 64"><rect width="64" height="64" fill="#1c2a4a"/><circle cx="32" cy="32" r="25" fill="#fbf8f1" stroke="#b9975b" stroke-width="1.5"/><circle cx="32" cy="32" r="21.5" fill="none" stroke="#b9975b" stroke-width=".8"/><text x="32" y="42.5" font-family="Georgia,serif" font-size="28" text-anchor="middle" fill="#8e2a2e">L</text></svg></body></html>`);
  await q.screenshot({ path: root + '/prototype/og/apple-touch-icon.png' });
  await b.close(); console.log('wrote prototype/og/og-image.png and apple-touch-icon.png');
})();
