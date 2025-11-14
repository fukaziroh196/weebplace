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
    <button class="back-btn" on:click={goBack}>
      ← Назад
    </button>
    <h1 class="title">Выберите баттл пак</h1>
  </div>

  {#if loading}
    <div class="loading">Загрузка баттл паков...</div>
  {:else if error}
    <div class="error">{error}</div>
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
        <div class="pack-card" on:click={() => selectPack(pack.id)}>
          <div class="pack-icon">⚔️</div>
          <div class="pack-info">
            <h3 class="pack-name">{pack.name}</h3>
            {#if pack.description}
              <p class="pack-description">{pack.description}</p>
            {/if}
            <div class="pack-date">
              Создан: {new Date(pack.created_at).toLocaleDateString('ru-RU')}
            </div>
          </div>
          <div class="pack-arrow">→</div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .battle-pack-selector {
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
    padding: 2rem;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .back-btn {
    background: var(--panel);
    border: 1px solid var(--accent);
    color: var(--text);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .back-btn:hover {
    background: var(--accent-primary, #9ecaff);
    color: white;
  }

  .title {
    font-size: 2rem;
    font-weight: 900;
    color: var(--text);
    margin: 0;
  }

  .loading, .error {
    text-align: center;
    padding: 3rem;
    font-size: 1.2rem;
    color: var(--muted);
  }

  .error {
    color: #ff6b6b;
  }

  .empty {
    text-align: center;
    padding: 4rem 2rem;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .empty-text {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 0.5rem;
  }

  .empty-subtext {
    color: var(--muted);
    font-size: 1rem;
  }

  .packs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .pack-card {
    background: var(--panel);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .pack-card:hover {
    border-color: var(--accent-primary, #9ecaff);
    background: rgba(255, 255, 255, 0.05);
    transform: translateY(-2px);
  }

  .pack-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .pack-info {
    flex: 1;
    min-width: 0;
  }

  .pack-name {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text);
    margin: 0 0 0.5rem 0;
  }

  .pack-description {
    color: var(--muted);
    font-size: 0.9rem;
    margin: 0 0 0.5rem 0;
    line-height: 1.4;
  }

  .pack-date {
    color: var(--muted);
    font-size: 0.8rem;
  }

  .pack-arrow {
    font-size: 1.5rem;
    color: var(--accent-primary, #9ecaff);
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .battle-pack-selector {
      padding: 1rem;
    }

    .title {
      font-size: 1.5rem;
    }

    .packs-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .pack-card {
      padding: 1rem;
    }
  }
</style>
