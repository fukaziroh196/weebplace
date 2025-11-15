<script>
  import { goToAniQuiz } from '../stores/ui';
</script>

<div class="guess-character-view">
  <div class="header">
    <h1 class="title">Угадай персонажа</h1>
    <button class="back-btn" on:click={goToAniQuiz} type="button">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
      </svg>
      <span>К квизам</span>
    </button>
  </div>
  
  <div class="coming-soon-card">
    <div class="coming-soon-icon-wrapper">
      <div class="coming-soon-icon">👤</div>
      <div class="icon-glow"></div>
    </div>
    <h2 class="coming-soon-title">Скоро здесь</h2>
    <p class="coming-soon-text">
      Скоро здесь будет режим, где нужно угадать персонажа по обрезанному кадру/аватару.
    </p>
    <div class="coming-soon-features">
      <div class="feature-item">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <span>Угадывание по аватару</span>
      </div>
      <div class="feature-item">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <span>Обрезанные кадры</span>
      </div>
      <div class="feature-item">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <span>Соревновательный режим</span>
      </div>
    </div>
  </div>
</div>

<style>
  .guess-character-view {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 2rem;
    max-width: 1000px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .title {
    font-size: 2rem;
    font-weight: 900;
    color: var(--text-primary, #f5f6ff);
    margin: 0;
    letter-spacing: 0.02em;
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

  .coming-soon-card {
    background: var(--surface-primary, rgba(255, 255, 255, 0.1));
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.2));
    border-radius: 1.5rem;
    padding: 3rem 2rem;
    text-align: center;
    box-shadow: var(--shadow-outer, 0 1.5rem 4rem rgba(0, 0, 0, 0.35));
    position: relative;
    overflow: hidden;
  }

  .coming-soon-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 0%, rgba(158, 202, 255, 0.1), transparent 70%);
    pointer-events: none;
  }

  .coming-soon-icon-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .coming-soon-icon {
    font-size: 5rem;
    line-height: 1;
    position: relative;
    z-index: 2;
    filter: drop-shadow(0 4px 12px rgba(158, 202, 255, 0.4));
    animation: float 3s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  .icon-glow {
    position: absolute;
    inset: -20px;
    background: radial-gradient(circle, rgba(158, 202, 255, 0.3), transparent 70%);
    border-radius: 50%;
    z-index: 1;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 0.5;
      transform: scale(1);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.1);
    }
  }

  .coming-soon-title {
    font-size: 2rem;
    font-weight: 900;
    color: var(--text-primary, #f5f6ff);
    margin: 0 0 1rem 0;
    letter-spacing: 0.05em;
  }

  .coming-soon-text {
    font-size: 1.125rem;
    color: var(--text-secondary, rgba(245, 246, 255, 0.85));
    line-height: 1.6;
    margin: 0 0 2rem 0;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }

  .coming-soon-features {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid var(--divider-color, rgba(255, 255, 255, 0.2));
    max-width: 500px;
    margin-left: auto;
    margin-right: auto;
  }

  .feature-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: var(--surface-secondary, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.15));
    border-radius: 0.75rem;
    color: var(--text-secondary, rgba(245, 246, 255, 0.85));
    font-size: 0.9375rem;
    font-weight: 500;
    text-align: left;
    transition: all 0.2s ease;
  }

  .feature-item:hover {
    background: var(--surface-card, rgba(255, 255, 255, 0.12));
    border-color: var(--accent-primary, #9ecaff);
    color: var(--text-primary, #f5f6ff);
    transform: translateX(4px);
  }

  .feature-item svg {
    flex-shrink: 0;
    color: var(--accent-primary, #9ecaff);
    opacity: 0.8;
  }

  .feature-item:hover svg {
    opacity: 1;
  }

  @media (max-width: 768px) {
    .guess-character-view {
      padding: 1rem;
      gap: 1.5rem;
    }

    .header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .title {
      font-size: 1.5rem;
    }

    .back-btn {
      width: 100%;
      justify-content: center;
    }

    .coming-soon-card {
      padding: 2rem 1.5rem;
      border-radius: 1rem;
    }

    .coming-soon-icon {
      font-size: 4rem;
    }

    .coming-soon-title {
      font-size: 1.5rem;
    }

    .coming-soon-text {
      font-size: 1rem;
    }

    .coming-soon-features {
      gap: 0.75rem;
      margin-top: 1.5rem;
      padding-top: 1.5rem;
    }

    .feature-item {
      padding: 0.75rem;
      font-size: 0.875rem;
    }
  }
</style>
