// =============================================================================
// Aides visuelles : ce qui va / ne va pas pour chaque client.
// Pastilles d'influence, bulles de pensée contextuelles, mini-carte du
// voisinage, conseils. Tout est dérivé du détail structuré de la satisfaction.
// =============================================================================

import { AURAS, TYPES, ITEMS, SERVICES, BUILDABLES, neighborIds, occupancy, roomEquipEffects, guestAuras } from '../engine/index.js';
import { auraIcon, factorIcon, dirIcon, faceIcon, icon } from './icons.js';
import { creatureSVG } from './art.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sign = (v) => (v > 0 ? `+${v}` : `${v}`);

/** Lignes significatives (hors base), triées par importance. */
export function significant(lines) {
  return lines.filter((l) => l.kind !== 'base' && l.value !== 0).sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || a.value - b.value);
}

/** Pastilles d'influence (dans une chambre ou un aperçu). */
export function chipsHTML(lines, { max = 4, values = true, cls = '' } = {}) {
  const sig = significant(lines);
  if (!sig.length) return '';
  const shown = sig.slice(0, max);
  const more = sig.length - shown.length;
  return `<div class="fx-row ${cls}">${shown.map((l) => {
    const missing = l.kind === 'missing' || l.kind === 'absent';
    return `<span class="fx ${l.value > 0 ? 'pos' : 'neg'}${missing ? ' missing' : ''}" title="${esc(l.label)}">${l.dir ? dirIcon(l.dir) : ''}${factorIcon(l)}${values ? `<b>${sign(l.value)}</b>` : ''}</span>`;
  }).join('')}${more > 0 ? `<span class="fx more">+${more}</span>` : ''}</div>`;
}

/** Liste détaillée (fiche, panneau d'aperçu). */
export function linesHTML(lines, { withBase = true } = {}) {
  const base = lines.find((l) => l.kind === 'base');
  const rest = lines.filter((l) => l.kind !== 'base').sort((a, b) => b.value - a.value);
  return `<ul class="why">
    ${withBase && base ? `<li class="base"><span class="why-ico">${faceIcon(base.value)}</span><span>${esc(base.label)}</span><b>${base.value}</b></li>` : ''}
    ${rest.map((l) => `<li class="${l.value > 0 ? 'pos' : l.value < 0 ? 'neg' : 'zero'}${l.kind === 'missing' || l.kind === 'absent' ? ' missing' : ''}"><span class="why-ico">${factorIcon(l)}${l.dir ? `<i class="why-dir">${dirIcon(l.dir)}</i>` : ''}</span>
      <span>${esc(l.label)}</span><b>${l.value === 0 ? '0' : sign(l.value)}</b></li>`).join('')}
  </ul>`;
}

/** Badge d'humeur (visage + note). */
export function moodBadge(sat) {
  const m = sat >= 7 ? 'good' : sat >= 4 ? 'mid' : 'bad';
  return `<span class="mood-badge mood-${m}">${faceIcon(sat)}<b>${sat}</b></span>`;
}

// -----------------------------------------------------------------------------
// Bulles de pensée contextuelles
// -----------------------------------------------------------------------------
const WANT = {
  chaleur: 'Il fait un froid de canard ici…',
  humidite: "J'ai la peau toute sèche…",
  odeur: 'Ça sent beaucoup trop le propre…',
  froid: "J'ai besoin d'un peu de fraîcheur…",
  bruit: "C'est d'un calme mortel…",
  voisinage: "Je m'ennuie tout seul…",
};
const LOVE = {
  chaleur: ['Ah, cette bonne chaleur !', 'Il fait bon ici…'],
  humidite: ['Quelle douce humidité…', 'Ça me rafraîchit la peau !'],
  froid: ['Ah, la fraîcheur !', 'Enfin un peu de froid !'],
  odeur: ['Mmmh, quel fumet !', 'Ça sent le bon vieux fromage !'],
  bruit: ["Ça bouge, j'adore !", 'Monte le son !'],
  voisinage: ["J'adore avoir de la compagnie !", 'Mes voisins sont sympas !'],
};
const HATE = {
  chaleur: ['Cette chaleur me fait fondre !', 'On étouffe ici !'],
  humidite: ['Tout est trempé !', 'Trop humide, beurk !'],
  froid: ['Brrr, je gèle !', 'Qui a ouvert la fenêtre ?!'],
  odeur: ['Pouah, ça pue !', 'Quelle odeur infâme…'],
  bruit: ['Quel vacarme !', 'Impossible de dormir avec ce bruit !'],
  voisinage: ['Trop de monde autour de moi…', 'On ne peut pas être tranquille ?!'],
};
const GENERIC = {
  good: ['Super le lit !', 'Je me plais bien ici !', 'Quelle chambre !', 'Tout est nickel.'],
  mid: ['Mouais.', 'Pas terrible…', 'Bof, ça ira pour une nuit.'],
  bad: ['Quel trou à rats…', 'Vivement le départ.', 'Je hais cet hôtel.'],
};
const pick = (arr, n) => arr[Math.abs(n) % arr.length];

/** Texte de pensée pour un client, basé sur ce qui l'affecte le plus. */
export function thoughtFor(guest, detail, seed) {
  if (guest.request) return { tone: 'ask', text: `J'aimerais : ${SERVICES[guest.request.kind].name.toLowerCase()} !`, icon: SERVICES[guest.request.kind].icon };
  const top = significant(detail.lines)[0];
  if (top) {
    if ((top.kind === 'aura' || top.kind === 'equip') && top.aura) {
      const txt = top.value > 0 ? pick(LOVE[top.aura], seed) : pick(HATE[top.aura], seed);
      return { tone: top.value > 0 ? 'pos' : 'neg', text: txt, aura: top.aura };
    }
    if (top.kind === 'missing') return { tone: 'neg', text: WANT[top.aura], aura: top.aura };
    if (top.kind === 'absent') return { tone: 'pos', text: `Enfin un endroit sans ${AURAS[top.aura].name.toLowerCase()} !`, aura: top.aura };
    const map = {
      joy: ['pos', "Mon voisin est d'une bonne humeur contagieuse !"],
      room: ['neg', 'Cette chambre est dans un état…'],
      star: top.value > 0 ? ['pos', 'Enfin une chambre digne de moi !'] : ['neg', 'Une chambre pareille pour MOI ?!'],
      move: ['neg', 'Encore un déménagement…'],
      care: ['pos', 'Quel service aux petits soins !'],
      gift: ['pos', 'Un cadeau ? Trop gentil !'],
      bonus: ['pos', 'Quelle bonne journée !'],
      malus: ['neg', 'Ce n\'est vraiment pas mon jour…'],
      service: ['pos', 'Merci pour le service !'],
      comfort: ['pos', 'Ce matelas est un nuage !'],
    }[top.kind];
    if (map) return { tone: map[0], text: map[1] };
  }
  const m = detail.value >= 7 ? 'good' : detail.value >= 4 ? 'mid' : 'bad';
  return { tone: m === 'good' ? 'pos' : m === 'bad' ? 'neg' : 'mid', text: pick(GENERIC[m], seed) };
}

// -----------------------------------------------------------------------------
// Mini-carte du voisinage (fiche client)
// -----------------------------------------------------------------------------
export function neighborhoodHTML(state, guest, detail) {
  const room = state.rooms[guest.roomId];
  const occ = occupancy(state);
  const cell = (dir, f, c) => {
    const id = `${f}-${c}`;
    const r = state.rooms[id];
    const lines = detail.lines.filter((l) => l.dir === dir);
    const total = lines.reduce((s, l) => s + l.value, 0);
    if (!r) return `<div class="nb nb-${dir} wall"><span>Mur</span></div>`;
    const n = occ[id];
    if (!n) {
      const what = r.kind === 'empty' ? 'Libre' : r.kind === 'bedroom' ? 'Vide' : BUILDABLES[r.sub]?.name || '—';
      return `<div class="nb nb-${dir} empty"><span>${esc(what)}</span></div>`;
    }
    const t = TYPES[n.type];
    const iso = roomEquipEffects(r).isolate;
    return `<div class="nb nb-${dir} ${total > 0 ? 'pos' : total < 0 ? 'neg' : 'zero'}">
      <div class="nb-av">${creatureSVG(n, 'good')}</div>
      <div class="nb-info"><b>${esc(n.name)}</b><span>${iso ? 'isolé' : guestAuras(n).length ? guestAuras(n).map((a) => auraIcon(a)).join('') : 'invisible'}</span></div>
      <em>${total === 0 ? '0' : sign(total)}</em>
    </div>`;
  };
  return `<div class="nbmap">
    ${cell('up', room.floor + 1, room.col)}
    ${cell('left', room.floor, room.col - 1)}
    <div class="nb nb-center"><div class="nb-av big">${creatureSVG(guest, detail.value >= 7 ? 'good' : detail.value >= 4 ? 'mid' : 'bad')}</div></div>
    ${cell('right', room.floor, room.col + 1)}
    ${cell('down', room.floor - 1, room.col)}
  </div>`;
}

/** Liste de conseils. */
export function adviceHTML(items) {
  const ico = { bad: icon('close'), tip: icon('sparkle'), good: icon('check') };
  return `<ul class="advice">${items.map((a) => `<li class="${a.tone}"><span class="adv-ico">${ico[a.tone] || ico.tip}</span><span>${esc(a.text)}</span></li>`).join('')}</ul>`;
}

/** Ambiance reçue par une chambre libre : auras entrantes, pour qui elle est idéale ou à éviter. */
export function ambianceHTML(state, room) {
  const occ = occupancy(state);
  if (roomEquipEffects(room).isolate) return '<p class="muted">Chambre isolée : rien n\'y entre (ni chaleur, ni bruit, ni odeurs…).</p>';
  const incoming = [];
  for (const id of neighborIds(state, room.id)) {
    const n = occ[id];
    if (!n || n.type === 'spectre' || roomEquipEffects(state.rooms[id]).isolate) continue;
    for (const a of guestAuras(n)) incoming.push({ n, aura: a });
    incoming.push({ n, aura: 'voisinage' });
  }
  for (const id of room.equip) for (const a of (ITEMS_CACHE[id] || [])) incoming.push({ n: null, aura: a, item: id });
  if (!incoming.length) return '<p class="muted">Rien ne parvient dans cette chambre (ni chaleur, ni bruit, ni odeurs…) : idéale pour un client qui déteste tout, à éviter pour un client qui aime quelque chose (−3 par goût qui lui manque).</p>';
  const kinds = [...new Set(incoming.map((x) => x.aura))];
  return `<div class="amb">${incoming.map(({ n, aura }) => `<span class="amb-chip">${auraIcon(aura)}<b>${AURAS[aura].name}</b><small>${n ? esc(n.name) : 'équipement'}</small></span>`).join('')}</div>
    <p class="amb-ok">${icon('check')} Idéale pour qui aime : ${kinds.map((a) => `<b>${AURAS[a].name}</b>`).join(', ')}</p>
    <p class="amb-warn">${icon('close')} À éviter pour qui déteste : ${kinds.map((a) => `<b>${AURAS[a].name}</b>`).join(', ')}</p>`;
}

// Auras générées par chaque équipement.
const ITEMS_CACHE = Object.fromEntries(Object.entries(ITEMS).map(([k, v]) => [k, v.auras || []]));
