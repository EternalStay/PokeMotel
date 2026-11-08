// Logique du serveur (Edge Function `act`), testée sans Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import * as E from '../src/engine/index.js';
import { handle, summary } from '../supabase/functions/_shared/handle.js';

const T0 = E.localToUtc(2026, 10, 10, 15, E.CONFIG.timeZone);
const row = (state, version = 1) => ({ state: JSON.parse(JSON.stringify(state)), version });

test('serveur : premier chargement = hôtel neuf ; requête inconnue refusée', () => {
  const out = handle(null, { op: 'load' }, T0, E);
  assert.equal(out.status, 200);
  assert.ok(out.created && out.changed);
  assert.equal(out.state.queue.length, 1);
  assert.equal(handle(null, { op: 'pirater' }, T0, E).status, 400);
  assert.equal(handle(null, null, T0, E).status, 400);
});

test('serveur : import de la partie locale à la première connexion seulement', () => {
  const local = E.createState(T0 - E.HOUR, 9);
  local.money = 1234;
  const out = handle(null, { op: 'import', state: local }, T0, E);
  assert.equal(out.state.money >= 1234, true);
  assert.equal(out.state.time, T0, 'le serveur rattrape le temps');
  // Le compte a déjà un hôtel : l'import est ignoré, on garde celui du serveur.
  const mine = E.createState(T0 - E.HOUR, 3);
  const again = handle(row(mine), { op: 'import', state: local }, T0, E);
  assert.equal(again.state.seed, mine.seed);
  // Un état daté du futur est refusé.
  const future = E.createState(T0 + 3 * E.HOUR, 9);
  assert.equal(handle(null, { op: 'import', state: future }, T0, E).status, 400);
});

test('serveur : une action passe par dispatch, avec l’horloge du serveur', () => {
  const s = E.createState(T0 - E.HOUR, 5);
  const g = s.queue[0];
  const out = handle(row(s), { op: 'act', name: 'placeGuest', args: [g, '1-0'] }, T0, E);
  assert.equal(out.res.ok, true);
  assert.equal(out.state.guests[g].roomId, '1-0');
  assert.equal(out.state.guests[g].placedAt, T0);
  // Action refusée : réponse { ok: false } (l'état est quand même rattrapé).
  const bad = handle(row(s), { op: 'act', name: 'placeGuest', args: ['zz', '1-0'] }, T0, E);
  assert.equal(bad.res.ok, false);
  const unknown = handle(row(s), { op: 'act', name: 'setMoney', args: [1e9] }, T0, E);
  assert.equal(unknown.res.ok, false);
});

test('serveur : rien à enregistrer si rien n’a changé ; résumé pour le classement', () => {
  const s = E.createState(T0, 5);
  E.advance(s, T0);
  const out = handle(row(s), { op: 'load' }, T0, E);
  assert.equal(out.changed, false);
  assert.deepEqual(summary(s), { hotel_name: s.hotel.name, level: 1, prestige: s.prestige, stars: 0 });
  s.notices = [{ kind: 'quest', text: 'x', rewards: [] }];
  assert.equal(handle(row(s), { op: 'load' }, T0, E).state.notices.length, 1, 'premier chargement : on garde les fenêtres');
  assert.equal(handle(row(s), { op: 'load', clearNotices: true }, T0, E).state.notices.length, 0);
});

test('serveur : la copie du moteur à côté de la fonction est à jour (node tools/sync-engine.mjs)', () => {
  const src = new URL('../src/engine/', import.meta.url);
  const dst = new URL('../supabase/functions/_shared/engine/', import.meta.url);
  assert.ok(existsSync(dst), 'lancer node tools/sync-engine.mjs');
  for (const f of readdirSync(src).filter((x) => x.endsWith('.js'))) {
    assert.equal(readFileSync(new URL(f, dst), 'utf8'), readFileSync(new URL(f, src), 'utf8'), `${f} n'est pas à jour côté serveur`);
  }
});
