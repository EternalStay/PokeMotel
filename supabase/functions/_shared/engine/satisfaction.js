// =============================================================================
// Calcul de la satisfaction (0 à 10), selon les règles de CroqueMotel :
//   base 3 (Star : 1)
//   + pour chaque goût   : présent → +2 par source, absent → −3
//   + pour chaque aversion : présente → −3 par source, absente → +2
//   + voisin Jovial : +1 ; Star : chambre de luxe +2 / sinon −3
//   + chambre abîmée : −1 par point (doublé pour une Star) ; attentions, cadeaux,
//     services ; déménagement −2 une seule fois (−1 avec le talent)
//   + hystérie : −3 par client Combat qui hurle (à 4 ou moins), sauf pour lui-même
// Une "source" est un voisin (gauche, droite, dessus, dessous) qui émet l'aura,
// ou un équipement de la chambre. On ne respire jamais sa propre aura.
//
// Chaque ligne du détail est structurée pour l'interface :
//   { label, value, kind, aura?, from?, dir?, source?, present? }
//   kind : base | aura | equip | missing | absent | joy | star | room | move | care | gift | service | comfort | isolated | hysteria
// =============================================================================

import { AURAS, ITEMS, TYPES, TYPE_EMITS, CONFIG } from './data.js';
import { neighborIds, occupancy, roomEquipEffects, isLuxuryRoom, starRequiredLevel, guestAuras, tal } from './model.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Direction d'une pièce voisine par rapport à une autre. */
export function directionOf(state, fromId, toId) {
  const a = state.rooms[fromId];
  const b = state.rooms[toId];
  if (b.floor === a.floor) return b.col < a.col ? 'left' : 'right';
  return b.floor > a.floor ? 'up' : 'down';
}

/** Sources de chaque aura reçues dans une chambre (voisins + équipements). */
export function auraSources(state, atRoom, occ, selfId = null) {
  const room = state.rooms[atRoom];
  const fx = roomEquipEffects(room);
  const sources = {}; // aura -> [{ kind: 'neighbor'|'equip', ... }]
  const add = (aura, src) => { (sources[aura] ||= []).push(src); };
  const neighbors = [];

  if (!fx.isolate) {
    for (const id of neighborIds(state, atRoom)) {
      if (roomEquipEffects(state.rooms[id]).isolate) continue;
      const n = occ[id];
      if (!n || n.id === selfId) continue;
      const dir = directionOf(state, atRoom, id);
      neighbors.push({ guest: n, dir, roomId: id });
      if (n.type === 'spectre') continue; // invisible : n'émet rien, ne compte pas comme voisin
      add('voisinage', { kind: 'neighbor', name: n.name, type: n.type, dir, from: id });
      for (const a of guestAuras(n)) add(a, { kind: 'neighbor', name: n.name, type: n.type, dir, from: id });
    }
  }
  for (const { aura, item } of fx.auras) add(aura, { kind: 'equip', item, name: ITEMS[item].name });
  return { sources, neighbors, fx };
}

/**
 * Clients Combat qui hurlent (satisfaction ≤ 4 hors hystérie) pour une occupation donnée.
 * Renvoie la liste des clients hurleurs.
 */
export function screamers(state, occ = occupancy(state)) {
  const out = [];
  for (const g of Object.values(occ)) {
    if (g.type !== 'combat') continue;
    if (computeSatisfaction(state, g, g.roomId, occ, { screamers: [] }).value <= CONFIG.hysteriaThreshold) out.push(g);
  }
  return out;
}

/**
 * Satisfaction détaillée d'un client.
 * @param atRoom chambre à évaluer (par défaut la sienne ; sert à l'aperçu)
 * @param occ    occupation à utiliser (par défaut l'occupation réelle)
 * @param opts.screamers hurleurs déjà calculés pour `occ` (évite de les recalculer)
 */
export function computeSatisfaction(state, guest, atRoom = guest.roomId, occ = occupancy(state), opts = {}) {
  const lines = [{ label: guest.star ? 'Satisfaction de base (Star)' : 'Satisfaction de base', value: guest.baseSat, kind: 'base' }];
  const mods = guest.mods || {};
  const pushMods = () => {
    if (guest.moves > 0) lines.push({ label: 'Déménagement', value: tal(state, 'easyMove') ? CONFIG.movePenalty / 2 : CONFIG.movePenalty, kind: 'move' });
    if (mods.comfort) lines.push({ label: `Matelas nuage (${mods.comfort} nuit${mods.comfort > 1 ? 's' : ''})`, value: mods.comfort, kind: 'comfort' });
    if (mods.bonus) lines.push({ label: 'Bonnes surprises', value: mods.bonus, kind: 'bonus' });
    if (mods.fireworks) lines.push({ label: 'Feux d\'artifice', value: mods.fireworks, kind: 'bonus' });
    if (mods.malus) lines.push({ label: 'Petits tracas', value: -mods.malus, kind: 'malus' });
    if (mods.care) lines.push({ label: 'Petites attentions du personnel', value: mods.care, kind: 'care' });
    if (mods.gift) lines.push({ label: 'Cadeau de bienvenue', value: mods.gift, kind: 'gift' });
    if (mods.service) lines.push({ label: 'Services rendus', value: mods.service, kind: 'service' });
  };
  const finish = () => {
    const raw = lines.reduce((s, l) => s + l.value, 0);
    return { value: clamp(raw, 0, 10), raw, lines };
  };
  const hysteria = () => {
    const list = (opts.screamers ?? screamers(state, occ)).filter((x) => x.id !== guest.id);
    for (const x of list) lines.push({ label: `${x.name} hurle (hystérique)`, value: CONFIG.hysteriaMalus, kind: 'hysteria', source: x.name, from: x.roomId });
  };
  if (!atRoom) { pushMods(); return finish(); }

  const room = state.rooms[atRoom];
  const { sources, neighbors, fx } = auraSources(state, atRoom, occ, guest.id);
  if (fx.isolate) lines.push({ label: 'Chambre isolée : rien n\'entre ni ne sort', value: 0, kind: 'isolated' });

  const srcLine = (aura, s, value, liked) => ({
    label: `${AURAS[aura].name} ${s.kind === 'equip' ? `(${s.name})` : `de ${s.name}`} — ${liked ? 'il aime' : 'il déteste'}`,
    value, kind: s.kind === 'equip' ? 'equip' : 'aura', aura, dir: s.dir, from: s.from, source: s.name, item: s.item, present: true,
  });

  for (const aura of guest.likes) {
    const src = sources[aura] || [];
    if (src.length) for (const s of src) lines.push(srcLine(aura, s, CONFIG.likeOk, true));
    else lines.push({ label: `Absence de ${AURAS[aura].name} — il en voudrait`, value: CONFIG.likeNok, kind: 'missing', aura, present: false });
  }
  for (const aura of guest.dislikes) {
    const src = sources[aura] || [];
    if (src.length) for (const s of src) lines.push(srcLine(aura, s, CONFIG.likeNok, false));
    else lines.push({ label: `Pas de ${AURAS[aura].name} — tant mieux`, value: CONFIG.likeOk, kind: 'absent', aura, present: false });
  }

  // Voisins Joviaux.
  for (const n of neighbors) {
    if (n.guest.type === 'normal') lines.push({ label: `${n.guest.name} est jovial`, value: CONFIG.joy, kind: 'joy', dir: n.dir, from: n.roomId, source: n.guest.name });
  }

  if (guest.star) {
    const lux = isLuxuryRoom(state, room);
    lines.push({ label: lux ? 'Chambre de luxe' : `Chambre trop modeste (niveau ${starRequiredLevel(state)} exigé)`, value: lux ? CONFIG.likeOk : CONFIG.likeNok, kind: 'star', present: lux });
  }
  if (room.damage) lines.push({ label: guest.star ? 'État de la chambre (une Star le voit double)' : 'État de la chambre', value: -room.damage * (guest.star ? 2 : 1), kind: 'room' });

  pushMods();
  hysteria();
  return finish();
}

/**
 * Aperçu : satisfaction qu'aurait `guest` dans `targetRoomId`, et variation
 * de chacun des autres clients concernés.
 */
export function previewPlacement(state, guest, targetRoomId) {
  const occ = occupancy(state);
  const simOcc = { ...occ };
  if (guest.roomId) delete simOcc[guest.roomId];
  const simGuest = { ...guest, roomId: targetRoomId, moves: guest.roomId ? guest.moves + 1 : guest.moves };
  simOcc[targetRoomId] = simGuest;

  const scrBefore = screamers(state, occ);
  const scrAfter = screamers(state, simOcc);
  const detail = computeSatisfaction(state, simGuest, targetRoomId, simOcc, { screamers: scrAfter });
  let othersDelta = 0;
  const others = [];
  for (const other of Object.values(occ)) {
    if (other.id === guest.id) continue;
    const before = computeSatisfaction(state, other, other.roomId, occ, { screamers: scrBefore }).value;
    const after = computeSatisfaction(state, other, other.roomId, simOcc, { screamers: scrAfter }).value;
    if (after !== before) others.push({ guestId: other.id, roomId: other.roomId, name: other.name, before, after });
    othersDelta += after - before;
  }
  return { self: detail.value, lines: detail.lines, othersDelta, others };
}

/** Un client a-t-il déjà reçu le moindre bonus ? (un cadeau est alors refusé) */
export function hasAnyBonus(g) {
  const m = g.mods || {};
  return (m.care || 0) + (m.service || 0) + (m.gift || 0) + (m.bonus || 0) + (m.comfort || 0) + (m.fireworks || 0) > 0;
}

/** Humeur : rouge ≤ 3, orange ≤ 6, vert au-delà. */
export function moodOf(sat) {
  if (sat <= 3) return 'bad';
  if (sat <= 6) return 'mid';
  return 'good';
}

/** Types (débloqués) dont les Pokémon dégagent souvent une aura (c'est leur effet principal). */
export function emittersOf(aura, level = 99) {
  return Object.values(TYPES).filter((t) => (TYPE_EMITS[t.id] || [])[0] === aura && t.unlock <= level).map((t) => t.name);
}

/** Comment obtenir une aura : voisin d'un type, ou équipement. */
function howToGet(aura, level) {
  if (aura === 'voisinage') return 'installez quelqu\'un à côté de lui (ou un Nounours câlin)';
  const names = emittersOf(aura, level);
  const item = Object.values(ITEMS).find((i) => i.auras && i.auras.length === 1 && i.auras[0] === aura);
  const who = `un voisin qui en dégage${names.length ? ` (souvent ${names.join(' ou ')})` : ''}`;
  return [who, item ? `un ${item.name}` : ''].filter(Boolean).join(' ou ');
}

/** Conseils concrets pour un client. Renvoie [{ tone: 'good'|'bad'|'tip', text }]. */
export function adviceFor(state, guest) {
  const out = [];
  if (guest.roomId) {
    const sat = computeSatisfaction(state, guest);
    for (const l of sat.lines) {
      if (l.kind === 'missing') out.push({ tone: 'bad', text: `Il lui manque : ${AURAS[l.aura].name} (−3). Solution : ${howToGet(l.aura, state.hotel.level)} → +2.` });
      if ((l.kind === 'aura') && l.value < 0) out.push({ tone: 'bad', text: `${l.source} lui envoie ${AURAS[l.aura].name.toLowerCase()} qu'il déteste (−3) : déménagez l'un des deux.` });
      if (l.kind === 'equip' && l.value < 0) out.push({ tone: 'bad', text: `Retirez ${ITEMS[l.item].name} de sa chambre (−3).` });
      if (l.kind === 'star' && l.value < 0) out.push({ tone: 'bad', text: `Une Star exige une chambre de niveau ${starRequiredLevel(state)} (+2 au lieu de −3).` });
      if (l.kind === 'aura' && l.value > 0) out.push({ tone: 'good', text: `${l.source} lui apporte ${AURAS[l.aura].name.toLowerCase()} (+2).` });
    }
    if (!guest.cared && guest.nightsLeft > 0) out.push({ tone: 'tip', text: 'Un employé peut lui offrir des petites attentions (+1 possible).' });
    if (!hasAnyBonus(guest)) out.push({ tone: 'tip', text: 'Un panier de bienvenue lui ferait plaisir (+1) — à offrir avant tout autre bonus.' });
    if (guest.type === 'combat' && sat.value <= CONFIG.hysteriaThreshold) out.push({ tone: 'bad', text: `Il hurle ! Remontez-le au-dessus de ${CONFIG.hysteriaThreshold} : tous les autres clients perdent 3.` });
    if (guest.type === 'electrik' && (sat.value === 0 || sat.value === 10)) out.push({ tone: 'bad', text: 'Il est instable : ramenez-le entre 1 et 9 avant l\'explosion !' });
    for (const l of sat.lines) if (l.kind === 'hysteria') out.push({ tone: 'bad', text: `${l.source} hurle dans l'hôtel (−3) : calmez-le.` });
  } else {
    for (const a of guest.likes) out.push({ tone: 'tip', text: `Il veut : ${AURAS[a].name} — ${howToGet(a, state.hotel.level)} (+2 pour chaque voisin ou objet qui en apporte, −3 s'il n'y en a aucun).` });
    for (const a of guest.dislikes) out.push({ tone: 'bad', text: `Il déteste : ${AURAS[a].name} — évitez ${a === 'voisinage' ? 'de lui donner des voisins' : 'les voisins qui en dégagent (voyez leur fiche)'} (−3 pour chaque voisin qui en apporte, +2 s'il n'y en a aucun).` });
  }
  const t = TYPES[guest.type];
  out.push({ tone: 'tip', text: `Particularité « ${t.trait.name} » : ${t.trait.desc}` });
  return out;
}
