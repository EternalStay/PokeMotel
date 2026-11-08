// =============================================================================
// Mobilier de décoration (dessins SVG maison) : 7 familles, plusieurs variantes.
// Chaque dessin a sa base au bas de son cadre (posé au sol) sauf les objets
// muraux (tableaux, luminaires). Leur largeur est dans le moteur (DECO_FAMILIES[type].w).
// =============================================================================

const VIEW = {
  plant_small: '0 0 30 40', plant_large: '0 0 40 70', painting: '0 0 40 30', light: '0 0 24 34',
  furniture: '0 0 50 50', sofa: '0 0 70 36', desk: '0 0 64 36',
};

const POT = (x, w, c = '#c4683b') => `<path d="M${x} 28 H${x + w} L${x + w - 2} 40 H${x + 2}Z" fill="${c}" stroke="#7a3a1c" stroke-width="1"/><rect x="${x - 1}" y="26" width="${w + 2}" height="3.5" rx="1" fill="${c}" stroke="#7a3a1c" stroke-width="1"/>`;

const ART = {
  plant_small: [
    // Cactus à fleur
    `${POT(8, 14)}<path d="M15 27 V10 a3 3 0 0 1 6 0 V27Z" fill="#5cb85c" stroke="#2e6b2e" stroke-width="1"/>
     <path d="M15 18 H11 V13 a2 2 0 0 1 4 0" fill="#5cb85c" stroke="#2e6b2e" stroke-width="1"/><circle cx="18" cy="7" r="2.6" fill="#ff6fa8"/>`,
    // Plante carnivore
    `${POT(8, 14, '#6d8bc4')}<path d="M15 27 C14 20 16 16 15 12" fill="none" stroke="#3d7a2c" stroke-width="2"/>
     <path d="M15 12 C6 12 5 3 13 3 C14 7 15 8 15 12Z" fill="#d84343" stroke="#7d1a12" stroke-width="1"/>
     <path d="M15 12 C24 12 25 3 17 3 C16 7 15 8 15 12Z" fill="#e85c5c" stroke="#7d1a12" stroke-width="1"/>
     <path d="M9 5 l1 2 M12 4 l.6 2 M18 4 l-.6 2 M21 5 l-1 2" stroke="#fff" stroke-width="1"/>`,
    // Tentacules violets
    `${POT(8, 14, '#d9a53a')}<path d="M12 27 C8 20 14 16 9 9" fill="none" stroke="#9b4fc4" stroke-width="3" stroke-linecap="round"/>
     <path d="M16 27 C17 18 13 12 17 5" fill="none" stroke="#b46ad6" stroke-width="3" stroke-linecap="round"/>
     <path d="M20 27 C24 21 18 17 23 11" fill="none" stroke="#9b4fc4" stroke-width="3" stroke-linecap="round"/>`,
    // Fleur-œil
    `${POT(8, 14, '#43a047')}<path d="M15 27 V14" stroke="#3d7a2c" stroke-width="2"/><path d="M15 21 C10 19 9 16 11 15 C13 17 14 19 15 21Z" fill="#7ad04e"/>
     ${[0, 60, 120, 180, 240, 300].map((a) => `<ellipse cx="15" cy="5" rx="3" ry="5" fill="#ffd23f" transform="rotate(${a} 15 10)"/>`).join('')}
     <circle cx="15" cy="10" r="4.4" fill="#fff" stroke="#c49a0a"/><circle cx="16" cy="10.5" r="2.2" fill="#1f1a2e"/><circle cx="16.8" cy="9.6" r=".7" fill="#fff"/>`,
  ],
  plant_large: [
    // Palmier en pot
    `<path d="M12 56 H28 L26 70 H14Z" fill="#c4683b" stroke="#7a3a1c"/><path d="M20 56 C19 40 21 28 20 18" stroke="#8d6e63" stroke-width="3.5" fill="none"/>
     ${[[-1, -1], [1, -1], [-1, 0.2], [1, 0.2], [0, -1.4]].map(([dx, dy]) => `<path d="M20 18 Q${20 + dx * 12} ${18 + dy * 10 - 4} ${20 + dx * 19} ${18 + dy * 6 + 8}" fill="none" stroke="#3d8a2c" stroke-width="4.5" stroke-linecap="round"/>`).join('')}`,
    // Monstera
    `<path d="M10 56 H30 L28 70 H12Z" fill="#eceff1" stroke="#78909c"/>
     ${[[-14, 20, -30], [12, 14, 25], [-6, 6, -10], [6, 30, 40]].map(([dx, y, r]) => `<g transform="translate(${20 + dx} ${y}) rotate(${r})"><path d="M0 0 C-11 -2 -12 16 0 18 C12 16 11 -2 0 0Z" fill="#2e8b57" stroke="#1b5e20" stroke-width="1"/><path d="M0 1 V17 M0 6 L-6 3 M0 10 L6 7 M0 13 L-6 12" stroke="#a5d6a7" stroke-width=".9"/></g>`).join('')}
     <path d="M20 56 V30" stroke="#1b5e20" stroke-width="2"/>`,
    // Champignon géant lumineux
    `<path d="M15 62 C15 50 17 40 16 30 H24 C23 40 25 50 25 62Z" fill="#fff3e0" stroke="#bfa77a"/>
     <path d="M2 32 C2 12 38 12 38 32 C30 35 10 35 2 32Z" fill="#e53935" stroke="#8e1b19"/>
     <circle cx="12" cy="24" r="3" fill="#fff"/><circle cx="24" cy="19" r="3.6" fill="#fff"/><circle cx="31" cy="27" r="2.4" fill="#fff"/>
     <ellipse cx="20" cy="65" rx="14" ry="5" fill="#6d4c41"/>`,
  ],
  painting: [
    // Paysage
    `<rect x="1" y="1" width="38" height="28" rx="1.5" fill="url(#gold)" stroke="#8a6410"/><rect x="5" y="5" width="30" height="20" fill="#9fd3f7"/>
     <path d="M5 25 L14 14 L20 20 L27 11 L35 21 V25Z" fill="#5c9e4a"/><circle cx="29" cy="9" r="2.6" fill="#ffd23f"/>`,
    // Portrait de monstre
    `<rect x="1" y="1" width="38" height="28" rx="1.5" fill="#5d3a24" stroke="#2e1a10"/><rect x="5" y="5" width="30" height="20" fill="#3b2a4a"/>
     <path d="M20 8 C28 8 30 15 30 25 H10 C10 15 12 8 20 8Z" fill="#73cc5a"/><circle cx="16.5" cy="15" r="2.4" fill="#fff"/><circle cx="23.5" cy="15" r="2.4" fill="#fff"/>
     <circle cx="17" cy="15.5" r="1.1" fill="#1f1a2e"/><circle cx="24" cy="15.5" r="1.1" fill="#1f1a2e"/><path d="M16 20 Q20 23 24 20" fill="none" stroke="#1f1a2e" stroke-width="1.2"/>`,
    // Abstrait
    `<rect x="1" y="1" width="38" height="28" rx="1.5" fill="#fafafa" stroke="#37474f"/><rect x="4" y="4" width="14" height="22" fill="#e53935"/>
     <rect x="20" y="4" width="16" height="10" fill="#1e64ce"/><rect x="20" y="16" width="7" height="10" fill="#ffd23f"/><path d="M4 4 H36 V26 H4Z M18 4 V26 M20 14 H36 M27 16 V26" fill="none" stroke="#212121" stroke-width="1.2"/>`,
    // Nuit étoilée
    `<rect x="1" y="1" width="38" height="28" rx="1.5" fill="url(#gold)" stroke="#8a6410"/><rect x="5" y="5" width="30" height="20" fill="#1d2b6b"/>
     <path d="M5 17 Q12 12 20 17 T35 15" fill="none" stroke="#7fb3ff" stroke-width="1.6"/><circle cx="29" cy="10" r="3" fill="#ffe14d"/>
     <circle cx="10" cy="9" r=".9" fill="#fff"/><circle cx="16" cy="12" r=".8" fill="#fff"/><circle cx="22" cy="8" r=".8" fill="#fff"/><path d="M8 25 L11 18 L14 25Z" fill="#0d1430"/>`,
  ],
  light: [
    // Applique dorée
    `<rect x="9" y="14" width="6" height="12" rx="2" fill="url(#gold)" stroke="#8a6410"/><path d="M12 14 V9" stroke="#8a6410" stroke-width="1.4"/>
     <path d="M4 10 L8 1 H16 L20 10Z" fill="#fff3c4" stroke="#c49a0a"/><circle class="lamp-glow" cx="12" cy="8" r="9" fill="#ffe9a0" opacity=".35"/>`,
    // Lustre suspendu
    `<path d="M12 0 V10" stroke="#5d4037" stroke-width="1.2"/><path d="M2 14 Q12 6 22 14" fill="none" stroke="url(#gold)" stroke-width="2.4"/>
     ${[3, 12, 21].map((x) => `<path d="M${x} 14 V20" stroke="#8a6410"/><path d="M${x - 2.5} 20 h5 l-1 6 h-3z" fill="#fff3c4" stroke="#c49a0a" stroke-width=".8"/>`).join('')}
     <circle class="lamp-glow" cx="12" cy="22" r="12" fill="#ffe9a0" opacity=".3"/>`,
  ],
  furniture: [
    // Commode
    `<rect x="4" y="14" width="42" height="34" rx="2" fill="#8d5a33" stroke="#4e2a12" stroke-width="1.2"/><rect x="2" y="11" width="46" height="4" rx="1" fill="#a8703f"/>
     ${[18, 28, 38].map((y) => `<rect x="8" y="${y}" width="34" height="8" rx="1" fill="#a8703f" stroke="#4e2a12" stroke-width=".8"/><circle cx="25" cy="${y + 4}" r="1.2" fill="#e9c46a"/>`).join('')}
     <rect x="6" y="48" width="4" height="2" fill="#4e2a12"/><rect x="40" y="48" width="4" height="2" fill="#4e2a12"/>
     <path d="M30 11 V5 M27 5 h6 l-1 -4 h-4z" fill="#fff3c4" stroke="#8a6410" stroke-width=".8"/>`,
    // Bibliothèque
    `<rect x="6" y="2" width="38" height="48" rx="1.5" fill="#6d4426" stroke="#3e2416" stroke-width="1.2"/>
     ${[4, 18, 32].map((y, j) => `<rect x="9" y="${y}" width="32" height="12" fill="#3e2416"/>${Array.from({ length: 7 }, (_, i) => `<rect x="${10 + i * 4.4}" y="${y + 2 + (i % 3)}" width="3.6" height="${10 - (i % 3)}" fill="${['#c62828', '#1565c0', '#2e7d32', '#f9a825', '#6a1b9a', '#00838f', '#d84315'][(i + j) % 7]}"/>`).join('')}`).join('')}
     <path d="M9 47 H41" stroke="#3e2416" stroke-width="2"/>`,
    // Horloge de parquet
    `<rect x="16" y="2" width="18" height="46" rx="3" fill="#7a4a28" stroke="#3e2416" stroke-width="1.2"/><circle cx="25" cy="12" r="7" fill="#fff8e1" stroke="#c9a24a" stroke-width="1.4"/>
     <path d="M25 12 V7.5 M25 12 L28 13.5" stroke="#3e2416" stroke-width="1.2"/><rect x="20" y="22" width="10" height="20" rx="1" fill="#3e2416"/>
     <g class="pendulum"><path d="M25 22 V36" stroke="#c9a24a" stroke-width="1"/><circle cx="25" cy="37" r="2.4" fill="url(#gold)"/></g><rect x="14" y="47" width="22" height="3" rx="1" fill="#3e2416"/>`,
  ],
  sofa: [
    // Canapé de velours rouge
    `<rect x="6" y="6" width="58" height="16" rx="6" fill="#b71c1c" stroke="#5d0f0f"/><rect x="2" y="16" width="66" height="14" rx="5" fill="#c62828" stroke="#5d0f0f"/>
     <rect x="0" y="12" width="10" height="18" rx="4" fill="#a31515" stroke="#5d0f0f"/><rect x="60" y="12" width="10" height="18" rx="4" fill="#a31515" stroke="#5d0f0f"/>
     <path d="M35 8 V22" stroke="#7f1212"/><rect x="6" y="30" width="4" height="5" fill="#3e2416"/><rect x="60" y="30" width="4" height="5" fill="#3e2416"/>
     <ellipse cx="20" cy="16" rx="6" ry="4" fill="#ffd23f" stroke="#a87b00"/>`,
    // Fauteuils verts
    `${[0, 38].map((x) => `<g transform="translate(${x} 0)"><rect x="4" y="4" width="24" height="18" rx="6" fill="#2e7d32" stroke="#1b5e20"/><rect x="2" y="17" width="28" height="13" rx="4" fill="#388e3c" stroke="#1b5e20"/><rect x="5" y="30" width="3" height="5" fill="#3e2416"/><rect x="24" y="30" width="3" height="5" fill="#3e2416"/></g>`).join('')}
     <rect x="31" y="22" width="8" height="13" rx="1" fill="#8d5a33" stroke="#4e2a12"/><path d="M33 22 V18 h4 v4" fill="#90caf9"/>`,
    // Pouf-canapé violet
    `<path d="M4 34 C0 16 16 4 35 4 C54 4 70 16 66 34Z" fill="#7b59c2" stroke="#3f2a73" stroke-width="1.2"/>
     <path d="M12 30 C12 20 22 14 35 14 C48 14 58 20 58 30" fill="none" stroke="#9c80e0" stroke-width="2"/>
     <circle cx="24" cy="22" r="1.6" fill="#3f2a73"/><circle cx="35" cy="20" r="1.6" fill="#3f2a73"/><circle cx="46" cy="22" r="1.6" fill="#3f2a73"/>`,
  ],
  desk: [
    `<rect x="2" y="10" width="60" height="24" rx="2" fill="#8a4d2a" stroke="#4e2a12" stroke-width="1.2"/><rect x="0" y="6" width="64" height="5" rx="2" fill="#c9a24a"/>
     <path d="M44 6 Q48 -2 52 6Z" fill="url(#gold)" stroke="#8a6410"/><rect x="8" y="16" width="20" height="12" rx="1" fill="#a8703f" stroke="#4e2a12" stroke-width=".8"/>`,
  ],
};

/** Proportions (largeur / hauteur) du cadre de chaque famille. */
export const decoRatio = (type) => { const [, , w, h] = (VIEW[type] || VIEW.plant_small).split(' ').map(Number); return `${w} / ${h}`; };

/** Dessin d'une pièce de mobilier. */
export function decoSVG(type, frame = 1) {
  const list = ART[type] || ART.plant_small;
  return `<svg class="deco-art" viewBox="${VIEW[type] || VIEW.plant_small}" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${list[(frame - 1) % list.length]}</svg>`;
}
