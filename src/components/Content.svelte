<script>
  import { onMount, tick } from 'svelte';
  import { searchResults, isSearching } from '../stores/sources';
  import { activeView, detailsItem, goToDetails, goToProfile } from '../stores/ui';
  import DetailsView from './DetailsView.svelte';
  import ProfileView from './ProfileView.svelte';
  import AdminPanel from './AdminPanel.svelte';
  import ListsView from './ListsView.svelte';
  import MessagesView from './MessagesView.svelte';
  import { addToFavorites, currentUser, isFavorite, removeFromFavorites, favorites, wishlist, watched, dropped, ratings } from '../stores/auth';
  import { adminImages } from '../stores/sources';
  import CatalogView from './CatalogView.svelte';
  import GuessAnimeView from './GuessAnimeView.svelte';

  function addFav(item) {
    let user; currentUser.subscribe((v) => (user = v))();
    if (!user) { goToProfile(); return; }
    addToFavorites({ id: item.id, title: item.title, image: item.image });
  }

  function toggleFav(item) {
    let user; currentUser.subscribe((v) => (user = v))();
    if (!user) { goToProfile(); return; }
    if (isFavorite(item.id)) removeFromFavorites(item.id);
    else addToFavorites({ id: item.id, title: item.title, image: item.image });
  }

  // Make template reactive to favorites changes
  $: favoriteIds = new Set(($favorites || []).map((it) => it.id));
  $: wishIds = new Set(($wishlist || []).map((it) => it.id));
  $: watchedIds = new Set(($watched || []).map((it) => it.id));
  $: droppedIds = new Set(($dropped || []).map((it) => it.id));
  $: ratingMap = $ratings || {};
  import { openPlayerForItem } from '../stores/player';
  import { getSeasonalWithDetails } from '../sources/shikimoriClient';
  import { getRecommendedFeed } from '../sources/recommendations';
  import { sourceRegistry } from '../sources';
  
  let currentSlide = 0;
  let timeLeft = 7;
  /** @type {{ id: number|string, title: string, description?: string, image?: string|null, url?: string }[]} */
  let slides = [];
  let slidesLoading = true;
  let slidesError = '';
  
  // Данные для горизонтального слайдера
  const popularContent = [
    { title: "Фильм 1", rating: "8.5", year: "2024" },
    { title: "Сериал 1", rating: "9.1", year: "2023" },
    { title: "Фильм 2", rating: "7.8", year: "2024" },
    { title: "Сериал 2", rating: "8.9", year: "2023" },
    { title: "Фильм 3", rating: "8.2", year: "2024" },
    { title: "Сериал 3", rating: "9.3", year: "2023" }
  ];
  
  // Дополнительные секции под «Сейчас на экранах»
  const newReleases = [
    { title: "Новый 1" },
    { title: "Новый 2" },
    { title: "Новый 3" },
    { title: "Новый 4" },
    { title: "Новый 5" },
    { title: "Новый 6" }
  ];

  const recommendations = [
    { title: "Реком. 1", rating: "8.1" },
    { title: "Реком. 2", rating: "8.7" },
    { title: "Реком. 3", rating: "7.9" },
    { title: "Реком. 4", rating: "8.4" },
    { title: "Реком. 5", rating: "8.0" },
    { title: "Реком. 6", rating: "8.3" },
    { title: "Реком. 7", rating: "8.6" },
    { title: "Реком. 8", rating: "8.2" }
  ];

  const topWeek = [
    { title: "Хит 1", rating: "9.2" },
    { title: "Хит 2", rating: "9.0" },
    { title: "Хит 3", rating: "8.9" },
    { title: "Хит 4", rating: "8.7" },
    { title: "Хит 5", rating: "8.6" }
  ];
  
  let interval;
  let timerInterval;
  // Recommendations aggregated / personalized
  let recs = [];
  let recsLoading = true;
  let recsError = '';
  // Recommendations carousel: paginate by fixed pages of 4 items
  let recsViewportEl;
  let recsTrackEl;
  let canRecsLeft = false;
  let canRecsRight = false;
  const recsPerPage = 5;
  let recsPage = 0;
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  $: recsUsed = recs.slice(0, 25);
  $: recsPadded = (() => { const a = recsUsed.slice(); while (a.length % recsPerPage !== 0) a.push(null); return a; })();
  $: recsPageCount = Math.max(1, Math.ceil(recsPadded.length / recsPerPage));
  let recsStepPx = 276; // step = cardW + gap
  let recsPageWidthPx = 0; // will be measured from viewport width
  let recsCardW = 260;
  let recsCardH = 0; // target ~3:4 poster aspect: H = W * 4/3
  $: recsCardH = Math.round(recsCardW * 4 / 3);
  $: recsOffsetPx = recsPageWidthPx * recsPage;
  function measureRecs() {
    try {
      const vp = recsViewportEl; const track = recsTrackEl;
      if (!vp || !track) return;
      const cs = getComputedStyle(track);
      const gap = parseInt(cs.gap || cs.columnGap || '16', 10) || 16;
      const vpW = vp.clientWidth || 0;
      const w = Math.max(180, Math.floor((vpW - gap * (recsPerPage - 1)) / recsPerPage));
      recsCardW = w;
      recsStepPx = recsCardW + gap;
      recsPageWidthPx = recsStepPx * recsPerPage - gap; // total visible width
    } catch (_) {}
  }
  function updateRecsScrollState() {
    canRecsLeft = recsPage > 0;
    canRecsRight = recsPage < (recsPageCount - 1);
  }
  function scrollRecs(dir) {
    recsPage = clamp(recsPage + dir, 0, recsPageCount - 1);
    updateRecsScrollState();
  }
  
  async function openRecommendation(item) {
    try {
      // 1) If we have a Shikimori id encoded like 'shiki-1234' → open details directly
      const rawId = String(item?.id || '');
      if (rawId.startsWith('shiki-')) {
        const id = rawId.slice('shiki-'.length);
        if (id) { goToDetails({ id, __sourceId: 'shikimori', title: item.title, image: item.image }); return; }
      }
      // 2) Try to extract id from Shikimori url
      const url = String(item?.url || '');
      const m = url.match(/shikimori\.(?:one|me)\/animes\/(\d+)/i);
      if (m && m[1]) { goToDetails({ id: m[1], __sourceId: 'shikimori', title: item.title, image: item.image }); return; }
      // 3) Search in Shikimori by title and open first match
      const title = String(item?.title || '').trim();
      if (title) {
        const results = await sourceRegistry.search(title, ['shikimori'], { limit: 5 }).catch(() => []);
        const best = Array.isArray(results) && results.length ? results[0] : null;
        if (best?.id) { goToDetails({ id: best.id, __sourceId: 'shikimori', title: best.title || title, image: best.image || item.image }); return; }
      }
    } catch (_) { /* ignore and fallback */ }
    // 4) Fallback: open external link if present
    if (item?.url) window.open(item.url, '_blank');
  }
  
  async function loadSlides() {
    slidesLoading = true;
    slidesError = '';
    try {
      slides = await getSeasonalWithDetails(5);
    } catch (e) {
      slides = [];
      slidesError = 'Не удалось загрузить «Аниме сезона». Попробуйте ещё раз.';
      console.error(e);
    } finally {
      slidesLoading = false;
    }
  }


  async function loadRecs() {
    recsLoading = true;
    recsError = '';
    try {
      recs = await getRecommendedFeed(12);
    } catch (e) {
      recs = [];
      recsError = 'Не удалось загрузить рекомендации.';
      console.error(e);
    } finally {
      recsLoading = false;
    }
  }

  // reactively overlay admin images
  $: slidesEffective = slides.map((s) => ($adminImages && $adminImages[s.id]) ? { ...s, image: $adminImages[s.id] } : s);

  onMount(async () => {
    // Загрузка онгоингов Shikimori для большого баннера
    await loadSlides();
    // Рекомендуем сейчас
    loadRecs().finally(async () => { await tick(); measureRecs(); recsPage = 0; updateRecsScrollState(); });
    const onResize = () => { measureRecs(); updateRecsScrollState(); };
    try { window.addEventListener('resize', onResize, { passive: true }); } catch(_) {}

    interval = setInterval(() => {
      if (slides.length > 0) {
        currentSlide = (currentSlide + 1) % slides.length;
        timeLeft = 7;
      }
    }, 7000);

    timerInterval = setInterval(() => {
      timeLeft = Math.max(0, timeLeft - 0.1);
    }, 100);

    return () => {
      if (interval) clearInterval(interval);
      if (timerInterval) clearInterval(timerInterval);
      try { window.removeEventListener('resize', onResize); } catch(_) {}
    };
  });
  
  const goToSlide = (index) => {
    currentSlide = index;
    timeLeft = 7;
  };
  
  $: progress = ((7 - timeLeft) / 7) * 100;
</script>

  <div class="flex flex-col w-full px-6">
  {#if $activeView === 'home'}
  <!-- Big banner with carousel (scrolls with content) -->
  <div class="mt-2 bg-pink-900/70 backdrop-blur-md rounded-xl relative overflow-hidden w-full h-[300px] glass-frame">
    {#if slidesLoading}
      <div class="absolute inset-0 flex items-center justify-center text-white/80">Загрузка…</div>
    {/if}
    {#if !slidesLoading && slidesError}
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/90">
        <div>{slidesError}</div>
        <button class="bg-pink-700/95 text-white px-4 py-2 rounded-full font-semibold hover:bg-pink-600"
                on:click={loadSlides}>Повторить</button>
      </div>
    {/if}
    <!-- Slides -->
    <div class="absolute inset-0 flex transition-transform duration-1000 ease-in-out" style="transform: translateX(-{currentSlide * 100}%)">
      {#each slidesEffective as slide, i}
        <div class="min-w-full relative">
            {#if slide.image}
              <img src={slide.image} alt={slide.title} class="absolute inset-0 w-full h-full object-cover opacity-60" loading="lazy" />
            {:else}
              <div class="absolute inset-0 bg-gradient-to-r from-black/40 via-black/20 to-transparent"></div>
            {/if}
          <div class="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent"></div>
          <!-- Title and description in top left -->
          <div class="absolute top-6 left-8 right-8 max-w-[60%]">
            <h1 class="text-4xl font-bold text-white mb-3 drop-shadow">{slide.title}</h1>
            {#if slide.description}
              <p class="text-base text-pink-100/95 leading-relaxed" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">
                {slide.description}
              </p>
            {:else}
              <p class="text-base text-pink-100/80 leading-relaxed italic">Описание недоступно</p>
            {/if}
          </div>
          
          <!-- Button in bottom left -->
          <div class="absolute bottom-6 left-8">
            <button
              class="btn-kristal-accent px-8 py-3 rounded-full font-semibold text-base"
              on:click={() => goToDetails({ id: slide.id, __sourceId: 'shikimori', title: slide.title, image: slide.image, description: slide.description })}>
              Смотреть
            </button>
          </div>
        </div>
      {/each}
    </div>
    
    <!-- Progress bar at bottom -->
          <div class="absolute bottom-0 left-0 w-full h-1" style="background: rgba(255,255,255,0.20)">
            <div class="h-full transition-all duration-100" style="width: {progress}%; background: linear-gradient(90deg,#22d3ee,#6366f1)"></div>
    </div>
    
    <!-- Navigation dots -->
    <div class="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-3">
      {#each slidesEffective as _, i}
        <button
          class="w-3 h-3 rounded-full transition-all duration-300 {currentSlide === i ? 'bg-white' : 'bg-white/40'}"
          on:click={() => goToSlide(i)}>
        </button>
      {/each}
    </div>
    
    <!-- Arrow navigation -->
    <button 
      class="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/80 hover:text-white text-2xl transition-colors"
      on:click={() => {
        currentSlide = currentSlide === 0 ? slidesEffective.length - 1 : currentSlide - 1;
        timeLeft = 7;
      }}>
      ‹
    </button>
    <button 
      class="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/80 hover:text-white text-2xl transition-colors"
      on:click={() => {
        currentSlide = (currentSlide + 1) % slidesEffective.length;
        timeLeft = 7;
      }}>
      ›
    </button>
  </div>

  <!-- Рекомендуем сейчас (перенесено вместо «Сейчас смотрят») -->
  <div class="mt-6">
    <div class="flex justify-between items-center mb-4">
      <div class="flex items-center gap-2">
        <h2 class="text-xl font-bold text-white mr-1 select-none">Рекомендации</h2>
        <button
          class="w-8 h-8 rounded-xl flex items-center justify-center text-white/85 bg-white/10 hover:bg-white/20 active:scale-95 transition disabled:opacity-40 disabled:cursor-default"
          title="Листать влево"
          disabled={!canRecsLeft}
          on:click={() => scrollRecs(-1)}>‹</button>
        <button
          class="w-8 h-8 rounded-xl flex items-center justify-center text-white/85 bg-white/10 hover:bg-white/20 active:scale-95 transition disabled:opacity-40 disabled:cursor-default"
          title="Листать вправо"
          disabled={!canRecsRight}
          on:click={() => scrollRecs(1)}>›</button>
      </div>
      <div class="flex items-center gap-3">
        <button class="text-pink-200 hover:text-white transition-colors" title="Обновить рекомендации" on:click={loadRecs}>⟲</button>
      </div>
    </div>
    {#if recsLoading}
      <div class="text-white/80">Загрузка…</div>
    {:else if recsError}
      <div class="flex items-center gap-3 text-white/90">
        <span>{recsError}</span>
        <button class="bg-pink-700/95 text-white px-3 py-1.5 rounded-full font-semibold hover:bg-pink-600" on:click={loadRecs}>Повторить</button>
      </div>
    {:else}
      <div class="relative">
        <div class="overflow-hidden py-4" bind:this={recsViewportEl}>
          <div class="flex items-center gap-4 will-change-transform"
               bind:this={recsTrackEl}
               style="transform: translateX(-{recsOffsetPx}px); transition: transform 350ms ease;">
            {#each recsPadded as item}
              <div class="rec-card group relative rounded-xl cursor-pointer flex-shrink-0 card-frame overflow-hidden"
                   style="width:{recsCardW}px; min-width:{recsCardW}px; max-width:{recsCardW}px; height:{recsCardH}px; {item ? '' : 'opacity:0; pointer-events:none;'}"
                   on:click={() => item && openRecommendation(item)}>
                {#if item && item.image}
                  <img src={item.image} alt={item.title} class="absolute inset-0 h-full w-full object-cover transition-transform duration-200" loading="lazy" on:mouseenter={(e)=> e.currentTarget.style.transform='scale(1.05)'} on:mouseleave={(e)=> e.currentTarget.style.transform=''} />
                {:else}
                  <div class="absolute inset-0 bg-black/30"></div>
                {/if}
                <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent"></div>
                <div class="absolute bottom-2 left-2 right-2 transition-opacity duration-150 group-hover:opacity-0">
                  <h3 class="text-white font-semibold text-sm drop-shadow" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                    {item ? item.title : ''}
                  </h3>
                </div>
                <!-- Hover info overlay -->
                <div class="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col justify-between p-2">
                  <!-- top badge with episodes aired -->
                  <div class="flex">
                    {#if item?.episodesAired || item?.episodes}
                      <div class="px-2 py-1 rounded-full text-[11px] font-semibold text-white/95" style="background: rgba(255,255,255,0.18); backdrop-filter: blur(6px); border: 1px solid rgba(255,255,255,0.25)">
                        {(item?.episodesAired || item?.episodes)} эпизод{(item?.episodesAired || item?.episodes) % 10 === 1 && (item?.episodesAired || item?.episodes) % 100 !== 11 ? '' : 'ов'}
                      </div>
                    {/if}
                  </div>
                  <!-- center title -->
                  <div class="px-1">
                    <h3 class="text-white font-extrabold text-base text-center drop-shadow" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">
                      {item ? item.title : ''}
                    </h3>
                  </div>
                  <!-- bottom meta row -->
                  <div class="text-white text-[11px] space-y-1">
                    <div class="flex items-center gap-2 opacity-90">
                      {#if item?.year}
                        <span>{item.year}</span>
                      {/if}
                      {#if item?.startDate}
                        <span>• {new Date(item.startDate).toLocaleString('ru-RU', { month: 'long' }).replace(/^[а-я]/, m=>m.toUpperCase())}</span>
                      {/if}
                      {#if item?.kind}
                        <span>• {item.kind.toUpperCase()}</span>
                      {/if}
                      {#if item?.rating}
                        <span>• {item.rating.toUpperCase()}</span>
                      {/if}
                    </div>
                    <div class="text-white/85 text-[11px]" style="display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;">
                      {#if item?.genres?.length}
                        {item.genres.slice(0, 3).join(' • ')}
                      {/if}
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
        <!-- Убрали боковые стрелки, теперь управление у заголовка -->
      </div>
    {/if}
  </div>

  <!-- Now Playing -->
  <div class="mt-6">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold text-white">Сейчас на экранах</h2>
      <button class="text-pink-200 hover:text-white transition-colors">→</button>
    </div>
    <div class="grid grid-cols-4 gap-6">
      {#each Array(4) as _, i}
        <div class="bg-pink-900/50 rounded-xl hover:scale-105 transition-transform cursor-pointer backdrop-blur-sm h-[144px] glass-frame"
          on:click={() => alert('Фильм на экранах ' + (i+1))}></div>
      {/each}
    </div>
  </div>

  <!-- New Releases -->
  <div class="mt-6">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold text-white">Новые релизы</h2>
      <button class="text-pink-200 hover:text-white transition-colors">→</button>
    </div>
    <div class="grid grid-cols-4 gap-6">
      {#each newReleases as item, i}
        <div class="bg-pink-900/50 rounded-xl hover:scale-105 transition-transform cursor-pointer backdrop-blur-sm relative h-[144px] glass-frame"
          on:click={() => alert('Новый релиз ' + (i+1))}>
          <div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent rounded-b-xl">
            <h3 class="text-white font-semibold">{item.title}</h3>
          </div>
        </div>
      {/each}
    </div>
  </div>

  

  <!-- Popular Content Horizontal Slider -->
    <div class="mt-6 mb-8">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold text-white">Популярное</h2>
      <button class="text-pink-200 hover:text-white transition-colors">
        →
      </button>
    </div>
    <div class="grid grid-cols-4 gap-6">
      {#each popularContent as item, i}
        <div class="bg-pink-900/50 rounded-xl h-48 hover:scale-105 transition-transform cursor-pointer backdrop-blur-sm relative glass-frame"
          on:click={() => alert('Популярное ' + (i+1))}>
          <!-- Content info overlay -->
          <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent rounded-b-xl">
            <h3 class="text-white font-semibold text-lg">{item.title}</h3>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-pink-300 text-sm font-medium">★ {item.rating}</span>
              <span class="text-white/60 text-sm">{item.year}</span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Топ недели -->
  <div class="mt-6 mb-10">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold text-white">Топ недели</h2>
      <button class="text-pink-200 hover:text-white transition-colors">→</button>
    </div>
    <div class="grid grid-cols-4 gap-6">
      {#each topWeek as item, i}
        <div class="bg-pink-900/50 rounded-xl hover:scale-105 transition-transform cursor-pointer backdrop-blur-sm relative h-[138px] glass-frame"
          on:click={() => alert('Топ недели ' + (i+1))}>
          <div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent rounded-b-xl">
            <h3 class="text-white font-semibold text-sm truncate">{item.title}</h3>
            <span class="text-pink-300 text-xs">★ {item.rating}</span>
          </div>
        </div>
      {/each}
    </div>
  </div>
  {:else if $activeView === 'search'}
  <!-- Search View -->
  <div class="mt-2">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold text-white">Результаты поиска</h2>
    </div>
    {#if $isSearching}
      <div class="text-white/80">Идёт поиск…</div>
    {:else if $searchResults.length}
      <div class="grid grid-cols-5 gap-6">
        {#each $searchResults as item}
          <div class="bg-pink-900/50 rounded-xl hover:scale-105 transition-transform cursor-pointer backdrop-blur-sm relative w-[204px] h-[240px] overflow-hidden"
               on:click={() => goToDetails({ id: item.id, __sourceId: item.__sourceId, title: item.title, image: item.image })}>
            {#if item.image}
              <img src={item.image} alt={item.title} class="absolute inset-0 w-full h-full object-cover opacity-90" loading="lazy" />
            {/if}
            {#if watchedIds.has(item.id) || wishIds.has(item.id) || droppedIds.has(item.id)}
              <div class="absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-semibold"
                   style="background: rgba(255,255,255,0.95); color: #111;">
                {#if watchedIds.has(item.id)}✓{/if}
                {#if wishIds.has(item.id)}☆{/if}
                {#if droppedIds.has(item.id)}⊘{/if}
              </div>
            {/if}
            {#if ratingMap[item.id]}
              <div class="absolute top-2 right-2 translate-y-9 rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold"
                   style="background: rgba(255,255,255,0.95); color: #8e2a8e;">
                {ratingMap[item.id]}
              </div>
            {/if}
            <button class="absolute top-2 right-2 rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-white/90"
                    style="background: {favoriteIds.has(item.id) ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)'}; color: {favoriteIds.has(item.id) ? '#c026d3' : '#8e2a8e'};"
                    title={favoriteIds.has(item.id) ? 'Убрать из избранного' : 'В избранное'}
                    on:click|stopPropagation={() => toggleFav(item)}>{favoriteIds.has(item.id) ? '❤' : '♡'}</button>
            <div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent rounded-b-xl">
              <h3 class="text-white font-semibold text-sm truncate">{item.title}</h3>
              <div class="flex items-center gap-2 text-xs">
                {#if item.score}
                  <span class="text-pink-300">★ {item.score}</span>
                {/if}
                {#if item.year}
                  <span class="text-white/70">{item.year}</span>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="text-white/60">Нет результатов. Измените запрос.</div>
    {/if}
  </div>
  {:else if $activeView === 'details'}
  <!-- Details View -->
  <DetailsView />
  {:else if $activeView === 'profile'}
  <ProfileView />
  {:else if $activeView === 'admin'}
  <AdminPanel />
  {:else if $activeView === 'lists'}
  <ListsView />
  {:else if $activeView === 'messages'}
  {#if $currentUser}
    <MessagesView />
  {:else}
    <div class="text-white/80 mt-4">Войдите, чтобы просматривать сообщения.</div>
  {/if}
  {:else if $activeView === 'catalog'}
  <CatalogView />
  {:else if $activeView === 'guessAnime'}
  <GuessAnimeView />
  {/if}
</div>