<script>
  import Router from 'svelte-spa-router';
  import HomeRoute from './routes/HomeRoute.svelte';
  import ProfileRoute from './routes/ProfileRoute.svelte';
  import FriendsRoute from './routes/FriendsRoute.svelte';
  import UserRoute from './routes/UserRoute.svelte';
  import TournamentsRoute from './routes/TournamentsRoute.svelte';

  let showTop = false;
  let scrollEl;

  const routes = {
    '/': HomeRoute,
    '/profile': ProfileRoute,
    '/profile/*': ProfileRoute,
    '/friends': FriendsRoute,
    '/friends/*': FriendsRoute,
    '/tournaments': TournamentsRoute,
    '/tournaments/*': TournamentsRoute,
    '/user/:nickname': UserRoute,
    '/user/:nickname/*': UserRoute,
    // fallback
    '*': HomeRoute
  };
</script>

<div class="app-container">
  <!-- Верхняя бегущая строка -->
  <div class="marquee-top">
    <div class="marquee-content">
      <span>work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • </span>
      <span>work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • </span>
    </div>
  </div>
  
  <!-- Основная область -->
  <div class="main-layout">
    <!-- Content область -->
    <div class="content-container">
      <div class="content-scroll" bind:this={scrollEl}>
        <Router {routes} useHash={false} />
      </div>
    </div>
  </div>
  
  <!-- Нижняя бегущая строка -->
  <div class="marquee-bottom">
    <div class="marquee-content">
      <span>work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • </span>
      <span>work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • work in progress • </span>
    </div>
  </div>
  
  <!-- Футер -->
  <footer class="site-footer">
    <div class="footer-content">
      <div class="footer-section">
        <div class="footer-links">
          <a href="#" class="footer-link">Условия использования</a>
          <span class="footer-separator">•</span>
          <a href="#" class="footer-link">Политика конфиденциальности</a>
          <span class="footer-separator">•</span>
          <a href="#" class="footer-link">Правообладателям</a>
        </div>
        <div class="footer-copyright">
          © {new Date().getFullYear()} OTAKUZ.FUN. Все права защищены.
        </div>
      </div>
    </div>
  </footer>
</div>

<style>
  .app-container {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
    /* Safe area insets для iOS */
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
    /* Фон для safe area - используем тот же, что и у приложения */
    background: linear-gradient(180deg, rgba(4, 7, 15, 0.7), rgba(21, 6, 28, 0.85)), url('/backgrounds/backsak.jpg');
    background-size: cover;
    background-attachment: fixed;
    background-repeat: no-repeat;
    background-position: center;
  }
  
  .main-layout {
    display: flex;
    width: 100%;
    flex: 1;
    overflow: hidden;
  }
  
  .content-container {
    flex: 1;
    height: 100%;
    position: relative;
    overflow: auto;
    overflow-x: hidden;
  }
  
  .content-scroll {
    width: 100%;
    height: auto;
    min-height: 100%;
    padding: 20px;
    box-sizing: border-box;
  }
  
  @media (max-width: 768px) {
    .content-scroll {
      padding: 12px;
    }
    
    .app-container {
      /* Дополнительный отступ сверху на мобильных для safe area */
      padding-top: calc(env(safe-area-inset-top) + 0.5rem);
    }
  }
  
  .scroll-top-btn {
    position: fixed;
    right: 24px;
    bottom: 24px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--accent-primary, #9ecaff);
    color: white;
    font-size: 24px;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: all 0.2s;
    z-index: 50;
  }
  
  .scroll-top-btn:hover {
    background: var(--accent-primary-strong, #b3d6ff);
    transform: translateY(-2px);
  }
  
  /* Бегущие строки */
  .marquee-top,
  .marquee-bottom {
    width: 100%;
    height: 24px;
    background: rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    color: #f5f6ff;
    overflow: hidden;
    position: relative;
    flex-shrink: 0;
    z-index: 200;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .marquee-top {
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .marquee-bottom {
    border-top: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .marquee-content {
    display: flex;
    white-space: nowrap;
    animation: marquee 30s linear infinite;
  }
  
  .marquee-content span {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 2px;
    padding: 0 20px;
    line-height: 24px;
  }
  
  @keyframes marquee {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(-50%);
    }
  }
  
  /* Футер */
  .site-footer {
    width: 100%;
    padding: 1.5rem 2rem;
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    flex-shrink: 0;
    z-index: 100;
  }
  
  .footer-content {
    max-width: 1360px;
    margin: 0 auto;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .footer-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    text-align: center;
  }
  
  .footer-links {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .footer-link {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
    text-decoration: none;
    transition: color 0.2s ease;
  }
  
  .footer-link:hover {
    color: var(--accent-primary, #9ecaff);
  }
  
  .footer-separator {
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.875rem;
  }
  
  .footer-copyright {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.8rem;
  }
  
  @media (max-width: 768px) {
    .site-footer {
      padding: 1rem 1rem;
    }
    
    .footer-links {
      gap: 0.5rem;
      font-size: 0.8rem;
    }
    
    .footer-link {
      font-size: 0.8rem;
    }
    
    .footer-copyright {
      font-size: 0.75rem;
    }
  }
</style>