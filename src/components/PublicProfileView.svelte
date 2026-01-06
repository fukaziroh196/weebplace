<script>
  import { onMount } from 'svelte';
  import { publicProfileUserId, goHome } from '../stores/ui';
  import { publicUser, publicUserLoading, publicUserError, loadPublicUser, clearPublicUser } from '../stores/users';
  import { currentUser } from '../stores/authApi';
  import { sendFriendRequest, removeFriend, friends, friendRequestsOutgoing } from '../stores/authApi';

  let lastId = null;
  let requestSending = false;
  let requestSent = false;

  $: targetId = $publicProfileUserId;
  $: if (targetId && targetId !== lastId) {
    lastId = targetId;
    loadPublicUser(targetId);
    requestSent = false;
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

  $: isMe = $currentUser?.id && $publicUser?.id && $currentUser.id === $publicUser.id;
  $: alreadyFriend = ($friends || []).includes($publicUser?.id);
  $: pendingRequest = ($friendRequestsOutgoing || []).some(r => r.toId === $publicUser?.id);
  
  // Форматирование даты
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  }

  // Генерация цвета аватара по имени
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
</script>

<div class="profile-page">
  <!-- Фоновый эффект -->
  <div class="profile-bg-effect"></div>
  
  <!-- Навигация -->
  <nav class="profile-nav">
    <button class="back-button" on:click={() => goHome()}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      <span>Назад</span>
    </button>
  </nav>

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
      <button class="primary-button" on:click={() => goHome()}>На главную</button>
    </div>
  {:else if !$publicUser}
    <div class="empty-state">
      <div class="empty-icon">👤</div>
      <h2>Профиль не выбран</h2>
      <p>Выберите пользователя из списка друзей или лидерборда</p>
    </div>
  {:else}
    <div class="profile-content">
      <!-- Главная карточка профиля -->
      <div class="profile-hero">
        <div class="avatar-section">
          <div class="avatar-wrapper">
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
        </div>

        <div class="user-info">
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
              <span>На сайте с {formatDate($publicUser.createdAt)}</span>
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
            <div class="self-badge">
              <span>Это вы</span>
            </div>
          {/if}
        </div>
      </div>

      <!-- Статистика -->
      <div class="stats-section">
        <h2 class="section-title">Статистика</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">🎮</div>
            <div class="stat-value">{$publicUser.gamesPlayed || 0}</div>
            <div class="stat-label">Игр сыграно</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🏆</div>
            <div class="stat-value">{$publicUser.totalScore || 0}</div>
            <div class="stat-label">Общий счёт</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🔥</div>
            <div class="stat-value">{$publicUser.streak || 0}</div>
            <div class="stat-label">Дней подряд</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⭐</div>
            <div class="stat-value">{$publicUser.achievements || 0}</div>
            <div class="stat-label">Достижений</div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .profile-page {
    min-height: 100%;
    padding: 1rem clamp(1rem, 4vw, 3rem);
    position: relative;
    color: var(--text-primary, #f5f6ff);
  }

  .profile-bg-effect {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(158, 202, 255, 0.15) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  /* Навигация */
  .profile-nav {
    position: relative;
    z-index: 10;
    margin-bottom: 2rem;
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1.2rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 999px;
    color: var(--text-primary, #f5f6ff);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    backdrop-filter: blur(10px);
  }

  .back-button:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateX(-4px);
  }

  .back-button svg {
    width: 18px;
    height: 18px;
  }

  /* Состояния загрузки и ошибок */
  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    position: relative;
    z-index: 10;
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

  .error-icon,
  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .error-state h2,
  .empty-state h2 {
    font-size: 1.5rem;
    font-weight: 800;
    margin: 0 0 0.5rem;
  }

  .error-state p,
  .empty-state p {
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    margin: 0 0 1.5rem;
  }

  .primary-button {
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #9ecaff 0%, #7eb8ff 100%);
    border: none;
    border-radius: 999px;
    color: #1a1a2e;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .primary-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(158, 202, 255, 0.3);
  }

  /* Контент профиля */
  .profile-content {
    position: relative;
    z-index: 10;
    max-width: 800px;
    margin: 0 auto;
  }

  /* Главная карточка */
  .profile-hero {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 2rem;
    padding: 2rem;
    backdrop-filter: blur(20px);
    display: flex;
    gap: 2rem;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  /* Аватар */
  .avatar-section {
    flex-shrink: 0;
  }

  .avatar-wrapper {
    position: relative;
    width: 140px;
    height: 140px;
  }

  .avatar-glow {
    position: absolute;
    inset: -4px;
    border-radius: 2rem;
    opacity: 0.6;
    filter: blur(20px);
    animation: pulse-glow 3s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.05); }
  }

  .avatar-image,
  .avatar-placeholder {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 1.5rem;
    border: 3px solid rgba(255, 255, 255, 0.2);
    object-fit: cover;
  }

  .avatar-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3.5rem;
    font-weight: 800;
    color: white;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  }

  .admin-crown {
    position: absolute;
    top: -12px;
    right: -8px;
    font-size: 1.8rem;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
    animation: bounce 2s ease-in-out infinite;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }

  /* Информация о пользователе */
  .user-info {
    flex: 1;
    min-width: 0;
  }

  .username-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .username {
    font-size: clamp(1.5rem, 4vw, 2.2rem);
    font-weight: 900;
    margin: 0;
    background: linear-gradient(135deg, #ffffff 0%, #e0e0ff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .admin-badge {
    padding: 0.3rem 0.8rem;
    background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
    border-radius: 999px;
    color: #1a1a2e;
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .user-handle {
    font-size: 1rem;
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
    margin-top: 0.25rem;
  }

  .user-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 1rem;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    font-size: 0.9rem;
  }

  .meta-item svg {
    width: 16px;
    height: 16px;
    opacity: 0.7;
  }

  /* Кнопки действий */
  .action-buttons {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
    flex-wrap: wrap;
  }

  .action-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 999px;
    font-size: 0.95rem;
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
    box-shadow: 0 4px 15px rgba(85, 239, 196, 0.3);
  }

  .action-button.add:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(85, 239, 196, 0.4);
  }

  .action-button.friend {
    background: rgba(255, 107, 107, 0.15);
    color: #ff6b6b;
    border: 1px solid rgba(255, 107, 107, 0.3);
  }

  .action-button.friend:hover:not(:disabled) {
    background: rgba(255, 107, 107, 0.25);
  }

  .action-button.pending {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .action-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .self-badge {
    margin-top: 1.5rem;
    padding: 0.5rem 1rem;
    background: rgba(158, 202, 255, 0.15);
    border: 1px solid rgba(158, 202, 255, 0.3);
    border-radius: 999px;
    color: var(--accent-primary, #9ecaff);
    font-weight: 600;
    font-size: 0.9rem;
    display: inline-block;
  }

  /* Секция статистики */
  .stats-section {
    margin-top: 1.5rem;
  }

  .section-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 0 0 1rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1rem;
  }

  .stat-card {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1.25rem;
    padding: 1.25rem;
    text-align: center;
    backdrop-filter: blur(10px);
    transition: transform 0.2s, border-color 0.2s;
  }

  .stat-card:hover {
    transform: translateY(-4px);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .stat-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .stat-value {
    font-size: 1.8rem;
    font-weight: 900;
    background: linear-gradient(135deg, #ffffff 0%, #9ecaff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .stat-label {
    font-size: 0.8rem;
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
    margin-top: 0.25rem;
    font-weight: 500;
  }

  /* Адаптивность */
  @media (max-width: 640px) {
    .profile-hero {
      flex-direction: column;
      text-align: center;
      padding: 1.5rem;
    }

    .avatar-wrapper {
      width: 120px;
      height: 120px;
    }

    .avatar-placeholder {
      font-size: 3rem;
    }

    .username-row {
      justify-content: center;
    }

    .user-meta {
      justify-content: center;
    }

    .action-buttons {
      justify-content: center;
    }

    .self-badge {
      display: block;
      text-align: center;
    }

    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
