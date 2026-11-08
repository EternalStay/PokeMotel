// =============================================================================
// Succès : 11 compteurs et 39 paliers (règles de CroqueMotel d'après la
// réécriture Eternaltwin : mêmes compteurs, mêmes seuils, mêmes points).
// Les titres et les badges sont les nôtres. Un palier donne soit un badge,
// soit un titre (placé avant ou après le nom du gérant) ; on choisit le titre
// affiché dans le Bureau.
// =============================================================================

import { addLog } from './model.js';

/** Les compteurs, dans l'ordre d'affichage. `icon` : nom d'icône du client. */
export const ACHIEVEMENTS = {
  stars:  { name: 'Étoiles de legs',          icon: 'star' },
  okvip:  { name: 'Stars bien traitées',      icon: 'sparkle' },
  hosted: { name: 'Clients hébergés',         icon: 'bed' },
  okbase: { name: 'Clients bien traités',     icon: 'heart' },
  serv:   { name: 'Services rendus',          icon: 'service' },
  pick:   { name: 'Objets « récupérés »',     icon: 'pickup' },
  okfrnd: { name: 'Œufs d\'amis bien traités', icon: 'gift' },
  lab:    { name: 'Expériences au labo',      icon: 'research' },
  visit:  { name: 'Visites chez des amis',    icon: 'door' },
  room:   { name: 'Pièces construites',       icon: 'build' },
  pub:    { name: 'Campagnes de pub',         icon: 'bell' },
};
export const ACHIEVEMENT_KEYS = Object.keys(ACHIEVEMENTS);

/** Satisfaction au départ à partir de laquelle un client compte comme « bien traité ». */
export const WELL_TREATED = 6;

const badge = (goal, count, points, icon, tone) => ({ goal, count, points, badge: { icon, tone } });
const title = (goal, count, points, name, pos = 'prefix') => ({ goal, count, points, title: { name, pos } });

/** Les 39 paliers, par compteur puis par seuil. */
export const REWARDS = [
  badge('okfrnd', 1, 7.5, 'gift', 'pink'),
  title('okfrnd', 5, 7.5, 'Bon voisin'),
  badge('okfrnd', 10, 7.5, 'bed', 'pink'),
  badge('okfrnd', 50, 7.5, 'gift', 'gold'),
  badge('okfrnd', 100, 19, 'users', 'gold'),
  title('pick', 10, 19, 'Fouineur'),
  title('pick', 100, 19, 'Ramasse-tout'),
  title('pick', 250, 19, 'Fripouille'),
  title('pick', 500, 19, 'Roi de la fauche'),
  title('hosted', 10, 7.5, 'Concierge'),
  title('hosted', 50, 19, 'Logeur'),
  title('hosted', 100, 19, 'Hôtelier'),
  title('hosted', 500, 38, 'Grand hôtelier'),
  title('hosted', 1000, 76.5, 'Légende de l\'hôtellerie'),
  title('room', 10, 19, 'du Béton', 'suffix'),
  badge('room', 50, 19, 'build', 'blue'),
  title('room', 100, 19, 'Architecte'),
  badge('room', 150, 19, 'hammer', 'gold'),
  title('room', 300, 38, 'Bâtisseur de tours'),
  badge('serv', 10, 19, 'service', 'blue'),
  badge('serv', 100, 19, 'service', 'gold'),
  title('stars', 1, 19, 'Étoilé'),
  title('stars', 3, 19, 'des Palaces', 'suffix'),
  badge('stars', 4, 38, 'coin', 'gold'),
  badge('stars', 5, 76.5, 'star', 'gold'),
  title('stars', 6, 76.5, 'Constellation'),
  title('visit', 10, 19, 'Pique-assiette'),
  title('visit', 100, 19, 'Globe-trotteur'),
  badge('lab', 1, 19, 'research', 'green'),
  badge('lab', 30, 57.5, 'research', 'gold'),
  badge('pub', 1, 7.5, 'bell', 'blue'),
  title('pub', 10, 19, 'Crieur'),
  badge('pub', 50, 19, 'bell', 'gold'),
  title('pub', 100, 19, 'de la Réclame', 'suffix'),
  badge('okvip', 1, 19, 'sparkle', 'pink'),
  badge('okvip', 25, 57.5, 'star', 'pink'),
  title('okvip', 50, 38, 'Tapis rouge'),
  badge('okbase', 10, 19, 'heart', 'pink'),
  badge('okbase', 25, 19, 'coin', 'green'),
];

export const goalCount = (state, key) => state.goals?.[key] || 0;

/** Paliers atteints, dans l'ordre du catalogue. */
export const rewardsReached = (state) => REWARDS.filter((r) => goalCount(state, r.goal) >= r.count);

/** Total des points (arrondi à l'entier, comme l'affichage d'origine). */
export const totalPoints = (state) => Math.round(rewardsReached(state).reduce((s, r) => s + r.points, 0));

/** Prochain palier d'un compteur (ou null). */
export const nextReward = (state, key) => REWARDS.find((r) => r.goal === key && r.count > goalCount(state, key)) || null;

/** Nom d'un palier : son titre, ou « compteur ×seuil ». */
export const rewardName = (r) => (r.title ? r.title.name : `${ACHIEVEMENTS[r.goal].name} ×${r.count}`);

/** Fait progresser un compteur ; les paliers franchis sont annoncés. */
export function bumpGoal(state, key, t, n = 1) {
  setGoal(state, key, goalCount(state, key) + n, t);
}

/** Fixe un compteur (les étoiles suivent le nombre de legs). */
export function setGoal(state, key, value, t) {
  state.goals ||= {};
  const before = goalCount(state, key);
  if (value <= before) return;
  state.goals[key] = value;
  for (const r of REWARDS.filter((x) => x.goal === key && x.count > before && x.count <= value)) {
    const name = rewardName(r);
    addLog(state, t, 'good', `🏅 Succès débloqué : ${r.title ? `le titre « ${name} »` : name} (+${r.points} points).`);
    (state.notices ||= []).push({ kind: 'goal', reward: REWARDS.indexOf(r) });
  }
}

/** Choisir le titre affiché (index d'un palier à titre déjà atteint, ou null pour aucun). */
export function setTitle(state, index) {
  if (index === null) { state.title = null; return { ok: true }; }
  const r = REWARDS[index];
  if (!r || !r.title) return { ok: false, error: 'Ce titre n\'existe pas.' };
  if (goalCount(state, r.goal) < r.count) return { ok: false, error: 'Vous n\'avez pas encore débloqué ce titre.' };
  state.title = index;
  return { ok: true };
}

/** Titre choisi appliqué à un nom : « Hôtelier Lou » ou « Lou du Béton ». */
export function titled(state, name) {
  const r = state.title != null ? REWARDS[state.title] : null;
  if (!r?.title) return name;
  return r.title.pos === 'suffix' ? `${name} ${r.title.name}` : `${r.title.name} ${name}`;
}
