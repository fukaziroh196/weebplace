import ShikimoriSource from './shikimoriSource';
import AniLibriaSource from './sources.anilibria';

const builtInSources = [ShikimoriSource, AniLibriaSource];

/**
 * Source registry similar to Tachiyomi/Aidoku, minimal MVP
 */
class SourceRegistry {
  constructor() {
    /** @type {Map<string, import('./types').SourceModule>} */
    this.idToSource = new Map();
    builtInSources.forEach((s) => this.register(s));
    // load user sources from localStorage
    try {
      const raw = localStorage.getItem('sources:user');
      if (raw) {
        const specs = JSON.parse(raw);
        if (Array.isArray(specs)) {
          specs.forEach((spec) => {
            try { this.register(makeUserSource(spec)); } catch (_) {}
          });
        }
      }
    } catch (_) {}
  }

  /**
   * @param {import('./types').SourceModule} source
   */
  register(source) {
    this.idToSource.set(source.info.id, source);
  }

  /**
   * @param {string} id
   */
  get(id) {
    return this.idToSource.get(id);
  }

  /**
   * Search across one or many sources
   * @param {string} query
   * @param {string[]} sourceIds
   */
  async search(query, sourceIds, opts) {
    const sources = sourceIds?.length
      ? sourceIds.map((id) => this.get(id)).filter(Boolean)
      : [...this.idToSource.values()];
    const results = await Promise.all(
      sources.map((s) => s.search(query, opts).catch(() => []))
    );
    // annotate each result with source id
    return results
      .map((arr, idx) => arr.map((it) => ({ ...it, __sourceId: sources[idx].info.id })))
      .flat();
  }
}

export const sourceRegistry = new SourceRegistry();

/**
 * Register a new user-provided source. Persist it and make available immediately.
 * @param {{ id:string, name:string, version?:string, endpoints?:{search:string,getById?:string,getStreams?:string}, script?:string }} spec
 */
export function registerUserSource(spec) {
  const src = makeUserSource(spec);
  sourceRegistry.register(src);
  try {
    const raw = localStorage.getItem('sources:user');
    const list = raw ? JSON.parse(raw) : [];
    const without = (Array.isArray(list) ? list : []).filter((s) => s.id !== spec.id);
    without.push(spec);
    localStorage.setItem('sources:user', JSON.stringify(without));
  } catch (_) {}
}

/**
 * Convert user spec to SourceModule. Supports two modes:
 * - endpoints: simple REST endpoints with {q} and {id} placeholders
 * - script: JS function bodies as strings: search, getById, getStreams
 */
function makeUserSource(spec) {
  const info = { id: spec.id, name: spec.name, version: spec.version || '1.0.0' };
  if (spec.script) {
    const fns = createScriptSource(spec.script);
    return { info, ...fns };
  }
  const endpoints = spec.endpoints || {};
  // In web, use native fetch; in dev, route through local proxy to avoid CORS
  async function httpGet(url) {
    const proxied = typeof url === 'string' ? `/proxy?url=${encodeURIComponent(url)}` : url;
    return fetch(proxied, { method: 'GET', headers: { 'Accept': 'application/json' } });
  }
  return {
    info,
    async search(query, opts) {
      const url = (endpoints.search || '').replace('{q}', encodeURIComponent(query || ''));
      const res = await httpGet(url);
      const json = await res.json();
      const map = Array.isArray(json) ? json : (json?.results || []);
      return map.slice(0, opts?.limit || 20).map((x) => ({ id: x.id || x.slug || x.url, title: x.title || x.name, image: x.image || x.poster || null, url: x.url }));
    },
    async getById(id) {
      if (!endpoints.getById) return null;
      const url = endpoints.getById.replace('{id}', encodeURIComponent(String(id)));
      const res = await httpGet(url);
      return res.json();
    },
    async getStreams(id, opts) {
      if (!endpoints.getStreams) return [];
      let url = endpoints.getStreams
        .replace('{id}', encodeURIComponent(String(id)))
        .replace('{q}', encodeURIComponent(opts?.title || ''))
        .replace('{title}', encodeURIComponent(opts?.title || ''));
      if (opts?.episode != null) {
        url = url.replace('{episode}', encodeURIComponent(String(opts.episode)));
      }
      const res = await httpGet(url);
      const json = await res.json();
      const arr = Array.isArray(json) ? json : (json?.streams || []);
      return arr.map((s) => ({ url: s.url, type: s.type || (String(s.url||'').endsWith('.mp4') ? 'mp4' : 'hls'), quality: s.quality, headers: s.headers }));
    }
  };
}

function createScriptSource(scriptText) {
  // scriptText is expected to define functions: search, getById, getStreams
  // executed in a sandboxed Function with limited globals
  const fetchThroughProxy = (url, init) => (async () => {
    const finalUrl = (typeof url === 'string' && /^https?:/i.test(url))
      ? `/proxy?url=${encodeURIComponent(url)}`
      : url;
    return fetch(finalUrl, init);
  })();
  const sandbox = { fetch: fetchThroughProxy };
  const factory = new Function('sandbox', `with (sandbox) { ${scriptText}; return { search, getById, getStreams }; }`);
  const fns = factory(sandbox);
  return {
    async search(query, opts) { return (await fns.search?.(query, opts)) || []; },
    async getById(id) { return fns.getById ? fns.getById(id) : null; },
    async getStreams(id, opts) { return fns.getStreams ? fns.getStreams(id, opts) : []; }
  };
}


