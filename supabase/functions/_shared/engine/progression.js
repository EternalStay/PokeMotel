// =============================================================================
// Progression : quêtes (missions), laboratoire et talents, événements aléatoires.
// Règles adaptées de CroqueMotel (réécriture Eternaltwin) :
//   - 19 missions de tutoriel puis des missions répétables (+5 ⭐ chacune),
//   - laboratoire : chaque client étudié fait progresser la recherche ; 5 études
//     = 1 point de recherche ; les autres clients s'en inquiètent (−1),
//   - arbre de talents en 4 rangées (débloquées tous les 4 points dépensés),
//     25 points maximum,
//   - un événement aléatoire toutes les 9 à 21 h, selon le niveau de l'hôtel.
// =============================================================================

import { AURAS, CONFIG, ITEMS, ITEM_IDS, CURRENCY, GEMS, NATURES, SPECIES } from './data.js';
import { rngFor } from './rng.js';
import { HOUR, MINUTE } from './time.js';
import { addLog, enqueueNewGuest, occupancy, removeGuest, roomLabel, naturesFor } from './model.js';
import { bumpGoal } from './achievements.js';

// -----------------------------------------------------------------------------
// Quêtes
// -----------------------------------------------------------------------------
/** Récompenses : { money } | { client: true } | { item } | { randomItem: true } | { research: true } | { fame } */
export const QUESTS = [
  { text: 'Installez un client (confortablement) dans une chambre : touchez un client de la file d\'attente, puis une chambre libre.',
    goals: ['place'], rewards: [{ money: 50 }, { client: true }] },
  { text: 'Installez le second client judicieusement, en tenant compte de ce qu\'il aime : ses goûts sont écrits sur sa carte.',
    goals: ['place'], rewards: [{ item: 'compost' }, { item: 'radiateur' }] },
  { text: 'Installez 2 équipements dans des chambres, en fonction de ce que vos clients apprécient : bouton « Base » en haut de l\'écran, touchez un objet, puis la chambre.',
    goals: ['install', 'install'], rewards: [{ item: 'randpaintwarm' }, { item: 'randtexture' }] },
  { text: 'Changez la déco d\'un étage : bouton « Déco » en haut de l\'écran, touchez un pot de peinture ou un papier peint, puis une pièce de l\'étage.',
    goals: ['decoChange', 'decoChange'], rewards: [{ money: 100 }] },
  { text: 'Recrutez un employé depuis l\'onglet Personnel.',
    goals: ['hire'], rewards: [] },
  { text: 'Placez un employé à la réception pour réduire l\'attente avant le prochain client : Personnel › Affecter, puis touchez la réception.',
    goals: ['lobby'], rewards: [] },
  { text: 'Apportez une petite touche personnelle : changez le nom de votre hôtel depuis le Bureau.',
    goals: ['rename'], rewards: [{ money: 300 }] },
  { text: 'Agrandissez votre hôtel : bouton « Agrandir » en haut de l\'écran, puis touchez une case en pointillés.',
    goals: ['extend'], rewards: [] },
  { text: 'Aménagez une nouvelle CHAMBRE : touchez un emplacement libre et choisissez « Chambre ».',
    goals: ['build'], rewards: [{ client: true }, { client: true }, { item: 'panier' }] },
  { text: 'Attendez la fin des travaux. Ils ne durent que quelques minutes (le compte à rebours est affiché sur le chantier).',
    goals: ['buildEnd'], rewards: [{ item: 'randdeco' }] },
  { text: 'Posez un meuble : bouton « Mobilier » en haut de l\'écran, ouvrez le carton de déco, puis touchez l\'endroit où le poser.',
    goals: ['placeDeco'], rewards: [{ client: true }, { research: true }] },
  { text: 'Utilisez votre point de recherche : onglet Labo.',
    goals: ['useResearch'], rewards: [{ item: 'randdeco' }, { item: 'randdeco' }, { item: 'randpaint' }, { money: 25 }] },
  { text: 'Passez une nuit : vos clients payent à minuit selon leur satisfaction, et encore une fois en partant à 10h.',
    goals: ['midnight'], rewards: [{ item: 'kit' }, { item: 'randpaint' }, { item: 'randpaint' }, { money: 300 }, { research: true }] },
  { text: 'Utilisez votre second point de recherche (onglet Labo).',
    goals: ['useResearch'], rewards: [] },
  { text: 'Faites plaisir à 5 clients (8 ou plus au départ) et améliorez une chambre au niveau 2.',
    goals: ['satisfy', 'satisfy', 'satisfy', 'satisfy', 'satisfy', 'roomLevel'], rewards: [{ item: 'randdeco' }, { item: 'randdeco' }, { research: true }] },
  { text: 'Récupérez (qui a dit « volez » ?) 5 objets au départ des clients.',
    goals: ['pick', 'pick', 'pick', 'pick', 'pick'], rewards: [{ item: 'randdeco' }, { item: 'randdeco' }, { item: 'randpaint' }, { item: 'randpaint' }, { research: true }] },
  { text: 'Obtenez 3 points de recherche (construisez un Laboratoire pour cela).',
    goals: ['labPoint', 'labPoint', 'labPoint'], rewards: [{ item: 'randdeco' }, { item: 'randdeco' }, { money: 100 }] },
  { text: 'Comblez totalement 5 clients (10 au moment de leur départ).',
    goals: ['satisfyMax', 'satisfyMax', 'satisfyMax', 'satisfyMax', 'satisfyMax'], rewards: [{ item: 'randdeco' }, { item: 'randdeco' }, { item: 'randdeco' }, { money: 100 }, { research: true }] },
  { text: 'Améliorez 4 chambres au niveau 2.',
    goals: ['roomLevel', 'roomLevel', 'roomLevel', 'roomLevel'], rewards: [{ item: 'matelas' }, { item: 'matelas' }, { item: 'randdeco' }, { item: 'randdeco' }] },
  // Missions répétables (+5 ⭐)
  { repeat: true, text: 'Faites progresser la science.',
    goals: ['pick', 'pick', 'satisfy', 'satisfy', 'satisfy', 'midnight', 'midnight', 'labPoint', 'labPoint'], rewards: [{ fame: 5 }] },
  { repeat: true, text: 'Faites le bonheur de vos clients.',
    goals: ['satisfyMax', 'satisfyMax', 'satisfyMax', 'install', 'install', 'install', 'service', 'service', 'service', 'service', 'pick'], rewards: [{ fame: 5 }] },
  { repeat: true, text: 'Récupérez des objets au départ de vos clients.',
    goals: ['midnight', 'midnight', 'midnight', 'satisfy', 'satisfy', 'satisfy', 'pick', 'pick', 'pick', 'pick', 'pick', 'pick'], rewards: [{ fame: 5 }] },
  { repeat: true, text: 'Rendez service à vos clients.',
    goals: ['service', 'service', 'service', 'service', 'service', 'service', 'service', 'service', 'service', 'service', 'satisfyMax', 'satisfyMax'], rewards: [{ fame: 5 }] },
  { repeat: true, text: 'Développez votre hôtel.',
    goals: ['pick', 'pick', 'satisfyMax', 'satisfyMax', 'install', 'install', 'build', 'build', 'midnight', 'midnight', 'midnight', 'labPoint'], rewards: [{ fame: 5 }] },
];

/** Libellés courts des objectifs. */
export const GOAL_LABELS = {
  place: 'Client installé', install: 'Équipement installé', gift: 'Cadeau offert', hire: 'Employé recruté',
  lobby: 'Employé à la réception', rename: 'Hôtel renommé', extend: 'Hôtel agrandi', build: 'Pièce construite',
  buildEnd: 'Travaux terminés', pick: 'Objet ramassé', useResearch: 'Point de recherche utilisé', midnight: 'Nuit passée',
  satisfy: 'Client satisfait (8+)', satisfyMax: 'Client comblé (10)', roomLevel: 'Chambre niveau 2', labPoint: 'Point de recherche obtenu',
  service: 'Service rendu', decoChange: 'Déco d\'étage changée', placeDeco: 'Meuble posé',
};

export function initQuest(state) {
  state.quest = { id: 0, done: QUESTS[0].goals.map(() => false) };
  state.questsDone = 0;
  state.notices = [];
}

/** Signale un événement de jeu ; valide l'objectif correspondant de la mission en cours. */
export function questEvent(state, type, t) {
  const q = state.quest;
  if (!q) return;
  const tpl = QUESTS[q.id];
  const i = tpl.goals.findIndex((g, k) => g === type && !q.done[k]);
  if (i < 0) return;
  q.done[i] = true;
  if (q.done.every(Boolean)) completeQuest(state, t);
}

/** Index de la mission « Passez une nuit » : fin du tutoriel (10 gemmes), puis 5 par mission. */
export const TUTORIAL_END = QUESTS.findIndex((q) => q.goals.includes('midnight'));

/** « Recommencer la partie » n'est proposé que jusqu'à la mission de la première nuit. */
export const canRestart = (state) => state.questsDone <= TUTORIAL_END;

function completeQuest(state, t) {
  const id = state.quest.id;
  const tpl = QUESTS[id];
  const given = tpl.rewards.map((r) => grantReward(state, r, t));
  const gems = id === TUTORIAL_END ? CONFIG.gems.tutorialEnd : id > TUTORIAL_END ? CONFIG.gems.quest : 0;
  if (gems) { state.gems += gems; given.push(`${gems} ${GEMS}`); }
  state.questsDone++;
  addLog(state, t, 'good', `📜 Mission accomplie : « ${tpl.text} »${given.length ? ` Récompense : ${given.join(', ')}.` : ''}`);
  // La fenêtre « contrat rempli » ne s'ouvre que si la mission rapporte quelque chose.
  if (given.length) (state.notices ||= []).push({ kind: 'quest', text: tpl.text, rewards: given });
  // Mission suivante : le tutoriel dans l'ordre, puis les répétables tirées au sort (jamais deux fois la même).
  let next = id + 1;
  if (next >= QUESTS.length || QUESTS[next].repeat) {
    const pool = QUESTS.map((q, i) => i).filter((i) => QUESTS[i].repeat && i !== id);
    next = rngFor(state).pick(pool);
  }
  state.quest = { id: next, done: QUESTS[next].goals.map(() => false) };
}

function randomEquip(state) {
  const pool = ITEM_IDS.filter((id) => ITEMS[id].kind === 'equip' && ITEMS[id].price <= 70);
  return rngFor(state).pick(pool);
}

/** Accorde une récompense ; renvoie son libellé. */
export function grantReward(state, r, t) {
  if (r.money) { state.money += r.money; return `${r.money} ${CURRENCY}`; }
  if (r.fame) { state.prestige += r.fame; return `${r.fame} ⭐`; }
  if (r.research) { addResearchPoint(state, t, false); return '1 point de recherche'; }
  if (r.client) { const g = enqueueNewGuest(state, t); return `un client (${g.name})`; }
  const id = r.item || randomEquip(state);
  state.inventory[id] = (state.inventory[id] || 0) + 1;
  return ITEMS[id].name;
}

// -----------------------------------------------------------------------------
// Talents (laboratoire)
// -----------------------------------------------------------------------------
export const TALENT_ROWS = [
  ['repairCost', 'attendCost', 'attendDuration', 'easyMove'],
  ['extendCost', 'strongRooms', 'attendChance', 'labFear', 'crystal'],
  ['specFeu', 'specInsecte', 'specCombat', 'specGlace', 'specElectrik', 'specPlante'],
  ['itemDrop', 'taxDiscount', 'strongItems', 'labLuck'],
];
export const TALENTS = {
  repairCost:     { name: 'Bricol-boys',           max: 3, desc: 'Réduit le coût des réparations des chambres.' },
  attendCost:     { name: 'Amour bon marché',      max: 3, desc: 'Réduit le coût des petites attentions.' },
  attendDuration: { name: 'Vite fait, bien fait',  max: 3, desc: 'Réduit la durée des petites attentions.' },
  easyMove:       { name: 'Faculté d\'adaptation', max: 1, desc: 'Un déménagement ne coûte plus que 1 point au lieu de 2.' },
  extendCost:     { name: 'Architecte fou',        max: 3, desc: 'Réduit le coût des agrandissements (jusqu\'à −20 %).' },
  strongRooms:    { name: 'Chambre blindée',       max: 3, desc: 'Réduit les chances qu\'une chambre soit salie au départ d\'un client.' },
  attendChance:   { name: 'Expertise en câlins',   max: 3, desc: 'Augmente les chances de succès des petites attentions (jusqu\'à +30 points).' },
  labFear:        { name: 'Cellule capitonnée',    max: 3, desc: 'Les études au laboratoire inquiètent moins les autres clients.' },
  crystal:        { name: 'Boule de cristal',      max: 1, desc: 'Affiche l\'heure de la prochaine demande de service d\'un client (dans sa fiche).' },
  specFeu:        { name: 'Maîtrise : Feu',        max: 2, desc: 'Réduit les chances qu\'un Pyromane détruise sa chambre (jusqu\'à −75 points).' },
  specInsecte:    { name: 'Maîtrise : Insecte',    max: 2, desc: '+1 de satisfaction de départ par niveau pour les prochains clients Insecte.' },
  specCombat:     { name: 'Maîtrise : Combat',     max: 2, desc: '+1 de satisfaction de départ par niveau pour les prochains clients Combat.' },
  specGlace:      { name: 'Maîtrise : Glace',      max: 2, desc: 'Augmente les gains avec les clients Glace (+50 % par niveau).' },
  specElectrik:   { name: 'Maîtrise : Électrik',   max: 2, desc: 'Augmente les gains avec les clients Électrik (+50 % par niveau).' },
  specPlante:     { name: 'Maîtrise : Plante',     max: 2, desc: 'Augmente les gains avec les clients Plante (+50 % par niveau).' },
  itemDrop:       { name: 'Racket',                max: 3, desc: 'Augmente les chances d\'objet oublié au départ des clients.' },
  taxDiscount:    { name: 'Dans ton fisc',         max: 3, desc: 'Réduit la taxe hebdomadaire (jusqu\'à −20 %).' },
  strongItems:    { name: 'Équipement renforcé',   max: 2, desc: 'Réduit les chances que les équipements soient détruits.' },
  labLuck:        { name: 'Bon goût',              max: 3, desc: 'Chaque étude au laboratoire peut rapporter un carton de déco (jusqu\'à 10 %).' },
};
export const TALENT_ROW_STEP = 4;
export const TREE_MAX = 25;

export const talent = (state, id) => state.research?.talents?.[id] || 0;
export const talentRatio = (state, id) => talent(state, id) / TALENTS[id].max;
export const spentPoints = (state) => Object.values(state.research?.talents || {}).reduce((s, n) => s + n, 0);
export const talentRow = (id) => TALENT_ROWS.findIndex((row) => row.includes(id));
export const rowUnlocked = (state, row) => spentPoints(state) >= row * TALENT_ROW_STEP;
export const treeMax = (state) => TREE_MAX + 5 * (state.stars || 0);

export function initResearch(state) {
  state.research = { points: 0, progress: 0, talents: {} };
}

/** Ajoute un point de recherche (ou du prestige si l'arbre est plein). */
export function addResearchPoint(state, t, fromLab = true) {
  const r = state.research;
  if (spentPoints(state) + r.points >= treeMax(state)) {
    state.prestige += CONFIG.lab.goldFame;
    addLog(state, t, 'good', `🧪 C'était une fiole d'or : +${CONFIG.lab.goldFame} ⭐ (arbre de talents complet).`);
    return;
  }
  r.points++;
  if (fromLab) {
    state.stats.research = (state.stats.research || 0) + 1;
    questEvent(state, 'labPoint', t);
  }
}

/** Dépense un point dans un talent. */
export function spendTalent(state, id, now) {
  const tal = TALENTS[id];
  if (!tal) return { ok: false, error: 'Talent inconnu.' };
  if (state.research.points < 1) return { ok: false, error: 'Vous n\'avez pas de point de recherche.' };
  if (talent(state, id) >= tal.max) return { ok: false, error: 'Ce talent est déjà au maximum.' };
  const row = talentRow(id);
  if (!rowUnlocked(state, row)) return { ok: false, error: `Dépensez d'abord ${row * TALENT_ROW_STEP} points dans les rangées précédentes.` };
  state.research.points--;
  state.research.talents[id] = talent(state, id) + 1;
  addLog(state, now, 'good', `🧪 Talent appris : ${tal.name} (niveau ${state.research.talents[id]}).`);
  questEvent(state, 'useResearch', now);
  return { ok: true };
}

/** Réinitialise les talents (les points sont rendus) : 20 gemmes. */
export function resetTalents(state, now) {
  const spent = spentPoints(state);
  if (!spent) return { ok: false, error: 'Aucun talent à réinitialiser.' };
  const cost = CONFIG.gems.resetTalents;
  if ((state.gems || 0) < cost) return { ok: false, error: `Il vous faut ${cost} ${GEMS} pour réinitialiser les talents.` };
  state.gems -= cost;
  state.research.points += spent;
  state.research.talents = {};
  addLog(state, now, 'info', `🧪 Talents réinitialisés : ${spent} point(s) récupéré(s).`);
  return { ok: true };
}

/** Envoyer un client au laboratoire : il part sans payer, la recherche progresse. */
export function studyGuest(state, guestId, labRoomId, now) {
  const g = state.guests[guestId];
  const lab = state.rooms[labRoomId];
  if (!g) return { ok: false, error: 'Client introuvable.' };
  if (!lab || lab.sub !== 'labo' || lab.buildEnd) return { ok: false, error: 'Il faut un Laboratoire en état de marche.' };
  if ((lab.busyUntil || 0) > now) return { ok: false, error: 'Le laboratoire analyse encore les résultats de la dernière étude.' };
  if (lab.leftItem) return { ok: false, error: 'Ramassez d\'abord la fiole posée dans le laboratoire.' };
  const rng = rngFor(state);
  const gain = g.type === 'roche' ? CONFIG.lab.specialGain : CONFIG.lab.gain;
  removeGuest(state, g.id);
  lab.busyUntil = now + CONFIG.lab.cooldownHours * HOUR;
  bumpGoal(state, 'lab', now);
  addLog(state, now, 'info', `🧪 ${g.name} s'est « porté volontaire » pour une étude au laboratoire. Pour le bien de la science…`);

  // Tous les autres clients, logés ou en file, s'inquiètent (−1), sauf avec la Cellule capitonnée.
  const spare = CONFIG.lab.fearMaxSpare * talentRatio(state, 'labFear');
  for (const o of Object.values(state.guests)) {
    if (!rng.chance(spare)) o.mods.malus = (o.mods.malus || 0) + 1;
  }
  if (rng.chance(0.1 * talentRatio(state, 'labLuck'))) {
    state.inventory.randdeco = (state.inventory.randdeco || 0) + 1;
    addLog(state, now, 'good', '🧪 Avec les restes de l\'étude, vous avez fabriqué : un carton de déco surprise.');
  }
  const r = state.research;
  r.progress += gain;
  // À 5 études, le laboratoire pose une fiole au sol : un point de recherche à ramasser.
  let vials = 0;
  while (r.progress >= CONFIG.lab.needed) { r.progress -= CONFIG.lab.needed; vials++; }
  if (vials) {
    lab.leftItem = { vials };
    addLog(state, now, 'good', '🧪 Vos recherches ont porté leurs fruits : une fiole vous attend dans le laboratoire !');
  }
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Événements aléatoires
// -----------------------------------------------------------------------------
const EVENT_TABLE = [
  { kind: 'roomBad', weight: 100 },
  { kind: 'roomHappy', weight: 80 },
  { kind: 'floorHappy', weight: 5 },
  { kind: 'vip', weight: 5 },
  { kind: 'none', weight: 60, maxLevel: 1 },
  { kind: 'roomAccident', weight: 100, minLevel: 2 },
  { kind: 'theft', weight: 5, minLevel: 2 },
  { kind: 'floorAccident', weight: 2, minLevel: 4 },
  { kind: 'sblurb', weight: 5, minLevel: 4 },
];

const SMALL_ACCIDENTS = ['il a glissé dans la douche', 'il s\'est planté un clou dans le pied', 'il a trouvé un cafard géant dans son lit',
  'la couette a tenté de l\'étouffer', 'son café avait un goût de chou de Bruxelles', 'une mite de 30 kg l\'a pris en chasse'];
const HAPPY = ['il a trouvé un sachet de bonbons sous son oreiller', 'un employé lui a raconté une excellente blague',
  'il a battu son record à son jeu préféré', 'il a reçu une coquette somme pour son dernier boulot', 'il a adoré la vue depuis sa fenêtre'];
const ACCIDENTS = ['la tuyauterie a lâché', 'le plafond s\'est effondré sur le lit', 'un court-circuit a grillé la moquette',
  'une colonie de termites a dévoré l\'armoire', 'la baignoire a traversé le plancher'];
const BIG_THINGS = ['une soucoupe volante', 'un satellite en perdition', 'un hippopotame volant', 'une météorite', 'une montgolfière ivre'];

export function scheduleEvent(state, from) {
  const rng = rngFor(state);
  state.nextEventAt = from + (CONFIG.events.minHours + rng.next() * CONFIG.events.spreadHours) * HOUR + rng.int(0, 59) * MINUTE;
}

/** Déclenche un événement aléatoire. */
export function runEvent(state, t) {
  scheduleEvent(state, t);
  const rng = rngFor(state);
  const lvl = state.hotel.level;
  const placed = Object.values(occupancy(state));
  if (!placed.length) return;
  const table = EVENT_TABLE.filter((e) => (e.minLevel ?? 0) <= lvl && (e.maxLevel ?? 99) >= lvl);
  const kind = rng.weighted(table.map((e) => ({ id: e.kind, weight: e.weight }))).id;
  const g = rng.pick(placed);
  const room = state.rooms[g.roomId];
  const notice = (text, tone) => { addLog(state, t, tone, text); (state.notices ||= []).push({ kind: 'event', text, tone, roomId: g.roomId }); };

  switch (kind) {
    case 'roomBad':
      g.mods.malus = (g.mods.malus || 0) + 1;
      notice(`Petit tracas en chambre ${roomLabel(room)} : ${rng.pick(SMALL_ACCIDENTS)}. ${g.name} perd 1 point.`, 'bad');
      break;
    case 'roomHappy':
      g.mods.bonus = (g.mods.bonus || 0) + 1;
      notice(`Bonne surprise en chambre ${roomLabel(room)} : ${rng.pick(HAPPY)}. ${g.name} gagne 1 point !`, 'good');
      break;
    case 'floorHappy': {
      const floor = placed.filter((x) => state.rooms[x.roomId].floor === room.floor);
      const hug = CONFIG.events.floorHug;
      for (const x of floor) x.mods.bonus = (x.mods.bonus || 0) + hug;
      notice(`${g.name} a été pris d'un grand élan d'amour et a fait un câlin à tout l'étage ${room.floor} : +${hug} pour ${floor.length} client(s) !`, 'good');
      break;
    }
    case 'vip':
      if (g.star || g.parcel) return;
      g.star = true;
      notice(`Incroyable ! ${g.name} (chambre ${roomLabel(room)}) est en réalité une STAR ! Elle exige maintenant une chambre de luxe.`, 'good');
      break;
    case 'roomAccident': {
      const dmg = CONFIG.events.accidentDamage;
      room.damage = Math.min(CONFIG.maxDamage, room.damage + dmg);
      notice(`Un problème est survenu dans la chambre ${roomLabel(room)} : ${rng.pick(ACCIDENTS)} (${dmg} dégâts).`, 'bad');
      break;
    }
    case 'theft': {
      const loss = Math.max(0, Math.min(state.money, rng.int(CONFIG.events.theftMin, CONFIG.events.theftMax)));
      state.money -= loss;
      const stolen = room.equip.map((i) => ITEMS[i].name);
      room.equip = [];
      removeGuest(state, g.id);
      notice(`Au vol ! ${g.name} (chambre ${roomLabel(room)}) s'est enfui avec ${loss} ${CURRENCY}${stolen.length ? ` et ${stolen.join(', ')}` : ''} !`, 'bad');
      break;
    }
    case 'floorAccident': {
      const victims = placed.filter((x) => state.rooms[x.roomId].floor === room.floor);
      for (const r of Object.values(state.rooms)) if (r.floor === room.floor && r.kind === 'bedroom') r.damage = Math.min(CONFIG.maxDamage, r.damage + CONFIG.events.floorDamage);
      for (const x of victims) removeGuest(state, x.id);
      notice(`Argh ! ${rng.pick(BIG_THINGS)} a percuté l'étage ${room.floor} ! ${victims.length} client(s) ont pris la fuite sans payer.`, 'bad');
      break;
    }
    case 'sblurb': {
      // Lavage de cerveau : il change de nature, donc de goûts.
      const old = g.nature ? NATURES[g.nature].name : null;
      const choices = naturesFor(lvl).filter((id) => id !== g.nature);
      const nat = rng.pick(choices.length ? choices : naturesFor(lvl));
      g.nature = nat;
      g.likes = [NATURES[nat].like];
      g.dislikes = NATURES[nat].dislike ? [NATURES[nat].dislike] : [];
      if (g.species && SPECIES[g.species]) g.name = `${SPECIES[g.species].name} ${NATURES[nat].name}`;
      notice(`Un sblurb a attaqué ${g.name} (chambre ${roomLabel(room)}) : lavage de cerveau complet${old ? `, il n'est plus ${old}` : ''} ! Nature ${NATURES[nat].name} : aime ${AURAS[g.likes[0]].name}${g.dislikes.length ? `, déteste ${AURAS[g.dislikes[0]].name}` : ''}.`, 'bad');
      break;
    }
    default:
      break;
  }
}


