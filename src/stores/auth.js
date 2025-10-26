import { writable } from 'svelte/store';

// Persistent stores for users and current user
export const users = writable([]);
export const currentUser = writable(null); // { id, username, createdAt, isAdmin? }
export const watched = writable([]); // [{id,title,image,watchedAt}]
export const favorites = writable([]); // [{id,title,image,addedAt}]
export const comments = writable([]); // [{id, text, createdAt}]
export const wishlist = writable([]); // [{id,title,image,addedAt}]
export const dropped = writable([]); // [{id,title,image,addedAt}]
export const ratings = writable({}); // { [id]: 1..10 }
export const notInterested = writable([]); // [{id,title,image,addedAt}]
export const friends = writable([]); // [userId]
export const friendRequestsIncoming = writable([]); // [{ fromId, createdAt }]
export const friendRequestsOutgoing = writable([]); // [{ toId, createdAt }]
export const notifications = writable([]); // [{ id, type, title, createdAt, payload }]

function persistUsers(list) {
  try {
    localStorage.setItem('auth:users', JSON.stringify(list));
  } catch (_) {}
}

function persistCurrent(user) {
  try {
    if (user?.id) localStorage.setItem('auth:currentUserId', user.id);
    else localStorage.removeItem('auth:currentUserId');
  } catch (_) {}
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('auth:users');
    const list = raw ? JSON.parse(raw) : [];
    users.set(Array.isArray(list) ? list : []);
    const currentId = localStorage.getItem('auth:currentUserId') || '';
    const current = list.find((u) => u.id === currentId) || null;
    currentUser.set(current);
    const libKey = current ? `auth:lib:${current.id}` : '';
    if (libKey) {
      const libRaw = localStorage.getItem(libKey);
      if (libRaw) {
        const lib = JSON.parse(libRaw);
        watched.set(lib.watched || []);
        favorites.set(lib.favorites || []);
        comments.set(lib.comments || []);
        wishlist.set(lib.wishlist || []);
        dropped.set(lib.dropped || []);
        ratings.set(lib.ratings || {});
        notInterested.set(lib.notInterested || []);
        friends.set(lib.friends || []);
        friendRequestsIncoming.set(lib.friendRequestsIncoming || []);
        friendRequestsOutgoing.set(lib.friendRequestsOutgoing || []);
      } else {
        watched.set([]); favorites.set([]); comments.set([]); wishlist.set([]); dropped.set([]); ratings.set({}); notInterested.set([]); friends.set([]); friendRequestsIncoming.set([]); friendRequestsOutgoing.set([]); notifications.set([]);
      }
    } else {
      watched.set([]); favorites.set([]); comments.set([]); wishlist.set([]); dropped.set([]); ratings.set({}); notInterested.set([]); friends.set([]); friendRequestsIncoming.set([]); friendRequestsOutgoing.set([]); notifications.set([]);
    }
  } catch (_) {
    users.set([]);
    currentUser.set(null);
    watched.set([]); favorites.set([]); comments.set([]); wishlist.set([]); dropped.set([]); ratings.set({}); friends.set([]); friendRequestsIncoming.set([]); friendRequestsOutgoing.set([]);
  }
}

loadFromStorage();

users.subscribe((list) => persistUsers(list));
currentUser.subscribe((u) => persistCurrent(u));

function loadActiveUserLibrary() {
  let active; currentUser.subscribe((v) => (active = v))();
  const libKey = active ? `auth:lib:${active.id}` : '';
  if (!libKey) {
    watched.set([]); favorites.set([]); comments.set([]); wishlist.set([]); dropped.set([]); ratings.set({}); notInterested.set([]); friends.set([]); friendRequestsIncoming.set([]); friendRequestsOutgoing.set([]);
    return;
  }
  try {
    const libRaw = localStorage.getItem(libKey);
    if (libRaw) {
      const lib = JSON.parse(libRaw);
      watched.set(lib.watched || []);
      favorites.set(lib.favorites || []);
      comments.set(lib.comments || []);
      wishlist.set(lib.wishlist || []);
      dropped.set(lib.dropped || []);
      ratings.set(lib.ratings || {});
      notInterested.set(lib.notInterested || []);
      friends.set(lib.friends || []);
      friendRequestsIncoming.set(lib.friendRequestsIncoming || []);
      friendRequestsOutgoing.set(lib.friendRequestsOutgoing || []);
      notifications.set(lib.notifications || []);
    } else {
      watched.set([]); favorites.set([]); comments.set([]); wishlist.set([]); dropped.set([]); ratings.set({}); notInterested.set([]); friends.set([]); friendRequestsIncoming.set([]); friendRequestsOutgoing.set([]); notifications.set([]);
    }
  } catch (_) {
    watched.set([]); favorites.set([]); comments.set([]); wishlist.set([]); dropped.set([]); ratings.set({}); notInterested.set([]); friends.set([]); friendRequestsIncoming.set([]); friendRequestsOutgoing.set([]); notifications.set([]);
  }
}

function persistLibrary() {
  let active;
  const unsub = currentUser.subscribe((v) => (active = v));
  unsub();
  if (!active) return;
  let w, f, c, wl, dr, rt, ni, fr, fri, fro;
  watched.subscribe((v) => (w = v))();
  favorites.subscribe((v) => (f = v))();
  comments.subscribe((v) => (c = v))();
  wishlist.subscribe((v) => (wl = v))();
  dropped.subscribe((v) => (dr = v))();
  ratings.subscribe((v) => (rt = v))();
  notInterested.subscribe((v) => (ni = v))();
  friends.subscribe((v) => (fr = v))();
  friendRequestsIncoming.subscribe((v) => (fri = v))();
  friendRequestsOutgoing.subscribe((v) => (fro = v))();
  let ntf; notifications.subscribe((v)=> (ntf = v))();
  const key = `auth:lib:${active.id}`;
  try { localStorage.setItem(key, JSON.stringify({ watched: w||[], favorites: f||[], comments: c||[], wishlist: wl||[], dropped: dr||[], ratings: rt || {}, notInterested: ni || [], friends: fr || [], friendRequestsIncoming: fri || [], friendRequestsOutgoing: fro || [], notifications: ntf || [] })); } catch (_) {}
}

watched.subscribe(() => persistLibrary());
favorites.subscribe(() => persistLibrary());
comments.subscribe(() => persistLibrary());
wishlist.subscribe(() => persistLibrary());
dropped.subscribe(() => persistLibrary());
ratings.subscribe(() => persistLibrary());
notInterested.subscribe(() => persistLibrary());
friends.subscribe(() => persistLibrary());
friendRequestsIncoming.subscribe(() => persistLibrary());
friendRequestsOutgoing.subscribe(() => persistLibrary());
notifications.subscribe(() => persistLibrary());

function normalizeName(name) {
  return (name || '').trim();
}

function getUsersSnapshot() {
  let current;
  const unsub = users.subscribe((v) => (current = v));
  unsub();
  return current || [];
}

function randomId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password || '');
  const buf = await crypto.subtle.digest('SHA-256', data);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function register(username, password) {
  const name = normalizeName(username);
  if (!name) throw new Error('Введите имя пользователя');
  if (!password || password.length < 4) throw new Error('Пароль должен быть не меньше 4 символов');
  const snapshot = getUsersSnapshot();
  const exists = snapshot.some((u) => u.username.toLowerCase() === name.toLowerCase());
  if (exists) throw new Error('Пользователь с таким именем уже существует');
  const passwordHash = await hashPassword(password);
  const user = { id: randomId(), username: name, passwordHash, createdAt: Date.now(), isAdmin: false, avatarUrl: null };
  users.set([...snapshot, user]);
  currentUser.set({ id: user.id, username: user.username, createdAt: user.createdAt, isAdmin: user.isAdmin, avatarUrl: user.avatarUrl });
  loadActiveUserLibrary();
  return user;
}

export async function login(username, password) {
  const name = normalizeName(username);
  const snapshot = getUsersSnapshot();
  let user = snapshot.find((u) => u.username.toLowerCase() === name.toLowerCase());

  // Special admin credentials: admin/admin
  if (name.toLowerCase() === 'admin' && (password || '') === 'admin') {
    if (!user) {
      user = { id: randomId(), username: 'admin', passwordHash: await hashPassword('admin'), createdAt: Date.now(), isAdmin: true };
      users.set([...snapshot, user]);
    } else if (!user.isAdmin) {
      const list = snapshot.map((u) => (u.id === user.id ? { ...u, isAdmin: true } : u));
      users.set(list);
      user = list.find((u) => u.id === user.id);
    }
    currentUser.set({ id: user.id, username: user.username, createdAt: user.createdAt, isAdmin: true, avatarUrl: user.avatarUrl });
    return user;
  }

  if (!user) throw new Error('Пользователь не найден');
  const passwordHash = await hashPassword(password || '');
  if (user.passwordHash !== passwordHash) throw new Error('Неверный пароль');
  currentUser.set({ id: user.id, username: user.username, createdAt: user.createdAt, isAdmin: !!user.isAdmin, avatarUrl: user.avatarUrl });
  loadActiveUserLibrary();
  return user;
}

export function logout() {
  currentUser.set(null);
  watched.set([]); favorites.set([]); comments.set([]); wishlist.set([]); dropped.set([]); ratings.set({}); notInterested.set([]); friends.set([]); friendRequestsIncoming.set([]); friendRequestsOutgoing.set([]);
}

export async function changePassword(oldPassword, newPassword) {
  const snapshot = getUsersSnapshot();
  let active;
  const unsub = currentUser.subscribe((v) => (active = v));
  unsub();
  if (!active) throw new Error('Нет активного пользователя');
  const idx = snapshot.findIndex((u) => u.id === active.id);
  if (idx < 0) throw new Error('Пользователь не найден');
  const oldHash = await hashPassword(oldPassword || '');
  if (snapshot[idx].passwordHash !== oldHash) throw new Error('Старый пароль неверен');
  const newHash = await hashPassword(newPassword || '');
  snapshot[idx] = { ...snapshot[idx], passwordHash: newHash };
  users.set([...snapshot]);
}

export function deleteAccount() {
  const snapshot = getUsersSnapshot();
  let active;
  const unsub = currentUser.subscribe((v) => (active = v));
  unsub();
  if (!active) return;
  users.set(snapshot.filter((u) => u.id !== active.id));
  currentUser.set(null);
}

const ADMIN_SECRET = 'admin';

export function promoteToAdmin(secret) {
  let active; currentUser.subscribe((v) => (active = v))();
  if (!active) throw new Error('Сначала войдите');
  if ((secret || '').trim() !== ADMIN_SECRET) throw new Error('Неверный секрет');
  let list; users.subscribe((v) => (list = v))();
  const idx = list.findIndex((u) => u.id === active.id);
  if (idx < 0) throw new Error('Пользователь не найден');
  list[idx] = { ...list[idx], isAdmin: true };
  users.set([...list]);
  currentUser.set({ ...active, isAdmin: true });
}

export function addToWatched(item) {
  let list; watched.subscribe((v) => (list = v))();
  if (!item?.id) return;
  if (list.some((x) => x.id === item.id)) return;
  watched.set([{ ...item, watchedAt: Date.now() }, ...list]);
}

export function addToFavorites(item) {
  let list; favorites.subscribe((v) => (list = v))();
  if (!item?.id) return;
  if (list.some((x) => x.id === item.id)) return;
  favorites.set([{ ...item, addedAt: Date.now() }, ...list]);
}

export function addToWishlist(item) {
  let list; wishlist.subscribe((v) => (list = v))();
  if (!item?.id) return;
  if (list.some((x) => x.id === item.id)) return;
  wishlist.set([{ ...item, addedAt: Date.now() }, ...list]);
  notify({ type: 'wishlist', title: `Добавлено в желаемое: ${item.title}`, payload: { id: item.id } });
}

export function addToDropped(item) {
  let list; dropped.subscribe((v) => (list = v))();
  if (!item?.id) return;
  if (list.some((x) => x.id === item.id)) return;
  dropped.set([{ ...item, addedAt: Date.now() }, ...list]);
}

export function addComment(text) {
  let list; comments.subscribe((v) => (list = v))();
  const id = randomId();
  comments.set([{ id, text: (text||'').trim(), createdAt: Date.now() }, ...list]);
}

export function removeFromFavorites(id) {
  let list; favorites.subscribe((v) => (list = v))();
  favorites.set(list.filter((x) => x.id !== id));
}

export function removeFromWishlist(id) {
  let list; wishlist.subscribe((v) => (list = v))();
  wishlist.set((list || []).filter((x) => x.id !== id));
}

export function removeFromWatched(id) {
  let list; watched.subscribe((v) => (list = v))();
  watched.set((list || []).filter((x) => x.id !== id));
}

export function removeFromDropped(id) {
  let list; dropped.subscribe((v) => (list = v))();
  dropped.set((list || []).filter((x) => x.id !== id));
}

export function moveItemToList(target, item) {
  if (!item?.id) return;
  removeFromWishlist(item.id);
  removeFromWatched(item.id);
  removeFromDropped(item.id);
  if (target === 'wishlist') addToWishlist(item);
  else if (target === 'watched') addToWatched(item);
  else if (target === 'dropped') addToDropped(item);
}

export function isFavorite(id) {
  let list; favorites.subscribe((v) => (list = v))();
  return (list || []).some((x) => x.id === id);
}

export function toggleFavorite(item) {
  if (!item?.id) return;
  if (isFavorite(item.id)) removeFromFavorites(item.id);
  else addToFavorites(item);
}

export function addNotInterested(item) {
  let list; notInterested.subscribe((v) => (list = v))();
  if (!item?.id) return;
  if (list.some((x) => x.id === item.id)) return;
  notInterested.set([{ id: item.id, title: item.title, image: item.image, addedAt: Date.now() }, ...(list || [])]);
}

export function removeNotInterested(id) {
  let list; notInterested.subscribe((v) => (list = v))();
  notInterested.set((list || []).filter((x) => x.id !== id));
}

export function isNotInterested(id) {
  let list; notInterested.subscribe((v) => (list = v))();
  return (list || []).some((x) => x.id === id);
}

export function setRating(itemId, value) {
  const id = itemId ?? null;
  const v = Number(value);
  if (!id || Number.isNaN(v)) return;
  const clamped = Math.max(1, Math.min(10, Math.round(v)));
  let map; ratings.subscribe((m) => (map = m))();
  ratings.set({ ...(map || {}), [id]: clamped });
}

export function clearRating(itemId) {
  let map; ratings.subscribe((m) => (map = m))();
  if (!map) return;
  const next = { ...map };
  delete next[itemId];
  ratings.set(next);
}

export function setCurrentUserAvatar(avatarUrl) {
  let active; currentUser.subscribe((v) => (active = v))();
  if (!active) return;
  let list; users.subscribe((v) => (list = v))();
  const idx = list.findIndex((u) => u.id === active.id);
  if (idx < 0) return;
  const updated = { ...list[idx], avatarUrl };
  const newList = [...list.slice(0, idx), updated, ...list.slice(idx + 1)];
  users.set(newList);
  currentUser.set({ ...active, avatarUrl });
}

export function clearCurrentUserAvatar() {
  setCurrentUserAvatar(null);
}

// ---------- Friends API ----------

function readUserLib(userId) {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(`auth:lib:${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch (_) { return {}; }
}

function writeUserLib(userId, obj) {
  if (!userId) return;
  try { localStorage.setItem(`auth:lib:${userId}`, JSON.stringify(obj || {})); } catch (_) {}
}

export function isFriendsWith(userId) {
  let me; currentUser.subscribe((v) => (me = v))();
  if (!me?.id || !userId) return false;
  let my; friends.subscribe((v) => (my = v))();
  const otherLib = readUserLib(userId);
  const otherFriends = otherLib?.friends || [];
  return (my || []).includes(userId) && (otherFriends || []).includes(me.id);
}

export function sendFriendRequest(toId) {
  let me; currentUser.subscribe((v) => (me = v))();
  if (!me?.id) throw new Error('Сначала войдите');
  if (!toId || toId === me.id) throw new Error('Некорректный пользователь');
  if (isFriendsWith(toId)) throw new Error('Уже в друзьях');
  let out; friendRequestsOutgoing.subscribe((v) => (out = v))();
  if ((out || []).some((r) => r.toId === toId)) throw new Error('Заявка уже отправлена');
  // add to outgoing for me
  friendRequestsOutgoing.set([...(out || []), { toId, createdAt: Date.now() }]);
  notify({ type: 'friend_request_sent', title: 'Заявка в друзья отправлена', payload: { toId } });
  // add to incoming for other
  const other = readUserLib(toId);
  const inc = Array.isArray(other.friendRequestsIncoming) ? other.friendRequestsIncoming : [];
  other.friendRequestsIncoming = [...inc, { fromId: me.id, createdAt: Date.now() }];
  writeUserLib(toId, { watched: other.watched||[], favorites: other.favorites||[], comments: other.comments||[], wishlist: other.wishlist||[], dropped: other.dropped||[], ratings: other.ratings||{}, notInterested: other.notInterested||[], friends: other.friends||[], friendRequestsIncoming: other.friendRequestsIncoming, friendRequestsOutgoing: other.friendRequestsOutgoing||[] });
}

export function acceptFriendRequest(fromId) {
  let me; currentUser.subscribe((v) => (me = v))();
  if (!me?.id || !fromId) return;
  let inc; friendRequestsIncoming.subscribe((v) => (inc = v))();
  // remove from incoming for me
  const has = (inc || []).some((r) => r.fromId === fromId);
  if (!has) return;
  friendRequestsIncoming.set((inc || []).filter((r) => r.fromId !== fromId));
  // add to friends for both
  let myFriends; friends.subscribe((v) => (myFriends = v))();
  if (!(myFriends || []).includes(fromId)) friends.set([...(myFriends || []), fromId]);
  notify({ type: 'friend_accepted', title: 'Заявка в друзья принята', payload: { fromId } });
  const other = readUserLib(fromId);
  const otherFriends = Array.isArray(other.friends) ? other.friends : [];
  if (!otherFriends.includes(me.id)) otherFriends.push(me.id);
  // remove from outgoing for other
  const otherOut = Array.isArray(other.friendRequestsOutgoing) ? other.friendRequestsOutgoing.filter((r)=> r.toId !== me.id) : [];
  writeUserLib(fromId, { watched: other.watched||[], favorites: other.favorites||[], comments: other.comments||[], wishlist: other.wishlist||[], dropped: other.dropped||[], ratings: other.ratings||{}, notInterested: other.notInterested||[], friends: otherFriends, friendRequestsIncoming: other.friendRequestsIncoming||[], friendRequestsOutgoing: otherOut });
}

export function declineFriendRequest(fromId) {
  let me; currentUser.subscribe((v) => (me = v))();
  if (!me?.id || !fromId) return;
  let inc; friendRequestsIncoming.subscribe((v) => (inc = v))();
  friendRequestsIncoming.set((inc || []).filter((r) => r.fromId !== fromId));
  notify({ type: 'friend_declined', title: 'Заявка в друзья отклонена', payload: { fromId } });
  const other = readUserLib(fromId);
  const otherOut = Array.isArray(other.friendRequestsOutgoing) ? other.friendRequestsOutgoing.filter((r)=> r.toId !== me.id) : [];
  writeUserLib(fromId, { watched: other.watched||[], favorites: other.favorites||[], comments: other.comments||[], wishlist: other.wishlist||[], dropped: other.dropped||[], ratings: other.ratings||{}, notInterested: other.notInterested||[], friends: other.friends||[], friendRequestsIncoming: other.friendRequestsIncoming||[], friendRequestsOutgoing: otherOut });
}

export function removeFriend(userId) {
  let me; currentUser.subscribe((v) => (me = v))();
  if (!me?.id || !userId) return;
  let myFriends; friends.subscribe((v) => (myFriends = v))();
  friends.set((myFriends || []).filter((id) => id !== userId));
  notify({ type: 'friend_removed', title: 'Пользователь удалён из друзей', payload: { userId } });
  const other = readUserLib(userId);
  const otherFriends = Array.isArray(other.friends) ? other.friends.filter((id)=> id !== me.id) : [];
  writeUserLib(userId, { watched: other.watched||[], favorites: other.favorites||[], comments: other.comments||[], wishlist: other.wishlist||[], dropped: other.dropped||[], ratings: other.ratings||{}, notInterested: other.notInterested||[], friends: otherFriends, friendRequestsIncoming: other.friendRequestsIncoming||[], friendRequestsOutgoing: other.friendRequestsOutgoing||[] });
}

// --- Notifications helpers ---
export function notify(n) {
  const safe = { id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()), createdAt: Date.now(), ...n };
  let list; notifications.subscribe((v)=> (list = v))();
  notifications.set([safe, ...(list || [])].slice(0, 100));
}
export function clearNotifications() { notifications.set([]); }

export function refreshFriendState() {
  loadActiveUserLibrary();
}


