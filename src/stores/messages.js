import { writable, derived } from 'svelte/store';
import { currentUser, users } from './auth';

// All direct messages stored locally. This is a simple local-only MVP.
// Message: { id, fromId, toId, text, createdAt, readBy: string[] }
export const allMessages = writable([]);

function load() {
  try {
    const raw = localStorage.getItem('messages:all');
    const list = raw ? JSON.parse(raw) : [];
    allMessages.set(Array.isArray(list) ? list : []);
  } catch (_) {
    allMessages.set([]);
  }
}

function persist() {
  let list; allMessages.subscribe((v) => (list = v))();
  try { localStorage.setItem('messages:all', JSON.stringify(list || [])); } catch (_) {}
}

load();
allMessages.subscribe(() => persist());

function randomId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getConversationId(a, b) {
  const aStr = String(a || '');
  const bStr = String(b || '');
  return aStr < bStr ? `${aStr}_${bStr}` : `${bStr}_${aStr}`;
}

export function sendMessage(toUserId, text) {
  if (!toUserId || !text) return null;
  let me; currentUser.subscribe((v) => (me = v))();
  if (!me?.id) throw new Error('Сначала войдите в аккаунт');
  const msg = { id: randomId(), fromId: me.id, toId: String(toUserId), text: String(text).trim(), createdAt: Date.now(), readBy: [me.id] };
  let list; allMessages.subscribe((v) => (list = v))();
  allMessages.set([...(list || []), msg]);
  return msg;
}

export function markConversationRead(withUserId) {
  let me; currentUser.subscribe((v) => (me = v))();
  if (!me?.id || !withUserId) return;
  let list; allMessages.subscribe((v) => (list = v))();
  const next = (list || []).map((m) => {
    if (m.toId === me.id && m.fromId === withUserId && !m.readBy?.includes(me.id)) {
      return { ...m, readBy: [...(m.readBy || []), me.id] };
    }
    return m;
  });
  allMessages.set(next);
}

export const unreadTotal = derived([allMessages, currentUser], ([$all, $me]) => {
  if (!$me?.id) return 0;
  return ($all || []).filter((m) => m.toId === $me.id && !(m.readBy || []).includes($me.id)).length;
});

export const conversations = derived([allMessages, currentUser, users], ([$all, $me, $users]) => {
  if (!$me?.id) return [];
  const map = new Map();
  for (const m of ($all || [])) {
    if (m.fromId !== $me.id && m.toId !== $me.id) continue;
    const otherId = m.fromId === $me.id ? m.toId : m.fromId;
    const list = map.get(otherId) || [];
    list.push(m);
    map.set(otherId, list);
  }
  const out = [];
  for (const [otherId, msgs] of map.entries()) {
    msgs.sort((a, b) => a.createdAt - b.createdAt);
    const last = msgs[msgs.length - 1];
    const unread = msgs.filter((m) => m.toId === $me.id && !(m.readBy || []).includes($me.id)).length;
    const user = ($users || []).find((u) => u.id === otherId) || { id: otherId, username: 'user' };
    out.push({ userId: otherId, username: user.username, lastMessage: last, unread });
  }
  out.sort((a, b) => (b.lastMessage?.createdAt || 0) - (a.lastMessage?.createdAt || 0));
  return out;
});

export default { allMessages, sendMessage, markConversationRead, unreadTotal, conversations };



