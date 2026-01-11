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
    if (c <= 0) return 'rgba(158, 202, 255, 0.12)';
    if (c === 1) return 'rgba(158, 202, 255, 0.20)';
    if (c === 2) return 'rgba(158, 202, 255, 0.32)';
    if (c <= 4) return 'rgba(158, 202, 255, 0.45)';
    return 'rgba(158, 202, 255, 0.65)';
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
  <div 
    class="replay-backdrop" 
    role="dialog" 
    aria-modal="true" 
    aria-labelledby="replay-title"
    on:click={onClose} 
    on:keydown={(e)=>{ if (e.key === 'Escape') onClose?.(); }}
  >
    <div class="replay-modal" on:click|stopPropagation>
      <div class="replay-header">
        <h2 id="replay-title" class="replay-title">Повторы</h2>
        <button 
          class="replay-close-btn" 
          on:click={onClose}
          aria-label="Закрыть"
          type="button"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <div class="replay-body">
        <div class="replay-subtitle">ВЫБЕРИТЕ ДАТУ</div>
        
        <div class="replay-grid">
          {#each slice as d}
            <button 
              class="replay-item"
              class:has-count={getCount(d) > 0}
              style="--level-color: {levelColor(d)}"
              on:click={() => choose(d)}
              type="button"
            >
              <span class="replay-dot" style="background-color: var(--level-color);"></span>
              <span class="replay-label">{d}</span>
              {#if getCount(d) > 0}
                <span class="replay-badge">{getCount(d)}</span>
              {/if}
            </button>
          {/each}
          {#if slice.length === 0}
            <div class="replay-empty">Нет доступных дат</div>
          {/if}
        </div>

        <div class="replay-pagination">
          <button 
            class="replay-pagination-btn"
            class:disabled={page <= 1}
            disabled={page <= 1}
            on:click={() => page = Math.max(1, page - 1)}
            type="button"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
            Предыдущая
          </button>
          
          <div class="replay-page-info">
            Страница
            <select 
              class="replay-page-select"
              bind:value={page}
            >
              {#each Array(pages) as _, i}
                <option value={i+1}>{i+1}</option>
              {/each}
            </select>
            из {pages}
          </div>
          
          <button 
            class="replay-pagination-btn"
            class:disabled={page >= pages}
            disabled={page >= pages}
            on:click={() => page = Math.min(pages, page + 1)}
            type="button"
          >
            Следующая
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .replay-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .replay-modal {
    background: var(--surface-primary, rgba(255, 255, 255, 0.1));
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.2));
    border-radius: 1rem;
    box-shadow: var(--shadow-outer, 0 1.5rem 4rem rgba(0, 0, 0, 0.35));
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
  }

  @keyframes slideUp {
    from {
      transform: translateY(1rem);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .replay-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--divider-color, rgba(255, 255, 255, 0.2));
  }

  .replay-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--text-primary, #f5f6ff);
    margin: 0;
    letter-spacing: 0.02em;
  }

  .replay-close-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary, rgba(245, 246, 255, 0.85));
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    line-height: 1;
  }

  .replay-close-btn:hover {
    background: var(--surface-muted, rgba(255, 255, 255, 0.1));
    color: var(--text-primary, #f5f6ff);
  }

  .replay-close-btn:active {
    transform: scale(0.95);
  }

  .replay-body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: auto;
    flex: 1;
  }

  .replay-subtitle {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--text-secondary, rgba(245, 246, 255, 0.75));
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 0.25rem;
  }

  .replay-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .replay-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    border-radius: 0.75rem;
    border: 2px solid var(--level-color, rgba(158, 202, 255, 0.2));
    background: var(--surface-secondary, rgba(255, 255, 255, 0.08));
    backdrop-filter: blur(10px) saturate(180%);
    -webkit-backdrop-filter: blur(10px) saturate(180%);
    color: var(--text-primary, #f5f6ff);
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.9375rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }

  .replay-item:hover {
    background: var(--surface-card, rgba(255, 255, 255, 0.12));
    border-color: var(--accent-primary, #9ecaff);
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(158, 202, 255, 0.3);
  }

  .replay-item:active {
    transform: translateY(0);
  }

  .replay-item.has-count {
    border-color: var(--level-color);
  }

  .replay-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 8px var(--level-color);
  }

  .replay-label {
    font-weight: 700;
    font-size: 0.9375rem;
    color: var(--text-primary, #f5f6ff);
    flex: 1;
  }

  .replay-badge {
    margin-left: auto;
    font-size: 0.75rem;
    font-weight: 800;
    color: var(--text-primary, #f5f6ff);
    background: var(--surface-pill, rgba(255, 255, 255, 0.12));
    border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.2));
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    min-width: 1.75rem;
    text-align: center;
  }

  .replay-empty {
    grid-column: 1 / -1;
    padding: 3rem 1rem;
    text-align: center;
    color: var(--text-tertiary, rgba(245, 246, 255, 0.65));
    font-size: 0.9375rem;
  }

  .replay-pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--divider-color, rgba(255, 255, 255, 0.2));
  }

  .replay-pagination-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.2));
    background: var(--surface-secondary, rgba(255, 255, 255, 0.08));
    color: var(--text-secondary, rgba(245, 246, 255, 0.85));
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .replay-pagination-btn:hover:not(.disabled) {
    background: var(--surface-muted, rgba(255, 255, 255, 0.15));
    border-color: var(--accent-primary, #9ecaff);
    color: var(--text-primary, #f5f6ff);
  }

  .replay-pagination-btn.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .replay-pagination-btn:active:not(.disabled) {
    transform: scale(0.98);
  }

  .replay-page-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary, rgba(245, 246, 255, 0.85));
  }

  .replay-page-select {
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.2));
    background: var(--surface-secondary, rgba(255, 255, 255, 0.08));
    color: var(--text-primary, #f5f6ff);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
  }

  .replay-page-select:hover {
    background: var(--surface-muted, rgba(255, 255, 255, 0.15));
    border-color: var(--accent-primary, #9ecaff);
  }

  .replay-page-select:focus {
    border-color: var(--accent-primary, #9ecaff);
    box-shadow: 0 0 0 3px rgba(158, 202, 255, 0.2);
  }

  /* Mobile optimizations */
  @media (max-width: 768px) {
    .replay-modal {
      max-width: 100%;
      max-height: 100vh;
      border-radius: 0;
    }

    .replay-grid {
      grid-template-columns: 1fr;
      gap: 0.625rem;
    }

    .replay-pagination {
      flex-direction: column;
      gap: 0.75rem;
    }

    .replay-pagination-btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>
