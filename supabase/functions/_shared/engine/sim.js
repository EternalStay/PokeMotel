// =============================================================================
// Simulation temps réel "à la demande".
// `advance(state, now)` rejoue dans l'ordre chronologique tous les événements
// survenus depuis `state.time` (arrivées, minuit, départs de 10h, chantiers,
// employés, demandes de service, salles de loisir, Bombes). Le même code
// servira côté serveur.
// =============================================================================

import { BUILDABLES, CONFIG, CURRENCY, GEMS, ITEMS, ITEM_IDS, TYPES } from './data.js';
import { rngFor } from './rng.js';
import { nextLocalHour, isNightTime, formatClock, zonedParts, MINUTE, HOUR } from './time.js';
import {
  addLog, enqueueNewGuest, occupancy, removeGuest, scheduleNextArrival, scheduleRequest, pickRequestKind,
  roomEquipEffects, repairStepCost, taxAmount, nightGain, roomLabel, tal, favoriteLeisure, scheduleLeisure,
} from './model.js';
import { computeSatisfaction, screamers } from './satisfaction.js';
import { questEvent, runEvent } from './progression.js';
import { deliverCampaigns } from './meta.js';
import { bumpGoal, WELL_TREATED } from './achievements.js';

export { roomLabel };

const tz = CONFIG.timeZone;
const DAY = 24 * HOUR;

function nextEvent(state) {
  let best = null;
  const consider = (t, kind, prio, extra) => {
    if (t == null) return;
    if (!best || t < best.t || (t === best.t && prio < best.prio)) best = { t, kind, prio, ...extra };
  };
  for (const r of Object.values(state.rooms)) consider(r.buildEnd, 'build', 0, { roomId: r.id });
  for (const s of state.staff) if (s.task && s.task.end) consider(s.task.end, 'staff', 0, { staffId: s.id });
  consider(nextLocalHour(state.time, 0, tz), 'midnight', 1);
  consider(nextLocalHour(state.time, CONFIG.checkoutHour, tz), 'checkout', 2);
  consider(state.nextArrival, 'arrival', 3);
  consider(state.nextEventAt, 'event', 5);
  if (state.ads?.pending?.length) consider(nextLocalHour(state.time, CONFIG.wakeUpHour, tz), 'wakeup', 2);
  for (const g of Object.values(state.guests)) {
    if (!g.roomId) continue;
    if (g.request) consider(g.request.until, 'requestExpire', 4, { guestId: g.id });
    else consider(g.nextRequestAt, 'request', 4, { guestId: g.id });
    consider(g.leisure ? g.leisure.until : g.nextLeisureAt, 'leisure', 4, { guestId: g.id });
    consider(g.bombAt, 'bomb', 4, { guestId: g.id });
  }
  return best;
}

/** Fait avancer la simulation jusqu'à `now`. Renvoie le nombre d'événements traités. */
export function advance(state, now = Date.now()) {
  const away = now - state.time;
  let count = 0;
  while (count < CONFIG.maxCatchUpEvents) {
    const ev = nextEvent(state);
    if (!ev || ev.t > now) break;
    state.time = Math.max(state.time, ev.t);
    HANDLERS[ev.kind](state, ev.t, ev);
    updateBombs(state, ev.t);
    count++;
  }
  state.time = Math.max(state.time, now);
  if (away >= CONFIG.welcomeBack.days * DAY) welcomeBack(state, now);
  updateBombs(state, state.time);
  return count;
}

/** Aucune action entre 23 h 59 et 0 h 01 (le temps de faire les comptes). */
export function isLocked(t) {
  const p = zonedParts(t, tz);
  return (p.h === 23 && p.min >= 60 - CONFIG.lockMinutes) || (p.h === 0 && p.min < CONFIG.lockMinutes);
}

/**
 * Retour après une longue absence : toutes les chambres réparées, la dette
 * effacée, +250, et la file d'attente remplie jusqu'à 5 clients.
 */
export function welcomeBack(state, t) {
  let repaired = 0;
  for (const r of Object.values(state.rooms)) if (r.damage) { r.damage = 0; repaired++; }
  const debt = state.money < 0 ? -state.money : 0;
  if (debt) state.money = 0;
  state.money += CONFIG.welcomeBack.money;
  const before = state.queue.length;
  while (state.queue.length < CONFIG.queueMax) enqueueNewGuest(state, t);
  const text = `Bon retour ! En votre absence, le Consortium a remis l'hôtel d'aplomb : ${repaired} chambre${repaired > 1 ? 's' : ''} réparée${repaired > 1 ? 's' : ''}${debt ? `, dette de ${debt} ${CURRENCY} effacée` : ''}, +${CONFIG.welcomeBack.money} ${CURRENCY} et ${state.queue.length - before} client${state.queue.length - before > 1 ? 's' : ''} devant la porte.`;
  addLog(state, t, 'good', `🏛️ ${text}`);
  (state.notices ||= []).push({ kind: 'welcome', text });
}

/** Électrik : à 0 ou 10, il devient instable (explosion 3 h plus tard) ; il se calme sinon. */
export function updateBombs(state, t) {
  const occ = occupancy(state);
  const bombs = Object.values(occ).filter((g) => g.type === 'electrik');
  if (!bombs.length) return;
  const scr = screamers(state, occ);
  for (const g of bombs) {
    const sat = computeSatisfaction(state, g, g.roomId, occ, { screamers: scr }).value;
    const extreme = sat <= 0 || sat >= 10;
    if (extreme && !g.bombAt) {
      g.bombAt = t + CONFIG.bombFuseHours * HOUR;
      addLog(state, t, 'bad', `⚡ ${g.name} (chambre ${roomLabel(state.rooms[g.roomId])}) est ${sat >= 10 ? 'trop heureux' : 'à bout'} : il devient instable ! Explosion vers ${formatClock(g.bombAt, tz)} si rien ne change.`);
    } else if (!extreme && g.bombAt) {
      g.bombAt = null;
      addLog(state, t, 'good', `⚡ ${g.name} s'est calmé : plus de danger d'explosion.`);
    }
  }
}

const HANDLERS = {
  build(state, t, ev) {
    const room = state.rooms[ev.roomId];
    if (room.buildTarget === 'upgrade') {
      room.buildEnd = null;
      room.buildTarget = null;
      room.level = Math.min(CONFIG.roomMaxLevel, room.level + 1);
      const fame = CONFIG.roomUpgradeFame[room.level] || 0;
      state.prestige += fame;
      addLog(state, t, 'good', `Chambre ${roomLabel(room)} améliorée au niveau ${room.level}.${fame ? ` +${fame} ⭐` : ''}`);
      if (room.level >= 2) questEvent(state, 'roomLevel', t);
      return;
    }
    const b = BUILDABLES[room.buildTarget];
    if (!b) { room.buildEnd = null; room.buildTarget = null; return; } // chantier incohérent : ignoré
    room.kind = b.kind;
    room.sub = b.id;
    room.buildEnd = null;
    room.buildTarget = null;
    addLog(state, t, 'good', `Construction terminée : ${b.name} (${roomLabel(room)}).`);
    bumpGoal(state, 'room', t);
    // Une nouvelle salle de loisir donne envie de sortir aux clients qui l'aiment.
    if (b.kind === 'leisure') {
      for (const g of Object.values(occupancy(state))) if (!g.leisure && !g.nextLeisureAt) scheduleLeisure(state, g, t, 'retry');
    }
    questEvent(state, 'buildEnd', t);
  },

  event(state, t) {
    runEvent(state, t);
  },

  wakeup(state, t) {
    deliverCampaigns(state, t);
  },

  staff(state, t, ev) {
    const s = state.staff.find((x) => x.id === ev.staffId);
    const task = s.task;
    const room = state.rooms[task.roomId];
    if (task.kind === 'repair') {
      room.damage = Math.max(0, room.damage - 1);
      if (room.damage === 0) {
        s.task = null;
        addLog(state, t, 'good', `${s.name} a fini de réparer la chambre ${roomLabel(room)}.`);
        return;
      }
      // Les réparations se paient même caisse vide (le solde peut devenir négatif).
      state.money -= repairStepCost(room, state);
      task.end = t + CONFIG.staffRepairMinutes * MINUTE;
      return;
    }
    if (task.kind === 'care') {
      const g = state.guests[task.guestId];
      s.task = null;
      if (!g || g.roomId !== task.roomId) return;
      if (rngFor(state).chance(CONFIG.careChance + 0.3 * tal(state, 'attendChance') / 3)) {
        g.mods.care += 1;
        addLog(state, t, 'good', `Petites attentions réussies : ${g.name} est aux anges (+1).`);
      } else {
        addLog(state, t, 'info', `Petites attentions manquées : ${g.name} n'a pas été sensible aux efforts de ${s.name}.`);
      }
    }
  },

  arrival(state, t) {
    if (state.queue.length >= CONFIG.queueMax) {
      let retry = t + CONFIG.arrivalRetryMin * MINUTE;
      if (isNightTime(retry, CONFIG.wakeUpHour, tz)) retry = nextLocalHour(retry, CONFIG.wakeUpHour, tz);
      state.nextArrival = retry;
      return;
    }
    const g = enqueueNewGuest(state, t);
    state.lastArrival = t;
    addLog(state, t, g.star ? 'good' : 'info',
      `${g.star ? '🌟 Une STAR arrive : ' : 'Nouveau client : '}${g.name} (${TYPES[g.type].name}), ${g.stay} nuit${g.stay > 1 ? 's' : ''}.`);
    scheduleNextArrival(state, t);
  },

  request(state, t, ev) {
    const g = state.guests[ev.guestId];
    const kind = pickRequestKind(state);
    const until = g.nextRequestAt + CONFIG.requestVisibleHours * HOUR;
    g.nextRequestAt = null;
    if (!kind) return;
    g.request = { kind, until };
  },

  requestExpire(state, t, ev) {
    // Une demande manquée ne coûte rien (comme dans CroqueMotel) : la suivante viendra 7 à 15 h plus tard.
    const g = state.guests[ev.guestId];
    g.request = null;
    scheduleRequest(state, g, t, CONFIG.requestRange.missed);
  },

  leisure(state, t, ev) {
    const g = state.guests[ev.guestId];
    const L = CONFIG.leisure;
    if (g.leisure) {
      const room = state.rooms[g.leisure.roomId];
      g.leisure = null;
      state.money += L.gain;
      state.stats.earned += L.gain;
      addLog(state, t, 'money', `${g.name} revient ${room ? `de : ${BUILDABLES[room.sub].name}` : 'de sa sortie'} (+${L.gain} ${CURRENCY}).`);
      scheduleLeisure(state, g, t, 'rest');
      return;
    }
    // Une salle qu'il aime et que personne n'occupe ?
    const busy = new Set(Object.values(state.guests).filter((x) => x.leisure).map((x) => x.leisure.roomId));
    const free = favoriteLeisure(state, g).filter((r) => !busy.has(r.id));
    if (!free.length) { scheduleLeisure(state, g, t, 'retry'); return; }
    const rng = rngFor(state);
    g.leisure = { roomId: rng.pick(free).id, until: t + (L.visitMin + rng.int(0, L.visitSpread)) * MINUTE };
    g.nextLeisureAt = null;
  },

  bomb(state, t, ev) {
    const g = state.guests[ev.guestId];
    g.bombAt = null;
    const sat = computeSatisfaction(state, g).value;
    if (sat > 0 && sat < 10) return;
    const room = state.rooms[g.roomId];
    room.damage = CONFIG.maxDamage;
    room.equip = [];
    const text = `💥 BOUM ! ${g.name} a explosé dans la chambre ${roomLabel(room)} : chambre détruite, équipements pulvérisés.`;
    addLog(state, t, 'bad', text);
    (state.notices ||= []).push({ kind: 'event', text, tone: 'bad', roomId: room.id });
    removeGuest(state, g.id);
  },

  midnight(state, t) {
    addLog(state, t, 'night', '🌙 Minuit : bilan de la nuit');
    const occ = occupancy(state);
    // Matelas (+1 par nuit, cumulable) et feux d'artifice (+6 la 1re nuit) avant la paie.
    const fireworks = [];
    for (const g of Object.values(occ)) {
      const fx = roomEquipEffects(state.rooms[g.roomId]);
      if (fx.nightBonus) g.mods.comfort = (g.mods.comfort || 0) + fx.nightBonus;
      if (fx.fireworks && !g.mods.fireworks) { g.mods.fireworks = 6; fireworks.push(g); }
    }
    const scr = screamers(state, occ);
    const snapshot = Object.values(occ).map((g) => ({ g, sat: computeSatisfaction(state, g, g.roomId, occ, { screamers: scr }).value }));

    let total = 0;
    const recap = [];
    for (const { g, sat } of snapshot) {
      const room = state.rooms[g.roomId];
      const pay = g.parcel ? 0 : nightGain(sat, room, state, g.type);
      total += pay;
      recap.push({ name: g.name, type: g.type, look: g.look, star: g.star, sat, pay });
      addLog(state, t, pay > 0 ? 'money' : 'bad',
        pay > 0 ? `${g.name} (${sat}/10) a rapporté ${pay} ${CURRENCY}.` : g.parcel ? `${g.name} (${sat}/10), l'Œuf de ${g.parcel.from}, est logé gratuitement.` : `${g.name} (${sat}/10) ne vous a rien rapporté.`);
      g.nightsLeft = Math.max(0, g.nightsLeft - 1);
    }
    state.money += total;
    state.stats.earned += total;
    state.stats.nights++;
    // Après le spectacle : 3 dégâts et tout l'équipement saute.
    for (const g of fireworks) {
      const room = state.rooms[g.roomId];
      room.damage = Math.min(CONFIG.maxDamage, room.damage + 3);
      room.equip = [];
      addLog(state, t, 'bad', `🎆 Les feux d'artifice de la chambre ${roomLabel(room)} ont ravi ${g.name}… et soufflé la chambre (3 dégâts, équipements détruits).`);
    }

    // La file se vide, sauf les Œufs d'amis arrivés dans la journée.
    const gone = state.queue.filter((id) => !(state.guests[id].parcel && state.guests[id].arrivedAt > t - DAY));
    const left = gone.length;
    for (const id of gone) removeGuest(state, id);
    if (left) addLog(state, t, 'bad', `${left} client${left > 1 ? 's' : ''} non placé${left > 1 ? 's ont' : ' a'} quitté la file d'attente.`);
    addLog(state, t, 'night', `Bilan nocturne : +${total} ${CURRENCY} pour ${snapshot.length} client${snapshot.length > 1 ? 's' : ''}.`);
    state.lastNight = { t, total, lines: recap, queueLeft: left };
    // Récap de minuit : on ne garde que la dernière nuit (les autres sont dans le journal).
    state.notices = (state.notices || []).filter((n) => n.kind !== 'night');
    state.notices.push({ kind: 'night', ...state.lastNight });

    questEvent(state, 'midnight', t);

    // Taxe hebdomadaire : dans la nuit de dimanche à lundi.
    if (zonedParts(t, tz).weekday === 1) collectTax(state, t);

    // Coup de pouce du Consortium aux débutants.
    if (state.money < CONFIG.subsidyThreshold && state.hotel.level <= CONFIG.subsidyMaxLevel) {
      const help = CONFIG.subsidyTarget - state.money;
      state.money = CONFIG.subsidyTarget;
      if (state.lastTax && state.lastTax.t === t) {
        state.lastTax.subsidy = help;
        const n = state.notices.find((x) => (x.kind === 'tax' || x.kind === 'level') && x.t === t);
        if (n) n.subsidy = help;
      }
      addLog(state, t, 'money', `🏛️ Le Consortium renfloue votre caisse (+${help} ${CURRENCY}). Ne vous y habituez pas !`);
    }
  },

  checkout(state, t) {
    const occ = occupancy(state);
    const scr = screamers(state, occ);
    const leaving = Object.values(occ)
      .filter((g) => g.nightsLeft <= 0)
      .map((g) => ({ g, sat: computeSatisfaction(state, g, g.roomId, occ, { screamers: scr }).value }));
    for (const { g, sat } of leaving) departGuest(state, g, sat, t);
  },
};

/**
 * Taxe du dimanche soir : payée = +1 niveau d'hôtel, du prestige et des gemmes.
 * Le Consortium ne passe que si l'hôtel a été actif (un client placé ou déplacé dans la semaine).
 */
export function collectTax(state, t) {
  if (!state.activeWeek) {
    state.lastTax = { t, paid: false, skipped: true, amount: 0 };
    (state.notices ||= []).push({ kind: 'tax', t, paid: false, skipped: true, amount: 0, level: state.hotel.level });
    addLog(state, t, 'info', '🏛️ Le Consortium n\'est pas passé : votre hôtel n\'a accueilli personne cette semaine.');
    return;
  }
  state.activeWeek = false;
  const amount = taxAmount(state);
  if (state.money >= amount) {
    state.money -= amount;
    const fame = Math.min(CONFIG.levelUpFameCap, CONFIG.levelUpFamePerLevel * state.hotel.level);
    const gems = CONFIG.gems.taxPerLevel * state.hotel.level;
    state.hotel.level++;
    state.prestige += fame;
    state.gems += gems;
    state.lastTax = { t, paid: true, amount, fame, gems, level: state.hotel.level };
    addLog(state, t, 'good', `🏛️ Taxe payée (${amount} ${CURRENCY}) : l'hôtel passe au niveau ${state.hotel.level} ! +${fame} ⭐ +${gems} ${GEMS}. De nouveaux clients et de nouvelles pièces sont disponibles.`);
    (state.notices ||= []).push({ kind: 'level', t, amount, level: state.hotel.level, fame, gems });
  } else {
    state.lastTax = { t, paid: false, amount };
    (state.notices ||= []).push({ kind: 'tax', t, paid: false, amount, missing: amount - state.money, level: state.hotel.level });
    addLog(state, t, 'bad', `🏛️ Taxe impayée (${amount} ${CURRENCY}) : l'inspecteur repart en ricanant. Pas de niveau cette semaine.`);
  }
}

/** Prestige gagné au départ. */
function departureFame(sat, star) {
  if (!star) return sat >= 10 ? 1 : 0;
  if (sat >= 10) return CONFIG.vipFame.max;
  if (sat >= 7) return CONFIG.vipFame.good;
  return CONFIG.vipFame.low;
}

/** Gemmes gagnées au départ : comblé 1 ; Star 7 à 9 : 2 ; Star comblée : 5. */
function departureGems(sat, star) {
  if (star) return sat >= 10 ? CONFIG.gems.starMax : sat >= 7 ? CONFIG.gems.starGood : 0;
  return sat >= 10 ? CONFIG.gems.delighted : 0;
}

/** Départ d'un client à 10h : 2e paiement, dégâts, équipements, objets oubliés, prestige. */
function departGuest(state, g, sat, t) {
  const rng = rngFor(state);
  const room = state.rooms[g.roomId];
  const fx = roomEquipEffects(room);
  const notes = [];

  // Un client paie deux fois : à minuit, et encore à son départ (rien s'il part à 0).
  const pay = g.parcel ? 0 : nightGain(sat, room, state, g.type);
  if (pay > 0) { state.money += pay; state.stats.earned += pay; }

  // Salissure (moitié moins au niveau 1) ; un Pyromane ajoute 100 points et détruit tout.
  const pyro = g.type === 'feu' && !fx.fireproof;
  let dirt = CONFIG.dirtChance - 0.2 * tal(state, 'strongRooms') / 3 + (pyro ? 1 - 0.75 * tal(state, 'specFeu') / 2 : 0);
  if (state.hotel.level <= 1) dirt *= 0.5;
  const dirtRoll = rng.chance(dirt);
  const furious = sat <= 0;
  const destroyed = furious || (pyro && dirtRoll && rng.chance(1 - 0.75 * tal(state, 'specFeu') / 2));
  if (destroyed) room.damage = CONFIG.maxDamage;
  else if (dirtRoll) room.damage = Math.min(CONFIG.maxDamage, room.damage + 1);

  // Équipements : un seul tirage casse tout ; furieux ou pyromane = tout cassé.
  const breaksAll = furious || pyro || rng.chance(CONFIG.breakChance - 0.2 * tal(state, 'strongItems') / 2);
  const before = room.equip;
  room.equip = breaksAll ? [] : room.equip.filter((id) => !ITEMS[id].consumed);
  const lost = before.filter((id) => !room.equip.includes(id));
  if (lost.length) notes.push(`${lost.map((i) => ITEMS[i].name).join(', ')} ${lost.length > 1 ? 'perdus' : 'perdu'}`);

  // Prestige et gemmes.
  const fame = departureFame(sat, g.star);
  state.prestige += fame;
  const gems = departureGems(sat, g.star);
  state.gems += gems;
  if (sat >= CONFIG.satisfiedThreshold) { state.stats.satisfied++; questEvent(state, 'satisfy', t); }
  if (sat >= 10) { state.stats.delighted++; questEvent(state, 'satisfyMax', t); }
  if (g.star && sat >= 7) state.stats.stars++;
  if (furious) state.stats.angry++;
  bumpGoal(state, 'hosted', t);
  if (sat >= WELL_TREATED) {
    bumpGoal(state, g.star ? 'okvip' : 'okbase', t);
    if (g.parcel) bumpGoal(state, 'okfrnd', t);
  }

  // Objet oublié (garanti pour un débutant qui a peu d'objets).
  let drop = CONFIG.dropChance + 0.2 * tal(state, 'itemDrop') / 3 + fx.dropBonus + (g.type === 'poison' ? CONFIG.poisonDropBonus : 0);
  const pocket = Object.values(state.inventory).reduce((s, n) => s + n, 0);
  if (state.hotel.level <= 1 && pocket <= CONFIG.beginnerItemFloor) drop = 1;
  if (!furious && rng.chance(drop)) {
    if (rng.chance(0.25)) room.leftItem = { money: CONFIG.moneyPickup };
    else {
      const pool = ITEM_IDS.filter((id) => ITEMS[id].kind !== 'repair' && !ITEMS[id].fireworks).map((id) => ({ id, weight: 8 - ITEMS[id].price }));
      room.leftItem = { item: rng.weighted(pool).id };
    }
    notes.push('il a oublié quelque chose');
  }

  let msg;
  if (furious) msg = `Départ : ${g.name}, visiblement très en colère, a tout cassé dans la chambre ${roomLabel(room)} sans payer !`;
  else if (destroyed) msg = `Départ : ${g.name} (${sat}/10) a mis le feu à la chambre ${roomLabel(room)} !`;
  else if (sat >= 10) msg = `Départ : ${g.name}, absolument enchanté de son séjour !`;
  else if (sat >= CONFIG.satisfiedThreshold) msg = `Départ : ${g.name} (${sat}/10), plutôt satisfait.`;
  else msg = `Départ : ${g.name} (${sat}/10), très moyennement satisfait...`;
  if (pay) msg += ` +${pay} ${CURRENCY}`;
  if (fame) msg += ` +${fame} ⭐`;
  if (gems) msg += ` +${gems} ${GEMS}`;
  if (dirtRoll && !destroyed) notes.push('chambre salie');
  addLog(state, t, furious || destroyed ? 'bad' : sat >= CONFIG.satisfiedThreshold ? 'good' : 'info', msg + (notes.length ? ` (${notes.join(', ')})` : ''));
  removeGuest(state, g.id);
}

export function clockInfo(state, now) {
  const night = isNightTime(now, CONFIG.wakeUpHour, tz);
  return {
    now: formatClock(now, tz),
    night,
    nextMidnight: nextLocalHour(now, 0, tz),
    nextCheckout: nextLocalHour(now, CONFIG.checkoutHour, tz),
    nextArrival: state.nextArrival,
    nextArrivalLabel: state.nextArrival ? formatClock(state.nextArrival, tz) : '—',
  };
}

export function nextTaxTime(now) {
  let t = nextLocalHour(now, 0, tz);
  for (let i = 0; i < 8 && zonedParts(t, tz).weekday !== 1; i++) t = nextLocalHour(t, 0, tz);
  return t;
}
