<script>
  import { onMount } from 'svelte';
  import Sidebar from './components/Sidebar.svelte';
  import Content from './components/Content.svelte';
  import ProfileMenu from './components/ProfileMenu.svelte';
  import { currentUser } from './stores/authApi';
  
  let showTop = false;
  let scrollEl;
  let showProfileMenu = false;
  
  function toggleProfileMenu() {
    showProfileMenu = !showProfileMenu;
  }
  
  function closeProfileMenu() {
    showProfileMenu = false;
  }

  // Закрытие меню при клике вне его
  function handleClickOutside(event) {
    if (showProfileMenu) {
      const dropdown = document.querySelector('.profile-dropdown');
      const button = document.querySelector('.profile-btn');
      if (dropdown && button && !dropdown.contains(event.target) && !button.contains(event.target)) {
        closeProfileMenu();
      }
    }
  }

  onMount(() => {
    window.addEventListener('closeProfileMenu', closeProfileMenu);
    return () => window.removeEventListener('closeProfileMenu', closeProfileMenu);
  });
</script>

<svelte:window on:click={handleClickOutside} />

<div class="app-container">
  <!-- Верхняя бегущая строка -->
  <div class="marquee-top">
    <div class="marquee-content">
      <span>work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • </span>
      <span>work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • </span>
    </div>
  </div>
  
  <!-- Шапка -->
  <header class="app-header">
    <div class="header-content">
      <div class="header-left">
        <button class="profile-btn" on:click={toggleProfileMenu}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>
          {#if $currentUser}
            <span class="username-text">{$currentUser.username || 'Профиль'}</span>
          {:else}
            <span class="username-text">Профиль</span>
          {/if}
        </button>
        
        {#if showProfileMenu}
          <div class="profile-dropdown">
            <ProfileMenu />
          </div>
        {/if}
      </div>
      <div class="header-controls">
      </div>
    </div>
  </header>

  <!-- Основная область -->
  <div class="main-layout">
    <!-- Sidebar -->
    <div class="sidebar-container">
      <Sidebar />
    </div>
    
    <!-- Content область -->
    <div class="content-container">
      <div class="content-scroll" bind:this={scrollEl} on:scroll={(e) => {
        const el = e.currentTarget;
        try { showTop = (el?.scrollTop || 0) > 600; } catch (_) { showTop = false; }
      }}>
        <Content />
      </div>
      
      {#if showTop}
        <button class="scroll-top-btn" on:click={() => scrollEl?.scrollTo({ top: 0, behavior: 'smooth' })} title="Наверх">
          ↑
        </button>
      {/if}
    </div>
  </div>
  
  <!-- Нижняя бегущая строка -->
  <div class="marquee-bottom">
    <div class="marquee-content">
      <span>work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • </span>
      <span>work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • </span>
    </div>
  </div>
</div>

<style>
  .app-container {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  
  .app-header {
    width: 100%;
    height: 70px;
    flex-shrink: 0;
    background: transparent;
    z-index: 100;
  }
  
  .header-content {
    height: 100%;
    padding: 0 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .header-left {
    position: relative;
  }
  
  .profile-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: 12px;
    color: var(--accent);
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 600;
    font-size: 14px;
  }
  
  .profile-btn:hover {
    background: var(--extra);
    color: #FFFFFF;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(139, 164, 127, 0.3);
  }
  
  .username-text {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .profile-dropdown {
    position: absolute;
    top: 60px;
    left: 0;
    background: var(--panelStrong);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    padding: 8px;
    min-width: 200px;
    z-index: 1000;
    animation: fadeInDown 0.2s ease;
  }
  
  @keyframes fadeInDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @media (max-width: 768px) {
    .app-header {
      height: 60px;
    }
    
    .header-content {
      padding: 0 16px;
    }
    
    .username-text {
      display: none;
    }
    
    .profile-btn {
      padding: 8px;
      width: 40px;
      height: 40px;
      justify-content: center;
    }
  }
  
  .header-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .control-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .control-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  .main-layout {
    display: flex;
    width: 100%;
    flex: 1;
    gap: 0;
    overflow: hidden;
  }
  
  .sidebar-container {
    flex-shrink: 0;
    width: auto;
    height: 100%;
    overflow: visible;
    padding: 16px 8px;
  }
  
  @media (max-width: 768px) {
    .sidebar-container {
      display: none;
    }
  }
  
  .content-container {
    flex: 1;
    height: 100%;
    position: relative;
    overflow: hidden;
  }
  
  .content-scroll {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding: 20px;
  }
  
  @media (max-width: 768px) {
    .content-scroll {
      padding: 12px;
    }
  }
  
  .scroll-top-btn {
    position: fixed;
    right: 24px;
    bottom: 24px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--accent, #A239CA);
    color: white;
    font-size: 24px;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: all 0.2s;
    z-index: 50;
  }
  
  .scroll-top-btn:hover {
    background: var(--accent2, #8B2FC9);
    transform: translateY(-2px);
  }
  
  /* Бегущие строки */
  .marquee-top,
  .marquee-bottom {
    width: 100%;
    height: 24px;
    background: var(--accent);
    color: white;
    overflow: hidden;
    position: relative;
    flex-shrink: 0;
    z-index: 200;
  }
  
  .marquee-top {
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .marquee-bottom {
    border-top: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .marquee-content {
    display: flex;
    white-space: nowrap;
    animation: marquee 30s linear infinite;
  }
  
  .marquee-content span {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 2px;
    padding: 0 20px;
    line-height: 24px;
  }
  
  @keyframes marquee {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(-50%);
    }
  }
</style>