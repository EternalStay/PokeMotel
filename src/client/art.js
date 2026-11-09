// =============================================================================
// Illustrations du jeu, dessinées en SVG (aucun fichier image externe) :
// Pokémon, personnel, intérieurs de pièces, mobilier, équipements, décor.
// Toutes les fonctions renvoient des chaînes SVG.
// =============================================================================

import { spriteSVG } from './sprites.js';
import { TYPES, SPECIES, WALL_COLORS, floorDeco } from '../engine/index.js';

// -----------------------------------------------------------------------------
// Utilitaires
// -----------------------------------------------------------------------------
/** Mélange deux couleurs (#rrggbb) : t = 0 → a, t = 1 → b. */
const mix = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};

const lighten = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * amt));
  const g = Math.min(255, Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * amt));
  const b = Math.min(255, Math.round((n & 255) + (255 - (n & 255)) * amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

/** Palettes de papier peint par étage. */
export const WALLPAPERS = [
  { base: '#f4dcb4', pat: '#ebc994', curtain: '#c0392b', blanket: '#d35454' },
  { base: '#cfe6d2', pat: '#b5d6ba', curtain: '#2e7d5b', blanket: '#3f9b72' },
  { base: '#ecd0dc', pat: '#dfb6c8', curtain: '#8e3b6d', blanket: '#b34d88' },
  { base: '#d2dcf2', pat: '#b9c7e8', curtain: '#34528f', blanket: '#4a6fc0' },
  { base: '#f2e5ad', pat: '#e6d48a', curtain: '#a3741c', blanket: '#d19a2a' },
  { base: '#ddd0ee', pat: '#c9b8e3', curtain: '#5d3f99', blanket: '#7b59c2' },
];
const wpFor = (floor) => (floor - 1) % WALLPAPERS.length;

// -----------------------------------------------------------------------------
// Définitions globales (motifs, dégradés) — insérées une seule fois dans la page
// -----------------------------------------------------------------------------
export function globalDefs() {
  const wp = WALLPAPERS.map((w, i) => {
    const motif = [
      `<rect width="12" height="12" fill="${w.base}"/><rect x="0" width="4" height="12" fill="${w.pat}"/>`,
      `<rect width="12" height="12" fill="${w.base}"/><circle cx="3" cy="3" r="1.6" fill="${w.pat}"/><circle cx="9" cy="9" r="1.6" fill="${w.pat}"/>`,
      `<rect width="12" height="12" fill="${w.base}"/><path d="M6 1 L11 6 L6 11 L1 6Z" fill="none" stroke="${w.pat}" stroke-width="1.4"/>`,
    ][i % 3];
    return `<pattern id="wp${i}" width="12" height="12" patternUnits="userSpaceOnUse">${motif}</pattern>`;
  }).join('');
  // Motifs de papier peint « neutres » (posés par-dessus la teinte de l'étage).
  const ink = 'fill="#3a1f10" fill-opacity=".09"';
  const line = 'fill="none" stroke="#3a1f10" stroke-opacity=".12" stroke-width="1.3"';
  const motifs = [
    `<rect x="0" width="4" height="12" ${ink}/>`,
    `<circle cx="3" cy="3" r="1.6" ${ink}/><circle cx="9" cy="9" r="1.6" ${ink}/>`,
    `<path d="M6 1 L11 6 L6 11 L1 6Z" ${line}/>`,
    `<path d="M0 8 L3 4 L6 8 L9 4 L12 8" ${line}/>`,
    `<circle cx="6" cy="6" r="1.2" fill="#fff" fill-opacity=".45"/><path d="M6 2.5 v1.6 M6 8 v1.5 M2.5 6 h1.6 M8 6 h1.5" ${line}/>`,
    `<path d="M0 0 H12 M0 0 V12" ${line}/><rect x="0" y="0" width="6" height="6" fill="#fff" fill-opacity=".18"/>`,
    `<path d="M0 6 Q3 2 6 6 T12 6" ${line}/>`,
  ].map((m, i) => `<pattern id="wpm${i + 1}" width="12" height="12" patternUnits="userSpaceOnUse">${m}</pattern>`).join('');
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    ${wp}${motifs}
    <linearGradient id="rainbow" x1="0" x2="1"><stop offset="0" stop-color="#e53935"/><stop offset=".33" stop-color="#fdd835"/><stop offset=".66" stop-color="#43a047"/><stop offset="1" stop-color="#1e88e5"/></linearGradient>
    <pattern id="wood" width="30" height="8" patternUnits="userSpaceOnUse">
      <rect width="30" height="8" fill="#a8703f"/><rect y="0" width="30" height="1" fill="#8a5a31"/>
      <rect x="14" y="0" width="1" height="8" fill="#8a5a31"/><rect y="4" width="30" height="1" fill="#b98250" opacity=".5"/>
    </pattern>
    <pattern id="woodV" width="10" height="40" patternUnits="userSpaceOnUse">
      <rect width="10" height="40" fill="#c08850"/><rect width="1" height="40" fill="#97643a"/><rect x="5" y="0" width="1" height="40" fill="#d39a5f" opacity=".5"/>
    </pattern>
    <pattern id="tiles" width="10" height="10" patternUnits="userSpaceOnUse">
      <rect width="10" height="10" fill="#e6f3f7"/><path d="M0 0H10V10" fill="none" stroke="#b9d7e0" stroke-width="1"/>
    </pattern>
    <pattern id="checker" width="12" height="12" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill="#f6efe2"/><rect width="6" height="6" fill="#d9cdb7"/><rect x="6" y="6" width="6" height="6" fill="#d9cdb7"/>
    </pattern>
    <pattern id="concrete" width="16" height="16" patternUnits="userSpaceOnUse">
      <rect width="16" height="16" fill="#8d8a86"/><circle cx="4" cy="5" r=".8" fill="#77746f"/><circle cx="12" cy="11" r="1" fill="#9d9a95"/>
    </pattern>
    <pattern id="bricks" width="20" height="10" patternUnits="userSpaceOnUse">
      <rect width="20" height="10" fill="#9a4b36"/><path d="M0 0H20M0 5H20M5 0V5M15 5V10" stroke="#7e3a28" stroke-width="1"/>
    </pattern>
    <linearGradient id="win-day" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#cfeaff"/></linearGradient>
    <linearGradient id="win-dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a4a9c"/><stop offset=".6" stop-color="#ff8a65"/><stop offset="1" stop-color="#ffd27a"/></linearGradient>
    <linearGradient id="win-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f1438"/><stop offset="1" stop-color="#2b2f6b"/></linearGradient>
    <radialGradient id="glow-good"><stop offset="0" stop-color="#ffe9a0" stop-opacity=".95"/><stop offset="1" stop-color="#ffe9a0" stop-opacity="0"/></radialGradient>
    <radialGradient id="glow-mid"><stop offset="0" stop-color="#ffb35c" stop-opacity=".9"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>
    <radialGradient id="glow-bad"><stop offset="0" stop-color="#ff5a4f" stop-opacity=".85"/><stop offset="1" stop-color="#ff5a4f" stop-opacity="0"/></radialGradient>
    <radialGradient id="glow-off"><stop offset="0" stop-color="#fff3d1" stop-opacity=".35"/><stop offset="1" stop-color="#fff3d1" stop-opacity="0"/></radialGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fc3f7"/><stop offset="1" stop-color="#1565c0"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1a8"/><stop offset=".5" stop-color="#e2b33c"/><stop offset="1" stop-color="#a87a14"/></linearGradient>
  </defs></svg>`;
}

// -----------------------------------------------------------------------------
// Pokémon (dessin paramétrique : type + variante d'apparence + humeur)
// -----------------------------------------------------------------------------

/**
 * @param {{type: string, look?: number, star?: boolean}} g
 * @param {'good'|'mid'|'bad'} mood
 */
/**
 * Décalage d'animation propre à chaque Pokémon (0 à 1), tiré de son identifiant :
 * deux Pokémon au même dessin ne bougent plus en même temps.
 */
export function animPhase(g) {
  const key = `${g.id || ''}:${g.look || 0}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10007) / 10007;
}

/** Style d'un occupant : décalage du rebond, et petite balade gauche-droite dans sa chambre. */
export function occupantStyle(g) {
  const p = animPhase(g);
  const dur = 16 + Math.round(p * 12); // 16 à 28 s pour un aller-retour
  return `--d:${(-p * 2.6).toFixed(2)}s;--wd:${dur}s;--wdl:${(-p * dur).toFixed(1)}s;--wx:${(18 + Math.round(p * 16))}%`;
}

export function creatureSVG(g, mood = 'good', extraClass = '') {
  // Le décalage suit l'horloge : un Pokémon redessiné reprend là où il en était,
  // et chacun a sa propre phase.
  const sprite = spriteSVG(g.type, g.look || 0, extraClass, animPhase(g) * 60 + Date.now() / 1000, g.species && SPECIES[g.species] ? SPECIES[g.species].sprite : null);
  if (sprite) return sprite;
  const t = TYPES[g.type];
  const look = g.look || 0;
  const c = t.color;
  const d = t.dark;
  const belly = lighten(c, 0.55);
  const shape = look % 3;          // 0 rond, 1 poire, 2 haricot
  const eyes = Math.floor(look / 3) % 4;
  const ghost = g.type === 'spectre';

  const body = [
    'M32 14 C47 14 54 26 54 38 C54 51 45 58 32 58 C19 58 10 51 10 38 C10 26 17 14 32 14Z',
    'M32 16 C43 16 48 26 50 36 C53 50 46 58 32 58 C18 58 11 50 14 36 C16 26 21 16 32 16Z',
    'M32 10 C44 10 50 20 50 34 C50 50 43 58 32 58 C21 58 14 50 14 34 C14 20 20 10 32 10Z',
  ][shape];
  const ghostBody = 'M32 12 C46 12 53 24 53 38 L53 56 Q48 51 43.5 56 Q38 61 32 56 Q26 61 20.5 56 Q16 51 11 56 L11 38 C11 24 18 12 32 12Z';

  // Accessoires de type
  const deco = {
    normal: `<ellipse cx="18" cy="17" rx="6" ry="7" fill="${c}" stroke="${d}" stroke-width="2"/><ellipse cx="46" cy="17" rx="6" ry="7" fill="${c}" stroke="${d}" stroke-width="2"/>
             <ellipse cx="18" cy="17" rx="3" ry="4" fill="${belly}"/><ellipse cx="46" cy="17" rx="3" ry="4" fill="${belly}"/>`,
    feu: `<path class="flame" d="M32 2 C38 9 40 12 37 17 C36 13 34 13 33 16 C31 12 27 13 27 17 C24 12 27 7 32 2Z" fill="#ffd23f" stroke="#e8590c" stroke-width="1.6"/>
          <path class="flame" d="M55 46 C62 44 62 36 58 32 C58 37 56 38 54 38" fill="#ffd23f" stroke="#e8590c" stroke-width="1.6"/>`,
    eau: `<path d="M32 5 C36 10 37 13 37 15 C37 18 35 20 32 20 C29 20 27 18 27 15 C27 13 28 10 32 5Z" fill="#a9d6ff" stroke="${d}" stroke-width="1.8"/>
          <path d="M10 40 C4 38 3 32 6 30 C8 34 10 34 12 35" fill="${belly}" stroke="${d}" stroke-width="1.6"/>`,
    plante: `<path d="M32 15 C32 10 32 8 33 5" stroke="#3d8a2c" stroke-width="2.5" fill="none"/>
             <path d="M33 6 C40 0 47 3 46 8 C41 10 36 9 33 6Z" fill="#8fdc5f" stroke="#3d8a2c" stroke-width="1.6"/>
             <path d="M32 8 C26 2 19 5 20 10 C25 12 29 11 32 8Z" fill="#a6e86f" stroke="#3d8a2c" stroke-width="1.6"/>`,
    electrik: `<path d="M20 18 L14 4 L19 6 L17 0 L25 14Z" fill="${c}" stroke="${d}" stroke-width="1.6" stroke-linejoin="round"/>
               <path d="M44 18 L50 4 L45 6 L47 0 L39 14Z" fill="${c}" stroke="${d}" stroke-width="1.6" stroke-linejoin="round"/>
               <path d="M17 1 L19 6" stroke="#2b2b2b" stroke-width="2"/><path d="M47 1 L45 6" stroke="#2b2b2b" stroke-width="2"/>
               <path d="M54 44 L60 40 L56 40 L61 34" fill="none" stroke="${d}" stroke-width="2" stroke-linejoin="round"/>`,
    glace: `<path d="M22 16 L25 4 L28 14 L32 1 L36 14 L39 4 L42 16Z" fill="#e8fbff" stroke="${d}" stroke-width="1.6" stroke-linejoin="round"/>`,
    poison: `<circle cx="20" cy="30" r="3" fill="${d}" opacity=".55"/><circle cx="46" cy="44" r="4" fill="${d}" opacity=".55"/><circle cx="42" cy="22" r="2.4" fill="${d}" opacity=".55"/>
             <path d="M24 14 C22 8 26 6 28 9 C30 5 35 6 34 11" fill="${belly}" stroke="${d}" stroke-width="1.6"/>
             <circle class="bubble" cx="50" cy="12" r="2.5" fill="none" stroke="${d}" stroke-width="1.4"/>`,
    spectre: `<path d="M32 12 C30 6 33 3 36 4" fill="none" stroke="${d}" stroke-width="2" stroke-linecap="round"/>`,
    // Roche : crête de cailloux, fissures et mousse
    roche: `<path d="M17 20 L21 9 L27 15 L32 5 L37 15 L43 9 L47 20Z" fill="#c9bca8" stroke="${d}" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M22 13 L24 16 M40 12 L41 16" stroke="${d}" stroke-width="1.2"/>
            <path d="M47 30 L51 34 L49 38" fill="none" stroke="${d}" stroke-width="1.6" stroke-linecap="round"/>
            <path d="M14 46 L18 49 L16 53" fill="none" stroke="${d}" stroke-width="1.6" stroke-linecap="round"/>
            <ellipse cx="44" cy="52" rx="5" ry="2.4" fill="#7bbf5a" opacity=".85"/>`,
    // Insecte : antennes à boules et petites ailes
    insecte: `<path d="M26 16 C24 9 20 6 16 5" fill="none" stroke="${d}" stroke-width="2" stroke-linecap="round"/>
              <path d="M38 16 C40 9 44 6 48 5" fill="none" stroke="${d}" stroke-width="2" stroke-linecap="round"/>
              <circle cx="16" cy="5" r="3" fill="${c}" stroke="${d}" stroke-width="1.6"/><circle cx="48" cy="5" r="3" fill="${c}" stroke="${d}" stroke-width="1.6"/>
              <path class="wing" d="M12 30 C2 24 2 14 9 14 C13 18 14 24 14 30Z" fill="#e9fbff" stroke="${d}" stroke-width="1.4" opacity=".85"/>
              <path class="wing" d="M52 30 C62 24 62 14 55 14 C51 18 50 24 50 30Z" fill="#e9fbff" stroke="${d}" stroke-width="1.4" opacity=".85"/>
              <circle cx="22" cy="44" r="2.2" fill="${d}" opacity=".5"/><circle cx="42" cy="47" r="2.6" fill="${d}" opacity=".5"/>`,
    // Psy : gemme frontale et ondes
    psy: `<path d="M32 8 L37 14 L32 20 L27 14Z" fill="#ffd1ec" stroke="${d}" stroke-width="1.8" stroke-linejoin="round"/>
          <circle cx="32" cy="14" r="1.6" fill="#fff"/>
          <g class="psy-wave" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" opacity=".8">
            <path d="M15 11 Q11 16 15 21"/><path d="M10 8 Q4 16 10 24"/><path d="M49 11 Q53 16 49 21"/><path d="M54 8 Q60 16 54 24"/></g>`,
    // Combat : bandeau à pans et gants
    combat: `<path d="M13 23 Q32 15 51 23 L51 28 Q32 21 13 28Z" fill="#fff4e6" stroke="${d}" stroke-width="1.6"/>
             <path d="M51 25 L60 20 L58 27 L62 30 L52 28Z" fill="#fff4e6" stroke="${d}" stroke-width="1.4" stroke-linejoin="round"/>
             <circle cx="9" cy="45" r="6" fill="#d33a2c" stroke="#7d1a12" stroke-width="1.8"/><circle cx="55" cy="45" r="6" fill="#d33a2c" stroke="#7d1a12" stroke-width="1.8"/>
             <path d="M6 42 Q9 40 12 42" stroke="#fff" stroke-width="1.2" fill="none" opacity=".7"/><path d="M52 42 Q55 40 58 42" stroke="#fff" stroke-width="1.2" fill="none" opacity=".7"/>`,
  }[g.type] || '';
  const unstable = g.bombAt ? `<g class="spark"><path d="M50 6 L46 14 L51 13 L47 22" fill="none" stroke="#ffe14d" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M14 8 L18 15 L13 15 L17 22" fill="none" stroke="#ffe14d" stroke-width="2.4" stroke-linejoin="round"/></g>` : '';

  // Yeux
  const eyeY = shape === 2 ? 30 : 33;
  const eyesSvg = [
    // grands yeux brillants
    `<g class="eyes"><ellipse cx="24" cy="${eyeY}" rx="4.6" ry="5.6" fill="#1f1a2e"/><ellipse cx="40" cy="${eyeY}" rx="4.6" ry="5.6" fill="#1f1a2e"/>
     <circle cx="25.6" cy="${eyeY - 2}" r="1.8" fill="#fff"/><circle cx="41.6" cy="${eyeY - 2}" r="1.8" fill="#fff"/></g>`,
    // yeux ronds avec blanc
    `<g class="eyes"><circle cx="24" cy="${eyeY}" r="5.5" fill="#fff" stroke="${d}" stroke-width="1.4"/><circle cx="40" cy="${eyeY}" r="5.5" fill="#fff" stroke="${d}" stroke-width="1.4"/>
     <circle cx="25" cy="${eyeY + 1}" r="2.6" fill="#1f1a2e"/><circle cx="39" cy="${eyeY + 1}" r="2.6" fill="#1f1a2e"/></g>`,
    // petits points
    `<g class="eyes"><circle cx="25" cy="${eyeY}" r="2.8" fill="#1f1a2e"/><circle cx="39" cy="${eyeY}" r="2.8" fill="#1f1a2e"/>
     <circle cx="25.8" cy="${eyeY - 1}" r=".9" fill="#fff"/><circle cx="39.8" cy="${eyeY - 1}" r=".9" fill="#fff"/></g>`,
    // cyclope
    `<g class="eyes"><circle cx="32" cy="${eyeY - 1}" r="7.5" fill="#fff" stroke="${d}" stroke-width="1.6"/><circle cx="33" cy="${eyeY}" r="3.6" fill="#1f1a2e"/>
     <circle cx="34.4" cy="${eyeY - 1.6}" r="1.2" fill="#fff"/></g>`,
  ][eyes];

  const my = eyeY + 11;
  const mouth = {
    good: `<path d="M26 ${my - 1} Q32 ${my + 6} 38 ${my - 1}" fill="#7a2335" stroke="#3a1420" stroke-width="1.4"/><path d="M29 ${my + 2} Q32 ${my + 4} 35 ${my + 2}" fill="#ff8fa3"/>`,
    mid: `<path d="M27 ${my + 1} L37 ${my + 1}" stroke="#3a1420" stroke-width="2" stroke-linecap="round"/>`,
    bad: `<path d="M26 ${my + 3} Q32 ${my - 3} 38 ${my + 3}" fill="none" stroke="#3a1420" stroke-width="2" stroke-linecap="round"/>
          <path d="M19 ${eyeY - 9} L28 ${eyeY - 6}" stroke="#3a1420" stroke-width="2" stroke-linecap="round"/><path d="M45 ${eyeY - 9} L36 ${eyeY - 6}" stroke="#3a1420" stroke-width="2" stroke-linecap="round"/>`,
  }[mood];

  const cheeks = mood === 'good' ? `<ellipse cx="17" cy="${eyeY + 7}" rx="3.5" ry="2" fill="#ff7a8a" opacity=".55"/><ellipse cx="47" cy="${eyeY + 7}" rx="3.5" ry="2" fill="#ff7a8a" opacity=".55"/>` : '';
  const feet = ghost ? '' : `<ellipse cx="23" cy="58" rx="7" ry="4" fill="${d}"/><ellipse cx="41" cy="58" rx="7" ry="4" fill="${d}"/>`;
  const arms = ghost ? '' : `<ellipse cx="11" cy="43" rx="4" ry="6" fill="${c}" stroke="${d}" stroke-width="2" transform="rotate(25 11 43)"/>
                             <ellipse cx="53" cy="43" rx="4" ry="6" fill="${c}" stroke="${d}" stroke-width="2" transform="rotate(-25 53 43)"/>`;
  const star = g.star ? `<g class="star-gear"><path d="M21 ${eyeY - 4} H43 L41 ${eyeY + 4} H34 L32 ${eyeY} L30 ${eyeY + 4} H23Z" fill="#1d1d2b"/>
      <path d="M24 ${eyeY - 3} L27 ${eyeY - 3}" stroke="#7af" stroke-width="1.2"/>
      <path d="M24 9 L28 2 L32 8 L36 2 L40 9Z" fill="url(#gold)" stroke="#8a6410" stroke-width="1.2"/></g>` : '';

  return `<svg class="creature ${extraClass} ${ghost ? 'ghost' : ''}" viewBox="0 0 64 64" aria-hidden="true">
    <ellipse cx="32" cy="61" rx="17" ry="3" fill="#000" opacity=".22" class="shadow"/>
    <g class="body-wrap">
      ${feet}${arms}
      <path d="${ghost ? ghostBody : body}" fill="${c}" stroke="${d}" stroke-width="2.2" ${ghost ? 'opacity=".88"' : ''}/>
      <ellipse cx="32" cy="${shape === 2 ? 46 : 47}" rx="${ghost ? 11 : 13}" ry="9" fill="${belly}" opacity=".9"/>
      <path d="M20 20 Q25 16 30 16" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".55"/>
      ${deco}${eyesSvg}${mouth}${cheeks}${star}${unstable}
    </g>
  </svg>`;
}

/** Employé (groom) — même style que les Pokémon, en uniforme. */
export function staffSVG(s, tool = null) {
  const hue = ['#c0392b', '#2e86de', '#16a085', '#8e44ad', '#d35400'][s.look % 5];
  const toolSvg = {
    repair: '<g transform="translate(44 30) rotate(-30)"><rect x="-1.5" y="0" width="3" height="16" rx="1" fill="#7a5236"/><rect x="-6" y="-4" width="12" height="6" rx="1.5" fill="#9aa4ad" stroke="#555" stroke-width="1"/></g>',
    care: '<g transform="translate(47 30)"><path d="M0 4 C0 0 6 0 6 4 C6 0 12 0 12 4 C12 9 6 12 6 14 C6 12 0 9 0 4Z" fill="#ff6b81" stroke="#b33" stroke-width="1"/></g>',
    lobby: '',
  }[tool] || '';
  return `<svg class="creature staff" viewBox="0 0 64 64" aria-hidden="true">
    <ellipse cx="32" cy="61" rx="15" ry="3" fill="#000" opacity=".22"/>
    <g class="body-wrap">
      <ellipse cx="25" cy="58" rx="6" ry="3.5" fill="#2b2b3a"/><ellipse cx="39" cy="58" rx="6" ry="3.5" fill="#2b2b3a"/>
      <path d="M17 40 C17 30 24 26 32 26 C40 26 47 30 47 40 L47 52 C47 57 42 58 32 58 C22 58 17 57 17 52Z" fill="${hue}" stroke="#2b1b1b" stroke-width="2"/>
      <path d="M32 27 V57" stroke="#f1c40f" stroke-width="1.6" stroke-dasharray="2 4"/>
      <circle cx="32" cy="22" r="13" fill="#f5d0a9" stroke="#8a5a3a" stroke-width="2"/>
      <rect x="21" y="6" width="22" height="9" rx="2" fill="${hue}" stroke="#2b1b1b" stroke-width="2"/>
      <rect x="19" y="13" width="26" height="3.5" rx="1.5" fill="#2b1b1b"/>
      <g class="eyes"><circle cx="27" cy="22" r="2.2" fill="#1f1a2e"/><circle cx="37" cy="22" r="2.2" fill="#1f1a2e"/></g>
      <path d="M28 28 Q32 31 36 28" fill="none" stroke="#6b2b2b" stroke-width="1.6" stroke-linecap="round"/>
      ${toolSvg}
    </g>
  </svg>`;
}

// -----------------------------------------------------------------------------
// Équipements (petits dessins 24×24, réutilisés dans la boutique et l'inventaire)
// -----------------------------------------------------------------------------
const ITEM_ART = {
  radiateur: `<rect x="3" y="8" width="18" height="13" rx="2" fill="#d7dde3" stroke="#6b7680" stroke-width="1.2"/>
    <path d="M7 9V20M11 9V20M15 9V20M19 9V20" stroke="#9aa5ae" stroke-width="1.6"/><rect x="3" y="20" width="18" height="2" fill="#ff7043"/>
    <path class="heat" d="M8 6 Q9 4 8 2M12 6 Q13 4 12 2M16 6 Q17 4 16 2" stroke="#ff7043" stroke-width="1.2" fill="none"/>`,
  brumisateur: `<rect x="8" y="9" width="8" height="13" rx="3" fill="#f5fbff" stroke="#5b8bb5" stroke-width="1.2"/><rect x="10" y="6" width="4" height="4" fill="#5b8bb5"/>
    <circle class="mist" cx="7" cy="5" r="2" fill="#9fd3ff"/><circle class="mist" cx="12" cy="2.5" r="1.6" fill="#9fd3ff"/><circle class="mist" cx="17" cy="5" r="2" fill="#9fd3ff"/>`,
  jungle: `<path d="M7 15H17L15.5 22H8.5Z" fill="#c4683b" stroke="#7d3c1f" stroke-width="1.1"/>
    <path d="M12 15 C11 9 6 7 3 8 C5 12 8 14 12 15Z M12 15 C13 9 18 6 21 7 C19 11 16 14 12 15Z M12 15 C12 9 12 5 12 2 C14 6 14 11 12 15Z" fill="#5cc254" stroke="#2e7d32" stroke-width="1"/>`,
  plasma: `<rect x="7" y="18" width="10" height="4" rx="1" fill="#2b2b3a"/><circle cx="12" cy="11" r="7.5" fill="#3a1f6b" stroke="#b39ddb" stroke-width="1.2" opacity=".95"/>
    <path class="zap" d="M12 11 L7 6 M12 11 L17 7 M12 11 L16 16 M12 11 L6 14" stroke="#e1bee7" stroke-width="1.1"/><circle cx="12" cy="11" r="2" fill="#f3e5f5"/>`,
  clim: `<rect x="2" y="6" width="20" height="9" rx="2.5" fill="#f4fbff" stroke="#6e9bb5" stroke-width="1.2"/><path d="M5 12H19" stroke="#6e9bb5" stroke-width="1.2"/>
    <path class="mist" d="M7 17 L6 21 M12 17 V22 M17 17 L18 21" stroke="#7fd6e6" stroke-width="1.4" stroke-linecap="round"/>`,
  compost: `<path d="M5 9H19L17.5 22H6.5Z" fill="#558b2f" stroke="#2e5016" stroke-width="1.1"/><rect x="4" y="7" width="16" height="3" rx="1" fill="#33691e"/>
    <path class="stink" d="M8 5 Q6 3 8 1M12 5 Q10 3 12 1M16 5 Q14 3 16 1" stroke="#a14fc4" stroke-width="1.3" fill="none"/>`,
  enceinte: `<rect x="6" y="3" width="12" height="19" rx="2" fill="#2b2b3a" stroke="#111" stroke-width="1"/><circle cx="12" cy="9" r="3" fill="#555" stroke="#888"/>
    <circle class="boom" cx="12" cy="16.5" r="4" fill="#444" stroke="#999"/><circle cx="12" cy="16.5" r="1.4" fill="#222"/>`,
  hammam: `<path d="M5 12H19L17 22H7Z" fill="#a1683a" stroke="#6d4320" stroke-width="1.1"/><path d="M5 15H19M6 19H18" stroke="#6d4320" stroke-width="1"/>
    <path class="heat" d="M9 9 Q7 6 9 3M14 9 Q12 6 14 3" stroke="#b0d8ff" stroke-width="1.6" fill="none"/>`,
  fondue: `<path d="M4 12H20 C20 18 17 21 12 21 C7 21 4 18 4 12Z" fill="#c0392b" stroke="#7b1f16" stroke-width="1.1"/><ellipse cx="12" cy="12" rx="8" ry="2.5" fill="#ffd54f"/>
    <path d="M10 13 L4 3" stroke="#888" stroke-width="1.2"/><path class="stink" d="M15 8 Q13 6 15 3M19 8 Q17 6 19 3" stroke="#a14fc4" stroke-width="1.2" fill="none"/>`,
  nounours: `<circle cx="7" cy="6" r="3" fill="#b07a4a" stroke="#6d4320" stroke-width="1"/><circle cx="17" cy="6" r="3" fill="#b07a4a" stroke="#6d4320" stroke-width="1"/>
    <circle cx="12" cy="10" r="6" fill="#c98d57" stroke="#6d4320" stroke-width="1.1"/><ellipse cx="12" cy="18" rx="7" ry="5" fill="#c98d57" stroke="#6d4320" stroke-width="1.1"/>
    <ellipse cx="12" cy="12" rx="2.6" ry="2" fill="#f3d3a8"/><circle cx="9.8" cy="9" r=".9" fill="#2b1b1b"/><circle cx="14.2" cy="9" r=".9" fill="#2b1b1b"/><circle cx="12" cy="11.4" r=".8" fill="#2b1b1b"/>
    <path d="M10 18 l2 1.6 2 -1.6" fill="none" stroke="#e53935" stroke-width="1.4"/>`,
  matelas: `<path d="M4 18 C1 18 1 13 5 13 C5 9 10 8 12 11 C14 7 20 8 20 13 C24 13 24 18 20 18Z" fill="#fff" stroke="#9fb3d9" stroke-width="1.3"/>
    <path d="M7 15 H17" stroke="#d6e0f5" stroke-width="1.2"/>`,
  baldaquin: `<path d="M3 6 Q12 1 21 6 L21 8 Q12 4 3 8Z" fill="url(#gold)" stroke="#8a6410" stroke-width="1"/><path d="M4 8 V22 M20 8 V22" stroke="#c99a2e" stroke-width="2"/>
    <path d="M4 8 Q7 14 5 21 M20 8 Q17 14 19 21" fill="none" stroke="#b33" stroke-width="1.6"/><rect x="5" y="16" width="14" height="5" rx="1.5" fill="#fff3e0" stroke="#c99a2e"/>`,
  malle: `<rect x="3" y="9" width="18" height="12" rx="2" fill="#8d5a2b" stroke="#4e2f12" stroke-width="1.1"/><path d="M3 13H21" stroke="#4e2f12" stroke-width="1.1"/>
    <rect x="10" y="11" width="4" height="5" rx="1" fill="url(#gold)" stroke="#8a6410" stroke-width=".8"/><path d="M6 9V21M18 9V21" stroke="#c99a2e" stroke-width="1.4"/>`,
  cocon: `<rect x="3" y="3" width="18" height="18" rx="5" fill="#e8e1f5" stroke="#8c7ab8" stroke-width="1.3"/>
    <path d="M3 9 L9 3 M3 15 L15 3 M3 21 L21 3 M9 21 L21 9 M15 21 L21 15" stroke="#c8bce3" stroke-width="1"/><circle cx="12" cy="12" r="2" fill="#8c7ab8"/>`,
  randpaint: `<path d="M6 9 H18 V20 a2 2 0 0 1 -2 2 H8 a2 2 0 0 1 -2 -2Z" fill="#eceff1" stroke="#546e7a"/><path d="M6 9 H18 V13 H6Z" fill="url(#rainbow)"/><path d="M6 9 Q12 3 18 9" fill="none" stroke="#546e7a"/><path d="M9 13 v3 a1.2 1.2 0 0 0 2.4 0 v-3" fill="#e53935"/>`,
  randpaintwarm: `<path d="M6 9 H18 V20 a2 2 0 0 1 -2 2 H8 a2 2 0 0 1 -2 -2Z" fill="#eceff1" stroke="#546e7a"/><path d="M6 9 H18 V13 H6Z" fill="#e77105"/><path d="M6 9 Q12 3 18 9" fill="none" stroke="#546e7a"/><path d="M14 13 v4 a1.2 1.2 0 0 0 2.4 0 v-4" fill="#ba2323"/>`,
  randpaintcool: `<path d="M6 9 H18 V20 a2 2 0 0 1 -2 2 H8 a2 2 0 0 1 -2 -2Z" fill="#eceff1" stroke="#546e7a"/><path d="M6 9 H18 V13 H6Z" fill="#6da074"/><path d="M6 9 Q12 3 18 9" fill="none" stroke="#546e7a"/><path d="M9 13 v3 a1.2 1.2 0 0 0 2.4 0 v-3" fill="#84719d"/>`,
  randtexture: `<rect x="3" y="6" width="14" height="14" rx="1" fill="#f4dcb4" stroke="#a1887f"/><path d="M5 6 V20 M9 6 V20 M13 6 V20" stroke="#e0b07a" stroke-width="1.6"/><ellipse cx="18" cy="13" rx="3" ry="7" fill="#fff3e0" stroke="#a1887f"/><ellipse cx="18" cy="13" rx="1.2" ry="3" fill="#d7ccc8"/>`,
  randbottom: `<rect x="3" y="4" width="18" height="16" rx="1" fill="#f4dcb4" stroke="#a1887f"/><rect x="3" y="12" width="18" height="8" fill="url(#woodV)" stroke="#6d4426"/><rect x="3" y="10.5" width="18" height="2" fill="url(#gold)"/>`,
  randdeco: `<path d="M3 9 L12 5 L21 9 V19 L12 23 L3 19Z" fill="#d7a35b" stroke="#7a5236"/><path d="M3 9 L12 13 L21 9 M12 13 V23" stroke="#7a5236" fill="none"/><path d="M7 7 L16 11" stroke="#f4e3c3" stroke-width="2"/><text x="12" y="20" text-anchor="middle" font-size="7" font-weight="900" fill="#5a3d00">?</text>`,
  feux: `<rect x="5" y="16" width="5" height="7" fill="#e53935" stroke="#8e1b19" stroke-width=".9"/><rect x="10.5" y="13" width="5" height="10" fill="#1e88e5" stroke="#0d47a1" stroke-width=".9"/><rect x="16" y="17" width="4" height="6" fill="#fdd835" stroke="#a87b00" stroke-width=".9"/>
    <path d="M7.5 16 V14 M13 13 V10.5 M18 17 V15" stroke="#5d4037" stroke-width=".9"/>
    <g class="sparkle"><path d="M13 2 V6 M11 4 H15 M11.6 2.6 L14.4 5.4 M14.4 2.6 L11.6 5.4" stroke="#ff80ab" stroke-width="1.1" stroke-linecap="round"/></g>
    <circle cx="5" cy="8" r="1" fill="#fdd835"/><circle cx="20" cy="9" r="1" fill="#80deea"/>`,
  extincteur: `<rect x="8" y="6" width="8" height="16" rx="3" fill="#e53935" stroke="#8e1b19" stroke-width="1.1"/><rect x="9" y="11" width="6" height="4" fill="#fff" opacity=".85"/>
    <path d="M12 6 V3 H17 L19 6" fill="none" stroke="#333" stroke-width="1.4"/>`,
  paratonnerre: `<path d="M12 2 V20" stroke="#78909c" stroke-width="2"/><path d="M7 22 H17" stroke="#546e7a" stroke-width="2.4"/>
    <path class="zap" d="M15 5 L11 11 H14 L10 17" fill="none" stroke="#ffd23f" stroke-width="1.6" stroke-linejoin="round"/>`,
  panier: `<path d="M3 11H21L18.5 21H5.5Z" fill="#d7a35b" stroke="#8a5a1f" stroke-width="1.1"/><path d="M7 11 C7 4 17 4 17 11" fill="none" stroke="#8a5a1f" stroke-width="1.6"/>
    <circle cx="9" cy="10" r="2.4" fill="#e53935"/><circle cx="14" cy="9.5" r="2.4" fill="#fdd835"/><path d="M6 15H18M7 18H17" stroke="#b07c3a" stroke-width="1"/>`,
  coffret: `<rect x="3" y="9" width="18" height="13" rx="1.5" fill="#7b1fa2" stroke="#3f0d57" stroke-width="1.1"/><rect x="2" y="7" width="20" height="4" rx="1" fill="#9c27b0" stroke="#3f0d57"/>
    <path d="M12 7 V22" stroke="url(#gold)" stroke-width="2.4"/><path d="M12 7 C8 1 5 5 9 7 M12 7 C16 1 19 5 15 7" fill="none" stroke="#e2b33c" stroke-width="1.6"/>`,
  kit: `<rect x="3" y="8" width="18" height="13" rx="2" fill="#f9a825" stroke="#8d5c00" stroke-width="1.1"/><path d="M9 8 V5 H15 V8" fill="none" stroke="#8d5c00" stroke-width="1.4"/>
    <path d="M12 11 V18 M8.5 14.5 H15.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
};

/** Dessin d'un objet seul (boutique, inventaire). */
export function itemSVG(id, cls = 'item-icon') {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ITEM_ART[id] || ''}</svg>`;
}

// -----------------------------------------------------------------------------
// Intérieurs des pièces (viewBox 120×100)
// -----------------------------------------------------------------------------
const W = 120;
const H = 100;

function wallAndFloor(fill, floorFill = 'url(#wood)') {
  return `<rect width="${W}" height="${H}" fill="${fill}"/>
    <rect width="${W}" height="4" fill="#000" opacity=".12"/>
    <rect y="84" width="${W}" height="16" fill="${floorFill}"/>
    <rect y="81" width="${W}" height="3.5" fill="#6d4426"/>`;
}

function windowArt(x, y, w, h, curtain) {
  return `<g class="win">
    <rect x="${x - 2}" y="${y - 2}" width="${w + 4}" height="${h + 4}" rx="2" fill="#fff4dd" stroke="#8b6b4a" stroke-width="1.2"/>
    <rect class="glass" x="${x}" y="${y}" width="${w}" height="${h}" rx="1"/>
    <g class="win-stars"><circle cx="${x + 6}" cy="${y + 6}" r=".9" fill="#fff"/><circle cx="${x + w - 7}" cy="${y + 10}" r=".8" fill="#fff"/><circle cx="${x + w / 2}" cy="${y + 4}" r=".7" fill="#fff"/></g>
    <path d="M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}" stroke="#fff4dd" stroke-width="1.6"/>
    <path d="M${x - 3} ${y - 3} Q${x + 3} ${y + h / 2} ${x - 1} ${y + h + 3} L${x - 5} ${y + h + 3} L${x - 5} ${y - 3}Z" fill="${curtain}"/>
    <path d="M${x + w + 3} ${y - 3} Q${x + w - 3} ${y + h / 2} ${x + w + 1} ${y + h + 3} L${x + w + 5} ${y + h + 3} L${x + w + 5} ${y - 3}Z" fill="${curtain}"/>
    <rect x="${x - 6}" y="${y - 5}" width="${w + 12}" height="2.5" rx="1" fill="#7a5236"/>
  </g>`;
}

function ceilingLamp(x, glow = 'off', fancy = false) {
  const lamp = fancy
    ? `<path d="M${x} 4 V10" stroke="#8a6410" stroke-width="1.2"/><path d="M${x - 10} 14 Q${x} 8 ${x + 10} 14" fill="none" stroke="url(#gold)" stroke-width="2.4"/>
       <circle cx="${x - 10}" cy="15" r="2" fill="#fff6c8"/><circle cx="${x}" cy="13" r="2" fill="#fff6c8"/><circle cx="${x + 10}" cy="15" r="2" fill="#fff6c8"/>
       <path d="M${x - 6} 17 L${x - 6} 21 M${x + 6} 17 L${x + 6} 21" stroke="#bfe7ff" stroke-width="1.2"/>`
    : `<path d="M${x} 3 V10" stroke="#333" stroke-width="1"/><path d="M${x - 7} 16 L${x - 4} 10 H${x + 4} L${x + 7} 16Z" fill="#f6c453" stroke="#9a6d12" stroke-width="1"/>
       <circle cx="${x}" cy="17" r="2.3" fill="#fff6c8"/>`;
  return `<ellipse class="lamp-glow" cx="${x}" cy="44" rx="40" ry="40" fill="url(#glow-${glow})"/>${lamp}`;
}

function bedArt(level, blanket) {
  if (level >= 3) {
    return `<g>
      <path d="M8 46 Q34 36 60 46 L60 50 Q34 41 8 50Z" fill="url(#gold)" stroke="#8a6410" stroke-width="1"/>
      <path d="M10 49 V82 M58 49 V82" stroke="#c99a2e" stroke-width="2.6"/>
      <path d="M10 50 Q15 62 12 74" fill="none" stroke="#a5232e" stroke-width="3"/><path d="M58 50 Q53 62 56 74" fill="none" stroke="#a5232e" stroke-width="3"/>
      <rect x="12" y="56" width="44" height="10" rx="3" fill="url(#gold)" stroke="#8a6410"/>
      <rect x="12" y="66" width="46" height="9" rx="3" fill="#fffaf0" stroke="#d8c7a5"/>
      <rect x="14" y="62" width="14" height="6" rx="3" fill="#fff" stroke="#d8c7a5"/>
      <path d="M28 66 H58 V75 Q43 79 28 75Z" fill="${blanket}" stroke="#00000033"/>
      <path d="M33 70 H55" stroke="#ffffff66" stroke-width="1.5"/>
      <rect x="12" y="75" width="46" height="5" rx="1.5" fill="#8a6410"/>
    </g>`;
  }
  if (level === 2) {
    return `<g>
      <path d="M8 52 Q8 44 18 44 H50 Q60 44 60 52 V66 H8Z" fill="#7b4a2b" stroke="#4a2a15" stroke-width="1.2"/>
      <circle cx="20" cy="52" r="1.4" fill="#4a2a15"/><circle cx="34" cy="52" r="1.4" fill="#4a2a15"/><circle cx="48" cy="52" r="1.4" fill="#4a2a15"/>
      <rect x="10" y="64" width="50" height="10" rx="3" fill="#fffaf0" stroke="#d8c7a5"/>
      <rect x="12" y="60" width="14" height="7" rx="3" fill="#fff" stroke="#d8c7a5"/>
      <path d="M27 64 H60 V74 Q44 78 27 74Z" fill="${blanket}" stroke="#00000033"/>
      <rect x="10" y="74" width="50" height="6" rx="1.5" fill="#5a341c"/>
      <ellipse cx="34" cy="90" rx="30" ry="4" fill="#b84a4a" opacity=".7"/>
    </g>`;
  }
  return `<g>
    <rect x="8" y="52" width="6" height="28" rx="1.5" fill="#8a5a31"/>
    <rect x="10" y="66" width="48" height="9" rx="3" fill="#fffaf0" stroke="#d8c7a5"/>
    <rect x="12" y="61" width="13" height="7" rx="3" fill="#fff" stroke="#d8c7a5"/>
    <path d="M26 66 H58 V75 Q42 78 26 75Z" fill="${blanket}" stroke="#00000033"/>
    <rect x="10" y="75" width="48" height="5" rx="1.5" fill="#8a5a31"/>
  </g>`;
}

function nightstand(x, lamp = true) {
  return `<g><rect x="${x}" y="68" width="14" height="13" rx="1.5" fill="#9c6b3f" stroke="#5e3b1d"/><rect x="${x + 2}" y="72" width="10" height="2" fill="#5e3b1d"/>
    ${lamp ? `<path d="M${x + 7} 68 V62" stroke="#555" stroke-width="1.2"/><path d="M${x + 2} 62 L${x + 4} 56 H${x + 10} L${x + 12} 62Z" fill="#f7e3b0" stroke="#b39255"/>` : ''}</g>`;
}

function painting(x, y, hue) {
  return `<g><rect x="${x}" y="${y}" width="18" height="14" fill="url(#gold)" rx="1"/><rect x="${x + 2}" y="${y + 2}" width="14" height="10" fill="${hue}"/>
    <path d="M${x + 2} ${y + 10} L${x + 7} ${y + 6} L${x + 11} ${y + 9} L${x + 16} ${y + 4} V${y + 12} H${x + 2}Z" fill="#ffffff88"/></g>`;
}

/** Positions des équipements dans une chambre. */
function equipArt(equip) {
  const slots = [{ x: 92, y: 60, s: 1.15 }, { x: 70, y: 62, s: 1 }];
  return equip.map((id, i) => {
    if (id === 'baldaquin' || id === 'cocon') return '';
    if (id === 'clim') return `<g transform="translate(78 47) scale(.9)">${ITEM_ART.clim}</g>`;
    if (id === 'paratonnerre') return `<g transform="translate(100 46) scale(.8)">${ITEM_ART.paratonnerre}</g>`;
    if (id === 'matelas') return `<g transform="translate(26 54) scale(1.1)">${ITEM_ART.matelas}</g>`;
    const p = slots[i];
    return `<g transform="translate(${p.x} ${p.y}) scale(${p.s})">${ITEM_ART[id]}</g>`;
  }).join('');
}

/** Bas de mur (1 à 4) et frise (1 à 5) choisis par la déco de l'étage. */
function wallBands(d, c) {
  const dark = mix(c, '#2a160c', 0.45);
  const bottom = [
    '',
    `<rect y="58" width="${W}" height="23" fill="url(#woodV)"/><rect y="58" width="${W}" height="23" fill="${c}" opacity=".18"/>`,
    `<rect y="58" width="${W}" height="23" fill="url(#tiles)"/><rect y="58" width="${W}" height="23" fill="${c}" opacity=".22"/>`,
    `<rect y="58" width="${W}" height="23" fill="${mix(c, '#ffffff', 0.25)}"/>${Array.from({ length: 12 }, (_, i) => `<rect x="${i * 10 + 4}" y="61" width="2" height="18" fill="${dark}" opacity=".35"/>`).join('')}`,
    `<rect y="58" width="${W}" height="23" fill="${dark}"/><rect y="60" width="${W}" height="1.4" fill="#e9c46a" opacity=".8"/>`,
  ][d.bottom] || '';
  const mid = [
    '',
    `<rect y="55" width="${W}" height="3" fill="url(#gold)"/>`,
    `<rect y="54.5" width="${W}" height="4" fill="#fff8ec"/>${Array.from({ length: 20 }, (_, i) => `<circle cx="${i * 6 + 3}" cy="56.5" r="1" fill="${dark}"/>`).join('')}`,
    `<rect y="54" width="${W}" height="5" fill="${dark}"/><path d="M0 58 ${Array.from({ length: 20 }, (_, i) => `L${i * 6 + 3} 55 L${i * 6 + 6} 58`).join(' ')}" fill="none" stroke="#fff8ec" stroke-width="1"/>`,
    `<rect y="54" width="${W}" height="1.6" fill="${dark}"/><rect y="57" width="${W}" height="1.6" fill="${dark}"/>`,
    `<rect y="54" width="${W}" height="5" fill="#fff8ec"/>${Array.from({ length: 30 }, (_, i) => `<rect x="${i * 4}" y="${54 + (i % 2) * 2.5}" width="2" height="2.5" fill="${dark}"/>`).join('')}`,
  ][d.mid] || '';
  return bottom + mid;
}

function bedroomArt(room, ctx) {
  const d = ctx.deco || floorDeco({}, room.floor);
  const c = WALL_COLORS[d.paint] || WALL_COLORS[1];
  const wall = mix(c, '#fff8ec', 0.66);
  const lvl = room.level;
  const cocon = room.equip.includes('cocon');
  const canopy = room.equip.includes('baldaquin');
  const wp = { curtain: c, blanket: mix(c, '#ffffff', 0.12) };
  return `${wallAndFloor(wall)}
    <rect width="${W}" height="81" fill="url(#wpm${d.wallpaper})"/>
    ${wallBands(d, c)}
    ${cocon ? '<rect width="120" height="81" fill="#e8e1f5" opacity=".75"/><path d="M0 20 L20 0 M0 50 L50 0 M0 80 L80 0 M30 81 L111 0 M60 81 L120 21 M90 81 L120 51" stroke="#c8bce3" stroke-width="1.5"/>' : ''}
    ${windowArt(76, 14, 30, 26, wp.curtain)}
    ${lvl >= 2 ? painting(18, 18, lvl >= 3 ? '#4a6fc0' : '#3f9b72') : ''}
    ${ceilingLamp(44, ctx.glow, lvl >= 3)}
    ${bedArt(canopy ? 3 : lvl, wp.blanket)}
    ${nightstand(62, true)}
    ${lvl >= 3 ? `<g transform="translate(104 62)"><path d="M-6 18 H6 L4 8 H-4Z" fill="#c4683b"/><path d="M0 8 C-8 0 -9 -6 -5 -8 C-2 -2 0 2 0 8 C0 0 4 -6 8 -6 C8 0 4 4 0 8Z" fill="#5cc254"/></g>` : ''}
    ${equipArt(room.equip)}`;
}

const SERVICE_ART = {
  laverie: (busy) => `${wallAndFloor('url(#tiles)', 'url(#checker)')}
    <rect x="8" y="16" width="44" height="4" rx="1" fill="#9c6b3f"/>
    <rect x="12" y="10" width="10" height="6" rx="1" fill="#f48fb1"/><rect x="24" y="11" width="10" height="5" rx="1" fill="#90caf9"/><rect x="36" y="10" width="10" height="6" rx="1" fill="#fff59d"/>
    <path d="M58 20 Q85 28 112 20" fill="none" stroke="#777" stroke-width="1"/>
    <path d="M66 23 h8 v10 h-8z" fill="#ef9a9a"/><path d="M84 25 h10 v12 h-10z" fill="#80deea"/><path d="M100 23 h7 v9 h-7z" fill="#ffe082"/>
    ${[12, 46].map((x) => `<g><rect x="${x}" y="48" width="30" height="33" rx="3" fill="#f5f7fa" stroke="#90a4ae" stroke-width="1.2"/>
      <rect x="${x + 2}" y="50" width="26" height="5" rx="1" fill="#cfd8dc"/><circle cx="${x + 24}" cy="52.5" r="1.4" fill="#4caf50"/>
      <circle cx="${x + 15}" cy="68" r="10" fill="#1e3a5f" stroke="#b0bec5" stroke-width="2.4"/>
      <g class="${busy ? 'spin' : ''}" style="transform-origin:${x + 15}px 68px"><circle cx="${x + 11}" cy="66" r="3" fill="#64b5f6" opacity=".8"/><circle cx="${x + 18}" cy="71" r="2.4" fill="#e57373" opacity=".8"/><circle cx="${x + 17}" cy="63" r="1.6" fill="#fff" opacity=".7"/></g></g>`).join('')}
    <g transform="translate(86 62)">${ITEM_ART.panier.replace(/#d7a35b/, '#bcd7ef')}</g>`,
  cireuse: (busy) => `${wallAndFloor('#6d4c41', 'url(#checker)')}
    <rect y="0" width="${W}" height="81" fill="url(#woodV)" opacity=".25"/>
    <rect x="8" y="14" width="44" height="3" fill="#3e2723"/><rect x="8" y="30" width="44" height="3" fill="#3e2723"/>
    ${[12, 24, 36].map((x, i) => `<path d="M${x} 14 h9 v-4 a2 2 0 0 0 -2 -2 h-3 v4 h-4z" fill="${['#8d6e63', '#212121', '#c62828'][i]}"/>`).join('')}
    ${[12, 24, 36].map((x, i) => `<path d="M${x} 30 h9 v-4 a2 2 0 0 0 -2 -2 h-3 v4 h-4z" fill="${['#f9a825', '#5d4037', '#1565c0'][i]}"/>`).join('')}
    <rect x="58" y="40" width="50" height="41" rx="4" fill="#ffca28" stroke="#a87b00" stroke-width="1.4"/>
    <rect x="62" y="44" width="42" height="8" rx="2" fill="#fff8e1"/><circle cx="98" cy="48" r="2" fill="${busy ? '#4caf50' : '#e53935'}"/>
    ${[66, 84].map((x) => `<g class="${busy ? 'spin' : ''}" style="transform-origin:${x + 6}px 66px"><circle cx="${x + 6}" cy="66" r="7" fill="#5d4037" stroke="#3e2723" stroke-width="1.2"/>
      <path d="M${x + 6} 59 V73 M${x - 1} 66 H${x + 13} M${x + 1} 61 L${x + 11} 71 M${x + 11} 61 L${x + 1} 71" stroke="#a1887f" stroke-width="1"/></g>`).join('')}
    <rect x="10" y="62" width="40" height="19" rx="2" fill="#8d6e63" stroke="#4e342e"/><rect x="8" y="59" width="44" height="4" rx="1" fill="#d7ccc8"/>
    <g transform="translate(20 52)"><rect width="8" height="7" rx="1.5" fill="#212121"/><rect x="11" y="1" width="7" height="6" rx="3" fill="#ffcc80"/></g>`,
  cuisine: (busy) => `${wallAndFloor('url(#checker)', 'url(#checker)')}
    <rect x="0" y="22" width="${W}" height="2" fill="#c9b79c"/>
    <rect x="70" y="10" width="40" height="10" rx="2" fill="#a1887f"/>
    <rect x="6" y="56" width="70" height="25" rx="2" fill="#8d6e63" stroke="#4e342e"/><rect x="4" y="53" width="74" height="4" rx="1" fill="#d7ccc8"/>
    <rect x="14" y="45" width="22" height="8" rx="2" fill="#78909c"/><rect x="12" y="44" width="26" height="2" fill="#546e7a"/>
    <path class="${busy ? 'steam' : ''}" d="M20 40 Q17 34 21 28 M28 40 Q25 34 29 28" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/>
    <path d="M46 53 H66 V48 Q56 40 46 48Z" fill="#fff3e0" stroke="#d7a35b"/><path d="M46 48 Q56 42 66 48" fill="none" stroke="#f48fb1" stroke-width="3"/><circle cx="56" cy="42" r="2.4" fill="#e53935"/>
    <rect x="86" y="34" width="26" height="47" rx="3" fill="#eceff1" stroke="#90a4ae"/><path d="M86 54 H112" stroke="#90a4ae"/><rect x="106" y="40" width="2" height="8" fill="#90a4ae"/><rect x="106" y="58" width="2" height="10" fill="#90a4ae"/>`,
  labo: (busy) => `${wallAndFloor('#2f5d62', 'url(#checker)')}
    <rect y="0" width="${W}" height="81" fill="url(#tiles)" opacity=".18"/>
    <rect x="10" y="12" width="30" height="22" rx="2" fill="#f5f5f5" stroke="#90a4ae"/>
    <path d="M13 30 L19 22 L25 26 L31 16 L37 20" fill="none" stroke="#e53935" stroke-width="1.6"/>
    <rect x="4" y="58" width="76" height="23" rx="2" fill="#cfd8dc" stroke="#78909c"/><rect x="2" y="55" width="80" height="4" rx="1" fill="#eceff1"/>
    <g transform="translate(14 38)"><path d="M3 0 V8 L-3 17 H13 L7 8 V0Z" fill="#c8e6c9" stroke="#607d8b" stroke-width="1.1"/><path d="M-1 13 H11 L13 17 H-3Z" fill="#66bb6a"/>
      <circle class="${busy ? 'bubble-up' : ''}" cx="4" cy="10" r="1.3" fill="#a5d6a7"/></g>
    <g transform="translate(34 42)"><rect x="0" y="0" width="7" height="13" rx="3" fill="#e1bee7" stroke="#607d8b" stroke-width="1"/><rect x="0" y="6" width="7" height="7" rx="3" fill="#ab47bc"/></g>
    <g transform="translate(50 30)"><path d="M6 25 H18 M12 25 V18 M8 18 H16 L14 6 L10 6Z" fill="#455a64" stroke="#263238" stroke-width="1.2"/><circle cx="12" cy="4" r="3" fill="#263238"/><path d="M14 10 L20 6" stroke="#263238" stroke-width="2"/></g>
    <g transform="translate(90 18)"><rect x="0" y="0" width="22" height="63" rx="10" fill="#b2ebf2" fill-opacity=".55" stroke="#607d8b" stroke-width="1.6"/>
      <rect x="2" y="26" width="18" height="35" rx="8" fill="#4dd0e1" fill-opacity=".75"/>
      <circle class="${busy ? 'bubble-up' : ''}" cx="8" cy="50" r="2" fill="#e0f7fa"/><circle class="${busy ? 'bubble-up' : ''}" cx="14" cy="40" r="1.5" fill="#e0f7fa" style="animation-delay:.6s"/>
      <rect x="-2" y="-3" width="26" height="6" rx="2" fill="#78909c"/><rect x="-2" y="60" width="26" height="6" rx="2" fill="#78909c"/></g>`,
  bar: (busy) => `${wallAndFloor('#5d3a24')}
    <rect y="0" width="${W}" height="81" fill="url(#woodV)" opacity=".35"/>
    <rect x="10" y="20" width="100" height="3" fill="#3e2416"/><rect x="10" y="34" width="100" height="3" fill="#3e2416"/>
    ${[16, 26, 36, 46, 70, 80, 90, 100].map((x, i) => `<rect x="${x}" y="${i % 2 ? 11 : 9}" width="5" height="${i % 2 ? 9 : 11}" rx="1.5" fill="${['#e53935', '#43a047', '#fdd835', '#8e24aa', '#fb8c00', '#00acc1', '#d81b60', '#7cb342'][i]}"/>`).join('')}
    <text x="60" y="31" text-anchor="middle" font-size="9" font-weight="900" fill="#ff80ab" class="neon-text">JUS</text>
    <rect x="6" y="56" width="108" height="25" rx="2" fill="#8d4f2a" stroke="#4e2a12"/><rect x="4" y="53" width="112" height="4" rx="1" fill="#d7a35b"/>
    <g transform="translate(78 36)"><rect width="22" height="17" rx="2" fill="#eceff1" stroke="#90a4ae"/><rect x="3" y="3" width="7" height="10" rx="1" fill="#ffa726" class="${busy ? 'slosh' : ''}"/><rect x="12" y="3" width="7" height="10" rx="1" fill="#9ccc65" class="${busy ? 'slosh' : ''}"/></g>
    ${[20, 46].map((x) => `<g><rect x="${x}" y="83" width="3" height="14" fill="#333"/><ellipse cx="${x + 1.5}" cy="83" rx="7" ry="2.5" fill="#c62828"/></g>`).join('')}
    <path d="M30 53 V44 H38 V53" fill="#ffecb3" stroke="#aaa"/><circle cx="34" cy="44" r="1.6" fill="#e53935"/>`,
};

const LEISURE_ART = {
  sauna: () => `${wallAndFloor('url(#woodV)', 'url(#wood)')}
    <rect x="6" y="52" width="80" height="6" rx="1.5" fill="#a0652f" stroke="#6d4320"/><path d="M12 58 V81 M80 58 V81" stroke="#6d4320" stroke-width="3"/>
    <rect x="6" y="66" width="80" height="5" rx="1.5" fill="#a0652f" stroke="#6d4320"/>
    <rect x="92" y="62" width="20" height="19" rx="2" fill="#555" stroke="#333"/><ellipse cx="97" cy="60" rx="4" ry="3" fill="#8d8d8d"/><ellipse cx="104" cy="59" rx="4" ry="3.4" fill="#757575"/><ellipse cx="108" cy="61" rx="3" ry="2.5" fill="#9e9e9e"/>
    <path class="steam" d="M96 54 Q93 46 97 38 M104 54 Q101 44 106 36" stroke="#fff" stroke-width="2.4" fill="none" opacity=".7"/>
    <rect x="20" y="16" width="16" height="22" rx="2" fill="#ffecb3" stroke="#a0652f"/><path d="M28 20 V34" stroke="#e53935" stroke-width="2"/><circle cx="28" cy="34" r="3" fill="#e53935"/>`,
  piscine: () => `${wallAndFloor('url(#tiles)', 'url(#tiles)')}
    <rect x="0" y="58" width="${W}" height="42" fill="url(#water)"/>
    <path class="wave" d="M0 60 Q10 56 20 60 T40 60 T60 60 T80 60 T100 60 T120 60 V64 H0Z" fill="#b3e5fc" opacity=".85"/>
    <path d="M100 40 V70 M110 40 V70 M100 46 H110 M100 54 H110 M100 62 H110" stroke="#b0bec5" stroke-width="2"/>
    <g transform="translate(26 62)"><circle r="7" fill="none" stroke="#ff5252" stroke-width="4"/><circle r="7" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="5.5 5.5"/></g>
    <rect x="10" y="18" width="34" height="14" rx="2" fill="#fff" stroke="#4fc3f7"/><text x="27" y="28" text-anchor="middle" font-size="7" font-weight="900" fill="#0288d1">PISCINE</text>`,
  serre: () => `${wallAndFloor('#dff5d8', 'url(#wood)')}
    <path d="M0 0 H120 V81 H0Z M30 0 V81 M60 0 V81 M90 0 V81 M0 27 H120 M0 54 H120" fill="none" stroke="#9ccc65" stroke-width="2"/>
    ${[14, 44, 76, 102].map((x, i) => `<g transform="translate(${x} 64)"><path d="M-7 17 H7 L5 6 H-5Z" fill="#c4683b"/>
      <path d="M0 6 C-12 -4 -10 -14 -4 -16 C-2 -8 0 -2 0 6 C0 -6 6 -16 12 -14 C10 -4 4 2 0 6Z" fill="${['#5cc254', '#43a047', '#7cb342', '#66bb6a'][i]}"/>${i % 2 ? '<circle cx="-4" cy="-8" r="2.5" fill="#ff7043"/>' : '<circle cx="5" cy="-10" r="2.2" fill="#ec407a"/>'}</g>`).join('')}
    <path class="sway" d="M20 0 Q24 12 18 22 Q14 30 20 36" fill="none" stroke="#388e3c" stroke-width="2"/><path class="sway" d="M100 0 Q96 14 102 24" fill="none" stroke="#388e3c" stroke-width="2"/>`,
  arcade: () => `${wallAndFloor('#2a1748', '#1b0f30')}
    <path d="M0 81 L120 81" stroke="#ff4fd8" stroke-width="1.5"/>
    ${[10, 44, 78].map((x, i) => `<g><path d="M${x} 81 V36 L${x + 6} 28 H${x + 26} L${x + 32} 36 V81Z" fill="${['#c62828', '#283593', '#2e7d32'][i]}" stroke="#000" stroke-width="1"/>
      <rect class="screen" x="${x + 6}" y="36" width="20" height="16" rx="1.5" fill="${['#76ff03', '#18ffff', '#ff4081'][i]}"/>
      <rect x="${x + 4}" y="56" width="24" height="5" fill="#111"/><circle cx="${x + 10}" cy="58.5" r="1.6" fill="#ffeb3b"/><circle cx="${x + 20}" cy="58.5" r="1.6" fill="#f44336"/></g>`).join('')}
    <text x="60" y="18" text-anchor="middle" font-size="10" font-weight="900" fill="#18ffff" class="neon-text">ARCADE</text>`,
  patinoire: () => `${wallAndFloor('#cfefff', '#eafaff')}
    <rect x="0" y="62" width="${W}" height="38" fill="#e6fbff"/><path d="M0 64 L120 64" stroke="#9fe3ec" stroke-width="2"/>
    <path d="M10 76 Q40 70 70 78 T118 74" fill="none" stroke="#b3e5fc" stroke-width="1.4"/>
    ${[[20, 18], [48, 30], [86, 16], [104, 38], [64, 12]].map(([x, y]) => `<g class="flake" transform="translate(${x} ${y})"><path d="M0 -5 V5 M-4.3 -2.5 L4.3 2.5 M-4.3 2.5 L4.3 -2.5" stroke="#fff" stroke-width="1.4"/></g>`).join('')}
    <g transform="translate(76 54)"><path d="M0 0 V10 H14 Q16 10 16 13 H-1" fill="#fff" stroke="#546e7a" stroke-width="1.2"/><path d="M-2 15 H18" stroke="#90a4ae" stroke-width="1.5"/></g>`,
  decharge: () => `${wallAndFloor('#7d8a6a', '#5b6347')}
    <ellipse cx="34" cy="80" rx="30" ry="14" fill="#6d5d3f"/><ellipse cx="80" cy="82" rx="34" ry="12" fill="#5d4e33"/>
    <rect x="22" y="62" width="10" height="8" fill="#9e9e9e" transform="rotate(-15 27 66)"/><circle cx="50" cy="68" r="5" fill="#8bc34a"/><rect x="70" y="66" width="14" height="6" fill="#795548"/>
    <path d="M90 60 l6 -10 l6 10z" fill="#bdbdbd"/>
    ${[[30, 44], [58, 38], [84, 46], [46, 52]].map(([x, y]) => `<circle class="fly" cx="${x}" cy="${y}" r="1.4" fill="#111"/>`).join('')}
    <path class="stink" d="M40 56 Q36 48 40 40 M64 58 Q60 50 64 42" stroke="#a14fc4" stroke-width="2" fill="none"/>
    <rect x="84" y="14" width="26" height="14" rx="2" fill="#ffd54f" stroke="#8d6e00"/><text x="97" y="24" text-anchor="middle" font-size="8" font-weight="900" fill="#5d4037">VIP</text>`,
  karaoke: () => `${wallAndFloor('#311b4f', '#1a0f2e')}
    <rect x="0" y="70" width="${W}" height="11" fill="#4a2b78"/><path d="M0 70 H120" stroke="#ffeb3b" stroke-width="1.4" stroke-dasharray="3 3"/>
    <path d="M60 4 V12" stroke="#bbb"/><circle class="spin" cx="60" cy="18" r="7" fill="#cfd8dc" stroke="#90a4ae" style="transform-origin:60px 18px"/><path d="M53 18 H67 M60 11 V25 M55 13 L65 23 M65 13 L55 23" stroke="#fff" stroke-width=".8"/>
    <path class="beam" d="M60 22 L30 70 H44Z" fill="#ff4081" opacity=".25"/><path class="beam" d="M60 22 L84 70 H98Z" fill="#40c4ff" opacity=".25"/>
    <path d="M60 70 V46" stroke="#9e9e9e" stroke-width="2"/><rect x="57" y="40" width="6" height="9" rx="3" fill="#424242"/>`,
};

/**
 * Illustration complète d'une pièce.
 * @param room  pièce
 * @param ctx   { glow: 'good'|'mid'|'bad'|'off', busy: boolean }
 */
export function roomSVG(room, ctx = {}) {
  let inner;
  if (room.kind === 'empty' && !room.buildEnd) {
    inner = `<rect width="${W}" height="${H}" fill="url(#concrete)"/>
      <rect x="10" y="12" width="40" height="22" fill="url(#bricks)" opacity=".9"/><rect x="70" y="40" width="40" height="26" fill="url(#bricks)" opacity=".9"/>
      <rect y="84" width="${W}" height="16" fill="#6f6c68"/><rect y="0" width="${W}" height="6" fill="#5f5c58"/>
      <path d="M0 6 H120 M0 84 H120" stroke="#444" stroke-width="2"/>
      <path d="M30 88 l4 -3 l5 2 l3 -2 l4 3" fill="none" stroke="#555" stroke-width="1.4"/>`;
  } else if (room.kind === 'bedroom' || (room.buildEnd && room.buildTarget === 'bedroom')) {
    inner = bedroomArt(room, ctx);
  } else {
    const sub = room.buildEnd ? room.buildTarget : room.sub;
    inner = (SERVICE_ART[sub] || LEISURE_ART[sub] || (() => wallAndFloor('#ccc')))(!!ctx.busy);
  }

  // Calques d'état
  if (room.buildEnd) {
    inner += `<rect width="${W}" height="${H}" fill="#3b2a12" opacity=".35"/>
      <path d="M8 0 V100 M112 0 V100 M8 30 H112 M8 62 H112" stroke="#b0b7bd" stroke-width="3"/>
      <path d="M8 30 L40 62 M112 30 L80 62" stroke="#8e969c" stroke-width="2"/>
      <rect x="0" y="86" width="${W}" height="8" fill="#f9c80e"/>
      <path d="M0 86 h8 l-8 8z M16 86 h10 l-8 8 h-10z M36 86 h10 l-8 8 h-10z M56 86 h10 l-8 8 h-10z M76 86 h10 l-8 8 h-10z M96 86 h10 l-8 8 h-10z M116 86 h4 v8 h-12z" fill="#222"/>
      <g transform="translate(60 62)"><path d="M-14 22 L-6 -2 H6 L14 22Z" fill="#ff8f00" stroke="#8d4a00" stroke-width="1.2"/><path d="M-10 12 H10 M-8 4 H8" stroke="#fff" stroke-width="3"/></g>`;
  }
  if (room.damage > 0) {
    inner += `<g class="damage">
      <rect width="${W}" height="${H}" fill="#3a2a1a" opacity="${0.12 * room.damage}"/>
      <path d="M20 0 L26 14 L18 22 L28 36" fill="none" stroke="#2b1d12" stroke-width="1.6"/>
      ${room.damage >= 2 ? '<path d="M98 8 L90 20 L100 30 L92 44" fill="none" stroke="#2b1d12" stroke-width="1.6"/><ellipse cx="80" cy="92" rx="16" ry="3" fill="#6b8e23" opacity=".6"/>' : ''}
      ${room.damage >= 3 ? '<path d="M50 60 l6 -4 l5 3 l-2 6z M70 84 l8 -5 l6 4 l-4 6z M30 86 l5 -3 l4 2 l-3 4z" fill="#7a6a5a"/><path d="M60 0 L56 18 L64 30" fill="none" stroke="#2b1d12" stroke-width="2"/>' : ''}
      <circle cx="40" cy="90" r="3" fill="#8d7b68"/><circle cx="46" cy="92" r="2" fill="#8d7b68"/>
    </g>`;
  }
  if (room.leftItem) {
    // Posé au sol : le groupe positionné (attribut) n'est jamais animé, sinon le CSS écraserait sa position.
    inner += `<g transform="translate(48 70)"><ellipse cx="12" cy="20.5" rx="13" ry="2.6" fill="#000" opacity=".22"/><g class="left-item">
      ${room.leftItem.money
        ? '<path d="M2 18 C-2 10 4 4 12 4 C20 4 26 10 22 18Z" fill="#c9a24a" stroke="#7a5c12" stroke-width="1.2"/><path d="M8 4 L12 0 L16 4" fill="none" stroke="#7a5c12" stroke-width="1.6"/><text x="12" y="15" text-anchor="middle" font-size="8" font-weight="900" fill="#5a3d00">€</text>'
        : '<rect x="2" y="6" width="20" height="14" rx="2" fill="#e53935" stroke="#8e1b19"/><path d="M12 6 V20 M2 11 H22" stroke="#ffd54f" stroke-width="2.2"/><path d="M12 6 C8 0 4 3 9 6 M12 6 C16 0 20 3 15 6" fill="none" stroke="#ffd54f" stroke-width="1.6"/>'}
      <path class="sparkle" d="M24 2 l1.2 3 l3 1.2 l-3 1.2 l-1.2 3 l-1.2 -3 l-3 -1.2 l3 -1.2z" fill="#fffbe0"/>
    </g></g>`;
  }
  return `<svg class="room-art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${inner}</svg>`;
}

// -----------------------------------------------------------------------------
// Décor extérieur
// -----------------------------------------------------------------------------

/** Ciel + skyline (fond fixe), selon la phase de la journée. Large (1600×900) pour les grands écrans. */
export function skySVG(phase) {
  const sky = {
    night: ['#070b24', '#1b2257', '#3a2f6b'],
    dawn: ['#3d3a8c', '#c86b9a', '#ffc28a'],
    day: ['#4aa8ff', '#8fd0ff', '#d9f1ff'],
    dusk: ['#2c2a6b', '#a5528f', '#ff9a62'],
    evening: ['#0d1236', '#2a2a6e', '#5a3c80'],
  }[phase];
  const dark = phase === 'night' || phase === 'evening';
  const W = 1600;
  const H = 900;
  const base = 760; // la skyline se pose au niveau de la rue
  const stars = dark ? Array.from({ length: 140 }, (_, i) => {
    const x = (i * 97) % W; const y = (i * 53) % 520; const r = (i % 3) * 0.5 + 0.7;
    return `<circle class="twinkle" style="animation-delay:${(i % 7) * 0.6}s" cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`;
  }).join('') : '';
  const sun = phase === 'day' ? '<circle cx="1280" cy="150" r="56" fill="#fff6c4"/><circle cx="1280" cy="150" r="90" fill="#fff6c4" opacity=".25"/>'
    : dark ? `<circle cx="1260" cy="140" r="40" fill="#fdf6d8"/><circle cx="1278" cy="126" r="36" fill="${sky[0]}"/>`
    : '<circle cx="300" cy="640" r="70" fill="#ffd27a" opacity=".85"/>';
  const winLit = dark ? '#ffd86b' : '#9fb4cf';
  // Deux rangées d'immeubles (loin / près) générées de façon déterministe.
  const row = (seed, hMin, hMax, fill, op) => {
    let out = '';
    let x = -20;
    let i = seed;
    while (x < W) {
      const w = 50 + ((i * 37) % 60);
      const h = hMin + ((i * 53) % (hMax - hMin));
      const y = base - h;
      out += `<rect x="${x}" y="${y}" width="${w}" height="${H - y}" fill="${fill}"/>`;
      if (i % 3 === 0) out += `<rect x="${x + w / 2 - 2}" y="${y - 18}" width="4" height="18" fill="${fill}"/>`;
      for (let yy = y + 12; yy < base - 10; yy += 18) for (let xx = x + 8; xx < x + w - 8; xx += 14) {
        if ((xx * 7 + yy * 3 + i) % 5 < 2) out += `<rect x="${xx}" y="${yy}" width="6" height="8" fill="${winLit}" opacity="${op}"/>`;
      }
      x += w + 6;
      i++;
    }
    return out;
  };
  const far = row(3, 120, 260, dark ? '#1a2050' : '#9fb3d6', dark ? 0.5 : 0.25);
  const near = row(11, 60, 170, dark ? '#121738' : '#7f93b8', dark ? 0.85 : 0.45);
  const clouds = phase === 'day' || phase === 'dawn' ? `<g class="clouds" fill="#fff" opacity=".85">
      <ellipse cx="220" cy="170" rx="90" ry="24"/><ellipse cx="270" cy="152" rx="56" ry="26"/>
      <ellipse cx="760" cy="110" rx="110" ry="26"/><ellipse cx="820" cy="94" rx="60" ry="26"/>
      <ellipse cx="1420" cy="300" rx="90" ry="22"/><ellipse cx="1460" cy="284" rx="50" ry="22"/></g>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset=".6" stop-color="${sky[1]}"/><stop offset="1" stop-color="${sky[2]}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#skyg)"/>${stars}${sun}${clouds}
  </svg>`;
}

/** Skyline en bande (dessinée DANS la scène, posée au niveau de la rue : elle suit l'hôtel). */
export function citySVG(phase) {
  const dark = phase === 'night' || phase === 'evening';
  const W = 3600;
  const H = 360;
  const winLit = dark ? '#ffd86b' : '#9fb4cf';
  const row = (seed, hMin, hMax, fill, op) => {
    let out = '';
    let x = -20;
    let i = seed;
    while (x < W) {
      const w = 60 + ((i * 37) % 70);
      const h = hMin + ((i * 53) % (hMax - hMin));
      const y = H - h;
      out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
      if (i % 3 === 0) out += `<rect x="${x + w / 2 - 2}" y="${y - 20}" width="4" height="20" fill="${fill}"/>`;
      for (let yy = y + 14; yy < H - 12; yy += 20) for (let xx = x + 9; xx < x + w - 9; xx += 15) {
        if ((xx * 7 + yy * 3 + i) % 5 < 2) out += `<rect x="${xx}" y="${yy}" width="7" height="9" fill="${winLit}" opacity="${op}"/>`;
      }
      x += w + 8;
      i++;
    }
    return out;
  };
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <g>${row(3, 160, 340, dark ? '#1a2050' : '#a9bcdc', dark ? 0.5 : 0.25)}</g>
    <g>${row(11, 80, 220, dark ? '#121738' : '#8396bb', dark ? 0.85 : 0.45)}</g>
  </svg>`;
}

/** Toit + enseigne. `width` en unités de grille (colonnes). */
export function roofSVG(cols) {
  const w = cols * 120 + 40;
  return `<svg class="roof-art" viewBox="0 50 ${w} 20" preserveAspectRatio="none" aria-hidden="true">
    <rect x="0" y="52" width="${w}" height="18" fill="#6e3b2b"/><rect x="0" y="50" width="${w}" height="5" fill="#c9a37a"/>
    <rect x="0" y="66" width="${w}" height="4" fill="#4a2519"/>
    ${Array.from({ length: Math.ceil(w / 20) }, (_, i) => `<rect x="${i * 20 + 4}" y="55" width="12" height="9" rx="1" fill="#8a4d38"/>`).join('')}
  </svg>`;
}

export function waterTowerSVG() {
  return `<svg viewBox="0 0 60 80" aria-hidden="true"><path d="M14 40 L8 80 M46 40 L52 80 M10 62 H50 M20 40 L30 80 M40 40 L30 80" stroke="#4a3a2a" stroke-width="2.4"/>
    <path d="M6 14 L30 2 L54 14Z" fill="#7a4a2a"/><rect x="8" y="14" width="44" height="28" rx="3" fill="#a8703f" stroke="#5e3b1d" stroke-width="2"/>
    <path d="M8 22 H52 M8 32 H52" stroke="#5e3b1d" stroke-width="1.6"/></svg>`;
}

export function antennaSVG() {
  return `<svg viewBox="0 0 30 80" aria-hidden="true"><path d="M15 80 V8 M15 30 L5 22 M15 30 L25 22 M15 46 L3 36 M15 46 L27 36" stroke="#556" stroke-width="2.2"/>
    <circle class="blink" cx="15" cy="6" r="4" fill="#ff3b3b"/></svg>`;
}

/** Hall d'accueil (rez-de-chaussée). */
export function lobbySVG(cols) {
  const w = cols * 120;
  const mid = w / 2;
  return `<svg class="lobby-art" viewBox="0 0 ${w} 110" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="${w}" height="110" fill="#f1dcc0"/>
    <rect width="${w}" height="110" fill="url(#woodV)" opacity=".18"/>
    <rect y="92" width="${w}" height="18" fill="url(#checker)"/><rect y="89" width="${w}" height="3.5" fill="#6d4426"/>
    <rect x="${mid - 34}" y="18" width="68" height="74" rx="4" fill="#2e4a63" stroke="#c9a24a" stroke-width="3"/>
    <rect x="${mid - 30}" y="22" width="29" height="70" fill="#a8d8f0" opacity=".55"/><rect x="${mid + 1}" y="22" width="29" height="70" fill="#a8d8f0" opacity=".55"/>
    <path d="M${mid} 22 V92" stroke="#c9a24a" stroke-width="2"/><circle cx="${mid - 5}" cy="58" r="1.8" fill="#c9a24a"/><circle cx="${mid + 5}" cy="58" r="1.8" fill="#c9a24a"/>
    <ellipse cx="${mid}" cy="100" rx="44" ry="6" fill="#b71c1c" opacity=".8"/>
    <rect x="18" y="58" width="${Math.min(150, mid - 60)}" height="32" rx="3" fill="#8a4d2a" stroke="#4e2a12" stroke-width="1.5"/>
    <rect x="14" y="54" width="${Math.min(158, mid - 52)}" height="6" rx="2" fill="#c9a24a"/>
    <g transform="translate(${Math.min(120, mid - 80)} 44)"><path d="M0 10 Q6 0 12 10Z" fill="url(#gold)" stroke="#8a6410"/><rect x="-2" y="10" width="16" height="2.5" fill="#8a6410"/><circle cx="6" cy="-1" r="1.5" fill="#8a6410"/></g>
    <rect x="22" y="14" width="56" height="30" rx="2" fill="#6d4426"/>
    ${Array.from({ length: 12 }, (_, i) => `<circle cx="${30 + (i % 6) * 8}" cy="${22 + Math.floor(i / 6) * 13}" r="2" fill="#c9a24a"/><rect x="${29 + (i % 6) * 8}" y="${24 + Math.floor(i / 6) * 13}" width="2" height="6" fill="#d7ccc8"/>`).join('')}
    <g transform="translate(${w - 40} 60)"><path d="M-9 30 H9 L7 14 H-7Z" fill="#c4683b"/><path d="M0 14 C-14 2 -12 -14 -4 -16 C-2 -6 0 2 0 14 C0 -2 8 -16 16 -12 C12 0 6 8 0 14Z" fill="#43a047"/></g>
    <g transform="translate(${mid + 60} 20)"><rect width="34" height="44" rx="3" fill="#fff8e1" stroke="#8a6410" stroke-width="2"/><path d="M6 10 H28 M6 18 H24 M6 26 H28 M6 34 H20" stroke="#bfa77a" stroke-width="2"/></g>
  </svg>`;
}

/** Réception sur une seule case (rez-de-chaussée, à droite) : comptoir, clés, porte vitrée. */
export function lobbyCellSVG() {
  return `<svg class="lobby-art" viewBox="0 0 120 104" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="120" height="104" fill="#f1dcc0"/>
    <rect width="120" height="104" fill="url(#woodV)" opacity=".18"/>
    <rect y="88" width="120" height="16" fill="url(#checker)"/><rect y="85" width="120" height="3.5" fill="#6d4426"/>
    <rect x="70" y="20" width="42" height="65" rx="3" fill="#2e4a63" stroke="#c9a24a" stroke-width="2.5"/>
    <rect x="73" y="23" width="17" height="62" fill="#a8d8f0" opacity=".55"/><rect x="92" y="23" width="17" height="62" fill="#a8d8f0" opacity=".55"/>
    <path d="M91 23 V85" stroke="#c9a24a" stroke-width="1.6"/><circle cx="87" cy="56" r="1.5" fill="#c9a24a"/><circle cx="95" cy="56" r="1.5" fill="#c9a24a"/>
    <ellipse cx="91" cy="95" rx="24" ry="4.5" fill="#b71c1c" opacity=".8"/>
    <rect x="8" y="12" width="44" height="26" rx="2" fill="#6d4426"/>
    ${Array.from({ length: 10 }, (_, i) => `<circle cx="${14 + (i % 5) * 8}" cy="${19 + Math.floor(i / 5) * 11}" r="1.8" fill="#c9a24a"/><rect x="${13 + (i % 5) * 8}" y="${21 + Math.floor(i / 5) * 11}" width="2" height="5" fill="#d7ccc8"/>`).join('')}
    <rect x="6" y="58" width="56" height="27" rx="3" fill="#8a4d2a" stroke="#4e2a12" stroke-width="1.4"/>
    <rect x="3" y="54" width="62" height="6" rx="2" fill="#c9a24a"/>
    <g transform="translate(46 44)"><path d="M0 10 Q6 0 12 10Z" fill="url(#gold)" stroke="#8a6410"/><rect x="-2" y="10" width="16" height="2.5" fill="#8a6410"/><circle cx="6" cy="-1" r="1.5" fill="#8a6410"/></g>
    <g transform="translate(62 66) scale(.7)"><path d="M-9 30 H9 L7 14 H-7Z" fill="#c4683b"/><path d="M0 14 C-14 2 -12 -14 -4 -16 C-2 -6 0 2 0 14 C0 -2 8 -16 16 -12 C12 0 6 8 0 14Z" fill="#43a047"/></g>
  </svg>`;
}

/** Auvent rayé au-dessus de l'entrée. */
export function awningSVG() {
  return `<svg viewBox="0 0 160 26" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 0 H160 L152 18 H8Z" fill="#c62828"/>
    ${Array.from({ length: 8 }, (_, i) => `<path d="M${i * 20 + 10} 0 H${i * 20 + 20} L${i * 19 + 18} 18 H${i * 19 + 9}Z" fill="#fff3e0"/>`).join('')}
    ${Array.from({ length: 9 }, (_, i) => `<path d="M${8 + i * 18} 18 q9 10 18 0" fill="${i % 2 ? '#fff3e0' : '#c62828'}"/>`).join('')}
  </svg>`;
}

/** Rue + trottoir + lampadaires. */
export function streetSVG(phase) {
  const dark = phase === 'night' || phase === 'evening' || phase === 'dusk';
  return `<svg class="street-art" viewBox="0 0 400 70" preserveAspectRatio="none" aria-hidden="true">
    <rect width="400" height="22" fill="#b9b3a8"/><path d="M0 22 H400" stroke="#8a8378" stroke-width="3"/>
    ${Array.from({ length: 10 }, (_, i) => `<path d="M${i * 40} 0 V22" stroke="#a49d91" stroke-width="1.2"/>`).join('')}
    <rect y="24" width="400" height="46" fill="#3d3f4a"/>
    ${Array.from({ length: 7 }, (_, i) => `<rect x="${i * 64 + 10}" y="45" width="34" height="4" rx="2" fill="#f5f5f5" opacity=".8"/>`).join('')}
    ${dark ? '<ellipse cx="20" cy="18" rx="30" ry="10" fill="#ffd86b" opacity=".25"/><ellipse cx="380" cy="18" rx="30" ry="10" fill="#ffd86b" opacity=".25"/>' : ''}
  </svg>`;
}

export function lampPostSVG(on) {
  return `<svg viewBox="0 0 30 120" aria-hidden="true">
    ${on ? '<ellipse cx="15" cy="16" rx="16" ry="16" fill="#ffd86b" opacity=".35"/>' : ''}
    <path d="M15 120 V20" stroke="#2f3442" stroke-width="4"/><path d="M8 120 H22" stroke="#2f3442" stroke-width="6"/>
    <path d="M6 20 H24 L20 8 H10Z" fill="#2f3442"/><rect x="10" y="12" width="10" height="8" fill="${on ? '#fff3b0' : '#cfd8dc'}"/>
  </svg>`;
}

/** Couronne d'étoiles du niveau d'hôtel (enseigne). */
export function levelStars(level) {
  return '★'.repeat(Math.min(level, 6));
}
