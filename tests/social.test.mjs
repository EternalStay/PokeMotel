// Social côté serveur (amis, classement, visite, Œufs, mur), testé avec une base en mémoire.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine/index.js';
import { social, SOCIAL } from '../supabase/functions/_shared/social.js';
import { summary } from '../supabase/functions/_shared/handle.js';

const T0 = E.localToUtc(2026, 10, 10, 15, E.CONFIG.timeZone);
const codeOf = (id) => id.replace(/-/g, '').slice(0, 8).toUpperCase();

/** Base en mémoire, mêmes méthodes que l'adaptateur Supabase. */
function memoryDb() {
  const hotels = new Map();
  let friendships = [];
  let posts = [];
  let likes = [];
  let nextPost = 1;
  const pub = (h) => ({ user_id: h.user_id, friend_code: codeOf(h.user_id), ...summary(h.state) });
  return {
    _hotels: hotels,
    add(id, name, prestige = 0) {
      const state = E.createState(T0 - E.HOUR, id.charCodeAt(0));
      state.hotel.name = name;
      state.prestige = prestige;
      hotels.set(id, { user_id: id, state, version: 1 });
    },
    async hotelById(id) { const h = hotels.get(id); return h ? pub(h) : null; },
    async hotelByCode(code) { const h = [...hotels.values()].find((x) => codeOf(x.user_id) === code); return h ? pub(h) : null; },
    async hotelsByIds(ids) { return ids.map((i) => hotels.get(i)).filter(Boolean).map(pub); },
    async topHotels(n) { return [...hotels.values()].map(pub).sort((a, b) => b.prestige - a.prestige).slice(0, n); },
    async hotelState(id) { const h = hotels.get(id); return h ? { state: JSON.parse(JSON.stringify(h.state)), version: h.version } : null; },
    async saveHotelState(id, version, state) {
      const h = hotels.get(id);
      if (!h || h.version !== version) return false;
      h.state = JSON.parse(JSON.stringify(state)); h.version++;
      return true;
    },
    async friendships(id) { return friendships.filter((r) => r.user_a === id || r.user_b === id); },
    async getFriendship(a, b) { return friendships.find((r) => r.user_a === a && r.user_b === b) || null; },
    async insertFriendship(row) { friendships.push({ ...row }); },
    async updateFriendship(a, b, patch) { Object.assign(friendships.find((r) => r.user_a === a && r.user_b === b), patch); },
    async deleteFriendship(a, b) { friendships = friendships.filter((r) => !(r.user_a === a && r.user_b === b)); },
    async wallPosts(owner, n) { return posts.filter((p) => p.owner === owner).sort((a, b) => b.id - a.id).slice(0, n); },
    async countPostsSince(author, since) { return posts.filter((p) => p.author === author && p.created_at >= since).length; },
    async insertPost(row) { posts.push({ ...row, id: nextPost++, created_at: new Date(T0).toISOString() }); },
    async getPost(id) { return posts.find((p) => p.id === id) || null; },
    async deletePost(id) { posts = posts.filter((p) => p.id !== id); },
    async likesCount(owner) { return likes.filter((l) => l.owner === owner).length; },
    async hasLiked(owner, user) { return likes.some((l) => l.owner === owner && l.user_id === user); },
    async addLike(owner, user) { likes.push({ owner, user_id: user }); },
    async removeLike(owner, user) { likes = likes.filter((l) => !(l.owner === owner && l.user_id === user)); },
  };
}

const A = 'aaaaaaaa-0000-0000-0000-000000000001';
const B = 'bbbbbbbb-0000-0000-0000-000000000002';
const C = 'cccccccc-0000-0000-0000-000000000003';

function world() {
  const db = memoryDb();
  db.add(A, 'Hôtel Alpha', 10);
  db.add(B, 'Hôtel Bravo', 30);
  db.add(C, 'Hôtel Charlie', 20);
  const call = (who, body) => social(body, who, db, E, T0).then((o) => o.res);
  return { db, call };
}

test('social : demande, acceptation, liste et retrait d’un ami', async () => {
  const { call } = world();
  assert.equal((await call(A, { op: 'social.request', code: 'ZZZZZZZZ' })).ok, false);
  assert.equal((await call(A, { op: 'social.request', code: codeOf(A) })).ok, false, 'pas soi-même');
  assert.ok((await call(A, { op: 'social.request', code: codeOf(B).toLowerCase() })).sent, 'code insensible à la casse');
  assert.equal((await call(A, { op: 'social.request', code: codeOf(B) })).ok, false, 'pas deux fois');
  let me = await call(B, { op: 'social.me' });
  assert.equal(me.me.code, codeOf(B));
  assert.deepEqual(me.friends.map((f) => [f.name, f.status]), [['Hôtel Alpha', 'incoming']]);
  assert.ok((await call(B, { op: 'social.accept', code: codeOf(A) })).ok);
  me = await call(A, { op: 'social.me' });
  assert.equal(me.friends[0].status, 'friend');
  assert.equal(me.canSendEgg, true);
  // Demande croisée : C demande A, A demande C → amis directement.
  await call(C, { op: 'social.request', code: codeOf(A) });
  assert.ok((await call(A, { op: 'social.request', code: codeOf(C) })).accepted);
  assert.ok((await call(A, { op: 'social.remove', code: codeOf(C) })).ok);
  assert.equal((await call(A, { op: 'social.me' })).friends.length, 1);
});

test('social : classement des amis et général', async () => {
  const { call } = world();
  await call(A, { op: 'social.request', code: codeOf(C) });
  await call(C, { op: 'social.accept', code: codeOf(A) });
  const friends = (await call(A, { op: 'social.ranking', scope: 'friends' })).ranking;
  assert.deepEqual(friends.map((r) => [r.rank, r.name, !!r.me]), [[1, 'Hôtel Charlie', false], [2, 'Hôtel Alpha', true]]);
  const all = (await call(A, { op: 'social.ranking', scope: 'all' })).ranking;
  assert.deepEqual(all.map((r) => r.name), ['Hôtel Bravo', 'Hôtel Charlie', 'Hôtel Alpha']);
  assert.ok(all.every((r) => !('user_id' in r)), 'jamais l’identifiant du compte');
});

test('social : visite en lecture seule, sans rien changer chez l’hôte', async () => {
  const { db, call } = world();
  const before = JSON.stringify(db._hotels.get(B).state);
  const v = await call(A, { op: 'social.visit', code: codeOf(B) });
  assert.ok(v.ok && v.state && v.hotel.name === 'Hôtel Bravo');
  assert.equal(v.mine, false);
  assert.equal(v.friend, false);
  assert.deepEqual(v.state.log, []);
  assert.equal(JSON.stringify(db._hotels.get(B).state), before);
});

test('social : un Œuf par jour, seulement entre amis, qui arrive dans la file de l’ami', async () => {
  const { db, call } = world();
  assert.equal((await call(A, { op: 'social.egg', code: codeOf(B) })).ok, false, 'pas encore amis');
  await call(A, { op: 'social.request', code: codeOf(B) });
  await call(B, { op: 'social.accept', code: codeOf(A) });
  const res = await call(A, { op: 'social.egg', code: codeOf(B) });
  assert.ok(res.ok && res.state, res.error);
  const host = db._hotels.get(B).state;
  const egg = Object.values(host.guests).find((g) => g.parcel);
  assert.ok(egg && host.queue.includes(egg.id));
  assert.equal(egg.parcel.from, 'Hôtel Alpha');
  assert.equal((await call(A, { op: 'social.me' })).canSendEgg, false);
  assert.equal((await call(A, { op: 'social.egg', code: codeOf(B) })).ok, false, 'un seul par jour');
});

test('social : mur (amis seulement), effacement, « j’aime »', async () => {
  const { call } = world();
  assert.equal((await call(A, { op: 'social.post', code: codeOf(B), text: 'Coucou' })).ok, false);
  await call(A, { op: 'social.request', code: codeOf(B) });
  await call(B, { op: 'social.accept', code: codeOf(A) });
  assert.equal((await call(A, { op: 'social.post', code: codeOf(B), text: '   ' })).ok, false);
  const w = await call(A, { op: 'social.post', code: codeOf(B), text: `Super hôtel !\n${'x'.repeat(400)}` });
  assert.equal(w.wall.length, 1);
  assert.equal(w.wall[0].body.length, SOCIAL.postMax);
  assert.ok(!w.wall[0].body.includes('\n'));
  assert.equal(w.wall[0].author.name, 'Hôtel Alpha');
  // Le propriétaire du mur peut effacer, un inconnu non.
  assert.equal((await call(C, { op: 'social.unpost', id: w.wall[0].id })).ok, false);
  assert.equal((await call(B, { op: 'social.unpost', id: w.wall[0].id })).wall.length, 0);
  // « J'aime » : bascule, pas sur son propre hôtel.
  assert.equal((await call(C, { op: 'social.like', code: codeOf(B) })).likes, 1);
  assert.equal((await call(C, { op: 'social.like', code: codeOf(B) })).likes, 0);
  assert.equal((await call(B, { op: 'social.like', code: codeOf(B) })).ok, false);
  // Limite de messages par heure.
  for (let i = 0; i < SOCIAL.postsPerHour; i++) await call(A, { op: 'social.post', code: codeOf(B), text: `n°${i}` });
  assert.equal((await call(A, { op: 'social.post', code: codeOf(B), text: 'encore' })).ok, false);
});

test('social : sans hôtel en ligne, rien n’est possible', async () => {
  const { db } = world();
  const out = await social({ op: 'social.me' }, 'dddddddd-0000-0000-0000-000000000004', db, E, T0);
  assert.equal(out.status, 403);
});
