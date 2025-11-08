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
  import BattlePackSelector from './BattlePackSelector.svelte';
  import AdminQuizPanel from './AdminQuizPanel.svelte';
  import { availableQuizDates, refreshQuizDates } from '../stores/quizzes';
  import { userStats, loadUserStats } from '../stores/stats';
  import { leaderboard, leaderboardPeriod, refreshLeaderboard } from '../stores/leaderboard';
  import ReplayDatesModal from './ReplayDatesModal.svelte';

  // Quizzes-first app: remove anime viewing and banners; home shows quiz menu.
  
  // Keep search view for future quiz search (placeholder)
  
  onMount(async () => {
    refreshQuizDates();
    await refreshLeaderboard($leaderboardPeriod);
    loadUserStats();
  });
  let showReplay = false;

const modeCards = [
  {
    title: 'УГАДАЙ АНИМЕ',
    subtitle: 'Проверь знание сюжетов',
    emoji: '🎧',
    background: 'linear-gradient(140deg, #F6F9FF 0%, #E8F1FF 100%)',
    action: () => activeView.set('guessAnime')
  },
  {
    title: 'УГАДАЙ ПЕРСОНАЖА',
    subtitle: 'Узнай героя по описанию',
    emoji: '⚔️',
    background: 'linear-gradient(140deg, #FFF4ED 0%, #FFE1D5 100%)',
    action: () => activeView.set('guessCharacter')
  },
  {
    title: 'УГАДАЙ ОПЕНИНГ',
    subtitle: 'Угадай музыку за секунды',
    emoji: '🎵',
    background: 'linear-gradient(140deg, #FFE9F5 0%, #FFDFF0 100%)',
    action: () => activeView.set('guessOpening')
  }
];

const startGame = () => {
  activeView.set('guessOpening');
};

const goToHome = () => {
  activeView.set('home');
};

const goToLeaderboard = () => {
  activeView.set('aniquiz');
};

const goToProfile = () => {
  activeView.set('profile');
};

$: achievementsToday = $userStats?.data?.achievementsToday ?? 24;
$: playersToday = $userStats?.data?.playersToday ?? 3456;
  
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

    <div class="animeguess-home">
      <header class="ag-header">
        <button class="ag-brand" on:click={goToHome}>
          <span class="ag-brand-icon">🍥</span>
          <span class="ag-brand-name">AnimeGuess!</span>
        </button>
        <nav class="ag-nav">
          <button class="ag-nav-item {($activeView === 'home' || $activeView === 'aniquiz') ? 'active' : ''}" on:click={goToHome}>
            <span class="ag-nav-icon">🏠</span>
            <span>Главная</span>
          </button>
          <button class="ag-nav-item {$activeView === 'guessAnime' ? 'active' : ''}" on:click={() => activeView.set('guessAnime')}>
            <span class="ag-nav-icon">🍿</span>
            <span>Угадай аниме</span>
          </button>
          <button class="ag-nav-item" on:click={openReplay}>
            <span class="ag-nav-icon">📅</span>
            <span>Повторы</span>
          </button>
          <button class="ag-nav-item {$activeView === 'aniquiz' ? 'active' : ''}" on:click={goToLeaderboard}>
            <span class="ag-nav-icon">👑</span>
            <span>Лидерборд</span>
          </button>
        </nav>
      </header>

      <main class="ag-card">
        <div class="ag-hero">
          <div class="ag-hero-copy">
            <h1>Угадай как можно больше опенингов и соревнуйся с друзьями!</h1>
            <p>Весёлые задания, милый интерфейс и ежедневные достижения ждут тебя.</p>
          </div>
          <button class="ag-start-btn" on:click={startGame}>Начать игру</button>
        </div>

        <div class="ag-mode-grid">
          {#each modeCards as mode (mode.title)}
            <button class="ag-mode-card" style={`background:${mode.background};`} on:click={mode.action}>
              <div class="ag-mode-icon"><span>{mode.emoji}</span></div>
              <h3 class="ag-mode-title">{mode.title}</h3>
              <p class="ag-mode-subtitle">{mode.subtitle}</p>
            </button>
          {/each}
        </div>

        <div class="ag-footer">
          <div class="ag-stats">
            <div class="ag-stat-block">
              <span class="ag-stat-label">Достижения дня</span>
              <span class="ag-stat-value">{achievementsToday}</span>
            </div>
            <span class="ag-stat-caption">{playersToday.toLocaleString()} пользователей сегодня</span>
          </div>
          <button class="ag-secondary-btn" on:click={goToProfile}>Войти / Регистрация</button>
        </div>
      </main>
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
            {:else if $activeView === 'guessBattle'}
            <BattlePackSelector />
  {:else if $activeView === 'adminQuiz'}
  <AdminQuizPanel />
  {/if}
  <ReplayDatesModal onClose={closeReplay} bind:open={showReplay} />
</div>

<style>
  :global(body) {
    background: linear-gradient(180deg, #fff5f7 0%, #ffeef8 100%);
    color: #695d76;
    font-family: 'Inter', 'SF Pro Display', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .aniguessr-layout {
    width: 100%;
    max-width: 960px;
    margin: 0 auto;
    padding: 2rem 1.5rem 3rem;
    display: flex;
    justify-content: center;
  }

  .animeguess-home {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  .ag-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.75rem;
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.72);
    box-shadow: 0 26px 56px rgba(255, 176, 210, 0.28);
    backdrop-filter: blur(14px);
  }

  .ag-brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: none;
    border: none;
    cursor: pointer;
    color: #ff72ac;
    font-size: 1.6rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    padding: 0;
  }

  .ag-brand:focus-visible {
    outline: 2px solid rgba(255, 115, 174, 0.4);
    outline-offset: 4px;
  }

  .ag-brand-icon {
    font-size: 1.9rem;
  }

  .ag-nav {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .ag-nav-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: none;
    border-radius: 18px;
    padding: 0.65rem 1.05rem;
    font-weight: 600;
    font-size: 0.95rem;
    color: #8d7a9c;
    background: transparent;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
  }

  .ag-nav-item:focus-visible {
    outline: 2px solid rgba(255, 118, 186, 0.4);
    outline-offset: 3px;
  }

  .ag-nav-icon {
    font-size: 1.1rem;
  }

  .ag-nav-item:hover {
    background: rgba(255, 176, 211, 0.22);
    color: #ff6ea2;
    transform: translateY(-1px);
  }

  .ag-nav-item.active {
    background: linear-gradient(130deg, #ff92c2 0%, #ff78b4 100%);
    color: #fff;
    box-shadow: 0 20px 38px rgba(255, 138, 195, 0.4);
  }

  .ag-card {
    background: #ffffff;
    border-radius: 36px;
    padding: 2.75rem 2.5rem;
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
    box-shadow: 0 30px 70px rgba(255, 189, 218, 0.28);
  }

  .ag-hero {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .ag-hero-copy h1 {
    margin: 0;
    font-size: 2.05rem;
    font-weight: 800;
    color: #574663;
    line-height: 1.25;
  }

  .ag-hero-copy p {
    margin: 0;
    color: rgba(87, 70, 99, 0.72);
    font-size: 1rem;
    line-height: 1.6;
    max-width: 420px;
  }

  .ag-start-btn {
    align-self: flex-start;
    border: none;
    border-radius: 999px;
    padding: 1rem 3rem;
    font-size: 1.05rem;
    font-weight: 700;
    color: #fff;
    background: linear-gradient(135deg, #ff8bbc 0%, #ff71a7 100%);
    box-shadow: 0 24px 48px rgba(255, 127, 186, 0.42);
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .ag-start-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 28px 52px rgba(255, 118, 178, 0.45);
  }

  .ag-start-btn:active {
    transform: translateY(-1px);
  }

  .ag-mode-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1.5rem;
  }

  .ag-mode-card {
    border: none;
    border-radius: 26px;
    padding: 1.8rem 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: #574663;
    text-align: center;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .ag-mode-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 20px 36px rgba(173, 152, 255, 0.22);
  }

  .ag-mode-icon {
    width: 86px;
    height: 86px;
    border-radius: 30px;
    background: rgba(255, 255, 255, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.1rem;
    box-shadow: 0 14px 28px rgba(0, 0, 0, 0.08);
  }

  .ag-mode-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 800;
    letter-spacing: 0.06em;
  }

  .ag-mode-subtitle {
    margin: 0;
    font-size: 0.85rem;
    color: rgba(87, 70, 99, 0.65);
  }

  .ag-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
    flex-wrap: wrap;
  }

  .ag-stats {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    background: rgba(255, 245, 250, 0.95);
    padding: 1rem 1.7rem;
    border-radius: 22px;
    box-shadow: 0 16px 30px rgba(255, 197, 220, 0.25);
  }

  .ag-stat-block {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .ag-stat-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: rgba(87, 70, 99, 0.62);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .ag-stat-value {
    font-size: 1.7rem;
    font-weight: 800;
    color: #ff74ad;
    line-height: 1.1;
  }

  .ag-stat-caption {
    font-size: 0.85rem;
    color: rgba(87, 70, 99, 0.62);
  }

  .ag-secondary-btn {
    border: none;
    border-radius: 18px;
    padding: 0.9rem 1.9rem;
    background: linear-gradient(135deg, #9fceff 0%, #6caeff 100%);
    color: #fff;
    font-weight: 700;
    font-size: 0.95rem;
    box-shadow: 0 18px 36px rgba(111, 174, 255, 0.32);
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .ag-secondary-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 22px 40px rgba(111, 174, 255, 0.36);
  }

  .ag-secondary-btn:active {
    transform: translateY(-1px);
  }

  @media (max-width: 900px) {
    .ag-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .ag-card {
      padding: 2.2rem 1.8rem;
    }

    .ag-hero-copy h1 {
      font-size: 1.8rem;
    }
  }

  @media (max-width: 640px) {
    .aniguessr-layout {
      padding: 1.5rem 1rem 2.5rem;
    }

    .ag-card {
      padding: 1.8rem 1.25rem;
      gap: 2rem;
    }

    .ag-mode-grid {
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }

    .ag-footer {
      flex-direction: column;
      align-items: stretch;
    }

    .ag-stats {
      width: 100%;
      justify-content: space-between;
    }

    .ag-secondary-btn,
    .ag-start-btn {
      width: 100%;
      text-align: center;
    }
  }
</style>