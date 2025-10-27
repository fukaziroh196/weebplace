/**
 * Animelib (v2.animelib.org) scraper for the "Сейчас смотрят" section.
 * Best-effort HTML parsing without external deps. Uses Tauri HTTP plugin if available
 * to bypass CORS when running in the desktop shell.
 */

/**
 * GET helper that prefers tauri plugin-http when available.
 * @param {string} url
 */
async function httpGet(url) {
  return fetch(url, { method: 'GET', headers: { 'Accept': 'text/html,application/json;q=0.9' } });
}

async function fetchHtmlWithFallback(url) {
  try {
    const res = await httpGet(url);
    if (res.ok) return res.text();
  } catch (_) { /* ignore */ }
  // Fallback to read-only mirror that bypasses CORS/JS (best-effort)
  try {
    const alt1 = 'https://r.jina.ai/http://' + url.replace(/^https?:\/\//, '');
    const r1 = await fetch(alt1, { headers: { 'Accept': 'text/plain' } });
    if (r1.ok) return r1.text();
  } catch (_) { /* ignore */ }
  try {
    const alt2 = 'https://r.jina.ai/https://' + url.replace(/^https?:\/\//, '');
    const r2 = await fetch(alt2, { headers: { 'Accept': 'text/plain' } });
    if (r2.ok) return r2.text();
  } catch (_) { /* ignore */ }
  return '';
}

/**
 * Try to extract items from JSON-LD blocks if present.
 * @param {string} html
 */
function extractFromJsonLd(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gim;
  let m;
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1]);
      const list = Array.isArray(data) ? data : [data];
      for (const obj of list) {
        const items = obj?.itemListElement || obj?.hasPart || [];
        if (Array.isArray(items)) {
          for (const it of items) {
            const item = it?.item || it;
            if (!item) continue;
            const url = item.url || item['@id'];
            const name = item.name || item.headline || item.alternateName;
            const image = item.image?.url || item.image;
            if (url && name) {
              out.push({ id: url, title: name, image: image || null, url, __sourceId: 'animelib' });
            }
          }
        }
      }
    } catch (_) { /* ignore */ }
  }
  return out;
}

/**
 * Extract items from an HTML chunk that likely belongs to the target section.
 * @param {string} html
 */
function extractFromCards(html) {
  const out = [];
  // Find card-like anchors in the chunk
  const anchorRe = /<a[^>]+href=\"([^\"]+)\"[^>]*>([\s\S]*?)<\/a>/gim;
  let m;
  while ((m = anchorRe.exec(html))) {
    const href = m[1];
    const inner = m[2] || '';
    // Only take links to titles
    if (!/\/ru\//i.test(href)) continue;
    const imgMatch = inner.match(/<img[^>]+(?:data-src|src)=\"([^\"]+)\"[^>]*>/i);
    const altMatch = inner.match(/<img[^>]+alt=\"([^\"]+)\"/i);
    let title = altMatch?.[1];
    if (!title) {
      const t1 = inner.match(/<div[^>]*class=\"[^\"]*(?:title|name)[^\"]*\"[^>]*>([\s\S]*?)<\/div>/i);
      const t2 = inner.match(/<span[^>]*class=\"[^\"]*(?:title|name)[^\"]*\"[^>]*>([\s\S]*?)<\/span>/i);
      title = t1?.[1] || t2?.[1];
      if (title) title = title.replace(/<[^>]*>/g, '').trim();
    }
    const image = imgMatch?.[1] || null;
    const absUrl = href.startsWith('http') ? href : `https://v2.animelib.org${href}`;
    if (title) out.push({ id: absUrl, title, image, url: absUrl, __sourceId: 'animelib' });
  }
  return out;
}

/**
 * Public API: fetch list for the "Сейчас смотрят" section.
 * @param {number} [limit]
 */
export async function getNowWatchingFromAnimelib(limit = 12) {
  const html = await fetchHtmlWithFallback('https://v2.animelib.org/ru');
  if (!html) return [];

  // 1) JSON-LD pass
  let items = extractFromJsonLd(html);
  if (items.length >= 3) return items.slice(0, limit);

  // 2) Find section by heading text in Russian
  const marker = /(Сейчас\s+смотрят|Популярное|Популярные|Топ\s+сейчас)/i;
  const idx = html.search(marker);
  if (idx !== -1) {
    const chunk = html.slice(idx, Math.min(html.length, idx + 120000));
    items = extractFromCards(chunk);
    if (items.length) return items.slice(0, limit);
  }

  // 3) Fallback: scan entire HTML for lots of cards, take top N
  items = extractFromCards(html);
  return items.slice(0, limit);
}

export default { getNowWatchingFromAnimelib };


