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
  import { userStats, loadUserStats, loadGlobalStats, globalStats } from '../stores/stats';
  import { newsFeed, loadNews, publishNews, updateNews, deleteNews } from '../stores/news';
  import { leaderboard, leaderboardPeriod, refreshLeaderboard } from '../stores/leaderboard';
  import ReplayDatesModal from './ReplayDatesModal.svelte';
  import { currentUser } from '../stores/authApi';
  import ProfileMenu from './ProfileMenu.svelte';

  // Quizzes-first app: remove anime viewing and banners; home shows quiz menu.
  
  // Keep search view for future quiz search (placeholder)
  
let showReplay = false;
let showProfileMenu = false;
let profileButtonEl;
let profileDropdownEl;

const goToHome = () => activeView.set('home');
const goToProfile = () => activeView.set('profile');

const baseMenuItems = [
  { icon: '🍿', label: 'Угадай аниме', action: () => activeView.set('guessAnime') },
  { icon: '📅', label: 'Повторы', action: () => openReplay() },
  { icon: '👑', label: 'Лидерборд', action: () => activeView.set('aniquiz') }
];

$: isAdmin = $currentUser?.role === 'admin' || $currentUser?.is_admin === 1 || $currentUser?.isAdmin === true;
const menuItems = baseMenuItems;
const leaderboardTabs = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'all', label: 'Все' }
  ];
let currentLeaderboardPeriod = 'all';
$: currentLeaderboardPeriod = $leaderboardPeriod;

let newsDraft = '';
let newsSubmitting = false;
let newsSubmitError = '';
let newsState = { loading: false, items: [], error: '' };
let newsItems = [];
let newsLoading = false;
let newsError = '';
let newsManageError = '';
let editingNewsId = null;
let editDraft = '';
let editSubmitting = false;
let editError = '';
let deletingNewsId = null;

$: newsState = $newsFeed || { loading: false, items: [], error: '' };
$: newsItems = newsState.items || [];
$: newsLoading = newsState.loading || false;
$: newsError = newsState.error || '';
$: globalStatsState = $globalStats || { loading: false, data: {}, error: '' };
$: globalLoading = globalStatsState.loading || false;
$: globalError = globalStatsState.error || '';
$: globalTopAnime = globalStatsState.data?.mostGuessedAnime ?? [];
$: globalFastPlayers = globalStatsState.data?.fastestPlayers ?? [];
$: globalRecentModes = globalStatsState.data?.recentModes ?? [];

function changeLeaderboardPeriod(value) {
  if (currentLeaderboardPeriod === value) return;
  leaderboardPeriod.set(value);
  refreshLeaderboard(value);
  }
  
function formatLeaderboardMetric(entry) {
  if (!entry) return '';
  const value = entry.days ?? entry.guesses ?? entry.score ?? entry.value ?? 0;
  if ((entry.metric || '').toLowerCase() === 'guesses') {
    return `${value} угадываний`;
  }
  return `${value} дней`;
}

function formatNewsTimestamp(value) {
  try {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (_) {
    return '';
  }
}

async function submitNews() {
  const text = newsDraft.trim();
  if (!text || newsSubmitting) return;
  newsSubmitting = true;
  newsSubmitError = '';
  newsManageError = '';
    try {
    await publishNews(text);
    newsDraft = '';
  } catch (error) {
    newsSubmitError = error?.message || 'Не удалось опубликовать новость';
    } finally {
    newsSubmitting = false;
    }
  }

function toggleProfileMenu() {
  showProfileMenu = !showProfileMenu;
  }

function closeProfileMenu() {
  showProfileMenu = false;
  }
  
function handleClickOutside(event) {
  if (!showProfileMenu) return;
  if (profileDropdownEl && profileDropdownEl.contains(event.target)) return;
  if (profileButtonEl && profileButtonEl.contains(event.target)) return;
  showProfileMenu = false;
  }

function startEditNews(item) {
  if (!isAdmin) return;
  editingNewsId = item?.id ?? null;
  editDraft = item?.text ?? '';
  editError = '';
  newsManageError = '';
}

function cancelEditNews() {
  editingNewsId = null;
  editDraft = '';
  editError = '';
}

async function submitEditNews() {
  if (!isAdmin || !editingNewsId || editSubmitting) return;
  const payload = editDraft.trim();
  if (!payload) {
    editError = 'Текст новости не может быть пустым';
    return;
  }

  editSubmitting = true;
  editError = '';
  newsManageError = '';
  try {
    await updateNews(editingNewsId, payload);
    cancelEditNews();
  } catch (error) {
    editError = error?.message || 'Не удалось обновить новость';
    } finally {
    editSubmitting = false;
    }
  }

async function handleDeleteNews(item) {
  if (!isAdmin || deletingNewsId) return;
  const id = item?.id;
  if (!id) return;

  const confirmed =
    typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm('Удалить объявление?')
      : true;
  if (!confirmed) return;

  deletingNewsId = id;
  newsManageError = '';
  try {
    await deleteNews(id);
    if (editingNewsId === id) {
      cancelEditNews();
    }
  } catch (error) {
    newsManageError = error?.message || 'Не удалось удалить новость';
  } finally {
    deletingNewsId = null;
  }
}
  
onMount(() => {
  refreshQuizDates();
  refreshLeaderboard($leaderboardPeriod);
  loadUserStats();
  loadGlobalStats();
  loadNews();

  window.addEventListener('click', handleClickOutside);
  window.addEventListener('closeProfileMenu', closeProfileMenu);

    return () => {
    window.removeEventListener('click', handleClickOutside);
    window.removeEventListener('closeProfileMenu', closeProfileMenu);
    };
  });
  
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
  },
  {
    title: 'Аниме баттлы',
    description: 'Соревнуйся за любимый тайтл в дуэлях',
    accent: '#9b8bff',
    background: 'linear-gradient(180deg, #eae6ff 0%, #dcd1ff 100%)',
    emoji: '⚔️',
    action: () => activeView.set('guessBattle')
  }
];
  
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
        <div class="profile-nav-wrapper">
            <button
            class="profile-nav-button"
            type="button"
            bind:this={profileButtonEl}
            on:click={toggleProfileMenu}
            aria-haspopup="true"
            aria-expanded={showProfileMenu}
          >
            <span class="profile-nav-avatar">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2C6.485 2 2 6.485 2 12s4.485 10 10 10 10-4.485 10-10S17.515 2 12 2zm0 3.2a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4zm0 14.56c-2.644 0-4.984-1.355-6.4-3.424.056-2.096 4.272-3.248 6.4-3.248 2.104 0 6.344 1.152 6.4 3.248-1.416 2.069-3.756 3.424-6.4 3.424z" />
              </svg>
            </span>
            <span class="profile-nav-name">{$currentUser?.username || 'Профиль'}</span>
            </button>
          {#if showProfileMenu}
            <div class="profile-dropdown" bind:this={profileDropdownEl}>
              <ProfileMenu {isAdmin} />
          </div>
          {/if}
        </div>
      </nav>
    </header>
    
    <div class="page-layout">
      <div class="page-main">
        {#if $activeView === 'home' || $activeView === 'aniquiz'}
          <main class="hero-main">
            <div class="dashboard-row">
              <section class="admin-news-panel">
                <header class="admin-news-header">
                  <div>
                    <span class="admin-news-subtitle">Новости</span>
                    <h3 class="admin-news-title">Объявления проекта</h3>
    </div>
                  {#if isAdmin}
                    <span class="admin-news-role">Админ может публиковать</span>
                  {/if}
                </header>
                {#if isAdmin}
                  <form class="admin-news-form" on:submit|preventDefault={submitNews}>
                    <textarea
                      class="admin-news-input"
                      placeholder="Напишите объявление для игроков…"
                      bind:value={newsDraft}
                      maxlength="280"
                      rows="5"
                      disabled={newsSubmitting}
                    />
                    <div class="admin-news-actions">
                      <span class="admin-news-counter">{newsDraft.length}/280</span>
        <button
                        type="submit"
                        class="admin-news-submit"
                        disabled={!newsDraft.trim() || newsSubmitting}
                        aria-busy={newsSubmitting}
                      >
                        Опубликовать
        </button>
    </div>
                    {#if newsSubmitError}
                      <span class="admin-news-error">{newsSubmitError}</span>
                    {/if}
                  </form>
                {/if}
                {#if newsLoading}
                  <div class="admin-news-empty">Загружаем объявления…</div>
                {:else if newsError}
                  <div class="admin-news-empty admin-news-error-state">
                    Не удалось загрузить новости: {newsError}
                  </div>
                {:else if newsItems.length}
                  {#if newsManageError}
                    <div class="admin-news-empty admin-news-error-state">{newsManageError}</div>
                  {/if}
                  <ul class="admin-news-list">
                    {#each newsItems as item (item.id)}
                      <li class:news-editing={editingNewsId === item.id}>
                        {#if isAdmin && editingNewsId === item.id}
                          <textarea
                            class="admin-news-input admin-news-edit-input"
                            bind:value={editDraft}
                            maxlength="280"
                            rows="4"
                            disabled={editSubmitting}
                          />
                          <div class="admin-news-edit-meta">
                            <span class="admin-news-timestamp">{formatNewsTimestamp(item.createdAt)}</span>
                            <div class="admin-news-edit-actions">
    <button 
                                type="button"
                                class="admin-news-btn admin-news-save"
                                on:click={submitEditNews}
                                disabled={editSubmitting || !editDraft.trim()}
                                aria-busy={editSubmitting}
                              >
                                {editSubmitting ? 'Сохраняем…' : 'Сохранить'}
    </button>
    <button 
                                type="button"
                                class="admin-news-btn admin-news-cancel"
                                on:click={cancelEditNews}
                                disabled={editSubmitting}
                              >
                                Отмена
    </button>
  </div>
                          </div>
                          {#if editError}
                            <span class="admin-news-error">{editError}</span>
                          {/if}
                        {:else}
                          <p>{item.text}</p>
                          <div class="admin-news-meta">
                            <span class="admin-news-timestamp">{formatNewsTimestamp(item.createdAt)}</span>
                            {#if isAdmin}
                              <div class="admin-news-controls">
        <button
                                  type="button"
                                  class="admin-news-btn"
                                  on:click={() => startEditNews(item)}
                                >
                                  Редактировать
                                </button>
        <button
                                  type="button"
                                  class="admin-news-btn admin-news-delete"
                                  on:click={() => handleDeleteNews(item)}
                                  disabled={deletingNewsId === item.id}
                                  aria-busy={deletingNewsId === item.id}
                                >
                                  {deletingNewsId === item.id ? 'Удаляем…' : 'Удалить'}
                                </button>
      </div>
                {/if}
                      </div>
                    {/if}
                      </li>
            {/each}
                  </ul>
                {:else}
                  <div class="admin-news-empty">
                    Пока нет объявлений. {#if isAdmin}Добавьте первое сообщение.{:else}Администратор ещё ничего не опубликовал.{/if}
      </div>
    {/if}
              </section>

              <section class="mode-cards-wrapper">
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
              </section>

              <section class="global-stats-panel">
                <header class="global-stats-header">
                  <div>
                    <span class="global-stats-subtitle">Интересные факты</span>
                    <h3 class="global-stats-title">Статистика игр</h3>
    </div>
                </header>
                <div class="global-stats-content">
                  {#if globalLoading}
                    <div class="stats-empty stats-loading">Загрузка…</div>
                  {:else}
                    {#if globalError}
                      <div class="stats-empty stats-error">Не удалось загрузить статистику: {globalError}</div>
                    {/if}
                    <div class="stats-block">
                      <h4>Самые угадываемые аниме</h4>
                      {#if globalTopAnime.length}
                        <ol>
                          {#each globalTopAnime as item (item.title)}
                            <li>
                              <span class="stats-label">{item.title}</span>
                              <span class="stats-value">{item.guesses ?? item.count ?? 0}</span>
                            </li>
                          {/each}
                        </ol>
                      {:else}
                        <div class="stats-empty">Данных пока нет</div>
                      {/if}
          </div>
                    <div class="stats-block">
                      <h4>Скоростные игроки</h4>
                      {#if globalFastPlayers.length}
                        <ol>
                          {#each globalFastPlayers as item (item.userId || item.username)}
                            <li>
                              <span class="stats-label">{item.username || 'Игрок'}</span>
                              <span class="stats-value">{item.score ?? item.wins ?? 0}</span>
                            </li>
      {/each}
                        </ol>
                      {:else}
                        <div class="stats-empty">Нет победителей</div>
                      {/if}
    </div>
                    <div class="stats-block">
                      <h4>Популярные режимы</h4>
                      {#if globalRecentModes.length}
                        <ol>
                          {#each globalRecentModes as item (item.mode)}
                            <li>
                              <span class="stats-label">{item.mode}</span>
                              <span class="stats-value">{item.plays ?? item.count ?? 0}</span>
                            </li>
      {/each}
                        </ol>
                      {:else}
                        <div class="stats-empty">Статистика не собрана</div>
                      {/if}
    </div>
                  {/if}
  </div>
              </section>
            </div>
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
</div>

      <aside class="leaderboard-panel">
        <div class="leaderboard-card">
          <div class="leaderboard-header">
            <div>
              <span class="leaderboard-subtitle">Топ игроков</span>
              <h3 class="leaderboard-title">Лидерборд</h3>
            </div>
            <div class="leaderboard-tabs">
              {#each leaderboardTabs as tab}
                <button
                  class:active={currentLeaderboardPeriod === tab.value}
                  on:click={() => changeLeaderboardPeriod(tab.value)}
                >
                  {tab.label}
                </button>
              {/each}
            </div>
          </div>
          <ol class="leaderboard-list">
            {#if $leaderboard?.length}
              {#each $leaderboard as entry, idx (entry.userId ?? idx)}
                <li class:top={idx < 3}>
                  <div class="leaderboard-rank">{entry.rank ?? idx + 1}</div>
                  <div class="leaderboard-info">
                    <span class="leaderboard-name">{entry.name || entry.username || `Игрок ${entry.userId ?? ''}`}</span>
                    <span class="leaderboard-metric">{formatLeaderboardMetric(entry)}</span>
                  </div>
                </li>
              {/each}
            {:else}
              <li class="leaderboard-empty">Данных пока нет</li>
            {/if}
          </ol>
          <div class="leaderboard-footer">Обновляется ежедневно</div>
        </div>
      </aside>
    </div>

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

  .page-layout {
    display: flex;
    align-items: flex-start;
    gap: 2.8rem;
  }

  .page-main {
    flex: 1;
    min-width: 0;
    max-width: 1180px;
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
  }

  .leaderboard-panel {
    width: clamp(320px, 30vw, 420px);
    flex-shrink: 0;
    margin-left: auto;
    padding-right: clamp(0.5rem, 2vw, 1.6rem);
  }

  .leaderboard-card {
    position: sticky;
    top: calc(clamp(1rem, 4vh, 2rem) + 1.2rem);
    background: rgba(255, 255, 255, 0.82);
    border-radius: 28px;
    padding: 1.6rem 1.4rem;
    box-shadow: 0 24px 60px rgba(151, 168, 255, 0.24);
    display: flex;
    flex-direction: column;
    gap: 1.3rem;
    backdrop-filter: blur(18px);
  }

  .leaderboard-header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .leaderboard-subtitle {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: rgba(82, 72, 120, 0.55);
    font-weight: 700;
  }

  .leaderboard-title {
    margin: 0;
    font-size: 1.45rem;
    font-weight: 800;
    color: #5a4a82;
  }

  .leaderboard-tabs {
    display: inline-flex;
    padding: 0.25rem;
    border-radius: 999px;
    background: rgba(122, 108, 190, 0.12);
    gap: 0.25rem;
  }

  .leaderboard-tabs button {
    border: none;
    border-radius: 999px;
    padding: 0.42rem 0.85rem;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    cursor: pointer;
    background: transparent;
    color: rgba(76, 63, 120, 0.55);
    transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
  }

  .leaderboard-tabs button.active {
    background: linear-gradient(135deg, #a9c0ff 0%, #7f9eff 100%);
    color: #fff;
    box-shadow: 0 12px 26px rgba(125, 152, 255, 0.35);
  }

  .leaderboard-tabs button:not(.active):hover {
    color: rgba(76, 63, 120, 0.85);
  }

  .leaderboard-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .leaderboard-list li {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.7rem 0.85rem;
    border-radius: 18px;
    background: rgba(248, 249, 255, 0.75);
    box-shadow: inset 0 0 0 1px rgba(149, 168, 255, 0.12);
  }

  .leaderboard-list li.top {
    background: linear-gradient(135deg, rgba(255, 235, 246, 0.85) 0%, rgba(229, 240, 255, 0.88) 100%);
    box-shadow: inset 0 0 0 1px rgba(255, 199, 236, 0.25);
  }

  .leaderboard-rank {
    width: 40px;
    height: 40px;
    border-radius: 14px;
    background: rgba(136, 161, 255, 0.16);
    color: #6a7aff;
    font-weight: 800;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .leaderboard-list li.top .leaderboard-rank {
    background: linear-gradient(135deg, #ffdba5 0%, #ffc875 100%);
    color: #825b0d;
  }

  .leaderboard-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .leaderboard-name {
    font-weight: 700;
    color: #4e3f6f;
    font-size: 0.92rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .leaderboard-metric {
    font-size: 0.78rem;
    color: rgba(78, 63, 111, 0.6);
    letter-spacing: 0.03em;
  }

  .leaderboard-empty {
    justify-content: center;
    font-weight: 600;
    color: rgba(78, 63, 111, 0.56);
  }

  .leaderboard-footer {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: rgba(78, 63, 111, 0.42);
    font-weight: 700;
  }

  .dashboard-row {
    display: flex;
    flex-wrap: nowrap;
    gap: 1.8rem;
    align-items: flex-start;
    width: 100%;
  }

  .mode-cards-wrapper {
    flex: 1;
    min-width: 280px;
  }

  .admin-news-panel {
    width: clamp(240px, 24vw, 320px);
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.86);
    border-radius: 26px;
    padding: 1.4rem;
    box-shadow: 0 24px 58px rgba(255, 179, 214, 0.24);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    backdrop-filter: blur(18px);
  }

  .admin-news-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .admin-news-subtitle {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: rgba(122, 88, 151, 0.6);
    font-weight: 700;
  }

  .admin-news-title {
    margin: 0.25rem 0 0;
    font-size: 1.3rem;
    font-weight: 800;
    color: #7a4ba7;
  }

  .admin-news-role {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: rgba(122, 88, 151, 0.55);
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    background: rgba(239, 229, 255, 0.6);
    box-shadow: inset 0 0 0 1px rgba(130, 90, 190, 0.18);
  }

  .admin-news-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .admin-news-input {
    width: 100%;
    border: none;
    border-radius: 18px;
    padding: 0.85rem 1rem;
    background: rgba(248, 242, 255, 0.9);
    box-shadow: inset 0 0 0 1px rgba(173, 149, 255, 0.18);
    font-size: 0.9rem;
    color: #5b4a7a;
    resize: none;
  }

  .admin-news-input:focus-visible {
    outline: 2px solid rgba(149, 118, 255, 0.45);
    outline-offset: 3px;
  }

  .admin-news-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .admin-news-counter {
    font-size: 0.78rem;
    color: rgba(90, 67, 108, 0.6);
  }

  .admin-news-error {
    display: block;
    margin-top: 0.35rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: #d8587f;
  }

  .admin-news-submit {
    border: none;
    border-radius: 999px;
    padding: 0.6rem 1.4rem;
    font-size: 0.82rem;
    font-weight: 700;
    background: linear-gradient(135deg, #ff8ccc 0%, #ff6fb3 100%);
    color: #fff;
    box-shadow: 0 16px 32px rgba(255, 111, 179, 0.32);
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  }

  .admin-news-submit:disabled {
    opacity: 0.55;
    cursor: default;
    box-shadow: none;
  }

  .admin-news-submit:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow: 0 22px 42px rgba(255, 111, 179, 0.38);
  }

  .admin-news-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .admin-news-list li {
    background: rgba(250, 247, 255, 0.92);
    border-radius: 18px;
    padding: 0.85rem 1rem;
    box-shadow: inset 0 0 0 1px rgba(173, 149, 255, 0.14);
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .admin-news-list li.news-editing {
    gap: 0.8rem;
  }

  .admin-news-list li p {
    margin: 0;
    font-size: 0.9rem;
    color: #5c4a81;
  }

  .admin-news-list li span {
    font-size: 0.7rem;
    color: rgba(92, 74, 129, 0.6);
    letter-spacing: 0.05em;
  }

  .admin-news-meta,
  .admin-news-edit-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.8rem;
  }

  .admin-news-timestamp {
    font-size: 0.74rem;
    color: rgba(92, 74, 129, 0.58);
    letter-spacing: 0.05em;
  }

  .admin-news-controls,
  .admin-news-edit-actions {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .admin-news-btn {
    border: none;
    border-radius: 999px;
    padding: 0.35rem 0.95rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    background: rgba(149, 118, 255, 0.14);
    color: #6c54b2;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.2s ease;
  }

  .admin-news-btn:hover:not(:disabled) {
    background: rgba(149, 118, 255, 0.22);
    transform: translateY(-1px);
  }

  .admin-news-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .admin-news-delete {
    background: rgba(240, 90, 130, 0.16);
    color: #d8587f;
  }

  .admin-news-delete:hover:not(:disabled) {
    background: rgba(240, 90, 130, 0.22);
  }

  .admin-news-save {
    background: rgba(118, 205, 170, 0.2);
    color: #29a07d;
  }

  .admin-news-save:hover:not(:disabled) {
    background: rgba(118, 205, 170, 0.26);
  }

  .admin-news-cancel {
    background: rgba(149, 118, 255, 0.14);
  }

  .admin-news-edit-input {
    min-height: 4.8rem;
  }

  .admin-news-empty {
    background: rgba(250, 247, 255, 0.85);
    border-radius: 18px;
    padding: 1rem;
    font-size: 0.85rem;
    text-align: center;
    color: rgba(92, 74, 129, 0.6);
    box-shadow: inset 0 0 0 1px rgba(173, 149, 255, 0.12);
  }

  .admin-news-error-state {
    color: #d8587f;
    font-weight: 600;
  }

  .global-stats-panel {
    width: clamp(240px, 25vw, 320px);
    flex-shrink: 0;
    margin-left: auto;
    transform: translateX(clamp(1.5rem, 6vw, 8rem));
    background: rgba(255, 255, 255, 0.86);
    border-radius: 26px;
    padding: 1.4rem;
    box-shadow: 0 24px 58px rgba(174, 199, 255, 0.23);
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    backdrop-filter: blur(18px);
  }

  .global-stats-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .global-stats-subtitle {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: rgba(80, 88, 151, 0.55);
    font-weight: 700;
  }

  .global-stats-title {
    margin: 0.25rem 0 0;
    font-size: 1.28rem;
    font-weight: 800;
    color: #5860a2;
  }

  .global-stats-content {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .stats-block {
    background: rgba(244, 246, 255, 0.9);
    border-radius: 20px;
    padding: 0.7rem 0.9rem;
    box-shadow: inset 0 0 0 1px rgba(165, 180, 255, 0.16);
  }

  .stats-block h4 {
    margin: 0 0 0.6rem;
    font-size: 0.95rem;
    font-weight: 800;
    color: #4e5796;
  }

  .stats-block ol {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .stats-block li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.82rem;
    color: #4b3f74;
  }

  .stats-label {
    font-weight: 600;
    max-width: 70%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stats-value {
    font-weight: 700;
    color: #6a78ff;
  }

  .stats-empty {
    font-size: 0.8rem;
    color: rgba(75, 63, 116, 0.55);
  }

  .stats-loading {
    color: rgba(75, 63, 116, 0.7);
  }

  .stats-error {
    color: #d66a6a;
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
    z-index: 200;
  }

  .hero-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
    gap: 2.6rem;
  }

  .hero-footer {
    margin-top: 1.8rem;
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

  .profile-nav-wrapper {
    position: relative;
  }

  .profile-nav-button {
    border: none;
    border-radius: 999px;
    padding: 0.65rem 1.4rem;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    background: linear-gradient(135deg, #ffffff 0%, #f2f7ff 100%);
    color: #6a6780;
    font-weight: 700;
    font-size: 0.9rem;
    box-shadow: 0 18px 32px rgba(123, 176, 255, 0.22);
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
  }

  .profile-nav-button:hover {
    transform: translateY(-3px);
    box-shadow: 0 24px 44px rgba(123, 176, 255, 0.28);
    color: #4463ff;
  }

  .profile-nav-button:focus-visible {
    outline: 2px solid rgba(123, 176, 255, 0.45);
    outline-offset: 4px;
  }

  .profile-nav-avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: rgba(172, 205, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6b85ff;
    box-shadow: inset 0 0 0 1px rgba(123, 176, 255, 0.24);
  }

  .profile-nav-avatar svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }

  .profile-nav-name {
    white-space: nowrap;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .profile-dropdown {
    position: absolute;
    top: calc(100% + 0.8rem);
    right: 0;
    min-width: 260px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 20px;
    box-shadow: 0 26px 60px rgba(98, 127, 255, 0.22);
    padding: 1rem;
    z-index: 600;
    backdrop-filter: blur(20px);
  }

  .mode-cards {
    display: grid;
    grid-template-columns: repeat(2, minmax(280px, 1fr));
    gap: 1.6rem;
  }

  .mode-card {
    border: none;
    border-radius: 28px;
    padding: 1.7rem 1.6rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.9rem;
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
    width: 88px;
    height: 88px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.82);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.9rem;
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

  @media (max-width: 1200px) {
    .page-layout {
      flex-direction: column;
    }

    .page-main {
      max-width: none;
    }

    .leaderboard-panel {
      width: 100%;
      margin-left: 0;
      padding-right: 0;
    }

    .leaderboard-card {
      position: static;
    }

    .dashboard-row {
      flex-direction: column;
    }

    .admin-news-panel {
      width: 100%;
      order: 2;
    }

    .global-stats-panel {
      width: 100%;
      order: 3;
      margin-left: 0;
      transform: translateX(0);
    }

    .mode-cards-wrapper {
      width: 100%;
    }
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

    .profile-nav-wrapper {
      width: 100%;
      display: flex;
      justify-content: center;
    }

    .profile-nav-button {
      width: 100%;
      justify-content: center;
    }

    .profile-dropdown {
      left: 50%;
      right: auto;
      transform: translateX(-50%);
    }

    .hero-main {
      align-items: center;
      text-align: center;
    }

    .mode-cards {
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 1.6rem;
    }

    .hero-achievements {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
  }
</style>