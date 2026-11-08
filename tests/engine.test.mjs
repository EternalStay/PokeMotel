// Tests du moteur : `npm test` (node:test, aucune dépendance).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG, createState, advance, computeSatisfaction, previewPlacement, placeGuest, moveGuest, buildRoom,
  localToUtc, nextLocalHour, zonedParts, occupancy, assignStaff, useItem, fulfillRequest, collectLeftover,
  extendRoom, upgradeRoom, hireStaff, collectTax, taxAmount, generateGuest, nightGain, firstTaxAmount, extendCost,
  TYPES,
} from '../src/engine/index.js';

const TZ = CONFIG.timeZone;
const at = (y, m, d, h, min = 0) => localToUtc(y, m - 1, d, h, TZ, min);

/** Partie vierge (file vide) avec des clients contrôlés. */
function blank(now) {
  const s = createState(now, 12345);
  s.guests = {};
  s.queue = [];
  s.nextArrival = null;
  return s;
}
function guest(s, props) {
  const g = { id: `t${s.nextGuestId++}`, name: props.type, look: 0, star: false, baseSat: 3, likes: [], dislikes: [],
    stay: 2, nightsLeft: 2, roomId: null, moves: 0, mods: { care: 0, service: 0, gift: 0 }, cared: false, placedOnce: true,
    request: null, nextRequestAt: null, arrivedAt: s.time, ...props };
  s.guests[g.id] = g;
  return g;
}

test('heure locale : minuit et 10h (heure d\'été comprise)', () => {
  const t = at(2026, 11, 8, 15, 30);
  assert.equal(zonedParts(t, TZ).h, 15);
  assert.equal(zonedParts(nextLocalHour(t, 0, TZ), TZ).d, 9);
  const dst = nextLocalHour(at(2026, 3, 28, 20), 10, TZ);
  assert.equal(zonedParts(dst, TZ).h, 10);
});

test('nouvelle partie : caisse vide, 6 chambres, 1 client ; la 1re mission amène le second', () => {
  const s = createState(at(2026, 11, 10, 12), 1);
  assert.equal(s.money, 0);
  assert.equal(s.gems, 0);
  assert.equal(Object.values(s.rooms).filter((r) => r.kind === 'bedroom').length, 6);
  assert.equal(s.queue.length, 1);
  const a = s.guests[s.queue[0]];
  assert.equal(a.type, 'poison');
  placeGuest(s, a.id, '1-0', s.time);
  const b = s.guests[s.queue[0]];
  assert.equal(b.type, 'feu');
  assert.ok(a.likes.includes('chaleur') && b.likes.includes('odeur'));
  // Placés côte à côte, ils sont ravis : 3 + 2 (aura aimée) + 2 (voisinage) = 7.
  placeGuest(s, b.id, '1-1', s.time);
  assert.equal(computeSatisfaction(s, a).value, 7);
  assert.equal(computeSatisfaction(s, b).value, 7);
  // Séparés, ils sont malheureux : 3 − 3 − 3 = 0.
  moveGuest(s, b.id, '2-2', s.time);
  assert.equal(computeSatisfaction(s, a).value, 0);
});

test('satisfaction : goût présent +2 par source, absent −3 ; aversion présente −3, absente +2', () => {
  const s = blank(at(2026, 11, 10, 12));
  const g = guest(s, { type: 'eau', likes: ['chaleur'], dislikes: ['odeur'], roomId: '1-1' });
  assert.equal(computeSatisfaction(s, g).value, 3 - 3 + 2);
  guest(s, { type: 'feu', roomId: '1-0' });
  guest(s, { type: 'feu', roomId: '1-2' });
  assert.equal(computeSatisfaction(s, g).value, 3 + 4 + 2);
  guest(s, { type: 'poison', roomId: '2-1' });
  assert.equal(computeSatisfaction(s, g).value, 3 + 4 - 3);
});

test('satisfaction : on ne respire pas sa propre aura ; Spectre invisible ; Jovial +1', () => {
  const s = blank(at(2026, 11, 10, 12));
  const g = guest(s, { type: 'feu', likes: ['chaleur', 'voisinage'], roomId: '1-0' });
  assert.equal(computeSatisfaction(s, g).value, 0); // 3 − 3 − 3
  guest(s, { type: 'spectre', roomId: '1-1' });
  assert.equal(computeSatisfaction(s, g).value, 0);
  guest(s, { type: 'normal', roomId: '2-0' });
  assert.equal(computeSatisfaction(s, g).value, 3 - 3 + 2 + 1); // voisinage +2, jovial +1
});

test('équipements : aura dans la chambre, cocon isolant', () => {
  const s = blank(at(2026, 11, 10, 12));
  s.rooms['1-0'].equip = ['radiateur'];
  const g = guest(s, { type: 'eau', likes: ['chaleur'], dislikes: ['odeur'], roomId: '1-0' });
  assert.equal(computeSatisfaction(s, g).value, 7);
  guest(s, { type: 'poison', roomId: '1-1' });
  assert.equal(computeSatisfaction(s, g).value, 2);
  s.rooms['1-0'].equip = ['radiateur', 'cocon'];
  assert.equal(computeSatisfaction(s, g).value, 7);
});

test('aperçu de placement : impact sur les voisins', () => {
  const s = blank(at(2026, 11, 10, 12));
  guest(s, { type: 'eau', dislikes: ['chaleur'], roomId: '1-0' });
  const feu = guest(s, { type: 'feu' });
  s.queue.push(feu.id);
  assert.equal(previewPlacement(s, feu, '1-1').othersDelta, -5); // +2 (absente) → −3 (présente)
});

test('gains : 50 × facteur × niveau de chambre', () => {
  const room = { level: 1, equip: [] };
  assert.equal(nightGain(10, room), 50);
  assert.equal(nightGain(7, room), 27);
  assert.equal(nightGain(10, { level: 3, equip: [] }), 80);
});

test('minuit : paiement, file vidée, aide du Consortium à 300', () => {
  const s = blank(at(2026, 11, 10, 23, 50));
  const g = guest(s, { type: 'eau', roomId: '1-0', baseSat: 10 });
  const q = guest(s, { type: 'feu' });
  s.queue.push(q.id);
  advance(s, at(2026, 11, 11, 0, 5));
  assert.equal(s.money, CONFIG.subsidyTarget); // 50 gagnés < 100 → renfloué à 300
  assert.equal(s.queue.length, 0);
  assert.equal(s.guests[g.id].nightsLeft, 1);
});

test('départ à 10h : prestige à 10, chambre détruite par un Pyromane', () => {
  const s = blank(at(2026, 11, 10, 20));
  s.hotel.level = 2;
  const g = guest(s, { type: 'eau', roomId: '1-0', baseSat: 10, stay: 1, nightsLeft: 1 });
  const p = guest(s, { type: 'feu', roomId: '2-2', baseSat: 6, stay: 1, nightsLeft: 1 });
  advance(s, at(2026, 11, 11, 9, 59));
  assert.ok(s.guests[g.id]);
  advance(s, at(2026, 11, 11, 10, 1));
  assert.equal(s.guests[g.id], undefined);
  assert.equal(s.guests[p.id], undefined);
  assert.equal(s.prestige, CONFIG.startPrestige + 1);
  assert.equal(s.rooms['2-2'].damage, CONFIG.maxDamage);
});

test('arrivées : toutes les 8 h sans personnel, jamais la nuit, plus vite avec la réception', () => {
  const s = createState(at(2026, 11, 10, 9), 777);
  assert.equal(s.nextArrival - s.createdAt, 8 * 3600000);
  s.queue = [];
  advance(s, at(2026, 11, 11, 5, 59));
  assert.equal(zonedParts(s.lastArrival, TZ).h, 17); // arrivé à 17h (puis reparti à minuit, non placé)
  assert.equal(zonedParts(s.nextArrival, TZ).h, 6);  // 1h du matin → repoussé au réveil
  s.money = 1000;
  hireStaff(s, s.time);
  assignStaff(s, s.staff[0].id, 'lobby', s.time);
  advance(s, at(2026, 11, 11, 6, 1));
  const delay = s.nextArrival - s.lastArrival;
  assert.equal(delay, 5 * 3600000);
});

test('clients générés : types et goûts selon le niveau', () => {
  const s = blank(at(2026, 11, 10, 12));
  s.nextGuestId = 10;
  for (let i = 0; i < 200; i++) {
    const g = generateGuest(s, s.time);
    assert.ok(TYPES[g.type].unlock <= 1);
    assert.equal(g.likes.length + g.dislikes.length, 2);
    for (const a of [...g.likes, ...g.dislikes]) assert.ok(['humidite', 'chaleur', 'odeur'].includes(a));
    assert.equal(g.stay, 1);
  }
  s.hotel.level = 6;
  const types = new Set();
  for (let i = 0; i < 400; i++) types.add(generateGuest(s, s.time).type);
  assert.equal(types.size, 11); // tout sauf l'Électrik (niveau 7)
  assert.ok(!types.has('electrik'));
});

test('personnel : réparation et petites attentions (4 h, 40 %)', () => {
  const now = at(2026, 11, 10, 12);
  const s = blank(now);
  s.money = 1000;
  hireStaff(s, now);
  const st = s.staff[0];
  s.rooms['1-0'].damage = 2;
  assert.ok(assignStaff(s, st.id, '1-0', now).ok);
  advance(s, now + 6 * 60000);
  assert.equal(s.rooms['1-0'].damage, 0);
  const g = guest(s, { type: 'glace', roomId: '1-1' });
  assert.ok(assignStaff(s, st.id, '1-1', s.time).ok);
  assert.equal(st.task.end - s.time, 7 * 3600000); // 4 h + 3 h (Frileux)
});

test('objets, cadeaux, objets oubliés', () => {
  const now = at(2026, 11, 10, 12);
  const s = blank(now);
  s.inventory = { radiateur: 1, panier: 1, kit: 1 };
  assert.ok(useItem(s, 'radiateur', '1-0', now).ok);
  const g = guest(s, { type: 'eau', roomId: '1-1' });
  assert.ok(useItem(s, 'panier', '1-1', now).ok);
  assert.equal(g.mods.gift, 1);
  s.rooms['1-2'].damage = 3;
  assert.ok(useItem(s, 'kit', '1-2', now).ok);
  s.rooms['2-0'].leftItem = { money: 50 };
  const q = guest(s, { type: 'feu' });
  s.queue.push(q.id);
  assert.equal(placeGuest(s, q.id, '2-0', now).ok, false);
  assert.ok(collectLeftover(s, '2-0', now).ok);
  assert.ok(placeGuest(s, q.id, '2-0', now).ok);
});

test('services : pas de demande avant le niveau 2, puis Laverie', () => {
  const now = at(2026, 11, 10, 9);
  const s = blank(now);
  const g = guest(s, { type: 'eau' });
  s.queue.push(g.id);
  placeGuest(s, g.id, '1-0', now);
  assert.equal(g.nextRequestAt, null);
  s.hotel.level = 2;
  s.money = 1000;
  assert.ok(buildRoom(s, '1-0', 'laverie', now).ok === false); // chambre occupée
  assert.ok(buildRoom(s, '0-0', 'laverie', now).ok); // au rez-de-chaussée
  advance(s, now + 31 * 60000); // 30 min de travaux
  moveGuest(s, g.id, '1-1', s.time);
  g.request = { kind: 'linge', until: s.time + 3600000 };
  assert.ok(fulfillRequest(s, g.id, s.time).ok);
  assert.equal(g.mods.service, 1);
});

test('coûts : agrandissement, amélioration, personnel, taxes', () => {
  const s = blank(at(2026, 11, 10, 12));
  s.money = 10000;
  assert.equal(extendCost(s), 0); // 9 pièces (accueil compris) : gratuit
  assert.ok(extendRoom(s, 3, 0, s.time).ok);
  assert.equal(extendCost(s), 50); // 10 pièces
  assert.ok(upgradeRoom(s, '1-0', s.time).ok);
  assert.equal(s.money, 10000 - 250);
  hireStaff(s, s.time);
  hireStaff(s, s.time);
  assert.equal(s.money, 10000 - 250 - 150 - 250);
  assert.equal(firstTaxAmount(at(2026, 11, 9, 12)), 100); // lundi
  assert.equal(firstTaxAmount(at(2026, 11, 14, 12)), 10); // samedi
  s.hotel.level = 2;
  assert.equal(taxAmount(s), 500);
});

test('taxe de la nuit de dimanche à lundi : niveau +1 et prestige', () => {
  const s = blank(at(2026, 11, 14, 12)); // samedi
  s.money = 1000;
  s.activeWeek = true; // un client a été placé dans la semaine
  advance(s, at(2026, 11, 15, 12));
  assert.equal(s.hotel.level, 1);
  advance(s, at(2026, 11, 16, 0, 1));
  assert.equal(s.hotel.level, 2);
  assert.equal(s.prestige, CONFIG.startPrestige + 20);
  assert.equal(s.gems, 10); // 10 × le niveau quitté
  s.money = 0;
  s.activeWeek = true;
  collectTax(s, s.time);
  assert.equal(s.hotel.level, 2);
});

test('rattrapage hors-ligne sur deux semaines, déterministe', () => {
  const run = () => {
    const s = createState(at(2026, 11, 8, 9), 42);
    placeGuest(s, s.queue[0], '1-0', s.time);
    placeGuest(s, s.queue[0], '1-1', s.time);
    advance(s, at(2026, 11, 22, 9));
    return s;
  };
  const a = run();
  const b = run();
  assert.deepEqual(a, b);
  assert.equal(a.stats.nights, 14);
  assert.equal(Object.keys(occupancy(a)).length, 0);
});

// --- V0.4 : quêtes, laboratoire, talents, événements -------------------------
import { QUESTS, questEvent, studyGuest, spendTalent, resetTalents, runEvent, migrate, renameHotel, talent } from '../src/engine/index.js';

test('quêtes : le tutoriel s\'enchaîne et donne ses récompenses', () => {
  const s = createState(at(2026, 11, 10, 12), 3);
  assert.equal(s.quest.id, 0);
  const queue = s.queue.length;
  placeGuest(s, s.queue[0], '1-0', s.time);
  assert.equal(s.quest.id, 1);
  assert.equal(s.money, 50);
  assert.equal(s.queue.length, queue - 1 + 1); // un client offert
  placeGuest(s, s.queue[0], '1-1', s.time);
  assert.equal(s.quest.id, 2);
  assert.equal(s.inventory.compost, 1);
  assert.equal(s.inventory.radiateur, 1);
  assert.ok(s.notices.length >= 2);
});

test('quêtes : après le tutoriel, les missions répétables bouclent', () => {
  const s = blank(at(2026, 11, 10, 12));
  const last = QUESTS.length - 1;
  s.quest = { id: last, done: QUESTS[last].goals.map(() => true) };
  s.quest.done[0] = false;
  const fame = s.prestige;
  questEvent(s, QUESTS[last].goals[0], s.time);
  assert.equal(s.prestige, fame + 5);
  assert.ok(QUESTS[s.quest.id].repeat);
});

test('laboratoire : 5 études = 1 point de recherche ; les autres clients s\'inquiètent', () => {
  const now = at(2026, 11, 10, 12);
  const s = blank(now);
  s.rooms['2-2'] = { ...s.rooms['2-2'], kind: 'lab', sub: 'labo' };
  const witness = guest(s, { type: 'eau', roomId: '1-0' });
  let t = now;
  for (let i = 0; i < 5; i++) {
    const g = guest(s, { type: 'feu' });
    s.queue.push(g.id);
    assert.ok(studyGuest(s, g.id, '2-2', t).ok);
    assert.equal(studyGuest(s, g.id, '2-2', t).ok, false);
    t += 2 * 3600000 + 1000;
  }
  // La fiole est posée au sol : il faut la ramasser.
  assert.equal(s.research.points, 0);
  assert.deepEqual(s.rooms['2-2'].leftItem, { vials: 1 });
  assert.ok(collectLeftover(s, '2-2', t).ok);
  assert.equal(s.research.points, 1);
  assert.equal(witness.mods.malus, 5);
});

test('talents : rangées débloquées tous les 4 points, effets appliqués', () => {
  const s = blank(at(2026, 11, 10, 12));
  s.research.points = 6;
  assert.equal(spendTalent(s, 'extendCost', s.time).ok, false); // rangée 2 verrouillée
  for (let i = 0; i < 3; i++) assert.ok(spendTalent(s, 'repairCost', s.time).ok);
  assert.ok(spendTalent(s, 'easyMove', s.time).ok);
  assert.ok(spendTalent(s, 'taxDiscount', s.time).ok === false);
  assert.ok(spendTalent(s, 'extendCost', s.time).ok);
  const g = guest(s, { type: 'eau', roomId: '1-0', moves: 2 });
  assert.equal(computeSatisfaction(s, g).lines.find((l) => l.kind === 'move').value, -1); // Faculté d'adaptation
  assert.equal(resetTalents(s, s.time).ok, false); // 20 gemmes
  s.gems = 20;
  assert.ok(resetTalents(s, s.time).ok);
  assert.equal(s.gems, 0);
  assert.equal(s.research.points, 6);
  assert.equal(talent(s, 'repairCost'), 0);
});

test('événements : un événement modifie un client et en reprogramme un autre', () => {
  const s = blank(at(2026, 11, 10, 12));
  s.hotel.level = 4;
  for (const id of ['1-0', '1-1', '2-0']) guest(s, { type: 'eau', roomId: id });
  const before = s.nextEventAt;
  for (let i = 0; i < 30; i++) runEvent(s, s.time + i);
  assert.notEqual(s.nextEventAt, before);
  assert.ok(s.notices.length > 0);
});

test('migration d\'une sauvegarde v3', () => {
  const s = createState(at(2026, 11, 10, 12), 9);
  s.v = 3;
  delete s.quest; delete s.research; delete s.nextEventAt;
  for (const g of Object.values(s.guests)) delete g.mods.malus;
  const m = migrate(s);
  assert.ok(m && m.quest && m.research);
  assert.equal(m.v, 9);
  assert.equal(m.rooms['0-2'].kind, 'lobby');
  assert.equal(m.gems, 0);
  assert.ok(renameHotel(m, 'Test').ok);
});

test('équipements (règle d\'origine) : installables chambre occupée, détruits sans retour en réserve', async () => {
  const { removeEquip } = await import('../src/engine/index.js');
  const s = blank(at(2026, 11, 10, 12));
  guest(s, { type: 'eau', roomId: '1-0' });
  s.inventory = { radiateur: 1 };
  assert.ok(useItem(s, 'radiateur', '1-0', s.time).ok);
  assert.ok(removeEquip(s, '1-0', 'radiateur', s.time).ok);
  assert.equal(s.inventory.radiateur, undefined);
  assert.deepEqual(s.rooms['1-0'].equip, []);
});

// --- Lot A : conformité aux règles d'origine ---------------------------------
import { isLocked, welcomeBack, attractGuest, buyItem, screamers } from '../src/engine/index.js';

test('un client paie deux fois : à minuit puis à son départ', () => {
  const s = blank(at(2026, 11, 10, 20));
  s.hotel.level = 4; // pas d'aide du Consortium
  s.money = 1000;
  guest(s, { type: 'eau', roomId: '1-0', baseSat: 10, stay: 1, nightsLeft: 1 });
  advance(s, at(2026, 11, 11, 0, 5));
  assert.equal(s.money, 1050);
  advance(s, at(2026, 11, 11, 10, 5));
  assert.equal(s.money, 1100);
  assert.equal(s.gems, 1); // client comblé
});

test('déménagement : −2 une seule fois ; l\'employé suit le client', () => {
  const s = blank(at(2026, 11, 10, 12));
  s.money = 1000;
  const g = guest(s, { type: 'eau', roomId: '1-0' });
  hireStaff(s, s.time);
  assert.ok(assignStaff(s, s.staff[0].id, '1-0', s.time).ok);
  const base = computeSatisfaction(s, g).value;
  assert.ok(moveGuest(s, g.id, '1-1', s.time).ok);
  assert.equal(s.staff[0].task.roomId, '1-1');
  assert.ok(moveGuest(s, g.id, '1-2', s.time).ok);
  assert.equal(computeSatisfaction(s, g).value, base - 2);
});

test('Star : l\'état de la chambre compte double ; cadeau refusé après un bonus', () => {
  const s = blank(at(2026, 11, 10, 12));
  s.rooms['1-0'].damage = 1;
  const v = guest(s, { type: 'eau', roomId: '1-0', star: true, baseSat: 10 });
  assert.equal(computeSatisfaction(s, v).lines.find((l) => l.kind === 'room').value, -2);
  s.inventory = { panier: 2 };
  v.mods.care = 1;
  assert.equal(useItem(s, 'panier', '1-0', s.time).ok, false);
});

test('Matelas : +1 à chaque nuit ; feux d\'artifice : +6 puis la chambre saute', () => {
  const s = blank(at(2026, 11, 10, 20));
  s.hotel.level = 4;
  s.rooms['1-0'].equip = ['matelas'];
  s.rooms['2-2'].equip = ['feux', 'radiateur'];
  const g = guest(s, { type: 'eau', roomId: '1-0', stay: 3, nightsLeft: 3 });
  const f = guest(s, { type: 'eau', roomId: '2-2', stay: 3, nightsLeft: 3 });
  advance(s, at(2026, 11, 11, 0, 5));
  advance(s, at(2026, 11, 12, 0, 5));
  assert.equal(g.mods.comfort, 2);
  assert.equal(f.mods.fireworks, 6);
  assert.equal(s.rooms['2-2'].damage, 3);
  assert.deepEqual(s.rooms['2-2'].equip, []);
});

test('caisse négative autorisée pour les attentions ; billets au sol = 25', () => {
  const s = blank(at(2026, 11, 10, 12));
  s.staff.push({ id: 's9', name: 'X', look: 0, task: null });
  guest(s, { type: 'eau', roomId: '1-0' });
  assert.ok(assignStaff(s, 's9', '1-0', s.time).ok);
  assert.ok(s.money < 0);
  assert.equal(CONFIG.moneyPickup, 25);
});

test('salle de loisir : le client y va seul, 5 par visite, puis 5 h de repos', () => {
  const now = at(2026, 11, 10, 9);
  const s = blank(now);
  s.rooms['2-2'] = { ...s.rooms['2-2'], kind: 'leisure', sub: 'sauna' };
  const g = guest(s, { type: 'eau', likes: ['chaleur'], stay: 2, nightsLeft: 2 });
  s.queue.push(g.id);
  placeGuest(s, g.id, '1-0', now);
  const m0 = s.money; // la 1re mission a pu verser une récompense
  assert.ok(g.nextLeisureAt > now);
  advance(s, g.nextLeisureAt + 1000);
  assert.equal(g.leisure.roomId, '2-2');
  const back = g.leisure.until;
  assert.ok(back - g.nextLeisureAt >= 0);
  advance(s, back + 1000);
  assert.equal(s.money, m0 + 5);
  assert.equal(g.nextLeisureAt, back + 5 * 3600000);
});

test('services : une demande visible dans ses 6 dernières heures ; rien si le client part avant', () => {
  const now = at(2026, 11, 10, 9);
  const s = blank(now);
  s.hotel.level = 2;
  const g = guest(s, { type: 'eau', stay: 1, nightsLeft: 1 });
  s.queue.push(g.id);
  placeGuest(s, g.id, '1-0', now);
  // Départ le lendemain 10 h (25 h) : échéance entre 7 h et 18 h après l'arrivée.
  assert.ok(g.nextRequestAt >= now + 1 * 3600000 && g.nextRequestAt <= now + 12 * 3600000);
  advance(s, g.nextRequestAt + 1000);
  assert.ok(g.request);
  advance(s, g.request.until + 1000);
  assert.equal(g.request, null);
});

test('Insecte : paie moitié, ×1,7 à 10 ; Combat : hurle à 4 ou moins (−3 aux autres)', () => {
  assert.equal(nightGain(8, { level: 1, equip: [] }, null, 'insecte'), 17);
  assert.equal(nightGain(10, { level: 1, equip: [] }, null, 'insecte'), 85);
  const s = blank(at(2026, 11, 10, 12));
  const far = guest(s, { type: 'eau', roomId: '2-2', baseSat: 8 });
  const c = guest(s, { type: 'combat', roomId: '1-0', baseSat: 4 });
  assert.equal(screamers(s).length, 1);
  assert.equal(computeSatisfaction(s, far).value, 8 - 3);
  assert.equal(computeSatisfaction(s, c).lines.some((l) => l.kind === 'hysteria'), false);
  c.baseSat = 5;
  assert.equal(computeSatisfaction(s, far).value, 8);
});

test('Électrik : instable à 10, explose 3 h plus tard', () => {
  const s = blank(at(2026, 11, 10, 12));
  const b = guest(s, { type: 'electrik', roomId: '1-0', baseSat: 10 });
  advance(s, s.time + 1000);
  assert.ok(b.bombAt);
  advance(s, b.bombAt + 1000);
  assert.equal(s.guests[b.id], undefined);
  assert.equal(s.rooms['1-0'].damage, CONFIG.maxDamage);
});

test('Psy placé à 8 ou plus : un autre Psy arrive ; Roche vaut 2 au labo', () => {
  const s = blank(at(2026, 11, 10, 12));
  const p = guest(s, { type: 'psy', baseSat: 8, placedOnce: false });
  s.queue.push(p.id);
  placeGuest(s, p.id, '1-0', s.time);
  assert.equal(s.guests[s.queue[0]].type, 'psy');
  s.rooms['2-2'] = { ...s.rooms['2-2'], kind: 'lab', sub: 'labo' };
  const r = guest(s, { type: 'roche' });
  s.queue.push(r.id);
  studyGuest(s, r.id, '2-2', s.time);
  assert.equal(s.research.progress, 2);
});

test('taxe : le Consortium ne passe pas si l\'hôtel est resté inactif', () => {
  const s = blank(at(2026, 11, 14, 12));
  s.money = 1000;
  advance(s, at(2026, 11, 16, 0, 1));
  assert.equal(s.hotel.level, 1);
  assert.equal(s.money, 1000);
});

test('verrou de minuit et retour après 5 jours d\'absence', () => {
  assert.ok(isLocked(at(2026, 11, 10, 23, 59)));
  assert.ok(isLocked(at(2026, 11, 11, 0, 0)));
  assert.ok(!isLocked(at(2026, 11, 11, 0, 1)));
  const s = blank(at(2026, 11, 10, 12));
  s.money = -40;
  s.rooms['1-0'].damage = 4;
  advance(s, at(2026, 11, 16, 12));
  assert.equal(s.rooms['1-0'].damage, 0);
  assert.equal(s.queue.length, CONFIG.queueMax);
  assert.ok(s.notices.some((n) => n.kind === 'welcome'));
});

test('gemmes : boutique, « Attirer un client », employés au-delà du 4e', () => {
  const s = blank(at(2026, 11, 10, 12));
  assert.equal(buyItem(s, 'radiateur', s.time).ok, false);
  s.gems = 60;
  assert.ok(buyItem(s, 'radiateur', s.time).ok);
  assert.equal(s.gems, 56);
  assert.ok(attractGuest(s, s.time).ok);
  assert.equal(s.queue.length, 1);
  s.money = 1e6;
  s.gems = 0;
  for (let i = 0; i < 4; i++) assert.ok(hireStaff(s, s.time).ok);
  assert.equal(hireStaff(s, s.time).ok, false); // 45 gemmes
  s.gems = 45;
  assert.ok(hireStaff(s, s.time).ok);
  assert.equal(s.gems, 0);
});

test('missions : gemmes à la fin du tutoriel, répétables jamais deux fois de suite', () => {
  const s = blank(at(2026, 11, 10, 12));
  const night = QUESTS.findIndex((q) => q.goals.includes('midnight'));
  s.quest = { id: night, done: [false] };
  questEvent(s, 'midnight', s.time);
  assert.equal(s.gems, 10);
  for (let i = 0; i < 20; i++) {
    const id = s.quest.id;
    if (!QUESTS[id].repeat) { s.quest = { id: QUESTS.length - 1, done: QUESTS.at(-1).goals.map(() => false) }; continue; }
    s.quest.done = s.quest.done.map(() => true); s.quest.done[0] = false;
    questEvent(s, QUESTS[id].goals[0], s.time);
    assert.notEqual(s.quest.id, id);
  }
});

// --- Lot C : pièces et construction -------------------------------------------
test('rez-de-chaussée : 2 emplacements + accueil à droite, pas de chambre', () => {
  const s = createState(at(2026, 11, 10, 12), 5);
  assert.equal(s.rooms['0-2'].kind, 'lobby');
  assert.equal(s.rooms['0-0'].kind, 'empty');
  s.money = 1000;
  assert.equal(buildRoom(s, '0-0', 'bedroom', s.time).ok, false);
  assert.equal(buildRoom(s, '0-2', 'labo', s.time).ok, false);
});

test('agrandissement case par case : contact, porte-à-faux, largeur 7, glissement du rez-de-chaussée', async () => {
  const { extendCheck, hotelSpan } = await import('../src/engine/index.js');
  const s = blank(at(2026, 11, 10, 12));
  s.money = 100000;
  assert.equal(extendCheck(s, 2, 3), null); // porte-à-faux permis, comme l'original
  assert.ok(extendCheck(s, 2, 5)); // ne touche aucune pièce de l'étage
  assert.ok(extendCheck(s, 4, 0)); // pas d'étage 3 en dessous
  assert.ok(extendCheck(s, 3, 3)); // nouvel étage : rien en dessous, la case flotterait
  assert.equal(extendCheck(s, 3, 0), null); // nouvel étage posé sur une pièce
  assert.ok(extendRoom(s, 3, 1, s.time).ok); // nouvel étage
  // Rez-de-chaussée à droite : la case neuve prend la 1re place, l'accueil reste au bout.
  const r = extendRoom(s, 0, 3, s.time);
  assert.ok(r.ok);
  assert.equal(r.roomId, '0-0');
  assert.equal(s.rooms['0-3'].kind, 'lobby');
  // À gauche : tout l'hôtel se décale, les clients suivent.
  const g = guest(s, { type: 'eau', roomId: '1-0' });
  assert.ok(extendRoom(s, 0, -1, s.time).ok);
  assert.equal(g.roomId, '1-1');
  assert.equal(s.rooms['0-4'].kind, 'lobby');
  for (const c of [5, 6]) assert.ok(extendRoom(s, 0, c, s.time).ok);
  assert.equal(hotelSpan(s).width, 7);
  assert.equal(extendRoom(s, 0, 7, s.time).ok, false);
});

test('amélioration en 10 min ; remplacement direct d\'une pièce', () => {
  const s = blank(at(2026, 11, 10, 12));
  s.money = 10000;
  s.hotel.level = 3;
  assert.ok(upgradeRoom(s, '1-0', s.time).ok);
  assert.equal(s.rooms['1-0'].level, 1);
  advance(s, s.time + 10 * 60000 + 1);
  assert.equal(s.rooms['1-0'].level, 2);
  s.rooms['1-1'].equip = ['radiateur'];
  assert.ok(buildRoom(s, '1-1', 'sauna', s.time).ok);
  assert.deepEqual(s.rooms['1-1'].equip, []);
  assert.equal(s.rooms['1-1'].buildTarget, 'sauna');
  guest(s, { type: 'eau', roomId: '1-2' });
  assert.equal(buildRoom(s, '1-2', 'piscine', s.time).ok, false);
});

// --- Lot D : récaps --------------------------------------------------------------
test('récaps : bilan de minuit (dernière nuit seulement) et taxe impayée', () => {
  const s = blank(at(2026, 11, 14, 20)); // samedi soir
  s.hotel.level = 4;
  s.notices = [];
  s.nextEventAt = null; // pas d'événement aléatoire
  guest(s, { type: 'eau', roomId: '1-0', baseSat: 8, stay: 3, nightsLeft: 3 });
  s.activeWeek = true;
  advance(s, at(2026, 11, 16, 0, 5)); // deux minuits, dont celui de la taxe
  const nights = s.notices.filter((n) => n.kind === 'night');
  assert.equal(nights.length, 1);
  assert.equal(nights[0].lines[0].pay, 35);
  const tax = s.notices.find((n) => n.kind === 'tax');
  assert.ok(tax && !tax.paid && tax.missing > 0);
});

// --- Lot E : décoration -------------------------------------------------------------
test('déco d\'étage : chaque objet change la valeur ; un nouvel étage hérite', async () => {
  const { floorDeco, WALL_COLORS_WARM } = await import('../src/engine/index.js');
  const s = blank(at(2026, 11, 10, 12));
  s.money = 1000;
  s.inventory = { randpaintwarm: 5, randbottom: 1 };
  for (let i = 0; i < 5; i++) {
    const before = floorDeco(s, 1).paint;
    assert.ok(useItem(s, 'randpaintwarm', '1-1', s.time).ok);
    assert.notEqual(floorDeco(s, 1).paint, before);
    assert.ok(floorDeco(s, 1).paint < WALL_COLORS_WARM.length);
  }
  assert.ok(useItem(s, 'randbottom', '2-0', s.time).ok);
  assert.ok(floorDeco(s, 2).bottom >= 1);
  assert.equal(useItem(s, 'randbottom', '0-0', s.time).ok, false); // plus d'objet
  assert.ok(extendRoom(s, 3, 0, s.time).ok);
  assert.deepEqual(floorDeco(s, 3), floorDeco(s, 2));
});

test('mobilier (règle d’origine) : posé sur un étage, à cheval entre deux pièces, insensible aux démolitions', async () => {
  const { openDecoBox, placeDeco, storeDeco, demolishRoom, furnitureAt, extendRoom, DECO_FAMILIES } = await import('../src/engine/index.js');
  const s = blank(at(2026, 11, 10, 12));
  s.money = 5000;
  s.inventory = { randdeco: 2 };
  const r = openDecoBox(s, s.time);
  assert.ok(r.ok);
  assert.equal(s.furniture[0].floor, null);
  // À cheval entre les chambres 1-0 et 1-1 : visible dans les deux cases.
  assert.ok(placeDeco(s, r.piece.id, 1, 1.0, 0.3, s.time).ok);
  assert.equal(s.furniture[0].floor, 1);
  assert.deepEqual(furnitureAt(s, 1, 0).map((d) => d.id), [r.piece.id]);
  assert.deepEqual(furnitureAt(s, 1, 1).map((d) => d.id), [r.piece.id]);
  assert.equal(furnitureAt(s, 1, 2).length, 0);
  // Le rez-de-chaussée (accueil compris) accepte aussi des meubles ; un étage inexistant non.
  assert.ok(placeDeco(s, r.piece.id, 0, 2.5, 0.3, s.time).ok);
  assert.equal(placeDeco(s, r.piece.id, 9, 0.5, 0.3, s.time).ok, false);
  // Hors de l'étage : ramené au bord (le meuble tient entièrement sur l'étage).
  placeDeco(s, r.piece.id, 1, 99, 0.3, s.time);
  const w = DECO_FAMILIES[s.furniture[0].type].w;
  assert.ok(s.furniture[0].x + w / 2 <= 3);
  // Démolir une pièce ne touche pas au mobilier.
  placeDeco(s, r.piece.id, 1, 1.5, 0.3, s.time);
  assert.ok(demolishRoom(s, '1-1', s.time).ok);
  assert.equal(s.furniture[0].floor, 1);
  // L'étage s'agrandit à gauche : tout glisse d'une colonne, le meuble aussi.
  assert.ok(extendRoom(s, 0, -1, s.time).ok); // case ajoutée à gauche : tout l’hôtel glisse d’une colonne
  assert.equal(s.furniture[0].x, 2.5);
  assert.ok(storeDeco(s, r.piece.id).ok);
  assert.equal(storeDeco(s, r.piece.id).ok, false);
});

test('migration v8 → v9 : le mobilier passe de la pièce à l’étage', async () => {
  const { migrate, createState } = await import('../src/engine/index.js');
  const s = createState(at(2026, 11, 10, 12), 5);
  s.v = 8;
  s.furniture = [{ id: 'd1', type: 'sofa', frame: 1, roomId: '2-1', fx: 0.4, fy: 1 }, { id: 'd2', type: 'painting', frame: 2, roomId: '1-0', fx: 0.5, fy: 0.3 }, { id: 'd3', type: 'light', frame: 1, roomId: null, fx: 0.5, fy: 0.3 }];
  const m = migrate(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(m.furniture.map((p) => [p.floor, p.x, p.y]), [[2, 1.4, null], [1, 0.5, 0.3], [null, 0, null]]);
  assert.equal(m.furniture[0].roomId, undefined);
});

// --- Lots F3 et G : publicité, legs ---------------------------------------------
test('publicité : vitrine stable de 4 à 6 sponsors, 1re offre = Stars, livraison à 6 h', async () => {
  const { campaignsOf, buyCampaign } = await import('../src/engine/index.js');
  const s = blank(at(2026, 11, 10, 15));
  const a = campaignsOf(s, s.time);
  assert.deepEqual(a, campaignsOf(s, s.time + 3600000));
  assert.ok(a.length >= 4 && a.length <= 6);
  assert.ok(a[0].vip);
  s.money = 100000;
  assert.ok(buyCampaign(s, 0, s.time).ok);
  assert.equal(buyCampaign(s, 0, s.time).ok, false); // une fois par sponsor et par jour
  const c = a.find((x) => !x.vip) || a[1];
  assert.ok(buyCampaign(s, c.index, s.time).ok);
  advance(s, at(2026, 11, 11, 5, 59));
  assert.equal(s.queue.length, 0);
  advance(s, at(2026, 11, 11, 6, 1));
  assert.equal(s.queue.filter((id) => s.guests[id].star).length >= a[0].count, true);
  assert.ok(s.queue.length >= a[0].count + c.count);
});

test('legs : conditions, puis nouvel hôtel au niveau 2 avec une étoile', async () => {
  const { legacyStatus, bequeathHotel, treeMax } = await import('../src/engine/index.js');
  const s = blank(at(2026, 11, 10, 12));
  s.money = 3000;
  s.hotel.level = 4;
  assert.equal(legacyStatus(s).ok, false); // 6 chambres seulement
  for (const [f, c] of [[3, 0], [3, 1], [3, 2], [4, 0], [4, 1], [4, 2]]) { assert.ok(extendRoom(s, f, c, s.time).ok); s.money = 3000; assert.ok(buildRoom(s, `${f}-${c}`, 'bedroom', s.time).ok); }
  s.nextEventAt = null;
  advance(s, s.time + 6 * 60000);
  s.money = 3000;
  assert.equal(legacyStatus(s).have.rooms, 12);
  assert.ok(legacyStatus(s).ok);
  s.staff = [{ id: 's1', name: 'A', look: 0, task: null }, { id: 's2', name: 'B', look: 0, task: null }];
  s.inventory = { radiateur: 2 };
  s.research.talents = { repairCost: 3 };
  const fame = s.prestige;
  assert.ok(bequeathHotel(s, s.time).ok);
  assert.equal(s.stars, 1);
  assert.equal(s.prestige, fame + 150);
  assert.equal(s.hotel.level, 2);
  assert.deepEqual(Object.keys(s.rooms), ['0-0']);
  assert.equal(s.staff.length, 1);
  assert.equal(s.money, 3000 + 600 + 975);
  assert.equal(s.research.points, 5);
  assert.equal(treeMax(s), 30);
  assert.equal(s.queue.length, 5);
  assert.ok(QUESTS[s.quest.id].repeat);
  assert.ok(s.inventory.radiateur >= 2);
});

test('renommer un employé', async () => {
  const { renameStaff, hireStaff, dispatch } = await import('../src/engine/index.js');
  const s = blank(at(2026, 11, 10, 12));
  s.money = 10000;
  assert.ok(hireStaff(s, s.time).ok);
  const id = s.staff[s.staff.length - 1].id;
  assert.ok(dispatch(s, 'renameStaff', [id, '  Pikachu  '], s.time).ok);
  assert.equal(s.staff.find((x) => x.id === id).name, 'Pikachu');
  assert.equal(renameStaff(s, id, '   ').ok, false);
  assert.equal(renameStaff(s, 'inconnu', 'Bob').ok, false);
});
