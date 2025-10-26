<script>
  import { onMount } from 'svelte';
  import Header from './components/Header.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import Content from './components/Content.svelte';
  import Player from './components/Player.svelte';
  import { sidebarCollapsed } from './stores/ui';
  let headerEl;
  let headerHeight = 0;
  $: sidebarW = $sidebarCollapsed ? 64 : 190;
  const topGap = 0;
  const sidebarTopTrim = 0;

  const BASE_WIDTH = 1600;
  const BASE_HEIGHT = 900;

  let scale = 1;
  let scaledWidth = BASE_WIDTH;
  let scaledHeight = BASE_HEIGHT;
  let showTop = false;
  let scrollEl;

  function updateScale() {
    const widthRatio = window.innerWidth / BASE_WIDTH;
    const heightRatio = window.innerHeight / BASE_HEIGHT;
    scale = Math.min(widthRatio, heightRatio);
    scale = Math.max(0.1, Number(scale.toFixed(3)));
    scaledWidth = Math.round(BASE_WIDTH * scale);
    scaledHeight = Math.round(BASE_HEIGHT * scale);
  }

  onMount(() => {
    updateScale();
    // measure header height for sidebar overlay
    try { headerHeight = 72; } catch (_) { headerHeight = 72; }
    window.addEventListener('resize', updateScale, { passive: true });
    window.addEventListener('orientationchange', updateScale, { passive: true });
    return () => {
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('orientationchange', updateScale);
    };
  });
</script>

<div class="app-viewport" style="width: {scaledWidth}px; height: {scaledHeight}px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
  <div class="glass" style="transform: scale({scale}); transform-origin: center center; width: 100%;">
  <!-- Верхняя панель, визуально сливающаяся с левой -->
  <div class="sticky top-0 z-10" style="margin-left:0; margin-right:0;">
    <Header />
  </div>
  
  <!-- Основная область с фиксированным Sidebar и прокручиваемым Content -->
  <div class="flex flex-1 gap-6 mt-0 h-full min-h-0" style="width: 100%;">
    <!-- Фиксированный Sidebar -->
    <div class="sticky top-0 h-full pl-4 pr-3 py-2 overflow-hidden sidebar-shell"
         style="min-width:{sidebarW}px; max-width:{sidebarW}px; margin-top:0; height: 100%; padding-top: 0;">
      <Sidebar />
    </div>
    
    <!-- Прокручиваемая область с глобальной кнопкой "Наверх" -->
    <div class="flex-1 min-h-0 relative" style="width: 0;">
      <div class="overflow-y-auto min-h-0 h-full scrollable workspace-frame px-5 py-3" bind:this={scrollEl} on:scroll={(e) => {
        const el = e.currentTarget;
        if (el.scrollTop > 2) {
          el.classList.add('scrollable--active');
        } else {
          el.classList.remove('scrollable--active');
        }
        try { showTop = (el?.scrollTop || 0) > 600; } catch (_) { showTop = false; }
      }}>
        <Content />
      </div>
      {#if showTop}
        <button
          class="absolute right-6 bottom-6 bg-pink-700/95 text-white rounded-full w-12 h-12 text-xl shadow-lg hover:bg-pink-600"
          on:click={() => { try { scrollEl?.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {} }}
          title="Наверх">↑</button>
      {/if}
    </div>
  </div>
  <Player />
  </div>
</div>