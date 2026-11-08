// Icônes d'interface (SVG 24×24, trait arrondi), dessinées pour le jeu.
const P = {
  coin: '<circle cx="12" cy="12" r="9" fill="#ffcf3f" stroke="#a8700a"/><circle cx="12" cy="12" r="6" fill="none" stroke="#e0a91e"/><path d="M10 9.5 h4 M10 14.5 h4 M12 8 v8" stroke="#a8700a"/>',
  star: '<path d="M12 2.8 l2.8 5.8 6.3 .9 -4.6 4.4 1.1 6.3 -5.6 -3 -5.6 3 1.1 -6.3 -4.6 -4.4 6.3 -.9z" fill="#ffd84a" stroke="#b07d0a"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7 v5 l3.5 2"/>',
  sun: '<circle cx="12" cy="12" r="4.2" fill="#ffd84a" stroke="#c98a0a"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="#ffd84a"/>',
  moon: '<path d="M20 14.5 A8.5 8.5 0 1 1 9.5 4 A7 7 0 0 0 20 14.5z" fill="#fdf1c2" stroke="#c9b26b"/>',
  bell: '<path d="M5 17 h14 l-1.6 -2.2 V11 a5.4 5.4 0 0 0 -10.8 0 v3.8z"/><path d="M10 20 a2 2 0 0 0 4 0"/><path d="M12 4.2 V5.6"/>',
  scroll: '<path d="M7 4 h10 a2 2 0 0 1 2 2 v12 a2 2 0 0 1 -2 2 H8"/><path d="M7 4 a2 2 0 0 0 -2 2 v1.5 h4 V6 a2 2 0 0 0 -2 -2z"/><path d="M8 20 a2 2 0 0 1 -2 -2 v-1 h9 v1 a2 2 0 0 0 2 2"/><path d="M11 9 h5 M11 12.5 h5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3 a2.6 2.6 0 0 1 5 .9 c0 1.8 -2.5 2.2 -2.5 3.8"/><circle cx="12" cy="17.2" r=".6" fill="currentColor"/>',
  desk: '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5 V5.5 a1.5 1.5 0 0 1 1.5 -1.5 h3 a1.5 1.5 0 0 1 1.5 1.5 v2"/><path d="M3.5 12.5 h17"/>',
  shop: '<path d="M4 9 l1.5 -4.5 h13 L20 9"/><path d="M4 9 h16 a2.5 2.5 0 0 1 -5 0 a2.5 2.5 0 0 1 -5 0 a2.5 2.5 0 0 1 -5 0"/><path d="M5.5 11.5 V20 h13 v-8.5"/><path d="M10 20 v-5 h4 v5"/>',
  staff: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20 c0 -4 3 -6.5 7 -6.5 s7 2.5 7 6.5"/><path d="M8.6 4.6 h6.8 l-.8 -2 h-5.2z"/>',
  build: '<path d="M14.5 5.5 l4 4 -9.5 9.5 H5 v-4z"/><path d="M12.5 7.5 l4 4"/>',
  hammer: '<path d="M14 4 l6 6 -2.4 2.4 -6 -6z"/><path d="M13 9 l-8.5 8.5 a1.6 1.6 0 0 0 2.3 2.3 L15.3 11"/>',
  wrench: '<path d="M15 4 a4.5 4.5 0 0 0 -4.6 6 L4.5 16 a2 2 0 0 0 3 3 l6 -5.9 A4.5 4.5 0 0 0 19.8 8.6 l-2.7 2.7 -2.6 -.8 -.8 -2.6 2.7 -2.7 A4.4 4.4 0 0 0 15 4z"/>',
  up: '<path d="M12 19 V5 M6 11 l6 -6 6 6"/>',
  right: '<path d="M5 12 H19 M13 6 l6 6 -6 6"/>',
  close: '<path d="M6 6 l12 12 M18 6 L6 18"/>',
  move: '<path d="M3 7 h11 v9 H3z"/><path d="M14 10 h4 l3 3 v3 h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9 h18 M12 9 v11"/><path d="M12 9 C9 4 5.5 6 8 9 M12 9 c3 -5 6.5 -3 4 0"/>',
  bed: '<path d="M3 18 V7 M3 13 h18 v5 M21 18 v-5"/><path d="M6 13 v-2.5 a1.5 1.5 0 0 1 1.5 -1.5 h3 V13"/>',
  box: '<path d="M4 8 l8 -4 8 4 v8 l-8 4 -8 -4z"/><path d="M4 8 l8 4 8 -4 M12 12 v8"/>',
  trash: '<path d="M4 7 h16 M9 7 V4.5 h6 V7 M6 7 l1 13 h10 l1 -13"/>',
  heart: '<path d="M12 20 C5 15 3 11.5 3 8.5 A4.5 4.5 0 0 1 12 6.3 A4.5 4.5 0 0 1 21 8.5 C21 11.5 19 15 12 20z" fill="#ff6b81" stroke="#c0394f"/>',
  sparkle: '<path d="M12 3 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19 c0 -3.6 2.7 -5.6 6 -5.6 s6 2 6 5.6"/><path d="M15.5 4.9 a3.2 3.2 0 0 1 0 6.2 M17.5 13.6 c2 .7 3.5 2.4 3.5 5.4"/>',
  level: '<path d="M4 20 V14 h4 v6 M10 20 V10 h4 v10 M16 20 V5 h4 v15"/>',
  pickup: '<path d="M12 3 v12 M7 10 l5 5 5 -5"/><path d="M4 19 h16"/>',
  check: '<path d="M5 12.5 l4.5 4.5 L19 7"/>',
  bubble: '<path d="M4 5 h16 v10 H10 l-4 4 v-4 H4z"/>',
  gem: '<path d="M7 4 h10 l4 5 -9 11 -9 -11z" fill="#7fe3ff" stroke="#1b7fa8"/><path d="M3 9 h18 M9.5 4 L12 20 M14.5 4 L12 20" stroke="#1b7fa8" stroke-width="1.1"/>',
  door: '<path d="M6 21 V4 h12 v17"/><path d="M4 21 h16"/><circle cx="15" cy="13" r=".9" fill="currentColor"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5 V8 a4 4 0 0 1 8 0 v2.5"/>',
};

const FILLED = new Set(['coin', 'star', 'sun', 'moon', 'heart']);

// -----------------------------------------------------------------------------
// Icônes colorées des auras et des facteurs de satisfaction
// -----------------------------------------------------------------------------
const AURA_ART = {
  chaleur: '<path d="M12 2.5 C16 7 18 9.5 18 13.5 A6 6 0 0 1 6 13.5 C6 10.5 8 9 9 6.5 C10 9 11 9.5 12 9 C12.5 7 12.5 5 12 2.5Z" fill="#ff7a2f" stroke="#b33d0a" stroke-width="1.3"/><path d="M12 12 C14 14 14.5 15.5 14.5 16.5 A2.5 2.5 0 0 1 9.5 16.5 C9.5 15 11 14 12 12Z" fill="#ffe066"/>',
  humidite: '<path d="M12 2.5 C16.5 8 18.5 11 18.5 14.5 A6.5 6.5 0 0 1 5.5 14.5 C5.5 11 7.5 8 12 2.5Z" fill="#4f9bff" stroke="#1e5fbf" stroke-width="1.3"/><path d="M9 14.5 A3 3 0 0 0 11.5 17.5" stroke="#d4e8ff" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  pollen: '<path d="M5 19 C5 10 10 5 19 5 C19 14 14 19 5 19Z" fill="#5cc254" stroke="#2e7d32" stroke-width="1.3"/><path d="M5 19 L14 10" stroke="#2e7d32" stroke-width="1.3"/><circle cx="17.5" cy="17.5" r="2" fill="#ffd23f" stroke="#c49a0a"/>',
  statique: '<path d="M13.5 2 L5 13.5 H11 L9.5 22 L19 9.5 H13 Z" fill="#ffd23f" stroke="#a87b00" stroke-width="1.3" stroke-linejoin="round"/>',
  froid: '<g stroke="#2fa6c4" stroke-width="2.2" stroke-linecap="round"><path d="M12 2.5 V21.5 M3.8 7.2 L20.2 16.8 M3.8 16.8 L20.2 7.2"/></g><g stroke="#2fa6c4" stroke-width="1.6" stroke-linecap="round" fill="none"><path d="M9.5 4 L12 6 L14.5 4 M9.5 20 L12 18 L14.5 20"/></g><circle cx="12" cy="12" r="2.2" fill="#e8fbff" stroke="#2fa6c4" stroke-width="1.3"/>',
  odeur: '<path d="M6 21 C3 18 7 16 5 13 C3 10 7 8 6 5" stroke="#9b4fc4" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M12 21 C9 18 13 16 11 13 C9 10 13 8 12 5" stroke="#7cb342" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M18 21 C15 18 19 16 17 13 C15 10 19 8 18 5" stroke="#9b4fc4" stroke-width="2" fill="none" stroke-linecap="round"/>',
  voisinage: '<circle cx="12" cy="8" r="3.4" fill="#90caf9" stroke="#1e5fbf" stroke-width="1.2"/><circle cx="5.5" cy="10" r="2.4" fill="#bbdefb" stroke="#1e5fbf" stroke-width="1.1"/><circle cx="18.5" cy="10" r="2.4" fill="#bbdefb" stroke="#1e5fbf" stroke-width="1.1"/><path d="M5 20 C5 15.5 8.5 13 12 13 C15.5 13 19 15.5 19 20Z" fill="#90caf9" stroke="#1e5fbf" stroke-width="1.2"/>',
  bruit: '<path d="M3.5 9.5 H7.5 L12.5 5 V19 L7.5 14.5 H3.5Z" fill="#8f7f57" stroke="#5a4c2c" stroke-width="1.3" stroke-linejoin="round"/><path d="M15.5 9 A4 4 0 0 1 15.5 15 M18 6.5 A7.5 7.5 0 0 1 18 17.5" stroke="#5a4c2c" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
};

/** Icône colorée d'une aura. */
export function auraIcon(aura, cls = '') {
  return `<svg class="ico aura-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${AURA_ART[aura] || ''}</svg>`;
}

const FACTOR_ART = {
  joy: '<circle cx="12" cy="12" r="9.5" fill="#ffe066" stroke="#c49a0a" stroke-width="1.3"/><circle cx="9" cy="10" r="1.3" fill="#3a1420"/><circle cx="15" cy="10" r="1.3" fill="#3a1420"/><path d="M7.5 13.5 Q12 19 16.5 13.5Z" fill="#7a2335"/>',
  room: '<path d="M15 4 a4.5 4.5 0 0 0 -4.6 6 L4.5 16 a2 2 0 0 0 3 3 l6 -5.9 A4.5 4.5 0 0 0 19.8 8.6 l-2.7 2.7 -2.6 -.8 -.8 -2.6 2.7 -2.7 A4.4 4.4 0 0 0 15 4z" fill="#b0bec5" stroke="#455a64" stroke-width="1.3"/>',
  bonus: '<path d="M12 2 l2.6 6.2 6.4 .6 -4.9 4.2 1.5 6.3 L12 16 l-5.6 3.3 1.5 -6.3 L3 8.8 l6.4 -.6z" fill="#ffd84a" stroke="#b07d0a" stroke-width="1.2"/>',
  malus: '<path d="M6 17 a4 4 0 0 1 0 -8 a5.5 5.5 0 0 1 10.5 -1.5 a4 4 0 0 1 1.5 9.5z" fill="#90a4ae" stroke="#455a64" stroke-width="1.2"/><path d="M8 20 l1.5 -2.5 M12 21 l1.5 -2.5 M16 20 l1.5 -2.5" stroke="#4f8cff" stroke-width="1.6" stroke-linecap="round"/>',
  research: '<path d="M9 2 V9 L3.5 19 A2 2 0 0 0 5.3 22 H18.7 A2 2 0 0 0 20.5 19 L15 9 V2" fill="#e0f7fa" stroke="#00838f" stroke-width="1.4"/><path d="M5 17 H19 L20.5 19.5 A1.5 1.5 0 0 1 19 21.5 H5 A1.5 1.5 0 0 1 3.5 19.5Z" fill="#26c6da"/><path d="M8 2 H16" stroke="#00838f" stroke-width="1.6"/><circle cx="11" cy="14" r="1.2" fill="#80deea"/>',
  quest: '<path d="M6 3 h11 a2 2 0 0 1 2 2 v14 a2 2 0 0 1 -2 2 H7" fill="#fff3d6" stroke="#8a6410" stroke-width="1.3"/><path d="M6 3 a2 2 0 0 0 -2 2 v2 h4 V5 a2 2 0 0 0 -2 -2z" fill="#f2d398" stroke="#8a6410" stroke-width="1.3"/><path d="M7 21 a2 2 0 0 1 -2 -2 v-1 h10 v1 a2 2 0 0 0 2 2" fill="#f2d398" stroke="#8a6410" stroke-width="1.3"/><path d="M10 8 h6 M10 11.5 h6 M10 15 h4" stroke="#8a6410" stroke-width="1.3" stroke-linecap="round"/>',
  camaraderie: '<circle cx="8.5" cy="9" r="3.2" fill="#ffb74d" stroke="#a8620a" stroke-width="1.2"/><circle cx="15.5" cy="9" r="3.2" fill="#ffb74d" stroke="#a8620a" stroke-width="1.2"/><path d="M3 19 C3 15 6 13.5 8.5 13.5 C11 13.5 12 15 12 15 C12 15 13 13.5 15.5 13.5 C18 13.5 21 15 21 19Z" fill="#ffcc80" stroke="#a8620a" stroke-width="1.2"/>',
  social: '<circle cx="12" cy="8" r="3.4" fill="#90caf9" stroke="#1e5fbf" stroke-width="1.2"/><circle cx="5.5" cy="10" r="2.4" fill="#bbdefb" stroke="#1e5fbf" stroke-width="1.1"/><circle cx="18.5" cy="10" r="2.4" fill="#bbdefb" stroke="#1e5fbf" stroke-width="1.1"/><path d="M5 20 C5 15.5 8.5 13 12 13 C15.5 13 19 15.5 19 20Z" fill="#90caf9" stroke="#1e5fbf" stroke-width="1.2"/>',
  lonely: '<circle cx="12" cy="8" r="3.6" fill="#cfd8dc" stroke="#546e7a" stroke-width="1.2"/><path d="M5.5 20 C5.5 15.5 8.5 13 12 13 C15.5 13 18.5 15.5 18.5 20Z" fill="#cfd8dc" stroke="#546e7a" stroke-width="1.2"/><path d="M15 6.5 Q16.5 5.5 17 7" stroke="#546e7a" fill="none"/><circle cx="17.6" cy="9.5" r=".9" fill="#64b5f6"/>',
  grow: '<path d="M12 21 V11" stroke="#2e7d32" stroke-width="2"/><path d="M12 13 C8 13 5 10 5 6 C9 6 12 9 12 13Z M12 11 C12 7 15 4 19 4 C19 8 16 11 12 11Z" fill="#7ad04e" stroke="#2e7d32" stroke-width="1.2"/><path d="M17 15 C19 17.5 19.5 18.5 19.5 19.3 A1.7 1.7 0 0 1 16.1 19.3 C16.1 18.5 16.6 17.5 17 15Z" fill="#4f9bff"/>',
  star: '<path d="M3 17 L4.5 7 L9 11 L12 5 L15 11 L19.5 7 L21 17Z" fill="url(#gold)" stroke="#8a6410" stroke-width="1.3" stroke-linejoin="round"/><rect x="3" y="17" width="18" height="3" rx="1" fill="#c99a2e"/>',
  move: '<path d="M2.5 7 h11 v9 H2.5z" fill="#ffcc80" stroke="#8d5a1f" stroke-width="1.2"/><path d="M13.5 10 h4 l3 3 v3 h-7z" fill="#90caf9" stroke="#1e5fbf" stroke-width="1.2"/><circle cx="6.5" cy="17.5" r="1.9" fill="#37474f"/><circle cx="17" cy="17.5" r="1.9" fill="#37474f"/>',
  care: '<path d="M12 20 C5 15 3 11.5 3 8.5 A4.5 4.5 0 0 1 12 6.3 A4.5 4.5 0 0 1 21 8.5 C21 11.5 19 15 12 20z" fill="#ff6b81" stroke="#c0394f" stroke-width="1.2"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="1.5" fill="#ab47bc" stroke="#6a1b9a" stroke-width="1.2"/><path d="M3 9 h18 M12 9 v11" stroke="#ffd54f" stroke-width="2"/><path d="M12 9 C9 4 5.5 6 8 9 M12 9 c3 -5 6.5 -3 4 0" fill="none" stroke="#ffd54f" stroke-width="1.6"/>',
  service: '<path d="M4 17 h16 l-1.6 -2.2 V11 a6.4 6.4 0 0 0 -12.8 0 v3.8z" fill="url(#gold)" stroke="#8a6410" stroke-width="1.2"/><rect x="3" y="17" width="18" height="2.4" rx="1" fill="#8a6410"/><circle cx="12" cy="4.6" r="1.4" fill="#8a6410"/>',
  comfort: '<path d="M3 18 V8 M3 13 h18 v5 M21 18 v-5" stroke="#5e3b1d" stroke-width="1.8" fill="none"/><rect x="5" y="9.5" width="6" height="3.5" rx="1.5" fill="#fff" stroke="#9fb3d9"/><path d="M11 13 h10 v-2 a2 2 0 0 0 -2 -2 h-8z" fill="#9fb3d9"/>',
  hysteria: '<path d="M4 12 l3 -2 v4z" fill="#e0594a"/><path d="M8 9 h3 l5 -4 v14 l-5 -4 H8z" fill="#e0594a" stroke="#7d1a12" stroke-width="1.2" stroke-linejoin="round"/><path d="M18.5 8 l2.5 -2 M19 12 h3 M18.5 16 l2.5 2" stroke="#7d1a12" stroke-width="1.6" stroke-linecap="round"/>',
  isolated: '<rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="#e8e1f5" stroke="#8c7ab8" stroke-width="1.3"/><path d="M3.5 9.5 L9.5 3.5 M3.5 15.5 L15.5 3.5 M8.5 20.5 L20.5 8.5 M14.5 20.5 L20.5 14.5" stroke="#c8bce3"/>',
};

/** Icône d'un facteur de satisfaction (ligne du détail). */
export function factorIcon(line, cls = '') {
  if (line.aura && ['aura', 'equip', 'missing', 'absent'].includes(line.kind)) return auraIcon(line.aura, cls);
  return `<svg class="ico aura-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${FACTOR_ART[line.kind] || FACTOR_ART.comfort}</svg>`;
}

/** Visage d'humeur selon la satisfaction (0..10). */
export function faceIcon(sat, cls = '') {
  const v = Math.max(0, Math.min(10, sat));
  const fill = v >= 7 ? '#5be38c' : v >= 4 ? '#ffc163' : '#ff7b7b';
  const stroke = v >= 7 ? '#1d7a43' : v >= 4 ? '#a8620a' : '#9d1f24';
  const mouth = v >= 9 ? '<path d="M7.5 13.5 Q12 19 16.5 13.5Z" fill="#7a2335"/>'
    : v >= 7 ? '<path d="M8 14 Q12 17.5 16 14" fill="none" stroke="#3a1420" stroke-width="1.8" stroke-linecap="round"/>'
    : v >= 4 ? '<path d="M8.5 15 H15.5" stroke="#3a1420" stroke-width="1.8" stroke-linecap="round"/>'
    : '<path d="M8 16.5 Q12 12.5 16 16.5" fill="none" stroke="#3a1420" stroke-width="1.8" stroke-linecap="round"/>';
  const brows = v <= 2 ? '<path d="M6.5 7.5 L10 9 M17.5 7.5 L14 9" stroke="#3a1420" stroke-width="1.6" stroke-linecap="round"/>' : '';
  return `<svg class="ico face ${cls}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
    <circle cx="9" cy="10" r="1.4" fill="#3a1420"/><circle cx="15" cy="10" r="1.4" fill="#3a1420"/>${brows}${mouth}</svg>`;
}

/** Petite flèche indiquant la direction d'où vient un effet. */
export function dirIcon(dir) {
  const rot = { left: 180, right: 0, up: -90, down: 90 }[dir] ?? 0;
  return `<svg class="ico dir-ico" viewBox="0 0 24 24" aria-hidden="true"><path transform="rotate(${rot} 12 12)" d="M4 12 H17 M12 6 L18 12 L12 18" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** Renvoie le SVG d'une icône. */
export function icon(name, cls = '') {
  // Les icônes en couleur des facteurs de satisfaction servent aussi ailleurs (succès…).
  if (!P[name] && FACTOR_ART[name]) return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${FACTOR_ART[name]}</svg>`;
  const filled = FILLED.has(name);
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="${filled ? 'none' : 'currentColor'}" stroke-width="${filled ? 1.4 : 2}"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${filled ? P[name].replace(/stroke="(#[0-9a-f]+)"/gi, 'stroke="$1" stroke-width="1.4"') : P[name]}</svg>`;
}
