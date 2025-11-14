<script>
  import { onMount } from 'svelte';
  import { currentUser } from '../stores/authApi';
  import { userStats, loadUserStats } from '../stores/stats';

  // Определение всех возможных достижений
  const allAchievements = [
    {
      id: 'first_guess',
      title: 'Первый шаг',
      description: 'Угадай своё первое аниме',
      icon: '🎯',
      color: '#FF6B6B',
      rarity: 'common'
    },
    {
      id: 'perfect_day',
      title: 'Идеальный день',
      description: 'Угадай все 4 аниме за день',
      icon: '✨',
      color: '#4ECDC4',
      rarity: 'rare'
    },
    {
      id: 'streak_7',
      title: 'Неделя силы',
      description: 'Играй 7 дней подряд',
      icon: '🔥',
      color: '#FFE66D',
      rarity: 'rare'
    },
    {
      id: 'streak_30',
      title: 'Легенда месяца',
      description: 'Играй 30 дней подряд',
      icon: '👑',
      color: '#FF9F66',
      rarity: 'epic'
    },
    {
      id: 'no_hints',
      title: 'Мастер угадывания',
      description: 'Угадай без подсказок',
      icon: '🧠',
      color: '#92f5d4',
      rarity: 'common'
    },
    {
      id: 'first_try',
      title: 'С первого взгляда',
      description: 'Угадай с первой попытки',
      icon: '⚡',
      color: '#8fe3c1',
      rarity: 'rare'
    },
    {
      id: 'score_1000',
      title: 'Тысячник',
      description: 'Набери 1000 очков за день',
      icon: '💎',
      color: '#F38181',
      rarity: 'common'
    },
    {
      id: 'score_10000',
      title: 'Мастер очков',
      description: 'Набери 10000 очков за день',
      icon: '💠',
      color: '#AA96DA',
      rarity: 'epic'
    },
    {
      id: 'perfect_week',
      title: 'Неделя без ошибок',
      description: 'Угадай все аниме за неделю',
      icon: '⭐',
      color: '#FCBAD3',
      rarity: 'epic'
    },
    {
      id: 'opening_master',
      title: 'Мастер опенингов',
      description: 'Угадай 10 опенингов',
      icon: '🎵',
      color: '#C5E3F6',
      rarity: 'rare'
    },
    {
      id: 'character_master',
      title: 'Знаток персонажей',
      description: 'Угадай 10 персонажей',
      icon: '🎭',
      color: '#FFD93D',
      rarity: 'rare'
    },
    {
      id: 'battle_king',
      title: 'Король битв',
      description: 'Выиграй 10 баттлов',
      icon: '⚔️',
      color: '#6BCB77',
      rarity: 'epic'
    }
  ];

  // Симуляция разблокированных достижений (в реальности это будет из API)
  let unlockedAchievements = [];
  
  // Проверяем достижения на основе статистики
  $: {
    if ($userStats?.data) {
      const stats = $userStats.data;
      unlockedAchievements = [];
      
      // Первое угадывание
      if (stats.totalGuesses > 0) {
        unlockedAchievements.push('first_guess');
      }
      
      // Без подсказок (симуляция - нужно добавить в API)
      if (stats.totalScore > 0) {
        unlockedAchievements.push('no_hints');
      }
      
      // 1000 очков
      if (stats.totalScore >= 1000) {
        unlockedAchievements.push('score_1000');
      }
      
      // 10000 очков
      if (stats.totalScore >= 10000) {
        unlockedAchievements.push('score_10000');
      }
      
      // Серия 7 дней
      if (stats.currentStreak >= 7) {
        unlockedAchievements.push('streak_7');
      }
      
      // Серия 30 дней
      if (stats.currentStreak >= 30) {
        unlockedAchievements.push('streak_30');
      }
    }
  }

  onMount(() => {
    loadUserStats();
  });

  function isUnlocked(achievementId) {
    return unlockedAchievements.includes(achievementId);
  }

  function getRarityClass(rarity) {
    switch(rarity) {
      case 'epic': return 'epic';
      case 'rare': return 'rare';
      default: return 'common';
    }
  }
</script>

<div class="achievements-container">
  <div class="achievements-header">
    <h2 class="achievements-title">🏆 ДОСТИЖЕНИЯ</h2>
    <div class="achievements-stats">
      <span class="stats-text">
        {unlockedAchievements.length} / {allAchievements.length}
      </span>
    </div>
  </div>

  <div class="achievements-grid">
    {#each allAchievements as achievement}
      {@const unlocked = isUnlocked(achievement.id)}
      <div class="achievement-card {getRarityClass(achievement.rarity)}" class:unlocked={unlocked} class:locked={!unlocked}>
        <div class="achievement-icon" style="--achievement-color: {achievement.color}">
          {#if unlocked}
            <div class="icon-glow"></div>
          {/if}
          <span class="icon-emoji">{achievement.icon}</span>
        </div>
        <div class="achievement-info">
          <h3 class="achievement-title">{achievement.title}</h3>
          <p class="achievement-description">{achievement.description}</p>
        </div>
        {#if !unlocked}
          <div class="achievement-lock">🔒</div>
        {:else}
          <div class="achievement-badge unlocked-badge">✓</div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .achievements-container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .achievements-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid rgba(255, 255, 255, 0.1);
  }

  .achievements-title {
    font-size: 2rem;
    font-weight: 900;
    color: var(--text);
    letter-spacing: 0.02em;
    margin: 0;
  }

  .achievements-stats {
    background: var(--accent-primary, #9ecaff);
    padding: 0.5rem 1.5rem;
    border-radius: 12px;
    font-weight: 700;
    color: white;
  }

  .stats-text {
    font-size: 1rem;
  }

  .achievements-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .achievement-card {
    position: relative;
    background: var(--panelStrong);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    cursor: pointer;
  }

  .achievement-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.05),
      transparent
    );
    transition: left 0.5s ease;
  }

  .achievement-card:hover::before {
    left: 100%;
  }

  .achievement-card.locked {
    opacity: 0.5;
    filter: grayscale(0.8);
  }

  .achievement-card.unlocked {
    border-color: var(--accent-primary, #9ecaff);
    box-shadow: 0 4px 20px rgba(158, 202, 255, 0.2);
  }

  .achievement-card.unlocked:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 30px rgba(158, 202, 255, 0.3);
  }

  .achievement-card.common.unlocked {
    border-color: rgba(255, 255, 255, 0.3);
  }

  .achievement-card.rare.unlocked {
    border-color: #4ECDC4;
    box-shadow: 0 4px 20px rgba(78, 205, 196, 0.3);
  }

  .achievement-card.rare.unlocked:hover {
    box-shadow: 0 8px 30px rgba(78, 205, 196, 0.4);
  }

  .achievement-card.epic.unlocked {
    border-color: #FF9F66;
    box-shadow: 0 4px 20px rgba(255, 159, 102, 0.3);
  }

  .achievement-card.epic.unlocked:hover {
    box-shadow: 0 8px 30px rgba(255, 159, 102, 0.4);
  }

  .achievement-icon {
    position: relative;
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
    background: var(--panel);
    border-radius: 50%;
    border: 3px solid var(--achievement-color);
    transition: all 0.3s ease;
  }

  .achievement-card.unlocked .achievement-icon {
    background: linear-gradient(135deg, var(--achievement-color), rgba(255, 255, 255, 0.2));
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  }

  .achievement-card.unlocked:hover .achievement-icon {
    transform: scale(1.1) rotate(5deg);
  }

  .icon-glow {
    position: absolute;
    inset: -10px;
    background: radial-gradient(circle, var(--achievement-color), transparent);
    opacity: 0.3;
    border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 0.3;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.1);
    }
  }

  .icon-emoji {
    font-size: 2.5rem;
    z-index: 1;
    position: relative;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  }

  .achievement-info {
    flex: 1;
    width: 100%;
  }

  .achievement-title {
    font-size: 1.2rem;
    font-weight: 800;
    color: var(--text);
    margin: 0 0 0.5rem 0;
    letter-spacing: 0.02em;
  }

  .achievement-description {
    font-size: 0.9rem;
    color: var(--muted);
    margin: 0;
    line-height: 1.4;
  }

  .achievement-lock {
    position: absolute;
    top: 1rem;
    right: 1rem;
    font-size: 1.2rem;
    opacity: 0.5;
  }

  .achievement-badge {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-weight: 900;
    font-size: 1.2rem;
  }

  .unlocked-badge {
    background: var(--accent-primary, #9ecaff);
    color: white;
    box-shadow: 0 2px 8px rgba(158, 202, 255, 0.4);
  }

  @media (max-width: 768px) {
    .achievements-container {
      padding: 1rem;
    }

    .achievements-title {
      font-size: 1.5rem;
    }

    .achievements-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .achievement-card {
      padding: 1rem;
    }

    .achievement-icon {
      width: 60px;
      height: 60px;
    }

    .icon-emoji {
      font-size: 2rem;
    }
  }
</style>

