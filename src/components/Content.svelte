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
  import AdminQuizPanel from './AdminQuizPanel.svelte';
  import { availableQuizDates, refreshQuizDates } from '../stores/quizzes';
  import { userStats, loadUserStats } from '../stores/stats';
  import { leaderboard, leaderboardPeriod, refreshLeaderboard } from '../stores/leaderboard';
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
  
  onMount(async () => {
    refreshQuizDates();
    await refreshLeaderboard($leaderboardPeriod);
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
  
  // No-op mounts for quizzes home
</script>

  <div class="aniguessr-layout">
  {#if $activeView === 'home' || $activeView === 'aniquiz'}
    <div class="main-container">
      <!-- Left: Quiz cards -->
      <div class="quiz-cards-section">
        <h1 class="main-title">otakuz.fun</h1>
        
        <div class="quiz-cards">
          <button class="quiz-card" on:click={() => { console.log('[Content] GoTo GuessAnime'); activeView.set('guessAnime'); }}>
            <div class="card-content">
              <h3 class="card-title">Угадай аниме по случайным кадрам</h3>
            </div>
          </button>
          
          <button class="quiz-card" on:click={() => { console.log('[Content] GoTo GuessCharacter'); activeView.set('guessCharacter'); }}>
            <div class="card-content">
              <h3 class="card-title">Угадай персонажа по силуэту</h3>
            </div>
          </button>
          
          <button class="quiz-card" on:click={() => { console.log('[Content] GoTo GuessOpening'); activeView.set('guessOpening'); }}>
            <div class="card-content">
              <h3 class="card-title">Угадай аниме по опенингу</h3>
            </div>
          </button>
        </div>
        
        <button class="replay-btn-new" on:click={openReplay}>
          <span class="replay-icon">↺</span>
          ПОВТОРИТЬ ПРЕДЫДУЩИЕ ДНИ
        </button>
      </div>
      
      <!-- Right sidebar: Leaderboard -->
      <aside class="leaderboard-sidebar">
        <div class="lb-header">
          <h2 class="lb-title">ЛИДЕРБОРД</h2>
          {#if $userStats?.data}
            <span class="streak-badge">🔥 {$userStats.data.currentStreak}</span>
          {/if}
        </div>
        
        <div class="lb-tabs-new">
          <button class="lb-tab-new {$leaderboardPeriod==='day'?'active':''}" on:click={() => { leaderboardPeriod.set('day'); refreshLeaderboard('day'); }}>
            CURRENT STREAK
          </button>
          <button class="lb-tab-new {$leaderboardPeriod==='week'?'active':''}" on:click={() => { leaderboardPeriod.set('week'); refreshLeaderboard('week'); }}>
            BEST STREAK
          </button>
          <button class="lb-tab-new {$leaderboardPeriod==='all'?'active':''}" on:click={() => { leaderboardPeriod.set('all'); refreshLeaderboard('all'); }}>
            MOST ACTIVE
          </button>
        </div>
        
        <div class="lb-list">
          {#each $leaderboard as r, idx}
            <div class="lb-item {r.highlight ? 'top-three' : ''}">
              <div class="lb-position">{idx + 1}</div>
              <div class="lb-avatar">
                <div class="avatar-placeholder"></div>
              </div>
              <div class="lb-info">
                <div class="lb-username">{r.name}</div>
                <div class="lb-score">{r.days?.toLocaleString() || 0} очков</div>
              </div>
            </div>
          {/each}
        </div>
      </aside>
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
  {:else if $activeView === 'adminQuiz'}
  <AdminQuizPanel />
  {/if}
  <ReplayDatesModal onClose={closeReplay} bind:open={showReplay} />
</div>

<style>
  .section-title { color: var(--text); font-weight:900; letter-spacing:1.2px; margin-bottom: 12px; font-size: 18px; }


  /* Global background and text for pastel theme */
  :global(body) { background: var(--bg); color: var(--text); }
  
  /* AniGuessr-style layout */
  .aniguessr-layout {
    width: 100%;
    max-width: 1600px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }
  
  .main-container {
    display: flex;
    gap: 2rem;
    align-items: start;
    justify-content: center;
  }
  
  @media (max-width: 1200px) {
    .main-container {
      flex-direction: column;
      gap: 2rem;
    }
  }
  
  @media (max-width: 768px) {
    .aniguessr-layout {
      padding: 1rem 0.75rem;
    }
    
    .main-container {
      gap: 1.5rem;
    }
  }
  
  /* Quiz cards section */
  .quiz-cards-section {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  
  .main-title {
    font-size: clamp(2.5rem, 5vw, 4rem);
    font-weight: 900;
    text-align: center;
    color: var(--text);
    letter-spacing: 0.02em;
    margin-bottom: 1rem;
  }
  
  .quiz-cards {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  @media (max-width: 768px) {
    .main-title {
      font-size: clamp(2rem, 8vw, 2.5rem);
      margin-bottom: 0.75rem;
    }
    
    .quiz-cards {
      gap: 1rem;
    }
  }
  
  .quiz-card {
    position: relative;
    background: var(--panelStrong);
    border: none;
    border-radius: 20px;
    padding: 2.5rem 2rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(91, 117, 83, 0.12);
    max-width: 600px;
    width: 100%;
  }
  
  .quiz-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(91, 117, 83, 0.18);
  }
  
  .quiz-card:active {
    transform: translateY(-2px) scale(0.98);
  }
  
  @media (max-width: 768px) {
    .quiz-card {
      padding: 2rem 1.5rem;
    }
    
    .quiz-card:hover {
      transform: translateY(-2px);
    }
  }
  
  .card-content {
    position: relative;
    z-index: 1;
    text-align: center;
  }
  
  .card-title {
    font-size: clamp(1.1rem, 2.5vw, 1.4rem);
    font-weight: 700;
    color: var(--text);
    letter-spacing: 0.01em;
    line-height: 1.4;
  }
  
  @media (max-width: 768px) {
    .card-title {
      font-size: clamp(1rem, 4vw, 1.2rem);
    }
  }
  
  .replay-btn-new {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1rem 2rem;
    background: var(--extra);
    border: none;
    border-radius: 16px;
    color: #FFFFFF;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    margin: 0;
    box-shadow: 0 4px 12px rgba(139, 164, 127, 0.25);
    max-width: 600px;
    width: 100%;
  }
  
  .replay-btn-new:hover {
    background: var(--accent2);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(107, 138, 98, 0.3);
  }
  
  .replay-btn-new:active {
    transform: scale(0.96);
  }
  
  @media (max-width: 768px) {
    .replay-btn-new {
      padding: 0.875rem 1.5rem;
      font-size: 0.9rem;
      width: 100%;
      max-width: 350px;
    }
  }
  
  .replay-icon {
    font-size: 1.5rem;
    animation: rotate 2s linear infinite;
  }
  
  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  /* Leaderboard sidebar */
  .leaderboard-sidebar {
    background: var(--panelStrong);
    border: none;
    border-radius: 20px;
    padding: 1.5rem;
    position: sticky;
    top: 2rem;
    box-shadow: 0 4px 12px rgba(91, 117, 83, 0.12);
    margin-top: calc((clamp(2.5rem, 5vw, 4rem) + 3rem) * 1.2);
  }
  
  @media (max-width: 768px) {
    .leaderboard-sidebar {
      padding: 1rem;
      position: static;
      margin-top: 0;
    }
  }
  
  .lb-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  
  .lb-title {
    font-size: 1rem;
    font-weight: 800;
    color: var(--text);
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }
  
  .streak-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.8rem;
    background: rgba(162, 57, 202, 0.15);
    border: 1px solid rgba(162, 57, 202, 0.4);
    border-radius: 12px;
    font-weight: 800;
    font-size: 0.9rem;
  }
  
  @media (max-width: 768px) {
    .lb-title {
      font-size: 0.9rem;
    }
    
    .streak-badge {
      font-size: 0.8rem;
      padding: 0.3rem 0.6rem;
    }
  }
  
  .lb-tabs-new {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  
  .lb-tab-new {
    flex: 1;
    padding: 0.5rem 0.6rem;
    background: var(--panel);
    border: none;
    border-radius: 12px;
    color: var(--muted);
    font-weight: 600;
    font-size: 0.65rem;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
    text-transform: uppercase;
  }
  
  .lb-tab-new:hover {
    background: var(--extra);
    color: #FFFFFF;
  }
  
  .lb-tab-new.active {
    background: var(--accent);
    color: #FFFFFF;
  }
  
  @media (max-width: 768px) {
    .lb-tab-new {
      font-size: 0.6rem;
      padding: 0.4rem 0.5rem;
    }
  }
  
  .lb-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 600px;
    overflow-y: auto;
    overflow-x: hidden;
  }
  
  /* Hide scrollbar */
  .lb-list::-webkit-scrollbar {
    display: none;
  }
  
  .lb-list {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  .lb-item {
    display: grid;
    grid-template-columns: 32px 36px 1fr;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem;
    background: var(--panel);
    border: none;
    border-radius: 12px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .lb-item:hover {
    background: rgba(139, 164, 127, 0.15);
    transform: translateX(2px);
  }
  
  .lb-item.top-three {
    background: rgba(139, 164, 127, 0.2);
  }
  
  .lb-position {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--panel);
    border-radius: 8px;
    font-weight: 800;
    color: var(--accent);
    font-size: 0.85rem;
  }
  
  .lb-item.top-three .lb-position {
    background: var(--accent);
    color: #FFFFFF;
  }
  
  .lb-avatar {
    width: 36px;
    height: 36px;
  }
  
  .avatar-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    border-radius: 50%;
    border: 2px solid rgba(91, 117, 83, 0.3);
  }
  
  .lb-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }
  
  .lb-username {
    font-weight: 700;
    color: var(--text);
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .lb-score {
    font-size: 0.75rem;
    color: var(--accent);
    font-weight: 600;
  }
</style>