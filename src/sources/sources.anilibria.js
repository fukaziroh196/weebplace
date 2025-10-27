// Minimal AniLibria source: search by title and return magnet-based HLS via webtor (or direct links if available)
// Docs: https://api.anilibria.tv/docs

async function httpGet(url) {
  // Use native fetch. If you need to bypass CORS in production, proxy via your backend/nginx.
  return fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
}

const API = 'https://api.anilibria.tv/v3';

async function searchApi(q, limit = 20) {
  const res = await httpGet(`${API}/title?search=${encodeURIComponent(q)}&limit=${limit}`);
  const json = await res.json();
  const list = Array.isArray(json?.list) ? json.list : (Array.isArray(json) ? json : []);
  return list.map((t) => ({
    id: t.id,
    title: t.names?.ru || t.names?.en || t.names?.alternative?.[0] || t.english || t.russian || t.code,
    image: t.posters?.original?.url || t.posters?.small?.url || null,
    url: `https://www.anilibria.tv/release/${t.code}.html`
  }));
}

async function getTitleById(id) {
  const res = await httpGet(`${API}/title?id=${encodeURIComponent(id)}`);
  const t = await res.json();
  return t;
}

function extractStreamsFromTitle(t) {
  // AniLibria torrents in t.torrents.list[], magnet or torrent url
  const arr = [];
  const list = t?.torrents?.list || [];
  for (const it of list) {
    const magnet = it?.magnet;
    const quality = it?.quality?.string || it?.quality?.type || '';
    if (magnet) {
      // Use webtor embed link as HLS-like (works via iframe; we expose as 'web')
      arr.push({
        url: `https://webtor.io/embed?magnet=${encodeURIComponent(magnet)}&autoplay=1`,
        type: 'web',
        quality,
        dub: 'AniLibria'
      });
    }
  }
  return arr;
}

const AniLibriaSource = {
  info: { id: 'anilibria', name: 'AniLibria', version: '0.1.0' },
  async search(query, opts) {
    if (!query || !query.trim()) return [];
    return (await searchApi(query, opts?.limit || 20)) || [];
  },
  async getById(id) { return getTitleById(id); },
  async getStreams(id, opts) {
    try {
      const t = await getTitleById(id);
      return extractStreamsFromTitle(t);
    } catch (_) { return []; }
  }
};

export default AniLibriaSource;



