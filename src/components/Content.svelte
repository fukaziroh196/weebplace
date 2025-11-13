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
  import { leaderboard, leaderboardPeriod, refreshLeaderboard } from '../stores/leaderboard';
  import ReplayDatesModal from './ReplayDatesModal.svelte';
  import { currentUser } from '../stores/authApi';
  import ProfileMenu from './ProfileMenu.svelte';
  import { newsFeed, loadNews, publishNews, updateNews, deleteNews } from '../stores/news';

  // Quizzes-first app: remove anime viewing and banners; home shows quiz menu.
  
  // Keep search view for future quiz search (placeholder)
  
let showReplay = false;
let showProfileMenu = false;
let profileButtonEl;
let profileDropdownEl;

const goToHome = () => activeView.set('home');
const goToProfile = () => activeView.set('profile');

const baseMenuItems = [];

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
let editingNewsId = null;
let editingNewsText = '';
let editingSubmitting = false;
let deletingNewsId = null;
let newsState = { loading: false, items: [], error: '' };
let newsItems = [];
let newsLoading = false;
let newsError = '';

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
  try {
    await publishNews(text);
    newsDraft = '';
  } catch (error) {
    newsSubmitError = error?.message || 'Не удалось опубликовать новость';
  } finally {
    newsSubmitting = false;
  }
}

function startEditNews(item) {
  editingNewsId = item.id;
  editingNewsText = item.text;
}

function cancelEditNews() {
  editingNewsId = null;
  editingNewsText = '';
}

async function submitEditNews() {
  if (!editingNewsId || !editingNewsText.trim() || editingSubmitting) return;
  editingSubmitting = true;
  try {
    await updateNews(editingNewsId, editingNewsText.trim());
    editingNewsId = null;
    editingNewsText = '';
  } catch (error) {
    newsSubmitError = error?.message || 'Не удалось обновить новость';
  } finally {
    editingSubmitting = false;
  }
}

async function handleDeleteNews(item) {
  if (deletingNewsId || !confirm('Удалить это объявление?')) return;
  deletingNewsId = item.id;
  try {
    await deleteNews(item.id);
  } catch (error) {
    newsSubmitError = error?.message || 'Не удалось удалить новость';
  } finally {
    deletingNewsId = null;
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
                  <ul class="admin-news-list">
                    {#each newsItems as item (item.id)}
                      <li class:news-editing={editingNewsId === item.id}>
                        {#if isAdmin && editingNewsId === item.id}
                          <textarea
                            class="admin-news-input admin-news-edit-input"
                            bind:value={editingNewsText}
                            maxlength="280"
                            rows="4"
                            disabled={editingSubmitting}
                          />
                          <div class="admin-news-edit-meta">
                            <span class="admin-news-timestamp">{formatNewsTimestamp(item.createdAt)}</span>
                            <div class="admin-news-edit-actions">
                              <button
                                type="button"
                                class="admin-news-btn admin-news-save"
                                on:click={submitEditNews}
                                disabled={!editingNewsText.trim() || editingSubmitting}
                              >
                                Сохранить
                              </button>
                              <button
                                type="button"
                                class="admin-news-btn admin-news-cancel"
                                on:click={cancelEditNews}
                                disabled={editingSubmitting}
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
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
                                  disabled={deletingNewsId === item.id}
                                >
                                  Редактировать
                                </button>
                                <button
                                  type="button"
                                  class="admin-news-btn admin-news-delete"
                                  on:click={() => handleDeleteNews(item)}
                                  disabled={deletingNewsId === item.id}
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
                        <div class="stats-empty">Нет данных</div>
                      {/if}
                    </div>
                    <div class="stats-block">
                      <h4>Скоростные игроки</h4>
                      {#if globalFastPlayers.length}
                        <ol>
                          {#each globalFastPlayers as item (item.username)}
                            <li>
                              <span class="stats-label">{item.username}</span>
                              <span class="stats-value">{item.score ?? item.time ?? 0}</span>
                            </li>
                          {/each}
                        </ol>
                      {:else}
                        <div class="stats-empty">Нет данных</div>
                      {/if}
                    </div>
                    <div class="stats-block">
                      <h4>Популярные режимы</h4>
                      {#if globalRecentModes.length}
                        <ol>
                          {#each globalRecentModes as item (item.mode)}
                            <li>
                              <span class="stats-label">{item.mode}</span>
                              <span class="stats-value">{item.count ?? 0}</span>
                            </li>
                          {/each}
                        </ol>
                      {:else}
                        <div class="stats-empty">Нет данных</div>
                      {/if}
                    </div>
                  {/if}
                </div>
              </section>
            </div>
          </main>
        {:else if $activeView === 'profile'}
          <ProfileView />
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
        {:else if $activeView === 'admin'}
          <AdminPanel />
        {/if}

        {#if $activeView === 'home' || $activeView === 'aniquiz'}
          <footer class="hero-footer">
            <div class="hero-achievements">
              <span class="hero-achievements-title">Достижения дня</span>
              <span class="hero-achievements-value">{achievementsToday.toLocaleString()}</span>
              <span class="hero-achievements-meta">{playersToday.toLocaleString()} пользователей сегодня</span>
            </div>
            <button class="hero-replays-button" on:click={openReplay}>
              <span class="hero-replays-icon">📅</span>
              <span class="hero-replays-label">Повторы</span>
            </button>
          </footer>
        {/if}
      </div>

      {#if $activeView === 'home' || $activeView === 'aniquiz'}
        <aside class="leaderboard-panel">
          <div class="leaderboard-card">
            <div class="leaderboard-header">
              <span class="leaderboard-subtitle">Топ игроков</span>
              <h2 class="leaderboard-title">Лидерборд</h2>
              <div class="leaderboard-tabs">
                {#each leaderboardTabs as tab (tab.value)}
                  <button
                    class:active={currentLeaderboardPeriod === tab.value}
                    on:click={() => changeLeaderboardPeriod(tab.value)}
                  >
                    {tab.label}
                  </button>
                {/each}
              </div>
            </div>
            {#if $leaderboard.loading}
              <div class="leaderboard-empty">Загрузка…</div>
            {:else if $leaderboard.error}
              <div class="leaderboard-empty">Ошибка: {$leaderboard.error}</div>
            {:else if $leaderboard.data && $leaderboard.data.length > 0}
              <ol class="leaderboard-list">
                {#each $leaderboard.data.slice(0, 6) as entry, index (entry.id || entry.userId || index)}
                  <li class:top={index === 0}>
                    <div class="leaderboard-rank">{index + 1}</div>
                    <div class="leaderboard-info">
                      <div class="leaderboard-name">{entry.name || entry.username || 'Игрок'}</div>
                      <div class="leaderboard-metric">{formatLeaderboardMetric(entry)}</div>
                    </div>
                  </li>
                {/each}
              </ol>
            {:else}
              <div class="leaderboard-empty">Нет данных</div>
            {/if}
            <div class="leaderboard-footer">Обновляется ежедневно</div>
          </div>
        </aside>
      {/if}
    </div>

    <ReplayDatesModal onClose={closeReplay} bind:open={showReplay} />
  </div>

<style>
  /* Базовое масштабирование: 16px на 1920px, пропорционально до 4K */
  :global(html) {
    font-size: clamp(14px, 0.833vw, 32px); /* 0.833vw = 16px на 1920px, 21.3px на 2560px, 32px на 3840px */
  }

  :global(body, #app) {
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
    padding: 0.5rem clamp(1rem, 4vw, 6rem) 1rem;
    box-sizing: border-box;
  }

  .page-layout {
    display: flex;
    align-items: flex-start;
    gap: clamp(1rem, 2.5vw, 3rem);
    flex: 1;
    min-height: 0;
    max-width: 100%;
    margin: 0;
    width: 100%;
    padding-right: 0;
  }

  .page-main {
    flex: 1;
    min-width: 0;
    max-width: min(65vw, 1700px);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow: visible;
  }

  .leaderboard-panel {
    width: min(22vw, 380px);
    flex-shrink: 0;
    margin-left: auto;
    margin-right: clamp(0.05rem, 0.2vw, 0.4rem);
    padding-right: 0;
  }

  .leaderboard-card {
    position: sticky;
    top: 1rem;
    background: rgba(255, 255, 255, 0.82);
    border-radius: 1.75rem;
    padding: 1.5rem 1.4rem 2rem;
    box-shadow: 0 1.5rem 3.75rem rgba(151, 168, 255, 0.24);
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    backdrop-filter: blur(18px);
  }

  .leaderboard-header {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .leaderboard-subtitle {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: rgba(82, 72, 120, 0.55);
    font-weight: 700;
  }

  .leaderboard-title {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 800;
    color: #5a4a82;
  }

  .leaderboard-tabs {
    display: inline-flex;
    padding: 0.2rem;
    border-radius: 999px;
    background: rgba(122, 108, 190, 0.12);
    gap: 0.2rem;
  }

  .leaderboard-tabs button {
    border: none;
    border-radius: 999px;
    padding: 0.4rem 0.8rem;
    font-size: 0.7rem;
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
    box-shadow: 0 0.75rem 1.625rem rgba(125, 152, 255, 0.35);
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
    gap: 0.75rem;
  }

  .leaderboard-list li {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.65rem 0.8rem;
    border-radius: 1.125rem;
    background: rgba(248, 249, 255, 0.75);
    box-shadow: inset 0 0 0 1px rgba(149, 168, 255, 0.12);
  }

  .leaderboard-list li.top {
    background: linear-gradient(135deg, rgba(255, 235, 246, 0.85) 0%, rgba(229, 240, 255, 0.88) 100%);
    box-shadow: inset 0 0 0 1px rgba(255, 199, 236, 0.25);
  }

  .leaderboard-rank {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.875rem;
    background: rgba(136, 161, 255, 0.16);
    color: #6a7aff;
    font-weight: 800;
    font-size: 0.9375rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .leaderboard-list li.top .leaderboard-rank {
    background: linear-gradient(135deg, #ffdba5 0%, #ffc875 100%);
    color: #825b0d;
  }

  .leaderboard-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
    flex: 1;
  }

  .leaderboard-name {
    font-weight: 700;
    color: #4e3f6f;
    font-size: 0.875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .leaderboard-metric {
    font-size: 0.75rem;
    color: rgba(78, 63, 111, 0.6);
    letter-spacing: 0.03em;
  }

  .leaderboard-empty {
    justify-content: center;
    font-weight: 600;
    color: rgba(78, 63, 111, 0.56);
    font-size: 0.8rem;
    padding: 1.75rem 1.25rem;
  }

  .leaderboard-footer {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: rgba(78, 63, 111, 0.42);
    font-weight: 700;
    padding-bottom: 0.5rem;
  }

  .dashboard-row {
    display: flex;
    flex-wrap: nowrap;
    gap: 0.875rem;
    align-items: flex-start;
    width: 100%;
  }

  .mode-cards-wrapper {
    flex: 1;
    min-width: 17.5rem;
  }

  .admin-news-panel {
    width: min(24vw, 320px);
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.86);
    border-radius: 1.625rem;
    padding: 1.25rem;
    box-shadow: 0 1.5rem 3.625rem rgba(255, 179, 214, 0.24);
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    backdrop-filter: blur(18px);
  }

  .admin-news-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;
  }

  .admin-news-subtitle {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: rgba(122, 88, 151, 0.6);
    font-weight: 700;
  }

  .admin-news-title {
    margin: 0.2rem 0 0;
    font-size: 1.2rem;
    font-weight: 800;
    color: #7a4ba7;
  }

  .admin-news-role {
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: rgba(122, 88, 151, 0.55);
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
    background: rgba(239, 229, 255, 0.6);
    box-shadow: inset 0 0 0 1px rgba(130, 90, 190, 0.18);
    white-space: nowrap;
  }

  .admin-news-form {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .admin-news-input {
    width: 100%;
    border: none;
    border-radius: 1.125rem;
    padding: 0.8rem 1rem;
    background: rgba(248, 242, 255, 0.9);
    box-shadow: inset 0 0 0 1px rgba(173, 149, 255, 0.18);
    font-size: 0.875rem;
    color: #5b4a7a;
    resize: none;
    font-family: inherit;
  }

  .admin-news-input:focus-visible {
    outline: 2px solid rgba(149, 118, 255, 0.45);
    outline-offset: 2px;
  }

  .admin-news-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.625rem;
  }

  .admin-news-counter {
    font-size: 0.75rem;
    color: rgba(90, 67, 108, 0.6);
  }

  .admin-news-error {
    display: block;
    margin-top: 0.3rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #d8587f;
  }

  .admin-news-submit {
    border: none;
    border-radius: 999px;
    padding: 0.55rem 1.3rem;
    font-size: 0.8rem;
    font-weight: 700;
    background: linear-gradient(135deg, #ff8ccc 0%, #ff6fb3 100%);
    color: #fff;
    box-shadow: 0 1rem 2rem rgba(255, 111, 179, 0.32);
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
    white-space: nowrap;
  }

  .admin-news-submit:disabled {
    opacity: 0.55;
    cursor: default;
    box-shadow: none;
  }

  .admin-news-submit:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow: 0 1.375rem 2.625rem rgba(255, 111, 179, 0.38);
  }

  .admin-news-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .admin-news-list li {
    background: rgba(250, 247, 255, 0.92);
    border-radius: 1.125rem;
    padding: 0.8rem 1rem;
    box-shadow: inset 0 0 0 1px rgba(173, 149, 255, 0.14);
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .admin-news-list li.news-editing {
    gap: 0.7rem;
  }

  .admin-news-list li p {
    margin: 0;
    font-size: 0.875rem;
    color: #5c4a81;
    line-height: 1.5;
  }

  .admin-news-list li span {
    font-size: 0.6875rem;
    color: rgba(92, 74, 129, 0.6);
    letter-spacing: 0.05em;
  }

  .admin-news-meta,
  .admin-news-edit-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.7rem;
    flex-wrap: wrap;
  }

  .admin-news-timestamp {
    font-size: 0.7rem;
    color: rgba(92, 74, 129, 0.58);
    letter-spacing: 0.05em;
  }

  .admin-news-controls,
  .admin-news-edit-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .admin-news-btn {
    border: none;
    border-radius: 999px;
    padding: 0.3rem 0.9rem;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    background: rgba(149, 118, 255, 0.14);
    color: #6c54b2;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.2s ease;
    white-space: nowrap;
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
    min-height: 4.5rem;
  }

  .admin-news-empty {
    background: rgba(250, 247, 255, 0.85);
    border-radius: 1.125rem;
    padding: 1rem;
    font-size: 0.8rem;
    text-align: center;
    color: rgba(92, 74, 129, 0.6);
    box-shadow: inset 0 0 0 1px rgba(173, 149, 255, 0.12);
  }

  .admin-news-error-state {
    color: #d8587f;
    font-weight: 600;
  }

  .global-stats-panel {
    width: min(25vw, 320px);
    flex-shrink: 0;
    flex-grow: 0;
    margin-left: clamp(6.5rem, 13vw, 24rem);
    background: rgba(255, 255, 255, 0.86);
    border-radius: 1.625rem;
    padding: 1.25rem;
    box-shadow: 0 1.5rem 3.625rem rgba(174, 199, 255, 0.23);
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    backdrop-filter: blur(18px);
  }

  .global-stats-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .global-stats-subtitle {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: rgba(80, 88, 151, 0.55);
    font-weight: 700;
  }

  .global-stats-title {
    margin: 0.2rem 0 0;
    font-size: 1.2rem;
    font-weight: 800;
    color: #5860a2;
  }

  .global-stats-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .stats-block {
    background: rgba(244, 246, 255, 0.9);
    border-radius: 1.25rem;
    padding: 0.8rem 1rem;
    box-shadow: inset 0 0 0 1px rgba(165, 180, 255, 0.16);
  }

  .stats-block h4 {
    margin: 0 0 0.5rem;
    font-size: 0.9rem;
    font-weight: 800;
    color: #4e5796;
  }

  .stats-block ol {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .stats-block li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8125rem;
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
    font-size: 0.75rem;
    color: rgba(75, 63, 116, 0.55);
    text-align: center;
    padding: 1rem 0;
  }

  .stats-loading {
    color: rgba(75, 63, 116, 0.7);
  }

  .stats-error {
    color: #d66a6a;
  }

  .hero-header {
    position: sticky;
    top: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    padding: 0.75rem 1.875rem;
    border-radius: 1.75rem;
    background: rgba(255, 255, 255, 0.78);
    backdrop-filter: blur(20px) saturation(130%);
    box-shadow: 0 1.5rem 3.75rem rgba(255, 158, 205, 0.28);
    margin-bottom: 0.875rem;
    z-index: 200;
    flex-wrap: wrap;
  }

  .hero-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
    gap: 0.875rem;
    overflow: visible;
    width: 100%;
  }

  .hero-footer {
    margin-top: 0.6rem;
    margin-right: clamp(-0.8rem, -1vw, -1.2rem);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.375rem;
    flex-wrap: wrap;
    padding: 1.25rem 1.875rem;
    border-radius: 1.75rem;
    background: rgba(255, 255, 255, 0.78);
    box-shadow: 0 1.75rem 3.75rem rgba(161, 143, 255, 0.18);
    width: calc(100% + clamp(0.8rem, 1vw, 1.2rem));
    box-sizing: border-box;
    position: relative;
  }

  .hero-logo {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .home-button {
    width: 3.625rem;
    height: 3.625rem;
    border-radius: 1.25rem;
    border: none;
    cursor: pointer;
    font-size: 1.625rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #ffd6ec 0%, #ffb9df 100%);
    box-shadow: 0 1.125rem 2.1875rem rgba(255, 158, 205, 0.35);
    color: #ff6aa3;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .home-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 1.25rem 2.5rem rgba(255, 158, 205, 0.4);
  }

  .home-button:focus-visible {
    outline: 2px solid rgba(255, 118, 186, 0.5);
    outline-offset: 3px;
  }

  .hero-title {
    font-size: 2rem;
    font-weight: 800;
    color: #ff74ad;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .hero-nav {
    display: flex;
    align-items: center;
    gap: 1.125rem;
    flex-wrap: wrap;
  }

  .hero-nav-item {
    border: none;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    cursor: pointer;
    color: #8d7aa1;
    font-weight: 600;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    transition: transform 0.2s ease, color 0.2s ease;
  }

  .hero-nav-item:hover {
    color: #ff6ea2;
    transform: translateY(-2px);
  }

  .hero-nav-item:focus-visible {
    outline: 2px solid rgba(255, 118, 186, 0.4);
    outline-offset: 3px;
  }

  .hero-nav-icon {
    font-size: 1.1rem;
    background: rgba(255, 201, 229, 0.45);
    color: #ff78b4;
    padding: 0.35rem 0.6rem;
    border-radius: 999px;
  }

  .profile-nav-wrapper {
    position: relative;
  }

  .profile-nav-button {
    border: none;
    border-radius: 999px;
    padding: 0.6rem 1.3rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: linear-gradient(135deg, #ffffff 0%, #f2f7ff 100%);
    color: #6a6780;
    font-weight: 700;
    font-size: 0.875rem;
    box-shadow: 0 1.125rem 2rem rgba(123, 176, 255, 0.22);
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
  }

  .profile-nav-button:hover {
    transform: translateY(-3px);
    box-shadow: 0 1.5rem 2.75rem rgba(123, 176, 255, 0.28);
    color: #4463ff;
  }

  .profile-nav-button:focus-visible {
    outline: 2px solid rgba(123, 176, 255, 0.45);
    outline-offset: 3px;
  }

  .profile-nav-avatar {
    width: 2.125rem;
    height: 2.125rem;
    border-radius: 50%;
    background: rgba(172, 205, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .profile-nav-avatar svg {
    width: 1.25rem;
    height: 1.25rem;
    fill: currentColor;
  }

  .profile-nav-name {
    white-space: nowrap;
    max-width: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .profile-dropdown {
    position: absolute;
    top: calc(100% + 0.7rem);
    right: 0;
    min-width: 16.25rem;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 1.25rem;
    box-shadow: 0 1.625rem 3.75rem rgba(98, 127, 255, 0.22);
    padding: 1rem;
    z-index: 600;
    backdrop-filter: blur(20px);
  }

  .mode-cards {
    display: grid;
    grid-template-columns: repeat(2, minmax(15rem, 1fr));
    gap: 0.875rem;
    padding-left: clamp(0.5rem, 1.2vw, 2rem);
  }

  .mode-card {
    border: none;
    border-radius: 1.75rem;
    padding: 1.75rem 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.8rem;
    text-align: center;
    cursor: pointer;
    box-shadow: 0 1.125rem 2.25rem rgba(186, 173, 255, 0.16);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .mode-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 1.5rem 2.75rem rgba(173, 152, 255, 0.22);
  }

  .mode-card:focus-visible {
    outline: 2px solid rgba(255, 160, 210, 0.4);
    outline-offset: 4px;
  }

  .mode-avatar {
    width: 6.125rem;
    height: 6.125rem;
    border-radius: 1.5rem;
    background: rgba(255, 255, 255, 0.82);
    box-shadow: 0 0.75rem 1.75rem rgba(0, 0, 0, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
  }

  .mode-label {
    font-size: 0.9375rem;
    font-weight: 800;
    color: #635075;
    letter-spacing: 0.05em;
  }

  .mode-description {
    font-size: 0.8rem;
    color: rgba(87, 70, 99, 0.62);
    max-width: 13.75rem;
    line-height: 1.4;
  }

  .hero-achievements {
    background: rgba(255, 244, 251, 0.92);
    border-radius: 1.375rem;
    padding: 1rem 1.625rem;
    display: flex;
    align-items: center;
    gap: 1.25rem;
    box-shadow: 0 1rem 2rem rgba(255, 188, 215, 0.22);
    flex-wrap: wrap;
  }

  .hero-achievements-title {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(90, 72, 108, 0.6);
    white-space: nowrap;
  }

  .hero-achievements-value {
    font-size: 1.75rem;
    font-weight: 800;
    color: #ff6ea2;
    white-space: nowrap;
  }

  .hero-achievements-meta {
    font-size: 0.8125rem;
    color: rgba(90, 72, 108, 0.58);
    white-space: nowrap;
  }

  .hero-replays-button {
    border: none;
    background: rgba(255, 244, 251, 0.92);
    border-radius: 1.375rem;
    padding: 1rem 1.625rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    box-shadow: 0 1rem 2rem rgba(255, 188, 215, 0.22);
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    font-family: inherit;
  }

  .hero-replays-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 1.125rem 2.25rem rgba(255, 188, 215, 0.28);
    background: rgba(255, 248, 253, 0.95);
  }

  .hero-replays-button:active {
    transform: translateY(0);
  }

  .hero-replays-button:focus-visible {
    outline: 2px solid rgba(255, 118, 186, 0.4);
    outline-offset: 3px;
  }

  .hero-replays-icon {
    font-size: 1.375rem;
  }

  .hero-replays-label {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #8d7aa1;
    white-space: nowrap;
  }

  .hero-replays-button:hover .hero-replays-label {
    color: #ff6ea2;
  }

  /* ============================================
     Масштабирование для больших экранов (2K, 4K)
     ============================================ */

  /* Промежуточные разрешения между Full HD и 2K (1920px - 2560px) */
  @media (min-width: 1920px) and (max-width: 2559px) {
    :global(html) {
      font-size: clamp(16px, calc(16px + (100vw - 1920px) * 0.005), 19px); /* Плавное увеличение от 16px до 19px */
    }

    .page-main {
      max-width: min(65vw, calc(1700px + (100vw - 1920px) * 0.5)); /* Плавное увеличение от 1700px до 2380px */
    }

    .leaderboard-panel {
      width: min(22vw, calc(380px + (100vw - 1920px) * 0.28)); /* Плавное увеличение от 380px до 559px */
    }

    .global-stats-panel {
      width: min(25vw, calc(320px + (100vw - 1920px) * 0.23)); /* Плавное увеличение от 320px до 467px */
    }

    .admin-news-panel {
      width: min(24vw, calc(320px + (100vw - 1920px) * 0.23)); /* Плавное увеличение от 320px до 467px */
    }
  }

  /* 2K мониторы (2560x1440 и выше) */
  @media (min-width: 2560px) {
    :global(html) {
      font-size: clamp(19px, 0.95vw, 22px); /* Увеличенный базовый размер для 2K */
    }

    .page-main {
      max-width: min(65vw, 2380px); /* 1700px * 1.4 для умеренного масштабирования */
    }

    .leaderboard-panel {
      width: min(22vw, 532px); /* 380px * 1.4 */
    }

    .global-stats-panel {
      width: min(25vw, 448px); /* 320px * 1.4 */
    }

    .admin-news-panel {
      width: min(24vw, 448px); /* 320px * 1.4 */
    }
  }

  /* 4K мониторы (3840x2160 и выше) */
  @media (min-width: 3840px) {
    :global(html) {
      font-size: clamp(26px, 1.1vw, 36px); /* Увеличенный базовый размер для 4K */
    }

    .page-main {
      max-width: min(65vw, 3800px); /* 1700px * 2.235 для умеренного масштабирования */
    }

    .leaderboard-panel {
      width: min(22vw, 850px); /* 380px * 2.235 */
    }

    .global-stats-panel {
      width: min(25vw, 715px); /* 320px * 2.235 */
    }

    .admin-news-panel {
      width: min(24vw, 715px); /* 320px * 2.235 */
    }
  }

  /* ============================================
     Адаптивность для планшетов и мобильных
     ============================================ */

  /* Планшеты (до 1024px) */
  @media (max-width: 1024px) {
    .page-layout {
      max-width: 100%;
      gap: 1.5rem;
    }

    .page-main {
      max-width: 100%;
    }

    .leaderboard-panel {
      width: min(28vw, 360px);
      margin-right: 0;
    }

    .global-stats-panel {
      margin-left: clamp(4rem, 12vw, 16rem);
    }

    .mode-cards {
      padding-left: clamp(0.5rem, 1vw, 1.5rem);
    }
  }

  /* Планшеты в портретной ориентации и маленькие ноутбуки (до 1200px) */
  @media (max-width: 1200px) {
    .page-layout {
      flex-direction: column;
      gap: 1.25rem;
    }

    .page-main {
      max-width: 100%;
    }

    .leaderboard-panel {
      width: 100%;
      margin-left: 0;
      margin-right: 0;
      padding-right: 0;
    }

    .leaderboard-card {
      position: static;
    }

    .dashboard-row {
      flex-direction: column;
      gap: 1rem;
    }

    .admin-news-panel {
      width: 100%;
      order: 2;
    }

    .global-stats-panel {
      width: 100%;
      order: 3;
      margin-left: 0;
      margin-right: 0;
    }

    .mode-cards-wrapper {
      width: 100%;
      order: 1;
    }

    .mode-cards {
      grid-template-columns: repeat(2, minmax(12rem, 1fr));
      padding-left: 0;
    }
  }

  /* Планшеты (до 900px) */
  @media (max-width: 900px) {
    :global(html) {
      font-size: clamp(14px, 2vw, 16px);
    }

    .animeguess-page {
      padding: 0.5rem 1.5rem 1rem;
    }

    .hero-header {
      flex-direction: column;
      align-items: flex-start;
      padding: 0.7rem 1.25rem;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .hero-footer {
      flex-direction: column;
      align-items: stretch;
      padding: 1.25rem;
      margin-right: 0;
      width: 100%;
      gap: 1rem;
    }

    .hero-achievements {
      justify-content: space-between;
      width: 100%;
    }

    .mode-cards {
      grid-template-columns: 1fr;
      gap: 0.875rem;
      padding-left: 0;
    }

    .mode-card {
      padding: 1.5rem 1.25rem;
    }

    .admin-news-panel,
    .global-stats-panel {
      padding: 1rem;
    }
  }

  /* Мобильные устройства (до 768px) */
  @media (max-width: 768px) {
    :global(html) {
      font-size: 14px;
    }

    .animeguess-page {
      padding: 0.4rem 1rem 0.875rem;
    }

    .page-layout {
      gap: 1rem;
    }

    .hero-logo {
      width: 100%;
      justify-content: center;
    }

    .hero-header {
      align-items: center;
      text-align: center;
      padding: 0.6rem 1rem;
      margin-bottom: 0.6rem;
      gap: 0.75rem;
    }

    .hero-title {
      font-size: 1.5rem;
    }

    .home-button {
      width: 3rem;
      height: 3rem;
      font-size: 1.375rem;
    }

    .hero-nav {
      width: 100%;
      justify-content: center;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .hero-nav-item {
      flex-direction: row;
      gap: 0.4rem;
      background: rgba(255, 218, 234, 0.42);
      padding: 0.35rem 0.75rem;
      border-radius: 1rem;
    }

    .profile-nav-wrapper {
      width: 100%;
      display: flex;
      justify-content: center;
    }

    .profile-nav-button {
      width: 100%;
      justify-content: center;
      max-width: 20rem;
    }

    .profile-dropdown {
      left: 50%;
      right: auto;
      transform: translateX(-50%);
      min-width: 18rem;
    }

    .hero-main {
      align-items: center;
      text-align: center;
    }

    .mode-cards {
      grid-template-columns: 1fr;
      gap: 0.75rem;
      padding-left: 0;
    }

    .mode-card {
      padding: 1.25rem 1rem;
    }

    .mode-avatar {
      width: 5rem;
      height: 5rem;
      font-size: 1.75rem;
    }

    .dashboard-row {
      gap: 0.75rem;
    }

    .admin-news-panel,
    .global-stats-panel,
    .leaderboard-card {
      padding: 1rem;
      border-radius: 1.25rem;
    }

    .hero-achievements {
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 1rem;
      gap: 0.75rem;
    }

    .hero-achievements-value {
      font-size: 1.5rem;
    }

    .hero-replays-button {
      width: 100%;
      justify-content: center;
      padding: 1rem;
    }

    .leaderboard-card {
      padding: 1rem;
    }

    .leaderboard-title {
      font-size: 1.15rem;
    }
  }

  /* Маленькие мобильные устройства (до 480px) */
  @media (max-width: 480px) {
    :global(html) {
      font-size: 13px;
    }

    .animeguess-page {
      padding: 0.3rem 0.75rem 0.75rem;
    }

    .hero-header {
      padding: 0.5rem 0.875rem;
    }

    .hero-title {
      font-size: 1.25rem;
    }

    .home-button {
      width: 2.75rem;
      height: 2.75rem;
      font-size: 1.25rem;
    }

    .mode-card {
      padding: 1rem 0.875rem;
    }

    .mode-avatar {
      width: 4.5rem;
      height: 4.5rem;
      font-size: 1.5rem;
    }

    .admin-news-panel,
    .global-stats-panel,
    .leaderboard-card {
      padding: 0.875rem;
    }
  }
</style>
