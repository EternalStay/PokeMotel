// Génère les icônes PNG de la PWA à partir de icons/icon.svg (rendu par Chrome).
// Usage : npx playwright install chromium  puis  node tools/make-icons.mjs
// Pensez ensuite à incrémenter ?v= dans index.html et manifest.webmanifest pour
// que les navigateurs et les applis installées reprennent la nouvelle icône.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url);
const svg = readFileSync(new URL('icons/icon.svg', ROOT), 'utf8');
const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const browser = await chromium.launch();
const page = await browser.newPage();

/** maskable : fond plein et dessin réduit à 80 % (zone de sécurité Android). */
async function shot(size, file, maskable = false) {
  await page.setViewportSize({ width: size, height: size });
  const inner = maskable ? Math.round(size * 0.8) : size;
  await page.setContent(`<body style="margin:0;display:grid;place-items:center;width:${size}px;height:${size}px;background:${maskable ? '#2b1a5c' : 'transparent'}">
    <img src="${src}" width="${inner}" height="${inner}"></body>`);
  await page.waitForTimeout(100);
  await page.screenshot({ path: new URL(`icons/${file}`, ROOT).pathname, omitBackground: !maskable });
}

await shot(512, 'icon-512.png');
await shot(192, 'icon-192.png');
await shot(512, 'icon-512-maskable.png', true);
await shot(180, 'apple-touch-icon.png', true);
await shot(32, 'favicon-32.png');
await browser.close();
console.log('Icônes générées dans icons/.');
