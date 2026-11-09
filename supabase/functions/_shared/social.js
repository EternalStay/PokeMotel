// =============================================================================
// Social, côté serveur : amis, classement, visite, Œufs surprise, mur de l'hôtel.
// Sans dépendance à Supabase : la base est passée en paramètre (`db`, voir
// l'adaptateur dans ../act/index.ts), ce qui permet de tout tester avec Node.
//
// Requêtes (corps JSON, op = 'social.xxx') ; chaque joueur est désigné par son
// CODE AMI (8 caractères), jamais par son identifiant de compte :
//   social.me                     → mon code, mes amis et demandes, Œuf du jour
//   social.request { code }       → demande d'ami (ou acceptation si l'autre l'a déjà demandé)
//   social.accept  { code }       → accepter une demande reçue
//   social.remove  { code }       → refuser / annuler / retirer un ami
//   social.ranking { scope }      → classement par prestige ('friends' ou 'all')
//   social.visit   { code }       → l'hôtel à visiter (lecture seule) et son mur
//   social.egg     { code }       → envoyer un Œuf surprise à un ami (1 par jour)
//   social.post    { code, text } → écrire sur le mur (le sien ou celui d'un ami)
//   social.unpost  { id }         → effacer un message (son auteur ou le propriétaire du mur)
//   social.like    { code }       → aimer / ne plus aimer un hôtel
// =============================================================================

import { summary } from './handle.js';

export const SOCIAL = { maxFriends: 100, rankingSize: 50, wallSize: 30, postMax: 200, postsPerHour: 10 };

const fail = (error, status = 400) => ({ status, res: { ok: false, error } });
const ok = (data = {}) => ({ status: 200, res: { ok: true, ...data } });
const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 8);
const pair = (x, y) => (x < y ? [x, y] : [y, x]);

/** Ce que les autres voient d'un hôtel. */
export const publicHotel = (h) => ({ code: h.friend_code, name: h.hotel_name || 'Hôtel sans nom', level: h.level, prestige: h.prestige, stars: h.stars });

/** Nom affiché comme expéditeur d'un Œuf ou auteur d'un message. */
const senderName = (h) => h.hotel_name || 'Un ami';

async function friendRow(db, me, other) {
  const [a, b] = pair(me, other);
  return db.getFriendship(a, b);
}

const isFriend = (row) => !!row && row.status === 'accepted';

/**
 * @param body   requête du joueur
 * @param userId joueur connecté
 * @param db     accès à la base (voir l'adaptateur)
 * @param E      le moteur (pour la visite et les Œufs)
 * @param now    horloge du serveur
 */
export async function social(body, userId, db, E, now) {
  const op = String(body?.op || '').replace(/^social\./, '');
  const me = await db.hotelById(userId);
  if (!me) return fail('Jouez d’abord une partie en ligne pour rejoindre vos amis.', 403);

  const target = async () => {
    const code = cleanCode(body.code);
    if (code.length !== 8) return null;
    return db.hotelByCode(code);
  };

  switch (op) {
    case 'me': {
      const rows = await db.friendships(userId);
      const others = rows.map((r) => (r.user_a === userId ? r.user_b : r.user_a));
      const hotels = new Map((await db.hotelsByIds(others)).map((h) => [h.user_id, h]));
      const list = rows.map((r) => {
        const other = r.user_a === userId ? r.user_b : r.user_a;
        const h = hotels.get(other);
        if (!h) return null;
        const status = r.status === 'accepted' ? 'friend' : r.requested_by === userId ? 'outgoing' : 'incoming';
        return { ...publicHotel(h), status };
      }).filter(Boolean).sort((x, y) => y.prestige - x.prestige);
      const mine = await db.hotelState(userId);
      return ok({ me: publicHotel(me), friends: list, canSendEgg: !!mine && E.canSendParcel(mine.state, now) });
    }

    case 'request': {
      const t = await target();
      if (!t) return fail('Aucun hôtel ne porte ce code.', 404);
      if (t.user_id === userId) return fail('C’est votre propre code !');
      const row = await friendRow(db, userId, t.user_id);
      if (isFriend(row)) return fail('Vous êtes déjà amis.');
      if (row && row.requested_by === userId) return fail('Demande déjà envoyée : elle attend sa réponse.');
      if (row) { // L'autre nous avait déjà demandé : on accepte.
        await db.updateFriendship(row.user_a, row.user_b, { status: 'accepted' });
        return ok({ accepted: true, friend: publicHotel(t) });
      }
      const count = (await db.friendships(userId)).length;
      if (count >= SOCIAL.maxFriends) return fail(`Vous avez déjà ${SOCIAL.maxFriends} amis ou demandes.`);
      const [a, b] = pair(userId, t.user_id);
      await db.insertFriendship({ user_a: a, user_b: b, requested_by: userId, status: 'pending' });
      return ok({ sent: true, friend: publicHotel(t) });
    }

    case 'accept': {
      const t = await target();
      const row = t && await friendRow(db, userId, t.user_id);
      if (!row || row.status !== 'pending' || row.requested_by === userId) return fail('Aucune demande de cet hôtel.');
      await db.updateFriendship(row.user_a, row.user_b, { status: 'accepted' });
      return ok({ friend: publicHotel(t) });
    }

    case 'remove': {
      const t = await target();
      const row = t && await friendRow(db, userId, t.user_id);
      if (!row) return fail('Cet hôtel ne fait pas partie de vos amis.');
      await db.deleteFriendship(row.user_a, row.user_b);
      return ok();
    }

    case 'ranking': {
      let list;
      if (body.scope === 'all') list = await db.topHotels(SOCIAL.rankingSize);
      else {
        const rows = (await db.friendships(userId)).filter(isFriend);
        list = await db.hotelsByIds([userId, ...rows.map((r) => (r.user_a === userId ? r.user_b : r.user_a))]);
      }
      list = [...list].sort((x, y) => y.prestige - x.prestige || y.level - x.level);
      return ok({ ranking: list.map((h, i) => ({ rank: i + 1, ...publicHotel(h), me: h.user_id === userId })) });
    }

    case 'visit': {
      const t = await target();
      if (!t) return fail('Aucun hôtel ne porte ce code.', 404);
      const row = await db.hotelState(t.user_id);
      const state = row && E.migrate(row.state);
      if (!state) return fail('Cet hôtel ne peut pas être visité pour le moment.', 500);
      E.advance(state, now); // en mémoire seulement : la visite ne change rien chez lui
      state.log = [];
      state.notices = [];
      const rel = t.user_id === userId ? null : await friendRow(db, userId, t.user_id);
      return ok({
        hotel: publicHotel(t),
        state,
        mine: t.user_id === userId,
        friend: isFriend(rel),
        ...(await wallOf(db, t.user_id, userId)),
      });
    }

    case 'egg': {
      const t = await target();
      if (!t) return fail('Aucun hôtel ne porte ce code.', 404);
      if (!isFriend(await friendRow(db, userId, t.user_id))) return fail('On n’envoie des Œufs qu’à ses amis.');
      // 1) Vérifier que j'en ai encore un aujourd'hui.
      const mine0 = await db.hotelState(userId);
      if (!mine0 || !E.canSendParcel(mine0.state, now)) return fail('Vous avez déjà envoyé un Œuf aujourd’hui.');
      const from = senderName(me);
      // 2) Le déposer chez l'ami (verrou optimiste : on rejoue si quelqu'un a écrit entre-temps).
      let delivered = null;
      for (let i = 0; i < 4 && !delivered; i++) {
        const row = await db.hotelState(t.user_id);
        const st = E.migrate(row.state);
        E.advance(st, now);
        const res = E.receiveParcel(st, from, now);
        if (!res.ok) return fail(res.error);
        if (await db.saveHotelState(t.user_id, row.version, st, summary(st))) delivered = res;
      }
      if (!delivered) return fail('Serveur occupé, réessayez.', 409);
      // 3) Le compter chez moi.
      for (let i = 0; i < 4; i++) {
        const row = await db.hotelState(userId);
        const st = E.migrate(row.state);
        E.advance(st, now);
        E.markParcelSent(st, now);
        if (await db.saveHotelState(userId, row.version, st, summary(st))) return ok({ state: st, version: row.version + 1 });
      }
      return ok(); // l'Œuf est parti ; le compteur du jour sera rattrapé au prochain essai
    }

    case 'post': {
      const t = await target();
      if (!t) return fail('Aucun hôtel ne porte ce code.', 404);
      if (t.user_id !== userId && !isFriend(await friendRow(db, userId, t.user_id))) return fail('Seuls ses amis peuvent écrire sur ce mur.');
      // eslint-disable-next-line no-control-regex
      const text = String(body.text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, SOCIAL.postMax);
      if (!text) return fail('Le message est vide.');
      const recent = await db.countPostsSince(userId, new Date(now - 3600_000).toISOString());
      if (recent >= SOCIAL.postsPerHour) return fail('Vous avez beaucoup écrit : patientez un peu avant le prochain message.');
      await db.insertPost({ owner: t.user_id, author: userId, body: text });
      return ok(await wallOf(db, t.user_id, userId));
    }

    case 'unpost': {
      const post = await db.getPost(Number(body.id));
      if (!post || (post.owner !== userId && post.author !== userId)) return fail('Message introuvable.');
      await db.deletePost(post.id);
      return ok(await wallOf(db, post.owner, userId));
    }

    case 'like': {
      const t = await target();
      if (!t) return fail('Aucun hôtel ne porte ce code.', 404);
      if (t.user_id === userId) return fail('On ne peut pas aimer son propre hôtel… même s’il est superbe.');
      if (await db.hasLiked(t.user_id, userId)) await db.removeLike(t.user_id, userId);
      else await db.addLike(t.user_id, userId);
      return ok(await wallOf(db, t.user_id, userId));
    }

    default:
      return fail('Requête inconnue.');
  }
}

/** Le mur d'un hôtel : derniers messages (avec le nom de leur auteur) et « j'aime ». */
async function wallOf(db, owner, viewer) {
  const posts = await db.wallPosts(owner, SOCIAL.wallSize);
  const authors = new Map((await db.hotelsByIds([...new Set(posts.map((p) => p.author))])).map((h) => [h.user_id, h]));
  return {
    wall: posts.map((p) => ({
      id: p.id,
      body: p.body,
      at: p.created_at,
      author: authors.get(p.author) ? publicHotel(authors.get(p.author)) : null,
      canDelete: p.author === viewer || owner === viewer,
    })),
    likes: await db.likesCount(owner),
    liked: await db.hasLiked(owner, viewer),
  };
}
