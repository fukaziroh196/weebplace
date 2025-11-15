<script>
  import { currentUser, login, register } from '../stores/authApi';
  import { favorites, comments, addComment, removeFromFavorites, setCurrentUserAvatar, clearCurrentUserAvatar, users, friends, friendRequestsIncoming, friendRequestsOutgoing } from '../stores/auth';
  import { sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend, refreshFriendState } from '../stores/auth';
  import { profileTab } from '../stores/ui';
  import AvatarCropper from './AvatarCropper.svelte';
  import AchievementsView from './AchievementsView.svelte';
  let mode = 'login';
  let username = '';
  let password = '';
  let error = '';
  let commentText = '';
  let showCropper = false;
  let tempImage = '';

  async function submit() {
    error = '';
    try {
      if (mode === 'login') await login(username, password);
      else await register(username, password);
      username = '';
      password = '';
    } catch (e) {
      error = e?.message || 'Ошибка';
    }
  }

  function postComment() {
    if ((commentText || '').trim()) {
      addComment(commentText.trim());
      commentText = '';
    }
  }

</script>

{#if !$currentUser}
  <div class="mt-4">
    <h1 class="profile-page-title">Профиль</h1>
      <div class="auth-container">
        <div class="auth-tabs">
          <button class="auth-tab {mode === 'login' ? 'active' : ''}" on:click={() => mode = 'login'}>Войти</button>
          <button class="auth-tab {mode === 'register' ? 'active' : ''}" on:click={() => mode = 'register'}>Регистрация</button>
        </div>
        <div class="auth-form">
          <input class="auth-input" placeholder="Имя" bind:value={username} />
          <input class="auth-input" type="password" placeholder="Пароль" bind:value={password} />
          {#if error}
            <div class="auth-error">{error}</div>
          {/if}
          <button class="auth-submit" on:click={submit}>{mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</button>
        </div>
      </div>
  </div>
{:else}
  <div class="mt-4">
    <div class="flex items-start gap-6 mb-4">
      <div class="profile-avatar-wrapper">
        {#if $currentUser.avatarUrl}
          {#key $currentUser.avatarUrl}
            <img 
              src={$currentUser.avatarUrl} 
              alt="avatar" 
              class="profile-avatar-img"
              on:error={(e) => {
                console.error('[ProfileView] Failed to load avatar:', $currentUser.avatarUrl);
                console.error('[ProfileView] Image error event:', e);
                e.target.style.display = 'none';
              }}
              on:load={() => {
                console.log('[ProfileView] Avatar loaded successfully:', $currentUser.avatarUrl?.substring(0, 50) + '...');
              }}
            />
          {/key}
        {:else}
          <div class="profile-avatar-placeholder">{$currentUser.username[0]?.toUpperCase() || 'U'}</div>
        {/if}
        <div class="profile-avatar-overlay">
          <label class="profile-avatar-btn">
            Загрузить
            <input type="file" accept="image/*" class="hidden" on:change={(e) => {
              const file = e.currentTarget.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => { tempImage = String(reader.result); showCropper = true; };
              reader.readAsDataURL(file);
            }} />
          </label>
          {#if $currentUser.avatarUrl}
            <button class="profile-avatar-btn" on:click={clearCurrentUserAvatar}>Удалить</button>
          {/if}
        </div>
      </div>
      <div>
        <div class="profile-username">{$currentUser.username}</div>
        <div class="profile-joined-date">С нами с {$currentUser.createdAt ? new Date($currentUser.createdAt).toLocaleDateString('ru-RU') : 'недавно'}</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="profile-tabs">
      <button 
        class="profile-tab {$profileTab === 'info' ? 'active' : ''}" 
        on:click={() => profileTab.set('info')}>
        📋 Информация
      </button>
      <button 
        class="profile-tab {$profileTab === 'achievements' ? 'active' : ''}" 
        on:click={() => profileTab.set('achievements')}>
        🏆 Достижения
      </button>
    </div>

    {#if showCropper}
      <AvatarCropper 
        src={tempImage} 
        onCancel={() => { 
          showCropper = false; 
          tempImage = ''; 
        }} 
        onApply={(url) => { 
          console.log('[ProfileView] Applying avatar URL:', url ? 'URL received' : 'NO URL');
          if (url) {
            setCurrentUserAvatar(url);
            console.log('[ProfileView] Avatar set, current user:', $currentUser);
          }
          showCropper = false; 
          tempImage = ''; 
        }} 
      />
    {/if}

    {#if $profileTab === 'achievements'}
      <div class="achievements-tab-content">
        <AchievementsView />
      </div>
    {:else}
      <div class="info-tab-content">
        <div class="space-y-6">
          <div>
            <h2 class="section-title">Друзья</h2>
            <div class="glass-panel">
              {#if $friends.length}
                {#each $friends as fid}
                  <div class="friend-item">
                    <div class="friend-name">{@html ($users.find(u=>u.id===fid)?.username || fid)}</div>
                    <button class="friend-remove-btn" on:click={() => removeFriend(fid)}>Удалить</button>
                  </div>
                {/each}
              {:else}
                <div class="empty-state">Пока нет друзей</div>
              {/if}
            </div>
            <!-- Блок заявок в друзья перенесён в меню сообщений -->
          </div>

          <div>
            <h2 class="section-title">Избранное</h2>
            {#if $favorites.length}
              <div class="favorites-grid">
                {#each $favorites as it}
                  <div class="favorite-card"
                       on:click={() => window.open(it.url || '#', '_blank')}>
                    {#if it.image}
                      <img src={it.image} alt={it.title} class="favorite-image" />
                    {/if}
                    <button class="favorite-remove-btn"
                            title="Удалить из избранного"
                            on:click|stopPropagation={() => removeFromFavorites(it.id)}>×</button>
                    <div class="favorite-title">{it.title}</div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="empty-state">Пока пусто</div>
            {/if}
          </div>
        </div>

        <div class="mt-6">
          <h2 class="section-title">Комментарии</h2>
          <div class="glass-panel">
            <div class="comment-form">
              <input class="comment-input" placeholder="Оставьте комментарий" bind:value={commentText} />
              <button class="comment-submit" on:click={postComment}>Отправить</button>
            </div>
            {#if $comments.length}
              <div class="comments-list">
                {#each $comments as c}
                  <div class="comment-item">
                    <div class="comment-date">{new Date(c.createdAt).toLocaleString()}</div>
                    <div class="comment-text">{c.text}</div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="empty-state">Комментариев пока нет</div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Profile page title */
  .profile-page-title {
    font-size: 1.75rem;
    font-weight: 900;
    color: var(--text-primary, #f5f6ff);
    margin-bottom: 1.5rem;
  }

  /* Auth section */
  .auth-container {
    background: var(--surface-primary, rgba(255, 255, 255, 0.1));
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 1.75rem;
    padding: 1.5rem;
    max-width: 500px;
  }

  .auth-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .auth-tab {
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 0.75rem;
    color: var(--text-secondary, rgba(245, 246, 255, 0.85));
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .auth-tab:hover {
    background: rgba(255, 255, 255, 0.12);
    color: var(--text-primary, #f5f6ff);
  }

  .auth-tab.active {
    background: var(--accent-primary, #9ecaff);
    color: var(--text-primary, #f5f6ff);
    border-color: var(--accent-primary, #9ecaff);
  }

  .auth-form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .auth-input {
    grid-column: span 2;
    padding: 0.75rem 1rem;
    background: var(--input-surface, rgba(255, 255, 255, 0.15));
    border: 2px solid var(--input-border-color, rgba(255, 255, 255, 0.35));
    border-radius: 0.75rem;
    color: var(--text-primary, #f5f6ff);
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .auth-input:focus {
    outline: none;
    border-color: var(--accent-primary, #9ecaff);
    background: var(--input-surface, rgba(255, 255, 255, 0.2));
  }

  .auth-input::placeholder {
    color: var(--text-quaternary, rgba(245, 246, 255, 0.45));
  }

  .auth-error {
    grid-column: span 2;
    color: var(--danger-color, #ffb7d5);
    font-size: 0.75rem;
    margin-top: -0.25rem;
  }

  .auth-submit {
    grid-column: span 2;
    margin-top: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--accent-primary, #9ecaff);
    color: var(--text-primary, #f5f6ff);
    border: none;
    border-radius: 0.75rem;
    font-weight: 700;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .auth-submit:hover {
    background: var(--accent-primary-strong, #b3d6ff);
    transform: translateY(-1px);
  }

  /* Profile header */
  .profile-username {
    font-size: 2rem;
    font-weight: 900;
    color: var(--text-primary, #f5f6ff);
    margin-bottom: 0.25rem;
  }

  .profile-joined-date {
    color: var(--text-tertiary, rgba(245, 246, 255, 0.65));
    font-size: 0.875rem;
  }

  /* Profile avatar */
  .profile-avatar-wrapper {
    position: relative;
    width: 250px;
    height: 250px;
  }

  .profile-avatar-wrapper:hover .profile-avatar-overlay {
    opacity: 1;
  }

  .profile-avatar-img {
    width: 250px;
    height: 250px;
    object-fit: cover;
    border-radius: 1.5rem;
    border: 2px solid rgba(255, 255, 255, 0.2);
  }

  .profile-avatar-placeholder {
    width: 250px;
    height: 250px;
    background: var(--accent-primary, #9ecaff);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-primary, #f5f6ff);
    font-size: 5rem;
    font-weight: 900;
  }

  .profile-avatar-overlay {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    opacity: 0;
    transition: opacity 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border-radius: 0 0 1.5rem 1.5rem;
  }


  .profile-avatar-btn {
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.9);
    color: var(--accent-primary, #9ecaff);
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .profile-avatar-btn:hover {
    background: white;
    transform: translateY(-1px);
  }

  /* Tabs */
  .profile-tabs {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    border-bottom: 2px solid rgba(255, 255, 255, 0.1);
  }

  .profile-tab {
    padding: 0.75rem 1.5rem;
    background: transparent;
    border: none;
    color: var(--text-tertiary, rgba(245, 246, 255, 0.65));
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    border-bottom: 3px solid transparent;
    margin-bottom: -2px;
  }

  .profile-tab:hover {
    color: var(--text-primary, #f5f6ff);
  }

  .profile-tab.active {
    color: var(--accent-primary, #9ecaff);
    border-bottom-color: var(--accent-primary, #9ecaff);
  }

  .achievements-tab-content {
    margin-top: 1rem;
  }

  .info-tab-content {
    margin-top: 1rem;
  }

  /* Sections */
  .section-title {
    color: var(--text-primary, #f5f6ff);
    font-weight: 700;
    font-size: 1.125rem;
    margin-bottom: 0.75rem;
  }

  .glass-panel {
    background: var(--surface-primary, rgba(255, 255, 255, 0.1));
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 1.5rem;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .empty-state {
    color: var(--text-tertiary, rgba(245, 246, 255, 0.65));
    font-size: 0.875rem;
    text-align: center;
    padding: 1rem;
  }

  /* Friends */
  .friend-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
  }

  .friend-name {
    color: var(--text-primary, #f5f6ff);
    font-size: 0.875rem;
  }

  .friend-remove-btn {
    color: var(--text-tertiary, rgba(245, 246, 255, 0.65));
    background: none;
    border: none;
    font-size: 0.875rem;
    cursor: pointer;
    transition: color 0.2s ease;
  }

  .friend-remove-btn:hover {
    color: var(--text-primary, #f5f6ff);
  }

  /* Favorites */
  .favorites-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
  }

  .favorite-card {
    position: relative;
    height: 8rem;
    border-radius: 1rem;
    overflow: hidden;
    cursor: pointer;
    background: var(--surface-secondary, rgba(255, 255, 255, 0.08));
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.2);
    transition: transform 0.2s ease;
  }

  .favorite-card:hover {
    transform: translateY(-2px);
  }

  .favorite-image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.8;
  }

  .favorite-remove-btn {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 1.5rem;
    height: 1.5rem;
    background: rgba(255, 255, 255, 0.9);
    color: var(--accent-primary, #9ecaff);
    border: none;
    border-radius: 50%;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 10;
  }

  .favorite-remove-btn:hover {
    background: white;
    transform: scale(1.1);
  }

  .favorite-title {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 0.75rem;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
    color: var(--text-primary, #f5f6ff);
    font-size: 0.75rem;
    font-weight: 600;
  }

  /* Comments */
  .comment-form {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .comment-input {
    flex: 1;
    padding: 0.75rem 1rem;
    background: var(--input-surface, rgba(255, 255, 255, 0.15));
    border: 2px solid var(--input-border-color, rgba(255, 255, 255, 0.35));
    border-radius: 0.75rem;
    color: var(--text-primary, #f5f6ff);
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .comment-input:focus {
    outline: none;
    border-color: var(--accent-primary, #9ecaff);
    background: var(--input-surface, rgba(255, 255, 255, 0.2));
  }

  .comment-input::placeholder {
    color: var(--text-quaternary, rgba(245, 246, 255, 0.45));
  }

  .comment-submit {
    padding: 0.75rem 1.5rem;
    background: var(--accent-primary, #9ecaff);
    color: var(--text-primary, #f5f6ff);
    border: none;
    border-radius: 0.75rem;
    font-weight: 700;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .comment-submit:hover {
    background: var(--accent-primary-strong, #b3d6ff);
    transform: translateY(-1px);
  }

  .comments-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 220px;
    overflow-y: auto;
    padding-right: 0.5rem;
  }

  .comment-item {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
  }

  .comment-date {
    color: var(--text-primary, #f5f6ff);
    font-weight: 600;
    font-size: 0.75rem;
    margin-bottom: 0.25rem;
  }

  .comment-text {
    color: var(--text-secondary, rgba(245, 246, 255, 0.85));
    font-size: 0.875rem;
    line-height: 1.5;
  }
</style>


