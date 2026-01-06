<script>
  import { onMount } from 'svelte';
  import { publicProfileUserId, goToPublicProfile } from '../stores/ui';
  import { publicUser, publicUserLoading, publicUserError, loadPublicUser, clearPublicUser } from '../stores/users';
  import { currentUser, friends, friendProfiles, refreshFriendState } from '../stores/authApi';
  import { sendFriendRequest, removeFriend, friendRequestsOutgoing } from '../stores/authApi';

  let lastId = null;
  let requestSending = false;
  let requestSent = false;
  let activeTab = 'stats';

  $: targetId = $publicProfileUserId;
  $: if (targetId && targetId !== lastId) {
    lastId = targetId;
    loadPublicUser(targetId);
    requestSent = false;
  }

  // Загружаем друзей если это наш профиль
  $: isMe = $currentUser?.id && $publicUser?.id && $currentUser.id === $publicUser.id;
  $: if (isMe && $currentUser) {
    refreshFriendState();
  }

  onMount(() => {
    if (targetId) loadPublicUser(targetId);
    return () => clearPublicUser();
  });

  async function handleAddFriend() {
    if (!$publicUser?.username || requestSending) return;
    requestSending = true;
    try {
      await sendFriendRequest($publicUser.username);
      requestSent = true;
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Не удалось отправить заявку');
    } finally {
      requestSending = false;
    }
  }

  async function handleRemoveFriend() {
    if (!$publicUser?.id || requestSending) return;
    requestSending = true;
    try {
      await removeFriend($publicUser.id);
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Не удалось удалить из друзей');
    } finally {
      requestSending = false;
    }
  }

  $: alreadyFriend = ($friends || []).includes($publicUser?.id);
  $: pendingRequest = ($friendRequestsOutgoing || []).some(r => r.toId === $publicUser?.id);
  
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  }

  function getAvatarGradient(name) {
    const colors = [
      ['#ff6b6b', '#ee5a24'],
      ['#74b9ff', '#0984e3'],
      ['#55efc4', '#00b894'],
      ['#fd79a8', '#e84393'],
      ['#a29bfe', '#6c5ce7'],
      ['#ffeaa7', '#fdcb6e'],
      ['#81ecec', '#00cec9'],
      ['#fab1a0', '#e17055'],
    ];
    const index = (name?.charCodeAt(0) || 0) % colors.length;
    return `linear-gradient(135deg, ${colors[index][0]} 0%, ${colors[index][1]} 100%)`;
  }

  function handleFriendClick(friend) {
    if (friend?.id && friend?.username) {
      goToPublicProfile(friend.id, friend.username);
    }
  }

  // Моковые достижения (потом заменить на реальные из API)
  const achievements = [
    { id: 1, icon: '🎯', name: 'Первое попадание', desc: 'Угадай аниме с первой попытки', unlocked: true },
    { id: 2, icon: '🔥', name: 'В огне', desc: '7 дней подряд на сайте', unlocked: true },
    { id: 3, icon: '🏆', name: 'Чемпион', desc: 'Попади в топ-10 лидерборда', unlocked: false },
    { id: 4, icon: '🎵', name: 'Меломан', desc: 'Угадай 50 опенингов', unlocked: true },
    { id: 5, icon: '👥', name: 'Социальный', desc: 'Добавь 10 друзей', unlocked: false },
    { id: 6, icon: '⚡', name: 'Молниеносный', desc: 'Угадай за 5 секунд', unlocked: false },
  ];

  // Моковая история игр
  const gameHistory = [
    { id: 1, mode: 'Угадай аниме', result: 'Победа', score: 150, date: '2025-01-06' },
    { id: 2, mode: 'Угадай опенинг', result: 'Победа', score: 200, date: '2025-01-05' },
    { id: 3, mode: 'Угадай персонажа', result: 'Поражение', score: 50, date: '2025-01-05' },
    { id: 4, mode: 'Аниме баттлы', result: 'Победа', score: 300, date: '2025-01-04' },
  ];
</script>

<div class="profile-page">
  {#if $publicUserLoading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <span>Загрузка профиля...</span>
    </div>
  {:else if $publicUserError}
    <div class="error-state">
      <div class="error-icon">😕</div>
      <h2>Пользователь не найден</h2>
      <p>{$publicUserError}</p>
    </div>
  {:else if !$publicUser}
    <div class="empty-state">
      <div class="empty-icon">👤</div>
      <h2>Профиль не выбран</h2>
      <p>Выберите пользователя из списка друзей или лидерборда</p>
    </div>
  {:else}
    <div class="profile-layout">
      <!-- Левая колонка - информация о пользователе -->
      <aside class="profile-sidebar">
        <div class="profile-card">
          <div class="avatar-container">
            <div class="avatar-glow" style="background: {getAvatarGradient($publicUser.username)}"></div>
            {#if $publicUser.avatarUrl}
              <img class="avatar-image" src={$publicUser.avatarUrl} alt="{$publicUser.username}" />
            {:else}
              <div class="avatar-placeholder" style="background: {getAvatarGradient($publicUser.username)}">
                {($publicUser.username?.[0] || 'U').toUpperCase()}
              </div>
            {/if}
            {#if $publicUser.isAdmin || $publicUser.is_admin}
              <div class="admin-crown">👑</div>
            {/if}
          </div>

          <div class="user-details">
            <div class="username-row">
              <h1 class="username">{$publicUser.username}</h1>
              {#if $publicUser.isAdmin || $publicUser.is_admin}
                <span class="admin-badge">Админ</span>
              {/if}
            </div>
            <div class="user-handle">@{$publicUser.username}</div>
            
            <div class="user-meta">
              <div class="meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>С {formatDate($publicUser.createdAt)}</span>
              </div>
            </div>
          </div>

          <!-- Кнопки действий -->
          {#if !isMe}
            <div class="action-buttons">
              {#if alreadyFriend}
                <button class="action-button friend" disabled={requestSending} on:click={handleRemoveFriend}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <line x1="18" y1="8" x2="23" y2="13"></line>
                    <line x1="23" y1="8" x2="18" y2="13"></line>
                  </svg>
                  <span>{requestSending ? 'Удаление...' : 'Удалить из друзей'}</span>
                </button>
              {:else if pendingRequest || requestSent}
                <button class="action-button pending" disabled>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <span>Заявка отправлена</span>
                </button>
              {:else}
                <button class="action-button add" disabled={requestSending} on:click={handleAddFriend}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <line x1="20" y1="8" x2="20" y2="14"></line>
                    <line x1="23" y1="11" x2="17" y2="11"></line>
                  </svg>
                  <span>{requestSending ? 'Отправка...' : 'Добавить в друзья'}</span>
                </button>
              {/if}
            </div>
          {:else}
            <div class="self-indicator">
              <span>✨ Это ваш профиль</span>
            </div>
          {/if}
        </div>

        <!-- Быстрая статистика -->
        <div class="quick-stats">
          <div class="quick-stat">
            <span class="quick-stat-value">{$publicUser.gamesPlayed || 0}</span>
            <span class="quick-stat-label">Игр</span>
          </div>
          <div class="quick-stat">
            <span class="quick-stat-value">{$publicUser.totalScore || 0}</span>
            <span class="quick-stat-label">Очков</span>
          </div>
          <div class="quick-stat">
            <span class="quick-stat-value">{$publicUser.streak || 0}</span>
            <span class="quick-stat-label">Стрик</span>
          </div>
          <div class="quick-stat">
            <span class="quick-stat-value">{($friends || []).length}</span>
            <span class="quick-stat-label">Друзей</span>
          </div>
        </div>
      </aside>

      <!-- Правая колонка - контент -->
      <main class="profile-main">
        <!-- Табы -->
        <div class="tabs-container">
          <button 
            class="tab-button" 
            class:active={activeTab === 'stats'}
            on:click={() => activeTab = 'stats'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            Статистика
          </button>
          <button 
            class="tab-button" 
            class:active={activeTab === 'achievements'}
            on:click={() => activeTab = 'achievements'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="8" r="7"></circle>
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
            </svg>
            Достижения
          </button>
          <button 
            class="tab-button" 
            class:active={activeTab === 'history'}
            on:click={() => activeTab = 'history'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            История
          </button>
          {#if isMe}
            <button 
              class="tab-button" 
              class:active={activeTab === 'friends'}
              on:click={() => activeTab = 'friends'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              Друзья
            </button>
          {/if}
        </div>

        <!-- Контент табов -->
        <div class="tab-content">
          {#if activeTab === 'stats'}
            <div class="stats-grid">
              <div class="stat-card large">
                <div class="stat-icon">🎮</div>
                <div class="stat-info">
                  <div class="stat-value">{$publicUser.gamesPlayed || 0}</div>
                  <div class="stat-label">Всего игр сыграно</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">🏆</div>
                <div class="stat-info">
                  <div class="stat-value">{$publicUser.totalScore || 0}</div>
                  <div class="stat-label">Общий счёт</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">🔥</div>
                <div class="stat-info">
                  <div class="stat-value">{$publicUser.streak || 0}</div>
                  <div class="stat-label">Дней подряд</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">⭐</div>
                <div class="stat-info">
                  <div class="stat-value">{$publicUser.achievements || 0}</div>
                  <div class="stat-label">Достижений</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">🎯</div>
                <div class="stat-info">
                  <div class="stat-value">{$publicUser.accuracy || 0}%</div>
                  <div class="stat-label">Точность</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">⚡</div>
                <div class="stat-info">
                  <div class="stat-value">{$publicUser.bestTime || '—'}</div>
                  <div class="stat-label">Лучшее время</div>
                </div>
              </div>
            </div>

            <!-- Прогресс по режимам -->
            <div class="modes-section">
              <h3 class="section-title">Прогресс по режимам</h3>
              <div class="modes-grid">
                <div class="mode-progress">
                  <div class="mode-header">
                    <span class="mode-icon">🎧</span>
                    <span class="mode-name">Угадай аниме</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-fill" style="width: 65%"></div>
                  </div>
                  <div class="mode-stats">
                    <span>65 / 100</span>
                    <span>65%</span>
                  </div>
                </div>
                <div class="mode-progress">
                  <div class="mode-header">
                    <span class="mode-icon">🗡️</span>
                    <span class="mode-name">Угадай персонажа</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-fill purple" style="width: 40%"></div>
                  </div>
                  <div class="mode-stats">
                    <span>40 / 100</span>
                    <span>40%</span>
                  </div>
                </div>
                <div class="mode-progress">
                  <div class="mode-header">
                    <span class="mode-icon">🎵</span>
                    <span class="mode-name">Угадай опенинг</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-fill pink" style="width: 80%"></div>
                  </div>
                  <div class="mode-stats">
                    <span>80 / 100</span>
                    <span>80%</span>
                  </div>
                </div>
                <div class="mode-progress">
                  <div class="mode-header">
                    <span class="mode-icon">⚔️</span>
                    <span class="mode-name">Аниме баттлы</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-fill orange" style="width: 25%"></div>
                  </div>
                  <div class="mode-stats">
                    <span>25 / 100</span>
                    <span>25%</span>
                  </div>
                </div>
              </div>
            </div>

          {:else if activeTab === 'achievements'}
            <div class="achievements-grid">
              {#each achievements as achievement (achievement.id)}
                <div class="achievement-card" class:locked={!achievement.unlocked}>
                  <div class="achievement-icon">{achievement.icon}</div>
                  <div class="achievement-info">
                    <div class="achievement-name">{achievement.name}</div>
                    <div class="achievement-desc">{achievement.desc}</div>
                  </div>
                  {#if achievement.unlocked}
                    <div class="achievement-check">✓</div>
                  {:else}
                    <div class="achievement-lock">🔒</div>
                  {/if}
                </div>
              {/each}
            </div>

          {:else if activeTab === 'history'}
            <div class="history-list">
              {#each gameHistory as game (game.id)}
                <div class="history-item">
                  <div class="history-mode">{game.mode}</div>
                  <div class="history-result" class:win={game.result === 'Победа'} class:lose={game.result === 'Поражение'}>
                    {game.result}
                  </div>
                  <div class="history-score">+{game.score}</div>
                  <div class="history-date">{game.date}</div>
                </div>
              {/each}
              {#if gameHistory.length === 0}
                <div class="empty-history">
                  <span>📝</span>
                  <p>История игр пуста</p>
                </div>
              {/if}
            </div>

          {:else if activeTab === 'friends' && isMe}
            <div class="friends-grid">
              {#if $friendProfiles && $friendProfiles.length > 0}
                {#each $friendProfiles as friend (friend.id)}
                  <button class="friend-card" on:click={() => handleFriendClick(friend)}>
                    <div class="friend-avatar" style="background: {getAvatarGradient(friend.username)}">
                      {#if friend.avatarUrl}
                        <img src={friend.avatarUrl} alt={friend.username} />
                      {:else}
                        {(friend.username?.[0] || '?').toUpperCase()}
                      {/if}
                    </div>
                    <div class="friend-info">
                      <div class="friend-name">{friend.username}</div>
                      <div class="friend-status">Онлайн</div>
                    </div>
                  </button>
                {/each}
              {:else}
                <div class="empty-friends">
                  <span>👥</span>
                  <p>Пока нет друзей</p>
                  <span class="empty-hint">Добавляйте друзей из лидерборда!</span>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </main>
    </div>
  {/if}
</div>

<style>
  .profile-page {
    min-height: 100%;
    padding: 1rem clamp(1rem, 3vw, 2rem);
    color: var(--text-primary, #f5f6ff);
  }

  /* Состояния */
  .loading-state, .error-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
  }

  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--accent-primary, #9ecaff);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-icon, .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .error-state h2, .empty-state h2 {
    font-size: 1.5rem;
    font-weight: 800;
    margin: 0 0 0.5rem;
  }

  .error-state p, .empty-state p {
    color: var(--text-secondary);
    margin: 0;
  }

  /* Layout */
  .profile-layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 1.5rem;
    max-width: 1100px;
  }

  /* Сайдбар */
  .profile-sidebar {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .profile-card {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 1.5rem;
    padding: 1.5rem;
    backdrop-filter: blur(20px);
    text-align: center;
  }

  .avatar-container {
    position: relative;
    width: 120px;
    height: 120px;
    margin: 0 auto 1rem;
  }

  .avatar-glow {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    opacity: 0.5;
    filter: blur(15px);
  }

  .avatar-image, .avatar-placeholder {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 3px solid rgba(255, 255, 255, 0.2);
    object-fit: cover;
  }

  .avatar-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    font-weight: 800;
    color: white;
  }

  .admin-crown {
    position: absolute;
    top: -8px;
    right: -4px;
    font-size: 1.5rem;
  }

  .user-details {
    margin-bottom: 1rem;
  }

  .username-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .username {
    font-size: 1.5rem;
    font-weight: 900;
    margin: 0;
  }

  .admin-badge {
    padding: 0.2rem 0.6rem;
    background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
    border-radius: 999px;
    color: #1a1a2e;
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  .user-handle {
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin-top: 0.25rem;
  }

  .user-meta {
    margin-top: 0.75rem;
  }

  .meta-item {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .meta-item svg {
    width: 14px;
    height: 14px;
    opacity: 0.7;
  }

  .action-buttons {
    margin-top: 1rem;
  }

  .action-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 999px;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-button svg {
    width: 18px;
    height: 18px;
  }

  .action-button.add {
    background: linear-gradient(135deg, #55efc4 0%, #00b894 100%);
    color: #1a1a2e;
  }

  .action-button.friend {
    background: rgba(255, 107, 107, 0.15);
    color: #ff6b6b;
    border: 1px solid rgba(255, 107, 107, 0.3);
  }

  .action-button.pending {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-secondary);
  }

  .action-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .self-indicator {
    margin-top: 1rem;
    padding: 0.6rem 1rem;
    background: rgba(158, 202, 255, 0.15);
    border: 1px solid rgba(158, 202, 255, 0.3);
    border-radius: 999px;
    color: var(--accent-primary);
    font-weight: 600;
    font-size: 0.85rem;
  }

  /* Quick Stats */
  .quick-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .quick-stat {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    padding: 1rem;
    text-align: center;
  }

  .quick-stat-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 900;
    color: var(--accent-primary);
  }

  .quick-stat-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Main Content */
  .profile-main {
    min-width: 0;
  }

  /* Tabs */
  .tabs-container {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 1rem;
    margin-bottom: 1.5rem;
    overflow-x: auto;
  }

  .tab-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: transparent;
    border: none;
    border-radius: 0.75rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .tab-button svg {
    width: 18px;
    height: 18px;
  }

  .tab-button:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.05);
  }

  .tab-button.active {
    background: rgba(158, 202, 255, 0.2);
    color: var(--accent-primary);
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1.25rem;
    padding: 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: transform 0.2s, border-color 0.2s;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .stat-card.large {
    grid-column: span 2;
  }

  .stat-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .stat-info {
    min-width: 0;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 900;
  }

  .stat-label {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  /* Modes Section */
  .modes-section {
    margin-top: 1rem;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 0 0 1rem;
  }

  .modes-grid {
    display: grid;
    gap: 1rem;
  }

  .mode-progress {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    padding: 1rem;
  }

  .mode-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .mode-icon {
    font-size: 1.25rem;
  }

  .mode-name {
    font-weight: 600;
  }

  .progress-bar {
    height: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #9ecaff, #7eb8ff);
    border-radius: 999px;
    transition: width 0.3s ease;
  }

  .progress-fill.purple {
    background: linear-gradient(90deg, #a29bfe, #6c5ce7);
  }

  .progress-fill.pink {
    background: linear-gradient(90deg, #fd79a8, #e84393);
  }

  .progress-fill.orange {
    background: linear-gradient(90deg, #ffeaa7, #fdcb6e);
  }

  .mode-stats {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  /* Achievements */
  .achievements-grid {
    display: grid;
    gap: 0.75rem;
  }

  .achievement-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    padding: 1rem;
    transition: all 0.2s ease;
  }

  .achievement-card:hover {
    border-color: rgba(255, 255, 255, 0.2);
  }

  .achievement-card.locked {
    opacity: 0.5;
  }

  .achievement-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .achievement-info {
    flex: 1;
    min-width: 0;
  }

  .achievement-name {
    font-weight: 700;
    margin-bottom: 0.2rem;
  }

  .achievement-desc {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .achievement-check {
    width: 28px;
    height: 28px;
    background: linear-gradient(135deg, #55efc4, #00b894);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1a1a2e;
    font-weight: 700;
  }

  .achievement-lock {
    font-size: 1.25rem;
    opacity: 0.5;
  }

  /* History */
  .history-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .history-item {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    gap: 1rem;
    align-items: center;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    padding: 1rem 1.25rem;
  }

  .history-mode {
    font-weight: 600;
  }

  .history-result {
    padding: 0.3rem 0.75rem;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .history-result.win {
    background: rgba(85, 239, 196, 0.2);
    color: #55efc4;
  }

  .history-result.lose {
    background: rgba(255, 107, 107, 0.2);
    color: #ff6b6b;
  }

  .history-score {
    color: var(--accent-primary);
    font-weight: 700;
  }

  .history-date {
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .empty-history, .empty-friends {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
  }

  .empty-history span, .empty-friends span {
    font-size: 3rem;
    display: block;
    margin-bottom: 1rem;
  }

  .empty-hint {
    font-size: 0.85rem;
    opacity: 0.7;
  }

  /* Friends */
  .friends-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }

  .friend-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
  }

  .friend-card:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
  }

  .friend-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    font-weight: 700;
    color: white;
    flex-shrink: 0;
    overflow: hidden;
  }

  .friend-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .friend-info {
    min-width: 0;
  }

  .friend-name {
    font-weight: 700;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .friend-status {
    font-size: 0.8rem;
    color: #55efc4;
  }

  /* Responsive */
  @media (max-width: 900px) {
    .profile-layout {
      grid-template-columns: 1fr;
    }

    .profile-sidebar {
      order: -1;
    }

    .quick-stats {
      grid-template-columns: repeat(4, 1fr);
    }

    .stat-card.large {
      grid-column: span 1;
    }
  }

  @media (max-width: 600px) {
    .quick-stats {
      grid-template-columns: repeat(2, 1fr);
    }

    .tabs-container {
      flex-wrap: nowrap;
      justify-content: flex-start;
      -webkit-overflow-scrolling: touch;
    }

    .history-item {
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }

    .history-date {
      grid-column: span 2;
    }
  }
</style>
