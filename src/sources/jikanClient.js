/**
 * Jikan v4 client (MyAnimeList mirror) for popular/seasonal feeds.
 * Docs: https://docs.api.jikan.moe/
 */

const BASE = 'https://api.jikan.moe/v4';

async function httpGet(path) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  return fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
}

/**
 * Map Jikan anime to lightweight item
 */
export function mapJikanToItem(a) {
  const image = a?.images?.webp?.large_image_url || a?.images?.jpg?.large_image_url || a?.images?.webp?.image_url || a?.images?.jpg?.image_url || null;
  const year = a?.year || (a?.aired?.from ? String(a.aired.from).slice(0, 4) : undefined);
  const kind = String(a?.type || '').toLowerCase();
  const statusRaw = String(a?.status || '').toLowerCase();
  const status = statusRaw.includes('currently') ? 'ongoing' : (statusRaw.includes('finished') ? 'released' : (statusRaw.includes('not yet') ? 'anons' : 'released'));
  const rating = String(a?.rating || '').toLowerCase();
  const genres = Array.isArray(a?.genres) ? a.genres.map((g)=>g?.name).filter(Boolean) : [];
  return {
    id: a?.mal_id,
    title: a?.title || a?.title_english || a?.title_japanese,
    image,
    score: a?.score,
    popularity: a?.members, // number of members as popularity proxy
    seasonYear: year,
    url: a?.url,
    startDate: a?.aired?.from || null,
    kind,
    status,
    rating,
    genres,
    __sourceId: 'jikan'
  };
}

/**
 * Top airing anime (current on-air)
 */
export async function getTopAiring(limit = 20) {
  const res = await httpGet(`/top/anime?filter=airing&limit=${limit}`);
  if (!res.ok) throw new Error(`Jikan HTTP ${res.status}`);
  const json = await res.json();
  const list = Array.isArray(json?.data) ? json.data : [];
  return list.map(mapJikanToItem);
}

/**
 * Top popular anime (by members)
 */
export async function getTopPopular(limit = 20) {
  const res = await httpGet(`/top/anime?filter=bypopularity&limit=${limit}`);
  if (!res.ok) throw new Error(`Jikan HTTP ${res.status}`);
  const json = await res.json();
  const list = Array.isArray(json?.data) ? json.data : [];
  return list.map(mapJikanToItem);
}

/**
 * Current season anime
 */
export async function getSeasonNow(limit = 20) {
  const res = await httpGet(`/seasons/now?limit=${limit}`);
  if (!res.ok) throw new Error(`Jikan HTTP ${res.status}`);
  const json = await res.json();
  const list = Array.isArray(json?.data) ? json.data : [];
  return list.map(mapJikanToItem);
}

/**
 * Fetch anime by MAL id (basic info)
 */
export async function getAnimeByMalId(malId) {
  if (!malId) return null;
  const res = await httpGet(`/anime/${malId}`);
  if (!res.ok) return null;
  const json = await res.json();
  const a = json?.data;
  if (!a) return null;
  return {
    id: a.mal_id,
    title: a.title || a.title_english || a.title_japanese,
    image:
      a?.images?.webp?.large_image_url ||
      a?.images?.jpg?.large_image_url ||
      a?.images?.webp?.image_url ||
      a?.images?.jpg?.image_url ||
      null,
    synopsis: a?.synopsis || '',
    genres: Array.isArray(a?.genres) ? a.genres.map((g) => g?.name).filter(Boolean) : [],
    themes: Array.isArray(a?.themes) ? a.themes.map((g) => g?.name).filter(Boolean) : [],
    studios: Array.isArray(a?.studios) ? a.studios.map((s) => s?.name).filter(Boolean) : []
  };
}

/**
 * Fetch first picture from /pictures endpoint for MAL id
 */
export async function getAnimeImageByMalId(malId) {
  if (!malId) return null;
  const res = await httpGet(`/anime/${malId}/pictures`);
  if (!res.ok) return null;
  const json = await res.json();
  const arr = Array.isArray(json?.data) ? json.data : [];
  const pic = arr[0] || null;
  const url = pic?.jpg?.large_image_url || pic?.jpg?.image_url || pic?.webp?.large_image_url || pic?.webp?.image_url || null;
  return url || null;
}

/**
 * Search anime by title (first result)
 */
export async function searchAnimeByTitle(title) {
  const q = encodeURIComponent(title || '');
  if (!q) return null;
  const res = await httpGet(`/anime?q=${q}&limit=1`);
  if (!res.ok) return null;
  const json = await res.json();
  const a = Array.isArray(json?.data) ? json.data[0] : null;
  if (!a) return null;
  return {
    id: a.mal_id,
    title: a.title || a.title_english || a.title_japanese,
    image:
      a?.images?.webp?.large_image_url ||
      a?.images?.jpg?.large_image_url ||
      a?.images?.webp?.image_url ||
      a?.images?.jpg?.image_url ||
      null,
    synopsis: a?.synopsis || '',
    genres: Array.isArray(a?.genres) ? a.genres.map((g) => g?.name).filter(Boolean) : [],
    themes: Array.isArray(a?.themes) ? a.themes.map((g) => g?.name).filter(Boolean) : [],
    studios: Array.isArray(a?.studios) ? a.studios.map((s) => s?.name).filter(Boolean) : []
  };
}

export default { getTopAiring, getSeasonNow, mapJikanToItem };


