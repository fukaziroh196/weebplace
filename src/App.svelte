<script>
  import Sidebar from './components/Sidebar.svelte';
  import Content from './components/Content.svelte';
  import UserMenu from './components/UserMenu.svelte';
  
  let showTop = false;
  let scrollEl;
</script>

<div class="app-container">
  <!-- Шапка -->
  <header class="app-header">
    <div class="header-content">
      <div></div>
      <div class="header-controls">
        <UserMenu />
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
    width: 190px;
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