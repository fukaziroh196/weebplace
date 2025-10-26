<script>
  import { onMount } from 'svelte';
  import { getTopAiring, getSeasonNow, getTopPopular } from '../sources/jikanClient';
  import { getPopular as getShikiPopular, mapAnimeToItem as mapShiki } from '../sources/shikimoriClient';
  import { sourceRegistry } from '../sources';
  import { goToDetails } from '../stores/ui';

  let items = [];
  let loading = true;
  let error = '';
  let view = [];
  let isLoadingMore = false;
  let page = 1;
  let endReached = false;
  let sentinel;
  let rootEl;
  let showTop = false;
  let sort = 'popularity'; // popularity | score_desc | score_asc | year_desc | year_asc | title_az
  let q = '';
  let observer;

  // Filters
  // start with no filters applied (all unchecked)
  let ratings = {};
  let kinds = {};
  let statuses = {};
  let year = '';
  let genres = new Set();
  const allGenres = ['Action','Comedy','Drama','Romance','Sci-Fi','Thriller','Fantasy','Adventure','Slice of Life','Mystery'];

  function normalize(a) {
    return {
      id: a.id,
      title: a.title,
      image: a.image,
      score: a.score,
      kind: (a.kind || 'tv').toLowerCase(),
      status: (a.status || 'released').toLowerCase(),
      rating: (a.rating || 'pg13').toLowerCase(),
      year: a.seasonYear || null,
      genres: Array.isArray(a.genres) ? a.genres : []
    };
  }

  async function load() {
    loading = true; error = '';
    try {
      items = [];
      page = 1;
      endReached = false;
      await loadMore();
      // preload one more page for smoother UX
      await loadMore();
      view = items;
    } catch (e) { error = 'Не удалось загрузить'; items = []; }
    finally { loading = false; }
  }

  async function loadMore() {
    if (isLoadingMore || endReached) return;
    isLoadingMore = true;
    try {
      const shiki = await getShikiPopular(50, page).catch(()=>[]);
      const mapped = (shiki || []).map(mapShiki).map(normalize);
      if (!mapped.length) { endReached = true; return; }
      const dedup = new Map(items.map((it)=>[it.id, it]));
      for (const it of mapped) { if (!dedup.has(it.id)) dedup.set(it.id, it); }
      items = Array.from(dedup.values());
      // apply current filters snapshot to new items as well
      view = applyFilters(items);
      page += 1;
    } finally {
      isLoadingMore = false;
    }
  }

  onMount(() => {
    load();
    // setup infinite scroll observer
    rootEl = document.querySelector('.workspace-frame') || null;
    observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) loadMore();
      }
    }, { root: rootEl, rootMargin: '1000px' });
    // if sentinel already mounted, start observing
    if (sentinel) observer.observe(sentinel);
    function onScroll() {
      try { showTop = (rootEl?.scrollTop || 0) > 600; } catch (_) { showTop = false; }
    }
    try { rootEl?.addEventListener('scroll', onScroll, { passive: true }); } catch (_) {}
    return () => { try { observer.disconnect(); } catch (_) {} try { rootEl?.removeEventListener('scroll', onScroll); } catch (_) {} };
  });

  $: if (observer && sentinel) {
    try { observer.observe(sentinel); } catch (_) {}
  }

  // Derived filtered list is applied only when user clicks "Применить"
  let applied = { ratings: {}, kinds: {}, statuses: {}, year: '', genres: new Set() };
  function snapshotFilters() {
    applied = {
      ratings: { ...ratings },
      kinds: { ...kinds },
      statuses: { ...statuses },
      year,
      genres: new Set(genres)
    };
    recomputeView();
  }

  function applyFilters(list) {
    const hasRating = Object.values(applied.ratings || {}).some(Boolean);
    const hasKind = Object.values(applied.kinds || {}).some(Boolean);
    const hasStatus = Object.values(applied.statuses || {}).some(Boolean);
    return list.filter((it) => {
      if (applied.year && String(it.year) !== String(applied.year)) return false;
      if (hasRating && !applied.ratings[it.rating]) return false;
      if (hasKind && !applied.kinds[it.kind]) return false;
      if (hasStatus && !applied.statuses[it.status]) return false;
      if (applied.genres && applied.genres.size) {
        const has = it.genres && it.genres.some((g)=> applied.genres.has(g));
        if (!has) return false;
      }
      return true;
    });
  }

  function recomputeView() {
    const f = applyFilters(items).filter((it) => {
      const text = String(q || '').trim().toLowerCase();
      if (!text) return true;
      return String(it.title || '').toLowerCase().includes(text);
    });
    const arr = f.slice();
    switch (sort) {
      case 'score_desc': arr.sort((a,b)=> (b.score||0) - (a.score||0)); break;
      case 'score_asc': arr.sort((a,b)=> (a.score||0) - (b.score||0)); break;
      case 'year_desc': arr.sort((a,b)=> (Number(b.year)||0) - (Number(a.year)||0)); break;
      case 'year_asc': arr.sort((a,b)=> (Number(a.year)||0) - (Number(b.year)||0)); break;
      case 'title_az': arr.sort((a,b)=> String(a.title||'').localeCompare(String(b.title||''))); break;
      default: /* popularity: keep original order */ break;
    }
    view = arr;
  }
</script>

<div class="grid grid-cols-[1fr_280px] gap-4">
  <!-- Catalog list -->
  <section>
    <div class="flex items-center justify-between mb-3">
      <div class="text-white font-semibold">Каталог — популярное</div>
      <div class="flex items-center gap-2">
        <input class="bg-white/10 text-white rounded px-2 py-1" placeholder="Поиск..." bind:value={q} on:input={recomputeView} />
        <select class="bg-white/10 text-white rounded px-2 py-1" bind:value={sort} on:change={recomputeView}>
          <option value="popularity">По популярности</option>
          <option value="score_desc">По оценке ↓</option>
          <option value="score_asc">По оценке ↑</option>
          <option value="year_desc">По году ↓</option>
          <option value="year_asc">По году ↑</option>
          <option value="title_az">По алфавиту</option>
        </select>
      </div>
    </div>
    {#if loading}
      <div class="text-white/80">Загрузка…</div>
    {:else if error}
      <div class="text-white/80">{error}</div>
    {:else}
      <div class="grid grid-cols-5 gap-4">
        {#each view as it}
          <div class="bg-pink-900/50 rounded-xl h-48 hover:scale-105 transition-transform cursor-pointer backdrop-blur-sm relative glass-frame"
               on:click={() => goToDetails({ id: it.id, __sourceId: 'shikimori', title: it.title, image: it.image })}>
            {#if it.image}
              <img src={it.image} alt={it.title} class="absolute inset-0 w-full h-full object-cover opacity-85 rounded-xl"/>
            {/if}
            <div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent rounded-b-xl">
              <div class="text-white font-semibold text-sm truncate">{it.title}</div>
            </div>
          </div>
        {/each}
        <div class="h-1 col-span-5" bind:this={sentinel}></div>
      </div>
    {/if}
    {#if showTop}
      <button class="fixed right-6 bottom-6 bg-pink-700/95 text-white rounded-full w-12 h-12 text-xl shadow-lg hover:bg-pink-600" on:click={() => { try { rootEl.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {} }} title="Наверх">↑</button>
    {/if}
  </section>

  <!-- Right filters column -->
  <aside class="rounded-xl p-3 glass-frame h-fit sticky top-0 self-start max-h-[calc(100vh-16px)] overflow-y-auto overscroll-contain pr-2">
    <div class="text-white font-semibold mb-2">Фильтры</div>
    <div class="text-white/80 text-sm mb-1">Возрастной рейтинг</div>
    <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-white/90 text-sm mb-3">
      {#each ['g','pg','pg13','r17','r','rx'] as key}
        <label class="flex items-center gap-2"><input type="checkbox" bind:checked={ratings[key]}/> {key.toUpperCase()}</label>
      {/each}
    </div>
    <div class="text-white/80 text-sm mb-1">Тип</div>
    <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-white/90 text-sm mb-3">
      {#each ['tv','movie','ova','ona','special'] as key}
        <label class="flex items-center gap-2"><input type="checkbox" bind:checked={kinds[key]}/> {key.toUpperCase()}</label>
      {/each}
    </div>
    <div class="text-white/80 text-sm mb-1">Статус</div>
    <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-white/90 text-sm mb-3">
      {#each ['ongoing','released','anons'] as key}
        <label class="flex items-center gap-2"><input type="checkbox" bind:checked={statuses[key]}/> {key}</label>
      {/each}
    </div>
    <div class="text-white/80 text-sm mb-1">Год</div>
    <select class="w-full bg-white/10 text-white rounded px-2 py-1 mb-3" bind:value={year}>
      <option value="">Любой</option>
      {#each Array.from({length: 30}, (_,i)=>2025-i) as y}
        <option value={y}>{y}</option>
      {/each}
    </select>
    <div class="text-white/80 text-sm mb-1">Жанры</div>
    <details class="mb-2">
      <summary class="cursor-pointer text-white/90">Выбрать жанры</summary>
      <div class="grid grid-cols-1 gap-1 mt-2 text-white/90 text-sm">
        {#each allGenres as g}
          <label class="flex items-center gap-2"><input type="checkbox" on:change={(e)=>{ if(e.currentTarget.checked) genres.add(g); else genres.delete(g); genres=new Set(genres);} }/> {g}</label>
        {/each}
      </div>
    </details>
    <div class="flex gap-2 mt-2">
      <button class="bg-pink-700/95 text-white rounded px-3 py-1 font-semibold hover:bg-pink-600" on:click={snapshotFilters}>Применить</button>
      <button class="bg-white/10 text-white rounded px-3 py-1 hover:bg-white/20" on:click={() => { ratings = { g:true, pg:true, pg13:true, r17:true, r:true, rx:false }; kinds={ tv:true, movie:true, ova:true, ona:true, special:true }; statuses={ ongoing:true, released:true, anons:true }; year=''; genres=new Set(); snapshotFilters(); }}>Сбросить</button>
    </div>
  </aside>
</div>


