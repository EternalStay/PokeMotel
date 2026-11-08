// =============================================================================
// Planches de sprites animées (essai) : si des fichiers existent pour un type,
// ses Pokémon sont dessinées avec leurs images successives au lieu du SVG
// maison. Sans fichier, rien ne change.
//
// Fichiers (dans assets/sprites/) : <type>.png et/ou <type>1.png, <type>2.png…
// (jusqu'à 9, sans trou dans la numérotation). Chaque Pokémon reçoit une des
// planches de son type au hasard, et la garde pendant tout son séjour.
//
// Réglages : par type (SPRITE_TYPES), et au besoin par fichier (SPRITE_FILES,
// clé = nom du fichier sans « .png »).
//   cols / rows : images utilisées (en partant du coin haut gauche) ; une planche
//                 d'une seule ligne est détectée et lue sur cette seule ligne,
//   sheetCols   : nombre d'images par ligne sur la planche (taille d'une image
//                 = largeur de la planche / sheetCols), ou frameW / frameH en px,
//   frameMs     : durée d'une image, pixel : true pour du pixel art (pas de lissage).
// =============================================================================

import { TYPE_IDS } from '../engine/index.js';

const DEFAULTS = { cols: 4, rows: 2, sheetCols: 4, frameMs: 500, pixel: false };

/** Réglages par type (s'appliquent à toutes ses planches). Le nombre de lignes est détecté tout seul. */
export const SPRITE_TYPES = {};

/** Réglages d'une planche précise, ex. 'feu2': { rows: 1 }. */
export const SPRITE_FILES = {};

const MAX_VARIANTS = 9;
const DIR = 'assets/sprites/';
const sheets = {}; // type → planches chargées

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function makeSheet(name, img, type) {
  const cfg = { ...DEFAULTS, ...SPRITE_TYPES[type], ...SPRITE_FILES[name] };
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const fw = cfg.frameW ?? W / cfg.sheetCols;
  // Lignes réellement présentes : une planche d'une seule ligne (moins haute qu'une case
  // carrée) n'est lue que sur cette ligne, et ses images prennent toute sa hauteur.
  const available = cfg.frameH ? Math.floor(H / cfg.frameH) : Math.max(1, Math.round(H / fw));
  const rows = Math.min(cfg.rows, available);
  const fh = cfg.frameH ?? (available === 1 ? H : fw);
  const frames = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cfg.cols; c++) frames.push(`${c * fw} ${r * fh} ${fw} ${fh}`);
  return { ...cfg, src: img.src, w: W, h: H, frames };
}

/** Cherche les planches de chaque type ; `onReady` est rappelé quand un type en a trouvé. */
export function loadSprites(onReady) {
  for (const type of TYPE_IDS) {
    pending.add(type);
    (async () => {
      // Toutes les variantes sont demandées en même temps (plus rapide qu'une à une).
      const names = [type, ...Array.from({ length: MAX_VARIANTS }, (_, i) => `${type}${i + 1}`)];
      const imgs = await Promise.all(names.map((n) => loadImage(`${DIR}${n}.png`)));
      const found = [];
      if (imgs[0]) found.push(makeSheet(type, imgs[0], type));
      for (let n = 1; n < names.length && imgs[n]; n++) found.push(makeSheet(names[n], imgs[n], type));
      pending.delete(type);
      if (found.length) sheets[type] = found; // sinon : on garde le dessin maison
      onReady(type);
    })();
  }
}

/** Types dont les planches sont encore en cours de chargement. */
const pending = new Set();

/** Pokémon invisible (même cadre) le temps que les planches de son type arrivent. */
const PLACEHOLDER = '<svg class="creature sprite loading" viewBox="0 0 64 64" aria-hidden="true"></svg>';

/**
 * SVG animé du Pokémon (planche choisie selon `look`) ; une place vide tant que
 * les planches de son type se chargent ; null si ce type n'a aucune planche.
 */
export function spriteSVG(type, look = 0, extraClass = '', delay = 0) {
  if (pending.has(type)) return PLACEHOLDER;
  const list = sheets[type];
  if (!list) return null;
  const s = list[Math.abs(look) % list.length];
  const dur = (s.frames.length * s.frameMs) / 1000;
  return `<svg class="creature sprite ${extraClass}" viewBox="0 0 64 64" aria-hidden="true">
    <svg width="64" height="64" viewBox="${s.frames[0]}" preserveAspectRatio="xMidYMax meet">
      <image href="${s.src}" width="${s.w}" height="${s.h}"${s.pixel ? ' style="image-rendering:pixelated"' : ''}/>
      <animate attributeName="viewBox" values="${s.frames.join(';')}" dur="${dur}s" begin="${-delay}s" calcMode="discrete" repeatCount="indefinite"/>
    </svg></svg>`;
}
