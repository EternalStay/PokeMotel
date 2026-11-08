// =============================================================================
// Jeu en ligne (Supabase) : comptes et appels au serveur qui fait foi.
// La bibliothèque est chargée à la demande : sans réseau, le jeu reste jouable
// en local. La clé ci-dessous est la clé PUBLIQUE du projet (faite pour être
// dans le navigateur) ; les règles d'accès de la base la rendent sans danger.
// =============================================================================

export const SUPABASE_URL = 'https://biwenlmxtabconpkblke.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_atE5dgyRKVS584ZjN1I5VQ_uLPzwrrT';
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';

let client = null;

async function sb() {
  if (client) return client;
  const { createClient } = await import(LIB);
  client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
  return client;
}

/** Retour à la page après une connexion (Google, lien de confirmation par e-mail). */
const backHere = () => `${location.origin}${location.pathname}`;

/** Session en cours (ou null), en traitant un éventuel retour de connexion Google. */
export async function currentSession() {
  const c = await sb();
  const { data } = await c.auth.getSession();
  if (location.search.includes('code=')) history.replaceState(null, '', backHere() + location.hash);
  return data.session;
}

export async function onAuthChange(cb) {
  const c = await sb();
  c.auth.onAuthStateChange((event, session) => cb(event, session));
}

const frenchAuthError = (e) => {
  const m = String(e?.message || e || '');
  if (/invalid login/i.test(m)) return 'E-mail ou mot de passe incorrect.';
  if (/not confirmed/i.test(m)) return 'Confirmez d’abord votre adresse : un lien vous a été envoyé par e-mail.';
  if (/already registered|already exists/i.test(m)) return 'Un compte existe déjà avec cette adresse : connectez-vous.';
  if (/password/i.test(m) && /6|characters|short/i.test(m)) return 'Le mot de passe doit faire au moins 6 caractères.';
  if (/provider is not enabled|unsupported provider/i.test(m)) return 'La connexion Google n’est pas encore activée sur le serveur.';
  if (/rate limit/i.test(m)) return 'Trop de tentatives : réessayez dans quelques minutes.';
  return m || 'Connexion impossible.';
};

export async function signIn(email, password) {
  const c = await sb();
  const { error } = await c.auth.signInWithPassword({ email, password });
  return error ? { ok: false, error: frenchAuthError(error) } : { ok: true };
}

export async function signUp(email, password) {
  const c = await sb();
  const { data, error } = await c.auth.signUp({ email, password, options: { emailRedirectTo: backHere() } });
  if (error) return { ok: false, error: frenchAuthError(error) };
  return { ok: true, needsConfirm: !data.session };
}

export async function signInGoogle() {
  const c = await sb();
  const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: backHere() } });
  return error ? { ok: false, error: frenchAuthError(error) } : { ok: true };
}

export async function signOut() {
  const c = await sb();
  await c.auth.signOut();
}

/** Appel au serveur du jeu (Edge Function `act`). Renvoie toujours { ok, … }. */
export async function callServer(body) {
  try {
    const c = await sb();
    const { data, error } = await c.functions.invoke('act', { body });
    if (error) {
      let msg = 'Serveur injoignable.';
      try { msg = (await error.context.json()).error || msg; } catch { /* réponse sans JSON */ }
      return { ok: false, error: msg, offline: !error.context };
    }
    return data;
  } catch {
    return { ok: false, error: 'Serveur injoignable.', offline: true };
  }
}
