// =============================================================================
// Modèle de données : création d'une partie, chambres, clients, personnel.
// L'état est un objet JSON pur (sérialisable tel quel en localStorage ou dans
// une colonne jsonb Supabase).
// =============================================================================

import {
  TYPES, TYPE_IDS, CONFIG, NAME_PARTS, STAFF_NAMES, HOTEL_NAMES, SERVICE_IDS, ITEMS, BUILDABLES, STARTERS, tastePool,
} from './data.js';
import { rngFor, makeSeed } from './rng.js';
import { nextLocalHour, isNightTime, zonedParts, MINUTE, HOUR } from './time.js';

export const SAVE_VERSION = 9;
const DAY = 24 * HOUR;

export const roomId = (floor, col) => `${floor}-${col}`;

/** Crée une nouvelle partie. */
export function createState(now = Date.now(), seed = makeSeed(now)) {
  const state = {
    v: SAVE_VERSION,
    seed,
    rng: seed,
    createdAt: now,
    time: now,                 // instant jusqu'auquel la simulation a été calculée
    hotel: { name: '', cols: CONFIG.startCols, floors: CONFIG.startFloors, level: 1, lobbyLevel: 1, extensions: 0, neon: 10 },
    manager: 'Gérant',         // nom du joueur (affiché avec son titre)
    money: CONFIG.startMoney,
    gems: 0,                   // monnaie premium (gagnée en jouant)
    prestige: CONFIG.startPrestige,
    activeWeek: false,         // un client placé ou déplacé depuis la dernière taxe
    rooms: {},
    guests: {},
    nextGuestId: 1,
    queue: [],
    nextArrival: null,
    lastArrival: now,
    staff: [],
    nextStaffId: 1,
    inventory: { ...CONFIG.startItems },
    log: [],
    logSeq: 0,
    lastTax: null,
    firstTax: firstTaxAmount(now),
    quest: { id: 0, done: [false] },
    questsDone: 0,
    research: { points: 0, progress: 0, talents: {} },
    nextEventAt: null,
    stars: 0,
    notices: [],
    floorDeco: {},             // habillage par étage (peinture, papier peint, bas de mur)
    furniture: [],             // mobilier : posé (roomId) ou en réserve (roomId null)
    nextDecoId: 1,
    goals: {},                 // compteurs des succès
    title: null,               // palier dont le titre est affiché
    lastParcelDay: null,       // jour du dernier Œuf envoyé à un ami
    stats: { placed: 0, satisfied: 0, delighted: 0, earned: 0, nights: 0, angry: 0, services: 0, items: 0, stars: 0 },
  };
  const rng = rngFor(state);
  state.nextEventAt = now + (CONFIG.events.minHours + rng.next() * CONFIG.events.spreadHours) * HOUR;
  state.hotel.name = `${rng.pick(HOTEL_NAMES.pre)} ${rng.pick(HOTEL_NAMES.suf)}`;

  // Rez-de-chaussée : des emplacements libres et l'accueil, toujours à droite.
  for (let c = 0; c < state.hotel.cols; c++) {
    state.rooms[roomId(0, c)] = makeRoom(0, c, c === state.hotel.cols - 1 ? 'lobby' : 'empty');
  }
  let built = 0;
  for (let f = 1; f <= state.hotel.floors; f++) {
    for (let c = 0; c < state.hotel.cols; c++) {
      const isBedroom = built < CONFIG.startBedrooms;
      state.rooms[roomId(f, c)] = makeRoom(f, c, isBedroom ? 'bedroom' : 'empty');
      if (isBedroom) built++;
    }
  }
  for (let i = 0; i < CONFIG.startStaff; i++) addStaff(state);
  // Un seul client attend devant l'hôtel ; la 1re mission en amène un second.
  for (let i = 0; i < CONFIG.firstClients; i++) enqueueNewGuest(state, now);
  scheduleNextArrival(state, now);
  addLog(state, now, 'info', `Bienvenue au « ${state.hotel.name} » ! Votre premier client attend devant la porte : installez-le dans une chambre.`);
  return state;
}

/** Niveau d'un talent du laboratoire. */
export const tal = (state, id) => state?.research?.talents?.[id] || 0;

/** "101" = étage 1, chambre 1. */
export function roomLabel(room) {
  return `${room.floor}${String(room.col + 1).padStart(2, '0')}`;
}

/** Met à niveau une ancienne sauvegarde (null si incompatible). */
export function migrate(state) {
  if (state.v === 3) {
    state.quest ||= { id: 0, done: [false] };
    state.questsDone ||= 0;
    state.research ||= { points: 0, progress: 0, talents: {} };
    state.nextEventAt ||= state.time + CONFIG.events.minHours * HOUR;
    state.stars ||= 0;
    state.notices ||= [];
    for (const g of Object.values(state.guests)) { g.mods.malus ||= 0; g.mods.bonus ||= 0; }
    state.v = 4;
  }
  if (state.v === 4) {
    state.gems ||= 0;
    state.activeWeek = true;
    const t = state.research.talents;
    if (t.specNormal) { t.specInsecte = t.specNormal; delete t.specNormal; }
    if (t.specPoison) { t.specCombat = t.specPoison; delete t.specPoison; }
    for (const g of Object.values(state.guests)) {
      g.mods.comfort ||= 0;
      if (g.roomId) {
        g.leaveAt = departureTime(state.time, g.nightsLeft);
        g.request = null;
        scheduleRequest(state, g, state.time, CONFIG.requestRange.arrival);
        scheduleLeisure(state, g, state.time, 'idle');
      }
    }
    state.v = 5;
  }
  if (state.v === 5) {
    // v6 : le rez-de-chaussée devient un étage de pièces (accueil à droite).
    const cols = state.hotel.cols;
    for (let c = 0; c < cols; c++) state.rooms[roomId(0, c)] = makeRoom(0, c, c === cols - 1 ? 'lobby' : 'empty');
    for (const r of Object.values(state.rooms)) if (r.buildTarget === 'upgrade' && !r.buildEnd) r.buildTarget = null;
    state.v = 6;
  }
  if (state.v === 6) {
    state.floorDeco ||= {};
    state.furniture ||= [];
    state.nextDecoId ||= 1;
    state.v = 7;
  }
  if (state.v === 7) {
    state.hotel.neon ??= 10;
    state.manager ||= 'Gérant';
    state.title ??= null;
    state.lastParcelDay ??= null;
    // Les succès repartent de ce que les statistiques savent déjà.
    const st = state.stats || {};
    state.goals ||= { stars: state.stars || 0, hosted: st.placed || 0, okbase: st.satisfied || 0, serv: st.services || 0, pick: st.items || 0, lab: 0, pub: st.ads || 0, okvip: st.stars || 0 };
    state.v = 8;
  }
  if (state.v === 8) {
    // v9 : le mobilier est posé sur un étage (et non plus dans une pièce).
    for (const p of state.furniture || []) {
      const room = p.roomId && state.rooms[p.roomId];
      p.floor = room ? room.floor : null;
      p.x = room ? room.col + (p.fx ?? 0.5) : 0;
      p.y = room && p.fy != null && p.fy < 1 ? p.fy : null;
      delete p.roomId; delete p.fx; delete p.fy;
    }
    state.v = 9;
  }
  return state.v === SAVE_VERSION ? state : null;
}

/**
 * Première taxe : proportionnelle aux jours joués avant le premier lundi 0h
 * (10 pour un hôtel ouvert le samedi ou le dimanche, 100 pour un lundi).
 */
export function firstTaxAmount(createdAt) {
  let t = nextLocalHour(createdAt, 0, CONFIG.timeZone);
  for (let i = 0; i < 8 && zonedParts(t, CONFIG.timeZone).weekday !== 1; i++) t = nextLocalHour(t, 0, CONFIG.timeZone);
  const d = Math.max(0, Math.min(6, Math.floor((t - createdAt) / DAY)));
  return Math.floor(Math.max(1, Math.min(1, d / 6) * 10)) * 10;
}

export function makeRoom(floor, col, kind = 'empty', sub = null) {
  return {
    id: roomId(floor, col), floor, col, kind, sub: sub ?? (kind === 'bedroom' || kind === 'lobby' ? kind : null),
    level: 1, damage: 0, buildEnd: null, buildTarget: null, equip: [], leftItem: null, busyUntil: 0,
  };
}

/** Emprise du bâtiment : colonnes min / max, largeur, dernier étage. */
export function hotelSpan(state) {
  let min = Infinity;
  let max = -Infinity;
  let top = 0;
  for (const r of Object.values(state.rooms)) {
    min = Math.min(min, r.col);
    max = Math.max(max, r.col);
    top = Math.max(top, r.floor);
  }
  return { min, max, width: max - min + 1, top };
}

/** Colonnes occupées par un étage. */
export const floorCols = (state, f) => Object.values(state.rooms).filter((r) => r.floor === f).map((r) => r.col);

/**
 * Peut-on ajouter une case en (étage, colonne) ? Renvoie un message d'erreur ou null.
 * Règles de la réécriture : la case touche une case du même étage (ou ouvre un
 * nouvel étage au-dessus du dernier, à n'importe quelle colonne), largeur 7,
 * hauteur 22. Rien n'oblige une case à reposer sur une pièce : le porte-à-faux est
 * permis (le client le dessine soutenu par des consoles).
 */
export function extendCheck(state, floor, col) {
  if (state.rooms[roomId(floor, col)]) return 'Cet emplacement existe déjà.';
  const span = hotelSpan(state);
  if (floor < 0 || floor > span.top + 1) return 'Emplacement impossible.';
  if (floor === span.top + 1 && floor > CONFIG.maxFloors) return 'Hauteur maximale légale atteinte !';
  const widens = col < span.min || col > span.max;
  if (widens && span.width >= CONFIG.maxCols) return `Largeur maximale atteinte (${CONFIG.maxCols} colonnes) : agrandissez vers le haut !`;
  const row = floorCols(state, floor);
  if (row.length && !row.includes(col - 1) && !row.includes(col + 1)) return 'La nouvelle pièce doit toucher une pièce du même étage.';
  return null;
}

/** Tous les emplacements où l'on peut agrandir. */
export function extendSlots(state) {
  const span = hotelSpan(state);
  const out = [];
  for (let f = 0; f <= span.top + 1; f++) {
    for (let c = span.min - 1; c <= span.max + 1; c++) if (!extendCheck(state, f, c)) out.push({ floor: f, col: c });
  }
  return out;
}

/** Renomme des pièces après un décalage de colonnes (références comprises). */
export function shiftColumns(state, delta, onlyFloor = null) {
  const map = {};
  const rooms = {};
  for (const r of Object.values(state.rooms)) {
    if (onlyFloor === null || r.floor === onlyFloor) {
      const id = roomId(r.floor, r.col + delta);
      map[r.id] = id;
      r.col += delta;
      r.id = id;
    }
    rooms[r.id] = r;
  }
  state.rooms = rooms;
  const ren = (id) => map[id] ?? id;
  for (const g of Object.values(state.guests)) {
    if (g.roomId) g.roomId = ren(g.roomId);
    if (g.leisure) g.leisure.roomId = ren(g.leisure.roomId);
  }
  for (const s of state.staff) if (s.task && s.task.roomId) s.task.roomId = ren(s.task.roomId);
  for (const n of state.notices || []) if (n.roomId) n.roomId = ren(n.roomId);
  // Le mobilier glisse avec son étage (le `moveAllDeco` d'origine).
  for (const p of state.furniture || []) if (p.floor != null && (onlyFloor === null || p.floor === onlyFloor)) p.x += delta;
}

/** Met à jour la taille affichée de l'hôtel (largeur, étages). */
export function updateHotelSize(state) {
  const span = hotelSpan(state);
  state.hotel.cols = span.width;
  state.hotel.floors = span.top;
}

export function roomList(state) {
  return Object.values(state.rooms).sort((a, b) => a.floor - b.floor || a.col - b.col);
}

export function occupancy(state) {
  const map = {};
  for (const g of Object.values(state.guests)) if (g.roomId) map[g.roomId] = g;
  return map;
}

/** Les 4 pièces voisines (gauche, droite, dessus, dessous) existantes. */
export function neighborIds(state, id) {
  const r = state.rooms[id];
  if (!r) return [];
  return [
    roomId(r.floor, r.col - 1), roomId(r.floor, r.col + 1),
    roomId(r.floor + 1, r.col), roomId(r.floor - 1, r.col),
  ].filter((n) => state.rooms[n]);
}

export function staffInRoom(state, rid) {
  return state.staff.find((s) => s.task && s.task.roomId === rid);
}

export const lobbyStaffCount = (state) => state.staff.filter((s) => s.task && s.task.kind === 'lobby').length;
export const lobbyCapacity = (state) => CONFIG.lobbyCapacity[state.hotel.lobbyLevel] ?? CONFIG.lobbyCapacity.at(-1);
export const freeStaff = (state) => state.staff.filter((s) => !s.task);

export function roomIsAvailable(state, room, occ = occupancy(state)) {
  return room.kind === 'bedroom' && !room.buildEnd && room.damage === 0 && !room.leftItem && !occ[room.id];
}

/** Effets des équipements d'une chambre. */
export function roomEquipEffects(room) {
  const fx = { auras: [], nightBonus: 0, payMult: 1, dropBonus: 0, isolate: false, fireproof: false, fireworks: false };
  for (const id of room?.equip || []) {
    const it = ITEMS[id];
    if (!it) continue;
    fx.auras.push(...it.auras.map((a) => ({ aura: a, item: id })));
    fx.nightBonus += it.nightBonus || 0;
    fx.fireworks ||= !!it.fireworks;
    fx.payMult *= it.payMult || 1;
    fx.dropBonus += it.dropBonus || 0;
    fx.isolate ||= !!it.isolate;
    fx.fireproof ||= !!it.fireproof;
  }
  return fx;
}

/** Une chambre est "de luxe" pour une Star : niveau 2 jusqu'au niveau d'hôtel 3, puis niveau 3. */
export const isLuxuryRoom = (state, room) => (state.hotel.level <= 3 ? room.level >= 2 : room.level >= 3);
export const starRequiredLevel = (state) => (state.hotel.level <= 3 ? 2 : 3);

/** Heure de départ : 10 h après `nights` minuits. */
export function departureTime(from, nights) {
  let t = from;
  for (let i = 0; i < nights; i++) t = nextLocalHour(t, 0, CONFIG.timeZone);
  return nextLocalHour(t, CONFIG.checkoutHour, CONFIG.timeZone);
}

/** Auras émises par un client. */
export const guestAuras = (g) => TYPES[g.type].auras;

// -----------------------------------------------------------------------------
// Clients
// -----------------------------------------------------------------------------

/** Tire `n` éléments distincts d'une liste (sans remise). */
function drawFrom(rng, pool, n) {
  const p = [...pool];
  const out = [];
  for (let i = 0; i < n && p.length; i++) out.push(p.splice(Math.floor(rng.next() * p.length), 1)[0]);
  return out;
}

/** Génère un nouveau client (sans le placer). `forceType` : type imposé (Psy qui en attire un autre). */
export function generateGuest(state, now, forceType = null) {
  const rng = rngFor(state);
  const index = state.nextGuestId - 1;
  const level = state.hotel.level;
  let type;
  let likes;
  let dislikes;

  if (index < STARTERS.length) {
    ({ type, likes, dislikes } = STARTERS[index]);
    likes = [...likes];
    dislikes = [...dislikes];
  } else {
    const types = TYPE_IDS.filter((id) => TYPES[id].unlock <= level);
    type = forceType || rng.weighted(types.map((id) => ({ id, weight: TYPES[id].weight }))).id;
    // Toujours 2 goûts en tout, répartis au hasard entre "aime" et "déteste".
    const pool = tastePool(level);
    const nLike = rng.int(0, 2);
    const drawn = drawFrom(rng, pool, 2);
    likes = drawn.slice(0, nLike);
    dislikes = drawn.slice(nLike);
  }

  const w = CONFIG.stayWeights(level);
  const stay = rng.weighted(w.map((weight, i) => ({ id: i + 1, weight })).filter((x) => x.weight > 0)).id;
  const star = index >= STARTERS.length && rng.chance(CONFIG.vipChance);
  const parts = NAME_PARTS[type];

  const guest = {
    id: `g${state.nextGuestId++}`,
    name: rng.pick(parts.pre) + rng.pick(parts.suf),
    type,
    look: rng.int(0, 999),
    star,
    baseSat: (star ? CONFIG.vipBase : CONFIG.baseSat) + tal(state, MASTERY_BASE[type] || '_'),
    likes,
    dislikes,
    stay,
    nightsLeft: stay,
    roomId: null,
    moves: 0,
    mods: { care: 0, service: 0, gift: 0, malus: 0, bonus: 0, comfort: 0 },
    cared: false,
    placedOnce: false,
    request: null,
    nextRequestAt: null,
    leaveAt: null,
    leisure: null,            // { roomId, until } pendant une visite de salle de loisir
    nextLeisureAt: null,
    bombAt: null,             // Électrik instable : heure de l'explosion
    arrivedAt: now,
  };
  state.guests[guest.id] = guest;
  return guest;
}

export function enqueueNewGuest(state, now, forceType = null) {
  const g = generateGuest(state, now, forceType);
  state.queue.push(g.id);
  return g;
}

/** Délai d'arrivée selon le personnel à l'accueil (8 h sans personne). */
export function arrivalDelayMs(state) {
  const n = Math.min(lobbyStaffCount(state), CONFIG.arrivalHoursByStaff.length - 1);
  return CONFIG.arrivalHoursByStaff[n] * HOUR;
}

/** Calcule l'heure d'arrivée du prochain client depuis la dernière arrivée (jamais la nuit). */
export function scheduleNextArrival(state, now) {
  let t = (state.lastArrival ?? now) + arrivalDelayMs(state);
  if (t < now) t = now + MINUTE;
  if (isNightTime(t, CONFIG.wakeUpHour, CONFIG.timeZone)) t = nextLocalHour(t, CONFIG.wakeUpHour, CONFIG.timeZone);
  state.nextArrival = t;
}

/** Services disponibles au niveau actuel de l'hôtel. */
export const unlockedServices = (state) => SERVICE_IDS.filter((s) => state.hotel.level >= CONFIG.serviceUnlock[s]);

/**
 * Programme LA demande de service d'un client installé (une à la fois) :
 * échéance = maintenant + 6 h + un tirage de `range` heures ; la demande
 * n'est visible que dans les 6 h qui précèdent. Rien si l'échéance tombe
 * après le départ ou si le niveau de l'hôtel n'a encore aucune machine.
 */
export function scheduleRequest(state, guest, from, range = CONFIG.requestRange.arrival) {
  guest.nextRequestAt = null;
  if (!unlockedServices(state).length) return;
  const rng = rngFor(state);
  const end = from + (CONFIG.requestVisibleHours + rng.int(range[0], range[1])) * HOUR;
  if (guest.leaveAt && end >= guest.leaveAt) return;
  guest.nextRequestAt = end - CONFIG.requestVisibleHours * HOUR;
}

export function pickRequestKind(state) {
  return rngFor(state).pick(unlockedServices(state));
}

/** Salles de loisir qu'un client aimerait visiter. */
export function favoriteLeisure(state, g) {
  return Object.values(state.rooms).filter((r) => r.kind === 'leisure' && !r.buildEnd && g.likes.includes(BUILDABLES[r.sub].aura));
}

/**
 * Programme la prochaine envie de sortie d'un client :
 * 'idle' (il pose ses valises : 20 à 70 min), 'retry' (10 à 40 min), 'rest' (5 h après une visite).
 */
export function scheduleLeisure(state, g, from, why) {
  const L = CONFIG.leisure;
  if (!favoriteLeisure(state, g).length && why !== 'rest') { g.nextLeisureAt = null; return; }
  const rng = rngFor(state);
  if (why === 'rest') g.nextLeisureAt = from + L.restHours * HOUR;
  else if (why === 'idle') g.nextLeisureAt = from + (L.idleMin + rng.int(0, L.idleSpread)) * MINUTE;
  else g.nextLeisureAt = from + (L.retryMin + rng.int(0, L.retrySpread)) * MINUTE;
}

/** Retire un client de la partie (et libère l'employé qui s'en occupait). */
export function removeGuest(state, guestId) {
  for (const s of state.staff) if (s.task && s.task.kind === 'care' && s.task.guestId === guestId) s.task = null;
  delete state.guests[guestId];
  state.queue = state.queue.filter((id) => id !== guestId);
}

// -----------------------------------------------------------------------------
// Personnel
// -----------------------------------------------------------------------------
/** Les employés au-delà du 4e se paient en gemmes. */
export const staffPaidInGems = (state) => state.staff.length >= CONFIG.staffCosts.length;

export function addStaff(state) {
  const n = state.nextStaffId++;
  const s = { id: `s${n}`, name: STAFF_NAMES[(n - 1) % STAFF_NAMES.length], look: (n * 37) % 100, task: null };
  state.staff.push(s);
  return s;
}

// -----------------------------------------------------------------------------
// Coûts
// -----------------------------------------------------------------------------
export function buildCost(state, what) {
  const b = BUILDABLES[what];
  if (b.cost === 'leisure') {
    const n = Object.values(state.rooms).filter((r) => r.kind === 'leisure' || BUILDABLES[r.buildTarget]?.kind === 'leisure').length;
    return CONFIG.leisureBaseCost + CONFIG.leisureStepCost * n;
  }
  return b.cost;
}
export const nextBuildCost = (state) => buildCost(state, 'bedroom');
/** Prix du prochain employé (en 🪙 pour les 4 premiers, puis 15 × (n − 1) gemmes). */
export function staffCost(state) {
  const n = state.staff.length;
  return CONFIG.staffCosts[n] ?? CONFIG.gems.staffStep * (n - 1);
}
/** Prix d'UN nouvel emplacement selon le nombre de pièces existantes. */
export function slotCost(n) {
  if (n <= 9) return 0;
  if (n <= 12) return 50;
  if (n <= 15) return 250;
  if (n <= 18) return 500;
  return Math.floor((n * n * 3) / 100) * 100;
}
/** Prix d'un nouvel emplacement (accueil et emplacements vides compris dans le compte). */
export function extendCost(state) {
  return Math.round(slotCost(Object.keys(state.rooms).length) * (1 - 0.2 * tal(state, 'extendCost') / 3));
}
export const maxFloors = () => CONFIG.maxFloors;
export function taxAmount(state) {
  const lvl = state.hotel.level;
  const base = lvl <= 1 ? (state.firstTax ?? 100) : (CONFIG.taxByLevel[lvl] ?? (lvl - 1) * 1500);
  return Math.round(base * [1, 0.9333, 0.8666, 0.8][tal(state, 'taxDiscount')]);
}
export const repairStepCost = (room, state = null) => Math.ceil(Math.ceil(CONFIG.repairCostPerDamage * CONFIG.repairCostMult[room.level]) * (1 - 0.5 * tal(state, 'repairCost') / 3));
export const careCost = (state = null) => Math.ceil(CONFIG.careCost * (1 - 0.6 * tal(state, 'attendCost') / 3));
export const careHours = (state, g) => CONFIG.careHours * (1 - 0.5 * tal(state, 'attendDuration') / 3) + (g.type === 'glace' ? CONFIG.glaceCareExtraHours : 0);

/** Maîtrises du laboratoire : +1 de base (Insecte, Combat), +50 % de gains (Glace, Électrik, Plante). */
export const MASTERY_BASE = { insecte: 'specInsecte', combat: 'specCombat' };
export const MASTERY_GAIN = { glace: 'specGlace', electrik: 'specElectrik', plante: 'specPlante' };

/** Gain d'une nuit (payé à minuit, puis encore une fois au départ). */
export function nightGain(sat, room, state = null, type = null) {
  const fx = roomEquipEffects(room);
  const s = Math.max(0, Math.min(10, sat));
  const key = MASTERY_GAIN[type];
  const mastery = key ? 1 + 0.5 * tal(state, key) : 1;
  const radin = type === 'insecte' ? (s >= 10 ? CONFIG.insectPayMax : CONFIG.insectPay) : 1;
  const g = CONFIG.clientMoney * CONFIG.payFactors[s] * radin * mastery * CONFIG.roomLevelMult[room.level] * fx.payMult;
  return Math.floor(g + 1e-9);
}

// -----------------------------------------------------------------------------
// Journal
// -----------------------------------------------------------------------------
export function addLog(state, t, kind, text) {
  state.log.push({ id: ++state.logSeq, t, kind, text });
  if (state.log.length > CONFIG.logMax) state.log.splice(0, state.log.length - CONFIG.logMax);
}
