<script>
  import { onMount } from 'svelte';
  
  onMount(() => {
    // Убеждаемся что страница прокручивается вверх
    window.scrollTo(0, 0);
  });
</script>

<div class="legal-page">
  <div class="legal-container">
    <h1 class="legal-title">ИНФОРМАЦИЯ ДЛЯ ПРАВООБЛАДАТЕЛЕЙ И ПОЛЬЗОВАТЕЛЕЙ</h1>
    
    <div class="legal-content">
      <section class="legal-section">
        <h2 class="legal-section-title">1. Об использовании контента</h2>
        <p class="legal-text">
          Все изображения и фрагменты произведений, используемые в квизах на данном сайте, принадлежат их законным владельцам. Контент используется исключительно в ознакомительных и развлекательных целях для визуализации вопросов викторины. Мы не занимаемся распространением видеофайлов или копированием произведений в коммерческих целях.
        </p>
      </section>
      
      <section class="legal-section">
        <h2 class="legal-section-title">2. Конфиденциальность</h2>
        <p class="legal-text">
          Для использования сайта не требуется ввод личных данных (ФИО, почта, телефон). Ваш никнейм используется только как технический идентификатор для сохранения прогресса. Мы рекомендуем не использовать свои настоящие имена в качестве игровых логинов.
        </p>
      </section>
      
      <section class="legal-section">
        <h2 class="legal-section-title">3. Обратная связь</h2>
        <p class="legal-text">
          Мы уважаем авторское право. Если вы обнаружили на сайте свой контент и хотите, чтобы он был удален, пожалуйста, напишите нам на почту: <a href="mailto:copyright@otakuz.fun" class="legal-email">copyright@otakuz.fun</a>. Мы обработаем запрос и удалим материалы в течение 48 часов.
        </p>
      </section>
    </div>
    
    <div class="legal-footer">
      <a href="/" class="legal-back-link" on:click|preventDefault={(e) => { e.preventDefault(); if (typeof window !== 'undefined') { window.location.href = '/'; } }}>← Вернуться на главную</a>
    </div>
  </div>
  
  <!-- Футер -->
  <footer class="site-footer">
    <div class="footer-content">
      <div class="footer-section">
        <div class="footer-links">
          <a href="/legal" class="footer-link" on:click|preventDefault={(e) => { e.preventDefault(); if (typeof window !== 'undefined') { window.location.href = '/legal'; } }}>Правовая информация</a>
          <span class="footer-separator">•</span>
          <a href="mailto:copyright@otakuz.fun" class="footer-link">Контакты</a>
        </div>
        <div class="footer-copyright">
          © {new Date().getFullYear()} OTAKUZ.FUN. Все права защищены.
        </div>
        <div class="footer-copyright-notice">
          В случаях нарушения авторских прав - обращайтесь на почту: <a href="mailto:copyright@otakuz.fun" class="footer-email">copyright@otakuz.fun</a>
        </div>
      </div>
    </div>
  </footer>
</div>

<style>
  .legal-page {
    width: 100%;
    min-height: 100vh;
    padding: 2rem 1rem;
    display: flex;
    justify-content: center;
    align-items: flex-start;
  }
  
  .legal-container {
    max-width: 800px;
    width: 100%;
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 1.5rem;
    padding: 2.5rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
  
  .legal-title {
    font-size: 1.75rem;
    font-weight: 800;
    color: var(--text-primary, #f5f6ff);
    margin-bottom: 2rem;
    text-align: center;
    letter-spacing: 0.02em;
  }
  
  .legal-content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  
  .legal-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .legal-section-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--accent-primary, #9ecaff);
    margin: 0;
  }
  
  .legal-text {
    font-size: 1rem;
    line-height: 1.7;
    color: var(--text-primary, #f5f6ff);
    margin: 0;
    opacity: 0.9;
  }
  
  .legal-email {
    color: var(--accent-primary, #9ecaff);
    text-decoration: none;
    transition: color 0.2s ease;
    font-weight: 600;
  }
  
  .legal-email:hover {
    color: var(--accent-primary-strong, #b3d6ff);
    text-decoration: underline;
  }
  
  .legal-footer {
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
  }
  
  .legal-back-link {
    color: var(--accent-primary, #9ecaff);
    text-decoration: none;
    font-weight: 600;
    transition: color 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .legal-back-link:hover {
    color: var(--accent-primary-strong, #b3d6ff);
  }
  
  @media (max-width: 768px) {
    .legal-page {
      padding: 1rem 0.75rem;
    }
    
    .legal-container {
      padding: 1.5rem;
      border-radius: 1rem;
    }
    
    .legal-title {
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
    }
    
    .legal-section-title {
      font-size: 1.125rem;
    }
    
  .legal-text {
    font-size: 0.9375rem;
  }
  
  /* Футер */
  .site-footer {
    width: 100%;
    max-width: 1360px;
    margin: 3rem auto 0;
    padding: 1.5rem 2rem;
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 1rem;
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
  
  .footer-copyright-notice {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.8rem;
    margin-top: 0.5rem;
  }
  
  .footer-email {
    color: var(--accent-primary, #9ecaff);
    text-decoration: none;
    transition: color 0.2s ease;
  }
  
  .footer-email:hover {
    color: var(--accent-primary-strong, #b3d6ff);
    text-decoration: underline;
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
    
    .footer-copyright-notice {
      font-size: 0.75rem;
      text-align: center;
      padding: 0 0.5rem;
    }
  }
}
</style>

