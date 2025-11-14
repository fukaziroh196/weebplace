<script>
  import { currentUser, login, register, logout } from '../stores/authApi';
  import { goToProfile, goToAchievements, goToAdminQuiz } from '../stores/ui';
  
  export let isAdmin = false;
  let mode = 'login'; // 'login' | 'register'
  let username = '';
  let password = '';
  let error = '';
  let loading = false;

  async function submit() {
    error = '';
    loading = true;
    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register(username, password);
      }
      username = '';
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
    goToProfile();
    window.dispatchEvent(new CustomEvent('closeProfileMenu'));
  }

  function handleAchievementsClick() {
    goToAchievements();
    window.dispatchEvent(new CustomEvent('closeProfileMenu'));
  }
  
  function handleAdminClick() {
    goToAdminQuiz();
    window.dispatchEvent(new CustomEvent('closeProfileMenu'));
  }
</script>

{#if $currentUser}
  <!-- Меню для авторизованного пользователя -->
  <div class="profile-menu">
    <div class="menu-header">
      <div class="user-avatar">
        <span class="avatar-letter">{$currentUser.username?.[0]?.toUpperCase() || 'U'}</span>
      </div>
      <div class="user-info">
        <div class="user-name">{$currentUser.username}</div>
        <div class="user-email">{$currentUser.email || 'otakuz.fun'}</div>
      </div>
    </div>
    
    <div class="menu-divider"></div>
    
    <button class="menu-item" on:click={handleProfileClick}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
      </svg>
      Профиль
    </button>
    
    <button class="menu-item" on:click={handleAchievementsClick}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
      Достижения
    </button>
    
    <button class="menu-item">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
      </svg>
      Настройки
    </button>
    
    {#if isAdmin}
      <button class="menu-item" on:click={handleAdminClick}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M21.21 10.78l-1.59-.13a6.51 6.51 0 0 0-.51-1.24l.96-1.27a1 1 0 0 0-.08-1.28l-1.9-1.9a1 1 0 0 0-1.28-.08l-1.27.96a6.51 6.51 0 0 0-1.24-.51l-.13-1.59A1 1 0 0 0 12.19 2h-2.38a1 1 0 0 0-1 .92l-.13 1.59a6.51 6.51 0 0 0-1.24.51l-1.27-.96a1 1 0 0 0-1.28.08l-1.9 1.9a1 1 0 0 0-.08 1.28l.96 1.27a6.51 6.51 0 0 0-.51 1.24l-1.59.13a1 1 0 0 0-.92 1v2.38a1 1 0 0 0 .92 1l1.59.13c.12.43.29.84.51 1.24l-.96 1.27a1 1 0 0 0 .08 1.28l1.9 1.9a1 1 0 0 0 1.28.08l1.27-.96c.4.22.81.39 1.24.51l.13 1.59a1 1 0 0 0 .99.92h2.38a1 1 0 0 0 1-.92l.13-1.59c.43-.12.84-.29 1.24-.51l1.27.96a1 1 0 0 0 1.28-.08l1.9-1.9a1 1 0 0 0 .08-1.28l-.96-1.27c.22-.4.39-.81.51-1.24l1.59-.13a1 1 0 0 0 .92-1V11.7a1 1 0 0 0-.92-.92zM11 15a4 4 0 1 1 4-4 4 4 0 0 1-4 4zm8.63 1.76l-1.17.1a1 1 0 0 0-.9.74 8.38 8.38 0 0 1-.82 1.95 1 1 0 0 0 .09 1.06l.71.93-1 1-1-.71a1 1 0 0 0-1.06-.09 8.38 8.38 0 0 1-1.95.82 1 1 0 0 0-.74.9l-.1 1.17h-1.41l-.1-1.17a1 1 0 0 0-.74-.9 8.38 8.38 0 0 1-1.95-.82 1 1 0 0 0-1.06.09l-1 .71-1-1 .71-.93a1 1 0 0 0 .09-1.06 8.38 8.38 0 0 1-.82-1.95 1 1 0 0 0-.9-.74l-1.17-.1v-1.41l1.17-.1a1 1 0 0 0 .9-.74 8.38 8.38 0 0 1 .82-1.95 1 1 0 0 0-.09-1.06l-.71-.93 1-1 1 .71a1 1 0 0 0 1.06.09 8.38 8.38 0 0 1 1.95-.82 1 1 0 0 0 .74-.9l.1-1.17h1.41l.1 1.17a1 1 0 0 0 .74.9 8.38 8.38 0 0 1 1.95.82 1 1 0 0 0 1.06-.09l1-.71 1 1-.71.93a1 1 0 0 0-.09 1.06 8.38 8.38 0 0 1 .82 1.95 1 1 0 0 0 .9.74l1.17.1z"/>
        </svg>
        Админ‑панель
      </button>
    {/if}
    
    <div class="menu-divider"></div>
    
    <button class="menu-item logout-btn" on:click={handleLogout}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
      </svg>
      Выйти
    </button>
  </div>
{:else}
  <!-- Форма входа/регистрации -->
  <div class="auth-form">
    <div class="form-tabs">
      <button 
        class="tab-btn {mode === 'login' ? 'active' : ''}" 
        on:click={() => { mode = 'login'; error = ''; }}
      >
        Вход
      </button>
      <button 
        class="tab-btn {mode === 'register' ? 'active' : ''}" 
        on:click={() => { mode = 'register'; error = ''; }}
      >
        Регистрация
      </button>
    </div>
    
    <form on:submit|preventDefault={submit}>
      <div class="form-group">
        <label for="username">Имя пользователя</label>
        <input 
          type="text" 
          id="username" 
          bind:value={username} 
          placeholder="Введите имя" 
          required
          disabled={loading}
        />
      </div>
      
      <div class="form-group">
        <label for="password">Пароль</label>
        <input 
          type="password" 
          id="password" 
          bind:value={password} 
          placeholder="Введите пароль" 
          required
          disabled={loading}
        />
      </div>
      
      {#if error}
        <div class="error-message">{error}</div>
      {/if}
      
      <button type="submit" class="submit-btn" disabled={loading}>
        {#if loading}
          Загрузка...
        {:else}
          {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
        {/if}
      </button>
    </form>
  </div>
{/if}

<style>
  .profile-menu {
    min-width: 240px;
  }
  
  .menu-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--surface-muted, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    margin-bottom: 8px;
  }
  
  .user-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--accent-primary, #9ecaff);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  
  .avatar-letter {
    color: var(--text-primary, #f5f6ff);
    font-size: 20px;
    font-weight: 700;
  }
  
  .user-info {
    flex: 1;
    min-width: 0;
  }
  
  .user-name {
    font-weight: 600;
    color: var(--text);
    font-size: 15px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .user-email {
    font-size: 12px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .menu-divider {
    height: 1px;
    background: var(--divider-color, rgba(255, 255, 255, 0.2));
    margin: 8px 0;
  }
  
  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--text);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }
  
  .menu-item:hover {
    background: var(--divider-color, rgba(255, 255, 255, 0.2));
    color: var(--accent-primary, #9ecaff);
  }
  
  .logout-btn {
    color: #d32f2f;
  }
  
  .logout-btn:hover {
    background: rgba(211, 47, 47, 0.1);
    color: #d32f2f;
  }
  
  /* Auth Form Styles */
  .auth-form {
    min-width: 280px;
    padding: 4px;
  }
  
  .form-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    background: var(--surface-muted, rgba(255, 255, 255, 0.1));
    padding: 4px;
    border-radius: 8px;
  }
  
  .tab-btn {
    flex: 1;
    padding: 8px 16px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--muted);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .tab-btn:hover {
    color: var(--accent-primary, #9ecaff);
  }
  
  .tab-btn.active {
    background: var(--accent-primary, #9ecaff);
    color: var(--text-primary, #f5f6ff);
  }
  
  .form-group {
    margin-bottom: 14px;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 6px;
    color: var(--text);
    font-size: 13px;
    font-weight: 600;
  }
  
  .form-group input {
    width: 100%;
    padding: 10px 12px;
    background: var(--input-surface, rgba(255, 255, 255, 0.15));
    border: 2px solid var(--input-border-color, rgba(255, 255, 255, 0.28));
    border-radius: 8px;
    color: var(--text-primary, #f5f6ff);
    font-size: 14px;
    transition: all 0.2s ease;
  }
  
  .form-group input:focus {
    outline: none;
    border-color: var(--accent-primary, #9ecaff);
    background: var(--input-surface, rgba(255, 255, 255, 0.2));
  }
  
  .form-group input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .error-message {
    padding: 10px 12px;
    background: rgba(211, 47, 47, 0.1);
    border: 1px solid rgba(211, 47, 47, 0.3);
    border-radius: 8px;
    color: #d32f2f;
    font-size: 13px;
    margin-bottom: 14px;
  }
  
  .submit-btn {
    width: 100%;
    padding: 12px;
    background: var(--accent-primary, #9ecaff);
    border: none;
    border-radius: 8px;
    color: var(--text-primary, #f5f6ff);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .submit-btn:hover:not(:disabled) {
    background: var(--extra);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(158, 202, 255, 0.3);
  }
  
  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
</style>

