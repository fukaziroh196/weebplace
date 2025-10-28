<script>
  import { onMount } from 'svelte';
  import { searchResults, isSearching } from '../stores/sources';
  import { activeView } from '../stores/ui';
  import ProfileView from './ProfileView.svelte';
  import AdminPanel from './AdminPanel.svelte';
  import ListsView from './ListsView.svelte';
  import MessagesView from './MessagesView.svelte';
  import CatalogView from './CatalogView.svelte';
  import GuessAnimeView from './GuessAnimeView.svelte';
  import GuessCharacterView from './GuessCharacterView.svelte';
  import GuessOpeningView from './GuessOpeningView.svelte';
  import { availableQuizDates, refreshQuizDates } from '../stores/quizzes';
  import { leaderboard as leaderboardApi } from '../lib/api';
  import { userStats, loadUserStats } from '../stores/stats';
  import ReplayDatesModal from './ReplayDatesModal.svelte';

  // Quizzes-first app: remove anime viewing and banners; home shows quiz menu.
  
  // Keep search view for future quiz search (placeholder)
  
  // Данные для горизонтального слайдера
  const popularContent = [
    { title: "Фильм 1", rating: "8.5", year: "2024" },
    { title: "Сериал 1", rating: "9.1", year: "2023" },
    { title: "Фильм 2", rating: "7.8", year: "2024" },
    { title: "Сериал 2", rating: "8.9", year: "2023" },
    { title: "Фильм 3", rating: "8.2", year: "2024" },
    { title: "Сериал 3", rating: "9.3", year: "2023" }
  ];
  
  let lbPeriod = 'all'; // 'all' | 'week' | 'day'
  async function loadLeaderboard() {
    try {
      const top = await leaderboardApi.list(20, lbPeriod);
      if (Array.isArray(top) && top.length) {
        lb = top.map((r) => ({ name: r.username, days: r.days ?? r.guesses, metric: r.metric || (lbPeriod === 'day' ? 'guesses' : 'days'), rank: r.rank || 0, highlight: r.rank <= 3 }));
      }
    } catch (_) { /* keep placeholder */ }
  }
  onMount(async () => {
    refreshQuizDates();
    await loadLeaderboard();
    loadUserStats();
  });
  let showReplay = false;
  
  function openReplay() {
    console.log('[Content] Opening replay modal, dates:', $availableQuizDates);
    showReplay = true;
  }
  function closeReplay() {
    console.log('[Content] Closing replay modal');
    showReplay = false;
  }
  let lb = [
    {name:'KsKsCollective',days:693,rank:1,highlight:true},
    {name:'nyaaia',days:663,rank:2,highlight:true},
    {name:'Hi_Leaflit_o7',days:559,rank:3,highlight:true},
    {name:'Moo',days:518,rank:4},
    {name:'Catdog1900',days:506,rank:5},
    {name:'DancoreDanny',days:504,rank:6}
  ];
  
  // No-op mounts for quizzes home
</script>

  <div class="flex flex-col w-full px-6">
  {#if $activeView === 'home' || $activeView === 'aniquiz'}
    <div class="mt-4">
      <div class="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 items-start">
        <!-- Left: quiz list -->
        <div>
          <div class="section-title">АРКАДА</div>
          <div class="stack">
            <button class="stack-item" on:click={() => { console.log('[Content] GoTo GuessAnime'); activeView.set('guessAnime'); }}>
              <div class="stack-bullet">🎯</div>
              <div>
                <div class="stack-title">Угадай аниме по случайным кадрам</div>
              </div>
            </button>
            <button class="stack-item" on:click={() => { console.log('[Content] GoTo GuessCharacter'); activeView.set('guessCharacter'); }}>
              <div class="stack-bullet">👤</div>
              <div>
                <div class="stack-title">Угадывай персонажей по портретам</div>
              </div>
            </button>
            <button class="stack-item" on:click={() => { console.log('[Content] GoTo GuessOpening'); activeView.set('guessOpening'); }}>
              <div class="stack-bullet">🎵</div>
              <div>
                <div class="stack-title">Угадай аниме по опенингу</div>
              </div>
            </button>
          </div>
          <div class="mt-5">
            <button class="replay-btn" on:click={openReplay}>↺  ПОВТОРИТЬ ПРЕДЫДУЩИЕ ДНИ</button>
          </div>
        </div>
        <!-- Right: leaderboard placeholder -->
        <div>
          <div class="section-title flex items-center justify-between">
            <span>ЛИДЕРБОРД</span>
            {#if $userStats?.data}
              <span class="streak-pill" title="Серия дней">🔥 {$userStats.data.currentStreak}</span>
            {/if}
          </div>
          <div class="lb-tabs">
            <button class="lb-tab {lbPeriod==='day'?'active':''}" on:click={() => { lbPeriod='day'; loadLeaderboard(); }}>Сегодня</button>
            <button class="lb-tab {lbPeriod==='week'?'active':''}" on:click={() => { lbPeriod='week'; loadLeaderboard(); }}>Неделя</button>
            <button class="lb-tab {lbPeriod==='all'?'active':''}" on:click={() => { lbPeriod='all'; loadLeaderboard(); }}>Всё время</button>
          </div>
          <div class="lb">
            {#each lb as r}
              <div class="lb-row {r.highlight ? 'lb-row--hot' : ''}">
                <div class="lb-rank">{r.rank}</div>
                <div class="lb-name">{r.name}</div>
                <div class="lb-days">{r.days?.toLocaleString() || 0} очков</div>
              </div>
            {/each}
          </div>
        </div>
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
          <div class="bg-pink-900/50 rounded-xl backdrop-blur-sm relative w-[204px] h-[240px] overflow-hidden">
            {#if item.image}
              <img src={item.image} alt={item.title} class="absolute inset-0 w-full h-full object-cover opacity-90" loading="lazy" />
            {/if}
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
  <!-- Details removed in quiz-only mode -->
  <div class="text-white/80 mt-4">Просмотр аниме отключён. Выберите режим в AniQuiz.</div>
  {:else if $activeView === 'profile'}
  <ProfileView />
  {:else if $activeView === 'admin'}
  <AdminPanel />
  {:else if $activeView === 'lists'}
  <ListsView />
  {:else if $activeView === 'messages'}
    <MessagesView />
  {:else if $activeView === 'catalog'}
  <CatalogView />
  {:else if $activeView === 'guessAnime'}
  <GuessAnimeView />
  {:else if $activeView === 'guessCharacter'}
  <GuessCharacterView />
  {:else if $activeView === 'guessOpening'}
  <GuessOpeningView />
  {/if}
  <ReplayDatesModal onClose={closeReplay} bind:open={showReplay} />
</div>

<style>
  :root { --bg:#FFF5FB; --accent:#FF7BAC; --accent2:#A2D2FF; --text:#2B2D42; --extra:#FFD166; }

  .quiz-card { position: relative; padding: 18px; border-radius: 16px; text-align: left; background: linear-gradient(180deg,#ffffff, #fff0f6); border: 1px solid rgba(43,45,66,.08); color: var(--text); transition: transform .15s ease, background .2s ease, box-shadow .2s; box-shadow: 0 6px 20px rgba(43,45,66,0.06); }
  .quiz-card:hover { transform: translateY(-2px); background: linear-gradient(180deg,#ffffff, #ffe9f3); box-shadow: 0 10px 24px rgba(255,123,172,.18); }
  .quiz-card--disabled { opacity: .6; cursor: not-allowed; }
  .quiz-icon { font-size: 28px; line-height: 1; margin-bottom: 8px; }
  .quiz-title { font-weight: 800; font-size: 18px; margin-bottom: 4px; color: var(--text); }
  .quiz-sub { font-size: 13px; color: rgba(43,45,66,.7); }
  .glass-frame { box-shadow: 0 8px 24px rgba(43,45,66,.08); border: 1px solid rgba(43,45,66,.08); }
  .replay-btn { display:inline-flex; align-items:center; gap:10px; padding:10px 14px; border:2px solid var(--accent); border-radius:12px; color: var(--accent); background: transparent; font-weight:800; letter-spacing:.3px; box-shadow: none; cursor: pointer; }
  .replay-btn:hover { background: rgba(255,78,136,.10); }
  .replay-btn:active { transform: scale(0.98); }

  .brand { position:relative; display:inline-block; font-size: 42px; font-weight: 900; letter-spacing: 1.2px; color: var(--text); }
  .brand-k { color: var(--accent2); }
  .brand-a { color: var(--accent); }
  .brand-underline { height: 4px; width: 200px; margin: 8px auto 0; background: linear-gradient(90deg, var(--accent2), var(--accent)); border-radius: 9999px; box-shadow: 0 0 20px rgba(255,123,172,.25) inset; }
  .section-title { color: var(--text); font-weight:900; letter-spacing:1.2px; margin-bottom: 12px; font-size: 18px; }
  .stack { display:flex; flex-direction:column; gap:14px; }
  .stack-item { display:flex; align-items:center; gap:14px; width:100%; text-align:left; padding:16px 18px; border-radius:16px; background: var(--panel); color:var(--text); border:1px solid rgba(43,45,66,.18); transition: transform .12s ease, box-shadow .15s ease, border-color .15s ease; box-shadow: 0 6px 18px rgba(43,45,66,.10); cursor: pointer; }
  .stack-item:hover { transform: translateY(-1px); border-color: var(--accent); box-shadow: 0 12px 26px rgba(162,57,202,.30); background: var(--panelStrong); }
  .stack-item:active { transform: scale(0.98); }
  .stack-title { font-weight:800; margin-bottom:4px; font-size:16px; }
  .stack-sub { color:rgba(43,45,66,.82); font-size: 13px; }
  .stack-bullet { width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:10px; background: linear-gradient(180deg, var(--accent), rgba(162,57,202,.35)); color:#0b1320; box-shadow: 0 4px 12px rgba(162,57,202,.35); }

  .lb { background: var(--panel); border:1px solid rgba(43,45,66,.20); border-radius:16px; overflow:hidden; box-shadow: 0 8px 20px rgba(43,45,66,.12); }
  .lb-row { display:grid; grid-template-columns:36px 1fr auto; align-items:center; gap:10px; padding:12px 14px; border-top:1px solid rgba(43,45,66,.16); color:var(--text); }
  .lb-row:first-child { border-top: none; }
  .lb-row:nth-child(even) { background: var(--panelStrong); }
  .lb-row--hot { background: linear-gradient(90deg, rgba(162,57,202,.14), transparent); }
  .lb-rank { width:28px; height:28px; display:flex; align-items:center; justify-content:center; background: rgba(162,57,202,.15); border-radius:8px; font-weight:800; color:var(--accent); border:1px solid rgba(162,57,202,.45); }
  .lb-tabs { display:flex; gap:8px; margin: 6px 0 10px; }
  .lb-tab { padding:6px 10px; border-radius:10px; border:1px solid rgba(162,57,202,.35); background: transparent; color: var(--text); font-weight:700; }
  .lb-tab.active, .lb-tab:hover { background: rgba(162,57,202,.16); }
  .lb-name { font-weight:700; }
  .lb-days { color:var(--accent); font-weight:800; }
  .streak-pill { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:9999px; border:1px solid rgba(162,57,202,.45); background: rgba(162,57,202,.14); color:var(--text); font-weight:800; }

  /* Global background and text for pastel theme */
  :global(body) { background: var(--bg); color: var(--text); }
</style>