<script>
  import { onMount } from 'svelte';
  import { currentUser } from '../stores/authApi';
  import { fetchSuggestions, suggestions, enabledSourceIds, adminImages } from '../stores/sources';
  import { clickOutside } from '../lib/clickOutside';
  import { animeGuesses as apiGuesses, getBatchSampleZipUrl } from '../lib/api';
  import { quizDate, availableQuizDates, refreshQuizDates, setQuizDate } from '../stores/quizzes';
  
  // Данные об угадываемых аниме
  let animeGuesses = [];
  let loading = false;
  let selectedFile = null;
  let selectedZip = null;
  let validateInfo = null;
  // date is managed globally in AniQuiz
  let adminUploadDate = '';
  let packSlots = Array.from({ length: 4 }, () => ({ file: null, title: '', uploading: false }));

  function todayStr() {
    const x = new Date();
    return `${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,'0')}-${String(x.getUTCDate()).padStart(2,'0')}`;
  }
  function setDateToday() { adminUploadDate = todayStr(); }
  function setDateFromAniQuiz() { let d; quizDate.subscribe(v=>d=v)(); adminUploadDate = d || todayStr(); }
  function generateManualAnimeId(title) {
    const slug = String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
    return `manual-${slug}-${Date.now().toString(36)}`;
  }
  function onSlotFile(i, e) {
    const f = e.target.files[0];
    if (f && f.type.startsWith('image/')) { packSlots[i].file = f; packSlots = [...packSlots]; }
  }
  function onSlotTitle(i, e) { packSlots[i].title = e.currentTarget.value; packSlots = [...packSlots]; }
  $: canSubmitPack = (packSlots || []).every(s => !!s.file && !!s.title?.trim()) && !!adminUploadDate;
  async function submitPack() {
    if (!adminUploadDate) { alert('Выберите дату сета'); return; }
    if (!canSubmitPack) { alert('Заполните все 4 изображения и ответы'); return; }
    try {
      for (let i = 0; i < packSlots.length; i++) {
        const s = packSlots[i];
        s.uploading = true; packSlots = [...packSlots];
        const manualId = generateManualAnimeId(s.title);
        await apiGuesses.upload(s.file, s.title.trim(), manualId, 'manual', adminUploadDate);
        s.uploading = false; packSlots = [...packSlots];
      }
      // очистить и обновить список
      packSlots = Array.from({ length: 4 }, () => ({ file: null, title: '', uploading: false }));
      setQuizDate(adminUploadDate);
      await fetchAllGuesses(adminUploadDate);
      alert('Пак загружен на дату ' + adminUploadDate);
    } catch (e) {
      alert('Ошибка загрузки пака: ' + (e?.message || ''));
    }
  }
  function clearPack() { packSlots = Array.from({ length: 4 }, () => ({ file: null, title: '', uploading: false })); }
  
  // Для админа
  let adminSearchQuery = '';
  let adminSuggestions = [];
  let showAdminSuggestions = false;
  let selectedAnime = null;
  
  // Для пользователей
  let userAnswer = '';
  let userSuggestions = [];
  let showUserSuggestions = false;
  
  let currentImageIndex = 0;
  let showAnswer = false;
  
  // Загрузка данных из API
  async function fetchAllGuesses(dateOverride) {
    loading = true;
    try {
      let d;
      if (dateOverride) { d = dateOverride; } else { quizDate.subscribe((v)=> (d = v))(); }
      const list = await apiGuesses.getAll(d);
      animeGuesses = Array.isArray(list) ? list : [];
    } catch (e) {
      console.error('Не удалось загрузить список:', e);
      animeGuesses = [];
    } finally {
      loading = false;
    }
  }

  // Автоперезагрузка при смене выбранной даты сета
  let lastLoadedDate = '';
  $: (async () => {
    try {
      let d; quizDate.subscribe(v=>d=v)();
      if (d && d !== lastLoadedDate) {
        lastLoadedDate = d;
        await fetchAllGuesses(d);
      }
    } catch (_) {}
  })();
  
  // Проверка, является ли пользователь админом
  $: isAdmin = $currentUser?.isAdmin || false;
  
  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      selectedFile = file;
    }
  }

  function handleZipSelect(event) {
    const file = event.target.files[0];
    if (file && /\.zip$/i.test(file.name)) {
      selectedZip = file;
    }
  }
  
  // Автокомплит для админа
  let adminSuggestTimer;
  async function onAdminSearchInput(e) {
    adminSearchQuery = e.currentTarget.value;
    clearTimeout(adminSuggestTimer);
    if (!adminSearchQuery.trim()) {
      adminSuggestions = [];
      showAdminSuggestions = false;
      return;
    }
    adminSuggestTimer = setTimeout(async () => {
      try {
        const ids = await Promise.resolve().then(() => {
          let current;
          const unsub = enabledSourceIds.subscribe((v) => (current = v));
          unsub();
          return current;
        });
        const results = await sourceRegistry.search(adminSearchQuery.trim(), ids, { limit: 5 });
        let custom; adminImages.subscribe((v) => (custom = v))();
        adminSuggestions = results.map((it) => (custom && custom[it.id] ? { ...it, image: custom[it.id] } : it));
        showAdminSuggestions = true;
      } catch (e) {
        console.error('Suggest error', e);
        adminSuggestions = [];
      }
    }, 300);
  }
  
  function selectAnime(anime) {
    selectedAnime = anime;
    adminSearchQuery = anime.title;
    adminSuggestions = [];
    showAdminSuggestions = false;
  }
  
  async function uploadImage() {
    if (!selectedFile || !selectedAnime) {
      alert('Выберите картинку и аниме из списка');
      return;
    }
    try {
      let d; quizDate.subscribe((v)=> (d = v))();
      const created = await apiGuesses.upload(selectedFile, selectedAnime.title, selectedAnime.id, selectedAnime.__sourceId, d);
      const normalized = created && !created.image && created.imageUrl ? { ...created, image: created.imageUrl } : created;
      animeGuesses = [...animeGuesses, normalized];
      selectedFile = null;
      selectedAnime = null;
      adminSearchQuery = '';
      const el = document.getElementById('fileInput'); if (el) el.value = '';
      alert('Картинка загружена!');
    } catch (e) {
      alert('Ошибка загрузки: ' + (e?.message || '')); 
    }
  }

  async function uploadBatchZip() {
    if (!selectedZip) { alert('Выберите ZIP-архив'); return; }
    try {
      let d; quizDate.subscribe((v)=> (d = v))();
      const result = await apiGuesses.uploadBatch(selectedZip, d);
      if (result && Array.isArray(result.items)) {
        animeGuesses = [...animeGuesses, ...result.items.map(it => ({ ...it, image: it.image }))];
      }
      selectedZip = null; const el = document.getElementById('zipInput'); if (el) el.value = '';
      alert('Загружено: ' + (result?.created || 0));
    } catch (e) {
      alert('Ошибка пакетной загрузки: ' + (e?.message || ''));
    }
  }

  async function validateZip() {
    if (!selectedZip) { alert('Выберите ZIP-архив'); return; }
    try {
      validateInfo = await apiGuesses.validateBatch(selectedZip);
    } catch (e) {
      alert('Ошибка проверки: ' + (e?.message || ''));
    }
  }

  function downloadManifestTemplate() {
    let d; quizDate.subscribe((v)=> (d = v))();
    const today = d || (() => { const x=new Date(); return `${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,'0')}-${String(x.getUTCDate()).padStart(2,'0')}`; })();
    const lines = [
      'filename,title,animeId,sourceId,quizDate',
      '01.jpg,Fullmetal Alchemist,12345,shikimori,' + today,
      '02.png,Naruto,20,anilist,' + today
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'manifest.csv';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }
  
  async function deleteGuess(id) {
    if (!confirm('Удалить эту картинку?')) return;
    try {
      await apiGuesses.delete(id);
      animeGuesses = animeGuesses.filter(g => g.id !== id);
    } catch (e) {
      alert('Не удалось удалить: ' + (e?.message || ''));
    }
  }
  
  // Автокомплит для пользователей
  let userSuggestTimer;
  async function onUserAnswerInput(e) {
    userAnswer = e.currentTarget.value;
    clearTimeout(userSuggestTimer);
    if (!userAnswer.trim()) {
      userSuggestions = [];
      showUserSuggestions = false;
      return;
    }
    userSuggestTimer = setTimeout(async () => {
      try {
        const ids = await Promise.resolve().then(() => {
          let current;
          const unsub = enabledSourceIds.subscribe((v) => (current = v));
          unsub();
          return current;
        });
        const results = await sourceRegistry.search(userAnswer.trim(), ids, { limit: 5 });
        let custom; adminImages.subscribe((v) => (custom = v))();
        userSuggestions = results.map((it) => (custom && custom[it.id] ? { ...it, image: custom[it.id] } : it));
        showUserSuggestions = true;
      } catch (e) {
        console.error('Suggest error', e);
        userSuggestions = [];
      }
    }, 300);
  }
  
  function selectUserAnswer(anime) {
    userAnswer = anime.title;
    userSuggestions = [];
    showUserSuggestions = false;
  }
  
  async function checkAnswer() {
    const guessId = animeGuesses[currentImageIndex]?.id;
    if (!guessId || !userAnswer.trim()) return;
    try {
      const res = await apiGuesses.checkAnswer(guessId, userAnswer.trim());
      if (res?.correct) {
        const userId = $currentUser?.id;
        const guess = animeGuesses.find(g => g.id === guessId);
        if (guess && userId && Array.isArray(guess.guessedBy) && !guess.guessedBy.includes(userId)) {
          guess.guessedBy.push(userId);
        }
        alert('Правильно! 🎉');
        userAnswer = '';
      } else {
        alert('Неправильно! Попробуйте еще раз.');
      }
    } catch (e) {
      alert('Ошибка проверки: ' + (e?.message || ''));
    }
  }
  
  function showHint(guess) {
    showAnswer = guess.id;
    setTimeout(() => {
      showAnswer = null;
    }, 3000);
  }
  
  
  // Import sourceRegistry
  import { sourceRegistry } from '../sources';
  
  onMount(async () => {
    await refreshQuizDates();
    await fetchAllGuesses();
    // init admin date from AniQuiz on first mount
    let d; quizDate.subscribe(v=>d=v)();
    adminUploadDate = d || todayStr();
  });
</script>

<div class="flex flex-col w-full">
  <h1 class="text-3xl font-bold text-white mb-6">🎌 Угадай аниме</h1>
  
  {#if isAdmin}
    <!-- Пак 4 картинки: отдельные поля и ответы -->
    <div class="bg-purple-900/70 backdrop-blur-md rounded-xl p-6 mb-6 glass-frame">
      <h2 class="text-2xl font-bold text-white mb-4">📤 Загрузка сета (4 картинки)</h2>
      <div class="flex items-end gap-3 mb-4 flex-wrap">
        <div>
          <label class="block text-white/90 mb-2">Дата сета (YYYY-MM-DD)</label>
          <input type="date" bind:value={adminUploadDate} class="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20" />
        </div>
        <div class="pb-1 flex gap-2">
          <button class="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg border border-white/20" on:click={setDateFromAniQuiz}>Из AniQuiz</button>
          <button class="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg border border-white/20" on:click={setDateToday}>Сегодня</button>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {#each packSlots as slot, i}
          <div class="bg-white/5 rounded-lg p-4">
            <div class="aspect-[3/2] bg-black/30 rounded-lg mb-3 flex items-center justify-center overflow-hidden border border-white/20">
              {#if slot.file}
                <img src={URL.createObjectURL(slot.file)} alt="preview" class="w-full h-full object-cover" />
              {:else}
                <span class="text-white/60">Выберите файл</span>
              {/if}
            </div>
            <input type="file" accept="image/*" class="text-white mb-3" on:change={(e)=>onSlotFile(i,e)} />
            <input type="text" class="w-full px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20 mb-3" placeholder="Ответ (название аниме)" value={slot.title} on:input={(e)=>onSlotTitle(i,e)} />
            {#if slot.uploading}
              <div class="text-white/70 text-sm">Загрузка…</div>
            {/if}
          </div>
        {/each}
      </div>
      <div class="flex items-center gap-3 mt-4">
        <button class="bg-pink-700 hover:bg-pink-600 text-white px-5 py-3 rounded-lg font-semibold disabled:opacity-50" disabled={!canSubmitPack} on:click={submitPack}>Отправить пак</button>
        <button class="bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-lg font-semibold border border-white/20" on:click={clearPack}>Очистить</button>
        <div class="text-white/70 text-sm">Пак будет сохранён на дату {adminUploadDate}. Если дата не сегодня — он попадёт в "предыдущие дни".</div>
      </div>
    </div>

    <!-- Пакетная загрузка ZIP + manifest.csv -->
    <div class="bg-purple-900/70 backdrop-blur-md rounded-xl p-6 mb-6 glass-frame">
      <h2 class="text-2xl font-bold text-white mb-4">📦 Пакетная загрузка (ZIP)</h2>
      <p class="text-white/80 mb-3 text-sm">В архиве должен быть файл <b>manifest.csv</b> с колонками: <code>filename,title,animeId,sourceId,quizDate</code>. Картинки указывать именами из архива.</p>
      <div class="mb-3 flex gap-2 items-center flex-wrap">
        <button on:click={downloadManifestTemplate} class="btn-kristal-ghost px-3 py-2 rounded-lg text-sm">Скачать пример manifest.csv</button>
        <a class="btn-kristal-ghost px-3 py-2 rounded-lg text-sm" href={getBatchSampleZipUrl($quizDate)} target="_blank" rel="noopener">Скачать пример ZIP</a>
      </div>
      <div class="flex items-end gap-4">
        <div>
          <label class="block text-white/90 mb-2">Выберите ZIP-архив:</label>
          <input type="file" id="zipInput" accept=".zip" class="text-white" on:change={handleZipSelect} />
          {#if selectedZip}
            <div class="mt-2 text-green-400">✓ {selectedZip.name}</div>
          {/if}
        </div>
        <div class="pb-1 flex gap-2">
          <button on:click={validateZip} class="bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-lg font-semibold transition border border-white/20">Проверить ZIP</button>
          <button on:click={uploadBatchZip} class="bg-pink-700 hover:bg-pink-600 text-white px-6 py-3 rounded-lg font-semibold transition">Загрузить ZIP</button>
        </div>
      </div>
      {#if validateInfo}
        <div class="mt-4 text-white/90 text-sm">
          <div>Всего строк: <b>{validateInfo.total}</b>. Готово к загрузке: <b>{validateInfo.ok}</b>. Отсутствуют файлы: <b>{validateInfo.missing?.length || 0}</b>.</div>
          {#if validateInfo.missing && validateInfo.missing.length}
            <div class="mt-2">Первые отсутствующие: {validateInfo.missing.slice(0,5).join(', ')}</div>
          {/if}
          {#if validateInfo.sample && validateInfo.sample.length}
            <div class="mt-2">Пример строк:</div>
            <div class="bg-white/5 rounded-lg p-2 mt-1">
              {#each validateInfo.sample as r}
                <div class="text-white/80 text-xs">{r.filename || r.file || r.image} — {r.title} — {r.animeId || r.anime_id}</div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
    
    <!-- Список всех загруженных картинок -->
    <div class="bg-purple-900/70 backdrop-blur-md rounded-xl p-6 glass-frame">
      <h2 class="text-2xl font-bold text-white mb-4">📋 Все картинки ({animeGuesses.length})</h2>
      
      {#if animeGuesses.length === 0}
        <div class="text-white/60">Нет загруженных картинок</div>
      {:else}
        <div class="grid grid-cols-2 gap-4">
          {#each animeGuesses as guess}
            <div class="bg-white/5 rounded-lg p-4">
              <img src={guess.image} alt={guess.title} class="w-full rounded-lg mb-2" />
              <div class="text-white text-sm font-semibold">{guess.title}</div>
              <div class="text-white/60 text-xs">Дата: {guess.quizDate || '-'} · Отгадано: {guess.guessedBy.length}</div>
              <button 
                on:click={() => deleteGuess(guess.id)}
                class="mt-2 bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
              >
                Удалить
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <!-- Интерфейс для обычных пользователей -->
    {#if animeGuesses.length === 0}
      <div class="bg-purple-900/70 backdrop-blur-md rounded-xl p-6 glass-frame text-center">
        <div class="text-white/80 text-lg">Пока нет картинок для угадывания 😔</div>
      </div>
    {:else}
      <div class="bg-purple-900/70 backdrop-blur-md rounded-xl p-6 glass-frame">
        <h2 class="text-2xl font-bold text-white mb-4">Отгадайте, из какого это аниме?</h2>
        <!-- Дата выбранного сета управляется на экране AniQuiz -->
        
        <!-- Выбор картинки для отгадывания -->
        <div class="mb-4">
          <label class="block text-white/90 mb-2">Выберите картинку:</label>
          <div class="grid grid-cols-4 gap-2">
            {#each animeGuesses as guess, idx}
              <button
                on:click={() => { currentImageIndex = idx; userAnswer = ''; }}
                class="relative aspect-[3/4] rounded-lg overflow-hidden bg-white/5 border-2 transition {idx === currentImageIndex ? 'border-pink-500' : 'border-white/20'}"
              >
                <img 
                  src={guess.image} 
                  alt={guess.title}
                  class="w-full h-full object-cover rounded-lg"
                />
                <div class="absolute top-2 left-2 bg-black/60 text-white px-2 py-0.5 rounded text-xs">
                  {idx + 1}
                </div>
              </button>
            {/each}
          </div>
        </div>
        
        <div class="relative mb-4" use:clickOutside={{ enabled: showUserSuggestions, callback: () => showUserSuggestions = false }}>
          <input 
            type="text" 
            id="userGuess"
            bind:value={userAnswer}
            placeholder="Введите название аниме для картинки #{currentImageIndex + 1}..."
            class="w-full px-4 py-3 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:border-pink-500"
            on:input={onUserAnswerInput}
            on:keydown={(e) => { 
              if (e.key === 'Enter') {
                e.preventDefault();
                checkAnswer();
              }
              if (e.key === 'Escape') showUserSuggestions = false;
            }}
            autocomplete="off"
          />
          
          {#if showUserSuggestions && userSuggestions.length > 0}
            <div class="absolute left-0 right-0 mt-2 rounded-xl overflow-hidden z-20 menu-surface" style="max-height: 300px; overflow-y: auto;">
              {#each userSuggestions as s}
                <div class="px-3 py-2 cursor-pointer flex items-center gap-2 menu-item hover:bg-white/10"
                     on:click={() => selectUserAnswer(s)}>
                  {#if s.image}
                    <img src={s.image} alt="" class="w-10 h-10 rounded object-cover" />
                  {/if}
                  <div class="flex-1">
                    <div class="text-white truncate">{s.title}</div>
                    {#if s.russian && s.russian !== s.title}
                      <div class="text-white/60 text-xs truncate">{s.russian}</div>
                    {/if}
                  </div>
                  {#if s.score}
                    <span class="ml-auto text-sm text-white/90">★ {s.score}</span>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
        
        <div class="flex gap-2">
          <button 
            on:click={checkAnswer}
            class="flex-1 bg-pink-700 hover:bg-pink-600 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            Проверить ответ
          </button>
          {#if animeGuesses[currentImageIndex]}
          <button 
            on:click={() => showHint(animeGuesses[currentImageIndex])}
            class="bg-yellow-600 hover:bg-yellow-500 text-black px-6 py-3 rounded-lg font-semibold transition"
          >
            Подсказка для #{currentImageIndex + 1}
          </button>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .glass-frame {
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  }
  
  .menu-surface {
    background: rgba(30, 30, 40, 0.98);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .menu-item {
    transition: background 0.2s;
  }
  
  .menu-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }
</style>
