import { writable } from 'svelte/store';
import { sourceRegistry, registerUserSource } from '../sources';

export const enabledSourceIds = writable(['shikimori', 'anilibria']);
export const isSearching = writable(false);
export const searchResults = writable([]);
export const suggestions = writable([]);
export const adminImages = writable({}); // map anime id -> custom image url
export const searchHistory = writable([]); // recent queries
export const userSources = writable([]); // list of user source specs
export const playbackSourceId = writable(null); // id источника, используемого ТОЛЬКО для плеера

// persist admin overrides
try {
  const raw = localStorage.getItem('admin:images');
  if (raw) adminImages.set(JSON.parse(raw));
} catch (_) {}

adminImages.subscribe((map) => {
  try { localStorage.setItem('admin:images', JSON.stringify(map || {})); } catch (_) {}
});

// Persist search history
try {
  const raw = localStorage.getItem('search:history');
  if (raw) searchHistory.set(JSON.parse(raw));
} catch (_) {}

searchHistory.subscribe((list) => {
  try { localStorage.setItem('search:history', JSON.stringify(list || [])); } catch (_) {}
});

// Persist user sources
try {
  const raw = localStorage.getItem('sources:user');
  if (raw) userSources.set(JSON.parse(raw));
} catch (_) {}

userSources.subscribe((list) => {
  try { localStorage.setItem('sources:user', JSON.stringify(list || [])); } catch (_) {}
});

// Load persisted playback source id
try {
  const raw = localStorage.getItem('sources:playback');
  if (raw) playbackSourceId.set(raw);
} catch (_) {}

playbackSourceId.subscribe((id) => {
  try { if (id) localStorage.setItem('sources:playback', id); else localStorage.removeItem('sources:playback'); } catch (_) {}
});

export function addUserSource(spec) {
  registerUserSource(spec);
  let list; userSources.subscribe((v) => (list = v))();
  const next = [...(list || []).filter((s) => s.id !== spec.id), spec];
  userSources.set(next);
  // не включаем в поиск по умолчанию — пользователь решит сам чекбоксом
}

// Import source from a .json file content
export function importUserSourceFromJson(jsonText) {
  const spec = JSON.parse(jsonText);
  if (!spec?.id || !spec?.name) throw new Error('Некорректный источник');
  addUserSource(spec);
}

export function setPlaybackSource(id) {
  playbackSourceId.set(id || null);
}

export async function searchAllSources(query) {
  const ids = await new Promise((resolve) => {
    let current;
    const unsub = enabledSourceIds.subscribe((v) => (current = v));
    unsub();
    resolve(current);
  });

  isSearching.set(true);
  try {
    const items = await sourceRegistry.search(query, ids);
    let custom; adminImages.subscribe((v) => (custom = v))();
    const mapped = items.map((it) => (custom && custom[it.id] ? { ...it, image: custom[it.id] } : it));
    searchResults.set(mapped);
    // update history
    try {
      const q = (query || '').trim();
      if (q) {
        let list; searchHistory.subscribe((v) => (list = v))();
        const next = [q, ...(list || []).filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 10);
        searchHistory.set(next);
      }
    } catch(_) {}
  } catch (e) {
    console.error('Search error', e);
    searchResults.set([]);
  } finally {
    isSearching.set(false);
  }
}

export async function fetchSuggestions(partial) {
  if (!partial || !partial.trim()) {
    suggestions.set([]);
    return;
  }
  const ids = await new Promise((resolve) => {
    let current;
    const unsub = enabledSourceIds.subscribe((v) => (current = v));
    unsub();
    resolve(current);
  });
  try {
    const items = await sourceRegistry.search(partial.trim(), ids, { limit: 5 });
    let custom; adminImages.subscribe((v) => (custom = v))();
    const mapped = items.map((it) => (custom && custom[it.id] ? { ...it, image: custom[it.id] } : it));
    suggestions.set(mapped.slice(0, 5));
  } catch (e) {
    console.error('Suggest error', e);
    suggestions.set([]);
  }
}


