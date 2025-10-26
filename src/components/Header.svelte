<script>
  import { searchAllSources, isSearching, suggestions, fetchSuggestions } from '../stores/sources';
  import { clickOutside } from '../lib/clickOutside';
  import { goToSearch, goHome, goToDetails, goToMessages, goToProfile } from '../stores/ui';
  import UserMenu from './UserMenu.svelte';
  import { currentUser, notifications } from '../stores/auth';
  import { unreadTotal } from '../stores/messages';
  
  let searchQuery = '';
  const search = () => {
    if ((searchQuery ?? '').trim().length === 0) return;
    goToSearch();
    searchAllSources(searchQuery.trim());
  };

  let suggestTimer;
  let showNotifications = false;
  function toggleNotifications() { showNotifications = !showNotifications; }
  function onInput(e) {
    searchQuery = e.currentTarget.value;
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(() => fetchSuggestions(searchQuery), 200);
  }

  function hideSuggestions() {
    suggestions.set([]);
  }
  import { searchHistory } from '../stores/sources';
</script>

<div class="grid grid-cols-[auto_1fr_auto] items-center gap-6" style="min-height:72px; padding: 0 16px;">
  <div class="flex items-center gap-8" style="margin-left: 110px;">
    <!-- Clickable logo (acts as Home) -->
    <button class="select-none cursor-pointer" title="На главную" on:click={goHome} style="background: transparent; border: none; margin-left: -80px;">
      <span class="font-extrabold text-2xl tracking-wide"
            style="background: linear-gradient(90deg,#a5f3fc,#38bdf8,#818cf8); -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: 0 2px 12px rgba(56,189,248,0.45);">
        kristal
      </span>
    </button>
    
    <!-- Navigation -->
    <div class="flex gap-8 text-lg font-semibold whitespace-nowrap" style="margin-left: 118px;">
      <!-- "Главная" убрана; функция на логотипе -->
      <button class="text-white/80 hover:text-pink-200 transition-colors" on:click={() => import('../stores/ui').then(m=>m.goToLists())} style="--tw-text-opacity:0.8;color:#cfd9e6">Мои списки</button>
    </div>
  </div>
  
  <!-- Centered Search aligned with banners panel -->
  <div class="flex items-center justify-center w-full">
    <div class="relative" use:clickOutside={{ enabled: true, callback: hideSuggestions }}>
      <input 
        type="text" 
        bind:value={searchQuery}
        placeholder="Поиск..." 
        class="input-kristal rounded-full px-4 py-2 w-[800px] focus:outline-none focus:border-white focus:ring-0"
        on:keydown={(e) => { if (e.key === 'Enter') { hideSuggestions(); search(); } if (e.key === 'Escape') hideSuggestions(); }}
        on:input={onInput}
        autocomplete="off"
        spellcheck="false"
      />
      

      {#if $suggestions.length > 0}
        <div class="absolute left-0 right-0 mt-2 rounded-xl overflow-hidden z-20 menu-surface">
          {#each $suggestions as s}
            <div class="px-3 py-2 cursor-pointer flex items-center gap-2 menu-item"
                 on:click={() => { searchQuery = s.title; hideSuggestions(); goToDetails({ id: s.id, __sourceId: s.__sourceId, title: s.title, image: s.image }); }}>
              {#if s.image}
                <img src={s.image} alt="" class="w-6 h-6 rounded object-cover" />
              {/if}
              <span class="truncate">{s.title}</span>
              {#if s.score}
                <span class="ml-auto text-sm text-white/90">★ {s.score}</span>
              {/if}
            </div>
          {/each}
          {#if $searchHistory.length}
            <div class="menu-divider"></div>
            <div class="px-3 py-2 text-xs text-white/60">История</div>
            {#each $searchHistory as h}
              <div class="px-3 py-2 cursor-pointer flex items-center gap-2 menu-item"
                   on:click={() => { searchQuery = h; hideSuggestions(); search(); }}>
                <span class="truncate">{h}</span>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Right: Avatar -->
  <div class="flex items-center gap-4 justify-self-end pr-8">
    <!-- Notifications bell -->
    <div class="relative" use:clickOutside={{ enabled: showNotifications, callback: () => showNotifications = false }}>
      <button class="relative w-11 h-11 rounded-full flex items-center justify-center bg-white/10 text-white hover:bg-white/20 border border-white/20"
              title={$currentUser ? 'Уведомления' : 'Войдите, чтобы видеть уведомления'}
              on:click={() => { if ($currentUser) toggleNotifications(); else goToProfile(); }}>
        <!-- Bell icon -->
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8"></path>
          <path d="M13.73 21a2 2 0 01-3.46 0"></path>
        </svg>
        {#if $currentUser && $notifications.length}
          <span class="absolute -top-1 -right-1 bg-pink-600 text-white text-xs rounded-full px-1.5 py-0.5">{$notifications.length}</span>
        {/if}
      </button>
      {#if showNotifications}
        <div class="absolute right-0 mt-2 w-[360px] max-h-[380px] overflow-auto rounded-xl z-30 menu-surface">
          <div class="px-3 py-2 text-white/70 text-sm">Уведомления</div>
          <div class="menu-divider"></div>
          {#if $notifications.length === 0}
            <div class="px-3 py-3 text-white/60">Пока пусто</div>
          {:else}
            {#each $notifications as n}
              <div class="px-3 py-2 menu-item">
                <div class="text-white text-sm">{n.title}</div>
                <div class="text-white/50 text-xs">{new Date(n.createdAt).toLocaleString()}</div>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
    <!-- Messages button -->
    <button class="relative w-11 h-11 rounded-full flex items-center justify-center bg-white/10 text-white hover:bg-white/20 border border-white/20"
            title={$currentUser ? 'Сообщения' : 'Войдите, чтобы открыть сообщения'}
            on:click={() => { $currentUser ? goToMessages() : goToProfile(); }}>
      <!-- Envelope icon -->
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"></path>
        <polyline points="22,6 12,13 2,6"></polyline>
      </svg>
      {#if $currentUser && $unreadTotal > 0}
        <span class="absolute -top-1 -right-1 bg-pink-600 text-white text-xs rounded-full px-1.5 py-0.5">{$unreadTotal}</span>
      {/if}
    </button>
    <UserMenu />
  </div>
</div>