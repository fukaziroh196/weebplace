<script>
  import { goToAniQuiz } from '../stores/ui';
</script>

<div class="flex flex-col w-full gap-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold text-white">Угадай персонажа</h1>
    <button class="px-3 py-1.5 rounded bg-white/10 text-white hover:bg-white/20" on:click={goToAniQuiz}>← К квизам</button>
  </div>
  <div class="bg-purple-900/60 rounded-xl p-6 glass-frame">
    <div class="text-white/80">Скоро здесь будет режим, где нужно угадать персонажа по обрезанному кадру/аватару.</div>
  </div>
</div>

<style>
  .glass-frame { box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); border: 1px solid rgba(255,255,255,0.12); }
</style>


