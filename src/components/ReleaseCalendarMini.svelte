<script>
  import { onMount } from 'svelte';
  import { getSeasonNow, getTopAiring } from '../sources/jikanClient';
  import { sourceRegistry } from '../sources';
  import { goToDetails } from '../stores/ui';

  export let expanded = true; // expanded: show card, collapsed: show icon only

  let items = [];
  let loading = false;
  let error = '';

  async function load() {
    loading = true; error = '';
    try {
      let list = await getSeasonNow(24);
      if (!Array.isArray(list) || !list.length) {
        // Fallback to top airing if season endpoint fails
        list = await getTopAiring(24);
      }
      items = (list || []).map((it) => {
        const d = it.startDate ? new Date(it.startDate) : null;
        const day = d ? d.getDate() : null;
        const weekday = d ? d.toLocaleDateString(undefined, { weekday: 'long' }) : '';
        return { ...it, _day: day, _weekday: weekday };
      });
    } catch (_) {
      error = 'Не удалось загрузить релизы';
      items = [];
    }
    finally { loading = false; }
  }

  async function openByTitle(title, image) {
    try {
      const results = await sourceRegistry.search(title, ['shikimori'], { limit: 5 }).catch(() => []);
      const best = Array.isArray(results) && results.length ? results[0] : null;
      if (best?.id) {
        goToDetails({ id: best.id, __sourceId: 'shikimori', title: best.title || title, image: best.image || image });
      }
    } catch (_) {}
  }

  onMount(() => { load(); });
</script>

{#if expanded}
  <div class="rounded-lg p-3 bg-white/5 max-h-72 overflow-auto">
    <div class="text-white font-semibold text-sm mb-2">Календарь релизов</div>
    {#if loading}
      <div class="text-white/80 text-sm">Загрузка…</div>
    {:else if error && items.length === 0}
      <div class="text-white/70 text-sm flex items-center gap-2">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        Нет данных
        <button class="ml-auto text-white/80 hover:text-white text-xs underline" on:click={load}>Повторить</button>
      </div>
    {:else}
      <div class="flex flex-col gap-2">
        {#each (items.length ? items : []).slice(0,6) as it}
          <div class="flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 hover:bg-white/10" on:click={() => openByTitle(it.title, it.image)}>
            <div class="w-9 h-9 rounded-md flex items-center justify-center" style="background: linear-gradient(180deg,#a78bfa,#7c3aed); color:white;">
              <span class="text-sm font-bold">{it._day ?? '—'}</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-white text-sm truncate">{it.title}</div>
              <div class="text-white/60 text-xs truncate">{it._weekday}</div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <!-- compact icon when sidebar collapsed -->
  <div class="w-full h-full flex items-center justify-center bg-white/10" title="Календарь релизов">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
  </div>
{/if}


