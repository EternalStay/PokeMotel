// La PWA doit démarrer hors-ligne : chaque module du jeu est dans le cache du service worker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);

test('service worker : tous les modules sont mis en cache pour le hors-ligne', () => {
  const sw = readFileSync(new URL('sw.js', root), 'utf8');
  for (const dir of ['src/engine', 'src/client']) {
    for (const f of readdirSync(new URL(dir, root)).filter((x) => x.endsWith('.js'))) {
      assert.ok(sw.includes(`'./${dir}/${f}'`), `${dir}/${f} manque dans APP_SHELL (sw.js)`);
    }
  }
});
