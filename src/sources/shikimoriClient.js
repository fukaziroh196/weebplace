/**
 * Minimal Shikimori API client.
 * Docs: https://shikimori.me/api/doc
 */

const BASE_URL = 'https://shikimori.one/api';

/**
 * Internal helper to perform HTTP requests to Shikimori API with proper headers.
 * Falls back between plugin-http (if available) and window.fetch.
 * @param {string} path
 * @param {Record<string, string | number | boolean | undefined>} [query]
 * @returns {Promise<any>}
 */
async function request(path, query) {
  const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });
  }

  // Minimal headers to avoid browser preflight and forbidden headers
  const baseHeaders = {
    'Accept': 'application/json'
  };

  // Try plugin HTTP fetch first to avoid potential CORS limitations
  try {
    const { fetch } = await import('@tauri-apps/plugin-http').catch(() => ({ fetch: null }));
    if (fetch) {
      // On plugin HTTP we can pass User-Agent safely
      const pluginHeaders = { ...baseHeaders, 'User-Agent': 'projgp/0.1.0 (tauri)' };
      const res = await fetch(url.toString(), { method: 'GET', headers: pluginHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }
  } catch (_) {
    // fall through to window.fetch
  }

  const res = await fetch(url.toString(), { method: 'GET', headers: baseHeaders });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Search anime list by query
 * @param {string} query
 * @param {number} [page]
 * @param {number} [limit]
 */
export async function searchAnimes(query, page = 1, limit = 20) {
  // Shikimori supports page/limit and search param
  const data = await request('/animes', { search: query, page, limit, order: 'popularity' });
  return Array.isArray(data) ? data : [];
}

/**
 * Get anime details by ID
 * @param {number|string} id
 */
export async function getAnimeDetails(id) {
  return request(`/animes/${id}`);
}

/**
 * Get related titles for an anime
 * @param {number|string} id
 */
export async function getRelatedTitles(id) {
  const data = await request(`/animes/${id}/related`);
  // expected shape: [{ relation, relation_russian, anime: {...} }]
  if (!Array.isArray(data)) return [];
  return data
    .map((entry) => {
      const a = entry?.anime;
      if (!a) return null;
      return {
        id: a.id,
        title: a.russian || a.name,
        relation: entry?.relation || entry?.relation_russian || '',
        image: a.image ? `https://shikimori.one${a.image.preview || a.image.original}` : null,
        score: a.score,
        kind: a.kind
      };
    })
    .filter(Boolean);
}
/**
 * Get currently airing (ongoing) anime list
 * @param {number} [limit]
 */
export async function getOngoings(limit = 5) {
  const data = await request('/animes', { status: 'ongoing', order: 'popularity', page: 1, limit });
  return Array.isArray(data) ? data : [];
}

/**
 * Get popular anime (all statuses) ordered by popularity
 * @param {number} [limit]
 */
export async function getPopular(limit = 20, page = 1) {
  const data = await request('/animes', { order: 'popularity', page, limit });
  return Array.isArray(data) ? data : [];
}

/**
 * Resolve current season slug for Shikimori (e.g., 'spring_2025')
 */
function getCurrentSeasonSlug() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1; // 1..12
  let s = 'winter';
  if (m >= 4 && m <= 6) s = 'spring';
  else if (m >= 7 && m <= 9) s = 'summer';
  else if (m >= 10 && m <= 12) s = 'fall';
  else s = 'winter'; // Jan-Mar
  return `${s}_${y}`;
}

/**
 * Get current seasonal anime list (this season only)
 * @param {number} [limit]
 */
export async function getSeasonal(limit = 10) {
  const season = getCurrentSeasonSlug();
  const data = await request('/animes', { season, order: 'ranked', page: 1, limit });
  return Array.isArray(data) ? data : [];
}

import { getJikanImageForMalId, getJikanImageForTitle } from './imageResolver';

/**
 * Seasonal with details for banner
 */
export async function getSeasonalWithDetails(limit = 5) {
  // oversample to compensate items without images/descriptions
  const list = await getSeasonal(limit * 5);
  const out = [];
  for (const a of list) {
    try {
      const d = await getAnimeDetails(a.id);
      const imgPath = d?.image?.original || d?.image?.preview || a?.image?.original || a?.image?.preview || null;
      // Always prefer Jikan image; fallback to Shikimori image if Jikan not found
      let imageUrl = null;
      const malId = d?.myanimelist_id || d?.mal_id || d?.idMal || null;
      if (malId) imageUrl = await getJikanImageForMalId(malId);
      if (!imageUrl) imageUrl = await getJikanImageForTitle(d?.name || d?.russian || a?.name || a?.russian || '');
      // Hard skip generic Shikimori placeholders like '/assets/globals/missing_original.jpg'
      if (!imageUrl && imgPath) imageUrl = `https://shikimori.one${imgPath}`;
      const descriptionClean =
        (d.description_html
          ? String(d.description_html)
              .replace(/<br\s*\/?>(\r?\n)?/gi, '\n')
              .replace(/<[^>]*>/g, '')
              .replace(/\[(?:\/)?[^\]]+\]/g, '')
              .replace(/&nbsp;/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
          : (String(d.description || '')
              .replace(/\[(?:\/)?[^\]]+\]/g, '')
              .replace(/&nbsp;/g, ' ')
              .trim()));
      let description = descriptionClean;
      // If description отсутствует — оставим пустым (тянем только картинки)
      if (!imageUrl || /\/assets\/globals\/missing_/i.test(String(imageUrl))) {
        // skip items without any real poster to avoid placeholder slides
        continue;
      }
      out.push({
        id: d.id,
        title: d.russian || d.name,
        originalTitle: d.name,
        description,
        score: d.score,
        image: imageUrl,
        url: `https://shikimori.one/animes/${d.id}`,
        __sourceId: 'shikimori'
      });
      await new Promise((r) => setTimeout(r, 300));
    } catch (_) {
      // skip entries without images to avoid placeholder banners
    }
    if (out.length >= limit) break;
  }
  // Return only with images (we already skip those without)
  return out.slice(0, limit);
}

/**
 * Fetch ongoing anime and enrich with details to include description and full image
 * @param {number} [limit]
 */
export async function getOngoingsWithDetails(limit = 5) {
  const list = await getOngoings(limit);
  const out = [];
  // Fetch details sequentially to avoid hitting API rate limits
  for (const a of list.slice(0, limit)) {
    try {
      const d = await getAnimeDetails(a.id);
      out.push({
        id: d.id,
        title: d.russian || d.name,
        originalTitle: d.name,
        // Prefer HTML description, strip tags for banner text
        description:
          (d.description_html
            ? String(d.description_html)
                .replace(/<br\s*\/?>(\r?\n)?/gi, '\n')
                .replace(/<[^>]*>/g, '')
                .replace(/\[(?:\/)?[^\]]+\]/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
            : (String(d.description || '')
                .replace(/\[(?:\/)?[^\]]+\]/g, '')
                .replace(/&nbsp;/g, ' ')
                .trim())),
        score: d.score,
        image: d.image ? `https://shikimori.one${d.image.original}` : null,
        url: `https://shikimori.one/animes/${d.id}`,
        __sourceId: 'shikimori'
      });
      // kindly wait ~300ms between requests
      await new Promise((r) => setTimeout(r, 300));
    } catch (_) {
      // Fallback to minimal info from list
      out.push({
        id: a.id,
        title: a.russian || a.name,
        originalTitle: a.name,
        description: '',
        score: a.score,
        image: a.image ? `https://shikimori.one${a.image.original || a.image.preview}` : null,
        url: `https://shikimori.one/animes/${a.id}`,
        __sourceId: 'shikimori'
      });
    }
  }
  return out;
}

/**
 * Utility: map Shikimori anime to internal lightweight item
 * @param {any} a
 */
export function mapAnimeToItem(a) {
  // Normalize kind/status/rating to our filter keys
  const kindRaw = String(a.kind || '').toLowerCase();
  const kind = kindRaw === 'tv_special' ? 'special' : kindRaw || 'tv';
  const status = String(a.status || 'released').toLowerCase();
  const ratingRaw = String(a.rating || '').toLowerCase();
  let rating = ratingRaw.replace('_', '');
  if (rating === 'rplus') rating = 'r17';
  const genres = Array.isArray(a?.genres) ? a.genres.map((g) => g?.russian || g?.name).filter(Boolean) : [];
  return {
    id: a.id,
    title: a.russian || a.name,
    originalTitle: a.name,
    kind,
    score: a.score,
    year: (a.aired_on || a.released_on) ? String(a.aired_on || a.released_on).slice(0, 4) : undefined,
    startDate: a.aired_on || a.released_on || null,
    episodes: a.episodes,
    episodesAired: a.episodes_aired,
    status,
    rating,
    genres,
    image: a.image ? `https://shikimori.one${a.image.original}` : null,
    url: `https://shikimori.one/animes/${a.id}`
  };
}

export default { searchAnimes, getAnimeDetails, getOngoings, getOngoingsWithDetails, getRelatedTitles, mapAnimeToItem, getPopular, getSeasonal, getSeasonalWithDetails };


