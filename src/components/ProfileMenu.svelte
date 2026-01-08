<script>
  import { currentUser, login, register, logout } from '../stores/authApi';
  import { goToPublicProfile, goToAdminQuiz } from '../stores/ui';
  
  export let isAdmin = false;
  let mode = 'login'; // 'login' | 'register'
  let usernameInput = '';
  let password = '';
  let error = '';
  let loading = false;

  async function submit() {
    error = '';
    loading = true;
    try {
      if (mode === 'login') {
        await login(usernameInput, password);
      } else {
        await register(usernameInput, password);
      }
      usernameInput = '';
      password = '';
    } catch (e) {
      error = e?.message || 'Ошибка';
    } finally {
      loading = false;
    }
  }
  
  function handleLogout() {
    logout();
  }

  function handleProfileClick() {
    if ($currentUser?.id && $currentUser?.username) {
      goToPublicProfile($currentUser.id, $currentUser.username);
    }
    window.dispatchEvent(new CustomEvent('closeProfileMenu'));
  }
  
  function handleAdminClick() {
    goToAdminQuiz();
    window.dispatchEvent(new CustomEvent('closeProfileMenu'));
  }

  function handleSettingsClick() {
    window.dispatchEvent(new CustomEvent('openSettings'));
    window.dispatchEvent(new CustomEvent('closeProfileMenu'));
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
</script>

{#if $currentUser}
  <div class="profile-menu">
    <div class="menu-items">
      <button class="menu-item" on:click={handleProfileClick}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span>Профиль</span>
      </button>
      
      <button class="menu-item" on:click={handleSettingsClick}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        <span>Настройки</span>
      </button>
      
      {#if isAdmin}
        <button class="menu-item" on:click={handleAdminClick}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"></path>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"></path>
          </svg>
          <span>Админ-панель</span>
        </button>
      {/if}
    </div>
    
    <button class="menu-item logout-btn" on:click={handleLogout}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
        <polyline points="16 17 21 12 16 7"></polyline>
        <line x1="21" y1="12" x2="9" y2="12"></line>
      </svg>
      <span>Выйти</span>
    </button>
  </div>
{:else}
  <div class="auth-form">
    <div class="form-tabs">
      <button 
        class="tab-btn" 
        class:active={mode === 'login'}
        on:click={() => { mode = 'login'; error = ''; }}
      >
        Вход
      </button>
      <button 
        class="tab-btn"
        class:active={mode === 'register'}
        on:click={() => { mode = 'register'; error = ''; }}
      >
        Регистрация
      </button>
    </div>
    
    <form on:submit|preventDefault={submit}>
      <div class="form-group">
        <input 
          type="text" 
          bind:value={usernameInput} 
          placeholder="Имя пользователя" 
          required
          disabled={loading}
        />
      </div>
      
      <div class="form-group">
        <input 
          type="password" 
          bind:value={password} 
          placeholder="Пароль" 
          required
          disabled={loading}
        />
      </div>
      
      {#if mode === 'register'}
        <div class="form-note">
          Регистрация анонимная. Мы не собираем личные данные, только ваш ник и пароль для входа.
        </div>
      {/if}
      
      {#if error}
        <div class="error-message">{error}</div>
      {/if}
      
      <button type="submit" class="submit-btn" disabled={loading}>
        {#if loading}
          <span class="loading-spinner"></span>
        {:else}
          {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
        {/if}
      </button>
    </form>
  </div>
{/if}

<style>
  .profile-menu {
    min-width: 220px;
    padding: 0.5rem;
  }
  
  .menu-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 0.75rem;
    margin-bottom: 0.5rem;
  }
  
  .user-avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 2px solid rgba(255, 255, 255, 0.2);
  }
  
  .avatar-letter {
    color: white;
    font-size: 1.1rem;
    font-weight: 800;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }
  
  .user-info {
    flex: 1;
    min-width: 0;
  }
  
  .user-name {
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--text-primary, #f5f6ff);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .user-site {
    font-size: 0.75rem;
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  }
  
  .menu-items {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }
  
  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    color: var(--text-primary, #f5f6ff);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }
  
  .menu-item svg {
    width: 18px;
    height: 18px;
    opacity: 0.7;
    flex-shrink: 0;
  }
  
  .menu-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .menu-item:hover svg {
    opacity: 1;
    color: var(--accent-primary, #9ecaff);
  }
  
  .logout-btn {
    margin-top: 0.25rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 0.75rem;
    border-radius: 0;
  }
  
  .logout-btn:hover {
    background: rgba(255, 107, 107, 0.15);
    color: #ff6b6b;
  }
  
  .logout-btn:hover svg {
    color: #ff6b6b;
  }
  
  /* Auth Form */
  .auth-form {
    min-width: 260px;
    padding: 0.5rem;
  }
  
  .form-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    background: rgba(255, 255, 255, 0.06);
    padding: 0.25rem;
    border-radius: 0.5rem;
  }
  
  .tab-btn {
    flex: 1;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .tab-btn:hover {
    color: var(--text-primary, #f5f6ff);
  }
  
  .tab-btn.active {
    background: rgba(255, 255, 255, 0.15);
    color: var(--text-primary, #f5f6ff);
  }
  
  .form-group {
    margin-bottom: 0.75rem;
  }
  
  .form-group input {
    width: 100%;
    padding: 0.65rem 0.85rem;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 0.5rem;
    color: var(--text-primary, #f5f6ff);
    font-size: 0.9rem;
    transition: all 0.15s ease;
  }
  
  .form-group input::placeholder {
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  }
  
  .form-group input:focus {
    outline: none;
    border-color: var(--accent-primary, #9ecaff);
    background: rgba(255, 255, 255, 0.12);
  }
  
  .form-group input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .form-note {
    padding: 0.6rem 0.75rem;
    background: rgba(158, 202, 255, 0.1);
    border: 1px solid rgba(158, 202, 255, 0.2);
    border-radius: 0.5rem;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.8rem;
    line-height: 1.5;
    margin-bottom: 0.75rem;
    text-align: center;
  }
  
  .error-message {
    padding: 0.6rem 0.75rem;
    background: rgba(255, 107, 107, 0.15);
    border: 1px solid rgba(255, 107, 107, 0.3);
    border-radius: 0.5rem;
    color: #ff6b6b;
    font-size: 0.8rem;
    margin-bottom: 0.75rem;
  }
  
  .submit-btn {
    width: 100%;
    padding: 0.7rem;
    background: linear-gradient(135deg, #55efc4 0%, #00b894 100%);
    border: none;
    border-radius: 0.5rem;
    color: #1a1a2e;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  
  .submit-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(85, 239, 196, 0.4);
  }
  
  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  
  .loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(26, 26, 46, 0.3);
    border-top-color: #1a1a2e;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
