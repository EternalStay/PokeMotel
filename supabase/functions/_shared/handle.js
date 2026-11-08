// =============================================================================
// Logique du serveur, sans dépendance à Supabase ni à Deno (testable avec Node).
// Le serveur fait foi : il charge l'hôtel, rattrape le temps avec SA propre
// horloge, applique l'action par `dispatch`, et renvoie l'état à enregistrer.
//
// Requêtes acceptées (corps JSON) :
//   { op: 'load' }                       → l'hôtel (créé s'il n'existe pas)
//   { op: 'import', state }              → première connexion : reprend la partie
//                                          locale, seulement si le compte n'a pas encore d'hôtel
//   { op: 'act', name, args }            → une action du joueur
// Option : clearNotices (les fenêtres en attente ont déjà été montrées au joueur).
// =============================================================================

/**
 * @param row  ligne actuelle ({ state, version }) ou null si le joueur n'a pas d'hôtel
 * @param body corps de la requête
 * @param now  horloge du serveur (ms)
 * @param E    le moteur (src/engine)
 * @returns {{ status: number, res: object, state: object|null, created: boolean, changed: boolean }}
 */
export function handle(row, body, now, E) {
  const op = body && body.op;
  if (!['load', 'import', 'act'].includes(op)) return { status: 400, res: { ok: false, error: 'Requête inconnue.' }, state: null };

  let state;
  let created = false;
  if (row) {
    state = E.migrate(row.state);
    if (!state) return { status: 500, res: { ok: false, error: 'Sauvegarde du serveur illisible.' }, state: null };
  } else if (op === 'import' && body.state && typeof body.state === 'object') {
    // Une partie locale ne peut venir que du passé : on refuse un état « daté du futur ».
    state = E.migrate(JSON.parse(JSON.stringify(body.state)));
    if (!state || !(state.time <= now + 60_000)) return { status: 400, res: { ok: false, error: 'Partie locale illisible.' }, state: null };
    created = true;
  } else {
    state = E.createState(now);
    created = true;
  }

  const before = row ? JSON.stringify(row.state) : null;
  // Le navigateur a déjà affiché les fenêtres en attente (il calcule les mêmes en local).
  if (body.clearNotices) state.notices = [];
  E.advance(state, now);
  let res = { ok: true };
  if (op === 'act') res = E.dispatch(state, String(body.name || ''), Array.isArray(body.args) ? body.args : [], now);
  const changed = created || JSON.stringify(state) !== before;
  return { status: 200, res, state, created, changed };
}

/** Colonnes extraites de l'état (classement). */
export const summary = (state) => ({
  hotel_name: String(state.hotel?.name || '').slice(0, 64),
  level: state.hotel?.level || 1,
  prestige: state.prestige || 0,
  stars: state.stars || 0,
});
