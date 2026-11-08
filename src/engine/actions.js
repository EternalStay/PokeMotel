// =============================================================================
// Actions du joueur. Chaque action :
//   1. reçoit l'état DÉJÀ avancé jusqu'à `now`,
//   2. vérifie ses conditions,
//   3. modifie l'état et renvoie { ok: true } ou { ok: false, error }.
// Côté serveur, ces mêmes fonctions valideront les actions envoyées par le client.
// =============================================================================

import { BUILDABLES, CONFIG, CURRENCY, GEMS, ITEMS, ITEM_IDS, PACKS, SERVICES } from './data.js';
import { MINUTE, HOUR, formatClock } from './time.js';
import {
  addLog, addStaff, careCost, extendCost, lobbyCapacity, lobbyStaffCount, makeRoom, buildCost, extendCheck, shiftColumns,
  updateHotelSize, floorCols,
  occupancy, repairStepCost, roomId, roomIsAvailable, scheduleNextArrival, scheduleRequest, staffCost, staffInRoom,
  enqueueNewGuest, careHours, roomLabel, departureTime, scheduleLeisure, staffPaidInGems,
} from './model.js';
import { questEvent, studyGuest, spendTalent, resetTalents, addResearchPoint } from './progression.js';
import { computeSatisfaction, hasAnyBonus } from './satisfaction.js';
import { bumpGoal } from './achievements.js';
import { applyDecoItem, inheritFloorDeco, openDecoBox, placeDeco, storeDeco } from './deco.js';

const fail = (error) => ({ ok: false, error });
const OK = { ok: true };
const money = (n) => `${n} ${CURRENCY}`;
const gems = (n) => `${n} ${GEMS}`;

// -----------------------------------------------------------------------------
// Clients
// -----------------------------------------------------------------------------

/** Installer un client de la file d'attente dans une chambre libre. */
export function placeGuest(state, guestId, targetRoomId, now) {
  const g = state.guests[guestId];
  if (!g || !state.queue.includes(guestId)) return fail('Ce client n\'est plus dans la file d\'attente.');
  const room = state.rooms[targetRoomId];
  const check = checkTarget(state, room);
  if (check) return fail(check);

  g.roomId = room.id;
  g.placedAt = now;
  g.leaveAt = departureTime(now, g.nightsLeft);
  state.queue = state.queue.filter((id) => id !== guestId);
  state.stats.placed++;
  state.activeWeek = true;
  scheduleRequest(state, g, now, CONFIG.requestRange.arrival);
  scheduleLeisure(state, g, now, 'idle');
  addLog(state, now, 'info', `${g.name} a été installé(e) dans la chambre ${roomLabel(room)}.`);
  hypno(state, g, now);
  questEvent(state, 'place', now);
  return OK;
}

/** Trait "Hypnotiseur" (Psy) : 1re installation à 8 ou plus → un autre client Psy arrive. */
function hypno(state, g, now) {
  if (g.placedOnce) return;
  g.placedOnce = true;
  if (g.type !== 'psy' || state.queue.length >= CONFIG.queueMax) return;
  if (computeSatisfaction(state, g).value >= 8) {
    const n = enqueueNewGuest(state, now, 'psy');
    addLog(state, now, 'good', `🔮 ${g.name} a hypnotisé un passant : ${n.name} fait la queue devant l'hôtel !`);
  }
}

/** « Attirer un client » : un client arrive tout de suite (5 gemmes). */
export function attractGuest(state, now) {
  const cost = CONFIG.gems.attract;
  if (state.queue.length >= CONFIG.queueMax) return fail('La file d\'attente est pleine.');
  if (state.gems < cost) return fail(`Il vous faut ${gems(cost)}.`);
  state.gems -= cost;
  const g = enqueueNewGuest(state, now);
  addLog(state, now, 'info', `📣 Un rabatteur vous ramène ${g.name} (-${gems(cost)}).`);
  return OK;
}

/** Déplacer un client déjà installé (malus de satisfaction, interdit le jour du départ). */
export function moveGuest(state, guestId, targetRoomId, now) {
  const g = state.guests[guestId];
  if (!g || !g.roomId) return fail('Ce client n\'est pas installé.');
  if (g.nightsLeft <= 0) return fail('Impossible de déménager un client le jour de son départ.');
  if (g.roomId === targetRoomId) return fail('Le client est déjà dans cette chambre.');
  const room = state.rooms[targetRoomId];
  const check = checkTarget(state, room);
  if (check) return fail(check);

  const from = state.rooms[g.roomId];
  // L'employé qui le chouchoutait le suit dans sa nouvelle chambre.
  const s = staffInRoom(state, from.id);
  if (s && s.task.kind === 'care') s.task.roomId = room.id;
  g.roomId = room.id;
  g.moves++;
  state.activeWeek = true;
  addLog(state, now, 'info', `${g.name} a été déplacé(e) de la ${roomLabel(from)} à la ${roomLabel(room)}.`);
  return OK;
}

/** Échanger la position de deux clients dans la file d'attente. */
export function swapQueue(state, guestA, guestB) {
  const i = state.queue.indexOf(guestA);
  const j = state.queue.indexOf(guestB);
  if (i < 0 || j < 0) return fail('Client introuvable dans la file.');
  [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
  return OK;
}

/** Répondre à une demande de service en chambre. */
export function fulfillRequest(state, guestId, now) {
  const g = state.guests[guestId];
  if (!g || !g.request) return fail('Ce client n\'a rien demandé.');
  if (now < g.request.until - CONFIG.requestVisibleHours * HOUR) return fail('Ce client n\'a encore rien demandé.');
  const svc = SERVICES[g.request.kind];
  const rooms = Object.values(state.rooms).filter((r) => r.sub === svc.room && r.kind === 'service' && !r.buildEnd);
  if (!rooms.length) return fail(`Il faut construire une ${BUILDABLES[svc.room].name} pour répondre à cette demande.`);
  const free = rooms.find((r) => (r.busyUntil || 0) <= now);
  if (!free) {
    const soon = Math.min(...rooms.map((r) => r.busyUntil));
    return fail(`${BUILDABLES[svc.room].name} occupée jusqu'à ${formatClock(soon, CONFIG.timeZone)}.`);
  }
  free.busyUntil = now + CONFIG.serviceBusyMin * MINUTE;
  g.request = null;
  g.mods.service += CONFIG.serviceGain;
  state.stats.services++;
  bumpGoal(state, 'serv', now);
  scheduleRequest(state, g, now, CONFIG.requestRange.done);
  addLog(state, now, 'good', `Service rendu : ${svc.name} pour ${g.name} (+1).`);
  questEvent(state, 'service', now);
  return OK;
}

// -----------------------------------------------------------------------------
// Personnel
// -----------------------------------------------------------------------------

/** Recruter un employé. */
export function hireStaff(state, now) {
  const cost = staffCost(state);
  const inGems = staffPaidInGems(state);
  const fmt = inGems ? gems : money;
  if ((inGems ? state.gems : state.money) < cost) return fail(`Il vous faut ${fmt(cost)} pour recruter un employé.`);
  if (inGems) state.gems -= cost; else state.money -= cost;
  const s = addStaff(state);
  addLog(state, now, 'info', `${s.name} rejoint le personnel ! (-${fmt(cost)})`);
  questEvent(state, 'hire', now);
  return OK;
}

/**
 * Affecter un employé libre :
 *  - 'lobby'           → accélère l'arrivée des clients,
 *  - chambre abîmée    → la répare,
 *  - chambre occupée   → chouchoute le client (une fois par client).
 */
export function assignStaff(state, staffId, target, now) {
  const s = state.staff.find((x) => x.id === staffId);
  if (!s) return fail('Employé inconnu.');
  if (s.task) return fail(`${s.name} est déjà occupé(e).`);

  if (target === 'lobby') {
    if (lobbyStaffCount(state) >= lobbyCapacity(state)) return fail('L\'accueil est complet : améliorez-le pour y placer plus d\'employés.');
    s.task = { kind: 'lobby' };
    // Les arrivées s'accélèrent immédiatement.
    if (state.nextArrival && state.nextArrival > now) scheduleNextArrival(state, now);
    addLog(state, now, 'info', `${s.name} tient l'accueil.`);
    questEvent(state, 'lobby', now);
    return OK;
  }

  const room = state.rooms[target];
  if (!room || room.kind !== 'bedroom' || room.buildEnd) return fail('Votre employé n\'a rien à faire ici.');
  if (staffInRoom(state, room.id)) return fail('Un employé travaille déjà ici.');
  const g = occupancy(state)[room.id];

  if (g) {
    if (g.cared) return fail(`${g.name} a déjà reçu des petites attentions.`);
    if (g.nightsLeft <= 0) return fail('Ce client est sur le point de partir : trop tard.');
    // Les petites attentions se paient même caisse vide (le solde peut devenir négatif).
    const cost = careCost(state);
    state.money -= cost;
    g.cared = true;
    const hours = careHours(state, g);
    s.task = { kind: 'care', roomId: room.id, guestId: g.id, end: now + hours * 60 * MINUTE };
    addLog(state, now, 'info', `${s.name} s'occupe de ${g.name} (fin vers ${formatClock(s.task.end, CONFIG.timeZone)}, -${money(cost)}).`);
    return OK;
  }
  if (room.damage > 0) {
    const cost = repairStepCost(room, state);
    state.money -= cost;
    s.task = { kind: 'repair', roomId: room.id, end: now + CONFIG.staffRepairMinutes * MINUTE };
    addLog(state, now, 'info', `${s.name} répare la chambre ${roomLabel(room)} (${money(cost)} par point de dégât).`);
    return OK;
  }
  return fail('Cette chambre n\'a besoin de rien. Envoyez plutôt votre employé à l\'accueil.');
}

/** Rappeler un employé (il redevient libre). */
export function recallStaff(state, staffId, now) {
  const s = state.staff.find((x) => x.id === staffId);
  if (!s || !s.task) return fail('Cet employé est déjà libre.');
  const wasLobby = s.task.kind === 'lobby';
  s.task = null;
  if (wasLobby && state.nextArrival && state.nextArrival > now) scheduleNextArrival(state, now);
  return OK;
}

// -----------------------------------------------------------------------------
// Objets
// -----------------------------------------------------------------------------

export function buyItem(state, itemId, now) {
  const it = ITEMS[itemId];
  if (!it || !it.shop) return fail('Objet introuvable en boutique.');
  if (state.gems < it.price) return fail(`Il vous faut ${gems(it.price)}. Les gemmes se gagnent avec les missions, les clients comblés et la taxe.`);
  state.gems -= it.price;
  state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
  addLog(state, now, 'info', `Achat : ${it.name} (-${gems(it.price)}).`);
  return OK;
}

/** Acheter un kit : un exemplaire de chaque article du rayon. */
export function buyPack(state, packId, now) {
  const pack = PACKS[packId];
  if (!pack) return fail('Kit inconnu.');
  if (state.gems < pack.price) return fail(`Il vous faut ${gems(pack.price)}.`);
  state.gems -= pack.price;
  for (const id of ITEM_IDS.filter((i) => ITEMS[i].shop === packId)) state.inventory[id] = (state.inventory[id] || 0) + 1;
  addLog(state, now, 'info', `Achat : ${pack.name} (-${gems(pack.price)}).`);
  return OK;
}

/** Utiliser un objet de l'inventaire sur une chambre. */
export function useItem(state, itemId, targetRoomId, now) {
  const it = ITEMS[itemId];
  if (!it || !(state.inventory[itemId] > 0)) return fail('Vous n\'avez pas cet objet.');
  const room = state.rooms[targetRoomId];
  if (it.kind === 'deco') {
    if (!room || room.floor < 1) return fail('Touchez une pièce de l\'étage à redécorer.');
    applyDecoItem(state, itemId, room.floor, now);
    state.inventory[itemId]--;
    if (state.inventory[itemId] <= 0) delete state.inventory[itemId];
    return OK;
  }
  if (it.kind === 'decobox') return fail('Ouvrez le carton depuis la réserve.');
  if (!room || room.kind !== 'bedroom' || room.buildEnd) return fail('Cet objet ne s\'utilise que dans une chambre.');
  const g = occupancy(state)[room.id];

  if (it.kind === 'equip') {
    if (room.equip.includes(itemId)) return fail('Cet équipement est déjà installé ici.');
    if (room.equip.length >= 2) return fail('2 équipements maximum par chambre : retirez-en un d\'abord.');
    room.equip.push(itemId);
    addLog(state, now, 'info', `${it.name} installé dans la chambre ${roomLabel(room)}.`);
    questEvent(state, 'install', now);
  } else if (it.kind === 'gift') {
    if (!g) return fail('Un cadeau s\'offre à un client installé.');
    if (hasAnyBonus(g)) return fail(`${g.name} a déjà été gâté : un cadeau ne s'offre qu'à un client qui n'a encore reçu aucun bonus.`);
    g.mods.gift = it.gift;
    addLog(state, now, 'good', `${g.name} a reçu : ${it.name} (+${it.gift}).`);
    questEvent(state, 'gift', now);
  } else if (it.kind === 'repair') {
    if (g) return fail('Attendez le départ du client.');
    if (!room.damage) return fail('Cette chambre n\'est pas abîmée.');
    const s = staffInRoom(state, room.id);
    if (s) s.task = null;
    room.damage = 0;
    addLog(state, now, 'good', `Chambre ${roomLabel(room)} réparée en un clin d'œil.`);
  }
  state.inventory[itemId]--;
  if (state.inventory[itemId] <= 0) delete state.inventory[itemId];
  return OK;
}

/** Retirer un équipement (retour dans l'inventaire). */
/**
 * Détruire un équipement installé (comme dans CroqueMotel : un équipement posé
 * ne se déplace pas et n'est pas rendu ; possible même si la chambre est occupée).
 */
export function removeEquip(state, targetRoomId, itemId, now) {
  const room = state.rooms[targetRoomId];
  if (!room || !room.equip.includes(itemId)) return fail('Équipement introuvable.');
  room.equip = room.equip.filter((i) => i !== itemId);
  addLog(state, now, 'info', `${ITEMS[itemId].name} détruit (chambre ${roomLabel(room)}).`);
  return OK;
}

/** Ramasser ce qu'un client a oublié. */
export function collectLeftover(state, targetRoomId, now) {
  const room = state.rooms[targetRoomId];
  if (!room || !room.leftItem) return fail('Rien à ramasser ici.');
  const left = room.leftItem;
  room.leftItem = null;
  if (!left.vials) { state.stats.items++; bumpGoal(state, 'pick', now); questEvent(state, 'pick', now); }
  if (left.vials) {
    for (let i = 0; i < left.vials; i++) addResearchPoint(state, now, true);
    addLog(state, now, 'good', `🧪 Fiole ramassée : +${left.vials} point${left.vials > 1 ? 's' : ''} de recherche !`);
  } else if (left.money) {
    state.money += left.money;
    addLog(state, now, 'money', `Vous avez récupéré ${money(left.money)} "oubliés" par un client.`);
  } else {
    state.inventory[left.item] = (state.inventory[left.item] || 0) + 1;
    addLog(state, now, 'good', `Objet récupéré : ${ITEMS[left.item].name}. Quelqu'un l'aura oublié... mais c'est à vous maintenant !`);
  }
  return { ok: true, left };
}

// -----------------------------------------------------------------------------
// Construction
// -----------------------------------------------------------------------------

/** Peut-on construire `what` ? Renvoie un message d'erreur ou null. */
export function canBuild(state, what) {
  const b = BUILDABLES[what];
  if (!b) return 'Construction inconnue.';
  if (state.hotel.level < b.level) return `Débloqué au niveau ${b.level} de l'hôtel.`;
  if (b.max) {
    const n = Object.values(state.rooms).filter((r) => r.sub === what || r.buildTarget === what).length;
    if (n >= b.max) return `Maximum ${b.max} exemplaire${b.max > 1 ? 's' : ''}.`;
  }
  if (state.money < buildCost(state, what)) return `Il vous faut ${money(buildCost(state, what))}.`;
  return null;
}

/** Pourquoi une pièce ne peut pas être remplacée (ou null). */
export function replaceBlocker(state, room, now = state.time) {
  if (room.kind === 'lobby') return 'L\'accueil ne se remplace pas.';
  if (room.buildEnd) return 'Un chantier est déjà en cours ici.';
  if (occupancy(state)[room.id]) return 'La pièce est occupée.';
  if (Object.values(state.guests).some((g) => g.leisure && g.leisure.roomId === room.id)) return 'Un client profite de la salle.';
  if (staffInRoom(state, room.id)) return 'Un employé travaille ici.';
  if (room.damage) return 'Réparez d\'abord la pièce.';
  if (room.leftItem) return 'Ramassez d\'abord ce qui traîne ici.';
  if ((room.busyUntil || 0) > now) return 'La machine est en service.';
  return null;
}

/**
 * Construire une pièce sur un emplacement libre, ou à la place d'une pièce
 * existante (son niveau et ses équipements sont perdus). Pas de chambre au rez-de-chaussée.
 */
export function buildRoom(state, targetRoomId, what, now) {
  const room = state.rooms[targetRoomId];
  if (!room) return fail('Emplacement inconnu.');
  if (room.kind !== 'empty') {
    const why = replaceBlocker(state, room, now);
    if (why) return fail(why);
    if (room.sub === what) return fail('C\'est déjà cette pièce.');
  } else if (room.buildEnd) return fail('Un chantier est déjà en cours ici.');
  if (what === 'bedroom' && room.floor === 0) return fail('Pas de chambre au rez-de-chaussée : construisez-y une salle.');
  const err = canBuild(state, what);
  if (err) return fail(err);
  const cost = buildCost(state, what);
  const b = BUILDABLES[what];
  if (room.kind !== 'empty') {
    addLog(state, now, 'info', `${BUILDABLES[room.sub]?.name || 'Pièce'} ${roomLabel(room)} démolie pour faire place à : ${b.name}.`);
    Object.assign(room, makeRoom(room.floor, room.col, 'empty'));
  }
  state.money -= cost;
  room.buildTarget = what;
  room.buildEnd = now + b.minutes * MINUTE;
  addLog(state, now, 'info', `Chantier lancé : ${b.name} (${roomLabel(room)}), fin vers ${formatClock(room.buildEnd, CONFIG.timeZone)}. -${money(cost)}`);
  questEvent(state, 'build', now);
  return OK;
}

/** Démolir une pièce vide (redevient un emplacement libre ; équipements rendus). */
export function demolishRoom(state, targetRoomId, now) {
  const room = state.rooms[targetRoomId];
  if (!room || room.kind === 'empty' || room.buildEnd) return fail('Rien à démolir ici.');
  if (room.kind === 'lobby') return fail('L\'accueil ne se démolit pas.');
  if (occupancy(state)[room.id] || staffInRoom(state, room.id)) return fail('La pièce doit être vide.');
  if (Object.values(state.guests).some((g) => g.leisure && g.leisure.roomId === room.id)) return fail('Un client profite de la salle.');
  if ((room.busyUntil || 0) > now) return fail('La machine est en service.');
  // Les équipements sont perdus avec la pièce (comme dans CroqueMotel).
  if (room.leftItem) collectLeftover(state, room.id, now);
  Object.assign(room, makeRoom(room.floor, room.col, 'empty'));
  addLog(state, now, 'info', `Pièce ${roomLabel(room)} démolie.`);
  return OK;
}

/** Améliorer une chambre (gains plus élevés, réparations plus chères). */
export function upgradeRoom(state, targetRoomId, now) {
  const room = state.rooms[targetRoomId];
  if (!room || room.kind !== 'bedroom' || room.buildEnd) return fail('Seule une chambre peut être améliorée.');
  if (room.level >= CONFIG.roomMaxLevel) return fail('Cette chambre est déjà au niveau maximum.');
  if (occupancy(state)[room.id]) return fail('Attendez que la chambre soit libre.');
  if (room.damage) return fail('Réparez d\'abord la chambre.');
  const cost = CONFIG.roomUpgradeCost[room.level + 1];
  if (state.money < cost) return fail(`Il vous faut ${money(cost)}.`);
  state.money -= cost;
  room.buildTarget = 'upgrade';
  room.buildEnd = now + CONFIG.roomUpgradeMinutes * MINUTE;
  addLog(state, now, 'info', `Travaux d'amélioration : chambre ${roomLabel(room)} (fin vers ${formatClock(room.buildEnd, CONFIG.timeZone)}). -${money(cost)}`);
  return OK;
}

/** Améliorer l'accueil (un employé de plus). */
export function upgradeLobby(state, now) {
  const next = state.hotel.lobbyLevel + 1;
  const cost = CONFIG.lobbyUpgradeCost[next];
  if (cost === undefined) return fail('L\'accueil est déjà au niveau maximum.');
  if (state.money < cost) return fail(`Il vous faut ${money(cost)}.`);
  state.money -= cost;
  state.hotel.lobbyLevel = next;
  addLog(state, now, 'good', `Accueil amélioré : ${lobbyCapacity(state)} employés peuvent y travailler.`);
  return OK;
}

/**
 * Agrandir l'hôtel d'UNE case (comme dans CroqueMotel) : à côté d'une pièce du
 * même étage, ou au-dessus du dernier étage. Au rez-de-chaussée, une case
 * ajoutée à droite fait glisser l'étage : elle prend la première place et
 * l'accueil reste au bout.
 */
export function extendRoom(state, floor, col, now) {
  const err = extendCheck(state, floor, col);
  if (err) return fail(err);
  const cost = extendCost(state);
  if (state.money < cost) return fail(`Il vous faut ${money(cost)}.`);
  state.money -= cost;
  const before = Object.keys(state.rooms).length;
  const ground = floorCols(state, 0);
  if (floor === 0 && ground.length && col === Math.max(...ground) + 1) {
    // L'étage glisse d'un cran vers la droite ; la nouvelle case prend la première place.
    const first = Math.min(...ground);
    shiftColumns(state, 1, 0);
    col = first;
  }
  if (col < 0) {
    // Jamais de colonne négative : tout l'hôtel se décale vers la droite.
    shiftColumns(state, -col);
    col = 0;
  }
  state.rooms[roomId(floor, col)] = makeRoom(floor, col, 'empty');
  inheritFloorDeco(state, floor);
  updateHotelSize(state);
  state.hotel.extensions++;
  // Au-delà de 9 pièces, chaque nouvel emplacement rapporte 1 ⭐.
  const fame = before + 1 > CONFIG.extendFameFromRooms ? 1 : 0;
  state.prestige += fame;
  addLog(state, now, 'good', `Agrandissement terminé : nouvel emplacement ${roomLabel(state.rooms[roomId(floor, col)])}.${fame ? ` +${fame} ⭐` : ''}${cost ? ` (-${money(cost)})` : ''}`);
  questEvent(state, 'extend', now);
  return { ok: true, roomId: roomId(floor, col) };
}

/** Renommer l'hôtel. */
export function renameHotel(state, name) {
  const clean = String(name || '').trim().slice(0, 32);
  if (!clean) return fail('Le nom ne peut pas être vide.');
  state.hotel.name = clean;
  questEvent(state, 'rename', state.time);
  return OK;
}

/** Raison pour laquelle une chambre ne peut pas recevoir de client (ou null). */
function checkTarget(state, room) {
  if (!room) return 'Chambre inconnue.';
  if (room.buildEnd) return 'Cette pièce est en construction.';
  if (room.kind !== 'bedroom') return room.kind === 'empty' ? 'Construisez d\'abord une chambre ici.' : 'Ce n\'est pas une chambre.';
  if (room.damage > 0) return 'Cette chambre est abîmée : envoyez un employé la réparer.';
  if (room.leftItem) return 'Ramassez d\'abord ce que le client précédent a oublié.';
  if (!roomIsAvailable(state, room)) return 'Cette chambre est déjà occupée.';
  return null;
}

/** Table des actions par nom (utile pour un futur appel serveur générique). */
export { studyGuest, spendTalent, resetTalents };

export const ACTIONS = {
  studyGuest, spendTalent, resetTalents, attractGuest, buyPack, openDecoBox, placeDeco, storeDeco,
  placeGuest, moveGuest, swapQueue, fulfillRequest, hireStaff, assignStaff, recallStaff, buyItem, useItem,
  removeEquip, collectLeftover, buildRoom, demolishRoom, upgradeRoom, upgradeLobby, extendRoom, renameHotel,
};
