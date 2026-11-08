// =============================================================================
// Générateur pseudo-aléatoire déterministe (mulberry32).
// Son état est un simple entier stocké dans la sauvegarde : le serveur pourra
// rejouer exactement la même simulation que le client.
// =============================================================================

/** Avance l'état et renvoie [nombre dans [0,1), nouvel état]. */
function step(seed) {
  let t = (seed + 0x6d2b79f5) >>> 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** Petit wrapper qui lit/écrit l'état RNG directement dans `state.rng`. */
export function rngFor(state) {
  return {
    /** Nombre dans [0, 1). */
    next() {
      const [v, s] = step(state.rng);
      state.rng = s;
      return v;
    },
    /** Entier dans [min, max] (bornes incluses). */
    int(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    /** Vrai avec la probabilité p. */
    chance(p) {
      return this.next() < p;
    },
    /** Élément au hasard d'un tableau. */
    pick(arr) {
      return arr[Math.floor(this.next() * arr.length)];
    },
    /** Élément au hasard selon des poids : items = [{ weight, ... }]. */
    weighted(items) {
      const total = items.reduce((s, it) => s + it.weight, 0);
      let r = this.next() * total;
      for (const it of items) {
        r -= it.weight;
        if (r < 0) return it;
      }
      return items[items.length - 1];
    },
  };
}

/** Graine initiale à partir d'un nombre quelconque. */
export function makeSeed(n = Date.now()) {
  return (Math.floor(n) ^ 0x9e3779b9) >>> 0;
}
