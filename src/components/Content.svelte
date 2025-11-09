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
  import { currentUser } from '../stores/authApi';

  // Quizzes-first app: remove anime viewing and banners; home shows quiz menu.
  
  // Keep search view for future quiz search (placeholder)
  
onMount(async () => {
  refreshQuizDates();
  await refreshLeaderboard($leaderboardPeriod);
  loadUserStats();
});
let showReplay = false;

const goToHome = () => activeView.set('home');
const goToProfile = () => activeView.set('profile');

const adminMenuItem = {
  icon: '🛠️',
  label: 'Админ панель',
  action: () => activeView.set('adminQuiz')
};

const authMenuItem = {
  icon: '🔐',
  label: 'Войти / Регистрация',
  action: () => goToProfile()
};

const baseMenuItems = [
  { icon: '🍿', label: 'Угадай аниме', action: () => activeView.set('guessAnime') },
  { icon: '📅', label: 'Повторы', action: () => openReplay() },
  { icon: '👑', label: 'Лидерборд', action: () => activeView.set('aniquiz') },
  authMenuItem
];

$: isAdmin = $currentUser?.role === 'admin' || $currentUser?.is_admin === 1 || $currentUser?.isAdmin === true;
let menuItems = baseMenuItems;
$: menuItems = isAdmin
  ? [baseMenuItems[0], adminMenuItem, ...baseMenuItems.slice(1)]
  : baseMenuItems;

const gameCards = [
  {
    title: 'Угадай аниме',
    description: 'Узнай тайтл по короткой подсказке',
    accent: '#ff93c1',
    background: 'linear-gradient(180deg, #dcebff 0%, #eff5ff 100%)',
    emoji: '🎧',
    action: () => activeView.set('guessAnime')
  },
  {
    title: 'Угадай персонажа',
    description: 'Отгадай героя по внешности',
    accent: '#ffa17a',
    background: 'linear-gradient(180deg, #fff2ea 0%, #ffe7da 100%)',
    emoji: '🗡️',
    action: () => activeView.set('guessCharacter')
  },
  {
    title: 'Угадай опенинг',
    description: 'Соревнуйся в скорости угадывания',
    accent: '#ff96d6',
    background: 'linear-gradient(180deg, #ffe6f4 0%, #ffd8ee 100%)',
    emoji: '🎵',
    action: () => activeView.set('guessOpening')
  }
];

const startGame = () => activeView.set('guessOpening');

$: achievementsToday = $userStats?.data?.achievementsToday ?? 3456;
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

  <div class="animeguess-page">
  {#if $activeView === 'home' || $activeView === 'aniquiz'}

    <header class="hero-header">
      <div class="hero-logo">
        <button class="home-button" on:click={goToHome} aria-label="Главная">
          <span>🏠</span>
        </button>
        <div class="hero-title">AnimeGuess!</div>
      </div>
      <nav class="hero-nav">
        {#each menuItems as item (item.label)}
          <button class="hero-nav-item" on:click={item.action}>
            <span class="hero-nav-icon">{item.icon}</span>
            <span class="hero-nav-label">{item.label}</span>
          </button>
        {/each}
      </nav>
    </header>

    <main class="hero-main">
      <section class="hero-banner">
        <div class="start-group">
          <button class="start-button" on:click={startGame}>Начать игру</button>
          <div class="start-caption">Попробуй ежедневные задания и обновляй рекорды!</div>
        </div>
        <p class="hero-description">
          Угадай как можно больше опенингов и соревнуйся с друзьями в ежедневных заданиях!
        </p>
      </section>

      <section class="mode-cards">
        {#each gameCards as card (card.title)}
          <button class="mode-card" style={`background:${card.background};`} on:click={card.action}>
            <div class="mode-avatar" style={`color:${card.accent}`}>
              <span>{card.emoji}</span>
            </div>
            <span class="mode-label">{card.title}</span>
            <span class="mode-description">{card.description}</span>
          </button>
        {/each}
      </section>
    </main>

    <footer class="hero-footer">
      <div class="hero-achievements">
        <span class="hero-achievements-title">Достижения дня</span>
        <span class="hero-achievements-value">{achievementsToday.toLocaleString()}</span>
        <span class="hero-achievements-meta">{playersToday.toLocaleString()} пользователей сегодня</span>
      </div>
    </footer>
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
  :global(html, body, #app) {
    height: 100%;
    min-height: 100vh;
    margin: 0;
    background: linear-gradient(180deg, #fff5f7 0%, #ffeef8 100%);
    color: #735f7e;
    font-family: "Inter", "SF Pro Display", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .animeguess-page {
    width: 100%;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 3rem clamp(1.5rem, 4vw, 4rem) 3.5rem;
    box-sizing: border-box;
  }

  .hero-header {
    position: sticky;
    top: clamp(1rem, 4vh, 2rem);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: min(3vw, 2.5rem);
    padding: 1.2rem 2rem;
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.78);
    backdrop-filter: blur(20px) saturation(130%);
    box-shadow: 0 24px 60px rgba(255, 158, 205, 0.28);
    margin-bottom: 2.5rem;
  }

  .hero-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3.2rem;
  }

  .hero-footer {
    margin-top: 3.2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
    padding: 1.8rem 2rem;
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.78);
    box-shadow: 0 28px 60px rgba(161, 143, 255, 0.18);
  }

  .hero-logo {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .home-button {
    width: 58px;
    height: 58px;
    border-radius: 20px;
    border: none;
    cursor: pointer;
    font-size: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #ffd6ec 0%, #ffb9df 100%);
    box-shadow: 0 18px 35px rgba(255, 158, 205, 0.35);
    color: #ff6aa3;
  }

  .home-button:focus-visible {
    outline: 2px solid rgba(255, 118, 186, 0.5);
    outline-offset: 4px;
  }

  .hero-title {
    font-size: 2.25rem;
    font-weight: 800;
    color: #ff74ad;
    letter-spacing: 0.02em;
  }

  .hero-nav {
    display: flex;
    align-items: center;
    gap: 1.3rem;
    flex-wrap: wrap;
  }

  .hero-nav-item {
    border: none;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    cursor: pointer;
    color: #8d7aa1;
    font-weight: 600;
    font-size: 0.82rem;
    letter-spacing: 0.04em;
    transition: transform 0.2s ease, color 0.2s ease;
  }

  .hero-nav-item:hover {
    color: #ff6ea2;
    transform: translateY(-2px);
  }

  .hero-nav-item:focus-visible {
    outline: 2px solid rgba(255, 118, 186, 0.4);
    outline-offset: 4px;
  }

  .hero-nav-icon {
    font-size: 1.2rem;
    background: rgba(255, 201, 229, 0.45);
    color: #ff78b4;
    padding: 0.38rem 0.62rem;
    border-radius: 999px;
  }

  .hero-banner {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 2.3rem;
  }

  .start-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .start-button {
    border: none;
    border-radius: 999px;
    background: linear-gradient(135deg, #ff8abb 0%, #ff70aa 100%);
    color: #fff;
    font-size: 1.15rem;
    font-weight: 700;
    padding: 1.15rem 3.6rem;
    box-shadow: 0 20px 50px rgba(255, 118, 178, 0.45);
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .start-button:hover {
    transform: translateY(-3px);
    box-shadow: 0 26px 54px rgba(255, 120, 180, 0.48);
  }

  .start-button:focus-visible {
    outline: 2px solid rgba(255, 182, 217, 0.55);
    outline-offset: 4px;
  }

  .start-caption {
    font-size: 0.92rem;
    font-weight: 600;
    color: rgba(90, 67, 108, 0.66);
    letter-spacing: 0.04em;
  }

  .hero-description {
    margin: 0;
    font-size: 1.01rem;
    line-height: 1.6;
    color: rgba(90, 67, 108, 0.78);
  }

  .mode-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1.6rem;
  }

  .mode-card {
    border: none;
    border-radius: 28px;
    padding: 1.9rem 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    text-align: center;
    cursor: pointer;
    box-shadow: 0 18px 36px rgba(186, 173, 255, 0.16);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .mode-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 24px 44px rgba(173, 152, 255, 0.22);
  }

  .mode-card:focus-visible {
    outline: 2px solid rgba(255, 160, 210, 0.4);
    outline-offset: 5px;
  }

  .mode-avatar {
    width: 98px;
    height: 98px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.82);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.1rem;
  }

  .mode-label {
    font-size: 0.98rem;
    font-weight: 800;
    color: #635075;
    letter-spacing: 0.05em;
  }

  .mode-description {
    font-size: 0.82rem;
    color: rgba(87, 70, 99, 0.62);
    max-width: 220px;
  }

  .hero-achievements {
    background: rgba(255, 244, 251, 0.92);
    border-radius: 22px;
    padding: 1rem 1.8rem;
    display: flex;
    align-items: center;
    gap: 1.3rem;
    box-shadow: 0 16px 32px rgba(255, 188, 215, 0.22);
  }

  .hero-achievements-title {
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(90, 72, 108, 0.6);
  }

  .hero-achievements-value {
    font-size: 1.85rem;
    font-weight: 800;
    color: #ff6ea2;
  }

  .hero-achievements-meta {
    font-size: 0.86rem;
    color: rgba(90, 72, 108, 0.58);
  }

  @media (max-width: 900px) {
    .animeguess-page {
      padding: 2.4rem clamp(1rem, 5vw, 2.2rem) 2.8rem;
    }

    .hero-header {
      flex-direction: column;
      align-items: flex-start;
      padding: 1rem 1.4rem;
      gap: 1.2rem;
    }

    .hero-main {
      gap: 2.4rem;
    }

    .hero-footer {
      flex-direction: column;
      align-items: stretch;
      padding: 1.4rem;
    }

    .hero-achievements {
      justify-content: space-between;
    }
  }

  @media (max-width: 560px) {
    .animeguess-page {
      padding: 1.8rem 1rem 2.4rem;
    }

    .hero-logo {
      width: 100%;
      justify-content: center;
    }

    .hero-header {
      align-items: center;
      text-align: center;
    }

    .hero-nav {
      width: 100%;
      justify-content: center;
      flex-wrap: wrap;
    }

    .hero-nav-item {
      flex-direction: row;
      gap: 0.4rem;
      background: rgba(255, 218, 234, 0.42);
      padding: 0.35rem 0.8rem;
      border-radius: 16px;
    }

    .hero-main {
      align-items: center;
      text-align: center;
    }

    .mode-cards {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }

    .hero-achievements {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
  }
</style>