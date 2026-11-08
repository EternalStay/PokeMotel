// Edge Function `act` : le moteur du jeu, côté serveur.
// Le navigateur envoie { op, ... } avec le jeton de session du joueur ; la
// fonction vérifie le joueur, applique la requête (voir ../_shared/handle.js) et
// enregistre l'hôtel avec un verrou optimiste (deux requêtes simultanées ne
// s'écrasent pas : la seconde est rejouée sur l'état à jour).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import * as E from '../_shared/engine/index.js';
import { handle, summary } from '../_shared/handle.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Méthode non permise.' }, 405);

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ ok: false, error: 'Connectez-vous pour jouer en ligne.' }, 401);

  const body = await req.json().catch(() => null);

  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: row, error: readErr } = await admin.from('hotels').select('state, version').eq('user_id', user.id).maybeSingle();
    if (readErr) return json({ ok: false, error: 'Lecture impossible.' }, 500);

    const out = handle(row, body, Date.now(), E);
    if (out.status !== 200) return json(out.res, out.status);
    if (!out.changed) return json({ ...out.res, state: out.state, version: row.version });

    const fields = { state: out.state, ...summary(out.state), updated_at: new Date().toISOString() };
    if (!row) {
      const { error } = await admin.from('hotels').insert({ user_id: user.id, version: 1, ...fields });
      if (!error) return json({ ...out.res, state: out.state, version: 1, created: true });
      if (error.code !== '23505') return json({ ok: false, error: 'Création impossible.' }, 500);
    } else {
      const { data: saved, error } = await admin.from('hotels').update({ ...fields, version: row.version + 1 })
        .eq('user_id', user.id).eq('version', row.version).select('version');
      if (error) return json({ ok: false, error: 'Enregistrement impossible.' }, 500);
      if (saved && saved.length) return json({ ...out.res, state: out.state, version: row.version + 1 });
    }
    // Quelqu'un a écrit entre-temps : on recommence sur l'état à jour.
  }
  return json({ ok: false, error: 'Serveur occupé, réessayez.' }, 409);
});
