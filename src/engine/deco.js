// =============================================================================
// Décoration (règles de CroqueMotel, d'après la réécriture Eternaltwin) :
//   - habillage par ÉTAGE : peinture (24 teintes : 12 vives, 12 douces),
//     papier peint (7 motifs), bas de mur et bande du milieu ; chaque objet de
//     déco tire une valeur DIFFÉRENTE de l'actuelle ;
//   - mobilier libre (7 familles) : tiré d'un carton surprise, rangé dans la
//     réserve, posé où l'on veut dans une pièce (au sol ou au mur).
// =============================================================================

import { ITEMS } from './data.js';
import { rngFor } from './rng.js';
import { addLog, roomLabel } from './model.js';
import { questEvent } from './progression.js';

/** 12 teintes vives puis 12 douces. */
export const WALL_COLORS_WARM = ['#ba2323', '#e77105', '#e7ca01', '#40499f', '#1e64ce', '#0199cb', '#75ced2', '#70bd06', '#c1cb03', '#a547bc', '#c55f94', '#f480b7'];
export const WALL_COLORS_COOL = ['#633f29', '#7c5f32', '#98832c', '#6b507a', '#aa5962', '#2d603c', '#6da074', '#aeb98e', '#84719d', '#c0af87', '#2c4354', '#91b9af'];
export const WALL_COLORS = [...WALL_COLORS_WARM, ...WALL_COLORS_COOL];
export const WALLPAPER_COUNT = 7;
export const BOTTOM_COUNT = 4;
export const MID_COUNT = 5;

/**
 * Familles de mobilier : variantes dessinées, poids du tirage, position, et
 * largeur `w` (en largeurs de pièce : un canapé fait près de la moitié d'une pièce).
 */
export const DECO_FAMILIES = {
  plant_small: { variants: 4, weight: 9, position: 'ground',   w: 0.16, name: 'Petite plante bizarre' },
  plant_large: { variants: 3, weight: 7, position: 'ground',   w: 0.24, name: 'Grande plante encombrante' },
  painting:    { variants: 4, weight: 9, position: 'floating', w: 0.24, name: 'Petit tableau de maître' },
  light:       { variants: 2, weight: 6, position: 'floating', w: 0.15, name: 'Luminaire classieux' },
  furniture:   { variants: 3, weight: 5, position: 'ground',   w: 0.30, name: 'Meuble rustique' },
  sofa:        { variants: 3, weight: 4, position: 'ground',   w: 0.46, name: 'Canapé moelleux' },
  desk:        { variants: 1, weight: 0, position: 'ground',   w: 0.42, name: 'Bureau d\'accueil' },
};

/** Marge laissée de chaque côté d'un étage (en largeurs de pièce), comme les 5 px d'origine. */
export const DECO_MARGIN = 0.04;
export const DECO_TYPES = Object.keys(DECO_FAMILIES);

/** Habillage par défaut d'un étage (avant tout objet de déco). */
const DEFAULT_PAINTS = [1, 7, 10, 4, 2, 9];
export function defaultFloorDeco(f) {
  const i = Math.max(0, f - 1);
  return { paint: DEFAULT_PAINTS[i % DEFAULT_PAINTS.length], wallpaper: 1 + (i % 3), bottom: 0, mid: 0 };
}
/** Habillage d'un étage. */
export const floorDeco = (state, f) => state.floorDeco?.[f] || defaultFloorDeco(f);

/** Un nouvel étage reprend la déco de l'étage du dessous (comme dans l'original). */
export function inheritFloorDeco(state, f) {
  if (state.floorDeco?.[f] || !state.floorDeco?.[f - 1]) return;
  state.floorDeco[f] = { ...state.floorDeco[f - 1] };
}

/** Tire une valeur entière dans [min, max[ différente de `current`. */
function differentRandom(rng, current, min, max) {
  if (max - min <= 1) return min;
  let next = current;
  for (let guard = 0; next === current && guard < 100; guard++) next = min + Math.floor(rng.next() * (max - min));
  return next;
}

/** Applique un objet de déco (pot de peinture, papier peint, bas de mur) à un étage. */
export function applyDecoItem(state, itemId, floor, now) {
  const it = ITEMS[itemId];
  const rng = rngFor(state);
  const cur = { ...floorDeco(state, floor) };
  const warm = WALL_COLORS_WARM.length;
  switch (it.deco) {
    case 'paint': cur.paint = differentRandom(rng, cur.paint, 0, WALL_COLORS.length); break;
    case 'paintWarm': cur.paint = differentRandom(rng, cur.paint, 0, warm); break;
    case 'paintCool': cur.paint = differentRandom(rng, cur.paint, warm, WALL_COLORS.length); break;
    case 'wallpaper': cur.wallpaper = differentRandom(rng, cur.wallpaper, 1, WALLPAPER_COUNT + 1); break;
    case 'bottom':
      cur.bottom = differentRandom(rng, cur.bottom, 1, BOTTOM_COUNT + 1);
      cur.mid = differentRandom(rng, cur.mid, 1, MID_COUNT + 1);
      break;
    default: return false;
  }
  (state.floorDeco ||= {})[floor] = cur;
  addLog(state, now, 'good', `🎨 ${it.name} : l'étage ${floor} a changé de look !`);
  questEvent(state, 'decoChange', now);
  return true;
}

/** Tire une pièce de mobilier au hasard (le bureau d'accueil n'est jamais tiré). */
export function drawDeco(state) {
  const rng = rngFor(state);
  const pick = rng.weighted(DECO_TYPES.filter((t) => DECO_FAMILIES[t].weight > 0).map((t) => ({ id: t, weight: DECO_FAMILIES[t].weight })));
  return { type: pick.id, frame: rng.int(1, DECO_FAMILIES[pick.id].variants) };
}

/** Ajoute une pièce de mobilier à la réserve. */
export function addFurniture(state, piece) {
  state.nextDecoId ||= 1;
  // floor null = en réserve ; x : centre du meuble, en colonnes (2.5 = milieu de la colonne 2) ;
  // y : hauteur d'un objet mural (0 = plafond, 1 = sol), null pour le mobilier posé au sol.
  const p = { id: `d${state.nextDecoId++}`, type: piece.type, frame: piece.frame, floor: null, x: 0, y: null };
  (state.furniture ||= []).push(p);
  return p;
}

const ok = { ok: true };
const fail = (error) => ({ ok: false, error });

/** Ouvrir un carton de déco surprise : une pièce de mobilier arrive dans la réserve. */
export function openDecoBox(state, now) {
  if (!(state.inventory.randdeco > 0)) return fail('Vous n\'avez pas de carton de déco.');
  state.inventory.randdeco--;
  if (!state.inventory.randdeco) delete state.inventory.randdeco;
  const p = addFurniture(state, drawDeco(state));
  addLog(state, now, 'good', `📦 Carton ouvert : ${DECO_FAMILIES[p.type].name} ! Posez-le avec « Changer le mobilier ».`);
  return { ok: true, piece: p };
}

/** Colonnes couvertes par un étage : [min, max[ (null si l'étage n'existe pas). */
export function floorExtent(state, floor) {
  let min = Infinity;
  let max = -Infinity;
  for (const r of Object.values(state.rooms)) if (r.floor === floor) { min = Math.min(min, r.col); max = Math.max(max, r.col); }
  return min === Infinity ? null : { min, max: max + 1 };
}

/**
 * Poser (ou déplacer) un meuble n'importe où sur un étage, comme dans
 * CroqueMotel : il peut chevaucher deux pièces, et il reste en place si l'une
 * d'elles est démolie. x : centre du meuble en colonnes ; y : hauteur d'un
 * objet mural (0 = plafond, 1 = sol), ignorée pour le mobilier au sol.
 */
export function placeDeco(state, decoId, floor, x, y, now) {
  const p = (state.furniture || []).find((d) => d.id === decoId);
  if (!p) return fail('Meuble introuvable.');
  const ext = Number.isInteger(floor) ? floorExtent(state, floor) : null;
  if (!ext) return fail('Posez vos meubles sur un étage de l\'hôtel.');
  const fam = DECO_FAMILIES[p.type];
  const half = fam.w / 2 + DECO_MARGIN;
  const nx = Number.isFinite(x) ? x : ext.min + 0.5;
  const wasStored = p.floor == null;
  p.floor = floor;
  p.x = Math.round(Math.max(ext.min + half, Math.min(ext.max - half, nx)) * 1000) / 1000;
  p.y = fam.position === 'floating' ? Math.round(Math.max(0.12, Math.min(0.6, Number.isFinite(y) ? y : 0.3)) * 1000) / 1000 : null;
  if (wasStored) {
    addLog(state, now, 'info', `${fam.name} installé(e) ${floor === 0 ? 'au rez-de-chaussée' : `à l'étage ${floor}`}.`);
    questEvent(state, 'placeDeco', now);
  }
  return ok;
}

/** Ranger une pièce de mobilier dans la réserve. */
export function storeDeco(state, decoId) {
  const p = (state.furniture || []).find((x) => x.id === decoId);
  if (!p) return fail('Meuble introuvable.');
  if (p.floor == null) return fail('Ce meuble est déjà en réserve.');
  p.floor = null;
  p.y = null;
  return ok;
}

/** Meubles posés qui touchent une case (étage, colonne) : un meuble à cheval apparaît dans les deux. */
export function furnitureAt(state, floor, col) {
  return (state.furniture || []).filter((p) => p.floor === floor
    && p.x + DECO_FAMILIES[p.type].w / 2 > col && p.x - DECO_FAMILIES[p.type].w / 2 < col + 1);
}

