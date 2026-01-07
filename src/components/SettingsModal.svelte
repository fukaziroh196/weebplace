<script>
  import { currentUser, changePassword } from '../stores/authApi';
  import { createEventDispatcher } from 'svelte';
  import AvatarCropper from './AvatarCropper.svelte';
  
  const dispatch = createEventDispatcher();
  
  let activeTab = 'profile';
  
  // Profile settings
  let avatarPreview = $currentUser?.avatarUrl || '';
  let avatarFile = null;
  let saving = false;
  let saveError = '';
  let saveSuccess = '';
  
  // Cropper state
  let showCropper = false;
  let cropperFile = null;
  
  // Password settings
  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';
  let passwordError = '';
  let passwordSuccess = '';
  let changingPassword = false;
  
  function close() {
    dispatch('close');
  }
  
  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      close();
    }
  }
  
  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        saveError = 'Файл слишком большой (макс. 10MB)';
        return;
      }
      // Открываем кроппер
      cropperFile = file;
      showCropper = true;
      saveError = '';
    }
    // Сбросить input чтобы можно было выбрать тот же файл снова
    e.target.value = '';
  }
  
  function handleCrop(e) {
    const { file, preview } = e.detail;
    avatarFile = file;
    avatarPreview = preview;
    showCropper = false;
    cropperFile = null;
  }
  
  function handleCropCancel() {
    showCropper = false;
    cropperFile = null;
  }
  
  async function handleSaveProfile() {
    saving = true;
    saveError = '';
    saveSuccess = '';
    
    const token = localStorage.getItem('api_token');
    if (!token) {
      saveError = 'Не авторизован';
      saving = false;
      return;
    }
    
    try {
      // Загрузка файла аватара
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        
        const res = await fetch('/api/me/avatar', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Ошибка загрузки');
        }
        
        const data = await res.json();
        currentUser.update(u => ({ ...u, avatarUrl: data.avatarUrl }));
        avatarFile = null;
      } 
      // Удаление аватара
      else if (!avatarPreview && $currentUser?.avatarUrl) {
        const res = await fetch('/api/me/avatar', {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Ошибка удаления');
        }
        
        currentUser.update(u => ({ ...u, avatarUrl: null }));
      }
      
      saveSuccess = 'Профиль сохранён!';
      setTimeout(() => saveSuccess = '', 3000);
    } catch (e) {
      saveError = e?.message || 'Не удалось сохранить';
    } finally {
      saving = false;
    }
  }
  
  async function handleChangePassword() {
    passwordError = '';
    passwordSuccess = '';
    
    if (newPassword.length < 6) {
      passwordError = 'Пароль должен быть минимум 6 символов';
      return;
    }
    
    if (newPassword !== confirmPassword) {
      passwordError = 'Пароли не совпадают';
      return;
    }
    
    changingPassword = true;
    
    try {
      await changePassword(currentPassword, newPassword);
      passwordSuccess = 'Пароль изменён!';
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      setTimeout(() => passwordSuccess = '', 3000);
    } catch (e) {
      passwordError = e?.message || 'Не удалось изменить пароль';
    } finally {
      changingPassword = false;
    }
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

<div class="modal-overlay" on:click={handleOverlayClick}>
  <div class="modal">
    <div class="modal-header">
      <h2>Настройки</h2>
      <button class="close-btn" on:click={close}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    
    <div class="tabs">
      <button 
        class="tab" 
        class:active={activeTab === 'profile'}
        on:click={() => activeTab = 'profile'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        Профиль
      </button>
      <button 
        class="tab" 
        class:active={activeTab === 'security'}
        on:click={() => activeTab = 'security'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        Безопасность
      </button>
    </div>
    
    <div class="modal-content">
      {#if activeTab === 'profile'}
        <div class="settings-section">
          <h3>Аватар</h3>
          <div class="avatar-settings">
            <div class="avatar-preview" style="background: {avatarPreview ? 'none' : getAvatarGradient($currentUser?.username)}">
              {#if avatarPreview}
                <img src={avatarPreview} alt="Avatar" />
              {:else}
                <span>{($currentUser?.username?.[0] || 'U').toUpperCase()}</span>
              {/if}
            </div>
            <div class="avatar-actions">
              <label class="upload-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Загрузить фото
                <input type="file" accept="image/*" on:change={handleAvatarChange} hidden />
              </label>
              {#if avatarPreview}
                <button class="remove-btn" on:click={() => { avatarPreview = ''; avatarFile = null; }}>
                  Удалить
                </button>
              {/if}
              <p class="hint">JPG, PNG или GIF. Макс. 2MB</p>
            </div>
          </div>
          
          {#if saveError}
            <div class="message error">{saveError}</div>
          {/if}
          {#if saveSuccess}
            <div class="message success">{saveSuccess}</div>
          {/if}
          
          <button class="save-btn" on:click={handleSaveProfile} disabled={saving}>
            {#if saving}
              <span class="spinner"></span>
            {:else}
              Сохранить
            {/if}
          </button>
        </div>
        
      {:else if activeTab === 'security'}
        <div class="settings-section">
          <h3>Изменить пароль</h3>
          
          <div class="input-group">
            <label>Текущий пароль</label>
            <input 
              type="password" 
              bind:value={currentPassword}
              placeholder="Введите текущий пароль"
            />
          </div>
          
          <div class="input-group">
            <label>Новый пароль</label>
            <input 
              type="password" 
              bind:value={newPassword}
              placeholder="Минимум 6 символов"
            />
          </div>
          
          <div class="input-group">
            <label>Подтвердите пароль</label>
            <input 
              type="password" 
              bind:value={confirmPassword}
              placeholder="Повторите новый пароль"
            />
          </div>
          
          {#if passwordError}
            <div class="message error">{passwordError}</div>
          {/if}
          {#if passwordSuccess}
            <div class="message success">{passwordSuccess}</div>
          {/if}
          
          <button 
            class="save-btn" 
            on:click={handleChangePassword} 
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
          >
            {#if changingPassword}
              <span class="spinner"></span>
            {:else}
              Изменить пароль
            {/if}
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if showCropper && cropperFile}
  <AvatarCropper 
    imageFile={cropperFile} 
    on:crop={handleCrop} 
    on:cancel={handleCropCancel} 
  />
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  
  .modal {
    background: rgba(30, 30, 45, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 1.25rem;
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary, #f5f6ff);
  }
  
  .close-btn {
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 50%;
    color: var(--text-primary, #f5f6ff);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  
  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  .close-btn svg {
    width: 18px;
    height: 18px;
  }
  
  .tabs {
    display: flex;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    background: rgba(255, 255, 255, 0.03);
  }
  
  .tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.75rem;
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .tab svg {
    width: 18px;
    height: 18px;
  }
  
  .tab:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-primary, #f5f6ff);
  }
  
  .tab.active {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: var(--text-primary, #f5f6ff);
  }
  
  .modal-content {
    padding: 1.5rem;
    overflow-y: auto;
  }
  
  .settings-section h3 {
    margin: 0 0 1rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary, #f5f6ff);
  }
  
  .avatar-settings {
    display: flex;
    align-items: flex-start;
    gap: 1.25rem;
    margin-bottom: 1.5rem;
  }
  
  .avatar-preview {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 3px solid rgba(255, 255, 255, 0.2);
    overflow: hidden;
  }
  
  .avatar-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .avatar-preview span {
    font-size: 2.5rem;
    font-weight: 800;
    color: white;
  }
  
  .avatar-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .upload-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    background: linear-gradient(135deg, #55efc4 0%, #00b894 100%);
    border: none;
    border-radius: 0.5rem;
    color: #1a1a2e;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .upload-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(85, 239, 196, 0.3);
  }
  
  .upload-btn svg {
    width: 16px;
    height: 16px;
  }
  
  .remove-btn {
    padding: 0.5rem 0.75rem;
    background: rgba(255, 107, 107, 0.15);
    border: 1px solid rgba(255, 107, 107, 0.3);
    border-radius: 0.5rem;
    color: #ff6b6b;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .remove-btn:hover {
    background: rgba(255, 107, 107, 0.25);
  }
  
  .hint {
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  }
  
  .input-group {
    margin-bottom: 1rem;
  }
  
  .input-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  }
  
  .input-group input {
    width: 100%;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 0.5rem;
    color: var(--text-primary, #f5f6ff);
    font-size: 0.9rem;
    transition: all 0.2s ease;
  }
  
  .input-group input::placeholder {
    color: var(--text-secondary, rgba(255, 255, 255, 0.4));
  }
  
  .input-group input:focus {
    outline: none;
    border-color: var(--accent-primary, #9ecaff);
    background: rgba(255, 255, 255, 0.12);
  }
  
  .message {
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    margin-bottom: 1rem;
  }
  
  .message.error {
    background: rgba(255, 107, 107, 0.15);
    border: 1px solid rgba(255, 107, 107, 0.3);
    color: #ff6b6b;
  }
  
  .message.success {
    background: rgba(85, 239, 196, 0.15);
    border: 1px solid rgba(85, 239, 196, 0.3);
    color: #55efc4;
  }
  
  .save-btn {
    width: 100%;
    padding: 0.85rem;
    background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
    border: none;
    border-radius: 0.5rem;
    color: white;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  
  .save-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(116, 185, 255, 0.4);
  }
  
  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
  
  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  @media (max-width: 500px) {
    .avatar-settings {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    
    .avatar-actions {
      align-items: center;
    }
  }
</style>

