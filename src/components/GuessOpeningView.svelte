<script>
  import { onMount, onDestroy } from 'svelte';
  import { goHome } from '../stores/ui';

  // === Состояние визуализации ===
  // 'hidden' — чёрный экран (только звук)
  // 'blur' — сильный блюр (подсказка)
  // 'visible' — полностью видимое видео
  let state = 'hidden';

  // === YouTube Player ===
  let player;
  let playerReady = false;
  
  // Пример видео: YouTube ID и временной диапазон
  const videoId = 'dQw4w9WgXcQ'; // Замени на ID опенинга
  const startTime = 10; // Начать с 10-й секунды
  const endTime = 30;   // Закончить на 30-й секунде (20 сек воспроизведения)

  // === Загрузка YouTube IFrame API ===
  onMount(() => {
    // Проверяем, загружен ли API
    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      // Загружаем API, если его нет
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      
      // YouTube вызывает эту функцию, когда API готов
      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    }
  });

  function initPlayer() {
    player = new window.YT.Player('youtube-player', {
      height: '315',
      width: '560',
      videoId: videoId,
      playerVars: {
        autoplay: 1,        // Автовоспроизведение
        start: startTime,   // Начать с N секунды
        end: endTime,       // Закончить на N секунде
        enablejsapi: 1,     // Включить JS API
        controls: 0,        // Скрыть контролы
        modestbranding: 1,  // Убрать лого YouTube
        rel: 0,             // Не показывать похожие видео
        fs: 1,              // Разрешить полноэкранный режим
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
    });
  }

  function onPlayerReady(event) {
    playerReady = true;
    event.target.playVideo(); // Начать воспроизведение
  }

  function onPlayerStateChange(event) {
    // Если видео закончилось (достигло endTime), можно сбросить или показать результат
    if (event.data === window.YT.PlayerState.ENDED) {
      console.log('Видео закончилось');
    }
  }

  // === Управление состоянием ===
  function showHint() {
    state = 'blur';
  }

  function showAnswer() {
    state = 'visible';
  }

  function reset() {
    state = 'hidden';
    if (player && playerReady) {
      player.seekTo(startTime);
      player.playVideo();
    }
  }

  // === Очистка при размонтировании ===
  onDestroy(() => {
    if (player && player.destroy) {
      player.destroy();
    }
  });
</script>

<div class="guess-opening-container">
  <!-- Заголовок -->
  <div class="header">
    <h1 class="title">УГАДАЙ АНИМЕ ПО ОПЕНИНГУ</h1>
    <button class="back-btn" on:click={goHome}>← Назад</button>
  </div>

  <!-- YouTube Player с оверлеем -->
  <div class="player-wrapper">
    <!-- IFrame для YouTube -->
    <div id="youtube-player" class="youtube-iframe"></div>
    
    <!-- Оверлей (чёрный экран или блюр) -->
    <div 
      class="overlay" 
      class:overlay-hidden={state === 'hidden'}
      class:overlay-blur={state === 'blur'}
      class:overlay-visible={state === 'visible'}
    >
      {#if state === 'hidden'}
        <div class="overlay-text">🎵 Слушай опенинг и угадывай!</div>
      {/if}
    </div>
  </div>

  <!-- Кнопки управления -->
  <div class="controls">
    <button 
      class="control-btn hint-btn" 
      on:click={showHint}
      disabled={state !== 'hidden'}
    >
      🔍 Подсказка (размытие)
    </button>
    
    <button 
      class="control-btn answer-btn" 
      on:click={showAnswer}
      disabled={state === 'visible'}
    >
      👁️ Показать ответ
    </button>
    
    <button 
      class="control-btn reset-btn" 
      on:click={reset}
    >
      🔄 Сбросить
    </button>
  </div>
</div>

<style>
  .guess-opening-container {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .title {
    font-size: clamp(1.5rem, 4vw, 2rem);
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
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  /* === YouTube Player Wrapper === */
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

  /* === Оверлей (чёрный экран / блюр / прозрачный) === */
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

  /* Состояние: скрыто (чёрный экран) */
  .overlay-hidden {
    background: #000;
    backdrop-filter: none;
    opacity: 1;
  }

  /* Состояние: блюр (подсказка) */
  .overlay-blur {
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(20px);
    opacity: 1;
  }

  /* Состояние: видимо (оверлей убран) */
  .overlay-visible {
    background: transparent;
    backdrop-filter: none;
    opacity: 0;
  }

  .overlay-text {
    color: white;
    font-size: clamp(1rem, 3vw, 1.5rem);
    font-weight: 700;
    text-align: center;
    padding: 20px;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
  }

  /* === Кнопки управления === */
  .controls {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .control-btn {
    padding: 14px 24px;
    font-size: 1rem;
    font-weight: 700;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .hint-btn {
    background: var(--accent, #A239CA);
    color: white;
  }

  .hint-btn:hover:not(:disabled) {
    background: var(--accent2, #8B2FC9);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(162, 57, 202, 0.5);
  }

  .answer-btn {
    background: linear-gradient(135deg, #4CAF50, #45a049);
    color: white;
  }

  .answer-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(76, 175, 80, 0.5);
  }

  .reset-btn {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .reset-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .control-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
  }

  .control-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  /* === Адаптивность === */
  @media (max-width: 768px) {
    .guess-opening-container {
      padding: 16px;
    }

    .header {
      flex-direction: column;
      gap: 12px;
      align-items: flex-start;
    }

    .title {
      font-size: 1.5rem;
    }

    .control-btn {
      padding: 12px 18px;
      font-size: 0.9rem;
    }
  }
</style>
