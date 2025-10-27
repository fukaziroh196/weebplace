<script>
  import { goToLists, sidebarCollapsed, toggleSidebar } from '../stores/ui';
</script>

<div class="flex flex-col h-full gap-3 text-white text-lg font-medium pt-1 overflow-hidden"
     style="align-items:{ $sidebarCollapsed ? 'center' : 'stretch' }">
  <button class="self-end mr-1 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center border border-white/20"
          title={$sidebarCollapsed ? 'Развернуть' : 'Свернуть'}
          on:click={toggleSidebar}>
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      {#if $sidebarCollapsed}
        <polyline points="9 18 15 12 9 6"></polyline>
      {:else}
        <polyline points="15 18 9 12 15 6"></polyline>
      {/if}
    </svg>
  </button>

  <button class="nav-item" style="justify-content:{ $sidebarCollapsed ? 'center' : 'flex-start' }" on:click={() => alert('Новости')}>
    <span class="icon">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19a2 2 0 0 1-2-2V5h16v12a2 2 0 0 1-2 2H4z"></path><path d="M16 8H6"></path><path d="M16 12H6"></path><path d="M10 16H6"></path></svg>
    </span>
    {#if !$sidebarCollapsed}<span>Новости</span>{/if}
  </button>
  <button class="nav-item" style="justify-content:{ $sidebarCollapsed ? 'center' : 'flex-start' }" on:click={() => import('../stores/ui').then(m=>m.goToCatalog())}>
    <span class="icon">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>
    </span>
    {#if !$sidebarCollapsed}<span>Каталог</span>{/if}
  </button>
  <button class="nav-item" style="justify-content:{ $sidebarCollapsed ? 'center' : 'flex-start' }" on:click={() => alert('Календарь')}>
    <span class="icon">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
    </span>
    {#if !$sidebarCollapsed}<span>Календарь</span>{/if}
  </button>
  <button class="nav-item" style="justify-content:{ $sidebarCollapsed ? 'center' : 'flex-start' }" on:click={() => import('../stores/ui').then(m=>m.goToAniQuiz())}>
    <span class="icon">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
    </span>
    {#if !$sidebarCollapsed}<span>AniQuiz</span>{/if}
  </button>
  <div class="pt-2 border-t border-white/20"></div>
  <button class="nav-item" style="justify-content:{ $sidebarCollapsed ? 'center' : 'flex-start' }" on:click={goToLists}>
    <span class="icon">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M3 6h.01"></path><path d="M3 12h.01"></path><path d="M3 18h.01"></path></svg>
    </span>
    {#if !$sidebarCollapsed}<span>Мои списки</span>{/if}
  </button>

  <div class="mt-auto"></div>
</div>

<style>
  .nav-item { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:10px; transition: background .2s; }
  .nav-item:hover { background: rgba(255,255,255,0.08); }
  .icon { display:flex; width:24px; height:24px; align-items:center; justify-content:center; }
  .theme-switch {
    appearance: none;
    width: 50px;
    height: 26px;
    border-radius: 9999px;
    position: relative;
    outline: none;
    transition: background .2s ease, box-shadow .2s ease, border-color .2s ease;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,184,28,0.22);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04), 0 4px 14px rgba(0,0,0,0.45);
    backdrop-filter: blur(6px) saturate(120%);
  }
  .theme-switch:hover {
    background: rgba(255,255,255,0.10);
  }
  .theme-switch::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 5px; /* увеличить отступ слева */
    width: 20px;
    height: 20px;
    border-radius: 9999px;
    background: linear-gradient(180deg, #fff, #fff6e0);
    border: 1px solid rgba(255,184,28,0.45);
    box-shadow: 0 2px 8px rgba(0,0,0,0.45);
    transition: transform .2s ease;
  }
  .theme-switch:checked {
    background: rgba(255,184,28,0.18);
    border-color: rgba(255,184,28,0.42);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05), 0 4px 14px rgba(255,184,28,0.22);
  }
  .theme-switch:checked::after { transform: translateX(20px); }
  .theme-switch:focus-visible { box-shadow: 0 0 0 2px rgba(255,255,255,0.25); }
  .theme-switch { flex-shrink: 0; }
</style>