import { searchAnimeByTitle } from './jikanClient';

const STORAGE_KEY = 'rec:metaCache:v1';
const TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

/** @type {Map<string, any>} */
const memory = new Map();

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && typeof data === 'object') {
      Object.entries(data).forEach(([k, v]) => memory.set(k, v));
    }
  } catch (_) {}
}

function saveToStorage() {
  try {
    const obj = {};
    memory.forEach((v, k) => (obj[k] = v));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (_) {}
}

loadFromStorage();

function keyOf(title) {
  return String(title || '').trim().toLowerCase();
}

export function getCachedMeta(title) {
  const k = keyOf(title);
  const v = memory.get(k) || null;
  return v;
}

export function setCachedMeta(title, meta) {
  const k = keyOf(title);
  memory.set(k, meta);
  saveToStorage();
}

/**
 * Ensure meta for title exists in cache (genres/themes/studios). Returns cached or fetched.
 */
export async function ensureMeta(title) {
  const k = keyOf(title);
  const cached = memory.get(k);
  if (cached && cached.ts && Date.now() - cached.ts < TTL_MS) return cached;
  try {
    const res = await searchAnimeByTitle(title);
    const meta = {
      genres: res?.genres || [],
      themes: res?.themes || [],
      studios: res?.studios || [],
      ts: Date.now()
    };
    setCachedMeta(title, meta);
    return meta;
  } catch (_) {
    return null;
  }
}

/**
 * Warm cache for a set of titles in the background with gentle pacing.
 * @param {string[]} titles
 */
export function warmCacheForTitles(titles) {
  if (!Array.isArray(titles) || titles.length === 0) return;
  const unique = Array.from(new Set(titles.map((t) => keyOf(t))));
  let i = 0;
  const tick = async () => {
    if (i >= unique.length) return;
    const tKey = unique[i++];
    const existing = memory.get(tKey);
    if (!existing || !existing.ts || Date.now() - existing.ts >= TTL_MS) {
      const title = tKey; // already lowercased
      try { await ensureMeta(title); } catch (_) {}
    }
    setTimeout(tick, 150);
  };
  setTimeout(tick, 0);
}

export function isExpired(meta) {
  return !meta?.ts || Date.now() - meta.ts >= TTL_MS;
}

export default { getCachedMeta, setCachedMeta, ensureMeta };


