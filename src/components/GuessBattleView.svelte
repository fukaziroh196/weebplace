<script>
  import { onMount } from 'svelte';
  import { currentUser } from '../stores/authApi';
  import { goHome } from '../stores/ui';
  import { quizDate } from '../stores/quizzes';

  // === Состояние игры ===
  let battleData = [];
  let currentRound = 0;
  let currentMatch = 0;
  let matches = [];
  let showResults = false;
  let loading = false;
  let error = '';

  // === Результаты ===
  let results = []; // Массив с результатами каждого аниме
  let totalRounds = 0;

  $: currentMatchData = matches[currentMatch] || null;

  // === Загрузка данных баттла ===
  async function loadBattleData() {
    loading = true;
    error = '';
    
    try {
      const currentDate = $quizDate || new Date().toISOString().split('T')[0];
      const url = `${import.meta.env.VITE_API_URL}/battles?date=${currentDate}`;
      console.log('[loadBattleData] Fetching from:', url);
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[loadBattleData] Received data:', data);
        battleData = data.anime || [];
        console.log('[loadBattleData] Battle data:', battleData, 'length:', battleData.length);
        
        if (battleData.length < 2) {
          console.log('[loadBattleData] Not enough anime:', battleData.length);
          error = 'Недостаточно аниме для баттла (минимум 2)';
          return;
        }
        
        // Инициализируем результаты
        initializeResults();
        
        // Генерируем матчи для первого раунда
        generateMatches();
      } else {
        error = 'Ошибка загрузки данных баттла';
      }
    } catch (e) {
      console.error('[loadBattleData] Error:', e);
      error = 'Ошибка сети';
    } finally {
      loading = false;
    }
  }

  // === Инициализация результатов ===
  function initializeResults() {
    results = battleData.map(anime => ({
      id: anime.id,
      title: anime.title,
      image: anime.image,
      wins: 0,
      losses: 0,
      draws: 0,
      points: 0,
      opponents: new Set()
    }));
  }

  // === Генерация матчей (простая система) ===
  function generateMatches() {
    matches = [];
    const shuffled = [...battleData].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        matches.push({
          anime1: shuffled[i],
          anime2: shuffled[i + 1],
          voted: false
        });
      }
    }
    
    currentMatch = 0;
    totalRounds = Math.ceil(Math.log2(battleData.length));
  }

  // === Голосование ===
  async function voteForAnime(winnerId) {
    if (!currentMatchData || currentMatchData.voted) return;
    
    const match = matches[currentMatch];
    const loserId = match.anime1.id === winnerId ? match.anime2.id : match.anime1.id;
    
    // Обновляем результаты
    const winner = results.find(r => r.id === winnerId);
    const loser = results.find(r => r.id === loserId);
    
    if (winner && loser) {
      winner.wins++;
      winner.points += 3;
      winner.opponents.add(loserId);
      
      loser.losses++;
      loser.opponents.add(winnerId);
    }
    
    // Отмечаем матч как проголосованный
    match.voted = true;
    matches = [...matches];
    
    // Переходим к следующему матчу
    if (currentMatch < matches.length - 1) {
      currentMatch++;
    } else {
      // Раунд завершен
      currentRound++;
      if (currentRound < totalRounds) {
        // Генерируем матчи для следующего раунда
        generateNextRound();
      } else {
        // Турнир завершен
        showResults = true;
        await submitResults();
      }
    }
  }

  // === Генерация следующего раунда ===
  function generateNextRound() {
    // Сортируем по очкам и генерируем новые матчи
    const sortedResults = [...results].sort((a, b) => b.points - a.points);
    matches = [];
    
    for (let i = 0; i < sortedResults.length; i += 2) {
      if (i + 1 < sortedResults.length) {
        const anime1 = battleData.find(a => a.id === sortedResults[i].id);
        const anime2 = battleData.find(a => a.id === sortedResults[i + 1].id);
        
        if (anime1 && anime2) {
          matches.push({
            anime1,
            anime2,
            voted: false
          });
        }
      }
    }
    
    currentMatch = 0;
  }

  // === Отправка результатов ===
  async function submitResults() {
    if (!$currentUser) return;
    
    try {
      const currentDate = $quizDate || new Date().toISOString().split('T')[0];
      await fetch(`${import.meta.env.VITE_API_URL}/battle-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('api_token')}`
        },
        body: JSON.stringify({
          date: currentDate,
          results: results.map(r => ({
            animeId: r.id,
            wins: r.wins,
            losses: r.losses,
            points: r.points
          }))
        })
      });
      
      console.log('[submitResults] Results submitted successfully');
    } catch (error) {
      console.error('[submitResults] Error:', error);
    }
  }

  // === Перезапуск турнира ===
  function restartTournament() {
    currentRound = 0;
    currentMatch = 0;
    showResults = false;
    initializeResults();
    generateMatches();
  }

  // === Перезагрузка при смене даты ===
  let lastLoadedDate = '';
  $: (async () => {
    try {
      const currentDate = $quizDate || new Date().toISOString().split('T')[0];
      if (currentDate && currentDate !== lastLoadedDate) {
        lastLoadedDate = currentDate;
        await loadBattleData();
        restartTournament();
      }
    } catch (e) {
      console.error('[Date change] Error:', e);
    }
  })();

  onMount(() => {
    loadBattleData();
  });
</script>

<div class="battle-container">
  {#if loading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Загрузка данных баттла...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <div class="error-icon">⚠️</div>
      <p>{error}</p>
      <button class="retry-btn" on:click={loadBattleData}>Попробовать снова</button>
    </div>
  {:else if showResults}
    <!-- === РЕЗУЛЬТАТЫ ТУРНИРА === -->
    <div class="results-container">
      <div class="results-header">
        <h1 class="results-title">🏆 РЕЗУЛЬТАТЫ ТУРНИРА</h1>
        <div class="tournament-info">
          <span>Участников: {battleData.length}</span>
          <span>Раундов: {totalRounds}</span>
        </div>
      </div>
      
      <div class="results-table">
        <div class="table-header">
          <div class="col-rank">Место</div>
          <div class="col-image">Аниме</div>
          <div class="col-title">Название</div>
          <div class="col-wins">Победы</div>
          <div class="col-losses">Поражения</div>
          <div class="col-points">Очки</div>
        </div>
        
        {#each results.sort((a, b) => b.points - a.points) as result, index}
          <div class="table-row {index < 3 ? 'podium' : ''}">
            <div class="col-rank">
              {#if index === 0}
                🥇
              {:else if index === 1}
                🥈
              {:else if index === 2}
                🥉
              {:else}
                {index + 1}
              {/if}
            </div>
            <div class="col-image">
              <img src="{result.image}" alt="{result.title}" class="anime-image" />
            </div>
            <div class="col-title">{result.title}</div>
            <div class="col-wins">{result.wins}</div>
            <div class="col-losses">{result.losses}</div>
            <div class="col-points">{result.points}</div>
          </div>
        {/each}
      </div>
      
      <div class="results-actions">
        <button class="action-btn primary" on:click={restartTournament}>
          🔄 Новый турнир
        </button>
        <button class="action-btn secondary" on:click={goHome}>
          🏠 На главную
        </button>
      </div>
    </div>
  {:else if currentMatchData}
    <!-- === ИГРОВОЙ ИНТЕРФЕЙС === -->
    <div class="battle-interface">
      <div class="battle-header">
        <h1 class="battle-title">⚔️ АНИМЕ БАТТЛ</h1>
        <div class="battle-progress">
          <span>Раунд {currentRound + 1} из {totalRounds}</span>
          <span>Матч {currentMatch + 1} из {matches.length}</span>
        </div>
      </div>
      
      <div class="battle-match">
        <div class="vs-text">VS</div>
        
        <div class="anime-options">
          <div class="anime-option" on:click={() => voteForAnime(currentMatchData.anime1.id)}>
            <div class="anime-image-container">
              <img src="{currentMatchData.anime1.image}" alt="{currentMatchData.anime1.title}" class="anime-image" />
            </div>
            <div class="anime-title">{currentMatchData.anime1.title}</div>
            <div class="vote-btn">Голосовать</div>
          </div>
          
          <div class="anime-option" on:click={() => voteForAnime(currentMatchData.anime2.id)}>
            <div class="anime-image-container">
              <img src="{currentMatchData.anime2.image}" alt="{currentMatchData.anime2.title}" class="anime-image" />
            </div>
            <div class="anime-title">{currentMatchData.anime2.title}</div>
            <div class="vote-btn">Голосовать</div>
          </div>
        </div>
      </div>
      
      <div class="battle-stats">
        <div class="stat-item">
          <span class="stat-label">Проголосовано:</span>
          <span class="stat-value">{matches.filter(m => m.voted).length} / {matches.length}</span>
        </div>
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <div class="empty-icon">⚔️</div>
      <p>Нет данных для баттла</p>
    </div>
  {/if}
</div>

<style>
  .battle-container {
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
    padding: 2rem;
  }

  .loading-state, .error-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    text-align: center;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--panel);
    border-top: 4px solid var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-icon, .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .retry-btn {
    background: var(--accent);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 1rem;
  }

  .battle-interface {
    max-width: 1200px;
    margin: 0 auto;
  }

  .battle-header {
    text-align: center;
    margin-bottom: 3rem;
  }

  .battle-title {
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 900;
    color: var(--accent);
    margin-bottom: 1rem;
  }

  .battle-progress {
    display: flex;
    justify-content: center;
    gap: 2rem;
    color: var(--muted);
    font-weight: 600;
  }

  .battle-match {
    position: relative;
    margin-bottom: 3rem;
  }

  .vs-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--accent);
    color: white;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 900;
    z-index: 10;
  }

  .anime-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    max-width: 800px;
    margin: 0 auto;
  }

  .anime-option {
    background: var(--panel);
    border-radius: 16px;
    padding: 2rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
    border: 2px solid transparent;
  }

  .anime-option:hover {
    transform: translateY(-4px);
    border-color: var(--accent);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .anime-image-container {
    margin-bottom: 1rem;
  }

  .anime-image {
    width: 200px;
    height: 280px;
    object-fit: cover;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .anime-title {
    font-size: 1.2rem;
    font-weight: 700;
    margin-bottom: 1rem;
    color: var(--text);
  }

  .vote-btn {
    background: var(--accent);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 600;
    display: inline-block;
  }

  .battle-stats {
    text-align: center;
    color: var(--muted);
  }

  .stat-item {
    display: inline-block;
    margin: 0 1rem;
  }

  .stat-label {
    margin-right: 0.5rem;
  }

  .stat-value {
    font-weight: 600;
    color: var(--accent);
  }

  /* === РЕЗУЛЬТАТЫ === */
  .results-container {
    max-width: 1000px;
    margin: 0 auto;
  }

  .results-header {
    text-align: center;
    margin-bottom: 3rem;
  }

  .results-title {
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 900;
    color: var(--accent);
    margin-bottom: 1rem;
  }

  .tournament-info {
    display: flex;
    justify-content: center;
    gap: 2rem;
    color: var(--muted);
    font-weight: 600;
  }

  .results-table {
    background: var(--panel);
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 3rem;
  }

  .table-header {
    display: grid;
    grid-template-columns: 80px 120px 1fr 100px 100px 100px;
    background: var(--accent);
    color: white;
    font-weight: 700;
    padding: 1rem;
  }

  .table-row {
    display: grid;
    grid-template-columns: 80px 120px 1fr 100px 100px 100px;
    padding: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    align-items: center;
  }

  .table-row.podium {
    background: linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 215, 0, 0.05) 100%);
  }

  .table-row:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .col-rank {
    text-align: center;
    font-size: 1.2rem;
    font-weight: 700;
  }

  .col-image {
    text-align: center;
  }

  .col-image .anime-image {
    width: 80px;
    height: 112px;
    object-fit: cover;
    border-radius: 8px;
  }

  .col-title {
    font-weight: 600;
    padding: 0 1rem;
  }

  .col-wins, .col-losses, .col-points {
    text-align: center;
    font-weight: 600;
  }

  .col-points {
    color: var(--accent);
  }

  .results-actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
  }

  .action-btn {
    padding: 14px 28px;
    border: none;
    border-radius: 8px;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.3s;
  }

  .action-btn.primary {
    background: var(--accent);
    color: white;
  }

  .action-btn.primary:hover {
    background: var(--accent2);
    transform: translateY(-2px);
  }

  .action-btn.secondary {
    background: var(--panel);
    color: var(--text);
    border: 2px solid var(--accent);
  }

  .action-btn.secondary:hover {
    background: var(--accent);
    color: white;
  }

  @media (max-width: 768px) {
    .battle-container {
      padding: 1rem;
    }

    .anime-options {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .anime-image {
      width: 150px;
      height: 210px;
    }

    .table-header, .table-row {
      grid-template-columns: 60px 80px 1fr 60px 60px 60px;
      font-size: 0.9rem;
    }

    .col-image .anime-image {
      width: 60px;
      height: 84px;
    }

    .results-actions {
      flex-direction: column;
      align-items: center;
    }
  }
</style>
