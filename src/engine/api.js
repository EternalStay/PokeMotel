// =============================================================================
// Point d'entrée unique des actions du joueur : `dispatch(state, name, args, now)`.
// C'est par ici que passera le serveur (Edge Function) : il rattrape le temps,
// refuse ce qui est inconnu, daté du passé ou pendant les comptes de minuit,
// puis appelle l'action. Une action refusée ne modifie jamais l'état.
// =============================================================================

import { ACTIONS } from './actions.js';
import { buyCampaign, bequeathHotel, restartHotel, setNeon, setManager, renameStaff } from './meta.js';
import { setTitle } from './achievements.js';
import { advance, isLocked } from './sim.js';

/** Toutes les actions du joueur, par nom. Signature : (state, ...args, now). */
export const ALL_ACTIONS = { ...ACTIONS, buyCampaign, bequeathHotel, restartHotel, setNeon, setManager, renameStaff, setTitle };

export function dispatch(state, name, args = [], now = Date.now()) {
  const fn = Object.hasOwn(ALL_ACTIONS, name) ? ALL_ACTIONS[name] : null;
  if (!fn) return { ok: false, error: `Action inconnue : ${name}.` };
  if (!Array.isArray(args)) return { ok: false, error: 'Arguments invalides.' };
  if (now < state.time) return { ok: false, error: 'Action datée du passé : l\'horloge de l\'hôtel ne recule pas.' };
  advance(state, now);
  if (isLocked(now)) return { ok: false, error: 'Le Consortium fait les comptes de minuit : revenez dans une minute.' };
  const res = fn(state, ...args, now);
  const out = res && typeof res.ok === 'boolean' ? res : { ok: true };
  // Ce que l'action a déclenché tout de suite (un client poussé à 0 ou 10, une
  // arrivée due dès maintenant…) est traité avant de rendre la main : l'état
  // est toujours entièrement à jour à la sortie de `dispatch`.
  if (out.ok) advance(state, now);
  return out;
}
