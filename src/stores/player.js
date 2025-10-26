import { writable } from 'svelte/store';
import { sourceRegistry } from '../sources';
import { enabledSourceIds, playbackSourceId } from './sources';

export const isPlayerOpen = writable(false);
export const currentItem = writable(null); // { id, title, __sourceId }
export const currentStreams = writable([]); // [{url, type, quality}]
export const isLoadingStreams = writable(false);
// Variants by dub/voice (AniLibria, DreamCast, etc.)
export const currentVariants = writable([]); // [{ dub: 'AniLibria', streams: [...] }]
export const selectedVariant = writable(0);

async function tryGetStreamsFromSource(sourceId, id, opts) {
  try {
    const src = sourceRegistry.get(sourceId);
    if (!src?.getStreams) return [];
    const arr = (await src.getStreams(id, opts)) || [];
    // annotate with dub/source for grouping
    const dubName = src?.info?.name || src?.info?.id || sourceId;
    return arr.map((s) => ({ dub: s.dub || dubName, __sourceId: sourceId, ...s }));
  } catch (_) {
    return [];
  }
}

function normalizeTitle(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

async function searchAcrossSources(query, excludeSourceId) {
  try {
    let ids; enabledSourceIds.subscribe((v) => (ids = v))();
    const scoped = (ids || []).filter((id) => id !== excludeSourceId);
    if (!scoped.length) return [];
    const results = await sourceRegistry.search(query, scoped, { limit: 5 });
    return Array.isArray(results) ? results : [];
  } catch (_) {
    return [];
  }
}

export async function openPlayerForItem(item, opts) {
  currentItem.set(item);
  isPlayerOpen.set(true);
  isLoadingStreams.set(true);
  try {
    // Если задан принудительный источник для плеера — используем его
    let forced; playbackSourceId.subscribe((v)=> (forced = v))();
    let streams = [];
    if (forced) {
      // Жёстко используем только форсированный источник
      try {
        // 1) попробовать по текущему id
        streams = await tryGetStreamsFromSource(forced, item.id, opts);
        // 2) если пусто и id другой системы — попробуем найти по названию
        if (!streams || streams.length === 0) {
          const title = item.title || item.russian || item.name || '';
          const q = normalizeTitle(title);
          const results = await sourceRegistry.search(title, [forced], { limit: 5 });
          const best = results.find((r) => normalizeTitle(r.title).includes(q)) || results[0];
          if (best) {
            streams = await tryGetStreamsFromSource(forced, best.id, opts);
            if (streams?.length) {
              currentItem.set({ ...item, __sourceId: forced, id: best.id, title: best.title || item.title });
            }
          }
        }
      } catch (_) { streams = []; }
      // Не откатываемся на оригинальный источник, если форс выбран
    } else {
      // 1) затем пробуем оригинальный источник
      if (!streams || streams.length === 0) {
        streams = await tryGetStreamsFromSource(item.__sourceId, item.id, opts);
      }
      // 2) fallback: search other enabled sources by title
      if (!streams || streams.length === 0) {
        const title = item.title || item.russian || item.name || '';
        const q = normalizeTitle(title);
        const results = await searchAcrossSources(q, item.__sourceId);
        // naive pick: first with high overlap
        const best = results.find((r) => normalizeTitle(r.title).includes(q)) || results[0];
        if (best) {
          streams = await tryGetStreamsFromSource(best.__sourceId || best.sourceId || best.source || best.__source || best.source_id || '', best.id, opts);
          if (streams && streams.length) {
            currentItem.set({ ...item, __sourceId: best.__sourceId || item.__sourceId, id: best.id });
          }
        }
      }
    }
    // try to find additional dubs by scanning other sources in background
    const title = item.title || item.russian || item.name || '';
    const normalized = normalizeTitle(title);
    let ids; enabledSourceIds.subscribe((v) => (ids = v))();
    const scanSources = (ids || []).filter((sid) => sid !== (forced || item.__sourceId));
    const variantsMap = new Map();
    const pushStreams = (arr = []) => {
      for (const s of arr) {
        const key = String(s.dub || s.__sourceId || 'Unknown');
        if (!variantsMap.has(key)) variantsMap.set(key, []);
        variantsMap.get(key).push(s);
      }
    };
    pushStreams(streams);
    try {
      const results = await sourceRegistry.search(title, scanSources, { limit: 4 });
      // best-effort: take first matching per source
      for (const r of results) {
        try {
          const sid = r.__sourceId || r.sourceId || r.source || r.source_id || '';
          if (!sid) continue;
          const s = await tryGetStreamsFromSource(sid, r.id, opts);
          pushStreams(s);
        } catch (_) {}
      }
    } catch (_) {}
    const variants = Array.from(variantsMap.entries()).map(([dub, list]) => ({ dub, streams: list }));
    // sort: keep original source dub first
    variants.sort((a, b) => (a.dub === (sourceRegistry.get(item.__sourceId)?.info?.name || item.__sourceId) ? -1 : 0));
    currentVariants.set(variants);
    selectedVariant.set(0);
    currentStreams.set((variants[0]?.streams) || streams || []);
  } catch (e) {
    console.error('Failed to load streams', e);
    currentStreams.set([]);
    currentVariants.set([]);
  } finally {
    isLoadingStreams.set(false);
  }
}

export function closePlayer() {
  isPlayerOpen.set(false);
  currentItem.set(null);
  currentStreams.set([]);
}








