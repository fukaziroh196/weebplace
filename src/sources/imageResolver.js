import { getAnimeByMalId, getAnimeImageByMalId, searchAnimeByTitle } from './jikanClient';

const malIdToImage = new Map();
const titleToImage = new Map();

/**
 * Get Jikan poster for MAL id, with in-memory cache.
 * @param {number|string} malId
 * @returns {Promise<string|null>}
 */
export async function getJikanImageForMalId(malId) {
  if (!malId) return null;
  const key = String(malId);
  if (malIdToImage.has(key)) return malIdToImage.get(key) || null;
  try {
    // Try dedicated pictures endpoint first
    let url = await getAnimeImageByMalId(malId);
    if (!url) {
      const a = await getAnimeByMalId(malId);
      url = a?.image || null;
    }
    malIdToImage.set(key, url);
    return url;
  } catch (_) {
    malIdToImage.set(key, null);
    return null;
  }
}

/**
 * Get Jikan poster for given title, with in-memory cache.
 * @param {string} title
 * @returns {Promise<string|null>}
 */
export async function getJikanImageForTitle(title) {
  const t = (title || '').trim();
  if (!t) return null;
  const key = t.toLowerCase();
  if (titleToImage.has(key)) return titleToImage.get(key) || null;
  try {
    const a = await searchAnimeByTitle(t);
    const url = a?.image || null;
    titleToImage.set(key, url);
    return url;
  } catch (_) {
    titleToImage.set(key, null);
    return null;
  }
}

/**
 * Replace image of an item with Jikan image if available.
 * @param {{id:any,title:string,image?:string|null, malId?:number|string}} item
 */
export async function overrideImageWithJikan(item) {
  if (!item) return item;
  // Prefer MAL id if provided
  let url = null;
  if (item.malId) url = await getJikanImageForMalId(item.malId);
  if (!url) url = await getJikanImageForTitle(item.title);
  return { ...item, image: url || item.image || null };
}

export default { getJikanImageForMalId, getJikanImageForTitle, overrideImageWithJikan };


