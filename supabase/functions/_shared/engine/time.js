// =============================================================================
// Gestion de l'heure "officielle" de l'hôtel (fuseau configurable, heure d'été
// comprise). Le jeu tourne sur la VRAIE horloge : paiement à minuit, départs à
// 10h, aucune arrivée la nuit.
// =============================================================================

const formatters = new Map();

function formatter(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(timeZone, new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short',
    }));
  }
  return formatters.get(timeZone);
}

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Décompose un instant (ms) en heure locale du fuseau donné. */
export function zonedParts(ms, timeZone) {
  const out = {};
  for (const { type, value } of formatter(timeZone).formatToParts(new Date(ms))) {
    if (type === 'weekday') out.weekday = WEEKDAYS[value];
    else if (type !== 'literal') out[type] = Number(value);
  }
  return { y: out.year, m: out.month - 1, d: out.day, h: out.hour, min: out.minute, s: out.second, weekday: out.weekday };
}

/** Décalage (ms) du fuseau par rapport à UTC à l'instant donné. */
function offsetAt(ms, timeZone) {
  const p = zonedParts(ms, timeZone);
  const asUtc = Date.UTC(p.y, p.m, p.d, p.h, p.min, p.s);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Convertit une heure locale (fuseau donné) en instant UTC (ms). */
export function localToUtc(y, m, d, h, timeZone, min = 0) {
  const guess = Date.UTC(y, m, d, h, min);
  let t = guess - offsetAt(guess, timeZone);
  t = guess - offsetAt(t, timeZone); // 2e passe : corrige les changements d'heure
  return t;
}

/** Prochain instant STRICTEMENT après `ms` où il est `hour`h00 dans le fuseau. */
export function nextLocalHour(ms, hour, timeZone) {
  const p = zonedParts(ms, timeZone);
  let t = localToUtc(p.y, p.m, p.d, hour, timeZone);
  if (t <= ms) t = localToUtc(p.y, p.m, p.d + 1, hour, timeZone);
  return t;
}

/** Vrai si l'instant tombe pendant la nuit (entre minuit et l'heure de réveil). */
export function isNightTime(ms, wakeUpHour, timeZone) {
  return zonedParts(ms, timeZone).h < wakeUpHour;
}

/** "14h05" */
export function formatClock(ms, timeZone) {
  const p = zonedParts(ms, timeZone);
  return `${String(p.h).padStart(2, '0')}h${String(p.min).padStart(2, '0')}`;
}

/** Clé de jour "2026-11-08" (heure locale de l'hôtel). */
export function dayKey(ms, timeZone) {
  const p = zonedParts(ms, timeZone);
  return `${p.y}-${String(p.m + 1).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
