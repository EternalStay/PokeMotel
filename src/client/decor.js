// =============================================================================
// Habillage de la scène : arbres, buissons, bancs, cheminées, garde-corps,
// néon du toit, appliques lumineuses, jardinières, horloges, voitures, oiseaux.
// Tout est dessiné en SVG (style maison).
// =============================================================================

/** Arbre feuillu (3 variantes). */
export function treeSVG(v = 0) {
  const greens = [['#3f8f3a', '#56a84a', '#79c25f'], ['#2f7d4f', '#45a065', '#6cc082'], ['#4d8a2c', '#69a83c', '#8fc957']][v % 3];
  return `<svg class="tree" viewBox="0 0 220 300" aria-hidden="true">
    <path d="M100 300 C104 240 98 200 92 170 L128 170 C122 200 116 240 120 300Z" fill="#6d4a2b"/>
    <path d="M110 200 L80 170 M112 190 L146 160" stroke="#6d4a2b" stroke-width="8" stroke-linecap="round"/>
    <g class="canopy">
      <circle cx="60" cy="150" r="52" fill="${greens[0]}"/><circle cx="160" cy="150" r="56" fill="${greens[0]}"/>
      <circle cx="110" cy="105" r="70" fill="${greens[1]}"/><circle cx="58" cy="105" r="44" fill="${greens[1]}"/><circle cx="165" cy="100" r="46" fill="${greens[1]}"/>
      <circle cx="100" cy="70" r="46" fill="${greens[2]}"/><circle cx="140" cy="60" r="34" fill="${greens[2]}"/>
      <circle cx="80" cy="60" r="10" fill="#fff" opacity=".18"/><circle cx="130" cy="45" r="8" fill="#fff" opacity=".18"/>
    </g>
    <ellipse cx="110" cy="298" rx="70" ry="6" fill="#000" opacity=".2"/>
  </svg>`;
}

export function bushSVG(v = 0) {
  const c = ['#4a9a3f', '#3f8f5a', '#5aa03a'][v % 3];
  return `<svg class="bush" viewBox="0 0 120 60" aria-hidden="true">
    <circle cx="30" cy="38" r="22" fill="${c}"/><circle cx="60" cy="30" r="28" fill="${c}"/><circle cx="92" cy="38" r="22" fill="${c}"/>
    <circle cx="50" cy="22" r="6" fill="#fff" opacity=".15"/>
    ${v % 2 ? '<circle cx="40" cy="30" r="3" fill="#ff7a8a"/><circle cx="70" cy="22" r="3" fill="#ffd84a"/><circle cx="88" cy="34" r="3" fill="#ff7a8a"/>' : ''}
  </svg>`;
}

export function benchSVG() {
  return `<svg class="bench" viewBox="0 0 90 40" aria-hidden="true">
    <rect x="6" y="8" width="78" height="6" rx="2" fill="#a0652f"/><rect x="6" y="18" width="78" height="6" rx="2" fill="#b0743c"/>
    <path d="M12 24 V38 M78 24 V38 M14 8 V24 M76 8 V24" stroke="#2f3442" stroke-width="3"/>
  </svg>`;
}

/** Rangée de cheminées et garde-corps du toit. */
export function chimneysSVG(cols) {
  const w = cols * 158 + 40;
  let ch = '';
  const n = Math.max(2, cols);
  for (let i = 0; i < n; i++) {
    const x = 30 + (i * (w - 80)) / (n - 1);
    const h = 26 + ((i * 17) % 18);
    ch += `<g><rect x="${x}" y="${60 - h}" width="22" height="${h}" fill="#8a4a34" stroke="#5e2f20" stroke-width="2"/>
      <rect x="${x - 3}" y="${56 - h}" width="28" height="6" fill="#6e3b2b"/>
      <circle class="smoke" cx="${x + 11}" cy="${48 - h}" r="6" fill="#d9d9e8" opacity=".55" style="animation-delay:${i * 0.9}s"/></g>`;
  }
  let rail = '';
  for (let x = 6; x < w - 6; x += 12) rail += `<rect x="${x}" y="64" width="3" height="16" fill="#3a2a22"/>`;
  return `<svg class="chimneys" viewBox="0 0 ${w} 84" preserveAspectRatio="none" aria-hidden="true">
    ${ch}<rect x="0" y="60" width="${w}" height="5" rx="2" fill="#3a2a22"/>${rail}<rect x="0" y="78" width="${w}" height="5" fill="#3a2a22"/>
  </svg>`;
}

/** Applique murale (lumière au crépuscule et la nuit). */
export function sconceSVG() {
  return `<svg viewBox="0 0 24 36" aria-hidden="true">
    <path d="M12 34 V22" stroke="#5a3d1e" stroke-width="3"/><path d="M4 22 H20 L17 14 H7Z" fill="#c99a2e" stroke="#7a5c12" stroke-width="1.2"/>
    <circle class="bulb" cx="12" cy="11" r="5" fill="#fff3b0"/>
  </svg>`;
}

/** Jardinière de fleurs posée sur la corniche. */
export function planterSVG(v = 0) {
  const flowers = [['#ff6b81', '#ffd84a', '#ff6b81'], ['#b388ff', '#ffffff', '#b388ff'], ['#ff8a3d', '#ff6b81', '#ffd84a']][v % 3];
  return `<svg class="planter" viewBox="0 0 60 30" aria-hidden="true">
    <path d="M10 6 C8 0 14 0 14 6 M24 6 C22 -2 30 -2 28 6 M40 6 C38 0 46 0 44 6" stroke="#3d8a2c" stroke-width="2" fill="none"/>
    <circle cx="12" cy="6" r="5" fill="${flowers[0]}"/><circle cx="26" cy="5" r="5" fill="${flowers[1]}"/><circle cx="42" cy="6" r="5" fill="${flowers[2]}"/>
    <ellipse cx="18" cy="12" rx="8" ry="4" fill="#4a9a3f"/><ellipse cx="38" cy="12" rx="9" ry="4" fill="#4a9a3f"/>
    <rect x="4" y="12" width="52" height="14" rx="2" fill="#a0522d" stroke="#6d3416" stroke-width="1.5"/>
    <rect x="4" y="12" width="52" height="4" fill="#8b4513"/>
  </svg>`;
}

/** Afficheur à LED (heure). */
export function ledClockHTML(text, cls = '') {
  return `<span class="led ${cls}"><span class="led-text">${text}</span></span>`;
}

/** Voiture qui passe dans la rue. */
export function carSVG(color = '#e53935') {
  return `<svg class="car-art" viewBox="0 0 120 50" aria-hidden="true">
    <path d="M8 34 C8 26 14 24 22 23 L36 12 C40 9 46 8 52 8 H76 C84 8 88 10 94 16 L102 23 C110 24 114 28 114 34 V38 H8Z" fill="${color}" stroke="#00000055" stroke-width="2"/>
    <path d="M40 14 H56 V23 H31Z M60 14 H78 C82 14 85 16 89 23 H60Z" fill="#bfe7ff" stroke="#00000033"/>
    <rect x="104" y="27" width="8" height="4" rx="1" fill="#fff3b0"/><rect x="8" y="28" width="6" height="4" rx="1" fill="#ff5252"/>
    <circle cx="32" cy="38" r="9" fill="#222"/><circle cx="32" cy="38" r="4" fill="#9e9e9e"/>
    <circle cx="90" cy="38" r="9" fill="#222"/><circle cx="90" cy="38" r="4" fill="#9e9e9e"/>
  </svg>`;
}

/** Petit vol d'oiseaux. */
export function birdsSVG() {
  return `<svg class="birds-art" viewBox="0 0 80 30" aria-hidden="true">
    <path class="wing" d="M4 12 Q10 4 16 12 Q22 4 28 12" fill="none" stroke="#2b2b3a" stroke-width="2.4" stroke-linecap="round"/>
    <path class="wing" d="M34 20 Q39 13 44 20 Q49 13 54 20" fill="none" stroke="#2b2b3a" stroke-width="2.2" stroke-linecap="round" style="animation-delay:.2s"/>
    <path class="wing" d="M58 8 Q62 2 66 8 Q70 2 74 8" fill="none" stroke="#2b2b3a" stroke-width="2" stroke-linecap="round" style="animation-delay:.4s"/>
  </svg>`;
}
