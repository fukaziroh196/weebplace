<script>
  import { clickOutside } from '../lib/clickOutside';
  import { ratings, setRating, clearRating } from '../stores/auth';
  export let itemId;
  let open = false;
  let hoverTimer;
  function select(val) {
    setRating(itemId, val);
    open = false;
  }
  function reset() {
    clearRating(itemId);
    open = false;
  }
  function onEnter() {
    clearTimeout(hoverTimer);
    open = true;
  }
  function onLeave() {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => (open = false), 200);
  }
</script>

<div class="relative inline-block" use:clickOutside={{ enabled: true, callback: () => (open = false) }} on:mouseenter={onEnter} on:mouseleave={onLeave}>
  <button class="rounded-full px-3 py-2 text-sm font-semibold menu-surface hover:bg-white/10" on:click={() => (open = !open)}>
    Оценка {#if $ratings[itemId]}<span class="ml-1">{$ratings[itemId]}</span>{/if}
  </button>
  {#if open}
    <div class="absolute left-0 mt-2 rounded-xl overflow-hidden z-20 menu-surface p-2" on:mouseenter={onEnter} on:mouseleave={onLeave}>
      <div class="flex items-center gap-2">
        {#each Array(10) as _, idx}
          <button class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold rating-pill"
                  style="background: {($ratings[itemId]||0) >= (idx + 1) ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.15)'}; color: {($ratings[itemId]||0) >= (idx + 1) ? '#8e2a8e' : '#fff'};"
                  on:click={() => select(idx + 1)}>{idx + 1}</button>
        {/each}
        {#if $ratings[itemId]}
          <button class="ml-2 text-white/70 hover:text-white text-sm" on:click={reset}>Сброс</button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .rating-pill { transition: transform .15s ease, background .15s ease, color .15s ease; cursor: pointer; }
  .rating-pill:hover { transform: scale(1.06); background: rgba(255,255,255,0.95) !important; color: #8e2a8e !important; }
</style>


