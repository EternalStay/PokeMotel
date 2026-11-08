// =============================================================================
// Sons du jeu, entièrement synthétisés (Web Audio) : aucun fichier, rien de
// copié. Courts et discrets ; un seul son à la fois par instant (le plus
// important l'emporte). Les navigateurs interdisent le son avant la première
// action du joueur : le contexte audio n'est créé qu'à ce moment-là.
// =============================================================================

let ctx = null;
let master = null;
let enabled = true;
let wanted = null;   // { name, prio } : le son retenu pour cet instant
let flushQueued = false;

const VOLUME = 0.22;

/** À appeler sur un geste du joueur : crée (ou réveille) le contexte audio. */
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? VOLUME : 0;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function setSoundEnabled(on) {
  enabled = !!on;
  if (master) master.gain.setTargetAtTime(enabled ? VOLUME : 0, ctx.currentTime, 0.02);
}
export const soundEnabled = () => enabled;

// --- Briques de synthèse ---------------------------------------------------------
function tone(freq, start, dur, { type = 'sine', gain = 0.6, slide = null, attack = 0.005 } = {}) {
  const t = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(start, dur, { gain = 0.5, freq = 1200, q = 0.8, type = 'bandpass' } = {}) {
  const t = ctx.currentTime + start;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

// --- Le répertoire --------------------------------------------------------------------
const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5, G4 = 392, A5 = 880;

const SOUNDS = {
  click: () => tone(1400, 0, 0.045, { type: 'triangle', gain: 0.25 }),
  place: () => { tone(420, 0, 0.12, { type: 'sine', gain: 0.5, slide: 760 }); tone(980, 0.06, 0.08, { type: 'triangle', gain: 0.2 }); },
  error: () => { tone(220, 0, 0.12, { type: 'square', gain: 0.18 }); tone(165, 0.1, 0.16, { type: 'square', gain: 0.18 }); },
  coin: () => { tone(E6, 0, 0.08, { type: 'square', gain: 0.18 }); tone(1975, 0.07, 0.22, { type: 'square', gain: 0.16 }); },
  pickup: () => { tone(660, 0, 0.07, { type: 'triangle', gain: 0.35 }); tone(990, 0.06, 0.07, { type: 'triangle', gain: 0.35 }); tone(1320, 0.12, 0.14, { type: 'triangle', gain: 0.3 }); },
  bell: () => { tone(A5 * 2, 0, 0.9, { gain: 0.35 }); tone(A5 * 2 * 2.76, 0, 0.35, { gain: 0.1 }); tone(A5 * 1.5, 0.18, 0.9, { gain: 0.25 }); },
  build: () => { for (let i = 0; i < 3; i++) { noise(i * 0.16, 0.06, { gain: 0.6, freq: 900, q: 1.2 }); tone(140, i * 0.16, 0.08, { type: 'sine', gain: 0.5, slide: 90 }); } },
  done: () => { tone(G5, 0, 0.18, { type: 'triangle', gain: 0.35 }); tone(C6, 0.12, 0.35, { type: 'triangle', gain: 0.35 }); },
  cash: () => { [C6, E6, 1568, 2093].forEach((f, i) => tone(f, i * 0.07, 0.18, { type: 'square', gain: 0.12 })); noise(0.05, 0.25, { gain: 0.15, freq: 6000, q: 0.5, type: 'highpass' }); },
  quest: () => { [C5, E5, G5, C6, E6].forEach((f, i) => tone(f, i * 0.06, 0.3, { type: 'triangle', gain: 0.25 })); },
  levelup: () => {
    [[G4, 0], [C5, 0.12], [E5, 0.24], [G5, 0.36]].forEach(([f, t]) => tone(f, t, 0.16, { type: 'square', gain: 0.16 }));
    tone(C6, 0.5, 0.7, { type: 'square', gain: 0.16 }); tone(E5, 0.5, 0.7, { type: 'triangle', gain: 0.2 }); tone(G5, 0.5, 0.7, { type: 'triangle', gain: 0.2 });
  },
  bad: () => { tone(330, 0, 0.18, { type: 'sawtooth', gain: 0.12, slide: 220 }); },
  boom: () => { noise(0, 0.7, { gain: 0.9, freq: 400, q: 0.4, type: 'lowpass' }); tone(110, 0, 0.6, { type: 'sine', gain: 0.8, slide: 35 }); },
};

/** Propose un son ; à chaque instant, seul le plus prioritaire est joué. */
export function sfx(name, prio = 1) {
  if (!enabled || !ctx || !SOUNDS[name]) return;
  if (!wanted || prio > wanted.prio) wanted = { name, prio };
  if (!flushQueued) {
    flushQueued = true;
    setTimeout(() => {
      flushQueued = false;
      const w = wanted;
      wanted = null;
      if (w && ctx && ctx.state === 'running') SOUNDS[w.name]();
    }, 0);
  }
}

/** Son associé à une ligne du journal (ce qui arrive pendant que le temps passe). */
export function soundForLog(l) {
  const t = l.text;
  if (t.startsWith('🏛️ Taxe payée')) return ['levelup', 9];
  if (t.includes('💥')) return ['boom', 8];
  if (t.startsWith('📜 Mission accomplie') || t.startsWith('🏅')) return ['quest', 7];
  if (t.startsWith('Bilan nocturne')) return ['cash', 6];
  if (t.startsWith('Construction terminée') || t.includes('améliorée au niveau')) return ['done', 4];
  if (t.startsWith('Nouveau client') || t.startsWith('🌟 Une STAR') || t.startsWith('🥚')) return ['bell', 3];
  if (t.startsWith('Départ :') && l.kind === 'good') return ['coin', 3];
  if (l.kind === 'bad' && t.startsWith('Au vol')) return ['bad', 3];
  return null;
}

/** Son d'une action réussie du joueur. */
export const ACTION_SOUNDS = {
  placeGuest: 'place', moveGuest: 'place', fulfillRequest: 'coin', collectLeftover: 'pickup',
  buildRoom: 'build', upgradeRoom: 'build', extendRoom: 'build', upgradeLobby: 'build',
  useItem: 'place', placeDeco: 'place', openDecoBox: 'pickup', buyItem: 'coin', buyPack: 'coin', buyCampaign: 'coin',
  hireStaff: 'click', assignStaff: 'click', studyGuest: 'bad', spendTalent: 'done', attractGuest: 'bell',
};
