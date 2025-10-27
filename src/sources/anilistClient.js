/**
 * AniList GraphQL client for trending/popular anime.
 */

const GRAPHQL_URL = 'https://graphql.anilist.co';

async function httpPost(url, body) {
  const payload = JSON.stringify(body);
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: payload
  });
}

/**
 * Fetch trending/popular anime combined sort from AniList.
 * @param {number} limit
 */
export async function getTrendingPopular(limit = 20) {
  const query = `
    query ($perPage: Int) {
      Page(perPage: $perPage) {
        media(type: ANIME, sort: [TRENDING_DESC, POPULARITY_DESC]) {
          id
          title { romaji english native }
          season
          seasonYear
          coverImage { extraLarge large medium }
          averageScore
          popularity
          trending
          siteUrl
        }
      }
    }
  `;
  const res = await httpPost(GRAPHQL_URL, { query, variables: { perPage: limit } });
  if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
  const json = await res.json();
  const list = json?.data?.Page?.media || [];
  return list.map((m, idx) => ({
    id: `anilist-${m.id}`,
    title: m?.title?.native || m?.title?.romaji || m?.title?.english || 'Untitled',
    altTitles: [m?.title?.romaji, m?.title?.english, m?.title?.native].filter(Boolean),
    image: m?.coverImage?.extraLarge || m?.coverImage?.large || m?.coverImage?.medium || null,
    season: m?.season,
    seasonYear: m?.seasonYear,
    score: m?.averageScore,
    popularity: m?.popularity,
    trending: m?.trending,
    rank: idx + 1,
    url: m?.siteUrl || (m?.id ? `https://anilist.co/anime/${m.id}` : undefined),
    __sourceId: 'anilist'
  }));
}

export default { getTrendingPopular };










