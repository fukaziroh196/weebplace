<script>
  import { onMount } from 'svelte';
  import { detailsItem, goToProfile, goToDetails } from '../stores/ui';
  import { sourceRegistry } from '../sources';
  import Hls from 'hls.js';
  import { addToFavorites, removeFromFavorites, currentUser, favorites } from '../stores/auth';
  import { adminImages } from '../stores/sources';
  import ListDropdown from './ListDropdown.svelte';
  import { getRelatedTitles } from '../sources/shikimoriClient';
  import { clickOutside } from '../lib/clickOutside';
  import { playbackSourceId } from '../stores/sources';

  let item; // from store
  let details = null;
  let playbackDetails = null; // details from forced playback source (for episodes playlist)
  let isLoading = true;
  let isLoadingStreams = false;
  let streams = [];
  let episodes = [];
  let selectedEpisode = null;
  let showEpPicker = false;
  let videoEl;
  let hls;
  let related = [];
  let loadedId = null;
  let lastPlaybackFor = null; // remember which forced sourceId we used to fetch playbackDetails
  const isDev = (typeof window !== 'undefined') && (import.meta?.env?.DEV === true);

  function createProxyingLoader() {
    if (!isDev) return null; // only during vite dev
    try {
      const BaseLoader = Hls?.DefaultConfig?.loader;
      if (!BaseLoader) return null;
      return class ProxyLoader extends BaseLoader {
        load(context, config, callbacks) {
          try {
            const url = String(context?.url || '');
            if (/^https?:/i.test(url)) {
              context.url = `/proxy?url=${encodeURIComponent(url)}`;
            }
          } catch (_) {}
          return super.load(context, config, callbacks);
        }
      };
    } catch (_) { return null; }
  }

  function resolveEpisodeUrlRaw(ep) {
    if (!ep || typeof ep !== 'object') return '';
    // Common fields first
    const direct = ep.hls || ep.dash || ep.src || ep.sd || ep.hd || '';
    if (typeof direct === 'string' && direct) return direct;
    // Generic scan for first string that looks like path or url
    for (const [k, v] of Object.entries(ep)) {
      if (typeof v === 'string' && /^(https?:)?\//i.test(v)) return v;
      if (v && typeof v === 'object') {
        for (const [k2, v2] of Object.entries(v)) {
          if (typeof v2 === 'string' && /^(https?:)?\//i.test(v2)) return v2;
        }
      }
    }
    return '';
  }

  function buildAbsoluteUrl(host, rel) {
    if (!rel) return '';
    if (/^https?:/i.test(rel)) return rel;
    if (host) return `https://${host}${rel.startsWith('/') ? '' : '/'}${rel}`;
    return rel;
  }

  async function httpGetJson(url) {
    const proxied = `/proxy?url=${encodeURIComponent(url)}`;
    const r = await fetch(proxied, { headers: { 'Accept': 'application/json' } });
    return await r.json();
  }

  async function tryResolveFromAnilibriaByTitle(title, episode) {
    try {
      if (!title) return [];
      const q = encodeURIComponent(title);
      // 1) search
      let data = await httpGetJson(`https://api.anilibria.tv/v3/title/search?query=${q}&limit=5`).catch(() => null);
      let list = Array.isArray(data?.list) ? data.list : [];
      if (!list.length) {
        data = await httpGetJson(`https://api.anilibria.tv/v3/title?search=${q}&limit=5`).catch(() => null);
        list = Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : []);
      }
      console.log('[anilibria] search by title=', title, 'results=', Array.isArray(list) ? list.length : 0);
      const m = list[0] || null;
      if (!m) return [];
      const id = m.id ?? m.code ?? '';
      if (!id) return [];
      // 2) details
      let d = await httpGetJson(`https://api.anilibria.tv/v3/title/${encodeURIComponent(String(id))}`).catch(() => null);
      if (!d || !d.player) {
        d = await httpGetJson(`https://api.anilibria.tv/v3/title?id=${encodeURIComponent(String(id))}`).catch(() => null);
      }
      const host = d?.player?.host || 'cache.libria.fun';
      const pl = d?.player?.playlist || {};
      const keys = Object.keys(pl).sort((a, b) => Number(a) - Number(b));
      const pick = episode != null ? String(episode) : (keys[0] || null);
      const chosen = pl[pick] || pl[keys[0]] || null;
      const rel = resolveEpisodeUrlRaw(chosen);
      const url = buildAbsoluteUrl(host, rel);
      return url ? [{ url, type: 'hls', quality: 'auto' }] : [];
    } catch (_) {
      return [];
    }
  }

  const unsubscribe = detailsItem.subscribe((v) => {
    item = v;
  });

  async function loadDetails(id) {
    if (!id) return;
    loadedId = id;
    isLoading = true;
    details = null;
    playbackDetails = null;
    related = [];
    try {
      const source = sourceRegistry.get(item.__sourceId);
      if (source?.getById) {
        details = await source.getById(id);
      } else {
        details = {
          id,
          name: item.title,
          russian: item.title,
          description: item.description,
          score: item.score,
          image: item.image ? { original: item.image } : null
        };
      }
    } catch (_) {
      details = null;
    } finally {
      isLoading = false;
    }

    // Apply admin override for poster if exists
    try {
      let map; adminImages.subscribe((v) => (map = v))();
      if (map && map[id]) {
        details = details || {};
        details.image = { original: map[id] };
      }
    } catch (_) {}

    try {
      related = await getRelatedTitles(id);
    } catch (_) {
      related = [];
    }

    // If a forced playback source is selected, try to load its details to build an episodes playlist
    try {
      let forced; playbackSourceId.subscribe((v) => (forced = v))();
      if (forced && forced !== item.__sourceId) {
        const forcedSrc = sourceRegistry.get(forced);
        if (forcedSrc?.getById || forcedSrc?.search) {
          // 1) try same id
          try { playbackDetails = await forcedSrc.getById?.(id); } catch (_) { playbackDetails = null; }
          // 2) if not found, search by title and fetch by mapped id
          if (!playbackDetails) {
            const title = item?.title || details?.russian || details?.name || '';
            const results = await sourceRegistry.search(title, [forced], { limit: 5 }).catch(() => []);
            const best = Array.isArray(results) && results.length ? results[0] : null;
            if (best?.id) {
              try { playbackDetails = await forcedSrc.getById?.(best.id); } catch (_) { playbackDetails = null; }
            }
          }
        }
      }
    } catch (_) {
      playbackDetails = null;
    }
  }

  onMount(async () => {
    if (item?.id) await loadDetails(item.id);
    return () => unsubscribe?.();
  });

  $: if (item?.id && item.id !== loadedId) {
    loadDetails(item.id);
  }

  function normalizeTitle(t) {
    return String(t || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  async function play(ep) {
    if (!item) return;
    isLoadingStreams = true;
    streams = [];
    try {
      const titleRu = details?.russian || item?.title || '';
      const titleEn = details?.name || '';
      const titleForSource = titleRu || titleEn || '';
      const opts = ep ? { episode: Number(ep?.id || ep?.number || ep), title: titleForSource } : { title: titleForSource };
      let fetched = [];
      let forced; playbackSourceId.subscribe((v) => (forced = v))();
      if (forced && forced !== item.__sourceId) {
        // 0) Try forced.getStreams with current id as-is
        try { fetched = (await sourceRegistry.get(forced)?.getStreams?.(item.id, opts)) || []; } catch (_) { fetched = []; }
        // 1) If empty, search by title within forced source and retry with mapped id
        if (!fetched || fetched.length === 0) {
          const title = item?.title || details?.russian || details?.name || '';
          const q = normalizeTitle(title);
          try {
            const results = await sourceRegistry.search(title, [forced], { limit: 5 });
            const best = results.find((r) => normalizeTitle(r.title).includes(q)) || results[0];
            if (best) {
              fetched = (await sourceRegistry.get(forced)?.getStreams?.(best.id, opts)) || [];
              // if streams fetched for mapped id, also keep playbackDetails for episodes
              if (fetched?.length && !playbackDetails) {
                try { playbackDetails = await sourceRegistry.get(forced)?.getById?.(best.id); } catch (_) { /* ignore */ }
              }
            }
          } catch (_) {}
        }
      }
      // Fallback to original source only if forced not selected or nothing found
      if ((!forced || forced === item.__sourceId) && (!fetched || fetched.length === 0)) {
        const source = sourceRegistry.get(item.__sourceId);
        fetched = (await source?.getStreams?.(item.id, opts)) ?? [];
      }
      // Fallback: try to build HLS from playbackDetails if source didn't return anything
      if ((!fetched || fetched.length === 0) && (playbackDetails?.player?.playlist)) {
        const pl = playbackDetails.player.playlist || {};
        const pickId = ep ? String(ep?.id || ep?.number || ep) : (Object.keys(pl).sort((a,b)=>Number(a)-Number(b))[0] || '1');
        const chosen = pl[pickId] || pl[Object.keys(pl)[0]] || null;
        const host = playbackDetails.player.host || '';
        const rel = resolveEpisodeUrlRaw(chosen);
        const url = buildAbsoluteUrl(host, rel);
        console.log('[player] fallback from playbackDetails', { host, pickId, chosen, rel, url });
        if (url) {
          fetched = [{ url, type: 'hls', quality: 'auto' }];
        }
      }
      // Extra fallback(s): try direct AniLibria resolve by title
      if ((!fetched || fetched.length === 0)) {
        let alt = await tryResolveFromAnilibriaByTitle(titleRu || titleEn, opts?.episode);
        if (!alt?.length && titleEn && titleEn !== titleRu) {
          alt = await tryResolveFromAnilibriaByTitle(titleEn, opts?.episode);
        }
        if (alt?.length) fetched = alt;
      }
      streams = fetched;
      try { (globalThis || window).__streams = streams; } catch (_) {}
      console.log('[player] resolved streams', streams);
      await Promise.resolve();
      setupVideo();
      // If we still have no streams, surface a soft error overlay
      if (!streams || streams.length === 0) {
        const dbg = {
          forced,
          playbackDetailsPlayer: playbackDetails?.player,
          detailsPlayer: details?.player,
          episodesCount: episodes?.length || 0
        };
        try { (globalThis || window).__playerDebug = dbg; } catch (_) {}
        console.warn('[player] no streams resolved', dbg);
        console.log('[player] debug → type __playerDebug in console to inspect');
      }
    } catch (_) {
      streams = [];
    } finally {
      isLoadingStreams = false;
    }
  }

  // When user changes the forced playback source in admin, try to resolve playbackDetails lazily
  $: if (item?.id && $playbackSourceId && $playbackSourceId !== lastPlaybackFor) {
    (async () => {
      try {
        const forced = $playbackSourceId;
        if (!forced || forced === item.__sourceId) return;
        const forcedSrc = sourceRegistry.get(forced);
        if (!forcedSrc) return;
        // Search by current title and fetch details for best match
        const title = item?.title || details?.russian || details?.name || '';
        const results = await sourceRegistry.search(title, [forced], { limit: 5 }).catch(() => []);
        const best = Array.isArray(results) && results.length ? results[0] : null;
        if (best?.id) {
          try { playbackDetails = await forcedSrc.getById?.(best.id); lastPlaybackFor = forced; } catch (_) {}
        }
      } catch (_) { /* ignore */ }
    })();
  }

  function setupVideo() {
    if (!videoEl || !streams?.length) return;
    const stream = streams[0];
    const headers = stream?.headers || {};
    if (stream.type === 'hls') {
      if (Hls.isSupported()) {
        hls?.destroy?.();
        const Loader = createProxyingLoader();
        hls = new Hls({
          xhrSetup: (xhr) => {
            try {
              for (const [k, v] of Object.entries(headers)) {
                try { xhr.setRequestHeader(k, String(v)); } catch (_) {}
              }
            } catch (_) {}
          },
          ...(Loader ? { loader: Loader } : {})
        });
        try { videoEl.muted = true; } catch (_) {}
        hls.on(Hls.Events.MANIFEST_PARSED, async () => {
          try { await videoEl.play(); } catch (_) {}
        });
        hls.loadSource(stream.url);
        hls.attachMedia(videoEl);
        try {
          videoEl.addEventListener('error', (e) => {
            console.error('[player] video error (hls)', videoEl?.error);
          }, { once: true });
        } catch (_) {}
      } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        videoEl.src = stream.url;
        try { videoEl.play?.(); } catch (_) {}
      }
    } else {
      try { videoEl.muted = true; } catch (_) {}
      const directUrl = String(stream.url || '');
      const finalUrl = (isDev && /^https?:/i.test(directUrl))
        ? `/proxy?url=${encodeURIComponent(directUrl)}`
        : directUrl;
      videoEl.src = finalUrl;
      try { videoEl.play?.(); } catch (_) {}
      try {
        videoEl.addEventListener('error', (e) => {
          console.error('[player] video error (direct)', videoEl?.error);
        }, { once: true });
      } catch (_) {}
    }
  }

  $: isFav = ($favorites || []).some((f) => f.id === (item?.id));

  function toggleFavFromDetails() {
    let user; currentUser.subscribe((v) => (user = v))();
    if (!user) { goToProfile(); return; }
    const title = item?.title || details?.russian || details?.name;
    const image = details?.image?.original ? `https://shikimori.one${details.image.original}` : item?.image;
    if (isFav) removeFromFavorites(item.id);
    else addToFavorites({ id: item.id, title, image });
  }

  function addToList(type) {
    let user; currentUser.subscribe((v) => (user = v))();
    if (!user) { goToProfile(); return; }
    const base = { id: item.id, title: item?.title || details?.russian || details?.name, image: (details?.image?.original ? (details.image.original.startsWith('http') ? details.image.original : `https://shikimori.one${details.image.original}`) : item?.image) };
    import('../stores/auth').then(({ moveItemToList }) => moveItemToList(type, base));
  }

  import { wishlist, watched, dropped, ratings, setRating, clearRating } from '../stores/auth';
  import RatingDropdown from './RatingDropdown.svelte';
  $: currentList = (() => {
    const id = item?.id;
    if (!id) return null;
    if (($wishlist || []).some((x) => x.id === id)) return 'wishlist';
    if (($watched || []).some((x) => x.id === id)) return 'watched';
    if (($dropped || []).some((x) => x.id === id)) return 'dropped';
    return null;
  })();

  function mapKind(kind) {
    const map = {
      tv: 'TV-сериал',
      movie: 'Фильм',
      ova: 'OVA',
      ona: 'ONA',
      special: 'Спешл',
      music: 'Клип',
      tv_special: 'Спецвыпуск'
    };
    return map[kind] || kind || '—';
  }

  function mapStatus(status) {
    const map = { anons: 'Анонс', ongoing: 'Онгоинг', released: 'Вышло' };
    return map[status] || status || '—';
  }

  $: genres = (details?.genres || []).map((g) => g.russian || g.name).filter(Boolean);
  $: year = (() => { const src = details?.aired_on || details?.released_on; return src ? String(src).slice(0,4) : null; })();
  $: studios = Array.isArray(details?.studios) ? details.studios.map((s) => s.name || s.russian).filter(Boolean) : [];
  function sanitizeDescription(raw) {
    return String(raw || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\[(?:\/)?[^\]]+\]/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  $: safeDescription = sanitizeDescription(details?.description_html || details?.description || item?.description);

  // Build episodes list
  // 1) prefer playlist from forced playback details if available (e.g., AniLibria)
  // 2) else try playlist from main details
  // 3) else fallback to Shikimori counters
  $: episodes = (() => {
    const pl = playbackDetails?.player?.playlist || details?.player?.playlist;
    if (pl && typeof pl === 'object') {
      const keys = Object.keys(pl).sort((a, b) => Number(a) - Number(b));
      return keys.map((k) => ({ id: k, number: Number(k), title: pl[k]?.name || `Эпизод ${k}` }));
    }
    const count = Number(details?.episodes_aired || details?.episodes || 0);
    if (!Number.isFinite(count) || count <= 0) return [];
    return Array.from({ length: count }, (_, i) => {
      const n = i + 1;
      return { id: String(n), number: n, title: `Эпизод ${n}` };
    });
  })();

  // Select first episode by default when episodes appear
  $: if (episodes.length && (selectedEpisode == null)) {
    selectedEpisode = episodes[0].id;
  }
</script>

{#if isLoading}
  <div class="text-white/80 mt-4">Загрузка…</div>
{:else if !details}
  <div class="text-white/80 mt-4">Не удалось загрузить информацию.</div>
{:else}
  <div class="mt-4 grid grid-cols-[320px_1fr] gap-6">
    <!-- Left column: title + poster -->
    <div>
      <h1 class="text-3xl font-bold text-white mb-3 title-strong">{details.russian || details.name}</h1>
      {#if details.image?.original}
        <img src={details.image.original.startsWith('http') ? details.image.original : `https://shikimori.one${details.image.original}`} alt={details.russian || details.name}
             class="w-[320px] h-[450px] object-cover rounded-xl glass-frame" loading="lazy" />
      {:else if item?.image}
        <img src={item.image} alt={item.title} class="w-[320px] h-[450px] object-cover rounded-xl glass-frame" loading="lazy" />
      {/if}
      <!-- Actions under poster -->
      <div class="mt-3 flex items-center gap-3">
        <RatingDropdown itemId={item?.id} />
        <div class="relative">
          <ListDropdown onSelect={addToList} currentType={currentList} />
        </div>
      </div>
    </div>

    <!-- Right column: description + rating -->
    <div class="flex flex-col">
      <div class="mb-4">
        <h2 class="text-white font-semibold mb-2">Описание</h2>
        <div class="text-pink-100/95 leading-relaxed whitespace-pre-line max-h-[220px] overflow-auto pr-2 scrollable scrollable--active">
          {safeDescription || '—'}
        </div>
      </div>
      <div class="mb-4 grid grid-cols-2 gap-4">
        <div>
          <h3 class="text-white/80 text-sm">Тип</h3>
          <div class="text-white font-medium">{mapKind(details.kind)}</div>
        </div>
        <div>
          <h3 class="text-white/80 text-sm">Статус</h3>
          <div class="text-white font-medium">{mapStatus(details.status)}</div>
        </div>
        <div>
          <h3 class="text-white/80 text-sm">Рейтинг</h3>
          <div class="text-pink-200 font-semibold">{details.score || '—'}</div>
        </div>
        <div>
          <h3 class="text-white/80 text-sm">Длительность эпизода</h3>
          <div class="text-white font-medium">{details.duration ? `${details.duration} мин` : '—'}</div>
        </div>
        <div>
          <h3 class="text-white/80 text-sm">Год</h3>
          <div class="text-white font-medium">{year || '—'}</div>
        </div>
        <div>
          <h3 class="text-white/80 text-sm">Студии</h3>
          <div class="text-white/90 text-sm truncate" title={studios.join(', ')}>{studios.join(', ') || '—'}</div>
        </div>
      </div>

      

      <div class="mb-4">
        <h3 class="text-white/80 text-sm mb-1">Жанры</h3>
        {#if genres.length}
          <div class="flex flex-wrap gap-2">
            {#each genres as g}
              <span class="px-2 py-1 rounded-full text-xs bg-white/15 text-white/95 border border-white/20">{g}</span>
            {/each}
          </div>
        {:else}
          <div class="text-white/60">—</div>
        {/if}
      </div>

      <div class="mt-auto flex items-center gap-3">
        {#if episodes.length}
          <div class="relative" use:clickOutside={{ enabled: showEpPicker, callback: () => { showEpPicker = false; } }}>
            <button type="button" class="px-3 py-2 rounded bg-white/10 border border-white/30 text-white hover:bg-white/20"
                    aria-haspopup="listbox" aria-expanded={showEpPicker} on:click={() => showEpPicker = !showEpPicker}>
              Эп. {episodes.find(e => String(e.id) === String(selectedEpisode))?.number ?? episodes[0]?.number}
            </button>
            {#if showEpPicker}
              <div class="absolute left-0 mt-2 w-28 rounded-xl overflow-hidden z-20 menu-surface">
                <div class="max-h-64 overflow-auto">
                  {#each episodes as ep}
                    <div class="px-3 py-2 cursor-pointer flex items-center justify-between menu-item"
                         role="option"
                         aria-selected={String(selectedEpisode) === String(ep.id)}
                         on:click={() => { selectedEpisode = ep.id; showEpPicker = false; }}>
                      <span>Эп. {ep.number}</span>
                      {#if String(selectedEpisode) === String(ep.id)}<span>✓</span>{/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
        <button class="bg-pink-700/95 text-white px-6 py-3 rounded-full font-semibold shadow-lg hover:scale-105 transition-transform hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-500/60"
                on:click={() => play(selectedEpisode)}>
          Смотреть
        </button>
        <button class="rounded-full w-11 h-11 flex items-center justify-center text-xl font-bold hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/50"
                style="background: {isFav ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.85)'}; color: {isFav ? '#c026d3' : '#8e2a8e'};"
                title={isFav ? 'Убрать из избранного' : 'В избранное'}
                on:click={toggleFavFromDetails}>{isFav ? '❤' : '♡'}</button>
      </div>
    </div>
  </div>

  <!-- Player section below -->
  <div class="mt-6">
    <h2 class="text-white font-semibold mb-2">Плеер</h2>
    {#if isLoadingStreams}
      <div class="bg-pink-900/50 rounded-xl h-[360px] flex items-center justify-center text-white/80 glass-frame">
        Загрузка потоков…
      </div>
    {:else if streams.length}
      <video bind:this={videoEl} class="w-full h-[360px] bg-black rounded-xl" controls playsinline></video>
    {:else}
      <div class="bg-pink-900/50 rounded-xl h-[360px] flex items-center justify-center text-white/80 glass-frame">
        Нажмите «Смотреть», чтобы загрузить потоки
      </div>
    {/if}
  </div>
  {#if related?.length}
    <div class="mt-6">
      <h2 class="text-white font-semibold mb-2">Связанные тайтлы</h2>
      <div class="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {#each related as r}
          <div class="w-44 h-28 bg-pink-900/40 rounded-lg relative flex-shrink-0 cursor-pointer hover:scale-105 transition-transform"
               on:click={() => goToDetails({ id: r.id, __sourceId: 'shikimori', title: r.title, image: r.image })}>
            {#if r.image}
              <img src={r.image} alt={r.title} class="absolute inset-0 w-full h-full object-cover opacity-85 rounded-lg"/>
            {/if}
            <div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg">
              <div class="text-white text-xs font-semibold truncate">{r.title}</div>
              {#if r.relation}
                <div class="text-white/70 text-[10px] truncate">{r.relation}</div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
{/if}

<style>
  .text-white\/80 { color: rgba(255,255,255,0.8); }
  .glass-frame { border: 1.5px solid rgba(255, 255, 255, 0.22); box-shadow: 0 6px 24px rgba(216, 90, 147, 0.18); }
  .scrollable { scrollbar-width: thin; }
  .title-strong { text-shadow: 0 2px 12px rgba(255,255,255,0.25); }
</style>


