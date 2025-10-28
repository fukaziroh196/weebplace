<script>
  import Sidebar from './components/Sidebar.svelte';
  import Content from './components/Content.svelte';
  import UserMenu from './components/UserMenu.svelte';
  import { theme, toggleTheme } from './stores/theme';
  import { sidebarCollapsed } from './stores/ui';
  
  $: sidebarW = $sidebarCollapsed ? 64 : 190;
  let showTop = false;
  let scrollEl;
</script>

<div class="app-container">
  <!-- Шапка -->
  <header class="app-header">
    <div class="header-content">
      <div></div>
      <div class="header-controls">
        <button class="control-btn theme-btn" title={$theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'} on:click={toggleTheme}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            {#if $theme === 'dark'}
              <path d="M12 3a9 9 0 0 0 9 9 9 9 0 1 1-9-9z"></path>
            {:else}
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            {/if}
          </svg>
        </button>
        <UserMenu />
      </div>
    </div>
  </header>

  <!-- Основная область -->
  <div class="main-layout">
    <!-- Sidebar -->
    <div class="sidebar-container" style="width: {sidebarW}px;">
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
    height: 100%;
    overflow: hidden;
    padding: 16px 12px;
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
</style>