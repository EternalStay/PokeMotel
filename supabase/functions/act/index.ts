// Edge Function `act` : le moteur du jeu, côté serveur.
// Le navigateur envoie { op, ... } avec le jeton de session du joueur ; la
// fonction vérifie le joueur, applique la requête (voir ../_shared/handle.js) et
// enregistre l'hôtel avec un verrou optimiste (deux requêtes simultanées ne
// s'écrasent pas : la seconde est rejouée sur l'état à jour).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import * as E from '../_shared/engine/index.js';
import { handle, summary } from '../_shared/handle.js';
import { social } from '../_shared/social.js';

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

// Accès à la base pour le social (mêmes méthodes que la base en mémoire des tests).
const PUBLIC = 'user_id, friend_code, hotel_name, level, prestige, stars';
const must = <T>(r: { data: T; error: unknown }) => { if (r.error) throw r.error; return r.data; };
const db = {
  hotelById: async (id: string) => must(await admin.from('hotels').select(PUBLIC).eq('user_id', id).maybeSingle()),
  hotelByCode: async (code: string) => must(await admin.from('hotels').select(PUBLIC).eq('friend_code', code).maybeSingle()),
  hotelsByIds: async (ids: string[]) => (ids.length ? must(await admin.from('hotels').select(PUBLIC).in('user_id', ids)) : []),
  topHotels: async (n: number) => must(await admin.from('hotels').select(PUBLIC).order('prestige', { ascending: false }).order('level', { ascending: false }).limit(n)),
  hotelState: async (id: string) => must(await admin.from('hotels').select('state, version').eq('user_id', id).maybeSingle()),
  saveHotelState: async (id: string, version: number, state: unknown, fields: Record<string, unknown>) => {
    const saved = must(await admin.from('hotels').update({ state, ...fields, version: version + 1, updated_at: new Date().toISOString() })
      .eq('user_id', id).eq('version', version).select('version'));
    return !!(saved && saved.length);
  },
  friendships: async (id: string) => must(await admin.from('friendships').select('*').or(`user_a.eq.${id},user_b.eq.${id}`)),
  getFriendship: async (a: string, b: string) => must(await admin.from('friendships').select('*').eq('user_a', a).eq('user_b', b).maybeSingle()),
  insertFriendship: async (row: Record<string, unknown>) => { must(await admin.from('friendships').insert(row)); },
  updateFriendship: async (a: string, b: string, patch: Record<string, unknown>) => { must(await admin.from('friendships').update(patch).eq('user_a', a).eq('user_b', b)); },
  deleteFriendship: async (a: string, b: string) => { must(await admin.from('friendships').delete().eq('user_a', a).eq('user_b', b)); },
  wallPosts: async (owner: string, n: number) => must(await admin.from('wall_posts').select('id, owner, author, body, created_at').eq('owner', owner).order('created_at', { ascending: false }).limit(n)),
  countPostsSince: async (author: string, since: string) => {
    const r = await admin.from('wall_posts').select('id', { count: 'exact', head: true }).eq('author', author).gte('created_at', since);
    if (r.error) throw r.error;
    return r.count || 0;
  },
  insertPost: async (row: Record<string, unknown>) => { must(await admin.from('wall_posts').insert(row)); },
  getPost: async (id: number) => must(await admin.from('wall_posts').select('id, owner, author').eq('id', id).maybeSingle()),
  deletePost: async (id: number) => { must(await admin.from('wall_posts').delete().eq('id', id)); },
  likesCount: async (owner: string) => {
    const r = await admin.from('wall_likes').select('user_id', { count: 'exact', head: true }).eq('owner', owner);
    if (r.error) throw r.error;
    return r.count || 0;
  },
  hasLiked: async (owner: string, user: string) => !!must(await admin.from('wall_likes').select('user_id').eq('owner', owner).eq('user_id', user).maybeSingle()),
  addLike: async (owner: string, user: string) => { must(await admin.from('wall_likes').insert({ owner, user_id: user })); },
  removeLike: async (owner: string, user: string) => { must(await admin.from('wall_likes').delete().eq('owner', owner).eq('user_id', user)); },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Méthode non permise.' }, 405);

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ ok: false, error: 'Connectez-vous pour jouer en ligne.' }, 401);

  const body = await req.json().catch(() => null);

  // Social (amis, classement, visite, Œufs, mur) : voir ../_shared/social.js.
  if (typeof body?.op === 'string' && body.op.startsWith('social.')) {
    try {
      const out = await social(body, user.id, db, E, Date.now());
      return json(out.res, out.status);
    } catch (e) {
      console.error(e);
      return json({ ok: false, error: 'Le serveur social a eu un souci, réessayez.' }, 500);
    }
  }

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
