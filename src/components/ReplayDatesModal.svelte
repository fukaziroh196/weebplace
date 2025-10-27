<script>
  import { availableQuizDates, setQuizDate } from '../stores/quizzes';
  import { userStats } from '../stores/stats';
  export let open = false;
  export let onClose = () => {};

  let page = 1;
  const pageSize = 14; // 2 columns x 7 rows
  $: dates = $availableQuizDates || [];
  $: pages = Math.max(1, Math.ceil(dates.length / pageSize));
  $: page = Math.min(Math.max(1, page), pages);
  $: slice = dates.slice((page - 1) * pageSize, page * pageSize);

  function getCount(d) {
    try { return ($userStats?.data?.perDayCounts?.[d]) || 0; } catch (_) { return 0; }
  }
  function levelColor(d) {
    const c = getCount(d);
    if (c <= 0) return 'rgba(162,57,202,.12)';
    if (c === 1) return 'rgba(162,57,202,.20)';
    if (c === 2) return 'rgba(162,57,202,.32)';
    if (c <= 4) return 'rgba(162,57,202,.45)';
    return 'rgba(162,57,202,.65)';
  }

  function choose(d) {
    console.log('[ReplayDatesModal] Chosen date:', d);
    setQuizDate(d);
    onClose?.();
  }
  
  $: if (open) {
    console.log('[ReplayDatesModal] Opened, available dates:', dates.length, dates);
  }
</script>

<svelte:window on:keydown={(e)=>{ if (e.key === 'Escape') onClose?.(); }} />

{#if open}
  <div class="fixed inset-0 z-[200] flex items-start justify-center pt-14 bg-[rgba(0,0,0,.45)]" role="dialog" aria-modal="true" on:click={onClose} on:keydown={(e)=>{ if (e.key === 'Escape') onClose?.(); }}>
    <div class="w-[920px] max-w-[92vw] rounded-2xl overflow-hidden" style="background:var(--panel); border:1px solid rgba(255,255,255,.06)" on:click|stopPropagation>
      <div class="px-6 py-4 flex items-center justify-between" style="border-bottom:1px solid rgba(255,255,255,.06)">
        <div class="text-2xl font-extrabold" style="color:var(--text)">REPLAY</div>
        <button class="px-3 py-1.5 rounded border-2" style="border-color:var(--accent); color:var(--accent); background:transparent" on:click={onClose}>✕</button>
      </div>
      <div class="px-6 pt-3 text-sm" style="color:var(--muted)">Choose a date</div>
      <div class="px-6 pb-4">
        <div class="grid grid-cols-2 gap-3 mt-3">
          {#each slice as d}
            <button class="replay-item" on:click={() => choose(d)} style={`box-shadow: inset 0 0 0 2px ${levelColor(d)};`}>
              <span class="dot" style={`background:${levelColor(d)}; border-color:${levelColor(d)};`}>●</span>
              <span class="label">{d}</span>
              {#if getCount(d) > 0}
                <span class="badge">{getCount(d)}</span>
              {/if}
            </button>
          {/each}
          {#if slice.length === 0}
            <div class="py-8" style="color:var(--muted)">Нет доступных дат</div>
          {/if}
        </div>
        <div class="flex items-center justify-end gap-3 mt-4 text-sm" style="color:var(--muted)">
          <button class="px-3 py-1 rounded border" style="border-color:rgba(255,255,255,.12); background:transparent" disabled={page<=1} on:click={() => page = Math.max(1, page-1)}>Previous</button>
          <div>Page
            <select class="ml-1 px-2 py-1 rounded border" style="border-color:rgba(255,255,255,.12); background:transparent; color:var(--text)" bind:value={page}>
              {#each Array(pages) as _, i}
                <option value={i+1}>{i+1}</option>
              {/each}
            </select>
            <span class="ml-1">of {pages}</span>
          </div>
          <button class="px-3 py-1 rounded border" style="border-color:rgba(255,255,255,.12); background:transparent" disabled={page>=pages} on:click={() => page = Math.min(pages, page+1)}>Next</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .replay-item { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.10); color:var(--text); background: var(--panel); text-align:left; transition: background .15s ease, border-color .15s ease, box-shadow .15s ease; box-shadow: 0 4px 12px rgba(0,0,0,.25); }
  .replay-item:hover { background: var(--panelStrong); border-color: var(--accent); box-shadow: 0 6px 18px rgba(162,57,202,.25); }
  .dot { font-size:10px; color:var(--accent); border:1px solid var(--accent); border-radius:9999px; padding:2px 6px; line-height:1; background:transparent; }
  .label { font-weight:700; font-size:14px; }
  .badge { margin-left:auto; font-size:12px; font-weight:800; color:var(--text); background: rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.16); padding:2px 8px; border-radius:9999px; }
</style>


