<section class="tournaments">
  <div class="header">
    <h1>Турниры</h1>
    <p>Скоро здесь появятся расписание, сетки и результаты.</p>
  </div>
  <div class="card">
    <div class="title">Заглушка</div>
    <div class="text">Раздел в разработке. Можно перейти сюда по /tournaments.</div>
  </div>
</section>

<style>
  .tournaments {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    color: var(--text-primary, #f5f6ff);
  }
  .header h1 {
    margin: 0;
    font-size: 1.6rem;
    font-weight: 900;
  }
  .header p {
    margin: 0.25rem 0 0;
    color: var(--text-secondary, rgba(255,255,255,0.7));
  }
  .card {
    background: var(--surface-primary, rgba(255,255,255,0.08));
    border: 1px solid var(--divider-color, rgba(255,255,255,0.18));
    border-radius: 1.1rem;
    padding: 1rem;
    backdrop-filter: blur(18px);
  }
  .title { font-weight: 800; margin-bottom: 0.25rem; }
  .text { color: var(--text-secondary, rgba(255,255,255,0.7)); }
</style>

