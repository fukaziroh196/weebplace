<script>
  import { onMount, onDestroy } from 'svelte';
  import { goHome } from '../stores/ui';
  import { currentUser } from '../stores/authApi';
  import { animeGuesses as apiGuesses } from '../lib/api';

  // === Состояние визуализации ===
  // 'idle' — не начато (показываем кнопку PLAY)
  // 'playing' — видео играет, чёрный экран
  // 'blur' — сильный блюр (подсказка)
  // 'revealed' — полностью видимое видео (после правильного ответа)
  let state = 'idle';

  // === YouTube Player ===
  let player;
  let playerReady = false;
  
  // === Данные опенингов ===
  let openings = []; // Список опенингов с сервера
  let currentIndex = 0;
  let currentOpening = null;

  // === Игровой процесс ===
  let userAnswer = '';
  let isChecking = false;
  let answerFeedback = ''; // 'correct' | 'incorrect' | ''
  
  // === Система очков ===
  let totalScore = 0;
  let roundScores = []; // Массив очков для каждого раунда
  let hintUsed = false; // Использована ли подсказка в текущем раунде
  let showFinalResults = false;

  $: currentOpening = openings[currentIndex] || null;

  // === Загрузка опенингов ===
  async function loadOpenings() {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/openings`);
      if (response.ok) {
        openings = await response.json();
        if (openings.length > 0) {
          currentOpening = openings[0];
        }
      }
    } catch (e) {
      console.error('[loadOpenings] Error:', e);
    }
  }

  onMount(async () => {
    await loadOpenings();
    
    // Загрузка YouTube API
    if (window.YT && window.YT.Player) {
      console.log('[YouTube] API already loaded');
      if (currentOpening) {
        setTimeout(() => initPlayer(), 500);
      }
    } else {
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      
      window.onYouTubeIframeAPIReady = () => {
        console.log('[YouTube] API Ready');
        if (currentOpening) {
          setTimeout(() => initPlayer(), 500);
        }
      };
    }
  });
  
  // Реактивно инициализируем плеер когда появляется опенинг
  $: if (currentOpening && window.YT && window.YT.Player && !playerReady) {
    console.log('[YouTube] Auto-initializing player for:', currentOpening);
    setTimeout(() => initPlayer(), 300);
  }

  // === Извлечение YouTube Video ID из URL ===
  function extractVideoId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  }

  // === Инициализация плеера ===
  function initPlayer() {
    console.log('[initPlayer] Starting initialization');
    console.log('[initPlayer] currentOpening:', currentOpening);
    console.log('[initPlayer] window.YT:', window.YT);
    
    if (!currentOpening || !window.YT || !window.YT.Player) {
      console.error('[initPlayer] Missing requirements:', { currentOpening, YT: window.YT });
      return;
    }
    
    const videoId = extractVideoId(currentOpening.youtube_url || currentOpening.youtubeUrl);
    console.log('[initPlayer] Extracted videoId:', videoId);
    
    if (!videoId) {
      console.error('[initPlayer] Invalid YouTube URL:', currentOpening.youtube_url || currentOpening.youtubeUrl);
      return;
    }

    // Удалить старый плеер
    if (player && player.destroy) {
      console.log('[initPlayer] Destroying old player');
      try {
        player.destroy();
      } catch (e) {
        console.error('[initPlayer] Error destroying old player:', e);
      }
      playerReady = false;
    }

    console.log('[initPlayer] Creating new YouTube player');
    try {
      player = new window.YT.Player('youtube-player', {
        height: '315',
        width: '560',
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          start: currentOpening.start_time || currentOpening.startTime || 0,
          end: currentOpening.end_time || currentOpening.endTime || 20,
          enablejsapi: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          fs: 1,
        },
        events: {
          onReady: (event) => {
            playerReady = true;
            console.log('[YouTube] Player ready!');
          },
          onStateChange: (event) => {
            console.log('[YouTube] State changed:', event.data);
            if (event.data === window.YT.PlayerState.ENDED) {
              console.log('[YouTube] Video ended');
            }
          },
          onError: (event) => {
            console.error('[YouTube] Player error:', event.data);
          }
        },
      });
      console.log('[initPlayer] Player created successfully');
    } catch (e) {
      console.error('[initPlayer] Error creating player:', e);
    }
  }

  // === Управление плеером ===
  function playVideo() {
    console.log('[playVideo] Called. playerReady:', playerReady, 'player:', player);
    
    if (!player || !playerReady) {
      console.log('[playVideo] Player not ready, initializing...');
      initPlayer();
      
      // Ждём готовности и пытаемся снова
      const checkAndPlay = setInterval(() => {
        if (playerReady && player && player.playVideo) {
          console.log('[playVideo] Player ready, starting playback');
          clearInterval(checkAndPlay);
          try {
            player.playVideo();
            state = 'playing';
          } catch (e) {
            console.error('[playVideo] Error:', e);
          }
        }
      }, 200);
      
      // Таймаут на 5 секунд
      setTimeout(() => clearInterval(checkAndPlay), 5000);
    } else {
      console.log('[playVideo] Player ready, playing immediately');
      try {
        player.playVideo();
        state = 'playing';
      } catch (e) {
        console.error('[playVideo] Error:', e);
      }
    }
  }

  function showHint() {
    state = 'blur';
    hintUsed = true; // Отметить что подсказка использована
  }

  function reset() {
    state = 'idle';
    userAnswer = '';
    answerFeedback = '';
    hintUsed = false;
    if (player && playerReady) {
      player.stopVideo();
    }
  }

  // === Проверка ответа ===
  async function checkAnswer() {
    if (!currentOpening || !userAnswer.trim()) return;
    
    isChecking = true;
    answerFeedback = '';

    try {
      // Простая проверка: сравниваем с title
      const correct = userAnswer.trim().toLowerCase() === currentOpening.title.toLowerCase();
      
      let roundScore = 0;
      
      if (correct) {
        // Правильный ответ
        answerFeedback = 'correct';
        state = 'revealed';
        
        // Начисление очков: 10000 без подсказки, 2500 с подсказкой
        roundScore = hintUsed ? 2500 : 10000;
        roundScores.push(roundScore);
        totalScore += roundScore;
        
        console.log(`[checkAnswer] Correct! Score: ${roundScore}, Total: ${totalScore}`);
        
        setTimeout(() => {
          // Переход к следующему опенингу
          if (currentIndex < openings.length - 1) {
            currentIndex++;
            reset();
            initPlayer();
          } else {
            // Все опенинги отгаданы - показать финальные результаты
            console.log('[checkAnswer] All openings completed!');
            showFinalResults = true;
          }
        }, 1500);
      } else {
        // Неправильный ответ
        answerFeedback = 'incorrect';
        roundScores.push(0);
        
        console.log(`[checkAnswer] Incorrect! Score: 0`);
        
        setTimeout(() => {
          answerFeedback = '';
          
          // Переход к следующему опенингу даже при неправильном ответе
          if (currentIndex < openings.length - 1) {
            currentIndex++;
            reset();
            initPlayer();
          } else {
            // Все опенинги пройдены - показать финальные результаты
            console.log('[checkAnswer] All openings completed!');
            showFinalResults = true;
          }
        }, 1500);
      }
    } catch (e) {
      console.error('[checkAnswer] Error:', e);
    } finally {
      isChecking = false;
    }
  }

  // === Админ: загрузка опенинга ===
  onDestroy(() => {
    if (player && player.destroy) {
      player.destroy();
    }
  });
</script>

<div class="guess-opening-container">
  <!-- === ИГРОВОЙ ИНТЕРФЕЙС === -->
  {#if openings.length === 0}
    <div class="empty-state">
      <div class="empty-icon">🎵</div>
      <div class="empty-text">Пока нет опенингов для угадывания</div>
      <button class="back-btn" on:click={goHome}>← Назад</button>
    </div>
  {:else}
    <div class="game-area">
      <!-- Заголовок -->
      <div class="header">
        <h1 class="title">УГАДАЙ АНИМЕ ПО ОПЕНИНГУ</h1>
        <div class="header-right">
          <span class="counter">{currentIndex + 1} / {openings.length}</span>
          <button class="back-btn" on:click={goHome}>← Назад</button>
        </div>
      </div>

      <!-- YouTube Player с оверлеем -->
      <div class="player-wrapper">
        <!-- IFrame для YouTube -->
        <div id="youtube-player" class="youtube-iframe"></div>
        
        <!-- Оверлей -->
        <div 
          class="overlay" 
          class:overlay-idle={state === 'idle'}
          class:overlay-playing={state === 'playing'}
          class:overlay-blur={state === 'blur'}
          class:overlay-revealed={state === 'revealed'}
        >
          {#if state === 'idle'}
            <button class="play-overlay-btn" on:click={playVideo}>
              <div class="play-icon">▶</div>
            </button>
          {:else if state === 'playing'}
            <div class="overlay-text">🎵 Слушай и угадывай!</div>
          {/if}
        </div>
      </div>

      <!-- Поле ввода ответа -->
      {#if state !== 'idle'}
        <div class="answer-section">
          <input 
            type="text" 
            bind:value={userAnswer}
            placeholder="Введите название аниме"
            class="answer-input {answerFeedback === 'correct' ? 'answer-correct' : answerFeedback === 'incorrect' ? 'answer-incorrect' : ''}"
            on:keydown={(e) => { if (e.key === 'Enter') checkAnswer(); }}
            disabled={isChecking || state === 'revealed'}
          />
          
          <button 
            class="answer-btn"
            on:click={checkAnswer}
            disabled={isChecking || !userAnswer.trim() || state === 'revealed'}
          >
            {isChecking ? '⏳' : 'ОТВЕТИТЬ'}
          </button>
        </div>
      {/if}

      <!-- Кнопки управления -->
      <div class="controls">
        {#if state === 'playing'}
          <button 
            class="control-btn hint-btn" 
            on:click={showHint}
          >
            🔍 Подсказка (размытие)
          </button>
        {/if}
        
        {#if state !== 'idle'}
          <button 
            class="control-btn reset-btn" 
            on:click={reset}
          >
            🔄 Сбросить
          </button>
        {/if}
      </div>
    </div>
  {/if}
  
  <!-- === ФИНАЛЬНЫЕ РЕЗУЛЬТАТЫ === -->
  {#if showFinalResults}
    <div class="final-modal-overlay" on:click={() => { showFinalResults = false; goHome(); }}>
      <div class="final-modal-content" on:click|stopPropagation>
        <div class="final-header">
          <h2 class="final-title">РЕЗУЛЬТАТЫ</h2>
          <button class="final-close-btn" on:click={() => { showFinalResults = false; goHome(); }}>×</button>
        </div>
        
        <div class="final-score-box">
          <div class="final-score-label">ИТОГО</div>
          <div class="final-score-value">{totalScore.toLocaleString()}</div>
          <div class="final-score-suffix">ОЧКОВ</div>
        </div>
        
        <div class="rounds-summary">
          {#each roundScores as score, idx}
            <div class="round-item">
              <div class="round-label">Раунд {idx + 1}</div>
              <div class="round-score {score > 0 ? 'correct' : 'incorrect'}">
                {score > 0 ? '✓' : '✗'} {score.toLocaleString()} очков
              </div>
            </div>
          {/each}
        </div>
        
        <button class="final-done-btn" on:click={() => { showFinalResults = false; goHome(); }}>
          ЗАВЕРШИТЬ
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .guess-opening-container {
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
  }

  /* === ИГРОВАЯ ОБЛАСТЬ === */
  .empty-state {
    text-align: center;
    padding: 60px 20px;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 16px;
  }

  .empty-text {
    color: rgba(255, 255, 255, 0.6);
    font-size: 1.2rem;
    margin-bottom: 24px;
  }

  .game-area {
    width: 100%;
  }

  .header {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 24px;
    gap: 16px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    justify-content: center;
  }

  .counter {
    color: var(--accent);
    font-weight: 700;
    font-size: 1.1rem;
  }

  .title {
    font-size: clamp(1.2rem, 3vw, 1.8rem);
    font-weight: 900;
    color: var(--text);
    letter-spacing: 1px;
    text-align: center;
    width: 100%;
  }

  .back-btn {
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    white-space: nowrap;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  /* === YouTube Player === */
  .player-wrapper {
    position: relative;
    width: 100%;
    max-width: 560px;
    margin: 0 auto 24px;
    border-radius: 12px;
    overflow: hidden;
  }

  .youtube-iframe {
    width: 100%;
    aspect-ratio: 16 / 9;
    opacity: 0;
    pointer-events: none;
    position: absolute;
    top: 0;
    left: 0;
  }

  /* === Оверлей === */
  .overlay {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.6s ease-in-out;
    border-radius: 12px;
  }

  .overlay-idle {
    background: var(--panelStrong);
    pointer-events: all;
    box-shadow: 0 4px 12px rgba(91, 117, 83, 0.12);
  }

  .overlay-playing {
    background: var(--panelStrong);
    box-shadow: 0 4px 12px rgba(91, 117, 83, 0.12);
  }

  .overlay-blur {
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(20px);
    opacity: 1;
  }
  
  .overlay-blur .youtube-iframe {
    opacity: 1;
    position: relative;
    pointer-events: all;
  }

  .overlay-revealed {
    background: transparent;
  }
  
  .overlay-revealed .youtube-iframe {
    opacity: 1;
    position: relative;
    pointer-events: all;
  }

  .play-overlay-btn {
    background: var(--accent);
    border: none;
    border-radius: 16px;
    width: 140px;
    height: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 8px 24px rgba(91, 117, 83, 0.4);
  }

  .play-overlay-btn:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(91, 117, 83, 0.6);
    background: var(--extra);
  }

  .play-icon {
    color: white;
    font-size: 4rem;
    line-height: 1;
    margin-left: 8px;
  }

  .overlay-text {
    color: white;
    font-size: clamp(1rem, 3vw, 1.5rem);
    font-weight: 700;
    text-align: center;
    padding: 20px;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
  }

  /* === Поле ответа === */
  .answer-section {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    max-width: 560px;
    margin-left: auto;
    margin-right: auto;
  }

  .answer-input {
    flex: 1;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font-size: 1rem;
    transition: all 0.3s;
  }

  .answer-input:focus {
    outline: none;
    border-color: var(--accent);
    background: rgba(255, 255, 255, 0.08);
  }

  .answer-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .answer-input.answer-correct {
    border-color: #4CAF50 !important;
    box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
  }

  .answer-input.answer-incorrect {
    border-color: #f44336 !important;
    box-shadow: 0 0 10px rgba(244, 67, 54, 0.5);
    animation: shake 0.3s;
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }

  .answer-btn {
    padding: 14px 30px;
    background: var(--accent);
    color: white;
    font-weight: 900;
    font-size: 1rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
    white-space: nowrap;
  }

  .answer-btn:hover:not(:disabled) {
    background: var(--extra);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(91, 117, 83, 0.4);
  }

  .answer-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  /* === Кнопки управления === */
  .controls {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .control-btn {
    padding: 12px 20px;
    font-size: 0.95rem;
    font-weight: 700;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
  }

  .hint-btn {
    background: linear-gradient(135deg, #FFB74D, #FF9800);
    color: white;
  }

  .hint-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(255, 183, 77, 0.5);
  }

  .reset-btn {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .reset-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  /* === ФИНАЛЬНЫЕ РЕЗУЛЬТАТЫ === */
  .final-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .final-modal-content {
    background: var(--panelStrong);
    border-radius: 16px;
    padding: 32px;
    max-width: 500px;
    width: 100%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.4s ease;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .final-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .final-title {
    font-size: 1.8rem;
    font-weight: 900;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .final-close-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.2);
    border: none;
    color: var(--text);
    font-size: 2rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .final-close-btn:hover {
    background: rgba(0, 0, 0, 0.4);
    transform: rotate(90deg);
  }

  .final-score-box {
    text-align: center;
    padding: 32px 20px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    border-radius: 12px;
    margin-bottom: 24px;
  }

  .final-score-label {
    font-size: 0.9rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.8);
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 8px;
  }

  .final-score-value {
    font-size: 3.5rem;
    font-weight: 900;
    color: white;
    line-height: 1;
    text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .final-score-suffix {
    font-size: 1.2rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-top: 4px;
  }

  .rounds-summary {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
  }

  .round-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
    transition: all 0.2s ease;
  }

  .round-item:hover {
    background: rgba(0, 0, 0, 0.3);
  }

  .round-label {
    font-size: 1rem;
    font-weight: 700;
    color: var(--accent);
    text-transform: uppercase;
  }

  .round-score {
    font-size: 1.1rem;
    font-weight: 700;
  }

  .round-score.correct {
    color: #4CAF50;
  }

  .round-score.incorrect {
    color: #f44336;
  }

  .final-done-btn {
    width: 100%;
    padding: 16px;
    background: var(--accent);
    color: white;
    font-size: 1.1rem;
    font-weight: 900;
    text-transform: uppercase;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
    letter-spacing: 1px;
  }

  .final-done-btn:hover {
    background: var(--extra);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(91, 117, 83, 0.4);
  }

  /* === Адаптивность === */
  @media (max-width: 768px) {
    .guess-opening-container {
      padding: 16px;
    }

    .header {
      flex-direction: column;
      align-items: flex-start;
    }

    .title {
      font-size: 1.2rem;
    }

    .answer-section {
      flex-direction: column;
    }

    .form-row {
      grid-template-columns: 1fr;
    }
    
    .final-modal-content {
      padding: 24px;
    }
    
    .final-score-value {
      font-size: 2.5rem;
    }
  }
</style>
