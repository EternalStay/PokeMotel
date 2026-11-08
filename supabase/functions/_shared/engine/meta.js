// =============================================================================
// Publicité (vitrine quotidienne de sponsors) et legs de l'hôtel (étoiles).
// Règles de CroqueMotel d'après la réécriture Eternaltwin :
//   - chaque jour, 4 à 6 sponsors proposent un lot de clients (ou de Stars),
//     payé en 🪙 et livré au réveil, à 6 h ; la vitrine est déterministe
//     (même hôtel + même jour = mêmes offres) ;
//   - le legs : niveau 4 + étoiles, 3000 🪙 en caisse (non débités) et assez
//     de pièces bâties ; on repart au niveau 2 avec l'accueil seul, une étoile
//     de plus, +150 ⭐, l'arbre de talents remis à zéro, le tutoriel validé.
// =============================================================================

import { CONFIG, CURRENCY } from './data.js';
import { dayKey } from './time.js';
import {
  addLog, createState, enqueueNewGuest, makeRoom, scheduleNextArrival, updateHotelSize, firstTaxAmount,
} from './model.js';
import { QUESTS, TUTORIAL_END, canRestart, grantReward } from './progression.js';
import { makeSeed, rngFor } from './rng.js';
import { bumpGoal, setGoal } from './achievements.js';

// -----------------------------------------------------------------------------
// Publicité
// -----------------------------------------------------------------------------

/** Sponsors (noms originaux). */
export const SPONSORS = [
  'Gluant & Fils', 'Radio Grognement', 'Croquettes Royales', 'Le Petit Écho des Marais', 'Bave Express',
  'Agence Frisson', 'Club des Cornus', 'Tentacules Voyages', 'La Gazette du Grenier', 'Mousse-Mousse Cola',
  'Pneus Ventouse', 'Télé-Cauchemar', 'Office du Tourisme des Égouts', 'Pharmacie du Crapaud', 'Ferme Grumeleuse',
  'Banque du Tas de Pièces', 'Boulangerie Croûtemolle', 'Taxis Rampants', 'Cirque Biscornu', 'Opéra des Hurleurs',
  'Laverie Plein Sud', 'Ligue de Catch Visqueux', 'Pâtisserie Mille-Pattes', 'Assurance Tout-Risque-Rien',
];

/** Générateur de Lehmer (le même que l'original) : une graine donne toujours la même suite. */
class Lehmer {
  constructor(seed) { this.s = Math.abs(Math.floor(seed)) % 2147483646 || 1; }
  next(max) { this.s = (this.s * 16807) % 2147483647; return max > 0 ? this.s % max : 0; }
  range(min, max) { return min + this.next(max - min + 1); }
  pick(list) {
    let roll = this.next(list.reduce((t, e) => t + e.weight, 0));
    for (const e of list) if ((roll -= e.weight) < 0) return e.value;
    return list.at(-1).value;
  }
}

const hash = (str) => { let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; };
const VIP_BASE_COST = { 1: 300, 2: 580, 3: 825, 4: 1040 };

/** Offre d'un sponsor : son contenu ne dépend que de son nom (la 1re du jour est toujours un lot de Stars). */
function buildCampaign(name, index, stars) {
  let seed = name.length;
  for (let i = 0; i < name.length; i++) seed += name.charCodeAt(i);
  const r = new Lehmer(seed);
  const vip = index === 0 || r.pick([{ value: true, weight: 15 }, { value: false, weight: 100 }]);
  if (!vip) {
    const count = r.range(2, 5);
    const cost = Math.floor(count * CONFIG.clientMoney * 0.9) + count * stars * r.range(5, 20) + r.range(10, 80);
    return { index, name, vip: false, count, cost };
  }
  const count = r.pick([{ value: 1, weight: 120 }, { value: 2, weight: 50 }, { value: 3, weight: 5 }, { value: 4, weight: 1 }]);
  return { index, name, vip: true, count, cost: VIP_BASE_COST[count] + r.range(10, 150) };
}

/** La vitrine du jour (4 à 6 sponsors), identique toute la journée pour un hôtel donné. */
export function campaignsOf(state, now) {
  const day = dayKey(now, CONFIG.timeZone);
  const r = new Lehmer(hash(`${state.seed}:${day}`));
  const n = r.range(4, 6);
  const names = [...SPONSORS];
  const out = [];
  for (let i = 0; i < n; i++) out.push(buildCampaign(names.splice(r.next(names.length), 1)[0], i, state.stars || 0));
  const bought = state.ads && state.ads.day === day ? state.ads.bought : [];
  return out.map((c) => ({ ...c, bought: bought.includes(c.index) }));
}

/** Acheter une offre : les clients arriveront au prochain réveil (6 h). */
export function buyCampaign(state, index, now) {
  const c = campaignsOf(state, now).find((x) => x.index === index);
  if (!c) return { ok: false, error: 'Offre introuvable.' };
  if (c.bought) return { ok: false, error: 'Vous avez déjà signé avec ce sponsor aujourd\'hui.' };
  if (state.money < c.cost) return { ok: false, error: `Il vous faut ${c.cost} ${CURRENCY}.` };
  state.money -= c.cost;
  const day = dayKey(now, CONFIG.timeZone);
  if (!state.ads || state.ads.day !== day) state.ads = { day, bought: [], pending: state.ads?.pending || [] };
  state.ads.bought.push(index);
  state.ads.pending.push({ vip: c.vip, count: c.count, name: c.name });
  state.stats.ads = (state.stats.ads || 0) + 1;
  bumpGoal(state, 'pub', now);
  addLog(state, now, 'info', `📣 Campagne signée avec ${c.name} : ${c.count} ${c.vip ? `Star${c.count > 1 ? 's' : ''}` : 'clients'} arriveront à ${CONFIG.wakeUpHour}h (-${c.cost} ${CURRENCY}).`);
  return { ok: true };
}

/** Au réveil : les clients des campagnes arrivent. */
export function deliverCampaigns(state, t) {
  const pending = state.ads?.pending || [];
  if (!pending.length) return;
  state.ads.pending = [];
  for (const p of pending) {
    for (let i = 0; i < p.count; i++) {
      const g = enqueueNewGuest(state, t);
      if (p.vip) { g.star = true; g.baseSat = CONFIG.vipBase; }
    }
    addLog(state, t, 'good', `📣 Grâce à ${p.name}, ${p.count} ${p.vip ? `Star${p.count > 1 ? 's arrivent' : ' arrive'}` : 'clients arrivent'} à l'hôtel !`);
  }
}

// -----------------------------------------------------------------------------
// Legs
// -----------------------------------------------------------------------------
export const LEGACY = { money: 3000, fame: 150, restartLevel: 2, keptStaff: 1, compensation: 600, rooms: [12, 20, 30, 50, 75, 100, 150] };

/** Pièces bâties (hors accueil et emplacements vides). */
export const builtRooms = (state) => Object.values(state.rooms).filter((r) => r.kind !== 'empty' && r.kind !== 'lobby').length;

/** Conditions du prochain legs et leur état. */
export function legacyStatus(state) {
  const stars = state.stars || 0;
  const need = { level: 4 + stars, money: LEGACY.money, rooms: LEGACY.rooms[Math.min(stars, LEGACY.rooms.length - 1)] };
  const have = { level: state.hotel.level, money: state.money, rooms: builtRooms(state) };
  return { need, have, ok: have.level >= need.level && have.money >= need.money && have.rooms >= need.rooms };
}

/**
 * Léguer l'hôtel : on garde l'argent (+600), 1 employé et l'inventaire (sauf le
 * mobilier) ; on repart au niveau 2 avec l'accueil seul, +1 étoile, +150 ⭐,
 * l'arbre de talents remis à zéro et le tutoriel validé d'un coup.
 */
export function bequeathHotel(state, now) {
  const st = legacyStatus(state);
  if (!st.ok) return { ok: false, error: 'Vous ne remplissez pas encore les conditions du legs.' };
  state.stars = (state.stars || 0) + 1;
  state.prestige += LEGACY.fame;
  state.money += LEGACY.compensation;
  // Nouvel hôtel : l'accueil seul.
  state.rooms = { '0-0': makeRoom(0, 0, 'lobby') };
  state.hotel.level = LEGACY.restartLevel;
  state.hotel.lobbyLevel = 1;
  state.hotel.extensions = 0;
  updateHotelSize(state);
  state.guests = {};
  state.queue = [];
  state.staff = state.staff.slice(0, LEGACY.keptStaff).map((s) => ({ ...s, task: null }));
  state.floorDeco = {};
  state.furniture = [];
  state.research = { points: 0, progress: 0, talents: {} };
  state.ads = null;
  state.activeWeek = false;
  state.lastTax = null;
  state.firstTax = firstTaxAmount(now);
  state.lastArrival = now;
  // Le tutoriel est sauté : toutes ses récompenses d'un coup (sans gemmes de mission).
  for (const q of QUESTS) if (!q.repeat) for (const r of q.rewards) grantReward(state, r, now);
  state.questsDone = Math.max(state.questsDone, TUTORIAL_END + 1);
  state.gems += CONFIG.gems.tutorialEnd;
  const repeats = QUESTS.map((q, i) => i).filter((i) => QUESTS[i].repeat);
  const next = rngFor(state).pick(repeats);
  state.quest = { id: next, done: QUESTS[next].goals.map(() => false) };
  enqueueNewGuest(state, now);
  scheduleNextArrival(state, now);
  const text = `Vous avez légué votre hôtel ! Une ${state.stars === 1 ? '1re' : `${state.stars}e`} étoile brille désormais à côté de votre nom (+${LEGACY.fame} ⭐). Vous repartez au niveau ${LEGACY.restartLevel} avec l'accueil seul, ${state.money.toLocaleString('fr-FR')} ${CURRENCY}, votre réserve${state.staff.length ? ` et ${state.staff.length} employé` : ''}.`;
  addLog(state, now, 'good', `🏆 ${text}`);
  (state.notices ||= []).push({ kind: 'legacy', text, stars: state.stars });
  setGoal(state, 'stars', state.stars, now);
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Recommencer (seulement jusqu'à la mission de la première nuit)
// -----------------------------------------------------------------------------

/** Compensation du début personnalisé : de quoi bâtir soi-même les 6 chambres d'un hôtel neuf. */
export const CUSTOM_START_MONEY = 6 * 100;

/**
 * Recommencer : un hôtel neuf (nom tiré au sort, nouvelle graine). En
 * personnalisé, l'hôtel est réduit à l'accueil, avec 600 🪙 pour placer soi-même
 * ses pièces. Les gemmes suivent le joueur, comme dans la réécriture.
 */
export function restartHotel(state, custom, now) {
  if (!canRestart(state)) return { ok: false, error: 'On ne peut recommencer que jusqu\'à la mission de la première nuit.' };
  const fresh = createState(now, makeSeed(now ^ state.rng));
  fresh.gems = state.gems;
  if (custom) {
    fresh.rooms = { '0-0': makeRoom(0, 0, 'lobby') };
    updateHotelSize(fresh);
    fresh.money += CUSTOM_START_MONEY;
    addLog(fresh, now, 'info', `Début personnalisé : l'hôtel se réduit à l'accueil, et le Consortium vous verse ${CUSTOM_START_MONEY} ${CURRENCY} pour bâtir vos pièces vous-même.`);
  }
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, fresh);
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Enseigne
// -----------------------------------------------------------------------------

/** Couleurs du néon de l'enseigne (Bureau › Réglages). */
export const NEON_COLORS = ['#ff4f6d', '#ff8a7a', '#ffc04d', '#ffe23d', '#c8ff3d', '#6dff5a', '#2bf5a6', '#29d8ff', '#7ea6ff', '#b58cff', '#ff8ce6', '#e6d3a8', '#e3eef2'];
export const DEFAULT_NEON = 10;

export function setNeon(state, index) {
  if (!Number.isInteger(index) || index < 0 || index >= NEON_COLORS.length) return { ok: false, error: 'Couleur inconnue.' };
  state.hotel.neon = index;
  return { ok: true };
}


// -----------------------------------------------------------------------------
// Œufs surprise (le « colis suspect » d'origine) : un client envoyé par un ami.
// Il loge une nuit, ne paie jamais, reste en file au minuit qui suit son
// arrivée, et compte comme « Œuf d'ami bien traité » s'il part à 6 ou plus.
// Le serveur appelle `receiveParcel` chez le destinataire ; l'expéditeur, lui,
// n'en envoie qu'un par jour (`canSendParcel` / `markParcelSent`).
// -----------------------------------------------------------------------------
export const PARCEL = { maxAtHost: 3 };

export const parcelsAt = (state) => Object.values(state.guests).filter((g) => g.parcel).length;

export function receiveParcel(state, from, now) {
  const sender = String(from || '').trim().slice(0, 32);
  if (!sender) return { ok: false, error: 'Expéditeur inconnu.' };
  if (parcelsAt(state) >= PARCEL.maxAtHost) return { ok: false, error: `Cet hôtel a déjà ${PARCEL.maxAtHost} Œufs d'amis en attente.` };
  const g = enqueueNewGuest(state, now);
  // Jamais une Star : on garde seulement le bonus de maîtrise de son type.
  if (g.star) g.baseSat += CONFIG.baseSat - CONFIG.vipBase;
  g.star = false;
  g.parcel = { from: sender };
  g.stay = 1;
  g.nightsLeft = 1;
  addLog(state, now, 'good', `🥚 ${sender} vous envoie un Œuf surprise : ${g.name} attend dans la file. Il ne paiera pas, mais soignez-le !`);
  (state.notices ||= []).push({ kind: 'parcel', from: sender, guestId: g.id });
  return { ok: true, guestId: g.id };
}

export function canSendParcel(state, now) {
  return state.lastParcelDay !== dayKey(now, CONFIG.timeZone);
}

export function markParcelSent(state, now) {
  if (!canSendParcel(state, now)) return { ok: false, error: 'Vous avez déjà envoyé un Œuf aujourd\'hui.' };
  state.lastParcelDay = dayKey(now, CONFIG.timeZone);
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Gérant
// -----------------------------------------------------------------------------
export function setManager(state, name) {
  const clean = String(name || '').trim().slice(0, 24);
  if (!clean) return { ok: false, error: 'Le nom ne peut pas être vide.' };
  state.manager = clean;
  return { ok: true };
}
