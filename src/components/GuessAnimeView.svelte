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
  let packUploading = false;
  let packUploadError = '';
  $: canSubmitPack = (packSlots || []).every(s => !!s.file && !!s.title?.trim()) && !!adminUploadDate && !packUploading;
  
  async function submitPack() {
    packUploadError = '';
    
    if (!adminUploadDate) { 
      packUploadError = 'Выберите дату сета';
      return; 
    }
    if (!canSubmitPack) { 
      packUploadError = 'Заполните все 4 изображения и ответы';
      return; 
    }
    
    try {
      packUploading = true;
      console.log(`[submitPack] Starting upload for ${adminUploadDate}`);
      
      const slots = packSlots.map((s) => ({ file: s.file, title: s.title.trim() }));
      const result = await apiGuesses.uploadPack(slots, adminUploadDate);
      
      console.log('[submitPack] Upload success:', result);
      
      // очистить форму
      packSlots = Array.from({ length: 4 }, () => ({ file: null, title: '', uploading: false }));
      
      // переключить на загруженную дату и обновить список
      await setQuizDate(adminUploadDate);
      await refreshQuizDates();
      await fetchAllGuesses(adminUploadDate);
      
      alert(`✓ Пак успешно загружен на дату ${adminUploadDate}!\n${result.created || 4} изображений добавлено.`);
    } catch (e) {
      console.error('[submitPack] Error:', e);
      packUploadError = `Ошибка загрузки: ${e?.message || 'Network error'}`;
      alert(packUploadError);
    } finally {
      packUploading = false;
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
  
  // Система подсказок (как на aniguessr)
  let unlockedClues = []; // массив разблокированных подсказок для текущей картинки
  let showTitle = false;
  
  // Система очков
  let totalScore = 0;
  let roundScores = []; // очки за каждый раунд
  
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
  
  function calculateScore() {
    // Без подсказок: 10000
    // 1 подсказка: 8000
    // 2 подсказки: 5000
    // 3 подсказки: 2500
    const cluesUsed = unlockedClues.length + (showTitle ? 1 : 0);
    if (cluesUsed === 0) return 10000;
    if (cluesUsed === 1) return 8000;
    if (cluesUsed === 2) return 5000;
    return 2500;
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
        
        // Начисляем очки
        const score = calculateScore();
        totalScore += score;
        roundScores[currentImageIndex] = score;
        roundScores = [...roundScores]; // trigger reactivity
        
        // Показываем уведомление с очками
        setTimeout(() => {
          alert(`✅ Правильно! +${score} очков\n\nВсего очков: ${totalScore}`);
        }, 100);
        
        // Переход к следующей картинке
        if (currentImageIndex < animeGuesses.length - 1) {
          setTimeout(() => {
            currentImageIndex++;
            userAnswer = '';
            unlockedClues = [];
            showTitle = false;
          }, 1200);
        } else {
          setTimeout(() => {
            alert(`🎉 Поздравляем! Вы отгадали все картинки!\n\n🏆 Итоговый счёт: ${totalScore} очков`);
            userAnswer = '';
          }, 1200);
        }
      } else {
        // Неправильный ответ - просто ничего не делаем, 0 очков
        // Пользователь может попробовать ещё раз
      }
    } catch (e) {
      alert('Ошибка проверки: ' + (e?.message || ''));
    }
  }
  
  function unlockClue(clueIndex) {
    if (!unlockedClues.includes(clueIndex)) {
      unlockedClues = [...unlockedClues, clueIndex];
    }
  }
  
  function unlockTitleClue() {
    showTitle = true;
  }
  
  // Генерация подсказок на основе названия аниме
  function getFirstClue(title) {
    if (!title) return '';
    const words = title.split(/\s+/);
    return words[0] || '';
  }
  
  function getSecondClue(title) {
    if (!title) return '';
    const len = title.length;
    return title.substring(0, Math.ceil(len / 2));
  }
  
  function getTitleClue(title) {
    if (!title) return '';
    // Маскируем каждую вторую букву
    return title.split('').map((c, i) => i % 2 === 1 ? '_' : c).join('');
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
  {#if isAdmin}
    <h1 class="text-3xl font-bold text-white mb-6">🎌 Угадай аниме</h1>
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
      <div class="flex flex-col gap-3 mt-4">
        <div class="flex items-center gap-3">
          <button 
            class="bg-pink-700 hover:bg-pink-600 text-white px-5 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition" 
            disabled={!canSubmitPack} 
            on:click={submitPack}
          >
            {packUploading ? '⏳ Загрузка...' : 'Отправить пак'}
          </button>
          <button 
            class="bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-lg font-semibold border border-white/20 disabled:opacity-50" 
            disabled={packUploading}
            on:click={clearPack}
          >
            Очистить
          </button>
        </div>
        {#if packUploadError}
          <div class="bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-3 text-red-200">
            ❌ {packUploadError}
          </div>
        {:else}
          <div class="text-white/70 text-sm">
            Пак будет сохранён на дату <b class="text-pink-400">{adminUploadDate}</b>. 
            {#if adminUploadDate !== todayStr()}
              Это прошедшая дата — пак попадёт в "предыдущие дни".
            {:else}
              Это сегодняшняя дата — пак будет активен сразу.
            {/if}
          </div>
        {/if}
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
      <div class="quiz-container text-center">
        <div class="text-white/80 text-lg">Пока нет картинок для угадывания 😔</div>
      </div>
    {:else}
      <div class="quiz-container">
        <!-- Заголовок с раундом -->
        <div class="quiz-header">
          <h1 class="quiz-title">УГАДАЙ АНИМЕ</h1>
          <div class="round-badge">
            <span class="round-text">Раунд {currentImageIndex + 1}</span>
            <span class="difficulty-badge">Легко</span>
          </div>
          {#if totalScore > 0}
            <div class="score-display">
              🏆 Очки: <span class="score-value">{totalScore.toLocaleString()}</span>
            </div>
          {/if}
        </div>
        
        <!-- Большая картинка по центру -->
        <div class="image-container">
          <img 
            src={animeGuesses[currentImageIndex].image} 
            alt="Угадай аниме"
            class="quiz-image"
          />
        </div>
        
        <!-- Кнопки разблокировки подсказок -->
        <div class="clues-container">
          <button 
            class="clue-btn {unlockedClues.includes(0) ? 'unlocked' : 'locked'}"
            on:click={() => unlockClue(0)}
            disabled={unlockedClues.includes(0)}
          >
            <span class="clue-icon">🔒</span>
            <span class="clue-text">
              {#if unlockedClues.includes(0)}
                {getFirstClue(animeGuesses[currentImageIndex].title)}
              {:else}
                ПЕРВАЯ ПОДСКАЗКА
              {/if}
            </span>
          </button>
          
          <button 
            class="clue-btn {unlockedClues.includes(1) ? 'unlocked' : 'locked'}"
            on:click={() => unlockClue(1)}
            disabled={unlockedClues.includes(1)}
          >
            <span class="clue-icon">🔒</span>
            <span class="clue-text">
              {#if unlockedClues.includes(1)}
                {getSecondClue(animeGuesses[currentImageIndex].title)}
              {:else}
                ВТОРАЯ ПОДСКАЗКА
              {/if}
            </span>
          </button>
          
          <button 
            class="clue-btn {showTitle ? 'unlocked' : 'locked'}"
            on:click={unlockTitleClue}
            disabled={showTitle}
          >
            <span class="clue-icon">🔒</span>
            <span class="clue-text">
              {#if showTitle}
                {getTitleClue(animeGuesses[currentImageIndex].title)}
              {:else}
                ПОДСКАЗКА НАЗВАНИЕ
              {/if}
            </span>
          </button>
        </div>
        
        <!-- Поле ввода ответа -->
        <div class="answer-container" use:clickOutside={{ enabled: showUserSuggestions, callback: () => showUserSuggestions = false }}>
          <input 
            type="text" 
            bind:value={userAnswer}
            placeholder="Введите название аниме"
            class="answer-input"
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
          
          <button 
            on:click={checkAnswer}
            class="guess-btn"
          >
            ОТВЕТИТЬ
          </button>
          
          {#if showUserSuggestions && userSuggestions.length > 0}
            <div class="suggestions-dropdown">
              {#each userSuggestions as s}
                <div class="suggestion-item" on:click={() => selectUserAnswer(s)}>
                  {#if s.image}
                    <img src={s.image} alt="" class="suggestion-image" />
                  {/if}
                  <div class="suggestion-content">
                    <div class="suggestion-title">{s.title}</div>
                    {#if s.russian && s.russian !== s.title}
                      <div class="suggestion-subtitle">{s.russian}</div>
                    {/if}
                  </div>
                  {#if s.score}
                    <span class="suggestion-score">★ {s.score}</span>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
        
        <!-- Прогресс -->
        <div class="progress-container">
          <div class="progress-dots">
            {#each animeGuesses as _, idx}
              <div class="progress-dot {idx < currentImageIndex ? 'completed' : idx === currentImageIndex ? 'active' : ''}"></div>
            {/each}
          </div>
          <div class="progress-text">{currentImageIndex + 1} / {animeGuesses.length}</div>
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
  
  /* Quiz Interface Styles (aniguessr-like) */
  .quiz-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 5px 10px;
    width: 100%;
  }
  
  .quiz-header {
    text-align: center;
    margin-bottom: 15px;
  }
  
  .quiz-title {
    font-size: clamp(1.5rem, 5vw, 2.5rem);
    font-weight: 900;
    color: white;
    letter-spacing: 2px;
    margin-bottom: 10px;
    text-shadow: 0 0 20px rgba(162, 57, 202, 0.5);
  }
  
  .round-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .round-text {
    font-size: clamp(1rem, 3vw, 1.5rem);
    font-weight: 700;
    color: white;
  }
  
  .difficulty-badge {
    background: var(--accent, #A239CA);
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: clamp(0.75rem, 2vw, 0.875rem);
    font-weight: 700;
  }
  
  .score-display {
    margin-top: 10px;
    font-size: clamp(1rem, 3vw, 1.25rem);
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
  }
  
  .score-value {
    color: #FFD700;
    text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
  }
  
  .image-container {
    position: relative;
    width: 100%;
    max-width: 900px;
    margin: 0 auto 12px;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }
  
  .quiz-image {
    width: 100%;
    height: 45vh;
    display: block;
    object-fit: cover;
    background: #000;
  }
  
  @media (max-width: 768px) {
    .quiz-image {
      height: 35vh;
    }
  }
  
  .clues-container {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin-bottom: 12px;
    flex-wrap: wrap;
    padding: 0 10px;
  }
  
  .clue-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border-radius: 8px;
    font-weight: 700;
    font-size: clamp(0.7rem, 2vw, 0.875rem);
    transition: all 0.3s;
    cursor: pointer;
    border: 2px solid;
    white-space: nowrap;
  }
  
  @media (max-width: 768px) {
    .clue-btn {
      padding: 8px 12px;
      gap: 4px;
    }
  }
  
  .clue-btn.locked {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.7);
  }
  
  .clue-btn.locked:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(162, 57, 202, 0.5);
    transform: translateY(-2px);
  }
  
  .clue-btn.unlocked {
    background: rgba(162, 57, 202, 0.2);
    border-color: #A239CA;
    color: white;
  }
  
  .clue-btn:disabled {
    cursor: default;
  }
  
  .clue-icon {
    font-size: 1rem;
  }
  
  .clue-text {
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  
  .answer-container {
    position: relative;
    max-width: 720px;
    margin: 0 auto 12px;
    display: flex;
    gap: 8px;
    padding: 0 10px;
  }
  
  .answer-input {
    flex: 1;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font-size: clamp(0.875rem, 2.5vw, 1rem);
    transition: all 0.3s;
    min-width: 0;
  }
  
  .answer-input:focus {
    outline: none;
    border-color: #A239CA;
    background: rgba(255, 255, 255, 0.08);
  }
  
  .answer-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
  
  .guess-btn {
    padding: 14px 30px;
    background: var(--accent, #A239CA);
    color: white;
    font-weight: 900;
    font-size: clamp(0.875rem, 2.5vw, 1rem);
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 0.3s;
    letter-spacing: 1px;
    white-space: nowrap;
  }
  
  .guess-btn:hover {
    background: var(--accent2, #8B2FC9);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(162, 57, 202, 0.5);
  }
  
  .guess-btn:active {
    transform: translateY(0);
  }
  
  @media (max-width: 768px) {
    .answer-input {
      padding: 12px 14px;
    }
    
    .guess-btn {
      padding: 12px 20px;
    }
  }
  
  .suggestions-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 120px;
    margin-top: 8px;
    background: rgba(30, 30, 40, 0.98);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    overflow: hidden;
    max-height: 300px;
    overflow-y: auto;
    z-index: 50;
  }
  
  .suggestion-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .suggestion-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .suggestion-image {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    object-fit: cover;
  }
  
  .suggestion-content {
    flex: 1;
    min-width: 0;
  }
  
  .suggestion-title {
    color: white;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .suggestion-subtitle {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.875rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .suggestion-score {
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.875rem;
  }
  
  .progress-container {
    text-align: center;
  }
  
  .progress-dots {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-bottom: 10px;
  }
  
  .progress-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    transition: all 0.3s;
  }
  
  .progress-dot.completed {
    background: #A239CA;
    box-shadow: 0 0 10px rgba(162, 57, 202, 0.5);
  }
  
  .progress-dot.active {
    background: var(--accent, #A239CA);
    box-shadow: 0 0 10px rgba(162, 57, 202, 0.5);
    transform: scale(1.3);
  }
  
  .progress-text {
    color: rgba(255, 255, 255, 0.7);
    font-weight: 600;
    font-size: 0.875rem;
  }
</style>
