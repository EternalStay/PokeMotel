// Succès, Œufs surprise, recommencer, enseigne.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine/index.js';

const TZ = E.CONFIG.timeZone;
const at = (y, m, d, h, min = 0) => E.localToUtc(y, m - 1, d, h, TZ, min);

function blank(now) {
  const s = E.createState(now, 4242);
  s.guests = {};
  s.queue = [];
  s.nextArrival = null;
  s.nextEventAt = null;
  return s;
}

test('succès : 11 compteurs, 39 paliers ; un palier franchi est annoncé une seule fois', () => {
  assert.equal(E.ACHIEVEMENT_KEYS.length, 11);
  assert.equal(E.REWARDS.length, 39);
  const s = blank(at(2026, 11, 9, 12));
  for (let i = 0; i < 9; i++) E.bumpGoal(s, 'hosted', s.time);
  assert.equal(s.notices.filter((n) => n.kind === 'goal').length, 0);
  E.bumpGoal(s, 'hosted', s.time);
  assert.equal(s.notices.filter((n) => n.kind === 'goal').length, 1);
  E.bumpGoal(s, 'hosted', s.time);
  assert.equal(s.notices.filter((n) => n.kind === 'goal').length, 1);
  assert.equal(E.totalPoints(s), 8); // 7,5 arrondi
  // Un saut de plusieurs paliers les annonce tous.
  E.bumpGoal(s, 'hosted', s.time, 200);
  assert.equal(s.notices.filter((n) => n.kind === 'goal').length, 3);
  assert.equal(E.nextReward(s, 'hosted').count, 500);
});

test('succès : titres choisis et appliqués au nom du gérant', () => {
  const s = blank(at(2026, 11, 9, 12));
  s.manager = 'Lou';
  const concierge = E.REWARDS.findIndex((r) => r.title?.name === 'Concierge');
  const beton = E.REWARDS.findIndex((r) => r.title?.pos === 'suffix' && r.goal === 'room');
  assert.equal(E.setTitle(s, concierge).ok, false);
  E.bumpGoal(s, 'hosted', s.time, 10);
  E.bumpGoal(s, 'room', s.time, 10);
  assert.equal(E.setTitle(s, concierge).ok, true);
  assert.equal(E.titled(s, s.manager), 'Concierge Lou');
  E.setTitle(s, beton);
  assert.equal(E.titled(s, s.manager), 'Lou du Béton');
  assert.equal(E.setTitle(s, E.REWARDS.findIndex((r) => r.badge)).ok, false);
  E.setTitle(s, null);
  assert.equal(E.titled(s, 'Lou'), 'Lou');
});

test('succès : départs, services, ramassages, chantiers et labo sont comptés par le moteur', () => {
  const t0 = at(2026, 11, 9, 12);
  const s = blank(t0);
  s.hotel.level = 3;
  s.money = 5000;
  const g = E.enqueueNewGuest(s, t0);
  g.likes = []; g.dislikes = []; g.baseSat = 7; g.stay = 1; g.nightsLeft = 1;
  assert.ok(E.placeGuest(s, g.id, '1-0', t0).ok);
  E.buildRoom(s, '0-0', 'laverie', t0);
  E.advance(s, at(2026, 11, 10, 11));
  assert.equal(s.goals.room, 1);
  assert.equal(s.goals.hosted, 1);
  assert.equal(s.goals.okbase, 1);
  // Ramassage : l'objet oublié (forcé) compte.
  s.rooms['1-1'].leftItem = { money: 25 };
  E.collectLeftover(s, '1-1', s.time);
  assert.equal(s.goals.pick, 1);
});

test('Œuf surprise : ne paie jamais, survit au minuit de son arrivée, 3 au plus, compte comme ami bien traité', () => {
  const t0 = at(2026, 11, 9, 15);
  const s = blank(t0);
  const r = E.receiveParcel(s, 'Camille', t0);
  assert.ok(r.ok);
  const g = s.guests[r.guestId];
  assert.equal(g.parcel.from, 'Camille');
  assert.equal(g.star, false);
  assert.equal(g.nightsLeft, 1);
  assert.ok(E.receiveParcel(s, 'Camille', t0).ok);
  assert.ok(E.receiveParcel(s, 'Sacha', t0).ok);
  assert.equal(E.receiveParcel(s, 'Sacha', t0).ok, false, '3 au plus');
  // Un client ordinaire en file, pour comparer.
  const plain = E.enqueueNewGuest(s, t0);
  E.advance(s, at(2026, 11, 10, 1));
  assert.ok(!s.guests[plain.id], 'le client ordinaire est reparti à minuit');
  assert.equal(s.queue.length, 3, 'les Œufs du jour restent');
  // Installé et choyé, il ne rapporte rien mais compte comme ami bien traité.
  E.advance(s, at(2026, 11, 10, 8));
  const egg = s.guests[s.queue[0]];
  egg.likes = []; egg.dislikes = []; egg.baseSat = 8;
  assert.ok(E.placeGuest(s, egg.id, '1-0', s.time).ok);
  const money = s.money;
  E.advance(s, at(2026, 11, 11, 11));
  assert.equal(s.money, money, 'un Œuf ne paie ni à minuit ni au départ');
  assert.equal(s.goals.okfrnd, 1);
  // Les deux autres, jamais installés, sont repartis au minuit suivant.
  assert.equal(E.parcelsAt(s), 0);
});

test('Œuf surprise : un seul envoi par jour', () => {
  const t0 = at(2026, 11, 9, 15);
  const s = blank(t0);
  assert.ok(E.markParcelSent(s, t0).ok);
  assert.equal(E.markParcelSent(s, t0 + E.HOUR).ok, false);
  assert.ok(E.canSendParcel(s, at(2026, 11, 10, 7)));
});

test('recommencer : hôtel neuf (gemmes gardées) ; personnalisé = accueil seul et 600', () => {
  const t0 = at(2026, 11, 9, 12);
  const s = E.createState(t0, 1);
  s.gems = 17;
  s.money = 999;
  assert.ok(E.dispatch(s, 'restartHotel', [false], t0 + E.MINUTE).ok);
  assert.equal(s.gems, 17);
  assert.equal(s.money, 0);
  assert.equal(Object.values(s.rooms).filter((r) => r.kind === 'bedroom').length, 6);
  assert.ok(E.dispatch(s, 'restartHotel', [true], t0 + 2 * E.MINUTE).ok);
  assert.deepEqual(Object.keys(s.rooms), ['0-0']);
  assert.equal(s.rooms['0-0'].kind, 'lobby');
  assert.equal(s.money, E.CUSTOM_START_MONEY);
  assert.equal(s.queue.length, 1);
  // Plus possible après la mission de la première nuit.
  s.questsDone = E.TUTORIAL_END + 1;
  assert.equal(E.dispatch(s, 'restartHotel', [false], t0 + 3 * E.MINUTE).ok, false);
});

test('enseigne : 13 couleurs de néon', () => {
  const s = blank(at(2026, 11, 9, 12));
  assert.equal(E.NEON_COLORS.length, 13);
  assert.ok(E.setNeon(s, 12).ok);
  assert.equal(s.hotel.neon, 12);
  assert.equal(E.setNeon(s, 13).ok, false);
  assert.equal(E.setNeon(s, 1.5).ok, false);
});

test('migration v7 → v8 : succès repris des statistiques', () => {
  const s = E.createState(at(2026, 11, 9, 12), 3);
  s.v = 7;
  delete s.goals; delete s.title; delete s.manager; delete s.hotel.neon;
  s.stats.placed = 12; s.stats.services = 4;
  const m = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(m.v, E.SAVE_VERSION);
  assert.equal(m.goals.hosted, 12);
  assert.equal(m.goals.serv, 4);
  assert.equal(m.hotel.neon, E.DEFAULT_NEON);
});
