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

  // === Админ ===
  let isAdmin = false;
  let uploading = false;
  let uploadError = '';
  let newOpening = {
    title: '',
    youtubeUrl: '',
    startTime: 0,
    endTime: 20
  };

  $: {
    isAdmin = $currentUser?.role === 'admin' || $currentUser?.is_admin === 1 || $currentUser?.isAdmin === true;
    console.log('[GuessOpening] currentUser:', $currentUser, 'isAdmin:', isAdmin);
  }
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

  onMount(() => {
    loadOpenings();
    
    // Загрузка YouTube API
    if (window.YT && window.YT.Player) {
      // API уже загружен
    } else {
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      
      window.onYouTubeIframeAPIReady = () => {
        console.log('[YouTube] API Ready');
      };
    }
  });

  // === Извлечение YouTube Video ID из URL ===
  function extractVideoId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  }

  // === Инициализация плеера ===
  function initPlayer() {
    if (!currentOpening || !window.YT || !window.YT.Player) return;
    
    const videoId = extractVideoId(currentOpening.youtubeUrl);
    if (!videoId) {
      console.error('Invalid YouTube URL');
      return;
    }

    // Удалить старый плеер
    if (player && player.destroy) {
      player.destroy();
    }

    player = new window.YT.Player('youtube-player', {
      height: '315',
      width: '560',
      videoId: videoId,
      playerVars: {
        autoplay: 0,
        start: currentOpening.startTime || 0,
        end: currentOpening.endTime || 20,
        enablejsapi: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        fs: 1,
      },
      events: {
        onReady: (event) => {
          playerReady = true;
          console.log('[YouTube] Player ready');
        },
        onStateChange: (event) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            console.log('[YouTube] Video ended');
          }
        },
      },
    });
  }

  // === Управление плеером ===
  function playVideo() {
    if (!playerReady) {
      initPlayer();
      setTimeout(() => {
        if (player && player.playVideo) {
          player.playVideo();
          state = 'playing';
        }
      }, 1000);
    } else {
      if (player && player.playVideo) {
        player.playVideo();
        state = 'playing';
      }
    }
  }

  function showHint() {
    state = 'blur';
  }

  function reset() {
    state = 'idle';
    userAnswer = '';
    answerFeedback = '';
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
      // Простая проверка: сравниваем с title (можно сделать через API)
      const correct = userAnswer.trim().toLowerCase() === currentOpening.title.toLowerCase();
      
      if (correct) {
        answerFeedback = 'correct';
        state = 'revealed';
        
        setTimeout(() => {
          // Переход к следующему опенингу
          if (currentIndex < openings.length - 1) {
            currentIndex++;
            reset();
            initPlayer();
          } else {
            alert('Все опенинги пройдены! 🎉');
          }
        }, 2000);
      } else {
        answerFeedback = 'incorrect';
        setTimeout(() => {
          answerFeedback = '';
        }, 1000);
      }
    } catch (e) {
      console.error('[checkAnswer] Error:', e);
    } finally {
      isChecking = false;
    }
  }

  // === Админ: загрузка опенинга ===
  async function uploadOpening() {
    uploadError = '';
    
    if (!newOpening.title.trim() || !newOpening.youtubeUrl.trim()) {
      uploadError = 'Заполните название и ссылку на YouTube';
      return;
    }

    try {
      uploading = true;
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/openings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newOpening)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('[uploadOpening] Success:', result);
      
      // Очистить форму
      newOpening = { title: '', youtubeUrl: '', startTime: 0, endTime: 20 };
      
      // Перезагрузить список
      await loadOpenings();
      
      alert('✓ Опенинг успешно добавлен!');
    } catch (e) {
      console.error('[uploadOpening] Error:', e);
      uploadError = `Ошибка загрузки: ${e?.message || 'Network error'}`;
    } finally {
      uploading = false;
    }
  }

  onDestroy(() => {
    if (player && player.destroy) {
      player.destroy();
    }
  });
</script>

<div class="guess-opening-container">
  <!-- DEBUG INFO (удалить после проверки) -->
  <div style="background: rgba(255,0,0,0.2); padding: 10px; margin-bottom: 10px; color: white; font-size: 12px;">
    <strong>DEBUG:</strong> isAdmin = {isAdmin} | currentUser = {JSON.stringify($currentUser)} | openings.length = {openings.length}
  </div>
  
  {#if isAdmin}
    <!-- === АДМИН ПАНЕЛЬ === -->
    <div class="admin-panel">
      <h2 class="admin-title">Панель администратора</h2>
      
      <div class="admin-form">
        <div class="form-group">
          <label>Название аниме:</label>
          <input 
            type="text" 
            bind:value={newOpening.title}
            placeholder="Например: Attack on Titan"
            class="admin-input"
          />
        </div>
        
        <div class="form-group">
          <label>Ссылка на YouTube:</label>
          <input 
            type="text" 
            bind:value={newOpening.youtubeUrl}
            placeholder="https://www.youtube.com/watch?v=..."
            class="admin-input"
          />
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Начало (сек):</label>
            <input 
              type="number" 
              bind:value={newOpening.startTime}
              class="admin-input"
              min="0"
            />
          </div>
          
          <div class="form-group">
            <label>Конец (сек):</label>
            <input 
              type="number" 
              bind:value={newOpening.endTime}
              class="admin-input"
              min="1"
            />
          </div>
        </div>
        
        {#if uploadError}
          <div class="error-message">{uploadError}</div>
        {/if}
        
        <button 
          class="admin-upload-btn" 
          on:click={uploadOpening}
          disabled={uploading}
        >
          {uploading ? '⏳ Загрузка...' : '✓ Добавить опенинг'}
        </button>
      </div>
      
      <div class="divider"></div>
    </div>
  {/if}

  <!-- === ИГРОВОЙ ИНТЕРФЕЙС === -->
  {#if openings.length === 0}
    <div class="empty-state">
      <div class="empty-icon">🎵</div>
      <div class="empty-text">Пока нет опенингов для угадывания</div>
      {#if !isAdmin}
        <button class="back-btn" on:click={goHome}>← Назад</button>
      {/if}
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
              <div class="play-text">Нажми PLAY</div>
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
</div>

<style>
  .guess-opening-container {
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
  }

  /* === АДМИН ПАНЕЛЬ === */
  .admin-panel {
    background: rgba(162, 57, 202, 0.1);
    border: 1px solid rgba(162, 57, 202, 0.3);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 32px;
  }

  .admin-title {
    color: var(--accent, #A239CA);
    font-size: 1.5rem;
    font-weight: 900;
    margin-bottom: 20px;
    text-transform: uppercase;
  }

  .admin-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .form-group label {
    color: rgba(255, 255, 255, 0.8);
    font-weight: 600;
    font-size: 0.9rem;
  }

  .admin-input {
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font-size: 1rem;
    transition: all 0.3s;
  }

  .admin-input:focus {
    outline: none;
    border-color: var(--accent, #A239CA);
    background: rgba(255, 255, 255, 0.08);
  }

  .admin-upload-btn {
    padding: 14px 24px;
    background: var(--accent, #A239CA);
    color: white;
    font-weight: 900;
    font-size: 1rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
    text-transform: uppercase;
  }

  .admin-upload-btn:hover:not(:disabled) {
    background: var(--accent2, #8B2FC9);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(162, 57, 202, 0.5);
  }

  .admin-upload-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-message {
    color: #f44336;
    font-weight: 600;
    padding: 12px;
    background: rgba(244, 67, 54, 0.1);
    border: 1px solid rgba(244, 67, 54, 0.3);
    border-radius: 8px;
  }

  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 24px 0 0 0;
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
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .counter {
    color: var(--accent, #A239CA);
    font-weight: 700;
    font-size: 1.1rem;
  }

  .title {
    font-size: clamp(1.2rem, 3vw, 1.8rem);
    font-weight: 900;
    color: white;
    letter-spacing: 1px;
    text-shadow: 0 0 20px rgba(162, 57, 202, 0.5);
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
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  .youtube-iframe {
    width: 100%;
    aspect-ratio: 16 / 9;
  }

  /* === Оверлей === */
  .overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.6s ease-in-out;
    pointer-events: none;
  }

  .overlay-idle {
    background: rgba(0, 0, 0, 0.9);
    pointer-events: all;
  }

  .overlay-playing {
    background: #000;
    opacity: 1;
  }

  .overlay-blur {
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(20px);
    opacity: 1;
  }

  .overlay-revealed {
    background: transparent;
    opacity: 0;
  }

  .play-overlay-btn {
    background: var(--accent, #A239CA);
    border: none;
    border-radius: 50%;
    width: 120px;
    height: 120px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 8px 24px rgba(162, 57, 202, 0.5);
  }

  .play-overlay-btn:hover {
    transform: scale(1.1);
    box-shadow: 0 12px 32px rgba(162, 57, 202, 0.7);
  }

  .play-icon {
    color: white;
    font-size: 3rem;
    line-height: 1;
  }

  .play-text {
    color: white;
    font-size: 0.9rem;
    font-weight: 700;
    margin-top: 4px;
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
    border-color: var(--accent, #A239CA);
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
    background: var(--accent, #A239CA);
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
    background: var(--accent2, #8B2FC9);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(162, 57, 202, 0.5);
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
  }
</style>
