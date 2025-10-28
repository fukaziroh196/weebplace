<script>
  import { activeView, goHome, goToAniQuiz } from '../stores/ui';
  import { currentUser } from '../stores/authApi';

  function isActive(view) {
    let v;
    const unsub = activeView.subscribe((x) => (v = x));
    unsub();
    return v === view;
  }
  
  function goToEvents() { activeView.set('events'); }
  function goToTournaments() { activeView.set('tournaments'); }
  function goToTierLists() { activeView.set('tierlists'); }
  function goToAdminQuiz() { activeView.set('adminQuiz'); }

  $: isAdmin = $currentUser?.role === 'admin' || $currentUser?.is_admin === 1 || $currentUser?.isAdmin === true;
</script>

<div class="sidebar flex flex-col h-full gap-3 pt-4 overflow-hidden">
  <button class="nav-item {isActive('home') ? 'is-active' : ''}" on:click={goHome}>
    <div class="icon-wrapper">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
      </svg>
    </div>
    <span class="nav-label">Главная</span>
  </button>
  
  <button class="nav-item {isActive('aniquiz') ? 'is-active' : ''}" on:click={goToAniQuiz}>
    <div class="icon-wrapper">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
    </div>
    <span class="nav-label">AniQuiz</span>
  </button>
  
  <button class="nav-item {isActive('events') ? 'is-active' : ''}" on:click={goToEvents}>
    <div class="icon-wrapper">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M4 5h2V3h12v2h2v2H4V5zm0 4h16v12H4V9zm2 2v8h12v-8H6z"/>
        <rect x="7" y="12" width="2" height="2"/>
        <rect x="11" y="12" width="2" height="2"/>
        <rect x="15" y="12" width="2" height="2"/>
      </svg>
    </div>
    <span class="nav-label">Ивенты</span>
  </button>
  
  <button class="nav-item {isActive('tournaments') ? 'is-active' : ''}" on:click={goToTournaments}>
    <div class="icon-wrapper">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
      </svg>
    </div>
    <span class="nav-label">Турниры</span>
  </button>
  
  <button class="nav-item {isActive('tierlists') ? 'is-active' : ''}" on:click={goToTierLists}>
    <div class="icon-wrapper">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
      </svg>
    </div>
    <span class="nav-label">Тирлисты</span>
  </button>
  
  <button class="nav-item {isActive('calendar') ? 'is-active' : ''}">
    <div class="icon-wrapper">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V9h14v10zM5 7V5h14v2H5zm2 4h10v2H7v-2z"/>
      </svg>
    </div>
    <span class="nav-label">Календарь</span>
  </button>

  {#if isAdmin}
    <button class="nav-item {isActive('adminQuiz') ? 'is-active' : ''}" on:click={goToAdminQuiz}>
      <div class="icon-wrapper">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
        </svg>
      </div>
      <span class="nav-label">Админ</span>
    </button>
  {/if}
</div>

<style>
  .sidebar { 
    background: transparent;
    padding: 0;
  }
  
  .nav-item { 
    display: flex; 
    align-items: center; 
    gap: 12px; 
    padding: 0;
    border: none; 
    background: transparent;
    cursor: pointer;
    transition: all .2s ease;
  }
  
  .icon-wrapper {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.8);
    color: var(--muted);
    transition: all .2s ease;
    flex-shrink: 0;
  }
  
  .nav-item:hover .icon-wrapper {
    background: var(--extra);
    color: #FFFFFF;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(139, 164, 127, 0.3);
  }
  
  .nav-item.is-active .icon-wrapper {
    background: var(--accent);
    color: #FFFFFF;
    box-shadow: 0 2px 8px rgba(91, 117, 83, 0.4);
  }
  
  .nav-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    opacity: 0;
    transform: translateX(-10px);
    transition: all .2s ease;
    pointer-events: none;
  }
  
  .nav-item:hover .nav-label {
    opacity: 1;
    transform: translateX(0);
  }
  
  .nav-item.is-active .nav-label {
    opacity: 1;
    transform: translateX(0);
    color: var(--accent);
  }
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