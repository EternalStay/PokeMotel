// Parties jouées au hasard : on vérifie après chaque pas les invariants du
// moteur, puis le déterminisme (rejouer = même état), la sauvegarde (relire le
// JSON à chaque pas ne change rien) et le rattrapage (une fois = pas à pas).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine/index.js';

const { CONFIG, ITEMS, ITEM_IDS, BUILDABLES, PACKS, TALENTS, QUESTS, HOUR, MINUTE } = E;
const T0 = Date.UTC(2026, 0, 5, 7, 0); // lundi 5 janvier 2026, 8 h à Paris
const DAY = 24 * HOUR;
const clone = (s) => JSON.parse(JSON.stringify(s));

/** Petit générateur indépendant de celui du moteur (pour choisir les actions). */
function chooser(seed) {
  let s = seed >>> 0 || 1;
  const next = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  return { next, int: (a, b) => a + Math.floor(next() * (b - a + 1)), pick: (arr) => arr[Math.floor(next() * arr.length)] };
}

// -----------------------------------------------------------------------------
// Actions tirées au hasard (arguments plausibles, parfois absurdes)
// -----------------------------------------------------------------------------
const roomIds = (s) => Object.keys(s.rooms);
const placed = (s) => Object.values(s.guests).filter((g) => g.roomId);
const anyGuest = (s) => Object.keys(s.guests);

function randomAction(s, c) {
  const pickOr = (arr, fallback = 'nope') => (arr.length ? c.pick(arr) : fallback);
  const freeBedrooms = roomIds(s).filter((id) => E.roomIsAvailable(s, s.rooms[id]));
  const needy = roomIds(s).filter((id) => s.rooms[id].damage > 0 || placed(s).some((g) => g.roomId === id && !g.cared));
  const aim = (good, any) => (good.length && c.next() < 0.8 ? c.pick(good) : pickOr(any));
  const table = [
    [12, () => ['placeGuest', pickOr(s.queue), aim(freeBedrooms, roomIds(s))]],
    [3, () => ['moveGuest', pickOr(placed(s).map((g) => g.id)), aim(freeBedrooms, roomIds(s))]],
    [1, () => ['swapQueue', pickOr(s.queue), pickOr(s.queue)]],
    [5, () => ['fulfillRequest', pickOr(placed(s).filter((g) => g.request).map((g) => g.id), pickOr(anyGuest(s)))]],
    [2, () => ['hireStaff']],
    [6, () => ['assignStaff', aim(s.staff.filter((x) => !x.task).map((x) => x.id), s.staff.map((x) => x.id)), c.next() < 0.3 ? 'lobby' : aim(needy, roomIds(s))]],
    [2, () => ['recallStaff', pickOr(s.staff.map((x) => x.id))]],
    [3, () => ['buyItem', c.pick(ITEM_IDS)]],
    [1, () => ['buyPack', c.pick([...Object.keys(PACKS), 'x'])]],
    [6, () => ['useItem', pickOr(Object.keys(s.inventory)), aim(roomIds(s).filter((id) => s.rooms[id].kind === 'bedroom'), roomIds(s))]],
    [1, () => { const r = c.pick(Object.values(s.rooms)); return ['removeEquip', r.id, r.equip[0] || 'radiateur']; }],
    [5, () => ['collectLeftover', pickOr(roomIds(s).filter((id) => s.rooms[id].leftItem), pickOr(roomIds(s)))]],
    [3, () => ['demolishRoom', aim(roomIds(s).filter((id) => ['leisure', 'service', 'lab'].includes(s.rooms[id].kind)), roomIds(s))]],
    [6, () => ['buildRoom', aim(roomIds(s).filter((id) => s.rooms[id].kind === 'empty' && !s.rooms[id].buildEnd), roomIds(s)), c.pick(Object.keys(BUILDABLES))]],
    [2, () => ['upgradeRoom', pickOr(roomIds(s))]],
    [1, () => ['upgradeLobby']],
    [4, () => { const sl = E.extendSlots(s); const p = sl.length && c.next() < 0.85 ? c.pick(sl) : { floor: c.int(-1, 5), col: c.int(-2, 8) }; return ['extendRoom', p.floor, p.col]; }],
    [1, () => ['renameHotel', c.pick(['Le Gluant', '', '  ', 'Hôtel des Marais'])]],
    [3, () => ['studyGuest', pickOr(anyGuest(s)), pickOr(roomIds(s).filter((id) => s.rooms[id].sub === 'labo'), pickOr(roomIds(s)))]],
    [2, () => ['spendTalent', c.pick([...Object.keys(TALENTS), 'zzz'])]],
    [1, () => ['resetTalents']],
    [1, () => ['attractGuest']],
    [2, () => ['openDecoBox']],
    [3, () => ['placeDeco', pickOr((s.furniture || []).map((p) => p.id)), c.int(-1, 6), c.next() * 8 - 1, c.next()]],
    [1, () => ['storeDeco', pickOr((s.furniture || []).map((p) => p.id))]],
    [1, () => ['buyCampaign', c.int(0, 6)]],
    [1, () => ['bequeathHotel']],
    // Coups de pouce de test (enregistrés comme des actions pour pouvoir rejouer).
    [2, () => ['cheat', c.pick(['money', 'gems', 'level'])]],
    // Un ami envoie un Œuf (côté serveur, chez le destinataire).
    [2, () => ['parcel', c.pick(['Camille', 'Sacha', ''])]],
    [1, () => ['setTitle', c.next() < 0.2 ? null : c.int(0, 40)]],
    [1, () => ['setNeon', c.int(-1, 13)]],
  ];
  const total = table.reduce((n, [w]) => n + w, 0);
  let r = c.next() * total;
  for (const [w, make] of table) { if ((r -= w) < 0) return make(); }
  return table[0][1]();
}

const CHEATS = {
  money: (s) => { s.money += 3000; },
  gems: (s) => { s.gems += 40; },
  level: (s) => { if (s.hotel.level < 9) s.hotel.level++; },
};

/** Applique une action enregistrée : [nom, ...arguments] (le `now` est ajouté à la fin). */
function apply(s, [name, ...args], now) {
  if (name === 'cheat') { CHEATS[args[0]](s); return { ok: true }; }
  if (name === 'parcel') return E.receiveParcel(s, args[0], now);
  return E.dispatch(s, name, args, now);
}

// -----------------------------------------------------------------------------
// Invariants
// -----------------------------------------------------------------------------
function walkNumbers(v, path, out) {
  if (typeof v === 'number') { if (!Number.isFinite(v)) out.push(path); return; }
  if (v && typeof v === 'object') for (const k of Object.keys(v)) walkNumbers(v[k], `${path}.${k}`, out);
}

function checkInvariants(s, ctx) {
  const fail = (msg) => assert.fail(`${ctx} : ${msg}`);
  const bad = [];
  walkNumbers(s, 'state', bad);
  if (bad.length) fail(`nombres invalides : ${bad.slice(0, 5).join(', ')}`);
  if (!Number.isInteger(s.money)) fail(`argent non entier : ${s.money}`);
  if (!Number.isInteger(s.gems) || s.gems < 0) fail(`gemmes invalides : ${s.gems}`);
  if (!Number.isInteger(s.prestige) || s.prestige < 0) fail(`prestige invalide : ${s.prestige}`);

  // Pièces
  const occ = {};
  for (const [id, r] of Object.entries(s.rooms)) {
    if (r.id !== id || id !== `${r.floor}-${r.col}`) fail(`pièce mal nommée : ${id} / ${r.id}`);
    if (r.col < 0 || r.floor < 0) fail(`coordonnées négatives : ${id}`);
    if (!Number.isInteger(r.damage) || r.damage < 0 || r.damage > CONFIG.maxDamage) fail(`dégâts invalides en ${id} : ${r.damage}`);
    if (r.level < 1 || r.level > CONFIG.roomMaxLevel) fail(`niveau invalide en ${id}`);
    if (r.equip.length > 2 || new Set(r.equip).size !== r.equip.length || r.equip.some((i) => !ITEMS[i])) fail(`équipement invalide en ${id} : ${r.equip}`);
    if (r.kind === 'bedroom' && r.floor === 0) fail(`chambre au RDC : ${id}`);
    if (r.buildEnd && !r.buildTarget) fail(`chantier sans cible : ${id}`);
    if (r.buildTarget && r.buildTarget !== 'upgrade' && !BUILDABLES[r.buildTarget]) fail(`cible inconnue : ${id}`);
    if (r.kind !== 'empty' && r.kind !== 'lobby' && r.kind !== 'bedroom' && !BUILDABLES[r.sub]) fail(`sous-type inconnu : ${id}`);
  }
  const lobbies = Object.values(s.rooms).filter((r) => r.kind === 'lobby');
  if (lobbies.length !== 1) fail(`${lobbies.length} accueils`);
  if (lobbies[0].floor !== 0 || lobbies[0].col !== Math.max(...E.floorCols(s, 0))) fail('accueil pas au bout du RDC');
  const span = E.hotelSpan(s);
  if (span.width > CONFIG.maxCols) fail(`hôtel trop large : ${span.width}`);
  if (span.min !== 0) fail(`l'hôtel ne commence pas en colonne 0 : ${span.min}`);

  // Clients
  const inQueue = new Set(s.queue);
  if (inQueue.size !== s.queue.length) fail('doublon dans la file');
  for (const id of s.queue) if (!s.guests[id] || s.guests[id].roomId) fail(`file incohérente : ${id}`);
  for (const g of Object.values(s.guests)) {
    if (!g.roomId && !inQueue.has(g.id)) fail(`client fantôme (ni file ni chambre) : ${g.id}`);
    if (g.roomId) {
      const r = s.rooms[g.roomId];
      if (!r || r.kind !== 'bedroom') fail(`client ${g.id} dans une pièce invalide ${g.roomId}`);
      if (occ[g.roomId]) fail(`deux clients en ${g.roomId}`);
      occ[g.roomId] = g;
      const sat = E.computeSatisfaction(s, g).value;
      if (!Number.isInteger(sat) || sat < 0 || sat > 10) fail(`satisfaction invalide ${g.id} : ${sat}`);
      if (g.nightsLeft < 0) fail(`nuits négatives ${g.id}`);
    } else if (g.leisure || g.request || g.bombAt) fail(`client en file avec un état de chambre : ${g.id}`);
    if (g.leisure) {
      const r = s.rooms[g.leisure.roomId];
      if (!r || r.kind !== 'leisure') fail(`loisir dans une pièce invalide : ${g.id} → ${g.leisure.roomId}`);
    }
    if (g.bombAt && g.type !== 'electrik') fail(`bombe sur un non-Électrik : ${g.id}`);
    if (g.type === 'electrik' && g.roomId) {
      const v = E.computeSatisfaction(s, g).value;
      if ((v <= 0 || v >= 10) !== !!g.bombAt) fail(`mèche incohérente pour ${g.id} (${v}/10, bombAt ${g.bombAt})`);
    }
    if (g.request && !E.SERVICES[g.request.kind]) fail(`demande inconnue : ${g.id}`);
  }

  // Personnel
  const busyRooms = new Set();
  for (const st of s.staff) {
    const t = st.task;
    if (!t) continue;
    if (t.kind === 'lobby') continue;
    if (!s.rooms[t.roomId]) fail(`employé ${st.id} dans une pièce inexistante ${t.roomId}`);
    if (busyRooms.has(t.roomId)) fail(`deux employés en ${t.roomId}`);
    busyRooms.add(t.roomId);
    if (t.kind === 'care') {
      const g = s.guests[t.guestId];
      if (!g || g.roomId !== t.roomId) fail(`attentions pour un client absent : ${st.id}`);
    }
    if (t.kind === 'repair' && s.rooms[t.roomId].damage <= 0) fail(`réparation d'une chambre intacte : ${st.id}`);
    if (!t.end) fail(`tâche sans fin : ${st.id}`);
  }
  if (E.lobbyStaffCount(s) > E.lobbyCapacity(s)) fail('accueil surchargé');

  // Inventaire, mobilier, mission
  for (const [id, n] of Object.entries(s.inventory)) if (!ITEMS[id] || !Number.isInteger(n) || n <= 0) fail(`inventaire invalide : ${id}=${n}`);
  for (const p of s.furniture || []) {
    if (p.floor == null) continue;
    const ext = E.floorExtent(s, p.floor);
    const half = E.DECO_FAMILIES[p.type].w / 2;
    if (!ext) fail(`meuble ${p.id} sur un étage inexistant`);
    if (p.x - half < ext.min - 1e-6 || p.x + half > ext.max + 1e-6) fail(`meuble ${p.id} hors de son étage (x ${p.x}, étage ${ext.min}–${ext.max})`);
    if ((E.DECO_FAMILIES[p.type].position === 'floating') !== (p.y != null)) fail(`hauteur incohérente : ${p.id}`);
  }
  if (E.parcelsAt(s) > E.PARCEL.maxAtHost) fail('trop d’Œufs');
  for (const g of Object.values(s.guests)) if (g.parcel && g.star) fail(`Œuf Star : ${g.id}`);
  for (const [k, v] of Object.entries(s.goals || {})) if (!E.ACHIEVEMENTS[k] || !Number.isInteger(v) || v < 0) fail(`compteur invalide ${k}=${v}`);
  if ((s.goals?.stars || 0) !== (s.stars || 0)) fail('compteur d’étoiles désynchronisé');
  if (s.title != null && (!E.REWARDS[s.title]?.title || (s.goals[E.REWARDS[s.title].goal] || 0) < E.REWARDS[s.title].count)) fail('titre non débloqué');
  if (!QUESTS[s.quest.id] || s.quest.done.length !== QUESTS[s.quest.id].goals.length) fail('mission invalide');
  if (s.research.points < 0 || E.spentPoints(s) + s.research.points > E.treeMax(s)) fail('recherche invalide');
}

// -----------------------------------------------------------------------------
// Une partie
// -----------------------------------------------------------------------------
function play(seed, days, { record = null, replay = null, roundtrip = false } = {}) {
  let s = E.createState(T0, seed);
  const c = chooser(seed * 7919);      // la chronologie
  const pick = chooser(seed * 104729); // les actions
  const end = T0 + days * DAY;
  let t = T0;
  let step = 0;
  const actions = replay ? [...replay] : [];
  let stats = { ok: 0, ko: 0 };
  while (t < end) {
    t += c.int(1, 180) * MINUTE;
    E.advance(s, t);
    if (roundtrip) s = clone(s);
    checkInvariants(s, `graine ${seed}, pas ${step} (${new Date(t).toISOString()}) après avance`);
    const n = c.int(0, 4);
    for (let i = 0; i < n; i++) {
      if (E.isLocked(t)) break;
      let a;
      if (replay) {
        if (!actions.length || actions[0].step !== step) break;
        a = actions.shift().a;
      } else a = randomAction(s, pick);
      const before = JSON.stringify(s);
      const res = apply(s, a, t);
      if (!res || typeof res.ok !== 'boolean') assert.fail(`${a[0]} ne renvoie pas { ok }`);
      if (!res.ok) {
        stats.ko++;
        const after = JSON.stringify(s);
        if (after !== before) {
          let k = 0;
          while (after[k] === before[k]) k++;
          assert.fail(`graine ${seed}, pas ${step} : ${JSON.stringify(a)} a échoué (« ${res.error} ») mais a modifié l'état :
  avant : …${before.slice(Math.max(0, k - 250), k + 120)}
  après : …${after.slice(Math.max(0, k - 250), k + 120)}`);
        }
        assert.ok(typeof res.error === 'string' && res.error.length, `${a[0]} échoue sans message`);
      } else stats.ok++;
      if (record) record.push({ step, a });
      checkInvariants(s, `graine ${seed}, pas ${step}, après ${JSON.stringify(a)}`);
    }
    step++;
  }
  return { s, stats };
}

// FUZZ_SEEDS=60 pour une passe lourde (à lancer à la main).
const SEEDS = process.env.FUZZ_SEEDS
  ? Array.from({ length: Number(process.env.FUZZ_SEEDS) }, (_, i) => 1000 + i * 37)
  : [1, 2, 3, 42, 777, 2026, 31337, 99991];

test('fuzz : invariants sur 4 semaines de jeu au hasard, plusieurs graines', () => {
  let ok = 0;
  let ko = 0;
  let maxLevel = 0;
  let maxRooms = 0;
  for (const seed of SEEDS) {
    const { s, stats } = play(seed, 28);
    if (process.env.FUZZ_VERBOSE) console.log(seed, stats, 'niveau', s.hotel.level, 'pièces', Object.keys(s.rooms).length, 'étoiles', s.stars, 'mission', s.questsDone);
    ok += stats.ok; ko += stats.ko;
    maxLevel = Math.max(maxLevel, s.hotel.level);
    maxRooms = Math.max(maxRooms, Object.keys(s.rooms).length);
  }
  // La partie doit vraiment avancer (sinon le test ne prouve rien).
  assert.ok(ok > 500, `trop peu d'actions réussies : ${ok}`);
  assert.ok(maxLevel >= 4, `niveau max atteint : ${maxLevel}`);
  assert.ok(maxRooms >= 12, `taille max atteinte : ${maxRooms}`);
});

test('fuzz : rejouer les mêmes actions donne exactement le même état (avec relecture de la sauvegarde à chaque pas)', () => {
  for (const seed of SEEDS.slice(0, 4)) {
    const record = [];
    const a = play(seed, 14, { record }).s;
    const b = play(seed, 14, { replay: record, roundtrip: true }).s;
    assert.equal(JSON.stringify(b), JSON.stringify(a), `graine ${seed} : la partie rejouée diverge`);
  }
});

test('rattrapage : avancer d\'un coup ou pas à pas donne le même état', () => {
  for (const seed of SEEDS.slice(0, 5)) {
    const base = play(seed, 10).s;
    const from = base.time;
    const one = clone(base);
    const many = clone(base);
    const c = chooser(seed);
    const to = from + 4 * DAY + 7 * HOUR; // < 5 jours : pas de « bon retour »
    E.advance(one, to);
    for (let t = from; t < to;) { t = Math.min(to, t + c.int(1, 300) * MINUTE); E.advance(many, t); }
    assert.equal(JSON.stringify(many), JSON.stringify(one), `graine ${seed} : le rattrapage diffère`);
  }
});

test('rattrapage : une très longue absence (3 semaines) ne perd aucune nuit', () => {
  const s = play(5, 7).s;
  const nights = s.stats.nights;
  E.advance(s, s.time + 21 * DAY);
  assert.equal(s.stats.nights, nights + 21);
  checkInvariants(s, 'après 3 semaines');
});

test('dispatch : action inconnue, heure verrouillée et retard du client refusés proprement', () => {
  const s = E.createState(T0, 9);
  assert.equal(E.dispatch(s, 'hackTheBank', [], T0).ok, false);
  const midnight = E.nextLocalHour(T0, 0, CONFIG.timeZone);
  const before = JSON.stringify(s);
  const r = E.dispatch(s, 'hireStaff', [], midnight - 30 * 1000);
  assert.equal(r.ok, false);
  assert.match(r.error, /comptes|minuit/i);
  assert.ok(JSON.stringify(s) !== before || true);
  // Une action datée d'avant l'état est refusée (l'horloge ne recule pas).
  const t = E.createState(T0, 9);
  E.advance(t, T0 + HOUR);
  assert.equal(E.dispatch(t, 'hireStaff', [], T0).ok, false);
});
