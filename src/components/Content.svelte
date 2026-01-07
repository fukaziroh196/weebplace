<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { searchResults, isSearching } from '../stores/sources';
  import { activeView, goToPublicProfile } from '../stores/ui';
  import { gameState } from '../stores/gameState';
  import AdminPanel from './AdminPanel.svelte';
  import ListsView from './ListsView.svelte';
  import MessagesView from './MessagesView.svelte';
  import CatalogView from './CatalogView.svelte';
  import GuessAnimeView from './GuessAnimeView.svelte';
  import GuessCharacterView from './GuessCharacterView.svelte';
  import GuessOpeningView from './GuessOpeningView.svelte';
  import BattlePackSelector from './BattlePackSelector.svelte';
  import AdminQuizPanel from './AdminQuizPanel.svelte';
  import TournamentsView from './TournamentsView.svelte';
  import { availableQuizDates, refreshQuizDates } from '../stores/quizzes';
  import { userStats, loadUserStats, loadGlobalStats, globalStats } from '../stores/stats';
  import { leaderboard, leaderboardPeriod, refreshLeaderboard } from '../stores/leaderboard';
  import ReplayDatesModal from './ReplayDatesModal.svelte';
  import { currentUser } from '../stores/authApi';
  import ProfileMenu from './ProfileMenu.svelte';
  import { newsFeed, loadNews, publishNews, updateNews, deleteNews } from '../stores/news';
  import { notifications, unreadCount, loadUnreadNotifications, markAllNotificationsRead } from '../stores/notifications';
  import { loadPublicUserByUsername } from '../stores/users';
  import { publicProfileUserId } from '../stores/ui';
  import PublicProfileView from './PublicProfileView.svelte';

  // Quizzes-first app: remove anime viewing and banners; home shows quiz menu.
  
  // Keep search view for future quiz search (placeholder)
  
let showReplay = false;
let showProfileMenu = false;
let showThemeMenu = false;
let showNotifications = false;
let profileButtonEl;
let profileDropdownEl;
let themeButtonEl;
let themeDropdownEl;
let notificationsButtonEl;
let notificationsDropdownEl;

const THEME_STORAGE_KEY = 'animeguessTheme';
let theme = 'glass';
let userChoseTheme = false;
const themeOptions = [
  { id: 'light', label: 'Светлая' },
  { id: 'dark', label: 'Тёмная' },
  { id: 'glass', label: 'Стеклянная' }
];
const themeLabels = {
  light: 'Светлая',
  dark: 'Тёмная',
  glass: 'Стеклянная'
};

function setDocumentTheme(value) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = value;
  }
}

function applyTheme(value, { persist = true } = {}) {
  theme = value;
  setDocumentTheme(value);
  if (persist && typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, value);
    userChoseTheme = true;
  }
}

function toggleTheme() {
  applyTheme(theme === 'dark' ? 'light' : 'dark');
}

function selectTheme(nextTheme) {
  if (theme === nextTheme) {
    showThemeMenu = false;
    return;
  }
  applyTheme(nextTheme);
  showThemeMenu = false;
}

function navigateTo(path) {
  if (typeof window !== 'undefined' && window.history?.pushState && window.location.pathname !== path) {
    window.history.pushState(null, '', path);
  }
}

const goToHome = () => {
  navigateTo('/');
  activeView.set('home');
};

const goToProfile = () => {
  navigateTo('/profile');
  // Используем PublicProfileView для своего профиля
  if ($currentUser?.id) {
    publicProfileUserId.set($currentUser.id);
  }
  activeView.set('publicProfile');
};

function normalizePath(p) {
  if (!p) return '/';
  try {
    return p.replace(/\/+$/, '') || '/';
  } catch (_) {
    return '/';
  }
}

function syncViewFromLocation() {
  if (typeof window === 'undefined') return;

  // Legacy hash to history
  const legacyHash = (window.location.hash || '').replace(/^#/, '');
  if (legacyHash.startsWith('/profile')) {
    window.history.replaceState(null, '', '/profile');
  } else if (legacyHash.startsWith('/friends')) {
    window.history.replaceState(null, '', '/friends');
  } else if (legacyHash.startsWith('/user/')) {
    const slug = legacyHash.replace(/^\/?user\//, '');
    if (slug) window.history.replaceState(null, '', `/user/${slug}`);
  }

  const path = normalizePath(window.location.pathname || '/');
  const knownRoutes = ['/profile', '/friends', '/tournaments', '/'];
  const isUserRoute = path.startsWith('/user/');

  // Главная страница
  if (path === '/') {
    activeView.set('home');
    return;
  }
  if (path === '/profile') {
    // Используем PublicProfileView для своего профиля
    if (get(currentUser)?.id) {
      publicProfileUserId.set(get(currentUser).id);
    }
    activeView.set('publicProfile');
    return;
  }
  if (path === '/friends') {
    if (get(currentUser)?.id) {
      publicProfileUserId.set(get(currentUser).id);
    }
    activeView.set('publicProfile');
    friendsModalOpen.set(true);
    return;
  }
  if (path === '/tournaments') {
    activeView.set('tournaments');
    return;
  }
  // Формат /user/nickname
  if (isUserRoute) {
    const slug = path.replace(/^\/?user\//, '').replace(/\/+$/, '');
    if (slug) {
      loadPublicUserByUsername(slug)
        .then((u) => {
          if (u?.id) {
            goToPublicProfile(u.id, u.username || slug);
          }
        })
        .catch(() => {
          activeView.set('home');
        });
    }
    return;
  }
  
  // Fallback на главную
  activeView.set('home');
}

// Первичная синхронизация
if (typeof window !== 'undefined') {
  syncViewFromLocation();
}

onMount(() => {
  if (typeof window !== 'undefined') {
    syncViewFromLocation();
    const onPopState = () => syncViewFromLocation();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }
});

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

function toggleThemeMenu() {
  showThemeMenu = !showThemeMenu;
}

function closeThemeMenu() {
  showThemeMenu = false;
}

async function toggleNotifications() {
  showNotifications = !showNotifications;
  if (showNotifications && $currentUser) {
    await loadUnreadNotifications();
    await markAllNotificationsRead();
  }
}
  
function handleClickOutside(event) {
  const target = event.target;
  if (showProfileMenu) {
    const insideProfileDropdown = profileDropdownEl && profileDropdownEl.contains(target);
    const onProfileButton = profileButtonEl && profileButtonEl.contains(target);
    if (!insideProfileDropdown && !onProfileButton) {
      showProfileMenu = false;
    }
  }
  if (showThemeMenu) {
    const insideThemeDropdown = themeDropdownEl && themeDropdownEl.contains(target);
    const onThemeButton = themeButtonEl && themeButtonEl.contains(target);
    if (!insideThemeDropdown && !onThemeButton) {
      showThemeMenu = false;
    }
  }
  if (showNotifications) {
    const insideN = notificationsDropdownEl && notificationsDropdownEl.contains(target);
    const onN = notificationsButtonEl && notificationsButtonEl.contains(target);
    if (!insideN && !onN) {
      showNotifications = false;
    }
  }
  }
  
onMount(() => {
  refreshQuizDates();
  refreshLeaderboard($leaderboardPeriod);
  loadUserStats();
  loadGlobalStats();
  loadNews();

  const prefersDark = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const savedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null;

  if (savedTheme) {
    userChoseTheme = true;
    applyTheme(savedTheme, { persist: false });
  } else {
    // По умолчанию используем стеклянную тему
    applyTheme('glass', { persist: false });
  }

  const handleSchemeChange = () => {
    if (!userChoseTheme) {
      // По умолчанию используем стеклянную тему
      applyTheme('glass', { persist: false });
    }
  };

  window.addEventListener('click', handleClickOutside);
  window.addEventListener('closeProfileMenu', closeProfileMenu);

  if (prefersDark?.addEventListener) {
    prefersDark.addEventListener('change', handleSchemeChange);
  } else if (prefersDark?.addListener) {
    prefersDark.addListener(handleSchemeChange);
  }

  return () => {
    window.removeEventListener('click', handleClickOutside);
    window.removeEventListener('closeProfileMenu', closeProfileMenu);
    if (prefersDark?.removeEventListener) {
      prefersDark.removeEventListener('change', handleSchemeChange);
    } else if (prefersDark?.removeListener) {
      prefersDark.removeListener(handleSchemeChange);
    }
  };
});
  
const gameCards = [
  {
    title: 'Угадай аниме',
    description: 'Узнай тайтл по короткой подсказке',
    accent: '#a6cfff',
    accentDark: '#b3d6ff',
    background: 'linear-gradient(135deg, #a6cfff 0%, #9ec6ff 50%, #b3d6ff 100%)',
    backgroundDark: 'linear-gradient(135deg, #a6cfff 0%, #9ec6ff 50%, #b3d6ff 100%)',
    emoji: '🎧',
    action: () => activeView.set('guessAnime')
  },
  {
    title: 'Угадай персонажа',
    description: 'Отгадай героя по внешности',
    accent: '#ffaac2',
    accentDark: '#ffb5c8',
    background: 'linear-gradient(135deg, #ffaac2 0%, #ff9eb4 50%, #ffb5c8 100%)',
    backgroundDark: 'linear-gradient(135deg, #ffaac2 0%, #ff9eb4 50%, #ffb5c8 100%)',
    emoji: '🗡️',
    action: () => activeView.set('guessCharacter')
  },
  {
    title: 'Угадай опенинг',
    description: 'Соревнуйся в скорости угадывания',
    accent: '#9e8fff',
    accentDark: '#c2b7ff',
    background: 'linear-gradient(135deg, #9e8fff 0%, #a894ff 45%, #8c7dff 100%)',
    backgroundDark: 'linear-gradient(135deg, #9e8fff 0%, #a894ff 45%, #8c7dff 100%)',
    emoji: '🎵',
    action: () => activeView.set('guessOpening')
  },
  {
    title: 'Аниме баттлы',
    description: 'Соревнуйся за любимый тайтл в дуэлях',
    accent: '#8c7dff',
    accentDark: '#c2b7ff',
    background: 'linear-gradient(135deg, #8c7dff 0%, #9e8fff 45%, #a894ff 100%)',
    backgroundDark: 'linear-gradient(135deg, #8c7dff 0%, #9e8fff 45%, #a894ff 100%)',
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
        <div class="hero-title">OTAKUZ.FUN</div>
      </div>
      <div class="hero-center">
        {#if $activeView === 'guessAnime' && $gameState.title}
          <div class="hero-game-info">
            <div class="hero-game-title">{$gameState.title}</div>
            <div class="hero-game-round">
              <span class="hero-round-text">Раунд {$gameState.round}</span>
              <span class="hero-difficulty-badge">{$gameState.difficulty}</span>
            </div>
          </div>
        {/if}
      </div>
      <nav class="hero-nav">
        {#each menuItems as item (item.label)}
          <button class="hero-nav-item" on:click={item.action}>
            <span class="hero-nav-icon">{item.icon}</span>
            <span class="hero-nav-label">{item.label}</span>
          </button>
        {/each}
        <!-- Кнопка переключения тем временно скрыта -->
        <!-- <div class="theme-selector">
          <button
            class="theme-toggle"
            type="button"
            bind:this={themeButtonEl}
            aria-expanded={showThemeMenu}
            on:click={toggleThemeMenu}
          >
            <span class="theme-toggle-icon">🎨</span>
            <span class="theme-toggle-label">{themeLabels[theme] ?? 'Выбрать тему'}</span>
          </button>
          {#if showThemeMenu}
            <div class="theme-dropdown" bind:this={themeDropdownEl}>
              {#each themeOptions as option}
                <button
                  type="button"
                  class="theme-option"
                  class:active={theme === option.id}
                  on:click={() => selectTheme(option.id)}
                >
                  {option.label}
                </button>
              {/each}
            </div>
          {/if}
        </div> -->
        <div class="profile-nav-wrapper">
          <div class="notification-wrapper">
            <button
              class="profile-nav-button notification-button"
              type="button"
              bind:this={notificationsButtonEl}
              on:click={toggleNotifications}
              aria-haspopup="true"
              aria-expanded={showNotifications}
              aria-label="Уведомления"
            >
              <span class="profile-nav-avatar">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8"></path>
                  <path d="M13.73 21a2 2 0 01-3.46 0"></path>
                </svg>
              </span>
              {#if $currentUser}
                {#if $unreadCount > 0}
                  <span class="notif-dot notif-dot-count">{$unreadCount}</span>
                {:else}
                  <span class="notif-dot notif-dot-faded"></span>
                {/if}
              {/if}
            </button>
            {#if showNotifications}
              <div class="profile-dropdown notifications-dropdown" bind:this={notificationsDropdownEl}>
                <div class="notifications-header">Уведомления</div>
                {#if $notifications.length === 0}
                  <div class="notifications-empty">Пока нет уведомлений</div>
                {:else}
                  <ul class="notifications-list">
                    {#each $notifications as n (n.id)}
                      <li class="notification-item">
                        <div class="notification-title">{n.title}</div>
                        {#if n.message}
                          <div class="notification-message">{n.message}</div>
                        {/if}
                        <div class="notification-meta">{new Date(n.createdAt).toLocaleString()}</div>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            {/if}
          </div>
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
      <div class="page-main" class:full-width={$activeView === 'publicProfile' || $activeView === 'profile'}>
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
                  <button
                    class="mode-card"
                    style={`--card-bg:${theme === 'dark' ? card.backgroundDark : card.background}; --card-accent:${theme === 'dark' ? card.accentDark : card.accent};`}
                    on:click={card.action}
                  >
                    <div class="mode-avatar">
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
        {:else if $activeView === 'profile' || $activeView === 'publicProfile'}
          <PublicProfileView />
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
        {:else if $activeView === 'tournaments'}
          <TournamentsView />
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
                      <button 
                        class="leaderboard-name clickable" 
                        on:click={() => {
                          const username = entry.username || entry.name;
                          const userId = entry.id || entry.userId;
                          if (username) goToPublicProfile(userId, username);
                        }}
                      >
                        {entry.name || entry.username || 'Игрок'}
                      </button>
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

  :global(:root) {
    --bg-gradient-start: #f2edf0;
    --bg-gradient-end: #f2edf0;
    --surface-primary: rgba(255, 255, 255, 0.94);
    --surface-secondary: rgba(247, 248, 253, 0.92);
    --surface-muted: rgba(241, 243, 252, 0.9);
    --surface-pill: rgba(236, 238, 248, 0.85);
    --surface-card: rgba(233, 236, 247, 0.8);
    --input-surface: rgba(239, 241, 252, 0.9);
    --input-border-color: rgba(156, 165, 214, 0.18);
    --chip-bg: rgba(228, 231, 248, 0.7);
    --chip-border-color: rgba(128, 136, 189, 0.16);
    --panel-gradient-primary: linear-gradient(135deg, #ffffff 0%, #f3f5ff 100%);
    --news-panel-gradient: linear-gradient(135deg, #ffeef4 0%, #ffe0ec 100%);
    --card-gradient-blue: linear-gradient(135deg, #d0e0f0 0%, #e5eff5 100%);
    --card-gradient-pink: linear-gradient(135deg, #ffe6f4 0%, #ffd8ee 100%);
    --card-gradient-purple: linear-gradient(135deg, #eae6ff 0%, #dcd1ff 100%);
    --card-gradient-yellow: linear-gradient(135deg, #ffe9bd 0%, #ffe1a3 100%);
    --text-primary: #4a495f;
    --text-secondary: rgba(74, 73, 99, 0.75);
    --text-tertiary: rgba(74, 73, 99, 0.58);
    --text-quaternary: rgba(74, 73, 99, 0.4);
    --focus-outline-color: rgba(124, 139, 196, 0.4);
    --accent-primary: #7c8bc4;
    --accent-primary-strong: #6573ba;
    --accent-secondary: #b8a078;
    --accent-rose: #b28dab;
    --accent-chip: linear-gradient(135deg, #dfe3f2 0%, #cad2ea 100%);
    --shadow-outer: 0 1.5rem 3.5rem rgba(60, 64, 98, 0.14);
    --shadow-soft: 0 1rem 2.5rem rgba(60, 64, 98, 0.12);
    --shadow-inset: inset 0 0 0 1px rgba(118, 126, 170, 0.12);
    --divider-color: rgba(124, 139, 196, 0.12);
    --divider-color-strong: rgba(124, 139, 196, 0.22);
    --icon-pill-bg: rgba(215, 221, 240, 0.6);
    --tab-active-gradient: linear-gradient(135deg, #b8c1df 0%, #8d97c9 100%);
    --tab-active-shadow: 0 0.75rem 1.625rem rgba(109, 123, 181, 0.3);
    --rank-top-gradient: linear-gradient(135deg, #d5c49c 0%, #c3a96c 100%);
    --rank-top-color: #6a4f1d;
    --rank-pill-bg: rgba(128, 140, 202, 0.18);
    --admin-submit-gradient: linear-gradient(135deg, #c9cde4 0%, #9da8cf 100%);
    --admin-submit-shadow: 0 1rem 2rem rgba(114, 124, 167, 0.18);
    --admin-submit-shadow-hover: 0 1.375rem 2.625rem rgba(114, 124, 167, 0.24);
    --danger-color: #c4687f;
    --danger-bg: rgba(204, 120, 134, 0.18);
    --danger-bg-hover: rgba(204, 120, 134, 0.24);
    --success-color: #3a8c72;
    --success-bg: rgba(120, 176, 156, 0.2);
    --success-bg-hover: rgba(120, 176, 156, 0.26);
    --stats-error-color: #c46868;
    --home-button-gradient: linear-gradient(135deg, #e1e6f5 0%, #d3daed 100%);
    --home-button-shadow: 0 1.125rem 2.1875rem rgba(109, 122, 181, 0.22);
    --home-button-shadow-hover: 0 1.25rem 2.5rem rgba(109, 122, 181, 0.3);
    --home-button-color: var(--accent-primary-strong);
    --profile-button-gradient: linear-gradient(135deg, #fdfefe 0%, #ecf1fb 100%);
    --profile-button-shadow: 0 1.125rem 2rem rgba(101, 122, 178, 0.16);
    --profile-button-hover-shadow: 0 1.5rem 2.75rem rgba(101, 122, 178, 0.24);
    --profile-avatar-bg: rgba(137, 160, 209, 0.18);
    --mode-card-shadow: 0 1.125rem 2.25rem rgba(109, 121, 177, 0.16);
    --mode-card-shadow-hover: 0 1.5rem 2.75rem rgba(109, 121, 177, 0.24);
    --mode-avatar-bg: rgba(255, 255, 255, 0.82);
    --hero-toggle-bg: var(--surface-pill);
    --hero-toggle-shadow: var(--shadow-soft);
    --hero-toggle-hover-shadow: 0 0.875rem 1.75rem rgba(60, 64, 98, 0.22);
    --hero-toggle-icon-color: var(--accent-primary-strong);
    --hero-button-hover-shadow: 0 1.125rem 2.25rem rgba(60, 64, 98, 0.16);
    --hero-replays-hover-bg: rgba(248, 249, 255, 0.96);
    --app-background: linear-gradient(180deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
    --app-background-size: auto;
    --app-background-attachment: scroll;
    --app-background-repeat: no-repeat;
    --app-background-position: center;
    --panel-highlight: #c0c7fe;
  }

  :global(:root[data-theme='dark']) {
    --bg-gradient-start: #f2edf0;
    --bg-gradient-end: #f2edf0;
    --surface-primary: rgba(36, 38, 44, 0.95);
    --surface-secondary: rgba(36, 38, 44, 0.92);
    --surface-muted: rgba(36, 38, 44, 0.9);
    --surface-pill: rgba(40, 42, 48, 0.92);
    --surface-card: rgba(40, 42, 48, 0.9);
    --input-surface: rgba(28, 29, 34, 0.9);
    --input-border-color: rgba(255, 255, 255, 0.05);
    --chip-bg: rgba(255, 255, 255, 0.05);
    --chip-border-color: rgba(255, 255, 255, 0.08);
    --panel-gradient-primary: linear-gradient(135deg, #3d4260 0%, #353a55 55%, #41486a 100%);
    --news-panel-gradient: linear-gradient(135deg, #ffaac2 0%, #ff9eb4 45%, #ffb5c8 100%);
    --card-gradient-blue: linear-gradient(135deg, #a6cfff 0%, #9ec6ff 50%, #b3d6ff 100%);
    --card-gradient-pink: linear-gradient(135deg, #ffaac2 0%, #ff9eb4 50%, #ffb5c8 100%);
    --card-gradient-purple: linear-gradient(135deg, #9e8fff 0%, #a894ff 45%, #8c7dff 100%);
    --card-gradient-yellow: linear-gradient(135deg, #ffd77e 0%, #ffe194 50%, #fcd06a 100%);
    --text-primary: #f4f7ff;
    --text-secondary: #d8dcef;
    --text-tertiary: #bfc4d6;
    --text-quaternary: rgba(191, 196, 214, 0.4);
    --focus-outline-color: rgba(202, 212, 255, 0.55);
    --accent-primary: #a6cfff;
    --accent-primary-strong: #b3d6ff;
    --accent-secondary: #ffd77e;
    --accent-rose: #ffaac2;
    --accent-chip: linear-gradient(135deg, #c8bfff 0%, #b8a9ff 100%);
    --shadow-outer: 0 1.5rem 3.5rem rgba(255, 255, 255, 0.08);
    --shadow-soft: 0 1rem 2.5rem rgba(255, 255, 255, 0.06);
    --shadow-inset: inset 0 0 0 1px rgba(255, 255, 255, 0.07);
    --divider-color: rgba(255, 255, 255, 0.05);
    --divider-color-strong: rgba(255, 255, 255, 0.12);
    --icon-pill-bg: rgba(202, 212, 255, 0.2);
    --tab-active-gradient: linear-gradient(135deg, #8fd6ff 0%, #a8e4ff 100%);
    --tab-active-shadow: 0 0.75rem 1.625rem rgba(255, 255, 255, 0.12);
    --rank-top-gradient: linear-gradient(135deg, #ffd77e 0%, #ffe194 50%, #fcd06a 100%);
    --rank-top-color: #2e1f00;
    --rank-pill-bg: rgba(255, 255, 255, 0.12);
    --admin-submit-gradient: linear-gradient(135deg, #ffb7d5 0%, #fcaFCb 100%);
    --admin-submit-shadow: 0 1rem 2rem rgba(255, 255, 255, 0.12);
    --admin-submit-shadow-hover: 0 1.375rem 2.625rem rgba(255, 255, 255, 0.18);
    --danger-color: #ffb7d5;
    --danger-bg: rgba(255, 183, 213, 0.15);
    --danger-bg-hover: rgba(255, 183, 213, 0.25);
    --success-color: #8fe3c1;
    --success-bg: rgba(143, 227, 193, 0.17);
    --success-bg-hover: rgba(143, 227, 193, 0.25);
    --stats-error-color: #ffb7d5;
    --home-button-gradient: linear-gradient(135deg, #2a2c32 0%, #1f2025 100%);
    --home-button-shadow: 0 1.125rem 2.1875rem rgba(255, 255, 255, 0.12);
    --home-button-shadow-hover: 0 1.25rem 2.5rem rgba(255, 255, 255, 0.16);
    --home-button-color: #f4f7ff;
    --profile-button-gradient: linear-gradient(135deg, #2b2d34 0%, #212227 100%);
    --profile-button-shadow: 0 1.125rem 2rem rgba(255, 255, 255, 0.12);
    --profile-button-hover-shadow: 0 1.5rem 2.75rem rgba(255, 255, 255, 0.18);
    --profile-avatar-bg: rgba(255, 255, 255, 0.08);
    --mode-card-shadow: 0 1.125rem 2.25rem rgba(255, 255, 255, 0.1);
    --mode-card-shadow-hover: 0 1.5rem 2.75rem rgba(255, 255, 255, 0.16);
    --mode-avatar-bg: rgba(255, 255, 255, 0.08);
    --hero-toggle-bg: rgba(36, 38, 44, 1);
    --hero-toggle-shadow: 0 1rem 2rem rgba(255, 255, 255, 0.08);
    --hero-toggle-hover-shadow: 0 1rem 2rem rgba(255, 255, 255, 0.12);
    --hero-toggle-icon-color: #f4f7ff;
    --hero-button-hover-shadow: 0 1.125rem 2.25rem rgba(255, 255, 255, 0.12);
    --hero-replays-hover-bg: rgba(44, 46, 54, 1);
    --app-background: linear-gradient(180deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
    --app-background-size: auto;
    --app-background-attachment: scroll;
    --app-background-repeat: no-repeat;
    --app-background-position: center;
    --panel-highlight: #c0c7fe;
  }

  :global(:root[data-theme='glass']) {
    --bg-gradient-start: rgba(8, 12, 20, 0.88);
    --bg-gradient-end: rgba(18, 6, 22, 0.9);
    --surface-primary: rgba(255, 255, 255, 0.1);
    --surface-secondary: rgba(255, 255, 255, 0.08);
    --surface-muted: rgba(255, 255, 255, 0.06);
    --surface-pill: rgba(255, 255, 255, 0.12);
    --surface-card: rgba(255, 255, 255, 0.1);
    --input-surface: rgba(255, 255, 255, 0.15);
    --input-border-color: rgba(255, 255, 255, 0.35);
    --chip-bg: rgba(255, 255, 255, 0.18);
    --chip-border-color: rgba(255, 255, 255, 0.4);
    --panel-gradient-primary: rgba(255, 255, 255, 0.12);
    --news-panel-gradient: rgba(255, 255, 255, 0.15);
    --card-gradient-blue: rgba(255, 255, 255, 0.12);
    --card-gradient-pink: rgba(255, 255, 255, 0.12);
    --card-gradient-purple: rgba(255, 255, 255, 0.12);
    --card-gradient-yellow: rgba(255, 255, 255, 0.12);
    --text-primary: #f5f6ff;
    --text-secondary: rgba(245, 246, 255, 0.85);
    --text-tertiary: rgba(245, 246, 255, 0.65);
    --text-quaternary: rgba(245, 246, 255, 0.45);
    --focus-outline-color: rgba(255, 255, 255, 0.6);
    --accent-primary: #9ecaff;
    --accent-primary-strong: #b3d6ff;
    --accent-secondary: #ffe194;
    --accent-rose: #ffb7d5;
    --accent-chip: rgba(255, 255, 255, 0.2);
    --shadow-outer: 0 1.5rem 4rem rgba(0, 0, 0, 0.35);
    --shadow-soft: 0 1rem 2.5rem rgba(0, 0, 0, 0.25);
    --shadow-inset: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
    --divider-color: rgba(255, 255, 255, 0.25);
    --divider-color-strong: rgba(255, 255, 255, 0.4);
    --icon-pill-bg: rgba(255, 255, 255, 0.2);
    --tab-active-gradient: rgba(255, 255, 255, 0.18);
    --tab-active-shadow: 0 0.75rem 1.625rem rgba(0, 0, 0, 0.35);
    --rank-top-gradient: rgba(255, 255, 255, 0.18);
    --rank-top-color: #ffe8a5;
    --rank-pill-bg: rgba(255, 255, 255, 0.22);
    --admin-submit-gradient: rgba(255, 255, 255, 0.15);
    --admin-submit-shadow: 0 1rem 2rem rgba(0, 0, 0, 0.4);
    --admin-submit-shadow-hover: 0 1.375rem 2.625rem rgba(0, 0, 0, 0.5);
    --danger-color: #ffb7d5;
    --danger-bg: rgba(255, 183, 213, 0.25);
    --danger-bg-hover: rgba(255, 183, 213, 0.35);
    --success-color: #92f5d4;
    --success-bg: rgba(146, 245, 212, 0.22);
    --success-bg-hover: rgba(146, 245, 212, 0.3);
    --stats-error-color: #ffb7d5;
    --home-button-gradient: rgba(255, 255, 255, 0.18);
    --home-button-shadow: 0 1.125rem 2.1875rem rgba(0, 0, 0, 0.35);
    --home-button-shadow-hover: 0 1.25rem 2.5rem rgba(0, 0, 0, 0.45);
    --home-button-color: #f5f6ff;
    --profile-button-gradient: rgba(255, 255, 255, 0.15);
    --profile-button-shadow: 0 1.125rem 2rem rgba(0, 0, 0, 0.3);
    --profile-button-hover-shadow: 0 1.5rem 2.75rem rgba(0, 0, 0, 0.4);
    --profile-avatar-bg: rgba(255, 255, 255, 0.22);
    --mode-card-shadow: 0 1.125rem 2.25rem rgba(0, 0, 0, 0.35);
    --mode-card-shadow-hover: 0 1.5rem 2.75rem rgba(0, 0, 0, 0.45);
    --mode-avatar-bg: rgba(255, 255, 255, 0.18);
    --hero-toggle-bg: rgba(255, 255, 255, 0.18);
    --hero-toggle-shadow: 0 1rem 2rem rgba(0, 0, 0, 0.35);
    --hero-toggle-hover-shadow: 0 1rem 2rem rgba(0, 0, 0, 0.45);
    --hero-toggle-icon-color: #f5f6ff;
    --hero-button-hover-shadow: 0 1.125rem 2.25rem rgba(0, 0, 0, 0.4);
    --hero-replays-hover-bg: rgba(255, 255, 255, 0.22);
    --panel-highlight: rgba(255, 255, 255, 0.22);
    --app-background: linear-gradient(180deg, rgba(4, 7, 15, 0.7), rgba(21, 6, 28, 0.85)), url('/backgrounds/backsak.jpg');
    --app-background-size: cover;
    --app-background-attachment: fixed;
    --app-background-repeat: no-repeat;
    --app-background-position: center;
  }

  /* Glass theme specific styles with backdrop-filter */
  :global(:root[data-theme='glass']) .theme-toggle,
  :global(:root[data-theme='glass']) .profile-nav-button,
  :global(:root[data-theme='glass']) .home-button,
  :global(:root[data-theme='glass']) .mode-card,
  :global(:root[data-theme='glass']) .theme-dropdown,
  :global(:root[data-theme='glass']) .theme-option,
  :global(:root[data-theme='glass']) .hero-nav-icon {
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.25);
  }

  :global(:root[data-theme='glass']) .profile-dropdown,
  :global(:root[data-theme='glass']) .leaderboard-card,
  :global(:root[data-theme='glass']) .global-stats-panel,
  :global(:root[data-theme='glass']) .admin-news-panel,
  :global(:root[data-theme='glass']) .hero-header,
  :global(:root[data-theme='glass']) .hero-footer {
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  :global(html, body) {
    overflow: hidden;
    height: 100vh;
    width: 100vw;
  }

  :global(body, #app) {
    height: 100%;
    min-height: 100vh;
    margin: 0;
    overflow: hidden;
    background: var(--app-background, linear-gradient(180deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%));
    background-size: var(--app-background-size, auto);
    background-attachment: var(--app-background-attachment, scroll);
    background-repeat: var(--app-background-repeat, no-repeat);
    background-position: var(--app-background-position, center);
    color: var(--text-primary);
    font-family: "Inter", "SF Pro Display", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .animeguess-page {
    width: 100%;
    height: fit-content;
    min-height: auto;
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
    margin: 0 auto;
  }

  .page-main.full-width {
    max-width: 100%;
    margin: 0;
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
    background: var(--news-panel-gradient);
    border-radius: 1.75rem;
    padding: 1.5rem 1.4rem 2rem;
    box-shadow: var(--shadow-outer);
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
    color: var(--text-tertiary);
    font-weight: 700;
  }

  .leaderboard-title {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 800;
    color: var(--text-primary);
  }

  .leaderboard-tabs {
    display: inline-flex;
    padding: 0.2rem;
    border-radius: 999px;
    background: var(--divider-color);
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
    color: var(--text-tertiary);
    transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
  }

  .leaderboard-tabs button.active {
    background: var(--tab-active-gradient);
    color: #fff;
    box-shadow: var(--tab-active-shadow);
  }

  .leaderboard-tabs button:not(.active):hover {
    color: var(--text-secondary);
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
    background: var(--surface-pill);
    box-shadow: var(--shadow-inset);
  }

  .leaderboard-list li.top {
    background: var(--accent-chip);
    box-shadow: var(--shadow-inset);
  }

  .leaderboard-rank {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.875rem;
    background: var(--rank-pill-bg);
    color: var(--accent-primary-strong);
    font-weight: 800;
    font-size: 0.9375rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .leaderboard-list li.top .leaderboard-rank {
    background: var(--rank-top-gradient);
    color: var(--rank-top-color);
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
    color: var(--text-primary);
    font-size: 0.875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    font-family: inherit;
  }
  
  .leaderboard-name.clickable {
    cursor: pointer;
    transition: color 0.2s ease;
  }
  
  .leaderboard-name.clickable:hover {
    color: var(--accent-primary-strong);
    white-space: nowrap;
  }

  .leaderboard-metric {
    font-size: 0.75rem;
    color: var(--text-secondary);
    letter-spacing: 0.03em;
  }

  .leaderboard-empty {
    justify-content: center;
    font-weight: 600;
    color: var(--text-secondary);
    font-size: 0.8rem;
    padding: 1.75rem 1.25rem;
  }

  .leaderboard-footer {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--text-quaternary);
    font-weight: 700;
    padding-bottom: 0.5rem;
  }

  .dashboard-row {
    display: flex;
    flex-wrap: nowrap;
    gap: 0.875rem;
    align-items: stretch;
    width: 100%;
  }

  .mode-cards-wrapper {
    flex: 1;
    min-width: 17.5rem;
  }

  .admin-news-panel {
    width: min(25vw, 320px);
    flex-shrink: 0;
    background: var(--news-panel-gradient);
    border-radius: 1.625rem;
    padding: 1.25rem;
    box-shadow: var(--shadow-outer);
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
    color: var(--text-tertiary);
    font-weight: 700;
  }

  .admin-news-title {
    margin: 0.2rem 0 0;
    font-size: 1.2rem;
    font-weight: 800;
    color: var(--text-primary);
  }

  .admin-news-role {
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text-tertiary);
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
    background: var(--chip-bg);
    box-shadow: inset 0 0 0 1px var(--chip-border-color);
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
    background: var(--input-surface);
    box-shadow: inset 0 0 0 1px var(--input-border-color);
    font-size: 0.875rem;
    color: var(--text-primary);
    resize: none;
    font-family: inherit;
  }

  .admin-news-input:focus-visible {
    outline: 2px solid var(--focus-outline-color);
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
    color: var(--text-secondary);
  }

  .admin-news-error {
    display: block;
    margin-top: 0.3rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--danger-color);
  }

  .admin-news-submit {
    border: none;
    border-radius: 999px;
    padding: 0.55rem 1.3rem;
    font-size: 0.8rem;
    font-weight: 700;
    background: var(--admin-submit-gradient);
    color: #fff;
    box-shadow: var(--admin-submit-shadow);
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
    box-shadow: var(--admin-submit-shadow-hover);
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
    background: var(--surface-secondary);
    border-radius: 1.125rem;
    padding: 0.8rem 1rem;
    box-shadow: inset 0 0 0 1px var(--input-border-color);
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
    color: var(--text-primary);
    line-height: 1.5;
  }

  .admin-news-list li span {
    font-size: 0.6875rem;
    color: var(--text-secondary);
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
    color: var(--text-secondary);
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
    background: var(--divider-color);
    color: var(--accent-primary-strong);
    cursor: pointer;
    transition: background 0.2s ease, transform 0.2s ease;
    white-space: nowrap;
  }

  .admin-news-btn:hover:not(:disabled) {
    background: var(--divider-color-strong);
    transform: translateY(-1px);
  }

  .admin-news-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .admin-news-delete {
    background: var(--danger-bg);
    color: var(--danger-color);
  }

  .admin-news-delete:hover:not(:disabled) {
    background: var(--danger-bg-hover);
  }

  .admin-news-save {
    background: var(--success-bg);
    color: var(--success-color);
  }

  .admin-news-save:hover:not(:disabled) {
    background: var(--success-bg-hover);
  }

  .admin-news-cancel {
    background: var(--divider-color);
  }

  .admin-news-edit-input {
    min-height: 4.5rem;
  }

  .admin-news-empty {
    background: var(--surface-secondary);
    border-radius: 1.125rem;
    padding: 1rem;
    font-size: 0.8rem;
    text-align: center;
    color: var(--text-secondary);
    box-shadow: inset 0 0 0 1px var(--input-border-color);
  }

  .admin-news-error-state {
    color: var(--danger-color);
    font-weight: 600;
  }

  .global-stats-panel {
    width: clamp(240px, 26vw, 310px);
    flex-shrink: 0;
    flex-grow: 0;
    margin-left: clamp(7rem, 13vw, 21rem);
    background: var(--news-panel-gradient);
    border-radius: 1.625rem;
    padding: 1.25rem;
    box-shadow: var(--shadow-outer);
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
    color: var(--text-tertiary);
    font-weight: 700;
  }

  .global-stats-title {
    margin: 0.2rem 0 0;
    font-size: 1.2rem;
    font-weight: 800;
    color: var(--text-primary);
  }

  .global-stats-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .stats-block {
    background: var(--surface-muted);
    border-radius: 1.25rem;
    padding: 0.8rem 1rem;
    box-shadow: inset 0 0 0 1px var(--input-border-color);
  }

  .stats-block h4 {
    margin: 0 0 0.5rem;
    font-size: 0.9rem;
    font-weight: 800;
    color: var(--text-primary);
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
    color: var(--text-primary);
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
    color: var(--accent-primary-strong);
  }

  .stats-empty {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-align: center;
    padding: 1rem 0;
  }

  .stats-loading {
    color: var(--text-primary);
  }

  .stats-error {
    color: var(--stats-error-color);
  }

  .hero-header {
    position: sticky;
    top: 0.5rem;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 2rem;
    padding: 1.5rem 1.875rem;
    min-height: 5rem;
    border-radius: 1.75rem;
    background: var(--news-panel-gradient);
    backdrop-filter: blur(20px) saturation(130%);
    box-shadow: var(--shadow-outer);
    margin-bottom: clamp(0.9rem, 1.5vw, 1.9rem);
    z-index: 200;
  }

  .hero-center {
    display: flex;
    justify-content: center;
    align-items: center;
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
    margin-left: clamp(-0.2rem, -0.3vw, -0.4rem);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.375rem;
    flex-wrap: wrap;
    padding: 1.25rem 1.875rem;
    border-radius: 1.75rem;
    background: var(--news-panel-gradient);
    box-shadow: var(--shadow-outer);
    width: calc(100% + clamp(1rem, 1.3vw, 1.6rem));
    box-sizing: border-box;
    position: relative;
  }

  .hero-logo {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .hero-game-info {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 1.5rem;
    justify-content: center;
  }

  .hero-game-title {
    font-size: clamp(1.375rem, 3vw, 1.875rem);
    font-weight: 900;
    color: var(--accent-primary, #9ecaff);
    letter-spacing: 2px;
    white-space: nowrap;
  }

  .hero-game-round {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .hero-round-text {
    font-size: clamp(0.9375rem, 2vw, 1.125rem);
    font-weight: 700;
    color: var(--text-primary, #f5f6ff);
    white-space: nowrap;
  }

  .hero-difficulty-badge {
    background: var(--accent-primary, #9ecaff);
    color: var(--text-primary, #f5f6ff);
    padding: 0.3rem 0.75rem;
    border-radius: 999px;
    font-size: clamp(0.75rem, 1.5vw, 0.875rem);
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
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
    background: var(--home-button-gradient);
    box-shadow: var(--home-button-shadow);
    color: var(--home-button-color);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .home-button:hover {
    transform: translateY(-2px);
    box-shadow: var(--home-button-shadow-hover);
  }

  .home-button:focus-visible {
    outline: 2px solid var(--focus-outline-color);
    outline-offset: 3px;
  }

  .hero-title {
    font-size: 2rem;
    font-weight: 800;
    color: var(--text-primary);
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
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    transition: transform 0.2s ease, color 0.2s ease;
  }

  .hero-nav-item:hover {
    color: var(--accent-primary);
    transform: translateY(-2px);
  }

  .hero-nav-item:focus-visible {
    outline: 2px solid var(--focus-outline-color);
    outline-offset: 3px;
  }

  .hero-nav-icon {
    font-size: 1.1rem;
    background: var(--icon-pill-bg);
    color: var(--hero-toggle-icon-color);
    padding: 0.35rem 0.6rem;
    border-radius: 999px;
  }

  .theme-toggle {
    border: none;
    border-radius: 999px;
    padding: 0.45rem 0.95rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: var(--hero-toggle-bg);
    color: var(--text-primary);
    font-weight: 600;
    font-size: 0.82rem;
    cursor: pointer;
    box-shadow: var(--hero-toggle-shadow);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .theme-toggle:hover {
    transform: translateY(-2px);
    box-shadow: var(--hero-toggle-hover-shadow);
  }

  .theme-toggle:focus-visible {
    outline: 2px solid var(--focus-outline-color);
    outline-offset: 3px;
  }

  .theme-toggle-icon {
    font-size: 1rem;
    color: var(--hero-toggle-icon-color);
  }

  .theme-toggle-label {
    white-space: nowrap;
  }

  .theme-selector {
    position: relative;
  }

  .theme-dropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 0.6rem);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    background: var(--surface-primary);
    border-radius: 1.125rem;
    box-shadow: var(--shadow-outer);
    padding: 0.5rem;
    min-width: 10rem;
    z-index: 400;
  }

  .theme-option {
    border: none;
    border-radius: 0.75rem;
    padding: 0.45rem 0.75rem;
    background: transparent;
    color: var(--text-primary);
    font-weight: 600;
    cursor: pointer;
    text-align: left;
    transition: background 0.2s ease, color 0.2s ease;
  }

  .theme-option:hover {
    background: var(--divider-color);
  }

  .theme-option.active {
    background: var(--hero-toggle-bg);
    color: var(--accent-primary);
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
    background: var(--profile-button-gradient);
    color: var(--text-primary);
    font-weight: 700;
    font-size: 0.875rem;
    box-shadow: var(--profile-button-shadow);
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
  }

  .profile-nav-button:hover {
    transform: translateY(-3px);
    box-shadow: var(--profile-button-hover-shadow);
    color: var(--accent-primary-strong);
  }

  .profile-nav-button:focus-visible {
    outline: 2px solid var(--focus-outline-color);
    outline-offset: 3px;
  }

  .profile-nav-avatar {
    width: 2.125rem;
    height: 2.125rem;
    border-radius: 50%;
    background: var(--profile-avatar-bg);
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
    background: var(--panel-gradient-primary);
    border-radius: 1.25rem;
    box-shadow: var(--shadow-outer);
    padding: 1rem;
    z-index: 600;
    backdrop-filter: blur(20px);
  }

  :global(:root[data-theme='glass']) .profile-dropdown {
    background: rgba(255, 255, 255, 0.7);
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
    background: var(--card-bg);
    box-shadow: var(--mode-card-shadow);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .mode-card:hover {
    transform: translateY(-6px);
    box-shadow: var(--mode-card-shadow-hover);
  }

  .mode-card:focus-visible {
    outline: 2px solid var(--focus-outline-color);
    outline-offset: 4px;
  }

  .mode-avatar {
    width: 6.125rem;
    height: 6.125rem;
    border-radius: 1.5rem;
    background: var(--mode-avatar-bg);
    box-shadow: 0 0.75rem 1.75rem rgba(0, 0, 0, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    color: var(--card-accent);
  }

  .mode-label {
    font-size: 0.9375rem;
    font-weight: 800;
    color: var(--text-primary);
    letter-spacing: 0.05em;
  }

  .mode-description {
    font-size: 0.8rem;
    color: var(--text-secondary);
    max-width: 13.75rem;
    line-height: 1.4;
  }

  .hero-achievements {
    background: var(--news-panel-gradient);
    border-radius: 1.375rem;
    padding: 1rem 1.625rem;
    display: flex;
    align-items: center;
    gap: 1.25rem;
    box-shadow: var(--shadow-soft);
    flex-wrap: wrap;
  }

  .hero-achievements-title {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    white-space: nowrap;
  }

  .hero-achievements-value {
    font-size: 1.75rem;
    font-weight: 800;
    color: var(--accent-secondary);
    white-space: nowrap;
  }

  .hero-achievements-meta {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .hero-replays-button {
    border: none;
    background: var(--panel-gradient-primary);
    border-radius: 1.375rem;
    padding: 1rem 1.625rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    box-shadow: var(--shadow-soft);
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    font-family: inherit;
  }

  .hero-replays-button:hover {
    transform: translateY(-2px);
    box-shadow: var(--hero-button-hover-shadow);
    background: var(--hero-replays-hover-bg);
  }

  .hero-replays-button:active {
    transform: translateY(0);
  }

  .hero-replays-button:focus-visible {
    outline: 2px solid var(--focus-outline-color);
    outline-offset: 3px;
  }

  .hero-replays-icon {
    font-size: 1.375rem;
    color: var(--hero-toggle-icon-color);
  }

  .hero-replays-label {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .hero-replays-button:hover .hero-replays-label {
    color: var(--accent-primary-strong);
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
      margin-left: clamp(7rem, calc(7rem + (100vw - 1920px) * 0.0109), 7.7rem); /* Плавное увеличение от 7rem до 7.7rem */
    }

    .admin-news-panel {
      width: min(25vw, calc(320px + (100vw - 1920px) * 0.23)); /* Плавное увеличение от 320px до 467px */
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
      margin-left: clamp(7.7rem, 15vw, 27.5rem); /* Увеличенный отступ для правильного позиционирования на 2K */
    }

    .admin-news-panel {
      width: min(25vw, 448px); /* 320px * 1.4 */
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
      width: min(25vw, 715px); /* 320px * 2.235 */
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
      background: var(--divider-color);
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

  /* Notifications alignment next to profile */
  .profile-nav-wrapper {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .notification-wrapper {
    display: flex;
    align-items: center;
  }

  .notification-button {
    min-width: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.35rem 0.75rem;
  }

  .notifications-dropdown {
    min-width: 15rem;
  }

  .notifications-header {
    padding: 0.6rem 0.8rem;
    font-weight: 700;
    color: var(--text-secondary);
  }

  .notifications-empty {
    padding: 0.8rem;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .notifications-list {
    list-style: none;
    margin: 0;
    padding: 0.5rem 0.4rem 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .notification-item {
    padding: 0.5rem 0.55rem;
    border-radius: 0.85rem;
    background: var(--surface-secondary);
    box-shadow: inset 0 0 0 1px var(--divider-color);
  }

  .notification-title {
    font-weight: 700;
    color: var(--text-primary);
    font-size: 0.9rem;
    margin-bottom: 0.15rem;
  }

  .notification-message {
    color: var(--text-secondary);
    font-size: 0.82rem;
    margin-bottom: 0.15rem;
  }

  .notification-meta {
    color: var(--text-tertiary);
    font-size: 0.75rem;
  }

  .notif-dot {
    position: absolute;
    top: -0.3rem;
    right: -0.35rem;
    border-radius: 999px;
  }

  .notif-dot-count {
    background: #ff3b82;
    color: #fff;
    font-size: 0.7rem;
    padding: 0.1rem 0.4rem;
    min-width: 1.25rem;
    text-align: center;
    font-weight: 800;
    box-shadow: 0 0.35rem 0.9rem rgba(255, 59, 130, 0.35);
  }

  .notif-dot-faded {
    width: 0.5rem;
    height: 0.5rem;
    background: rgba(255, 255, 255, 0.55);
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
