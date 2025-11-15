<script>
  import { onMount } from 'svelte';
  import GuessBattleView from './GuessBattleView.svelte';
  import { activeView } from '../stores/ui';

  let battlePacks = [];
  let loading = true;
  let error = '';
  let selectedPackId = null;

  onMount(async () => {
    await loadBattlePacks();
  });

  async function loadBattlePacks() {
    loading = true;
    error = '';
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/battle-packs`);
      
      if (response.ok) {
        const data = await response.json();
        battlePacks = data.packs || [];
        console.log('[loadBattlePacks] Loaded packs:', battlePacks);
      } else {
        error = 'Ошибка загрузки баттл паков';
      }
    } catch (e) {
      console.error('[loadBattlePacks] Error:', e);
      error = 'Ошибка сети';
    } finally {
      loading = false;
    }
  }

  function selectPack(packId) {
    selectedPackId = packId;
  }

  function goBack() {
    activeView.set('home');
  }
</script>

<div class="battle-pack-selector">
  <div class="header">
    <button class="back-btn" on:click={goBack} type="button">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
      </svg>
      <span>Назад</span>
    </button>
    <h1 class="title">Выберите баттл пак</h1>
  </div>

  {#if loading}
    <div class="loading">
      <div class="loading-spinner"></div>
      <div class="loading-text">Загрузка баттл паков...</div>
    </div>
  {:else if error}
    <div class="error">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
      <span>{error}</span>
    </div>
  {:else if battlePacks.length === 0}
    <div class="empty">
      <div class="empty-icon">⚔️</div>
      <div class="empty-text">Нет доступных баттл паков</div>
      <div class="empty-subtext">Администратор должен создать баттл пак</div>
    </div>
  {:else if selectedPackId}
    <GuessBattleView packId={selectedPackId} />
  {:else}
    <div class="packs-grid">
      {#each battlePacks as pack}
        <button 
          class="pack-card" 
          on:click={() => selectPack(pack.id)}
          type="button"
        >
          <div class="pack-icon-wrapper">
            <div class="pack-icon">⚔️</div>
          </div>
          <div class="pack-info">
            <h3 class="pack-name">{pack.name}</h3>
            {#if pack.description}
              <p class="pack-description">{pack.description}</p>
            {/if}
            <div class="pack-date">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
              </svg>
              <span>Создан: {new Date(pack.created_at).toLocaleDateString('ru-RU')}</span>
            </div>
          </div>
          <div class="pack-arrow">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .battle-pack-selector {
    min-height: 100%;
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--surface-primary, rgba(255, 255, 255, 0.1));
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.2));
    color: var(--text-primary, #f5f6ff);
    padding: 0.75rem 1.25rem;
    border-radius: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.9375rem;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }

  .back-btn:hover {
    background: var(--surface-card, rgba(255, 255, 255, 0.15));
    border-color: var(--accent-primary, #9ecaff);
    color: var(--accent-primary, #9ecaff);
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(158, 202, 255, 0.3);
  }

  .back-btn:active {
    transform: translateY(0);
  }

  .title {
    font-size: 2rem;
    font-weight: 900;
    color: var(--text-primary, #f5f6ff);
    margin: 0;
    letter-spacing: 0.02em;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    gap: 1rem;
  }

  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--surface-muted, rgba(255, 255, 255, 0.1));
    border-top-color: var(--accent-primary, #9ecaff);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-text {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-secondary, rgba(245, 246, 255, 0.85));
  }

  .error {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    text-align: center;
    padding: 2rem;
    border-radius: 0.75rem;
    background: var(--danger-bg, rgba(255, 183, 213, 0.25));
    border: 1px solid var(--danger-color, #ffb7d5);
    color: var(--danger-color, #ffb7d5);
    font-size: 1rem;
    font-weight: 600;
    max-width: 600px;
    margin: 0 auto;
  }

  .error svg {
    flex-shrink: 0;
  }

  .empty {
    text-align: center;
    padding: 4rem 2rem;
    background: var(--surface-secondary, rgba(255, 255, 255, 0.08));
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.2));
    border-radius: 1rem;
    max-width: 500px;
    margin: 0 auto;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    filter: drop-shadow(0 4px 8px rgba(158, 202, 255, 0.3));
  }

  .empty-text {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary, #f5f6ff);
    margin-bottom: 0.5rem;
  }

  .empty-subtext {
    color: var(--text-tertiary, rgba(245, 246, 255, 0.65));
    font-size: 1rem;
  }

  .packs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .pack-card {
    background: var(--surface-primary, rgba(255, 255, 255, 0.1));
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.2));
    border-radius: 1rem;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    align-items: center;
    gap: 1.25rem;
    text-align: left;
    width: 100%;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    position: relative;
    overflow: hidden;
  }

  .pack-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(158, 202, 255, 0.1), transparent);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .pack-card:hover::before {
    opacity: 1;
  }

  .pack-card:hover {
    border-color: var(--accent-primary, #9ecaff);
    background: var(--surface-card, rgba(255, 255, 255, 0.15));
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(158, 202, 255, 0.4);
  }

  .pack-card:active {
    transform: translateY(-2px);
  }

  .pack-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background: var(--surface-secondary, rgba(255, 255, 255, 0.08));
    border-radius: 0.75rem;
    flex-shrink: 0;
    border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.15));
  }

  .pack-icon {
    font-size: 2rem;
    line-height: 1;
    filter: drop-shadow(0 2px 4px rgba(158, 202, 255, 0.3));
  }

  .pack-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .pack-name {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary, #f5f6ff);
    margin: 0;
    line-height: 1.3;
  }

  .pack-description {
    color: var(--text-secondary, rgba(245, 246, 255, 0.85));
    font-size: 0.9375rem;
    margin: 0;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .pack-date {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-tertiary, rgba(245, 246, 255, 0.65));
    font-size: 0.8125rem;
    margin-top: 0.25rem;
  }

  .pack-date svg {
    flex-shrink: 0;
    opacity: 0.7;
  }

  .pack-arrow {
    color: var(--accent-primary, #9ecaff);
    flex-shrink: 0;
    transition: transform 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pack-card:hover .pack-arrow {
    transform: translateX(4px);
  }

  @media (max-width: 768px) {
    .battle-pack-selector {
      padding: 1rem;
    }

    .header {
      flex-wrap: wrap;
      gap: 1rem;
    }

    .title {
      font-size: 1.5rem;
    }

    .packs-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .pack-card {
      padding: 1.25rem;
      gap: 1rem;
    }

    .pack-icon-wrapper {
      width: 56px;
      height: 56px;
    }

    .pack-icon {
      font-size: 1.75rem;
    }

    .pack-name {
      font-size: 1.125rem;
    }
  }
</style>
