// =============================================================================
// Stockage de la partie, derrière une interface commune :
//   load() -> Promise<state|null>,  save(state) -> Promise<void>,  reset()
// Étape 1 : LocalStore (navigateur). Étape 2 : SupabaseStore (serveur qui fait
// foi) implémentera la même interface sans toucher au reste du client.
// =============================================================================

import { migrate } from '../engine/index.js';

const KEY = 'pokemotel.save';

export class LocalStore {
  async load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const state = JSON.parse(raw);
      return migrate(state); // ancienne version : mise à niveau (ou nouvelle partie si incompatible)
    } catch {
      return null;
    }
  }

  async save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // stockage indisponible (navigation privée...) : on continue sans sauvegarder
    }
  }

  async reset() {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }
}

/** Préférences purement locales (dernier journal lu, décalage d'horloge de test...). */
export const prefs = {
  get(name, fallback = null) {
    try {
      const v = localStorage.getItem(`pokemotel.pref.${name}`);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(name, value) {
    try { localStorage.setItem(`pokemotel.pref.${name}`, JSON.stringify(value)); } catch { /* ignore */ }
  },
};
