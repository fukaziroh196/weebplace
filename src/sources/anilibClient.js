/**
 * Minimal AniLib/AniLibria client focused on a "now watching"/popular feed.
 * We try several endpoints/domains to be resilient. If all fail, returns [].
 */

/**
 * Perform GET with tauri plugin-http if available, else window.fetch.
 * @param {string} url
 * @returns {Promise<Response>}
 */
async function httpGet(url) {
  try {
    const { fetch } = await import('@tauri-apps/plugin-http').catch(() => ({ fetch: null }));
    if (fetch) {
      return fetch(url, { method: 'GET', headers: { 'Accept': 'application/json, text/html;q=0.9' } });
    }
  } catch (_) {
    // fallthrough to window.fetch
  }
  return fetch(url, { method: 'GET', headers: { 'Accept': 'application/json, text/html;q=0.9' } });
}

/**
 * Try Anilibria v3 candidates for popular/now endpoints.
 * Returns normalized items with id,title,image,url when possible.
 * @param {number} limit
 */
async function tryAnilibriaApi(limit) {
  const endpoints = [
    // Common community mirrors of possible popular endpoints
    `https://api.anilibria.tv/v3/title/top?limit=${limit}&filter=id,code,names,posters`,
    `https://api.anilibria.tv/v3/title/updates?limit=${limit}&filter=id,code,names,posters`
  ];
  for (const url of endpoints) {
    try {
      const res = await httpGet(url);
      if (!res.ok) continue;
      const data = await res.json();
      const list = Array.isArray(data?.list) ? data.list : Array.isArray(data) ? data : [];
      if (!list.length) continue;
      return list.map((it) => ({
        id: it.id ?? it.code ?? String(it.id ?? it.code ?? ''),
        title: it.names?.ru || it.names?.ru_short || it.names?.en || it.names?.alternative || 'Без названия',
        image: it.posters?.original?.url || it.posters?.medium?.url || it.posters?.small?.url || null,
        url: it.code ? `https://www.anilibria.tv/release/${it.code}.html` : undefined,
        __sourceId: 'anilib'
      }));
    } catch (_) {
      // try next
    }
  }
  return [];
}

/**
 * Fallback: try to parse AniLib home HTML for a JSON blob (Nuxt/Next state).
 * Very best-effort: returns [] on failure.
 * @param {number} limit
 */
async function tryAnilibHtml(limit) {
  const homes = [
    'https://anilib.co/',
    'https://anilib.me/',
    'https://anilib.one/'
  ];
  for (const url of homes) {
    try {
      const res = await httpGet(url);
      if (!res.ok) continue;
      const html = await res.text();
      // Look for a big JSON blob like window.__NUXT__ or __NEXT_DATA__
      const nuxtMatch = html.match(/__NUXT__\s*=\s*(\{[\s\S]*?\});/);
      const nextMatch = html.match(/__NEXT_DATA__\s*=\s*(\{[\s\S]*?\});/);
      const raw = nuxtMatch?.[1] || nextMatch?.[1];
      if (!raw) continue;
      const state = JSON.parse(raw);
      // Heuristics: find arrays of objects with title/poster/link by scanning
      const candidates = [];
      const stack = [state];
      while (stack.length) {
        const v = stack.pop();
        if (!v) continue;
        if (Array.isArray(v)) {
          if (v.length && typeof v[0] === 'object' && (v[0].title || v[0].name || v[0].names)) {
            candidates.push(v);
          }
          v.forEach((x) => typeof x === 'object' && stack.push(x));
        } else if (typeof v === 'object') {
          Object.values(v).forEach((x) => typeof x === 'object' && stack.push(x));
        }
      }
      const arr = candidates.sort((a, b) => b.length - a.length)[0] || [];
      if (!arr.length) continue;
      const items = arr.slice(0, limit).map((it) => ({
        id: it.id || it.code || it.slug || it.url || Math.random().toString(36).slice(2),
        title: it.title?.ru || it.title || it.name?.ru || it.name || it.names?.ru || 'Без названия',
        image: it.poster || it.image || it.cover || null,
        url: it.url || (it.code ? `https://anilib.co/release/${it.code}.html` : undefined),
        __sourceId: 'anilib'
      })).filter((x) => x.title);
      if (items.length) return items;
    } catch (_) {
      // next mirror
    }
  }
  return [];
}

/**
 * Public: get list for "Сейчас смотрят".
 * @param {number} [limit]
 * @returns {Promise<Array<{id:string|number,title:string,image?:string|null,url?:string,__sourceId:string}>>}
 */
export async function getNowWatching(limit = 12) {
  const fromApi = await tryAnilibriaApi(limit);
  if (fromApi.length) return fromApi;
  return tryAnilibHtml(limit);
}

export default { getNowWatching };










