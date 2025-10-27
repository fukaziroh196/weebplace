<script>
  import { goToGuessAnime, goHome } from '../stores/ui';
  import { clickOutside } from '../lib/clickOutside';

  function close() { goHome(); }

  function onKey(e) { if (e.key === 'Escape') close(); }
</script>

<svelte:window on:keydown={onKey} />

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
  <div class="w-[720px] max-w-[95vw] bg-[#1e1e28] rounded-2xl p-6 shadow-2xl border border-white/10 glass-frame" use:clickOutside={{ enabled: true, callback: close }}>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-white">AniQuiz</h1>
      <button class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center" on:click={close}>✕</button>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <button class="bg-purple-900/70 backdrop-blur-md rounded-xl p-4 glass-frame text-left hover:bg-purple-900/80 transition" on:click={() => { goToGuessAnime(); }}>
        <div class="text-white text-xl font-semibold mb-1">Угадай аниме</div>
        <div class="text-white/70 text-sm">Выбирайте картинку и угадывайте название аниме</div>
      </button>
      <div class="bg-white/5 rounded-xl p-4 text-white/50 border border-white/10">
        Скоро новые игры…
      </div>
    </div>
  </div>
  
</div>

<style>
  .glass-frame { box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); }
  .backdrop-blur-md { backdrop-filter: blur(12px); }
</style>


