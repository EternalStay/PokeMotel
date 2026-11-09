// =============================================================================
// Client PWA : scène de l'hôtel, interactions tactiles, menus, horloge.
// Toute la logique de jeu est dans ../engine ; ce fichier affiche l'état et
// appelle les actions. Le rendu est incrémental (seules les pièces modifiées
// sont redessinées) pour garder les animations fluides.
// =============================================================================

import {
  AURAS, TYPES, TYPE_IDS, CONFIG, CURRENCY, GEMS, GEMS_NAME, ITEMS, ITEM_IDS, BUILDABLES, SERVICES,
  createState, advance, clockInfo, roomList, occupancy, roomIsAvailable, roomLabel, staffInRoom, lobbyStaffCount,
  lobbyCapacity, freeStaff, computeSatisfaction, previewPlacement, moodOf, formatClock, nextLocalHour,
  zonedParts, MINUTE, HOUR, staffCost, extendCost, extendSlots, hotelSpan, replaceBlocker, taxAmount, nextTaxTime, careCost, repairStepCost,
  buildCost, canBuild, starRequiredLevel, adviceFor, nightGain, hasAnyBonus,
  QUESTS, GOAL_LABELS, TALENTS, TALENT_ROWS, TALENT_ROW_STEP, talent, spentPoints, rowUnlocked, treeMax,
  studyGuest, spendTalent, resetTalents, attractGuest, isLocked, canRestart, staffPaidInGems,
  buyPack, openDecoBox, placeDeco, storeDeco, floorDeco, furnitureAt, DECO_FAMILIES, PACKS,
  campaignsOf, buyCampaign, legacyStatus, bequeathHotel, LEGACY,
  placeGuest, moveGuest, fulfillRequest, hireStaff, assignStaff, recallStaff, buyItem, useItem, removeEquip,
  collectLeftover, buildRoom, demolishRoom, upgradeRoom, upgradeLobby, extendRoom, renameHotel,
  ALL_ACTIONS, dispatch, restartHotel, setNeon, NEON_COLORS, DEFAULT_NEON, setManager, renameStaff, receiveParcel, CUSTOM_START_MONEY,
  ACHIEVEMENTS, ACHIEVEMENT_KEYS, REWARDS, goalCount, totalPoints, nextReward, rewardName, titled, setTitle, WELL_TREATED,
} from '../engine/index.js';
import { LocalStore, prefs } from './storage.js';
import { loadSprites } from './sprites.js';
import { currentSession, onAuthChange, signIn, signUp, signInGoogle, signOut, callServer, SUPABASE_URL } from './online.js';
import { unlockAudio, sfx, setSoundEnabled, soundEnabled, soundForLog, ACTION_SOUNDS } from './sound.js';
import { Camera } from './camera.js';
import { treeSVG, bushSVG, benchSVG, chimneysSVG, sconceSVG, planterSVG, ledClockHTML, carSVG, birdsSVG } from './decor.js';
import {
  globalDefs, creatureSVG, occupantStyle, staffSVG, itemSVG, roomSVG, skySVG, roofSVG, waterTowerSVG, antennaSVG, lobbySVG,
  awningSVG, streetSVG, lampPostSVG, levelStars, citySVG, lobbyCellSVG,
} from './art.js';
import { icon, auraIcon, faceIcon, dirIcon, factorIcon } from './icons.js';
import { decoSVG, decoRatio } from './furniture.js';
import { chipsHTML, linesHTML, moodBadge, thoughtFor, neighborhoodHTML, adviceHTML, ambianceHTML, significant } from './insight.js';

// -----------------------------------------------------------------------------
// État du client
// -----------------------------------------------------------------------------
const store = new LocalStore();
const DEV = new URLSearchParams(location.search).has('dev');
let timeOffset = DEV ? prefs.get('timeOffset', 0) : 0;
let state = null;
/** Sélection : { mode: 'place'|'move', guestId } | { mode: 'item', itemId } | { mode: 'staff', staffId } | null */
let selection = null;
let dirty = false;
let layoutKey = '';
let lastExtending = false;
let phase = '';
const roomKeys = new Map();
/** Satisfaction précédente de chaque client (pour les "+1 / −2" qui s'envolent). */
const prevSats = new Map();
let lastThought = 0;
let thoughtSeed = 0;
let soundSeq = 0;
/** Jeu en ligne : { userId, email } quand le joueur est connecté (le serveur fait foi). */
let online = null;
/** Visite d'un autre hôtel : { hotel, mine, friend, wall, likes, liked } ; `home` garde le nôtre. */
let visit = null;
let home = null;
let serverQueue = Promise.resolve();
let pendingCalls = 0;
/** Détails de satisfaction et aperçus calculés au dernier rendu. */
let frame = { details: {}, previews: new Map(), best: new Set() };
let camera = null;

const now = () => Date.now() + timeOffset;
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cur = (n) => `<span class="price">${icon('coin')}${Number(n).toLocaleString('fr-FR')}</span>`;
/** Étoiles gagnées par les legs (distinctes des étoiles de niveau). */

const gem = (n) => `<span class="price gem">${icon('gem')}${Number(n).toLocaleString('fr-FR')}</span>`;
const fmtDuration = (ms) => {
  const totalMin = Math.max(0, Math.ceil(ms / MINUTE));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
};
const fmtCountdown = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
};
const clock = (t) => formatClock(t, CONFIG.timeZone);

function phaseOf(t) {
  const h = zonedParts(t, CONFIG.timeZone).h;
  if (h < 6) return 'night';
  if (h < 8) return 'dawn';
  if (h < 18) return 'day';
  if (h < 21) return 'dusk';
  return 'evening';
}

// -----------------------------------------------------------------------------
// Démarrage et boucle
// -----------------------------------------------------------------------------
async function boot() {
  document.body.insertAdjacentHTML('afterbegin', globalDefs());
  // Planches de sprites : lancées tout de suite ; on redessine dès qu'un type est prêt.
  loadSprites(() => { if (!state) return; layoutKey = ''; roomKeys.clear(); render(); });
  state = (await store.load()) || createState(now());
  const lastSeenLog = prefs.get('lastSeenLog', 0);
  const nightsBefore = state.stats.nights;
  advance(state, now());
  await store.save(state);
  setSoundEnabled(prefs.get('sound', true));
  soundSeq = state.logSeq; // ce qui s'est passé en votre absence ne fait pas de bruit
  document.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
  document.addEventListener('click', (e) => { if (e.target.closest('button')) sfx('click', 1); }, true);

  bindEvents();
  render();
  camera = new Camera($('#scene'), $('#world'));
  camera.focusEl = $('#building');
  requestAnimationFrame(() => camera.fit(camera.focusEl));
  $('#zoom-in').addEventListener('click', () => camera.zoomAt(1.25));
  $('#zoom-out').addEventListener('click', () => camera.zoomAt(0.8));
  $('#zoom-fit').addEventListener('click', () => camera.fit(camera.focusEl));
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  if (DEV) renderDevBar();
  // Planches de sprites (essai) : on redessine tout dès qu'une planche est chargée.

  initOnline().then(() => { if (!online) handleInviteLink(); });
  setInterval(() => syncFromServer(), 2 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncFromServer(); });

  if (lastSeenLog === 0) openHelp();
  else if (state.stats.nights > nightsBefore) openJournal('Pendant votre absence', lastSeenLog);
  else {
    const unread = state.log.filter((l) => l.id > lastSeenLog).length;
    if (unread) toast(`${unread} nouvel${unread > 1 ? 's' : ''} événement${unread > 1 ? 's' : ''} dans le journal.`);
  }
}

function tick() {
  if (advance(state, now()) > 0) {
    dirty = true;
    if (!selectionValid()) selection = null;
  }
  if (state.logSeq > soundSeq) {
    for (const l of state.log) {
      if (l.id <= soundSeq) continue;
      const snd = soundForLog(l);
      if (snd) sfx(...snd);
    }
    soundSeq = state.logSeq;
  }
  if (dirty && !visit) { store.save(state); dirty = false; }
  render();
  if (!visit) { showNotices(); maybePendingFriend(); }
  maybeThought();
}

/** Affiche les notifications du moteur (missions accomplies, événements). */
function showNotices() {
  if (!state.notices || !state.notices.length) return;
  const sheetOpen = !$('#sheet').hidden;
  while (state.notices.length) {
    const n = state.notices[0];
    if (['quest', 'welcome', 'level', 'night', 'tax', 'legacy'].includes(n.kind)) {
      if (sheetOpen) return; // on attend que la fenêtre en cours soit fermée
      state.notices.shift();
      dirty = true;
      if (n.kind === 'quest') openQuestDone(n);
      else if (n.kind === 'welcome') openWelcome(n);
      else if (n.kind === 'night') openNightRecap(n);
      else if (n.kind === 'tax') openTaxRecap(n);
      else if (n.kind === 'legacy') openSheet({ cls: 'quest-done', hero: `<div class="qd-hero legacy">✦<span>${n.stars === 1 ? '1re' : `${n.stars}e`} étoile !</span></div>`, title: 'Un nouveau départ', body: `<p>${esc(n.text)}</p><p class="muted">Toutes les récompenses du tutoriel vous ont été versées. Les missions répétables reprennent.</p>`, actions: [{ label: 'C’est reparti !', cls: 'primary', run: closeSheet }] });
      else openLevelUp(n);
      return;
    }
    state.notices.shift();
    dirty = true;
    if (n.kind === 'goal') { const rw = REWARDS[n.reward]; toast(`🏅 Succès : ${rewardName(rw)} (+${rw.points} points)`, 'good'); continue; }
    if (n.kind === 'parcel') { toast(`🥚 ${n.from} vous envoie un Œuf surprise !`, 'good'); continue; }
    toast(n.text, n.tone === 'good' ? 'good' : 'bad');
    if (n.roomId && state.rooms[n.roomId]) floatText(n.roomId, `${icon(n.tone === 'good' ? 'star' : 'close')}<b>!</b>`, n.tone === 'good' ? 'pos' : 'neg');
  }
}

function selectionValid() {
  if (!selection) return true;
  if (selection.guestId) return !!state.guests[selection.guestId];
  if (selection.itemId) return state.inventory[selection.itemId] > 0;
  if (selection.staffId) { const s = state.staff.find((x) => x.id === selection.staffId); return s && !s.task; }
  return false;
}

/** Exécute une action du moteur puis rafraîchit. */
/** Toutes les actions passent par `dispatch` (comme elles passeront par le serveur). */
const ACTION_NAMES = new Map(Object.entries(ALL_ACTIONS).map(([k, f]) => [f, k]));
/** Petite vibration du téléphone (réglable dans le Bureau). */
function buzz(pattern) {
  if (!prefs.get('vibrate', true) || !navigator.vibrate || !matchMedia('(pointer: coarse)').matches) return;
  try { navigator.vibrate(pattern); } catch { /* ignoré */ }
}

function act(fn, ...args) {
  if (visit) { toast('Vous êtes en visite : rentrez chez vous pour jouer.', 'bad'); return { ok: false }; }
  if (isLocked(now())) { toast('Minuit sonne : le Consortium fait ses comptes. Revenez dans une minute !', 'bad'); return { ok: false }; }
  const name = ACTION_NAMES.get(fn);
  if (!name) throw new Error('Action non déclarée dans ALL_ACTIONS');
  const res = dispatch(state, name, args, now());
  if (!res.ok) { toast(res.error, 'bad'); sfx('error', 2); } else sfx(ACTION_SOUNDS[name] || 'click', 2);
  buzz(res.ok ? 12 : [30, 50, 30]);
  if (res.ok && online) sendToServer(name, args);
  dirty = true;
  tick();
  return res;
}

// -----------------------------------------------------------------------------
// Rendu
// -----------------------------------------------------------------------------
function render() {
  const t = now();
  if (selection || tray) guardBack(); // un mode en cours (placer, agrandir…) se quitte avec Retour
  const p = phaseOf(t);
  if (p !== phase) {
    // Fondu enchaîné entre deux ciels (aube, jour, crépuscule, soir, nuit) au lieu d'un saut.
    const sky = $('#sky');
    if (phase && sky.firstElementChild) {
      const old = sky.firstElementChild;
      old.classList.add('sky-old');
      sky.insertAdjacentHTML('beforeend', skySVG(p));
      setTimeout(() => old.remove(), 4200);
    } else sky.innerHTML = skySVG(p);
    phase = p;
    document.body.dataset.phase = p;
    layoutKey = ''; // la rue et les lampadaires changent avec la phase
  }
  const occ = occupancy(state);
  const details = {};
  const sats = {};
  for (const g of Object.values(occ)) {
    details[g.id] = computeSatisfaction(state, g, g.roomId, occ);
    sats[g.id] = details[g.id].value;
  }
  // Aperçus de placement pour toutes les chambres disponibles.
  const previews = new Map();
  const best = new Set();
  if (selection && (selection.mode === 'place' || selection.mode === 'move')) {
    const guest = state.guests[selection.guestId];
    let top = -Infinity;
    for (const room of roomList(state)) {
      if (!roomIsAvailable(state, room, occ)) continue;
      const p = previewPlacement(state, guest, room.id);
      previews.set(room.id, p);
      const score = p.self * 10 + p.othersDelta;
      if (score > top) { top = score; best.clear(); }
      if (score === top) best.add(room.id);
    }
  }
  // "Top" n'a de sens que si toutes les chambres ne se valent pas.
  if (best.size === previews.size) best.clear();
  frame = { details, previews, best };

  renderHud(t);
  renderQuest();
  renderSide(t);
  renderBuilding(t, occ, sats);
  renderQueue();
  renderHint();
  renderActionBar();
  if (!visit) { maybeQuestPointer(); maybeQuestBanner(); }
  for (const el of document.querySelectorAll('[data-until]')) el.textContent = fmtCountdown(Number(el.dataset.until) - t);
  popSatisfactionChanges(occ, sats);
}

// -----------------------------------------------------------------------------
// Effets flottants : "+1 / −2" et bulles de pensée
// -----------------------------------------------------------------------------
function roomBox(roomId) {
  const el = document.querySelector(`#building [data-room="${roomId}"]`);
  const b = $('#building');
  if (!el || !b) return null;
  const r = el.getBoundingClientRect();
  const o = b.getBoundingClientRect();
  const k = camera ? camera.scale : 1;
  return { x: (r.left - o.left) / k, y: (r.top - o.top) / k, w: r.width / k, h: r.height / k };
}

function fxLayer() {
  let layer = $('#fx-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'fx-layer';
    $('#building').appendChild(layer);
  }
  return layer;
}

function floatText(roomId, html, cls) {
  const box = roomBox(roomId);
  if (!box) return;
  const el = document.createElement('div');
  el.className = `float-pop ${cls}`;
  el.innerHTML = html;
  el.style.left = `${box.x + box.w / 2}px`;
  el.style.top = `${box.y + box.h * 0.35}px`;
  fxLayer().appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

function popSatisfactionChanges(occ, sats) {
  const seen = new Set();
  for (const g of Object.values(occ)) {
    seen.add(g.id);
    const prev = prevSats.get(g.id);
    if (prev !== undefined && prev !== sats[g.id]) {
      const d = sats[g.id] - prev;
      floatText(g.roomId, `${faceIcon(sats[g.id])}<b>${d > 0 ? '+' : ''}${d}</b>`, d > 0 ? 'pos' : 'neg');
    }
    prevSats.set(g.id, sats[g.id]);
  }
  for (const id of [...prevSats.keys()]) if (!seen.has(id)) prevSats.delete(id);
}

/** Affiche de temps en temps une bulle de pensée qui explique l'humeur d'un client. */
function maybeThought() {
  if (selection || !$('#sheet').hidden || document.hidden) return;
  if (Date.now() - lastThought < 5500) return;
  const guests = Object.values(state.guests).filter((g) => g.roomId && !g.leisure && frame.details[g.id]); // pas de bulle dans une chambre vide (client en sortie)
  if (!guests.length) return;
  lastThought = Date.now();
  // On privilégie les clients les plus affectés (en bien ou en mal) et ceux qui ont une demande.
  const weighted = guests.map((g) => {
    const top = significant(frame.details[g.id].lines)[0];
    return { g, weight: 1 + (top ? Math.abs(top.value) * 2 : 0) + (g.request ? 6 : 0) };
  });
  let r = Math.random() * weighted.reduce((s, w) => s + w.weight, 0);
  const chosen = weighted.find((w) => (r -= w.weight) < 0) || weighted[0];
  showThought(chosen.g);
}

function showThought(g) {
  const box = roomBox(g.roomId);
  if (!box) return;
  const th = thoughtFor(g, frame.details[g.id], thoughtSeed++);
  const el = document.createElement('div');
  el.className = `thought ${th.tone}`;
  el.innerHTML = `${th.aura ? auraIcon(th.aura) : th.icon ? `<span class="th-emoji">${th.icon}</span>` : ''}<span>${esc(th.text)}</span>`;
  // Toujours dans la chambre du client : pas plus large qu'elle, centrée sur elle.
  el.style.top = `${box.y + 4}px`;
  el.style.maxWidth = `${Math.max(60, box.w - 8)}px`;
  el.style.left = `${box.x + box.w / 2}px`;
  fxLayer().appendChild(el);
  setTimeout(() => el.classList.add('out'), 3600);
  setTimeout(() => el.remove(), 4100);
}

let hudPrev = null; // argent / prestige au dernier affichage, pour fêter les gains

/** Pièces qui volent du bâtiment vers le compteur d'argent, et « +N » au-dessus des compteurs. */
function celebrateGains(dMoney, dFame) {
  if (document.hidden) return;
  if (dMoney > 0) {
    popOver('#money', `+${dMoney.toLocaleString('fr-FR')}`, 'coin');
    const to = $('#money').closest('.res').getBoundingClientRect();
    const from = ($('#building') || $('#scene')).getBoundingClientRect();
    const n = Math.min(8, 2 + Math.floor(dMoney / 20));
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div');
      c.className = 'fly-coin';
      document.body.appendChild(c);
      const x0 = from.left + from.width * (0.25 + Math.random() * 0.5);
      const y0 = from.top + from.height * (0.3 + Math.random() * 0.4);
      const x1 = to.left + 14;
      const y1 = to.top + to.height / 2;
      const a = c.animate([
        { transform: `translate(${x0}px, ${y0}px) scale(.6)`, opacity: 0 },
        { transform: `translate(${x0}px, ${y0 - 30}px) scale(1)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${x1}px, ${y1}px) scale(.7)`, opacity: 1 },
      ], { duration: 900 + Math.random() * 300, delay: i * 70, easing: 'cubic-bezier(.5, 0, .5, 1)', fill: 'backwards' });
      a.onfinish = () => c.remove();
    }
  }
  if (dFame > 0) popOver('#prestige', `+${dFame} ⭐`, 'fame');
}

function popOver(sel, text, cls) {
  const r = $(sel).closest('.res').getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `hud-pop ${cls}`;
  el.textContent = text;
  el.style.left = `${r.left + r.width / 2}px`;
  el.style.top = `${r.bottom + 4}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

function renderHud(t) {
  const c = clockInfo(state, t);
  if (hudPrev && performance.now() > 5000 && (state.money > hudPrev.money || state.prestige > hudPrev.fame)) {
    celebrateGains(state.money - hudPrev.money, state.prestige - hudPrev.fame);
  }
  hudPrev = { money: state.money, fame: state.prestige };
  $('#money').textContent = state.money.toLocaleString('fr-FR');
  $('#money').closest('.res').classList.toggle('debt', state.money < 0);
  $('#gems').textContent = (state.gems || 0).toLocaleString('fr-FR');
  $('#prestige').textContent = state.prestige;
  $('#clock').innerHTML = `${icon(c.night || phase === 'evening' ? 'moon' : 'sun')}<b>${c.now}</b>`;
  let status;
  if (c.night) status = `Fermé jusqu'à ${CONFIG.wakeUpHour}h`;
  else if (state.queue.length >= CONFIG.queueMax) status = 'File d\'attente pleine';
  else status = `Prochain client ~${c.nextArrivalLabel}`;
  $('#clock').dataset.hint = `${status}. Paie dans ${fmtDuration(c.nextMidnight - t)} (à minuit), départs à 10h.`;

  const unread = state.log.filter((l) => l.id > prefs.get('lastSeenLog', 0)).length;
  const badge = $('#journal-badge');
  badge.textContent = unread > 99 ? '99+' : unread;
  badge.hidden = unread === 0;
  const lb = $('#lab-badge');
  lb.textContent = state.research.points;
  lb.hidden = !state.research.points;
  const idle = freeStaff(state).length;
  const sb = $('#staff-badge');
  sb.textContent = idle;
  sb.hidden = idle === 0;
}

function renderBuilding(t, occ, sats) {
  const h = state.hotel;
  const lobbyStaff = state.staff.filter((s) => s.task && s.task.kind === 'lobby');
  const extending = selection && selection.mode === 'extend';
  const shape = Object.keys(state.rooms).sort().join(',');
  const key = [shape, h.name, h.neon, h.level, h.lobbyLevel, phase, lobbyStaff.map((s) => s.id).join(','), extending ? state.money : '',
    state.queue.join(','), selection ? `${selection.mode}:${selection.guestId || selection.itemId || selection.staffId || selection.pieceId}` : '',
    JSON.stringify(furnitureAt(state, 0, Math.max(...Object.values(state.rooms).filter((x) => x.kind === 'lobby').map((x) => x.col))))].join('|');
  const world = $('#world');

  if (key !== layoutKey) {
    const span = hotelSpan(state);
    const sizeChanged = !layoutKey.startsWith(`${shape}|`) || extending !== lastExtending;
    lastExtending = extending;
    layoutKey = key;
    roomKeys.clear();
    const lit = phase !== 'day';
    // Colonnes affichées : l'emprise du bâtiment (+ une de chaque côté en mode « Agrandir »).
    const ghosts = extending ? extendSlots(state) : [];
    const c0 = Math.min(span.min, ...ghosts.map((x) => x.col));
    const c1 = Math.max(span.max, ...ghosts.map((x) => x.col));
    const top = Math.max(span.top, ...ghosts.map((x) => x.floor));
    const at = (f, c) => state.rooms[`${f}-${c}`];
    const price = extending ? extendCost(state) : 0;
    const topCols = Object.values(state.rooms).filter((r) => r.floor === span.top).map((r) => r.col);
    // Rangées : le toit, [les emplacements du nouvel étage], puis les étages du haut vers le bas.
    const extra = top - span.top;
    const row = (f) => (f > span.top ? 2 : extra + 2 + span.top - f);
    let cells = `<div class="roof" style="grid-row:1;grid-column:${Math.min(...topCols) - c0 + 1} / ${Math.max(...topCols) - c0 + 2}">
        <div class="roof-props"><div class="antenna">${antennaSVG()}</div><div class="tower">${waterTowerSVG()}</div></div>
        <div class="neon" style="--neon:${NEON_COLORS[h.neon ?? DEFAULT_NEON]}"><div class="sign-stars">${levelStars(h.level)}</div><div class="sign-name" style="font-size:${Math.max(15, Math.min(30, Math.round(420 / Math.max(14, [...h.name].length))))}px">${esc(h.name)}</div><div class="sign-sub">HÔTEL${state.stars ? ` <span class="sign-legacy">${'✦'.repeat(Math.min(5, state.stars))}${state.stars > 5 ? state.stars : ''}</span>` : ''}</div><span class="poles"></span></div>
        <div class="chimneys-wrap">${chimneysSVG(topCols.length)}</div>
        ${roofSVG(Math.max(...topCols) - Math.min(...topCols) + 1)}
      </div>`;
    const staffTarget = selection && selection.mode === 'staff' && lobbyStaffCount(state) < lobbyCapacity(state);
    for (let f = top; f >= 0; f--) {
      const cols = Object.values(state.rooms).filter((r) => r.floor === f).map((r) => r.col);
      const first = cols.length ? Math.min(...cols) : null;
      for (let c = c0; c <= c1; c++) {
        const r = at(f, c);
        const pos = `grid-row:${row(f)};grid-column:${c - c0 + 1}`;
        if (!r) {
          if (ghosts.some((x) => x.floor === f && x.col === c)) {
            cells += `<button class="ext-slot${f === 0 ? ' ground' : ''}" style="${pos}" data-ext="${f}:${c}">${icon('build')}<b>Agrandir</b>${price ? cur(price) : '<small>Gratuit</small>'}</button>`;
          }
          continue;
        }
        const seed = f * 7 + c * 3;
        const cls = ['room-slot', f === 0 ? 'ground-slot' : '', at(f, c - 1) ? '' : 'edge-l', at(f, c + 1) ? '' : 'edge-r',
          f < span.top && !at(f + 1, c) ? 'capped' : '', r.kind === 'lobby' ? 'lobby-slot' : '',
          f > 0 && !at(f - 1, c) ? 'overhang' : ''].filter(Boolean).join(' ');
        let inner;
        if (r.kind === 'lobby') {
          inner = `<div class="awning">${awningSVG()}<span class="awning-clock" data-hint="Arrivée du prochain client (l’heure actuelle est en haut à gauche).">${ledClockHTML('--:--')}</span></div>
            <button class="lobby ${staffTarget ? 'target mood-good' : ''}" data-lobby>
              ${lobbyCellSVG()}
              ${decoLayerHTML(furnitureAt(state, r.floor, r.col), r.col)}
              <div class="lobby-staff">${lobbyStaff.map((s) => `<div class="staff-sprite">${staffSVG(s, 'lobby')}</div>`).join('')}</div>
              <div class="lobby-plate">${icon('bell')}<small>${lobbyStaff.length}/${lobbyCapacity(state)}</small></div>
            </button>`;
        } else {
          inner = `<button class="room" data-room="${r.id}"></button>
            ${at(f, c + 1) && f > 0 ? `<span class="sconce">${sconceSVG()}</span>` : ''}
            ${f > 0 && seed % 3 === 0 ? `<span class="planter-wrap">${planterSVG(seed)}</span>` : ''}`;
        }
        // Porte-à-faux (rien en dessous) : consoles de pierre, et une jambe de force vers le voisin qui porte.
        const corbels = f > 0 && !at(f - 1, c) ? `<span class="corbels">${corbelSVG(!!at(f - 1, c - 1), !!at(f - 1, c + 1))}</span>` : '';
        cells += `<div class="${cls}" style="${pos}">${c === first && f > 0 ? `<div class="floor-num">${f}</div>` : ''}${inner}${f > 0 ? '<span class="cornice"></span>' : ''}${corbels}</div>`;
      }
    }
    const carColors = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa'];
    world.innerHTML = `
      <div class="city">${citySVG(phase)}</div>
      <div class="birds">${birdsSVG()}</div>
      <div class="scenery left"><span class="t1">${treeSVG(0)}</span><span class="t2">${treeSVG(2)}</span><span class="b1">${bushSVG(1)}</span><span class="bench-wrap">${benchSVG()}</span></div>
      <div class="scenery right"><span class="t1">${treeSVG(1)}</span><span class="t2">${treeSVG(0)}</span><span class="b1">${bushSVG(0)}</span><span class="b2">${bushSVG(1)}</span></div>
      <div id="building" class="building${extending ? ' extending' : ''}${selection && selection.mode === 'deco' ? ' decorating' : ''}" style="--cols:${c1 - c0 + 1}">
        <div class="floors">${cells}</div>
      </div>
      <div class="street">
        <div class="lamp l1">${lampPostSVG(lit)}</div><div class="lamp l2">${lampPostSVG(lit)}</div><div class="lamp l3">${lampPostSVG(lit)}</div><div class="lamp l4">${lampPostSVG(lit)}</div>
        ${streetSVG(phase)}
        <div class="car" style="animation-delay:-${(state.logSeq % 9) * 2}s">${carSVG(carColors[state.logSeq % carColors.length])}</div>
        <div class="street-queue">${state.queue.map((id) => {
          const g = state.guests[id];
          const sel = selection && selection.guestId === id ? ' selected' : '';
          return `<button class="walker${sel}${g.parcel ? ' parcel' : ''}" data-guest="${id}" style="--d:${(g.look % 7) * 0.3}s">${creatureSVG(g, 'mid')}${g.parcel ? '<span class="egg-tag" title="Œuf d’un ami">🥚</span>' : ''}<span class="walker-name">${esc(g.name)}</span></button>`;
        }).join('')}</div>
      </div>`;
    requestAnimationFrame(placeQueue);
    if (camera) requestAnimationFrame(() => {
      camera.focusEl = $('#building');
      if (sizeChanged && !camera.userMoved) camera.fit(camera.focusEl); else camera.apply();
    });
  }

  // Horloge de l'auvent : arrivée du prochain client (l'heure actuelle est dans le HUD).
  const ac = $('.awning-clock .led-text');
  if (ac) ac.textContent = state.nextArrival ? clock(state.nextArrival).replace('h', ':') : '--:--';

  // Pièces : on ne redessine que ce qui a changé.
  const building = $('#building');
  for (const room of roomList(state)) {
    const el = building.querySelector(`[data-room="${room.id}"]`);
    if (!el) continue;
    const view = roomView(room, t, occ, sats);
    if (roomKeys.get(room.id) !== view.key) {
      roomKeys.set(room.id, view.key);
      el.className = view.cls;
      el.innerHTML = view.html;
      el.setAttribute('aria-label', view.label);
    }
  }
}

/** Soutien d'une case en porte-à-faux : bandeau et consoles de pierre, jambes de force vers les voisins porteurs. */
function corbelSVG(left, right) {
  const strut = (x1, x2) => `<path d="M${x1} 8 L${x2} 46" stroke="#2c2a33" stroke-width="5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <path d="M${x1} 8 L${x2} 46" stroke="#5b5866" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  const corbel = (x) => `<path d="M${x} 7 h12 l-3 13 h-6 z" fill="#c9a37a" stroke="#7a5536" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  return `<svg viewBox="0 0 100 48" preserveAspectRatio="none" aria-hidden="true">
    ${left ? strut(58, 1) : ''}${right ? strut(42, 99) : ''}
    ${corbel(8)}${corbel(44)}${corbel(80)}
    <rect x="0" y="0" width="100" height="8" fill="#9c7a52"/><rect x="0" y="0" width="100" height="3" fill="#e7cfa6"/>
  </svg>`;
}

/** Les clients attendent devant la porte de la réception, en file vers la gauche. */
function placeQueue() {
  const q = document.querySelector('.street-queue');
  const lobby = document.querySelector('.lobby-slot');
  const street = document.querySelector('.street');
  if (!q || !lobby || !street) return;
  // Position dans la rue (son repère), corrigée du zoom de la caméra.
  const sr = street.getBoundingClientRect();
  const scale = sr.width / street.offsetWidth || 1;
  const lr = lobby.getBoundingClientRect();
  q.style.left = `${(lr.left + lr.width * 0.7 - sr.left) / scale}px`;
}

// -----------------------------------------------------------------------------
// Colonne latérale (grand écran) : infos survolées, mission, journal
// -----------------------------------------------------------------------------
let hover = null;
let sideKey = '';

function renderSide(t) {
  if (getComputedStyle($('#side')).display === 'none') return;
  const key = JSON.stringify(hover) + state.logSeq + JSON.stringify(state.quest) + Math.floor(t / 30000) + state.gems + state.queue.length;
  if (key === sideKey) return;
  sideKey = key;
  $('#side-info').innerHTML = infoHTML();
  $('#side-quest').innerHTML = questPanelHTML();
  $('#side-log').innerHTML = [...state.log].slice(-30).reverse()
    .map((l) => `<li class="log-${l.kind}"><time>${clock(l.t)}</time><span>${esc(l.text)}</span></li>`).join('');
}

/** Panneau d'infos : ce que la souris survole (client, pièce), sinon un résumé. */
function infoHTML() {
  const g = hover && hover.guestId ? state.guests[hover.guestId] : null;
  if (g) {
    const t = TYPES[g.type];
    const det = g.roomId ? computeSatisfaction(state, g) : null;
    return `<div class="info-head" style="--c:${t.color}"><div class="info-av">${creatureSVG(g, det ? moodOf(det.value) : 'good')}</div>
        <div><b>${esc(g.name)}${g.star ? ` ${icon('star')}` : ''}</b><span class="qtype" style="--d:${t.dark}">${t.name}</span>
        <small>${g.roomId ? `Chambre ${roomLabel(state.rooms[g.roomId])} · ${g.nightsLeft} nuit(s) restante(s)` : `En attente · ${g.stay} nuit(s)`}</small></div>
        ${det ? moodBadge(det.value) : ''}</div>
      <p class="sentence">${likeSentence(g)}</p>
      ${traitsHTML(g)}
      ${det ? linesHTML(det.lines) : `<p class="muted">Satisfaction de départ : ${g.baseSat}. Touchez-le, puis une chambre : chaque chambre affichera sa future note.</p>`}
      <p class="muted trait-line"><b>${t.trait.name}</b> — ${esc(t.trait.desc)}</p>`;
  }
  const room = hover && hover.roomId ? state.rooms[hover.roomId] : null;
  if (room) {
    const title = room.kind === 'empty' ? 'Emplacement libre' : room.kind === 'bedroom' ? `Chambre ${roomLabel(room)}` : BUILDABLES[room.sub].name;
    let body = '';
    if (room.kind === 'bedroom') {
      body = `<div class="info-row"><span>Niveau</span><b>${room.level}</b></div>
        ${room.damage ? `<div class="info-row"><span>Dégâts</span><b class="neg">${room.damage}/${CONFIG.maxDamage}</b></div>` : ''}
        <h4>Ambiance</h4>${ambianceHTML(state, room)}
        ${room.equip.length ? `<h4>Équipements</h4><div class="amb">${room.equip.map((id) => `<span class="amb-chip">${itemSVG(id)}<b>${ITEMS[id].name}</b></span>`).join('')}</div>` : ''}`;
    } else if (room.kind === 'empty') body = '<p class="muted">Touchez pour construire une chambre ou une salle.</p>';
    else body = `<p class="muted">${esc(BUILDABLES[room.sub].desc)}</p>`;
    return `<h3>${title}</h3>${body}`;
  }
  const occ = Object.values(occupancy(state));
  const avg = occ.length ? (occ.reduce((s, g) => s + (frame.details[g.id]?.value ?? 0), 0) / occ.length).toFixed(1) : '—';
  const full = state.queue.length >= CONFIG.queueMax;
  return `<button class="btn primary call-btn" data-side="attract" ${full || state.gems < CONFIG.gems.attract ? 'disabled' : ''}
      data-hint="Un rabatteur vous ramène un client tout de suite.">${icon('bell')} Attirer un client ${gem(CONFIG.gems.attract)}</button>
    <div class="info-compact"><span>${icon('users')}<b>${occ.length}</b> client${occ.length > 1 ? 's' : ''}</span>
      <span>${occ.length ? faceIcon(Math.round(Number(avg))) : icon('heart')}<b>${avg}</b> moy.</span>
      <span>${icon('clock')}<b>${state.nextArrival ? clock(state.nextArrival) : '—'}</b></span></div>
    <p class="muted info-tip">Survolez un client ou une pièce pour voir son détail.</p>`;
}

/** Panneau de mission (objectifs regroupés, comme dans CroqueMotel). */
function questPanelHTML() {
  const q = state.quest;
  if (!q) return '';
  const tpl = QUESTS[q.id];
  const groups = [];
  tpl.goals.forEach((g, i) => {
    let grp = groups.find((x) => x.type === g);
    if (!grp) groups.push(grp = { type: g, done: 0, total: 0 });
    grp.total++;
    if (q.done[i]) grp.done++;
  });
  return `<h3>${factorIcon({ kind: 'quest' })} ${tpl.repeat ? 'Mission répétable' : `Mission ${q.id + 1}`}</h3>
    <div class="quest-text">${esc(tpl.text)}</div>
    <ul class="goals compact">${groups.map((x) => `<li class="${x.done >= x.total ? 'done' : ''}"><span class="gchk">${x.done >= x.total ? icon('check') : ''}</span>${esc(GOAL_LABELS[x.type])} <b>(${x.done}/${x.total})</b></li>`).join('')}</ul>
    ${tpl.rewards.length ? `<div class="rewards small">${tpl.rewards.map(rewardHTML).join('')}</div>` : ''}`;
}

/** État d'une demande de service : peut-on y répondre maintenant ? */
function requestStatus(g, t) {
  const svc = SERVICES[g.request.kind];
  const rooms = Object.values(state.rooms).filter((r) => r.kind === 'service' && r.sub === svc.room && !r.buildEnd);
  if (!rooms.length) return 'missing';
  return rooms.some((r) => (r.busyUntil || 0) <= t) ? 'ok' : 'busy';
}

/** Calcule l'affichage d'une pièce et sa clé de rendu. */
function roomView(room, t, occ, sats) {
  const g = occ[room.id];
  const sat = g ? sats[g.id] : null;
  const mood = g ? moodOf(sat) : null;
  const detail = g ? frame.details[g.id] : null;
  const staff = staffInRoom(state, room.id);
  const busy = (room.kind === 'service' || room.kind === 'lab') && room.busyUntil > t;
  const target = targetInfo(room, occ);
  const focusP = selection && selection.focus ? frame.previews.get(selection.focus) : null;
  const impact = focusP && g ? focusP.others.find((o) => o.guestId === g.id) : null;
  const reqStatus = g && g.request ? requestStatus(g, t) : null;
  const labelNum = roomLabel(room);
  const chipSig = detail ? significant(detail.lines).slice(0, 4).map((l) => `${l.kind}${l.aura || ''}${l.dir || ''}${l.value}`).join() : '';
  const visitor = room.kind === 'leisure' ? Object.values(state.guests).find((x) => x.leisure && x.leisure.roomId === room.id) : null;
  const screaming = g && g.type === 'combat' && sat <= CONFIG.hysteriaThreshold;
  const deco = floorDeco(state, room.floor);
  const pieces = furnitureAt(state, room.floor, room.col);
  const decoMode = selection && selection.mode === 'deco';
  const key = JSON.stringify([room.kind, room.sub, room.level, room.damage, room.buildEnd, room.buildTarget, room.equip, room.leftItem, deco, pieces,
    decoMode && selection.pieceId,
    g && [g.id, sat, g.nightsLeft, g.request && g.request.kind, reqStatus, g.star, chipSig, g.bombAt, !!g.leisure], visitor && visitor.id, staff && [staff.id, staff.task.kind, staff.task.end],
    busy && room.busyUntil, target && [target.preview ? target.preview.self : target.icon, target.best, target.focus, target.preview && target.preview.othersDelta],
    impact && [impact.before, impact.after], !!selection]);

  let cls = `room kind-${room.kind}`;
  if (room.buildEnd) cls += ' building-works';
  if (room.damage) cls += ' is-damaged';
  if (mood) cls += ` occupied mood-${mood}`;
  if (target) cls += ` target mood-${target.mood || 'good'}${target.focus ? ' focus' : ''}`;
  if (impact) cls += ` affected ${impact.after > impact.before ? 'up' : 'down'}`;
  if (selection && selection.guestId && g && g.id === selection.guestId) cls += ' selected';
  if (selection && !decoMode && !target && !impact && !(g && selection.guestId === g.id)) cls += ' dimmed';

  let html = roomSVG(room, { glow: g ? mood : 'off', busy, deco });
  html += decoLayerHTML(pieces, room.col);

  if (g && g.leisure) {
    html += `<div class="out-note">${icon('door')}<span>En sortie<br><small>${esc(BUILDABLES[state.rooms[g.leisure.roomId]?.sub]?.name || '')}</small></span></div>`;
  } else if (g) {
    html += `<div class="occupant walker-in ${g.type === 'spectre' ? 'float' : ''}${screaming ? ' shaking' : ''}" style="${occupantStyle(g)}">${creatureSVG(g, mood)}</div>`;
    if (screaming) html += '<span class="scream">HURLE&nbsp;!</span>';
  }
  if (g) {
    // Coin haut droit : humeur, nuits, Star.
    html += `<div class="room-tags">${moodBadge(sat)}
      ${g.nightsLeft <= 0 ? `<span class="tag leave" title="Départ à 10h">${icon('door')}10h</span>` : `<span class="tag">${icon('moon')}${g.nightsLeft}</span>`}
      ${g.star ? `<span class="tag star">${icon('star')}</span>` : ''}
      ${g.parcel ? '<span class="tag egg" title="Œuf d’un ami : ne paie pas">🥚</span>' : ''}
      ${g.bombAt ? `<span class="tag bomb">💥<span data-until="${g.bombAt}"></span></span>` : ''}</div>`;
    // Bas : pastilles "ce qui va / ne va pas".
    if (!selection) html += chipsHTML(detail.lines, { max: Infinity }); // toutes les pastilles, sans « +n »
    if (g.request) {
      const svc = SERVICES[g.request.kind];
      const st = { ok: icon('check'), busy: icon('clock'), missing: icon('lock') }[reqStatus];
      html += `<span class="request ${reqStatus}" data-request="${g.id}" title="${esc(svc.name)}">
        <span class="req-icon">${svc.icon}</span><span class="req-time" data-until="${g.request.until}"></span><span class="req-state">${st}</span></span>`;
    }
  }
  if (staff) {
    html += `<div class="staff-sprite in-room ${staff.task.kind}">${staffSVG(staff, staff.task.kind)}</div>`;
    if (staff.task.end) html += `<span class="work-timer ${staff.task.kind}">${icon(staff.task.kind === 'repair' ? 'wrench' : 'heart')}<span data-until="${staff.task.end}"></span></span>`;
  }
  if (room.buildEnd) html += `<span class="work-timer big">${icon('hammer')}<span data-until="${room.buildEnd}"></span></span>`;
  if (busy) html += `<span class="work-timer">${icon('clock')}<span data-until="${room.busyUntil}"></span></span>`;
  if (room.kind === 'empty' && !room.buildEnd) html += SITE_DECO;
  if (room.kind === 'empty' && !room.buildEnd && !selection) html += `<span class="build-cta">${icon('build')}Construire</span>`;
  if (room.kind !== 'empty' && room.kind !== 'bedroom' && !room.buildEnd) {
    const b = BUILDABLES[room.sub];
    html += `<span class="room-sign">${b.aura ? auraIcon(b.aura) : ''}${esc(b.name)}</span>`;
  }
  if (room.damage && !g && !staff) html += `<span class="build-cta warn">${icon('wrench')}Abîmée ×${room.damage}</span>`;
  if (visitor) html += `<div class="occupant visitor" style="${occupantStyle(visitor)}">${creatureSVG(visitor, 'good')}</div>`;
  if (room.leftItem) html += `<span class="pickup-hint${room.leftItem.vials ? ' vial' : ''}">${room.leftItem.vials ? '🧪' : icon('pickup')}</span>`;
  if (room.kind === 'bedroom' && !g && room.equip.length && !selection) {
    html += `<div class="equip-badges">${room.equip.map((id) => (ITEMS[id].auras.length ? ITEMS[id].auras.map((a) => auraIcon(a)).join('') : `<span class="eq-dot">${icon('box')}</span>`)).join('')}</div>`;
  }

  html += `<span class="room-plate">${room.kind === 'bedroom' ? `${labelNum}${room.level > 1 ? ` <i>${'◆'.repeat(room.level - 1)}</i>` : ''}` : labelNum}</span>`;

  if (target && target.preview) {
    const p = target.preview;
    const d = p.othersDelta;
    html += `<div class="preview mood-${target.mood}">
      ${target.best ? `<span class="best">${icon('star')}Top</span>` : ''}
      <b>${p.self}</b>
      ${chipsHTML(p.lines, { max: 3, values: false, cls: 'mini' })}
      ${d ? `<small class="${d > 0 ? 'pos' : 'neg'}">voisins ${d > 0 ? '+' : ''}${d}</small>` : ''}
    </div>`;
  } else if (target) {
    html += `<div class="preview mood-good"><span class="target-ico">${icon(target.icon || 'check')}</span></div>`;
  }
  if (impact) {
    const d = impact.after - impact.before;
    html += `<div class="impact ${d > 0 ? 'pos' : 'neg'}">${faceIcon(impact.after)}<b>${impact.before}→${impact.after}</b></div>`;
  }
  return { key, cls, html, label: `Pièce ${labelNum}` };
}

/**
 * Mobilier d'une case : chaque meuble est posé sur l'étage (x en colonnes) ; la
 * case en dessine la part qui la touche (un meuble à cheval passe derrière le mur).
 */
/** Emplacement libre : petit décor de chantier (barrière rayée, plots, seau). */
const SITE_DECO = `<svg class="site-deco" viewBox="0 0 120 40" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
  <g stroke="#3a2a1a" stroke-width="1.5" stroke-linejoin="round">
    <rect x="30" y="8" width="60" height="9" rx="1.5" fill="#fff"/>
    <path d="M36 8 l-6 9 M48 8 l-6 9 M60 8 l-6 9 M72 8 l-6 9 M84 8 l-6 9 M90 10 l-4 7" stroke="#e8463a" stroke-width="4"/>
    <rect x="30" y="8" width="60" height="9" rx="1.5" fill="none"/>
    <path d="M36 17 v20 M84 17 v20 M32 37 h8 M80 37 h8"/>
    <path d="M10 37 l5 -18 h4 l5 18z" fill="#ff8a1e"/><path d="M12.5 30 h9 M14 24 h6" stroke="#fff" stroke-width="2.4"/>
    <path d="M96 37 l5 -18 h4 l5 18z" fill="#ff8a1e"/><path d="M98.5 30 h9 M100 24 h6" stroke="#fff" stroke-width="2.4"/>
  </g></svg>`;

function decoLayerHTML(pieces, col) {
  if (!pieces.length) return '';
  const decoMode = selection && selection.mode === 'deco';
  return `<div class="deco-layer">${pieces.map((p) => {
    const floating = DECO_FAMILIES[p.type].position === 'floating';
    const sel = decoMode && selection.pieceId === p.id ? ' picked' : '';
    return `<span class="deco-piece ${floating ? 'on-wall' : 'on-ground'}${sel}" data-deco="${p.id}" style="left:calc(${(p.x - col).toFixed(3)} * var(--cell-w) - var(--gap) / 2);${floating ? `top:${(p.y * 100).toFixed(1)}%;` : ''}width:calc(${DECO_FAMILIES[p.type].w} * var(--room-w));aspect-ratio:${decoRatio(p.type)}">${decoSVG(p.type, p.frame)}</span>`;
  }).join('')}</div>`;
}

/** La pièce est-elle une cible valide pour la sélection en cours ? */
function targetInfo(room, occ) {
  if (!selection) return null;
  const g = occ[room.id];
  if (selection.mode === 'place' || selection.mode === 'move') {
    const p = frame.previews.get(room.id);
    if (!p) return null;
    return { preview: p, mood: moodOf(p.self), best: frame.best.has(room.id), focus: selection.focus === room.id };
  }
  if (selection.mode === 'item') {
    const it = ITEMS[selection.itemId];
    if (it.kind === 'deco') return room.floor >= 1 ? { icon: 'sparkle' } : null;
    if (room.kind !== 'bedroom' || room.buildEnd) return null;
    if (it.kind === 'equip' && room.equip.length < 2 && !room.equip.includes(it.id)) return { icon: 'box' };
    if (it.kind === 'gift' && g && !hasAnyBonus(g)) return { icon: 'gift' };
    if (it.kind === 'repair' && !g && room.damage) return { icon: 'wrench' };
    return null;
  }
  if (selection.mode === 'staff') {
    if (room.kind !== 'bedroom' || room.buildEnd || staffInRoom(state, room.id)) return null;
    if (g && !g.cared && g.nightsLeft > 0) return { icon: 'heart' };
    if (!g && room.damage) return { icon: 'wrench' };
    return null;
  }
  return null;
}

/** Pastille d'aura lisible : icône + nom. */
const auraTag = (a) => `<i class="tchip">${auraIcon(a)}${AURAS[a].name}</i>`;

/** Profil compact d'un client : ce qu'il aime, ce qu'il déteste, ce qu'il émet (en toutes lettres). */
function traitsHTML(g, { emit = true } = {}) {
  const emits = TYPES[g.type].auras;
  const row = (cls, ico, label, list, empty) => `<span class="qrow ${cls}"><span class="qlabel">${icon(ico)}${label}</span>
    <span class="qtags">${list.length ? list.map(auraTag).join('') : `<i class="tchip none">${empty}</i>`}</span></span>`;
  return `<span class="qrows">${row('like', 'heart', 'Aime', g.likes, 'rien')}${row('dislike', 'close', 'Déteste', g.dislikes, 'rien')}${emit ? row('emit', 'bubble', 'Dégage', emits, 'rien (invisible)') : ''}</span>`;
}

/** Phrase de profil, comme dans CroqueMotel. */
function likeSentence(g) {
  const names = (l) => l.map((a) => `<b>${AURAS[a].name.toLowerCase()}</b>`).join(' et ');
  let s = '';
  if (g.likes.length) s += `Il aime ${names(g.likes)}`;
  if (g.dislikes.length) s += `${s ? ', mais il' : 'Il'} déteste ${names(g.dislikes)}`;
  s += s ? '. ' : '';
  const em = TYPES[g.type].auras;
  s += em.length ? `Il dégage ${names(em)} autour de lui.` : 'Il ne dégage rien autour de lui.';
  return s;
}

function renderQueue() {
  const q = $('#queue');
  if (!q) return;
  $('#queue-count').textContent = `${state.queue.length}/${CONFIG.queueMax}`;
  const key = state.queue.join(',') + '|' + (selection && selection.guestId) + '|' + state.nextArrival + '|' + lobbyStaffCount(state);
  if (q.dataset.key === key) return;
  q.dataset.key = key;
  if (!state.queue.length) {
    q.innerHTML = `<div class="queue-empty">Personne n'attend. Prochain client vers <b>${state.nextArrival ? clock(state.nextArrival) : '—'}</b>${lobbyStaffCount(state) ? '' : ' (placez un employé à la réception pour accélérer les arrivées)'}.</div>`;
    return;
  }
  q.innerHTML = state.queue.map((id) => {
    const g = state.guests[id];
    const t = TYPES[g.type];
    const sel = selection && selection.guestId === id ? ' selected' : '';
    return `<button class="qcard${sel}" data-guest="${id}" style="--tc:${t.color};--td:${t.dark}">
      <span class="qhead"><span class="qavatar">${creatureSVG(g, 'good')}</span>
        <span class="qid"><b>${esc(g.name)}${g.star ? ` ${icon('star')}` : ''}</b>
          <span class="qmeta"><i class="qtype" style="--c:${t.color};--d:${t.dark}">${t.name}</i><i class="qstay">${icon('moon')}${g.stay}</i>
            <i class="qemit" title="Ce qu’il dégage autour de lui">${icon('bubble')}${t.auras.length ? t.auras.map((a) => auraIcon(a)).join('') : 'rien'}</i></span></span></span>
      ${traitsHTML(g, { emit: false })}
    </button>`;
  }).join('');
}

function renderHint() {
  const hint = $('#hint');
  if (!selection) { hint.hidden = true; hint.dataset.key = ''; return; }
  const key = JSON.stringify(selection) + (selection.focus ? JSON.stringify(frame.previews.get(selection.focus)?.self) : '')
    + (selection.mode === 'deco' ? JSON.stringify([state.furniture, state.inventory.randdeco]) : '') + (selection.mode === 'extend' ? state.money : '');
  if (hint.dataset.key === key && !hint.hidden) return;
  hint.dataset.key = key;
  let html = '';
  if (selection.guestId) {
    const g = state.guests[selection.guestId];
    const t = TYPES[g.type];
    const p = selection.focus ? frame.previews.get(selection.focus) : null;
    if (p) {
      const room = state.rooms[selection.focus];
      html = `<div class="pv">
        <div class="pv-head">
          <div class="hint-art">${creatureSVG(g, moodOf(p.self))}</div>
          <div class="pv-title"><small>${selection.mode === 'move' ? 'Déménager' : 'Installer'} ${esc(g.name)} en</small><b>Chambre ${roomLabel(room)}</b></div>
          <div class="pv-score mood-${moodOf(p.self)}">${faceIcon(p.self)}<b>${p.self}</b><small>/10</small></div>
        </div>
        ${linesHTML(p.lines)}
        ${p.others.length ? `<div class="pv-others"><small>Effet sur les voisins</small>${p.others.map((o) => `<span class="${o.after > o.before ? 'pos' : 'neg'}">${faceIcon(o.after)}${esc(o.name)} <b>${o.before} → ${o.after}</b></span>`).join('')}</div>` : ''}
        <div class="pv-actions">
          <button class="btn primary" data-action="confirm">${icon('bed')} ${selection.mode === 'move' ? 'Déménager ici' : 'Installer ici'}</button>
          <button class="btn ghost" data-action="cancel">${icon('close')}</button>
        </div>
      </div>`;
    } else {
      html = `<div class="hint-row"><div class="hint-art">${creatureSVG(g, 'good')}</div>
        <div class="hint-text"><b>${selection.mode === 'move' ? 'Déménager' : 'Installer'} ${esc(g.name)}</b>
          <p class="hint-sentence">${likeSentence(g)}</p>
          <small>Chaque chambre affiche sa future note (${icon('star')} = meilleur choix) : touchez-en une pour l’y installer.</small></div>
        <button class="icon-btn" data-action="cancel" aria-label="Annuler">${icon('close')}</button></div>`;
    }
  } else if (selection.itemId) {
    const it = ITEMS[selection.itemId];
    html = `<div class="hint-row"><div class="hint-art">${itemSVG(it.id)}</div>
      <div class="hint-text"><b>Utiliser : ${esc(it.name)}</b><small>${esc(it.desc)} Touchez une pièce en surbrillance.</small></div>
      <button class="icon-btn" data-action="cancel" aria-label="Annuler">${icon('close')}</button></div>`;
  } else if (selection.mode === 'deco') {
    const reserve = (state.furniture || []).filter((p) => p.floor == null);
    const boxes = state.inventory.randdeco || 0;
    const picked = selection.pieceId && state.furniture.find((p) => p.id === selection.pieceId);
    html = `<div class="deco-bar">
      <div class="hint-text"><b>${icon('sparkle')} Changer le mobilier</b><small>${picked ? `${esc(DECO_FAMILIES[picked.type].name)} : touchez l'endroit où le déplacer, ou rangez-le.` : selection.decoId ? 'Touchez une pièce, à l\'endroit où poser ce meuble.' : 'Touchez un meuble de la réserve ou un meuble déjà posé, puis l\'endroit voulu.'}</small></div>
      <div class="deco-reserve">${reserve.map((p) => `<button class="deco-tile${selection.decoId === p.id ? ' on' : ''}" data-reserve="${p.id}" title="${esc(DECO_FAMILIES[p.type].name)}">${decoSVG(p.type, p.frame)}</button>`).join('')}
        ${boxes ? `<button class="deco-tile box" data-action="open-box" title="Ouvrir un carton">${itemSVG('randdeco')}<em>×${boxes}</em></button>` : ''}
        ${!reserve.length && !boxes ? '<span class="muted">Réserve vide</span>' : ''}</div>
      <div class="deco-actions">${picked ? `<button class="btn small" data-action="store">${icon('box')} Ranger</button>` : ''}
        <button class="icon-btn" data-action="cancel" aria-label="Terminer">${icon('check')}</button></div></div>`;
  } else if (selection.mode === 'extend') {
    const cost = extendCost(state);
    html = `<div class="hint-row"><div class="hint-art hint-ico">${icon('build')}</div>
      <div class="hint-text"><b>Agrandir l'hôtel</b><small>Touchez un emplacement en pointillés : à côté d'une pièce (même si rien ne la soutient en dessous), ou sur le toit, au-dessus d'une pièce. Prochain emplacement : ${cost ? `${cost} 🪙` : 'gratuit'}${Object.keys(state.rooms).length >= CONFIG.extendFameFromRooms ? ', +1 ⭐' : ''}.</small></div>
      <button class="icon-btn" data-action="cancel" aria-label="Terminer">${icon('check')}</button></div>`;
  } else if (selection.staffId) {
    const s = state.staff.find((x) => x.id === selection.staffId);
    html = `<div class="hint-row"><div class="hint-art">${staffSVG(s)}</div>
      <div class="hint-text"><b>Affecter ${esc(s.name)}</b><small>Réception (arrivées plus rapides), chambre abîmée (réparer) ou client (petites attentions).</small></div>
      <button class="icon-btn" data-action="cancel" aria-label="Annuler">${icon('close')}</button></div>`;
  }
  hint.hidden = false;
  hint.innerHTML = html;
}


// -----------------------------------------------------------------------------
// Interactions
// -----------------------------------------------------------------------------
function bindEvents() {
  $('#world').addEventListener('mouseover', (e) => {
    const gEl = e.target.closest('[data-guest]');
    const rEl = e.target.closest('[data-room]');
    const occ = occupancy(state);
    if (gEl) hover = { guestId: gEl.dataset.guest };
    else if (rEl) hover = occ[rEl.dataset.room] ? { guestId: occ[rEl.dataset.room].id } : { roomId: rEl.dataset.room };
    else hover = null;
    renderSide(now());
  });
  $('#scene').addEventListener('mouseleave', () => { hover = null; renderSide(now()); });

  $('#world').addEventListener('click', (e) => {
    if (selection && selection.mode === 'deco') return onDecoTap(e);
    const req = e.target.closest('[data-request]');
    if (req && !selection) { e.stopPropagation(); act(fulfillRequest, req.dataset.request); return; }
    const guestBtn = e.target.closest('[data-guest]');
    if (guestBtn) return onQueueTap(guestBtn.dataset.guest);
    const ext = e.target.closest('[data-ext]');
    if (ext) return onExtendTap(ext.dataset.ext);
    if (e.target.closest('[data-lobby]')) return onLobbyTap();
    const room = e.target.closest('[data-room]');
    if (room) onRoomTap(room.dataset.room);
  });

  $('#hint').addEventListener('click', (e) => {
    const tile = e.target.closest('[data-reserve]');
    if (tile) { selection = { mode: 'deco', decoId: selection.decoId === tile.dataset.reserve ? null : tile.dataset.reserve }; render(); return; }
    if (e.target.closest('[data-action="open-box"]')) {
      const res = act(openDecoBox);
      if (res.ok) { toast(`Dans le carton : ${DECO_FAMILIES[res.piece.type].name} !`, 'good'); selection = { mode: 'deco', decoId: res.piece.id }; render(); }
      return;
    }
    if (e.target.closest('[data-action="store"]')) { act(storeDeco, selection.pieceId); selection = { mode: 'deco' }; render(); return; }
    if (e.target.closest('[data-action="cancel"]')) { selection = null; render(); }
    if (e.target.closest('[data-action="confirm"]') && selection && selection.focus) confirmPlacement();
  });
  bindUx();
  $('#side').addEventListener('click', (e) => {
    if (e.target.closest('[data-side="attract"]') && act(attractGuest).ok) toast('Un client arrive !', 'good');
  });
  $('#tab-journal').addEventListener('click', () => openJournal());
  $('#tab-shop').addEventListener('click', () => openShop());
  $('#tab-staff').addEventListener('click', openStaff);
  $('#tab-office').addEventListener('click', openOffice);
  $('#tab-friends').addEventListener('click', () => openFriends());
  $('#tab-lab').addEventListener('click', () => openLab());
  $('#quest').addEventListener('click', openQuest);

  $('#sheet-backdrop').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTopLayer(); });
  // Touche Retour du téléphone : ferme la fenêtre (ou le mode) en cours au lieu de
  // quitter le jeu. Une entrée d'historique « garde » est posée dès que quelque chose
  // est ouvert ; Retour la consomme, on ferme alors ce qui est au premier plan.
  window.addEventListener('popstate', () => {
    if (closeTopLayer()) guardBack();
    else history.back(); // rien d'ouvert : Retour fait son travail habituel
  });
}

/** Quelque chose à fermer avec Retour / Échap ? */
const layerOpen = () => !$('#sheet').hidden || !$('#ctx').hidden || !!tray || !!selection;

/** Ferme la fenêtre ou le mode au premier plan ; renvoie false s'il n'y avait rien. */
function closeTopLayer() {
  $('#tip').hidden = true;
  if (!$('#sheet').hidden) closeSheet();
  else if (!$('#ctx').hidden) closeCtx();
  else if (tray) { tray = null; renderActionBar(); }
  else if (selection) { selection = null; render(); }
  else return false;
  return true;
}

/** Pose l'entrée d'historique « garde » si une fenêtre ou un mode est ouvert. */
function guardBack() {
  if (layerOpen() && !(history.state && history.state.pmGuard)) history.pushState({ pmGuard: true }, '');
}

function confirmPlacement() {
  const { mode, guestId, focus } = selection;
  const res = act(mode === 'move' ? moveGuest : placeGuest, guestId, focus);
  if (res.ok) {
    selection = null;
    const g = state.guests[guestId];
    render();
    if (g) setTimeout(() => showThought(g), 400);
  }
  render();
}

function onQueueTap(id) {
  if (visit) return;
  if (selection && selection.guestId === id) selection = null;
  else selection = { mode: 'place', guestId: id };
  render();
}

/** Mode « Changer le mobilier » : choisir un meuble (réserve ou posé), puis toucher l'endroit voulu. */
function startDeco() {
  selection = { mode: 'deco' };
  closeSheet();
  render();
}

function onDecoTap(e) {
  const piece = e.target.closest('[data-deco]');
  if (piece && !selection.decoId) {
    selection = { mode: 'deco', pieceId: selection.pieceId === piece.dataset.deco ? null : piece.dataset.deco };
    render();
    return;
  }
  const roomEl = e.target.closest('[data-room]') || e.target.closest('[data-lobby]');
  const id = selection.decoId || selection.pieceId;
  if (!roomEl || !id) { if (!roomEl) return; toast('Choisissez d\'abord un meuble (réserve en bas, ou un meuble déjà posé).'); return; }
  const room = roomEl.dataset.room ? state.rooms[roomEl.dataset.room] : Object.values(state.rooms).find((x) => x.kind === 'lobby');
  // Position en colonnes : la case occupe [col, col + 1[, la pièce y est centrée entre deux demi-murs.
  const r = roomEl.getBoundingClientRect();
  const roomW = roomEl.offsetWidth;
  const gap = parseFloat(getComputedStyle($('#building')).getPropertyValue('--gap')) || 0;
  const x = room.col + (((e.clientX - r.left) / r.width) * roomW + gap / 2) / (roomW + gap);
  const y = (e.clientY - r.top) / r.height;
  if (act(placeDeco, id, room.floor, x, y).ok) {
    selection = { mode: 'deco' };
    render();
  }
}

function startExtend() {
  selection = { mode: 'extend' };
  closeSheet();
  render();
}

function onExtendTap(where) {
  if (visit) return;
  const [f, c] = where.split(':').map(Number);
  const res = act(extendRoom, f, c);
  if (res.ok) {
    toast('Nouvel emplacement prêt : touchez-le pour y construire.', 'good');
    if (!extendSlots(state).length) selection = null;
    render();
  }
}

function onLobbyTap() {
  if (selection && selection.mode === 'staff') {
    if (act(assignStaff, selection.staffId, 'lobby').ok) selection = null;
    render();
    return;
  }
  openLobby();
}

function onRoomTap(id) {
  const room = state.rooms[id];
  const occ = occupancy(state);
  const g = occ[id];

  if (selection) {
    const target = targetInfo(room, occ);
    if (target) {
      // Placement en un toucher, comme le glisser-déposer d'origine : la note est déjà sur la chambre.
      if (selection.mode === 'place' || selection.mode === 'move') {
        selection = { ...selection, focus: id };
        confirmPlacement();
        return;
      }
      let res;
      if (selection.mode === 'item') res = act(useItem, selection.itemId, id);
      else if (selection.mode === 'staff') res = act(assignStaff, selection.staffId, id);
      if (res && res.ok) selection = null;
      render();
      return;
    }
    if (g && selection.guestId === g.id) { selection = null; render(); return; }
    toast('Impossible ici : touchez une pièce en surbrillance.', 'bad');
    return;
  }

  if (room.leftItem) {
    const res = act(collectLeftover, id);
    if (res.ok) toast(res.left.vials ? '🧪 Fiole ramassée : +1 point de recherche !' : res.left.money ? `+${res.left.money} 🪙 récupérés !` : `Objet récupéré : ${ITEMS[res.left.item].name} !`, 'good');
    return;
  }
  if (room.buildEnd) return toast(`Travaux en cours : fin vers ${clock(room.buildEnd)}.`);
  openCtx(id);
}

/** Fenêtre détaillée d'une pièce (le « Détails » du menu contextuel). */
function openRoomDetails(id) {
  const room = state.rooms[id];
  if (!room) return;
  const g = occupancy(state)[id];
  if (g) return openGuest(g.id);
  if (room.kind === 'empty') return openBuild(room);
  if (room.kind === 'bedroom') return openRoom(room);
  return openFacility(room);
}

// -----------------------------------------------------------------------------
// Fenêtres (bottom sheets)
// -----------------------------------------------------------------------------
let sheetActions = [];

function openSheet({ title, kicker = '', body, actions = [], cls = '', hero = '' }) {
  closeCtx();
  // Bannière de mission encore affichée : on la cache, elle reviendra une fois la fenêtre fermée.
  const qb = $('#quest-banner');
  if (qb && !qb.hidden) { qb.hidden = true; prefs.set('bannerQuest', ''); }
  hidePointer();
  const sheet = $('#sheet');
  sheetActions = actions;
  sheet.className = `sheet ${cls}`;
  sheet.innerHTML = `
    <div class="sheet-grip"></div>
    ${hero ? `<div class="sheet-hero">${hero}</div>` : ''}
    <div class="sheet-head">
      <div>${kicker ? `<div class="kicker">${kicker}</div>` : ''}<h2>${title}</h2></div>
      <button class="icon-btn" data-close aria-label="Fermer">${icon('close')}</button>
    </div>
    <div class="sheet-body">${body}</div>
    ${actions.length ? `<div class="sheet-actions">${actions.map((a, i) =>
      `<button class="btn ${a.cls || ''}" data-i="${i}" ${a.disabled ? 'disabled' : ''}>${a.label}</button>`).join('')}</div>` : ''}`;
  sheet.hidden = false;
  $('#sheet-backdrop').hidden = false;
  guardBack();
  sheet.querySelector('[data-close]').onclick = closeSheet;
  sheet.querySelectorAll('.sheet-actions [data-i]').forEach((b) => { b.onclick = () => sheetActions[Number(b.dataset.i)].run(); });
  return sheet;
}

function closeSheet() {
  const sheet = $('#sheet');
  if (!sheet.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // La fenêtre est fermée tout de suite (pour le reste du jeu) ; une copie inerte glisse vers le bas.
    const ghost = sheet.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.classList.add('sheet-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    const bd = $('#sheet-backdrop').cloneNode(false);
    bd.removeAttribute('id');
    bd.classList.add('sheet-ghost');
    document.body.append(bd, ghost);
    setTimeout(() => { ghost.remove(); bd.remove(); }, 230);
  }
  sheet.hidden = true;
  $('#sheet-backdrop').hidden = true;
}

/** Délégation des boutons internes aux fenêtres : data-do="nom" data-arg="...". */
function onSheetClick(handlers) {
  $('#sheet .sheet-body').onclick = (e) => {
    const b = e.target.closest('[data-do]');
    if (b && !b.disabled && handlers[b.dataset.do]) handlers[b.dataset.do](b.dataset.arg, b);
  };
}

function satGauge(v) {
  return `<div class="gauge mood-${moodOf(v)}">${Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('')}<b>${v}/10</b></div>`;
}

// --- Fiche client -----------------------------------------------------------
function openGuest(guestId) {
  const g = state.guests[guestId];
  if (!g) return;
  const t = TYPES[g.type];
  const sat = computeSatisfaction(state, g);
  const mood = moodOf(sat.value);
  const room = g.roomId && state.rooms[g.roomId];
  const lines = g.roomId
    ? sat.lines.map((l) => `<li><span>${esc(l.label)}</span><b class="${l.value > 0 ? 'pos' : l.value < 0 ? 'neg' : ''}">${l.value > 0 ? '+' : ''}${l.value}</b></li>`).join('')
    : '<li><span>Pas encore installé : la satisfaction dépendra de ses voisins.</span></li>';

  const facts = `
    <div class="fact-grid">
      <div class="fact like"><small>Aime</small>${g.likes.length ? g.likes.map((a) => `<b>${auraIcon(a)} ${AURAS[a].name}</b>`).join('') : '<b>rien de spécial</b>'}</div>
      <div class="fact dislike"><small>Déteste</small>${g.dislikes.length ? g.dislikes.map((a) => `<b>${auraIcon(a)} ${AURAS[a].name}</b>`).join('') : '<b>rien de spécial</b>'}</div>
      <div class="fact"><small>Dégage autour de lui</small><b>${t.auras.length ? t.auras.map((a) => `${auraIcon(a)} ${AURAS[a].name}`).join(' ') : 'rien'}</b></div>
      <div class="fact"><small>Séjour</small><b>${g.roomId ? `${g.nightsLeft} / ${g.stay} nuit(s)` : `${g.stay} nuit(s)`}</b></div>
    </div>
    <div class="trait-card" style="--c:${t.color}"><b>${t.trait.name}</b><span>${esc(t.trait.desc)}</span></div>
    ${g.parcel ? `<div class="trait-card egg"><b>🥚 Œuf de ${esc(g.parcel.from)}</b><span>Un ami vous l'a envoyé : il ne paie pas sa chambre, mais s'il repart à ${WELL_TREATED} ou plus, il compte pour vos succès. Il reste en file au minuit qui suit son arrivée.</span></div>` : ''}
    ${g.star ? `<div class="trait-card star"><b>${icon('star')} Star</b><span>Rapporte jusqu'à ${CONFIG.vipFame.max} ⭐ (à 10/10) mais part de 1 et exige une chambre de niveau ${starRequiredLevel(state)} (+2, sinon −3).</span></div>` : ''}
    <p class="sentence">${likeSentence(g)}</p>
    ${g.roomId && !g.request && g.nextRequestAt && talent(state, 'crystal') ? `<div class="trait-card request"><b>🔮 Boule de cristal</b><span>Prochaine demande de service vers ${clock(g.nextRequestAt)}.</span></div>` : ''}
    ${g.request ? `<div class="trait-card request"><b>${SERVICES[g.request.kind].icon} Demande en cours</b><span>${SERVICES[g.request.kind].name} — expire à ${clock(g.request.until)}.</span></div>` : ''}`;

  const actions = [];
  if (g.roomId) {
    if (g.request) actions.push({ label: `${SERVICES[g.request.kind].icon} Servir`, cls: 'primary', run: () => { if (act(fulfillRequest, g.id).ok) openGuest(g.id); } });
    const free = freeStaff(state)[0];
    if (!g.cared && g.nightsLeft > 0) {
      actions.push({
        label: `${icon('heart')} Chouchouter ${cur(careCost())}`, disabled: !free || staffInRoom(state, room.id),
        run: () => { if (act(assignStaff, free.id, room.id).ok) openGuest(g.id); },
      });
    }
    const gifts = ITEM_IDS.filter((i) => ITEMS[i].kind === 'gift' && state.inventory[i] > 0);
    if (!hasAnyBonus(g) && gifts.length) {
      actions.push({ label: `${icon('gift')} Offrir ${ITEMS[gifts.at(-1)].name.toLowerCase()}`, run: () => { if (act(useItem, gifts.at(-1), room.id).ok) openGuest(g.id); } });
    }
    actions.push({ label: `${icon('move')} Déménager`, disabled: g.nightsLeft <= 0, run: () => { selection = { mode: 'move', guestId: g.id }; closeSheet(); render(); } });
  } else {
    actions.push({ label: `${icon('bed')} Installer`, cls: 'primary', run: () => { selection = { mode: 'place', guestId: g.id }; closeSheet(); render(); } });
  }

  openSheet({
    cls: 'guest-sheet',
    hero: `<div class="hero-card type-${g.type}" style="--c:${t.color};--d:${t.dark}">
      <div class="hero-creature">${creatureSVG(g, mood)}</div>
      <div class="hero-meta"><span class="type-chip">${t.icon} ${t.name}</span>${room ? `<span class="type-chip ghost">Chambre ${roomLabel(room)}</span>` : '<span class="type-chip ghost">En attente</span>'}</div>
    </div>`,
    kicker: g.star ? '★ Star' : g.parcel ? `🥚 Œuf de ${esc(g.parcel.from)}` : 'Client',
    title: esc(g.name),
    body: `${g.roomId ? satGauge(sat.value) : ''}
      ${g.roomId ? `<h3>Ses voisins</h3>${neighborhoodHTML(state, g, sat)}<h3>Ce qui va / ce qui ne va pas</h3>${linesHTML(sat.lines)}` : ''}
      <h3>Conseils</h3>${adviceHTML(adviceFor(state, g))}
      ${room ? equipSectionHTML(room, true) : ''}
      <h3>Profil</h3>${facts}`,
    actions,
  });
  if (room) onSheetClick(equipHandlers(room, () => openGuest(g.id)));
}

// --- Équipements d'une chambre (libre ou occupée) ------------------------------
function equipSectionHTML(room, occupied) {
  const equipBlock = room.equip.length
    ? room.equip.map((id) => `<div class="equip-row">${itemSVG(id)}<div><b>${ITEMS[id].name}</b><small>${ITEMS[id].desc}</small></div>
        <button class="btn small danger ghost" data-do="destroy" data-arg="${id}">${icon('trash')}Détruire</button></div>`).join('')
    : '<p class="muted">Aucun équipement.</p>';
  const usable = ITEM_IDS.filter((i) => state.inventory[i] > 0 && ((ITEMS[i].kind === 'equip' && !room.equip.includes(i) && room.equip.length < 2)
    || (ITEMS[i].kind === 'repair' && room.damage && !occupied)));
  const inv = usable.length
    ? `<div class="inv-grid">${usable.map((i) => `<button class="inv-tile" data-do="use" data-arg="${i}">${itemSVG(i)}<span>${ITEMS[i].name}</span><em>×${state.inventory[i]}</em></button>`).join('')}</div>`
    : `<p class="muted">${room.equip.length >= 2 ? 'Chambre pleine (2 équipements maximum).' : 'Rien d\'installable dans votre réserve. Passez à la boutique !'}</p>`;
  return `<h3>Équipements (${room.equip.length}/2)</h3>${equipBlock}
    <p class="muted">Un équipement installé ne se déplace pas : on ne peut que le détruire.</p>
    <h3>Installer depuis la réserve</h3>${inv}`;
}

function equipHandlers(room, reopen) {
  return {
    destroy: (id) => confirmSheet(`Détruire : ${esc(ITEMS[id].name)} ?`, 'L\'équipement sera définitivement perdu (il ne retourne pas dans la réserve).', () => { act(removeEquip, room.id, id); reopen(); }),
    use: (id) => { if (act(useItem, id, room.id).ok) reopen(); },
  };
}

// --- Chambre libre -----------------------------------------------------------
function openRoom(room) {
  const staff = staffInRoom(state, room.id);
  const free = freeStaff(state)[0];
  const upCost = CONFIG.roomUpgradeCost[room.level + 1];

  const actions = [];
  if (room.damage && !staff) actions.push({ label: `${icon('wrench')} Envoyer ${free ? free.name : 'un employé'} ${cur(repairStepCost(room))}/pt`, cls: 'primary', disabled: !free, run: () => { if (act(assignStaff, free.id, room.id).ok) closeSheet(); } });
  if (staff) actions.push({ label: `Rappeler ${staff.name}`, run: () => { act(recallStaff, staff.id); openRoom(room); } });
  if (upCost) actions.push({ label: `${icon('up')} Niveau ${room.level + 1} ${cur(upCost)}`, disabled: state.money < upCost || room.damage > 0, run: () => { if (act(upgradeRoom, room.id).ok) openRoom(room); } });
  if (!replaceBlocker(state, room, now())) actions.push({ label: `${icon('build')} Remplacer…`, run: () => openBuild(room) });
  actions.push({ label: `${icon('trash')} Démolir`, cls: 'danger ghost', run: () => confirmSheet('Démolir cette chambre ?', 'L\'emplacement redeviendra libre. Les équipements installés seront perdus.', () => act(demolishRoom, room.id)) });

  openSheet({
    hero: `<div class="hero-room">${roomSVG(room, { glow: 'off' })}</div>`,
    kicker: `Chambre ${roomLabel(room)} · niveau ${room.level}`,
    title: room.damage ? `Chambre abîmée (${room.damage}/${CONFIG.maxDamage})` : 'Chambre libre',
    body: `${staff ? `<div class="trait-card"><b>${icon('wrench')} ${staff.name} répare</b><span>Prochain point vers ${clock(staff.task.end)}.</span></div>` : ''}
      <div class="info-row"><span>Gain maximal par nuit (client à 10/10)</span>${cur(nightGain(10, room))}</div>
      <h3>Ambiance de la chambre</h3>${ambianceHTML(state, room)}
      ${equipSectionHTML(room, false)}`,
    actions,
  });
  onSheetClick(equipHandlers(room, () => openRoom(room)));
}

// --- Salle de service / d'ambiance ---------------------------------------------
function openFacility(room) {
  if (room.kind === 'lab') return openLabRoom(room);
  const b = BUILDABLES[room.sub];
  const t = now();
  let body = `<p>${esc(b.desc)}</p>`;
  if (b.kind === 'service') {
    const busy = room.busyUntil > t;
    body += `<div class="info-row"><span>État</span><b>${busy ? `Occupée jusqu'à ${clock(room.busyUntil)}` : 'Disponible'}</b></div>
      <p class="muted">Quand un client affiche une bulle ${SERVICES[b.service].icon}, touchez-la pour le servir.</p>`;
  } else {
    const fans = Object.values(state.guests).filter((g) => g.roomId && g.likes.includes(b.aura));
    body += `<div class="info-row"><span>Gain par visite (le client y reste 2 à 3 h, puis la salle ferme 5 h)</span>${cur(CONFIG.leisure.gain)}</div>
      <div class="info-row"><span>Clients qui aiment : ${AURAS[b.aura].name}</span><b>${fans.length}</b></div>
      <p class="muted">Une salle de loisir ne dérange pas les chambres voisines.</p>`;
  }
  openSheet({
    hero: `<div class="hero-room">${roomSVG(room, { busy: room.busyUntil > t })}</div>`,
    kicker: b.kind === 'service' ? 'Salle de service' : 'Salle de loisir',
    title: b.name,
    body,
    actions: [
      ...(!replaceBlocker(state, room, now()) ? [{ label: `${icon('build')} Remplacer…`, run: () => openBuild(room) }] : []),
      { label: `${icon('trash')} Démolir`, cls: 'danger ghost', run: () => confirmSheet(`Démolir : ${b.name} ?`, 'L\'emplacement redeviendra libre (aucun remboursement).', () => act(demolishRoom, room.id)) }],
  });
}

// --- Missions --------------------------------------------------------------------
function rewardHTML(r) {
  if (r.money) return `<span class="rw">${icon('coin')}${r.money}</span>`;
  if (r.fame) return `<span class="rw">${icon('star')}${r.fame}</span>`;
  if (r.research) return `<span class="rw">${factorIcon({ kind: 'research' })}1 recherche</span>`;
  if (r.client) return `<span class="rw">${icon('users')}1 client</span>`;
  if (r.item) return `<span class="rw">${itemSVG(r.item, 'rw-item')}${esc(ITEMS[r.item].name)}</span>`;
  return `<span class="rw">${icon('gift')}Objet surprise</span>`;
}

function renderQuest() {
  const el = $('#quest');
  const q = state.quest;
  if (!q) { el.hidden = true; return; }
  const tpl = QUESTS[q.id];
  const key = `${q.id}|${q.done.join()}`;
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  const n = q.done.filter(Boolean).length;
  el.hidden = false;
  el.innerHTML = `<span class="q-ico">${factorIcon({ kind: 'quest' })}</span>
    <span class="q-text"><small>${tpl.repeat ? 'Mission répétable' : `Mission ${q.id + 1}`}</small><span>${esc(tpl.text)}</span></span>
    <span class="q-prog"><b>${n}/${q.done.length}</b><span class="q-dots">${q.done.map((d) => `<i class="${d ? 'on' : ''}"></i>`).join('')}</span></span>`;
}

function openQuest() {
  const q = state.quest;
  const tpl = QUESTS[q.id];
  openSheet({
    kicker: tpl.repeat ? 'Mission répétable' : `Mission ${q.id + 1} / ${QUESTS.filter((x) => !x.repeat).length}`,
    title: 'Mission en cours',
    body: `<div class="quest-text">${esc(tpl.text)}</div>
      <h3>Objectifs</h3>
      <ul class="goals">${tpl.goals.map((g, i) => `<li class="${q.done[i] ? 'done' : ''}"><span class="gchk">${q.done[i] ? icon('check') : ''}</span>${esc(GOAL_LABELS[g])}</li>`).join('')}</ul>
      <h3>Récompense</h3><div class="rewards">${tpl.rewards.length ? tpl.rewards.map(rewardHTML).join('') : '<span class="muted">Aucune (mais la suite en vaut la peine !)</span>'}</div>
      <p class="muted">${state.questsDone} mission(s) accomplie(s) au total.</p>`,
    actions: [{ label: 'Compris !', cls: 'primary', run: closeSheet },
      ...(questTarget() ? [{ label: `${icon('right')} Me montrer`, run: () => { closeSheet(); showPointer(true); } }] : [])],
  });
}

function openQuestDone(n) {
  openSheet({
    cls: 'quest-done',
    hero: `<div class="qd-hero">${factorIcon({ kind: 'quest' })}<span>Mission accomplie !</span></div>`,
    title: 'Bravo, directeur !',
    body: `<div class="quest-text done">${esc(n.text)}</div>
      ${n.rewards.length ? `<h3>Vous recevez</h3><div class="rewards">${n.rewards.map((r) => `<span class="rw">${icon('gift')}${esc(r)}</span>`).join('')}</div>` : ''}
      <h3>Mission suivante</h3><div class="quest-text">${esc(QUESTS[state.quest.id].text)}</div>`,
    actions: [{ label: 'Super !', cls: 'primary', run: closeSheet }],
  });
}

/** Niveau supérieur : la taxe a été payée. */
function openLevelUp(n) {
  const rooms = Object.values(BUILDABLES).filter((b) => b.level === n.level).map((b) => b.name);
  const types = Object.values(TYPES).filter((t) => t.unlock === n.level);
  const svc = Object.entries(CONFIG.serviceUnlock).filter(([, l]) => l === n.level).map(([k]) => SERVICES[k].name);
  openSheet({
    cls: 'quest-done',
    hero: `<div class="qd-hero">${icon('level')}<span>Niveau ${n.level} !</span></div>`,
    title: 'Le Consortium est satisfait',
    body: `<p>La taxe${n.amount ? ` (${cur(n.amount)})` : ''} est payée : votre hôtel monte au <b>niveau ${n.level}</b>.</p>
      <div class="rewards"><span class="rw">${icon('star')}+${n.fame} prestige</span><span class="rw">${icon('gem')}+${n.gems} ${GEMS_NAME.toLowerCase()}</span></div>
      ${types.length ? `<h3>Nouveaux clients</h3><div class="type-list">${types.map((t) => `<div class="type-row" style="--c:${t.color}"><div class="type-mini">${creatureSVG({ type: t.id, look: 4 }, 'good')}</div><div><b>${t.name}</b><small><i>${esc(t.trait.name)}</i> : ${esc(t.trait.desc)}</small></div></div>`).join('')}</div>` : ''}
      ${rooms.length ? `<h3>Nouvelles pièces</h3><p>${rooms.map(esc).join(' · ')}</p>` : ''}
      ${svc.length ? `<h3>Nouvelles demandes</h3><p>${svc.map(esc).join(' · ')}</p>` : ''}`,
    actions: [{ label: 'En avant !', cls: 'primary', run: closeSheet }],
  });
}

/** Récap de minuit : ce que chaque client a payé. */
function openNightRecap(n) {
  const day = new Date(n.t - 3600000).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const rows = [...n.lines].sort((a, b) => b.pay - a.pay).map((l) => `<div class="recap-row">
      <span class="recap-av">${creatureSVG({ type: l.type, look: l.look ?? 3, star: l.star }, moodOf(l.sat))}</span>
      <span class="recap-name"><b>${esc(l.name)}</b><small>${TYPES[l.type].name}</small></span>
      <span class="mood-badge mood-${moodOf(l.sat)}">${faceIcon(l.sat)}<b>${l.sat}</b></span>
      <span class="recap-pay ${l.pay ? '' : 'neg'}">${l.pay ? cur(l.pay) : 'rien'}</span></div>`).join('');
  openSheet({
    cls: 'quest-done recap',
    hero: `<div class="qd-hero night">${icon('moon')}<span>Nuit du ${esc(day)}</span></div>`,
    title: n.lines.length ? `+${n.total.toLocaleString('fr-FR')} 🪙 cette nuit` : 'Une nuit bien calme',
    body: `${n.lines.length ? `<div class="recap-list">${rows}</div>` : '<p class="muted">Aucun client n’a dormi à l’hôtel cette nuit.</p>'}
      ${n.queueLeft ? `<p class="neg">${n.queueLeft} client${n.queueLeft > 1 ? 's' : ''} de la file d'attente ${n.queueLeft > 1 ? 'sont repartis' : 'est reparti'} faute de chambre.</p>` : ''}
      <p class="muted">Chaque client paiera encore la même somme à son départ, à 10h.</p>`,
    actions: [{ label: 'Bonne journée !', cls: 'primary', run: closeSheet }],
  });
}

/** Récap de semaine : taxe impayée ou Consortium absent. */
function openTaxRecap(n) {
  openSheet({
    cls: 'quest-done recap',
    hero: `<div class="qd-hero">${icon('desk')}<span>Le Consortium</span></div>`,
    title: n.skipped ? 'Pas de taxe cette semaine' : 'Taxe impayée',
    body: `${n.skipped ? '<p>Votre hôtel n’a accueilli personne de la semaine : l’inspecteur n’est même pas passé. Pas de taxe… et pas de niveau.</p>'
      : `<p>Il fallait <b>${cur(n.amount)}</b> pour payer la taxe du niveau ${n.level} : il vous manquait ${cur(n.missing)}. L'hôtel reste au niveau ${n.level}.</p>`}
      ${n.subsidy ? `<div class="rewards"><span class="rw">${icon('coin')}+${n.subsidy} : le Consortium renfloue votre caisse</span></div>` : ''}
      <p class="muted">Prochaine taxe dans la nuit de dimanche à lundi.</p>`,
    actions: [{ label: 'Compris', cls: 'primary', run: closeSheet }],
  });
}

/** Retour après une longue absence. */
function openWelcome(n) {
  openSheet({
    cls: 'quest-done',
    hero: `<div class="qd-hero">${icon('desk')}<span>Bon retour !</span></div>`,
    title: 'Vous nous avez manqué',
    body: `<p>${esc(n.text)}</p>`,
    actions: [{ label: 'Au travail !', cls: 'primary', run: closeSheet }],
  });
}

// --- Laboratoire -----------------------------------------------------------------
function openLabRoom(room) {
  const t = now();
  const r = state.research;
  const busy = (room.busyUntil || 0) > t;
  const candidates = [...state.queue.map((id) => state.guests[id]), ...Object.values(state.guests).filter((g) => g.roomId)];
  const list = candidates.map((g) => `<div class="study-row">
      <span class="study-av">${creatureSVG(g, 'mid')}</span>
      <span class="study-info"><b>${esc(g.name)}</b><small>${g.roomId ? `Chambre ${roomLabel(state.rooms[g.roomId])}` : 'File d\'attente'} · ${TYPES[g.type].name}${g.type === 'roche' ? ' (vaut 2 études)' : ''}</small></span>
      <button class="btn small" data-do="study" data-arg="${g.id}" ${busy ? 'disabled' : ''}>${factorIcon({ kind: 'research' })}Étudier</button>
    </div>`).join('');
  openSheet({
    hero: `<div class="hero-room">${roomSVG(room, { busy })}</div>`,
    kicker: 'Laboratoire',
    title: 'Études monstrueuses',
    body: `<p>Un client étudié <b>part sans payer</b> et fait progresser la recherche. <b>${CONFIG.lab.needed} études = 1 point de recherche</b>, à dépenser dans l'arbre de talents. Les autres clients s'en inquiètent (−1 chacun).</p>
      <div class="lab-progress"><span>Recherche en cours</span><div class="progress"><i style="width:${(r.progress / CONFIG.lab.needed) * 100}%"></i></div><b>${r.progress}/${CONFIG.lab.needed}</b></div>
      <div class="info-row"><span>Points de recherche disponibles</span><b>${r.points}</b></div>
      <div class="info-row"><span>État</span><b>${busy ? `Analyse en cours jusqu'à ${clock(room.busyUntil)}` : 'Prêt'}</b></div>
      <h3>Choisir un volontaire</h3>${list || '<p class="muted">Aucun client à étudier pour l\'instant.</p>'}`,
    actions: [{ label: `${factorIcon({ kind: 'research' })} Arbre de talents`, cls: 'primary', run: () => openLab() },
      { label: `${icon('trash')} Démolir`, cls: 'danger ghost', run: () => confirmSheet('Démolir le laboratoire ?', 'L\'emplacement redeviendra libre.', () => act(demolishRoom, room.id)) }],
  });
  onSheetClick({
    study: (id) => {
      const g = state.guests[id];
      confirmSheet(`Étudier ${esc(g.name)} ?`, `${esc(g.name)} quittera l'hôtel sans payer, et les clients installés perdront 1 point de satisfaction (sauf avec la Cellule capitonnée).`, () => {
        if (act(studyGuest, id, room.id).ok) toast(`${g.name} a rejoint la science. Recherche : ${state.research.progress}/${CONFIG.lab.needed}.`, 'good');
      });
    },
  });
}

function openLab() {
  const r = state.research;
  const spent = spentPoints(state);
  const rows = TALENT_ROWS.map((row, i) => {
    const unlocked = rowUnlocked(state, i);
    return `<div class="tal-row ${unlocked ? '' : 'locked'}">
      <div class="tal-row-head">${unlocked ? `Rangée ${i + 1}` : `${icon('lock')} Rangée ${i + 1} — dépensez ${i * TALENT_ROW_STEP} points pour la débloquer`}</div>
      <div class="tal-grid">${row.map((id) => {
        const tdef = TALENTS[id];
        const lvl = talent(state, id);
        const can = unlocked && r.points > 0 && lvl < tdef.max;
        return `<button class="tal ${lvl ? 'has' : ''} ${lvl >= tdef.max ? 'max' : ''}" data-do="spend" data-arg="${id}" ${can ? '' : 'disabled'}>
          <b>${esc(tdef.name)}</b><span class="tal-pips">${Array.from({ length: tdef.max }, (_, k) => `<i class="${k < lvl ? 'on' : ''}"></i>`).join('')}</span>
          <small>${esc(tdef.desc)}</small></button>`;
      }).join('')}</div></div>`;
  }).join('');
  openSheet({
    cls: 'tall',
    kicker: 'Laboratoire',
    title: 'Arbre de talents',
    body: `<div class="lab-head"><div><b>${r.points}</b><small>point(s) à dépenser</small></div><div><b>${spent}/${treeMax(state)}</b><small>points utilisés</small></div><div><b>${r.progress}/${CONFIG.lab.needed}</b><small>études en cours</small></div></div>
      <p class="muted">Gagnez des points de recherche grâce aux missions et en construisant un Laboratoire (niveau 2).</p>${rows}`,
    actions: [{ label: `Réinitialiser ${gem(CONFIG.gems.resetTalents)}`, cls: 'ghost', disabled: !spent || state.gems < CONFIG.gems.resetTalents, run: () => confirmSheet('Réinitialiser les talents ?', `Tous vos points vous seront rendus contre ${CONFIG.gems.resetTalents} ${GEMS_NAME.toLowerCase()}.`, () => { act(resetTalents); openLab(); }) }],
  });
  onSheetClick({ spend: (id) => { if (act(spendTalent, id).ok) { const y = $('#sheet .sheet-body').scrollTop; openLab(); $('#sheet .sheet-body').scrollTop = y; } } });
}

// --- Construction ------------------------------------------------------------
function openBuild(room) {
  const replacing = room.kind !== 'empty';
  const cards = Object.values(BUILDABLES).filter((b) => !(b.id === 'bedroom' && room.floor === 0) && b.id !== room.sub).map((b) => {
    const err = canBuild(state, b.id);
    const locked = state.hotel.level < b.level;
    const fake = { ...room, kind: b.kind, sub: b.id, buildEnd: null, damage: 0, equip: [], leftItem: null, level: 1 };
    return `<button class="build-card ${locked ? 'locked' : ''}" data-do="build" data-arg="${b.id}" ${err ? 'disabled' : ''}>
      <div class="build-thumb">${roomSVG(fake, { glow: 'good' })}${locked ? `<span class="lock">${icon('lock')}Niv. ${b.level}</span>` : ''}</div>
      <div class="build-info"><b>${b.name}</b><small>${esc(b.desc)}</small>
        <span class="build-meta">${cur(buildCost(state, b.id))}<span>${icon('clock')}${b.minutes} min</span></span>
        ${err && !locked ? `<em class="neg">${esc(err)}</em>` : ''}</div>
    </button>`;
  }).join('');
  openSheet({
    kicker: `Emplacement ${roomLabel(room)}${room.floor === 0 ? ' · rez-de-chaussée' : ''}`,
    title: replacing ? 'Remplacer cette pièce ?' : 'Que construire ici ?',
    body: `${replacing ? `<p class="neg">La pièce actuelle sera démolie : son niveau et ses équipements seront perdus.</p>` : ''}
      ${room.floor === 0 && !replacing ? '<p class="muted">Pas de chambre au rez-de-chaussée : on y installe les salles.</p>' : ''}
      <div class="build-list">${cards}</div>`,
  });
  onSheetClick({ build: (what) => {
    if (!replacing) { if (act(buildRoom, room.id, what).ok) closeSheet(); return; }
    confirmSheet(`Remplacer par : ${BUILDABLES[what].name} ?`, 'L\'ancienne pièce est démolie (niveau et équipements perdus).', () => act(buildRoom, room.id, what));
  } });
}

// --- Réception -----------------------------------------------------------------
function openLobby() {
  const cap = lobbyCapacity(state);
  const n = lobbyStaffCount(state);
  const next = CONFIG.lobbyUpgradeCost[state.hotel.lobbyLevel + 1];
  const free = freeStaff(state)[0];
  openSheet({
    hero: `<div class="hero-room lobby-hero">${lobbyCellSVG()}</div>`,
    kicker: `Niveau ${state.hotel.lobbyLevel}`,
    title: 'Réception',
    body: `<p>Délai entre deux clients selon le nombre d'employés à la réception : ${CONFIG.arrivalHoursByStaff.map((h, i) => `<b>${i}</b> → ${h >= 1 ? `${h} h` : `${Math.round(h * 60)} min`}`).join(' · ')}.</p>
      <div class="info-row"><span>Employés à la réception</span><b>${n} / ${cap}</b></div>
      <div class="info-row"><span>Prochain client</span><b>${state.nextArrival ? `vers ${clock(state.nextArrival)}` : '—'}</b></div>`,
    actions: [
      { label: `${icon('staff')} Placer ${free ? free.name : 'un employé'}`, cls: 'primary', disabled: !free || n >= cap, run: () => { if (act(assignStaff, free.id, 'lobby').ok) openLobby(); } },
      ...(next ? [{ label: `${icon('up')} Agrandir la réception ${cur(next)}`, disabled: state.money < next, run: () => { if (act(upgradeLobby).ok) openLobby(); } }] : []),
      { label: `${icon('bell')} Attirer un client ${gem(CONFIG.gems.attract)}`, disabled: state.gems < CONFIG.gems.attract || state.queue.length >= CONFIG.queueMax, run: () => { if (act(attractGuest).ok) openLobby(); } },
    ],
  });
}

// --- Personnel -----------------------------------------------------------------
function staffStatus(s) {
  if (!s.task) return { label: 'Libre', cls: 'free' };
  if (s.task.kind === 'lobby') return { label: 'À la réception', cls: 'at-lobby' };
  const room = state.rooms[s.task.roomId];
  if (s.task.kind === 'repair') return { label: `Répare la ${roomLabel(room)} · ${clock(s.task.end)}`, cls: 'repair' };
  const g = state.guests[s.task.guestId];
  return { label: `Chouchoute ${g ? g.name : '?'} · ${clock(s.task.end)}`, cls: 'care' };
}

function openStaff() {
  const t = now();
  const cost = staffCost(state);
  const occ = occupancy(state);
  const inLobby = lobbyStaffCount(state);
  const cap = lobbyCapacity(state);
  // Ce qui attend un employé, pour savoir tout de suite où l'envoyer.
  const damaged = Object.values(state.rooms).filter((r) => r.kind === 'bedroom' && r.damage > 0 && !occ[r.id] && !staffInRoom(state, r.id)).length;
  const toCare = Object.values(occ).filter((g) => !g.cared && g.nightsLeft > 0 && !staffInRoom(state, g.roomId)).length;
  const job = (ico, name, text, todo) => `<div class="job-card"><span class="job-ico">${ico}</span><div><b>${name}</b><small>${text}</small>${todo ? `<em>${todo}</em>` : ''}</div></div>`;
  const list = state.staff.map((s) => {
    const st = staffStatus(s);
    const left = s.task && s.task.end ? `<i class="staff-left">encore ${fmtDuration(Math.max(0, s.task.end - t))}</i>` : '';
    return `<div class="staff-card">
      <div class="staff-portrait">${staffSVG(s, s.task && s.task.kind)}</div>
      <div class="staff-info"><button class="staff-name" data-do="rename" data-arg="${s.id}" aria-label="Renommer ${esc(s.name)}"><b>${esc(s.name)}</b>${icon('build')}</button>
        <span class="status-dot ${st.cls}">${st.label}</span>${left}</div>
      <div class="staff-btns">${s.task
        ? `<button class="btn small ghost" data-do="recall" data-arg="${s.id}">Rappeler</button>`
        : `<button class="btn small" data-do="lobby" data-arg="${s.id}" ${inLobby >= cap ? 'disabled' : ''}>${icon('bell')} Accueil</button>
           <button class="btn small primary" data-do="assign" data-arg="${s.id}">Affecter…</button>`}</div>
    </div>`;
  }).join('');
  openSheet({
    cls: 'tall',
    kicker: `${state.staff.length} employé${state.staff.length > 1 ? 's' : ''} · ${freeStaff(state).length} libre${freeStaff(state).length > 1 ? 's' : ''}`,
    title: 'Le personnel',
    body: `<div class="job-grid">
        ${job(icon('bell'), 'Accueil', `Les clients arrivent plus vite. Places : ${inLobby} / ${cap}.`, '')}
        ${job(icon('wrench'), 'Réparation', `Remet en état une chambre libre abîmée (${cur(repairStepCost({ level: 1 }, state))} par dégât).`, damaged ? `${damaged} chambre${damaged > 1 ? 's' : ''} à réparer` : '')}
        ${job(icon('heart'), 'Petites attentions', `Chouchoute un client quelques heures : sa satisfaction monte (${cur(careCost(state))}).`, toCare ? `${toCare} client${toCare > 1 ? 's' : ''} à chouchouter` : '')}
      </div>
      <p class="muted">« Affecter… » puis touchez la réception, une chambre abîmée ou un client. Touchez un nom pour le changer.</p>
      ${state.staff.length ? `<div class="staff-list">${list}</div>` : '<p class="muted">Personne pour l’instant : recrutez votre premier employé !</p>'}`,
    actions: [staffPaidInGems(state)
      ? { label: `${icon('users')} Recruter ${gem(cost)}`, cls: 'primary', disabled: state.gems < cost, run: () => { if (act(hireStaff).ok) openStaff(); } }
      : { label: `${icon('users')} Recruter ${cur(cost)}`, cls: 'primary', disabled: state.money < cost, run: () => { if (act(hireStaff).ok) openStaff(); } }],
  });
  onSheetClick({
    assign: (id) => { selection = { mode: 'staff', staffId: id }; closeSheet(); render(); },
    lobby: (id) => { if (act(assignStaff, id, 'lobby').ok) openStaff(); },
    recall: (id) => { act(recallStaff, id); openStaff(); },
    rename: (id) => openStaffRename(id),
  });
}

function openStaffRename(id) {
  const s = state.staff.find((x) => x.id === id);
  if (!s) return;
  openSheet({
    title: 'Nom de l’employé',
    body: `<label class="field"><span>Nouveau nom</span><input id="staff-name-input" maxlength="20" value="${esc(s.name)}"></label>`,
    actions: [{ label: 'Renommer', cls: 'primary', run: () => { if (act(renameStaff, id, $('#staff-name-input').value).ok) openStaff(); } },
      { label: 'Annuler', cls: 'ghost', run: openStaff }],
  });
  setTimeout(() => $('#staff-name-input')?.select(), 60);
}

// --- Boutique ----------------------------------------------------------------------
// (La réserve se consulte et s'utilise depuis la barre du haut : Base, Déco, Spéciaux, Mobilier.)
function openShop() {
  const kinds = [['base', 'Aménagements de base'], ['deco', 'Décoration'], ['special', 'Aménagements spéciaux']];
  const shop = `<p class="muted gem-note">${GEMS} Les articles se paient en ${GEMS_NAME.toLowerCase()} : on en gagne avec les missions (5, et 10 à la fin du tutoriel), les clients comblés (1, une Star 2 à 5) et la taxe (10 × niveau). Vos achats vont dans la réserve, en haut de l’écran.</p>`
    + kinds.map(([k, label]) => `<h3>${label}</h3><div class="shop-grid">${ITEM_IDS.filter((i) => ITEMS[i].shop === k).map((i) => {
    const it = ITEMS[i];
    const auras = it.auras && it.auras.length ? `<span class="aura-chips">${it.auras.map((a) => `<i style="--c:${AURAS[a].color}">${auraIcon(a)}</i>`).join('')}</span>` : '';
    return `<div class="shop-card"><div class="shop-art">${itemSVG(i)}${auras}</div><b>${it.name}</b><small>${esc(it.desc)}</small>
      <button class="btn small primary" data-do="buy" data-arg="${i}" ${state.gems < it.price ? 'disabled' : ''}>${gem(it.price)}</button>
      ${state.inventory[i] ? `<em class="owned">×${state.inventory[i]}</em>` : ''}</div>`;
  }).join('')}${PACKS[k] ? `<div class="shop-card pack"><div class="shop-art">${icon('gift')}</div><b>${PACKS[k].name}</b><small>Un exemplaire de chaque article du rayon.</small>
      <button class="btn small primary" data-do="pack" data-arg="${k}" ${state.gems < PACKS[k].price ? 'disabled' : ''}>${gem(PACKS[k].price)}</button></div>` : ''}</div>`).join('');

  openSheet({
    cls: 'tall',
    kicker: `Vous avez ${(state.gems || 0).toLocaleString('fr-FR')} ${GEMS} · ${state.money.toLocaleString('fr-FR')} ${CURRENCY}`,
    title: 'Boutique',
    body: shop,
  });
  const keepScroll = (fn) => { const y = $('#sheet .sheet-body').scrollTop; fn(); $('#sheet .sheet-body').scrollTop = y; };
  onSheetClick({
    buy: (id) => { if (act(buyItem, id).ok) { toast(`${ITEMS[id].name} ajouté à la réserve.`, 'good'); keepScroll(openShop); } },
    pack: (id) => { if (act(buyPack, id).ok) { toast(`${PACKS[id].name} : articles ajoutés à la réserve.`, 'good'); keepScroll(openShop); } },
  });
}

// --- Bureau (niveau, taxe, agrandissement, stats) --------------------------------
// Position de défilement du Bureau, gardée quand on y revient après un réglage
// (nom de l'hôtel, gérant, néon, sons…) au lieu de remonter tout en haut.
let officeY = 0;
const rememberOffice = () => { officeY = $('#sheet .sheet-body')?.scrollTop || 0; };
const backToOffice = () => openOffice({ keep: true });

function openOffice({ keep = false } = {}) {
  const t = now();
  const h = state.hotel;
  const tax = taxAmount(state);
  const taxAt = nextTaxTime(t);
  const pct = Math.min(100, Math.round((state.money / tax) * 100));
  const ext = extendCost(state);
  const canExtend = extendSlots(state).length > 0;
  const s = state.stats;
  const day = new Date(taxAt - 1).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  openSheet({
    cls: 'tall',
    kicker: `${esc(titled(state, state.manager || 'Gérant'))} · niveau ${h.level} ${levelStars(h.level)}`,
    title: esc(h.name),
    body: `
      <div class="tax-card">
        <div><small>Taxe hebdomadaire</small><b>${cur(tax)}</b><span class="muted">prélevée dans la nuit du ${day} à minuit (dans ${fmtDuration(taxAt - t)})</span></div>
        <div class="progress"><i style="width:${pct}%"></i></div>
        <span class="muted">${state.money >= tax ? 'Vous avez de quoi payer : l\'hôtel montera au niveau ' + (h.level + 1) + ' !' : `Il vous manque ${(tax - state.money).toLocaleString('fr-FR')} ${CURRENCY} pour monter de niveau.`}</span>
      </div>
      <h3>Agrandir l'hôtel</h3>
      <div class="ext-grid">
        <button class="ext-card" data-do="extend" ${!canExtend || state.money < ext ? 'disabled' : ''}>${icon('build')}<b>Ajouter un emplacement</b><small>${h.floors} / ${CONFIG.maxFloors} étages · ${h.cols} / ${CONFIG.maxCols} colonnes</small>${ext ? cur(ext) : '<small>Gratuit</small>'}</button>
      </div>
      <p class="muted">On agrandit case par case : à côté d'une pièce, ou sur le toit au-dessus d'une pièce. Le prix augmente avec la taille de l'hôtel ; au-delà de 9 pièces, chaque emplacement rapporte 1 ⭐.</p>
      ${accountHTML()}
      <a class="set-row privacy-row" href="confidentialite.html" target="_blank" rel="noopener"><small>Vos données</small><b>🔒 Règles de confidentialité</b>${icon('right')}</a>
      <button class="set-row sound-row" data-do="sound"><small>Sons du jeu</small><b>${soundEnabled() ? '🔊 Activés' : '🔇 Coupés'}</b>${icon('right')}</button>
      <button class="set-row sound-row" data-do="vibrate"><small>Vibrations</small><b>${prefs.get('vibrate', true) ? '📳 Activées' : '📴 Coupées'}</b>${icon('right')}</button>
      <button class="set-row sound-row" data-do="reload"><small>Un souci d’affichage ?</small><b>🔄 Recharger le jeu</b>${icon('right')}</button>
      ${restartHTML()}
      <h3>${icon('bell')} Publicité du jour</h3>
      ${h.level < 2 ? `<p class="muted">Les sponsors ne s’intéressent qu’aux hôtels de niveau 2 et plus : payez votre première taxe !</p>` : `<p class="muted">Chaque jour, de nouveaux sponsors proposent de vous envoyer des clients. Ils arrivent au réveil, à ${CONFIG.wakeUpHour}h.</p>
      <div class="ad-list">${campaignsOf(state, t).map((c) => `<div class="ad-card${c.vip ? ' vip' : ''}${c.bought ? ' bought' : ''}">
        <div class="ad-logo">${c.vip ? icon('star') : icon('users')}</div>
        <div class="ad-info"><b>${esc(c.name)}</b><small>${c.count} ${c.vip ? `Star${c.count > 1 ? 's' : ''}` : 'clients'} livré${c.count > 1 ? 's' : ''} à ${CONFIG.wakeUpHour}h</small></div>
        ${c.bought ? `<span class="ad-done">${icon('check')}Signé</span>` : `<button class="btn small primary" data-do="ad" data-arg="${c.index}" ${state.money < c.cost ? 'disabled' : ''}>${cur(c.cost)}</button>`}
      </div>`).join('')}</div>`}
      ${state.ads?.pending?.length ? `<p class="pos">${icon('clock')} En route : ${state.ads.pending.reduce((n, p) => n + p.count, 0)} client(s) au prochain réveil.</p>` : ''}
      ${settingsHTML()}
      ${achievementsSummaryHTML()}
      ${canRestart(state) ? '' : legacyHTML()}
      <h3>Statistiques</h3>
      <div class="stat-grid">
        <div><b>${s.nights}</b><small>nuits</small></div><div><b>${s.placed}</b><small>clients</small></div>
        <div><b>${s.satisfied}</b><small>satisfaits</small></div><div><b>${s.delighted}</b><small>comblés</small></div>
        <div><b>${s.services}</b><small>services</small></div><div><b>${s.angry}</b><small>furieux</small></div>
        <div><b>${s.stars}</b><small>Stars ravies</small></div><div><b>${s.earned.toLocaleString('fr-FR')}</b><small>gagnés</small></div>
      </div>`,
    actions: [
      { label: `${icon('star')} Succès`, run: openAchievements },
      { label: `${icon('help')} Aide`, run: openHelp },
    ],
  });
  onSheetClick({
    extend: startExtend,
    ad: (i) => { rememberOffice(); if (act(buyCampaign, Number(i)).ok) { toast('Campagne signée !', 'good'); backToOffice(); } },
    restart: (custom) => confirmSheet(custom === '1' ? 'Début personnalisé ?' : 'Recommencer ?',
      `Votre hôtel actuel sera définitivement perdu. ${custom === '1' ? `Vous repartirez avec l’accueil seul et ${CUSTOM_START_MONEY} ${CURRENCY} pour bâtir vous-même vos pièces.` : 'Vous repartirez avec un hôtel neuf de 6 chambres.'} Vos gemmes vous suivent.`, () => resetGame(custom === '1')),
    rename: () => { rememberOffice(); openRename(); },
    manager: () => { rememberOffice(); openManager(); },
    login: openLogin,
    logout: () => confirmSheet('Se déconnecter ?', 'Votre hôtel reste enregistré sur votre compte. Sur cet appareil, vous repartirez d’une partie locale.', () => signOut()),
    sound: () => { rememberOffice(); const on = !soundEnabled(); setSoundEnabled(on); prefs.set('sound', on); if (on) sfx('done', 3); backToOffice(); },
    neon: (i) => { rememberOffice(); if (act(setNeon, Number(i)).ok) backToOffice(); },
    reload: () => location.reload(),
    vibrate: () => { rememberOffice(); const on = !prefs.get('vibrate', true); prefs.set('vibrate', on); if (on) buzz(20); backToOffice(); },
    goals: openAchievements,
    legacy: () => confirmSheet('Léguer votre hôtel ?', `Vous repartirez au niveau ${LEGACY.restartLevel} avec l'accueil seul. Vous gardez votre argent (+${LEGACY.compensation} 🪙), 1 employé et votre réserve ; les chambres, les clients, le mobilier et l'arbre de talents sont perdus. En échange : une étoile, +${LEGACY.fame} ⭐ et 5 points de talents de plus au maximum.`, () => act(bequeathHotel)),
  });
  if (keep) $('#sheet .sheet-body').scrollTop = officeY;
}

/** « Recommencer » : seulement jusqu'à la mission de la première nuit. */
function restartHTML() {
  if (!canRestart(state)) return '';
  return `<h3>${icon('trash')} Recommencer</h3>
    <p class="muted">Un mauvais départ ? Tant que vous n’avez pas passé la première nuit, vous pouvez repartir de zéro.</p>
    <div class="btn-row"><button class="btn small danger ghost" data-do="restart" data-arg="0">Recommencer</button>
    <button class="btn small ghost" data-do="restart" data-arg="1">Début personnalisé</button></div>`;
}

/** Mission « renommer » atteinte : nom de l'hôtel, du gérant, couleur du néon. */
const RENAME_QUEST = QUESTS.findIndex((q) => q.goals.includes('rename'));
function settingsHTML() {
  if (state.questsDone < RENAME_QUEST && state.quest.id < RENAME_QUEST) return '';
  const cur = state.hotel.neon ?? DEFAULT_NEON;
  return `<h3>${icon('build')} Réglages</h3>
    <div class="settings">
      <button class="set-row" data-do="rename"><small>Nom de l’hôtel</small><b>${esc(state.hotel.name)}</b>${icon('right')}</button>
      <button class="set-row" data-do="manager"><small>Gérant</small><b>${esc(titled(state, state.manager || 'Gérant'))}</b>${icon('right')}</button>
      <div class="set-row neon-row"><small>Couleur du néon</small><div class="neon-swatches">${NEON_COLORS.map((c, i) => `<button class="swatch${i === cur ? ' on' : ''}" style="--c:${c}" data-do="neon" data-arg="${i}" aria-label="Néon ${i + 1}"></button>`).join('')}</div></div>
    </div>`;
}

/** Résumé des succès dans le Bureau. */
function achievementsSummaryHTML() {
  const top = ACHIEVEMENT_KEYS.filter((k) => goalCount(state, k) > 0).sort((a, b) => goalCount(state, b) - goalCount(state, a)).slice(0, 4);
  return `<h3>${icon('star')} Succès</h3>
    <button class="goals-card" data-do="goals">
      <span class="goals-points"><b>${totalPoints(state)}</b><small>points</small></span>
      <span class="goals-top">${top.length ? top.map((k) => `<span class="goal-chip">${icon(ACHIEVEMENTS[k].icon)}<b>${goalCount(state, k)}</b></span>`).join('') : '<small class="muted">Vos premiers succès arriveront avec vos premiers clients.</small>'}</span>
      ${icon('right')}
    </button>`;
}

function badgeHTML(r, got) {
  const tone = r.badge ? r.badge.tone : 'title';
  return `<span class="reward ${got ? 'got' : 'locked'} tone-${tone}">${r.badge ? `<span class="reward-ico">${icon(r.badge.icon)}</span>` : '<span class="reward-ico title">«»</span>'}</span>`;
}

function openAchievements() {
  const rows = ACHIEVEMENT_KEYS.map((k) => {
    const a = ACHIEVEMENTS[k];
    const n = goalCount(state, k);
    const next = nextReward(state, k);
    const prev = [...REWARDS].reverse().find((r) => r.goal === k && r.count <= n);
    const from = prev ? prev.count : 0;
    const pct = next ? Math.round(((n - from) / (next.count - from)) * 100) : 100;
    return `<li class="goal-row">
      <span class="goal-ico">${icon(a.icon)}</span>
      <div class="goal-info"><b>${a.name}</b>
        <div class="progress"><i style="width:${pct}%"></i></div>
        <small>${next ? `${n} / ${next.count} · prochain : ${esc(rewardName(next))}` : `${n} · tous les paliers obtenus !`}</small></div>
    </li>`;
  }).join('');
  const titles = REWARDS.map((r, i) => ({ r, i })).filter(({ r }) => r.title);
  const titleBtns = titles.map(({ r, i }) => {
    const got = goalCount(state, r.goal) >= r.count;
    return `<button class="title-pick${state.title === i ? ' on' : ''}" data-do="title" data-arg="${i}" ${got ? '' : 'disabled'} title="${esc(ACHIEVEMENTS[r.goal].name)} ×${r.count}">${got ? '' : icon('lock')}${esc(r.title.name)}</button>`;
  }).join('');
  const badges = REWARDS.filter((r) => r.badge).map((r) => `<div class="badge-cell" title="${esc(ACHIEVEMENTS[r.goal].name)} ×${r.count}">${badgeHTML(r, goalCount(state, r.goal) >= r.count)}<small>×${r.count}</small></div>`).join('');
  openSheet({
    cls: 'tall',
    kicker: `${totalPoints(state)} points de succès`,
    title: 'Succès',
    body: `<p class="muted">Chaque compteur débloque des paliers : un badge ou un titre à afficher à côté de votre nom.</p>
      <ul class="goal-list">${rows}</ul>
      <h3>Titres</h3>
      <p class="muted">Touchez un titre débloqué pour l’afficher : <b>${esc(titled(state, state.manager || 'Gérant'))}</b></p>
      <div class="title-list"><button class="title-pick${state.title == null ? ' on' : ''}" data-do="title" data-arg="">Aucun</button>${titleBtns}</div>
      <h3>Badges</h3>
      <div class="badge-grid">${badges}</div>`,
  });
  onSheetClick({ title: (i) => { if (act(setTitle, i === '' ? null : Number(i)).ok) openAchievements(); } });
}

function openManager() {
  openSheet({
    title: 'Nom du gérant',
    body: `<label class="field"><span>Votre nom (affiché avec votre titre)</span><input id="manager-input" maxlength="24" value="${esc(state.manager || '')}"></label>`,
    actions: [{ label: 'Enregistrer', cls: 'primary', run: () => { if (act(setManager, $('#manager-input').value).ok) backToOffice(); } },
      { label: 'Annuler', cls: 'ghost', run: backToOffice }],
  });
  setTimeout(() => $('#manager-input')?.select(), 60);
}

/** Bloc « Léguer l'hôtel » du Bureau : conditions et bouton. */
function legacyHTML() {
  const st = legacyStatus(state);
  const row = (ok, label, have, need) => `<li class="${ok ? 'done' : ''}"><span class="gchk">${ok ? icon('check') : ''}</span>${label}<b>${have} / ${need}</b></li>`;
  return `<h3>✦ Léguer l'hôtel</h3>
    <p class="muted">Cédez votre hôtel pour en ouvrir un nouveau : vous gagnez une étoile, du prestige et un arbre de talents plus grand.${state.stars ? ` Vous avez déjà ${state.stars} étoile${state.stars > 1 ? 's' : ''}.` : ''}</p>
    <ul class="goals legacy-goals">
      ${row(st.have.level >= st.need.level, 'Niveau de l’hôtel', st.have.level, st.need.level)}
      ${row(st.have.money >= st.need.money, 'Argent en caisse (non dépensé)', st.have.money.toLocaleString('fr-FR'), st.need.money.toLocaleString('fr-FR'))}
      ${row(st.have.rooms >= st.need.rooms, 'Pièces bâties', st.have.rooms, st.need.rooms)}
    </ul>
    <button class="btn ${st.ok ? 'primary' : ''}" data-do="legacy" ${st.ok ? '' : 'disabled'}>✦ Léguer l'hôtel</button>`;
}

function openRename() {
  openSheet({
    title: 'Nom de l\'hôtel',
    body: `<label class="field"><span>Nouveau nom</span><input id="rename-input" maxlength="32" value="${esc(state.hotel.name)}"></label>`,
    actions: [{ label: 'Renommer', cls: 'primary', run: () => { const v = $('#rename-input').value; act(renameHotel, v); backToOffice(); } },
      { label: 'Annuler', cls: 'ghost', run: backToOffice }],
  });
  setTimeout(() => $('#rename-input')?.select(), 60);
}

function confirmSheet(title, text, onYes) {
  openSheet({ title, body: `<p>${text}</p>`, actions: [
    { label: 'Confirmer', cls: 'danger', run: () => { onYes(); closeSheet(); } },
    { label: 'Annuler', cls: 'ghost', run: closeSheet },
  ] });
}

function resetGame(custom = false) {
  if (!act(restartHotel, custom).ok) return;
  prefs.set('lastSeenLog', 0);
  selection = null;
  layoutKey = '';
  openHelp();
}

// --- Journal -------------------------------------------------------------------
function openJournal(title = 'Journal', sinceId = null) {
  const seen = sinceId ?? prefs.get('lastSeenLog', 0);
  let lastDay = '';
  const rows = [...state.log].reverse().map((l) => {
    const d = new Date(l.t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: CONFIG.timeZone });
    const head = d !== lastDay ? `<li class="day">${d}</li>` : '';
    lastDay = d;
    return `${head}<li class="log-${l.kind}${l.id > seen ? ' new' : ''}"><time>${clock(l.t)}</time><span>${esc(l.text)}</span></li>`;
  }).join('');
  prefs.set('lastSeenLog', state.logSeq);
  openSheet({ cls: 'tall', kicker: 'Registre de l\'hôtel', title, body: `<ul class="journal">${rows || '<li>Rien pour l\'instant.</li>'}</ul>` });
  render();
}

// --- Aide ------------------------------------------------------------------------
function openHelp() {
  const chart = TYPE_IDS.map((id) => {
    const t = TYPES[id];
    return `<div class="type-row" style="--c:${t.color}"><div class="type-mini">${creatureSVG({ type: id, look: 3 }, 'good')}</div>
      <div><b>${t.name}</b><small class="type-emit">Dégage ${t.auras.length ? t.auras.map((a) => `${auraIcon(a)} ${AURAS[a].name}`).join(' + ') : 'rien'} · dès le niveau ${t.unlock}</small><small><i>${t.trait.name}</i> : ${esc(t.trait.desc)}</small></div></div>`;
  }).join('');
  openSheet({
    cls: 'tall',
    kicker: 'Guide du directeur',
    title: 'Bienvenue à l\'hôtel !',
    body: `
      <ol class="steps">
        <li><b>Installez les clients</b> qui attendent devant l'hôtel : touchez-en un, puis une chambre. Chaque chambre affiche alors la note sur 10 qu'aurait le client s'il y dormait.</li>
        <li><b>Chaque Pokémon dégage quelque chose</b> selon son type (de la chaleur, de l'humidité, des odeurs, du froid, du bruit…). Ses voisins directs le ressentent : à gauche, à droite, au-dessus et en dessous. Avoir un voisin tient aussi <b>compagnie</b>. On ne ressent jamais ce qu'on dégage soi-même.</li>
        <li><b>Chaque client a 2 goûts</b> : des choses qu'il aime ou qu'il déteste. Il arrive avec une note de 3. Ce qu'il aime lui donne <b>+2 par voisin ou objet qui en apporte</b>, mais <b>−3 s'il n'en a pas du tout</b>. Ce qu'il déteste lui coûte <b>−3 par voisin qui en apporte</b>, mais lui donne <b>+2 s'il n'y en a pas</b>.</li>
        <li><b>Chaque client paie deux fois</b>, selon sa note (jusqu'à 50 🪙 s'il est à 10/10) : à minuit, puis en partant à <b>10h</b>. Le changer de chambre lui fait perdre 2 points (une seule fois). Personne n'arrive entre minuit et ${CONFIG.wakeUpHour}h. Sans employé à la réception, un client arrive toutes les 8 h.</li>
        <li><b>${GEMS} Les ${GEMS_NAME.toLowerCase()}</b> se gagnent en jouant : missions (10 à la fin du tutoriel, puis 5), clients ravis (1, ou 2 à 5 pour une Star), taxe payée (10 × niveau). Elles servent à la Boutique, à recruter au-delà du 4e employé, à « Attirer un client » et à remettre les talents à zéro.</li>
        <li><b>La caisse démarre vide</b> : jusqu'au niveau 3, le Consortium (l'organisme qui prélève la taxe) la remet à 300 🪙 chaque nuit où elle descend sous 100.</li>
        <li><b>Suivez les missions</b> (le parchemin en haut à gauche) : elles vous guident pas à pas et rapportent argent, objets, clients et points de recherche. « Montrez-moi » indique où toucher. Après le tutoriel, d'autres missions rapportent du prestige ⭐.</li>
        <li><b>Le Laboratoire</b> (dès le niveau 2) : on y envoie un client pour l'étudier. Il part sans payer et les autres clients perdent 1 point. Toutes les 5 études, une fiole apparaît : ramassez-la pour gagner 1 point de recherche, à dépenser dans l'onglet Labo.</li>
        <li><b>Imprévus</b> : toutes les 9 à 21 h, il peut se passer quelque chose (bonne surprise, petit tracas, accident, vol, Star démasquée…).</li>
        <li><b>Payez la taxe</b> chaque nuit du dimanche au lundi (seulement si vous avez accueilli quelqu'un dans la semaine) pour monter de niveau : nouveaux types de clients, nouveaux goûts, salles de service et de loisir, séjours plus longs.</li>
      </ol>
      <h3>Lire l'hôtel en un coup d'œil</h3>
      <ul class="legend">
        <li><span class="mood-badge mood-good">${faceIcon(8)}<b>8</b></span> Note du client, de 0 à 10 : vert = content, orange = mitigé, rouge = mécontent.</li>
        <li><span class="fx pos">${dirIcon('up')}${auraIcon('humidite')}<b>+2</b></span> Ce qui lui plaît : la flèche montre le voisin d'où ça vient, l'icône ce qu'il reçoit.</li>
        <li><span class="fx neg">${dirIcon('left')}${auraIcon('chaleur')}<b>-3</b></span> Ce qui le gêne : un voisin lui envoie quelque chose qu'il déteste.</li>
        <li><span class="fx neg missing">${auraIcon('froid')}<b>-3</b></span> En pointillés : il lui MANQUE quelque chose qu'il aime. Donnez-lui un voisin ou un objet qui en apporte.</li>
        <li><span class="request ok static"><span class="req-icon">🍰</span><span class="req-state">${icon('check')}</span></span> Le client demande un service : coche = touchez la bulle pour le servir, horloge = la salle est occupée, cadenas = la salle n'est pas encore construite.</li>
        <li><span class="best static">${icon('star')}Top</span> Pendant que vous installez un client : la meilleure chambre pour lui.</li>
      </ul>
      <h3>Les types</h3><div class="type-list">${chart}</div>`,
    actions: [{ label: 'C\'est parti !', cls: 'primary', run: closeSheet }],
  });
  if (prefs.get('lastSeenLog', 0) === 0) prefs.set('lastSeenLog', Math.max(1, state.logSeq));
}

// -----------------------------------------------------------------------------
// Notifications
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// Menu contextuel : toucher une pièce affiche un petit panneau (infos + actions
// directes) collé à la pièce ; « Détails » ouvre la fenêtre complète.
// -----------------------------------------------------------------------------
let ctxRoom = null;

function closeCtx() {
  const el = $('#ctx');
  if (!el || el.hidden) return;
  el.hidden = true;
  ctxRoom = null;
}

const labReady = (t) => Object.values(state.rooms).find((r) => r.sub === 'labo' && !r.buildEnd && (r.busyUntil || 0) <= t && !r.leftItem);

function ctxContent(room) {
  const t = now();
  const occ = occupancy(state);
  const g = occ[room.id];
  const free = freeStaff(state)[0];
  const staff = staffInRoom(state, room.id);
  const A = [];
  let head;
  if (g) {
    const sat = computeSatisfaction(state, g).value;
    const ty = TYPES[g.type];
    head = `<div class="ctx-head guest" style="--c:${ty.color}">
      <span class="ctx-av">${creatureSVG(g, moodOf(sat))}</span>
      <span class="ctx-id"><b>${esc(g.name)}${g.star ? ` ${icon('star')}` : ''}${g.parcel ? ' 🥚' : ''}</b>
        <small>${ty.name} · ${g.nightsLeft <= 0 ? 'part à 10h' : `${g.nightsLeft} nuit${g.nightsLeft > 1 ? 's' : ''}`}${g.leisure ? ' · en sortie' : ''}</small>
        <span class="ctx-likes">${g.likes.map((a) => `<i class="like" title="Aime">${auraIcon(a)}<b>${AURAS[a].name}</b></i>`).join('')}${g.dislikes.map((a) => `<i class="dislike" title="Déteste">${auraIcon(a)}<b>${AURAS[a].name}</b></i>`).join('')}</span></span>
      ${moodBadge(sat)}</div>${g.leisure ? '' : ctxSummary(computeSatisfaction(state, g))}`;
    if (g.request) A.push({ ico: SERVICES[g.request.kind].icon, raw: true, label: 'Servir', cls: 'primary', run: () => act(fulfillRequest, g.id) });
    if (!g.cared && g.nightsLeft > 0) A.push({ ico: 'heart', label: 'Chouchouter', sub: cur(careCost(state)), disabled: !free || !!staff, why: !free ? 'Aucun employé libre' : '', run: () => act(assignStaff, free.id, room.id) });
    const gift = ITEM_IDS.filter((i) => ITEMS[i].kind === 'gift' && state.inventory[i] > 0).at(-1);
    if (gift && !hasAnyBonus(g)) A.push({ ico: 'gift', label: 'Offrir', sub: esc(ITEMS[gift].name), run: () => act(useItem, gift, room.id) });
    if (g.nightsLeft > 0) A.push({ ico: 'move', label: 'Déménager', run: () => { selection = { mode: 'move', guestId: g.id }; render(); } });
    const lab = labReady(t);
    if (lab) A.push({ ico: 'research', label: 'Étudier', cls: 'danger', run: () => confirmSheet(`Étudier ${esc(g.name)} ?`, `${esc(g.name)} quittera l'hôtel sans payer, et les autres clients perdront 1 point.`, () => act(studyGuest, g.id, lab.id)) });
    A.push({ ico: 'scroll', label: 'Fiche', run: () => openGuest(g.id) });
  } else if (room.kind === 'empty') {
    head = `<div class="ctx-head"><span class="ctx-ico">${icon('build')}</span><span class="ctx-id"><b>Emplacement ${roomLabel(room)}</b><small>${room.floor === 0 ? 'Rez-de-chaussée : salles seulement' : 'Libre'}</small></span></div>`;
    if (room.floor > 0) {
      const err = canBuild(state, 'bedroom');
      A.push({ ico: 'bed', label: 'Chambre', sub: cur(buildCost(state, 'bedroom')), cls: 'primary', disabled: !!err, why: err, run: () => act(buildRoom, room.id, 'bedroom') });
    }
    A.push({ ico: 'build', label: room.floor > 0 ? 'Autre pièce…' : 'Construire…', cls: room.floor > 0 ? '' : 'primary', run: () => openBuild(room) });
  } else if (room.kind === 'bedroom') {
    const up = CONFIG.roomUpgradeCost[room.level + 1];
    head = `<div class="ctx-head"><span class="ctx-ico">${icon('bed')}</span><span class="ctx-id"><b>Chambre ${roomLabel(room)}</b>
      <small>Niveau ${room.level}${room.damage ? ` · abîmée ×${room.damage}` : ' · libre'} · ${room.equip.length}/2 équipements</small></span></div>`;
    if (room.damage && !staff) A.push({ ico: 'wrench', label: 'Réparer', sub: `${cur(repairStepCost(room, state))}/pt`, cls: 'primary', disabled: !free, why: !free ? 'Aucun employé libre' : '', run: () => act(assignStaff, free.id, room.id) });
    if (room.damage && state.inventory.kit > 0) A.push({ ico: 'hammer', label: 'Kit express', run: () => act(useItem, 'kit', room.id) });
    if (staff) A.push({ ico: 'staff', label: `Rappeler ${esc(staff.name)}`, run: () => act(recallStaff, staff.id) });
    if (up && !room.damage) A.push({ ico: 'up', label: `Niveau ${room.level + 1}`, sub: cur(up), disabled: state.money < up, run: () => act(upgradeRoom, room.id) });
    if (room.equip.length < 2) A.push({ ico: 'box', label: 'Équiper', run: () => { tray = 'base'; renderActionBar(); } });
    A.push({ ico: 'scroll', label: 'Détails', run: () => openRoom(room) });
  } else {
    const b = BUILDABLES[room.sub];
    const busy = (room.busyUntil || 0) > t;
    head = `<div class="ctx-head"><span class="ctx-ico">${b.aura ? auraIcon(b.aura) : icon(room.kind === 'lab' ? 'research' : 'service')}</span><span class="ctx-id"><b>${esc(b.name)}</b>
      <small>${busy ? `Occupée jusqu'à ${clock(room.busyUntil)}` : room.kind === 'leisure' ? `+${CONFIG.leisure.gain} ${CURRENCY} par visite` : 'Disponible'}</small></span></div>`;
    if (room.kind === 'lab') A.push({ ico: 'research', label: 'Étudier…', cls: 'primary', run: () => openLabRoom(room) });
    A.push({ ico: 'scroll', label: 'Détails', run: () => openFacility(room) });
  }
  // En visite : on regarde, on ne touche à rien.
  if (visit) A.splice(0, A.length, ...A.filter((a) => a.ico === 'scroll'));
  return { head, actions: A };
}

/** Une ligne qui explique la note : « 3 de base +2 Compagnie −3 sans Chaleur… ». */
function ctxSummary(detail) {
  const base = detail.lines.find((l) => l.kind === 'base');
  const name = (l) => (l.aura ? AURAS[l.aura].name : '');
  const short = (l) => {
    if (l.kind === 'missing') return `sans ${name(l)}`;
    if (l.kind === 'absent') return `pas de ${name(l)}`;
    if (l.kind === 'aura' || l.kind === 'equip') return name(l);
    return l.label;
  };
  // Les effets identiques (deux voisins qui tiennent compagnie…) sont regroupés : « +4 Compagnie ×2 ».
  const groups = new Map();
  for (const l of significant(detail.lines)) {
    const k = `${short(l)}|${l.value > 0}`;
    const g = groups.get(k) || { text: short(l), value: 0, n: 0 };
    g.value += l.value; g.n += 1;
    groups.set(k, g);
  }
  const parts = [...groups.values()].map((g) => `<span class="${g.value > 0 ? 'pos' : 'neg'}"><b>${g.value > 0 ? '+' : '−'}${Math.abs(g.value)}</b> ${esc(g.text)}${g.n > 1 ? ` ×${g.n}` : ''}</span>`);
  return `<p class="ctx-sum"><span><b>${base ? base.value : 0}</b> de base</span>${parts.join('')}</p>`;
}

function openCtx(id) {
  const room = state.rooms[id];
  const anchor = document.querySelector(`[data-room="${id}"]`);
  if (!room || !anchor) return;
  if (ctxRoom === id) { closeCtx(); return; }
  hidePointer();
  ctxRoom = id;
  const { head, actions } = ctxContent(room);
  const el = $('#ctx');
  el.innerHTML = `${head}<div class="ctx-actions">${actions.map((a, i) => `<button class="ctx-btn ${a.cls || ''}" data-ctx="${i}" ${a.disabled ? 'disabled' : ''} ${a.why ? `title="${esc(a.why)}"` : ''}>
      <span class="ctx-btn-ico">${a.raw ? a.ico : icon(a.ico)}</span><span class="ctx-btn-label">${a.label}</span>${a.sub ? `<small>${a.sub}</small>` : ''}</button>`).join('')}</div>`;
  el.hidden = false;
  el._actions = actions;
  placeCtx(anchor);
  guardBack();
}

/** Colle le menu à la pièce (au-dessus si possible, sinon en dessous), sans sortir de l'écran. */
function placeCtx(anchor) {
  const el = $('#ctx');
  const a = anchor.getBoundingClientRect();
  const m = 8;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = a.left + a.width / 2 - w / 2;
  x = Math.max(m, Math.min(vw - w - m, x));
  let y = a.top - h - 10;
  let below = false;
  if (y < m + 60) { y = a.bottom + 10; below = true; }
  if (y + h > vh - m) y = Math.max(m, vh - h - m);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.classList.toggle('below', below);
  el.style.setProperty('--tip-x', `${Math.max(16, Math.min(w - 16, a.left + a.width / 2 - x))}px`);
}

// -----------------------------------------------------------------------------
// Barre d'actions sur la scène : Agrandir, Changer le mobilier, inventaire par
// rayons (on arme un objet, puis on touche la pièce).
// -----------------------------------------------------------------------------
let tray = null;
const EXTEND_QUEST = QUESTS.findIndex((q) => q.goals.includes('extend'));
const BAR_CATS = [['base', 'Base', 'box'], ['deco', 'Déco', 'sparkle'], ['special', 'Spéciaux', 'gift']];
const itemCat = (id) => {
  const it = ITEMS[id];
  if (it.shop) return it.shop;
  if (it.kind === 'deco' || it.kind === 'decobox') return 'deco';
  return it.kind === 'equip' && it.auras.length === 1 ? 'base' : 'special';
};

function renderActionBar() {
  const bar = $('#actionbar');
  if (!bar) return;
  if (tray) guardBack();
  const canExtend = (state.questsDone >= EXTEND_QUEST || state.quest.id >= EXTEND_QUEST) && extendSlots(state).length > 0;
  const furn = (state.furniture || []).length + (state.inventory.randdeco || 0);
  const mode = selection && selection.mode;
  const counts = Object.fromEntries(BAR_CATS.map(([k]) => [k, ITEM_IDS.filter((i) => state.inventory[i] > 0 && itemCat(i) === k).reduce((n, i) => n + state.inventory[i], 0)]));
  const q = state.quest;
  const qDone = q.done.filter(Boolean).length;
  const key = JSON.stringify([canExtend, furn, mode, tray, counts, tray && state.inventory, selection && selection.itemId, q.id, qDone]);
  if (bar.dataset.key === key) return;
  bar.dataset.key = key;
  const btn = (id, ico, label, hint, { on = false, badge = 0, dim = false } = {}) => `<button class="ab-btn${on ? ' on' : ''}${dim ? ' dim' : ''}" data-bar="${id}" data-hint="${esc(hint)}" aria-label="${esc(label)}">
    ${icon(ico)}<span>${label}</span>${badge ? `<em class="badge info">${badge}</em>` : ''}</button>`;
  bar.innerHTML = `<button class="ab-btn mission" data-bar="mission" data-hint="${esc(QUESTS[q.id].text)}" aria-label="Mission en cours">
      ${factorIcon({ kind: 'quest' })}<span>${qDone}/${q.done.length}</span><i class="ab-prog" style="--p:${(qDone / q.done.length) * 100}%"></i></button>
    ${canExtend ? btn('extend', 'build', 'Agrandir', 'Agrandir l’hôtel : touchez ensuite une case en pointillés.', { on: mode === 'extend' }) : ''}
    ${furn ? btn('mobilier', 'sparkle', 'Mobilier', 'Changer le mobilier : déplacer vos meubles, poser ceux de la réserve.', { on: mode === 'deco' }) : ''}
    <span class="ab-sep"></span>
    ${BAR_CATS.map(([k, label, ico]) => btn(k, ico, label, `Réserve : ${label.toLowerCase()}. Touchez un objet, puis la pièce où l’utiliser.`, { on: tray === k, badge: counts[k], dim: !counts[k] })).join('')}`;

  const tr = $('#tray');
  if (!tray) { tr.hidden = true; return; }
  const items = ITEM_IDS.filter((i) => state.inventory[i] > 0 && itemCat(i) === tray);
  tr.hidden = false;
  tr.innerHTML = `<div class="tray-items">${items.map((i) => `<button class="tray-item${selection && selection.itemId === i ? ' on' : ''}" data-tray="${i}" data-hint="${esc(ITEMS[i].name)} : ${esc(ITEMS[i].desc)}">
      ${itemSVG(i)}<em>×${state.inventory[i]}</em></button>`).join('') || `<span class="tray-empty">Rien dans ce rayon.</span>`}
    <button class="tray-item shop" data-tray="@shop" data-hint="Ouvrir la boutique">${icon('shop')}<small>Boutique</small></button></div>
    <button class="icon-btn tray-close" data-tray="@close" aria-label="Fermer">${icon('close')}</button>`;
}

function onBarTap(id) {
  closeCtx();
  hidePointer();
  if (id === 'mission') { openQuest(); return; }
  if (id === 'extend') { selection = selection && selection.mode === 'extend' ? null : { mode: 'extend' }; tray = null; render(); return; }
  if (id === 'mobilier') { selection = selection && selection.mode === 'deco' ? null : { mode: 'deco' }; tray = null; render(); return; }
  tray = tray === id ? null : id;
  if (selection && (selection.mode === 'extend' || selection.mode === 'deco')) selection = null;
  render();
}

function onTrayTap(id) {
  if (id === '@close') { tray = null; renderActionBar(); return; }
  if (id === '@shop') { tray = null; openShop(); return; }
  if (ITEMS[id].kind === 'decobox') {
    const res = act(openDecoBox);
    if (res.ok) { toast(`Dans le carton : ${DECO_FAMILIES[res.piece.type].name} !`, 'good'); selection = { mode: 'deco', decoId: res.piece.id }; tray = null; render(); }
    return;
  }
  selection = selection && selection.itemId === id ? null : { mode: 'item', itemId: id };
  render();
}

// -----------------------------------------------------------------------------
// Bulles d'aide : survol (souris) ou appui long (doigt) sur un élément [data-hint].
// -----------------------------------------------------------------------------
let tipTimer = null;
let longPressed = false;

function showTip(el) {
  const tip = $('#tip');
  tip.textContent = el.dataset.hint;
  tip.hidden = false;
  const a = el.getBoundingClientRect();
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  let x = Math.max(8, Math.min(window.innerWidth - w - 8, a.left + a.width / 2 - w / 2));
  let y = a.bottom + 8;
  if (y + h > window.innerHeight - 8) y = a.top - h - 8;
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}
function hideTip() { clearTimeout(tipTimer); $('#tip').hidden = true; }

// -----------------------------------------------------------------------------
// Pointeur « Nouvelle mission » : une flèche animée montre où agir.
// -----------------------------------------------------------------------------
const GOAL_TARGETS = {
  place: () => document.querySelector('.street-queue .walker') || document.querySelector('#queue .qcard'),
  install: () => document.querySelector('[data-bar="base"]'),
  gift: () => document.querySelector('[data-bar="special"]'),
  decoChange: () => document.querySelector('[data-bar="deco"]'),
  placeDeco: () => document.querySelector('[data-bar="mobilier"]') || document.querySelector('[data-bar="deco"]'),
  hire: () => $('#tab-staff'),
  lobby: () => (selection && selection.mode === 'staff' ? document.querySelector('[data-lobby]') : $('#tab-staff')),
  rename: () => $('#tab-office'),
  extend: () => document.querySelector('[data-bar="extend"]') || $('#tab-office'),
  build: () => [...document.querySelectorAll('.room.kind-empty')].find((e) => !e.closest('.ground-slot')) || document.querySelector('.room.kind-empty'),
  buildEnd: () => document.querySelector('.room.building-works'),
  useResearch: () => $('#tab-lab'),
  labPoint: () => document.querySelector('.room.kind-lab') || $('#tab-lab'),
  midnight: () => $('#clock'),
  service: () => document.querySelector('.request.ok') || document.querySelector('.request'),
  pick: () => document.querySelector('.pickup-hint'),
};

function questTarget() {
  const q = state.quest;
  if (!q) return null;
  const goals = QUESTS[q.id].goals;
  for (let i = 0; i < goals.length; i++) {
    if (q.done[i] || !GOAL_TARGETS[goals[i]]) continue;
    const el = GOAL_TARGETS[goals[i]]();
    if (el && el.getClientRects().length) return el;
  }
  return null;
}

/** Nouvelle mission : son texte s'affiche quelques secondes sous la barre du haut. */
function maybeQuestBanner() {
  const qid = `${state.quest.id}:${state.questsDone}`;
  if (prefs.get('bannerQuest', '') === qid) return;
  if (!$('#sheet').hidden || (state.notices && state.notices.length)) return; // pas sous une fenêtre
  prefs.set('bannerQuest', qid);
  let b = $('#quest-banner');
  if (!b) {
    b = document.createElement('button');
    b.id = 'quest-banner';
    b.className = 'quest-banner';
    b.addEventListener('click', () => { b.hidden = true; openQuest(); });
    $('#scene').appendChild(b);
  }
  b.innerHTML = `${factorIcon({ kind: 'quest' })}<span><small>Nouvelle mission</small>${esc(QUESTS[state.quest.id].text)}</span>`;
  b.hidden = false;
  clearTimeout(b._t);
  b._t = setTimeout(() => { b.hidden = true; }, 7000);
}

let pointer = null; // { until, quest }
function maybeQuestPointer() {
  const qid = `${state.quest.id}:${state.questsDone}`;
  if (prefs.get('pointerQuest', '') === qid) return;
  if (!$('#sheet').hidden || selection) return;
  if (!questTarget()) return;
  prefs.set('pointerQuest', qid);
  showPointer(false);
}

function showPointer(again) {
  pointer = { until: Date.now() + 9000, again };
  const el = $('#pointer');
  el.innerHTML = `<span class="qp-label">${again ? 'C’est ici !' : 'Nouvelle mission'}</span><span class="qp-arrow">${icon('up')}</span>`;
  el.hidden = false;
  requestAnimationFrame(trackPointer);
}

function hidePointer() {
  pointer = null;
  const el = $('#pointer');
  if (el) el.hidden = true;
}

function trackPointer() {
  if (!pointer) return;
  const el = $('#pointer');
  const target = questTarget();
  if (!target || Date.now() > pointer.until) { hidePointer(); return; }
  const a = target.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  // Barre d'actions verticale : la flèche arrive par la droite. Sinon au-dessus
  // de la cible (en dessous si la cible est tout en haut de l'écran).
  const side = !!target.closest('.actionbar') && getComputedStyle($('#actionbar')).flexDirection === 'column';
  const below = !side && a.top - h - 4 < 0;
  el.classList.toggle('side', side);
  el.classList.toggle('below', below);
  if (side) {
    el.style.left = `${a.right + 4}px`;
    el.style.top = `${a.top + a.height / 2 - h / 2}px`;
  } else {
    el.style.left = `${Math.max(4, Math.min(window.innerWidth - w - 4, a.left + a.width / 2 - w / 2))}px`;
    el.style.top = `${below ? a.bottom + 4 : a.top - h - 4}px`;
  }
  requestAnimationFrame(trackPointer);
}

function bindUx() {
  $('#ctx').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ctx]');
    if (!b) return;
    const a = $('#ctx')._actions[Number(b.dataset.ctx)];
    closeCtx();
    a.run();
  });
  $('#actionbar').addEventListener('click', (e) => { const b = e.target.closest('[data-bar]'); if (b && !longPressed) onBarTap(b.dataset.bar); });
  $('#tray').addEventListener('click', (e) => { const b = e.target.closest('[data-tray]'); if (b && !longPressed) onTrayTap(b.dataset.tray); });
  // Toucher ailleurs ferme le menu contextuel ; tout geste cache le pointeur.
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#ctx') && !e.target.closest('[data-room]')) closeCtx();
    if (pointer && !pointer.again && Date.now() > pointer.until - 7000) hidePointer();
  }, true);
  $('#scene').addEventListener('wheel', () => closeCtx(), { passive: true });
  window.addEventListener('resize', closeCtx);
  // Bulles d'aide : survol à la souris…
  // (pointerover filtré sur la souris : au doigt, le navigateur simule un survol
  // après chaque toucher, ce qui affichait la bulle en plus de l'action du bouton.)
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest('[data-hint]');
    clearTimeout(tipTimer);
    if (!el) { $('#tip').hidden = true; return; }
    tipTimer = setTimeout(() => showTip(el), 350);
  });
  // … appui long au doigt (le toucher qui suit est ignoré).
  document.addEventListener('touchstart', (e) => {
    const el = e.target.closest('[data-hint]');
    longPressed = false;
    if (!el) return;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => { longPressed = true; showTip(el); }, 450);
  }, { passive: true });
  document.addEventListener('touchend', () => { clearTimeout(tipTimer); if (longPressed) setTimeout(() => { $('#tip').hidden = true; longPressed = false; }, 1600); });
  document.addEventListener('touchmove', () => clearTimeout(tipTimer), { passive: true });
  document.addEventListener('click', (e) => { if (longPressed && e.target.closest('[data-hint]')) { e.stopPropagation(); e.preventDefault(); } }, true);
}

// -----------------------------------------------------------------------------
// Jeu en ligne : le serveur (Supabase) fait foi. Chaque action est calculée tout
// de suite en local (pour la réactivité), puis envoyée au serveur, dont l'état
// remplace le nôtre quand plus rien n'est en route.
// -----------------------------------------------------------------------------
const AUTH_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
let authListening = false;

async function listenAuth() {
  if (authListening) return;
  authListening = true;
  await onAuthChange((event, session) => {
    if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && (!online || online.userId !== session.user.id)) goOnline(session);
    if (event === 'SIGNED_OUT' && online) goOffline();
  });
}

/** Au démarrage : seulement si une session existe (ou au retour d'une connexion Google). */
async function initOnline() {
  let hasToken = false;
  try { hasToken = !!localStorage.getItem(AUTH_KEY); } catch { /* stockage indisponible */ }
  if (!hasToken && !location.search.includes('code=')) return;
  try {
    await listenAuth();
    const session = await currentSession();
    if (session && !online) await goOnline(session);
  } catch { /* hors ligne : on reste en local */ }
}

let connecting = false;
async function goOnline(session) {
  if (connecting) return;
  connecting = true;
  try { await connect(session); } finally { connecting = false; }
}

async function connect(session) {
  const owner = prefs.get('owner', '');
  // Première connexion depuis une partie locale : elle est reprise sur le compte
  // (le serveur l'ignore si le compte a déjà un hôtel). Jamais celle d'un autre compte.
  const body = owner ? { op: 'load' } : { op: 'import', state };
  const res = await callServer(body);
  if (!res.state) { toast(res.error || 'Serveur injoignable : vous jouez en local.', 'bad'); return; }
  online = { userId: session.user.id, email: session.user.email || 'compte Google' };
  prefs.set('owner', online.userId);
  timeOffset = 0;
  prefs.set('timeOffset', 0);
  adoptServerState(res.state, true);
  toast(`Connecté : ${online.email}. Votre hôtel est enregistré en ligne.`, 'good');
  if (!$('#sheet').hidden && $('#lg-mail')) closeSheet();
  handleInviteLink();
  refreshFriendsBadge();
}

async function goOffline() {
  exitVisit();
  online = null;
  prefs.set('owner', '');
  await store.reset();
  state = createState(now());
  adoptLocal();
  toast('Déconnecté : partie locale.', 'info');
  closeSheet();
}

/** Remplace l'état par celui du serveur. Les fenêtres déjà montrées en local ne reviennent pas. */
function adoptServerState(s, fresh = false) {
  if (visit) { if (!fresh) s.notices = home.notices; home = s; return; } // en visite : on met notre hôtel de côté
  if (!fresh) s.notices = state.notices;
  state = s;
  adoptLocal();
}

function adoptLocal() {
  if (!selectionValid()) selection = null;
  layoutKey = '';
  roomKeys.clear();
  soundSeq = state.logSeq;
  dirty = true;
  tick();
}

function sendToServer(name, args) {
  pendingCalls++;
  serverQueue = serverQueue.then(async () => {
    const res = await callServer({ op: 'act', name, args, clearNotices: true });
    pendingCalls--;
    if (!online) return;
    if (!res.state) { toast(res.offline ? 'Connexion perdue : cette action n’a pas été enregistrée.' : res.error, 'bad'); return; }
    if (!res.ok) toast(`Le serveur a refusé : ${res.error}`, 'bad');
    if (pendingCalls === 0) adoptServerState(res.state);
  });
}

/** Pastille « demandes d'amis reçues » sur l'onglet Amis. */
async function refreshFriendsBadge() {
  if (!online) return;
  const res = await social('me');
  if (!res.ok) return;
  const n = res.friends.filter((f) => f.status === 'incoming').length;
  $('#friends-badge').hidden = !n;
  $('#friends-badge').textContent = n;
}

async function syncFromServer() {
  if (!online || pendingCalls) return;
  refreshFriendsBadge();
  const res = await callServer({ op: 'load', clearNotices: true });
  if (online && res.state && !pendingCalls) adoptServerState(res.state);
}

function accountHTML() {
  if (online) {
    return `<div class="set-row account-row"><small>Compte en ligne</small><b>${esc(online.email)}</b>
      <button class="btn small ghost" data-do="logout">Se déconnecter</button></div>`;
  }
  return `<button class="set-row account-row" data-do="login"><small>Partie locale (cet appareil seulement)</small><b>☁️ Jouer en ligne</b>${icon('right')}</button>`;
}

function openLogin() {
  openSheet({
    title: 'Jouer en ligne',
    kicker: 'Compte',
    body: `<p class="muted">Votre hôtel est enregistré sur votre compte et vous suit sur tous vos appareils. Votre partie actuelle est reprise si le compte n’a pas encore d’hôtel.</p>
      <button class="btn google-btn" data-do="google"><span class="g-logo">G</span> Continuer avec Google</button>
      <div class="or-line"><span>ou par e-mail</span></div>
      <label class="field"><span>E-mail</span><input id="lg-mail" type="email" autocomplete="email" inputmode="email"></label>
      <label class="field"><span>Mot de passe (6 caractères minimum)</span><input id="lg-pass" type="password" autocomplete="current-password" minlength="6"></label>`,
    actions: [
      { label: 'Se connecter', cls: 'primary', run: () => doAuth('in') },
      { label: 'Créer un compte', run: () => doAuth('up') },
    ],
  });
  onSheetClick({ google: async () => { await listenAuth(); const r = await signInGoogle(); if (!r.ok) toast(r.error, 'bad'); } });
  setTimeout(() => $('#lg-mail')?.focus(), 60);
}

async function doAuth(kind) {
  const email = $('#lg-mail').value.trim();
  const password = $('#lg-pass').value;
  if (!email || password.length < 6) { toast('Indiquez un e-mail et un mot de passe de 6 caractères minimum.', 'bad'); return; }
  await listenAuth();
  const r = kind === 'in' ? await signIn(email, password) : await signUp(email, password);
  if (!r.ok) { toast(r.error, 'bad'); return; }
  if (r.needsConfirm) {
    openSheet({ title: 'Vérifiez vos e-mails', body: `<p>Un lien de confirmation a été envoyé à <b>${esc(email)}</b>. Ouvrez-le pour activer votre compte : vous reviendrez ici, connecté.</p>`,
      actions: [{ label: 'Compris', cls: 'primary', run: closeSheet }] });
    return;
  }
  closeSheet();
}

let toastTimer = null;
function toast(text, kind = 'info') {
  const el = $('#toast');
  el.textContent = text;
  el.className = `toast ${kind}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

// -----------------------------------------------------------------------------
// Mode test (?dev dans l'URL) : avance rapide de l'horloge
// -----------------------------------------------------------------------------
function renderDevBar() {
  const bar = document.createElement('details');
  bar.className = 'devbar';
  bar.innerHTML = `<summary>⏩ DEV</summary>
    <button data-dt="${10 * MINUTE}">+10 min</button><button data-dt="${HOUR}">+1 h</button>
    <button data-to="0">→ minuit</button><button data-to="${CONFIG.checkoutHour}">→ ${CONFIG.checkoutHour}h</button>
    <button data-to="${CONFIG.wakeUpHour}">→ ${CONFIG.wakeUpHour}h</button><button data-money>+1000 🪙</button><button data-egg>+🥚 Œuf</button>`;
  document.body.appendChild(bar);
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (online) { toast('Mode test indisponible en ligne : c’est l’horloge du serveur qui compte.', 'bad'); return; }
    if (b.dataset.dt) timeOffset += Number(b.dataset.dt);
    if (b.dataset.to !== undefined) timeOffset += nextLocalHour(now(), Number(b.dataset.to), CONFIG.timeZone) + 1000 - now();
    if (b.dataset.money !== undefined) { state.money += 1000; dirty = true; }
    if (b.dataset.egg !== undefined) { const res = receiveParcel(state, 'Ami de test', now()); if (!res.ok) toast(res.error, 'bad'); dirty = true; }
    prefs.set('timeOffset', timeOffset);
    tick();
  });
}

// -----------------------------------------------------------------------------
// Service worker (mode hors-ligne / installation)
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// Social : amis, classement, visite d'un hôtel, Œufs surprise, mur et « j'aime ».
// Tout passe par le serveur (op 'social.*') ; chacun est désigné par son code ami.
// -----------------------------------------------------------------------------
const fmtCode = (c) => (c ? `${c.slice(0, 4)} ${c.slice(4)}` : '');
const inviteLink = (code) => `${location.origin}${location.pathname}?ami=${code}`;
const social = (op, data = {}) => callServer({ op: `social.${op}`, ...data });
let friendsTab = 'friends'; // 'friends' | 'ranking'
let rankingScope = 'friends';

function friendsOffline() {
  openSheet({
    kicker: 'Amis',
    title: 'Jouer avec ses amis',
    body: `<p>Ajoutez vos amis avec leur code, comparez vos hôtels au classement, visitez-les, envoyez-leur un Œuf surprise chaque jour et laissez un mot sur leur mur.</p>
      <p class="muted">Il faut d’abord jouer en ligne, pour que vos amis puissent trouver votre hôtel.</p>`,
    actions: [{ label: '☁️ Jouer en ligne', cls: 'primary', run: openLogin }, { label: 'Plus tard', cls: 'ghost', run: closeSheet }],
  });
}

async function openFriends(tab = friendsTab, prefill = '') {
  friendsTab = tab;
  if (!online) { friendsOffline(); return; }
  openSheet({ cls: 'tall', kicker: 'Amis', title: 'Mes amis', body: '<p class="muted">Chargement…</p>' });
  const res = tab === 'ranking' ? await social('ranking', { scope: rankingScope }) : await social('me');
  if ($('#sheet').hidden || !$('#sheet h2') || !['Mes amis', 'Classement'].includes($('#sheet h2').textContent)) return; // fenêtre fermée entre-temps
  if (!res.ok) { openSheet({ kicker: 'Amis', title: 'Mes amis', body: `<p class="muted">${esc(res.error || 'Serveur injoignable.')}</p>`, actions: [{ label: 'Réessayer', run: () => openFriends(tab) }] }); return; }
  if (tab === 'ranking') return renderRanking(res.ranking);
  renderFriends(res, prefill);
}

function friendsSeg(tab) {
  return `<div class="seg"><button class="${tab === 'friends' ? 'on' : ''}" data-do="tab" data-arg="friends">${icon('users')} Amis</button>
    <button class="${tab === 'ranking' ? 'on' : ''}" data-do="tab" data-arg="ranking">${icon('star')} Classement</button></div>`;
}

function friendRow(f) {
  const stats = `<small>Niveau ${f.level} · ${f.prestige} ⭐${f.stars ? ` · ${'✦'.repeat(Math.min(5, f.stars))}` : ''}</small>`;
  let btns;
  if (f.status === 'incoming') {
    btns = `<button class="btn small primary" data-do="accept" data-arg="${f.code}">Accepter</button>
      <button class="btn small ghost" data-do="remove" data-arg="${f.code}">Refuser</button>`;
  } else if (f.status === 'outgoing') {
    btns = `<span class="muted f-wait">En attente</span><button class="btn small ghost" data-do="remove" data-arg="${f.code}">Annuler</button>`;
  } else {
    btns = `<button class="btn small" data-do="visit" data-arg="${f.code}">${icon('door')} Visiter</button>
      <button class="btn small" data-do="egg" data-arg="${f.code}" ${friendsCanEgg ? '' : 'disabled'} title="Envoyer un Œuf surprise">🥚</button>`;
  }
  return `<div class="friend-card ${f.status}">
    <div class="f-info"><b>${esc(f.name)}</b>${stats}</div>
    <div class="f-btns">${btns}</div>
    ${f.status === 'friend' ? `<button class="f-del" data-do="unfriend" data-arg="${f.code}" aria-label="Retirer ${esc(f.name)}">${icon('close')}</button>` : ''}
  </div>`;
}

let friendsCanEgg = false;
let friendsCache = [];

function renderFriends(res, prefill = '') {
  friendsCanEgg = res.canSendEgg;
  friendsCache = res.friends;
  const incoming = res.friends.filter((f) => f.status === 'incoming');
  const outgoing = res.friends.filter((f) => f.status === 'outgoing');
  const friends = res.friends.filter((f) => f.status === 'friend');
  const badge = $('#friends-badge');
  badge.hidden = !incoming.length;
  badge.textContent = incoming.length;
  openSheet({
    cls: 'tall',
    kicker: 'Amis',
    title: 'Mes amis',
    body: `${friendsSeg('friends')}
      <div class="code-card"><div><small>Mon code ami</small><b>${fmtCode(res.me.code)}</b></div>
        <button class="btn small primary" data-do="share" data-arg="${res.me.code}">${icon('users')} Inviter</button>
        <button class="btn small" data-do="mywall" data-arg="${res.me.code}">💬 Mon mur</button></div>
      <div class="add-friend"><input id="friend-code" maxlength="9" placeholder="Code de votre ami (ex. 1A2B 3C4D)" value="${esc(fmtCode(prefill))}" autocapitalize="characters" autocomplete="off">
        <button class="btn primary" data-do="add">Ajouter</button></div>
      ${incoming.length ? `<h3>Demandes reçues</h3><div class="friend-list">${incoming.map(friendRow).join('')}</div>` : ''}
      <h3>Mes amis (${friends.length})</h3>
      ${friends.length ? `<p class="muted">${friendsCanEgg ? '🥚 Vous pouvez envoyer un Œuf surprise aujourd’hui : il arrive dans la file de votre ami et ne paie pas, mais compte pour ses succès.' : '🥚 Œuf du jour déjà envoyé : prochain demain.'}</p>
        <div class="friend-list">${friends.map(friendRow).join('')}</div>`
        : '<p class="muted">Pas encore d’amis : partagez votre code ou entrez le leur ci-dessus.</p>'}
      ${outgoing.length ? `<h3>Demandes envoyées</h3><div class="friend-list">${outgoing.map(friendRow).join('')}</div>` : ''}`,
  });
  bindFriendsClicks();
  if (prefill) setTimeout(() => $('#friend-code')?.focus(), 60);
}

function renderRanking(list) {
  openSheet({
    cls: 'tall',
    kicker: 'Amis',
    title: 'Classement',
    body: `${friendsSeg('ranking')}
      <div class="seg small"><button class="${rankingScope === 'friends' ? 'on' : ''}" data-do="scope" data-arg="friends">Entre amis</button>
        <button class="${rankingScope === 'all' ? 'on' : ''}" data-do="scope" data-arg="all">Tous les hôtels</button></div>
      <p class="muted">Le prestige ⭐ se gagne avec les clients ravis, les Stars, les agrandissements et les missions.</p>
      <ol class="rank-list">${list.map((r) => `<li class="${r.me ? 'me' : ''}">
        <span class="r-rank">${r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span>
        <span class="r-name"><b>${esc(r.name)}${r.me ? ' (vous)' : ''}</b><small>Niveau ${r.level}</small></span>
        <span class="r-fame">${r.prestige} ⭐</span>
        ${r.me ? '' : `<button class="btn small ghost" data-do="visit" data-arg="${r.code}" aria-label="Visiter">${icon('door')}</button>`}</li>`).join('')}</ol>`,
  });
  bindFriendsClicks();
}

function bindFriendsClicks() {
  const after = (res, okMsg) => { if (!res.ok) { toast(res.error, 'bad'); return false; } if (okMsg) toast(okMsg, 'good'); return true; };
  onSheetClick({
    tab: (t) => openFriends(t),
    scope: (s) => { rankingScope = s; openFriends('ranking'); },
    add: async () => {
      const code = ($('#friend-code').value || '').replace(/\s/g, '');
      if (!code) { toast('Entrez le code de votre ami.', 'bad'); return; }
      const res = await social('request', { code });
      if (after(res, res.accepted ? `${res.friend.name} et vous êtes maintenant amis !` : `Demande envoyée à ${res.friend?.name || 'cet hôtel'}.`)) openFriends('friends');
    },
    accept: async (code) => { const res = await social('accept', { code }); if (after(res, `${res.friend?.name} et vous êtes maintenant amis !`)) openFriends('friends'); },
    remove: async (code) => { const res = await social('remove', { code }); if (after(res)) openFriends('friends'); },
    unfriend: (code) => {
      const f = friendsCache.find((x) => x.code === code);
      confirmSheet('Retirer cet ami ?', `${esc(f ? f.name : 'Cet hôtel')} ne fera plus partie de vos amis.`, async () => {
        const res = await social('remove', { code }); if (after(res)) openFriends('friends');
      });
    },
    visit: (code) => enterVisit(code),
    egg: (code) => sendEgg(code, () => openFriends('friends')),
    share: (code) => shareInvite(code),
    mywall: (code) => openWall(code),
  });
}

async function sendEgg(code, then) {
  const res = await social('egg', { code });
  if (!res.ok) { toast(res.error, 'bad'); return; }
  buzz(20);
  toast('🥚 Œuf envoyé ! Il attend déjà dans la file de votre ami.', 'good');
  if (res.state) adoptServerState(res.state);
  if (visit) visit.canSendEgg = false;
  if (then) then();
}

async function shareInvite(code) {
  const url = inviteLink(code);
  const text = `Viens me rendre visite dans mon hôtel PokéMotel ! Mon code ami : ${fmtCode(code)}`;
  try {
    if (navigator.share) { await navigator.share({ title: 'PokéMotel', text, url }); return; }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast('Lien d’invitation copié : collez-le à vos amis.', 'good');
  } catch { /* partage annulé */ }
}

// --- Visite --------------------------------------------------------------------------
async function enterVisit(code) {
  const res = await social('visit', { code });
  if (!res.ok) { toast(res.error, 'bad'); return; }
  if (res.mine) { toast('C’est votre hôtel !'); return; }
  closeSheet();
  if (!visit) home = state;
  const me = await social('me');
  visit = { ...res, canSendEgg: !!me.canSendEgg };
  delete visit.state;
  state = res.state;
  selection = null;
  tray = null;
  switchHotel();
  renderVisitBar();
}

function exitVisit() {
  if (!visit) return;
  visit = null;
  state = home;
  home = null;
  switchHotel();
  $('#visit-bar')?.remove();
}

/** Après un changement d'hôtel affiché : tout est redessiné, sans fêter de « gains ». */
function switchHotel() {
  document.body.classList.toggle('visiting', !!visit);
  layoutKey = '';
  roomKeys.clear();
  prevSats.clear();
  hudPrev = null;
  soundSeq = state.logSeq;
  closeCtx();
  render();
  if (camera) requestAnimationFrame(() => camera.fit($('#building')));
}

function renderVisitBar() {
  let bar = $('#visit-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'visit-bar';
    bar.className = 'visit-bar';
    $('#scene').appendChild(bar);
    bar.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-v]');
      if (!b || !visit) return;
      const k = b.dataset.v;
      if (k === 'home') exitVisit();
      if (k === 'wall') openWall(visit.hotel.code);
      if (k === 'egg') sendEgg(visit.hotel.code, renderVisitBar);
      if (k === 'like') {
        const r = await social('like', { code: visit.hotel.code });
        if (!r.ok) { toast(r.error, 'bad'); return; }
        Object.assign(visit, { likes: r.likes, liked: r.liked, wall: r.wall });
        if (r.liked) buzz(15);
        renderVisitBar();
      }
    });
  }
  const v = visit;
  bar.innerHTML = `<div class="vb-title"><small>En visite</small><b>${esc(v.hotel.name)}</b><span>Niveau ${v.hotel.level} · ${v.hotel.prestige} ⭐</span></div>
    <div class="vb-btns">
      <button class="vb-btn${v.liked ? ' on' : ''}" data-v="like" aria-label="J’aime">${v.liked ? '❤️' : '🤍'}<b>${v.likes}</b></button>
      <button class="vb-btn" data-v="wall" aria-label="Mur">💬<b>${v.wall.length}</b></button>
      ${v.friend ? `<button class="vb-btn" data-v="egg" ${v.canSendEgg ? '' : 'disabled'} aria-label="Envoyer un Œuf">🥚</button>` : ''}
      <button class="vb-btn home" data-v="home">${icon('door')}<b>Rentrer</b></button>
    </div>`;
}

// --- Mur -----------------------------------------------------------------------------
async function openWall(code, data = null) {
  const res = data || await social('visit', { code });
  if (!res.ok) { toast(res.error, 'bad'); return; }
  const canWrite = res.mine || res.friend;
  const ago = (iso) => {
    const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    if (m < 1) return 'à l’instant';
    if (m < 60) return `il y a ${m} min`;
    if (m < 1440) return `il y a ${Math.round(m / 60)} h`;
    return `il y a ${Math.round(m / 1440)} j`;
  };
  openSheet({
    cls: 'tall',
    kicker: `${res.likes} ❤️ · ${res.wall.length} message${res.wall.length > 1 ? 's' : ''}`,
    title: res.mine ? 'Mon mur' : `Le mur de ${esc(res.hotel.name)}`,
    body: `${canWrite ? `<div class="wall-write"><textarea id="wall-text" maxlength="200" rows="2" placeholder="${res.mine ? 'Un mot pour vos visiteurs…' : 'Un petit mot pour votre ami…'}"></textarea>
        <button class="btn primary" data-do="post">Publier</button></div>` : '<p class="muted">Seuls les amis de cet hôtel peuvent écrire sur son mur.</p>'}
      ${res.wall.length ? `<ul class="wall-list">${res.wall.map((p) => `<li><div class="w-head"><b>${esc(p.author ? p.author.name : 'Ancien joueur')}</b><small>${ago(p.at)}</small>
          ${p.canDelete ? `<button class="w-del" data-do="unpost" data-arg="${p.id}" aria-label="Effacer">${icon('trash')}</button>` : ''}</div><p>${esc(p.body)}</p></li>`).join('')}</ul>`
        : '<p class="muted">Aucun message pour l’instant.</p>'}`,
  });
  const refresh = (r) => {
    if (!r.ok) { toast(r.error, 'bad'); return; }
    const next = { ...res, wall: r.wall, likes: r.likes, liked: r.liked };
    if (visit && visit.hotel.code === code) { Object.assign(visit, { wall: r.wall, likes: r.likes, liked: r.liked }); renderVisitBar(); }
    openWall(code, next);
  };
  onSheetClick({
    post: async () => { const text = $('#wall-text').value; if (!text.trim()) return; refresh(await social('post', { code, text })); },
    unpost: (id) => confirmSheet('Effacer ce message ?', 'Il disparaîtra du mur.', async () => refresh(await social('unpost', { id: Number(id) }))),
  });
}

/** Lien d'invitation (?ami=CODE) : on l'ouvre une fois connecté. */
function handleInviteLink() {
  const params = new URLSearchParams(location.search);
  const code = (params.get('ami') || prefs.get('pendingFriend', '') || '').toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 8);
  if (params.has('ami')) {
    params.delete('ami');
    history.replaceState(history.state, '', `${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`);
  }
  if (code.length !== 8) return;
  prefs.set('pendingFriend', code);
  if (!online) toast('Connectez-vous pour ajouter cet ami (Bureau › Jouer en ligne).');
}

/** Ouvre la fenêtre Amis pour un lien d'invitation reçu, dès qu'aucune autre fenêtre n'attend. */
function maybePendingFriend() {
  const code = prefs.get('pendingFriend', '');
  if (!code || !online || visit || !$('#sheet').hidden || (state.notices && state.notices.length)) return;
  prefs.set('pendingFriend', '');
  openFriends('friends', code);
}

// Mises à jour : à chaque publication (VERSION de sw.js incrémentée), le nouveau
// service worker prend la main sur les jeux ouverts. On recharge alors tout seul si le
// jeu est en arrière-plan (au retour, il est à jour), sinon un bandeau propose de le
// faire. Le jeu vérifie à chaque retour au premier plan et toutes les 10 minutes.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  const reload = () => { if (!reloading) { reloading = true; location.reload(); } };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // première installation : la page est déjà la bonne version
    if (document.hidden) document.addEventListener('visibilitychange', reload, { once: true });
    else showUpdateBanner(reload);
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').then((reg) => {
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    setInterval(check, 10 * 60 * 1000);
  }).catch(() => {}));
}

function showUpdateBanner(onTap) {
  if ($('#update-banner')) return;
  const b = document.createElement('button');
  b.id = 'update-banner';
  b.className = 'update-banner';
  b.innerHTML = `${icon('sparkle')}<span><b>Nouvelle version du jeu</b><small>Touchez pour mettre à jour</small></span>`;
  b.addEventListener('click', onTap);
  document.body.appendChild(b);
}

boot();
