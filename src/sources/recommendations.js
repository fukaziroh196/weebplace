import { getPopular } from './shikimoriClient';
import { getTopAiring, getSeasonNow } from './jikanClient';
import { ensureMeta, getCachedMeta, warmCacheForTitles } from './metaCache';
import { watched, ratings, notInterested } from '../stores/auth';

/**
 * Merge lists from AniList and Shikimori into a unified recommendation feed.
 * Simple dedupe by lowercased title and seasonYear, then score by weighted sum.
 */

/**
 * @typedef {Object} RecItem
 * @property {string|number} id
 * @property {string} title
 * @property {string|null|undefined} image
 * @property {string|undefined} url
 * @property {number|undefined} score
 * @property {number|undefined} popularity
 * @property {number|undefined} trending
 * @property {string} __sourceId
 */

function normalizeFromShikimori(list) {
  return list.map((a, idx) => ({
    id: `shiki-${a.id}`,
    title: a.russian || a.name,
    image: a.image ? `https://shikimori.one${a.image.original || a.image.preview}` : null,
    url: `https://shikimori.one/animes/${a.id}`,
    score: a.score,
    popularity: (list.length - idx) * 1000, // rough ordinal signal
    trending: undefined,
    year: (a.aired_on || a.released_on) ? String(a.aired_on || a.released_on).slice(0, 4) : undefined,
    startDate: a.aired_on || a.released_on || null,
    kind: String(a.kind || '').toLowerCase(),
    rating: String(a.rating || '').toLowerCase(),
    episodes: a.episodes || undefined,
    episodesAired: a.episodes_aired || undefined,
    genres: Array.isArray(a.genres) ? a.genres.map((g)=> g?.russian || g?.name).filter(Boolean) : [],
    __sourceId: 'shikimori'
  }));
}

function makeKey(title, seasonYear) {
  return `${String(title || '').toLowerCase()}::${seasonYear || ''}`;
}

/**
 * @param {number} limit
 * @returns {Promise<RecItem[]>}
 */
export async function getRecommendedNow(limit = 20) {
  const [jikanAiring, jikanSeason, shikiRaw] = await Promise.all([
    getTopAiring(limit).catch(() => []),
    getSeasonNow(limit).catch(() => []),
    getPopular(limit).catch(() => [])
  ]);
  const shiki = normalizeFromShikimori(shikiRaw);

  /** @type {Map<string, RecItem & { weight:number }>} */
  const keyToItem = new Map();

  const add = (item, weight) => {
    const key = makeKey(item.title, item.seasonYear);
    const existing = keyToItem.get(key);
    if (!existing) {
      keyToItem.set(key, { ...item, weight });
    } else {
      keyToItem.set(key, {
        ...existing,
        score: Math.max(existing.score ?? 0, item.score ?? 0),
        popularity: Math.max(existing.popularity ?? 0, item.popularity ?? 0),
        trending: Math.max(existing.trending ?? 0, item.trending ?? 0),
        weight: existing.weight + weight,
        image: existing.image || item.image,
        url: existing.url || item.url
      });
    }
  };

  jikanAiring.forEach((it) => add(it, 0.5));
  jikanSeason.forEach((it) => add(it, 0.3));
  shiki.forEach((it) => add(it, 0.2));

  const combined = [...keyToItem.values()].map((it) => ({
    id: it.id,
    title: it.title,
    image: it.image,
    url: it.url,
    score: it.score,
    popularity: it.popularity,
    trending: it.trending,
    year: it.year || it.seasonYear,
    startDate: it.startDate,
    kind: it.kind,
    rating: it.rating,
    episodes: it.episodes,
    episodesAired: it.episodesAired,
    genres: it.genres,
    __sourceId: 'recommendation'
  }));

  combined.sort((a, b) => (b.trending ?? 0) - (a.trending ?? 0) || (b.popularity ?? 0) - (a.popularity ?? 0));
  return combined.slice(0, limit);
}

/**
 * Personalized recommendations after the user watched 1-2 titles.
 * Heuristic: collect genres from watched items via Jikan (fast) when possible
 * and filter/sort the combined feed by genre overlap + global popularity.
 * In MVP we only re-rank by title keywords due to missing persistent genre map.
 * @param {number} limit
 */
export async function getPersonalizedRecommendations(limit = 20) {
  const base = await getRecommendedNow(80).catch(() => []);
  let w; watched.subscribe((v) => (w = v))();
  let r; ratings.subscribe((v) => (r = v))();
  if (!Array.isArray(w) || w.length === 0) return base.slice(0, limit);

  // Build weighted profile from watched titles + genres/themes/studios
  const now = Date.now();
  /** @type {Map<string, number>} */
  const tokenWeight = new Map();
  /** @type {Map<string, number>} */
  const genreWeight = new Map();
  /** @type {Map<string, number>} */
  const studioWeight = new Map();

  for (const x of w.slice(0, 30)) {
    const title = String(x.title || '').toLowerCase();
    const tokens = title.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3);
    const recencyDays = Math.max(1, (now - (x.watchedAt || now)) / (1000 * 60 * 60 * 24));
    const recencyBoost = Math.min(2, 1.5 / Math.log10(recencyDays + 3));
    const userRating = Number(r?.[x.id] || 0);
    const ratingBoost = userRating ? (userRating / 10) * 1.6 : 1;
    const weight = 1 * recencyBoost * ratingBoost;
    tokens.forEach((t) => tokenWeight.set(t, (tokenWeight.get(t) || 0) + weight));

    const meta = await ensureMeta(x.title);
    const genres = [...(meta?.genres || []), ...(meta?.themes || [])];
    const studios = meta?.studios || [];
    genres.forEach((g) => genreWeight.set(g, (genreWeight.get(g) || 0) + weight));
    studios.forEach((s) => studioWeight.set(s, (studioWeight.get(s) || 0) + weight * 0.8));
    await new Promise((r2) => setTimeout(r2, 100));
  }

  const scored = base.map((it) => {
    const tks = String(it.title || '').toLowerCase().split(/[^\p{L}\p{N}]+/u);
    const overlapScore = tks.reduce((acc, t) => acc + (tokenWeight.get(t) || 0), 0);
    const cached = getCachedMeta(it.title) || null;
    const genres = [...(cached?.genres || []), ...(cached?.themes || [])];
    const studios = cached?.studios || [];
    const genreScore = genres.reduce((acc, g) => acc + (genreWeight.get(g) || 0), 0);
    const studioScore = studios.reduce((acc, s) => acc + (studioWeight.get(s) || 0), 0);
    const popularity = it.popularity || 0;
    const trending = it.trending || 0;
    const score = overlapScore * 8 + genreScore * 6 + studioScore * 4 + trending * 0.01 + popularity * 0.0005;
    return { ...it, _score: score };
  });

  scored.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
  // Filter out items user marked as not interested
  let ni; notInterested.subscribe((v) => (ni = v))();
  const niSet = new Set((ni || []).map((x) => x.id));
  const ordered = scored
    .map(({ _score, ...rest }) => rest)
    .filter((it) => !niSet.has(it.id));
  return ordered.slice(0, limit);
}

function seededRandom(seed) {
  let t = seed + 0x6d2b79f5;
  return function () {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed(arr, seed) {
  const rand = seededRandom(seed);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * High-level feed: if пользователь уже смотрел >=2 тайтлов — персонализируем,
 * иначе отдаём общий популярный фид. Всегда перемешиваем с seed, чтобы «рулетка»
 * менялась при каждом запуске/обновлении страницы.
 */
export async function getRecommendedFeed(limit = 20) {
  let w; watched.subscribe((v) => (w = v))();
  const watchedCount = Array.isArray(w) ? w.length : 0;
  const usePersonal = watchedCount >= 2;
  const base = usePersonal
    ? await getPersonalizedRecommendations(Math.max(30, limit)).catch(() => [])
    : await getRecommendedNow(Math.max(30, limit)).catch(() => []);
  // Warm meta cache in the background for candidate titles (genre/studio)
  warmCacheForTitles(base.map((x) => x.title));
  // Seed by current time to refresh each app start/page reload
  const seed = Date.now() & 0xffffffff;
  const shuffled = shuffleWithSeed(base, seed);
  return shuffled.slice(0, limit);
}

export default { getRecommendedNow, getPersonalizedRecommendations, getRecommendedFeed };


