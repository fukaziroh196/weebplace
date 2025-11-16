<script>
  import { onMount } from 'svelte';
  import { currentUser } from '../stores/authApi';
  import { fetchSuggestions, suggestions, enabledSourceIds, adminImages } from '../stores/sources';
  import { clickOutside } from '../lib/clickOutside';
  import { animeGuesses as apiGuesses, getBatchSampleZipUrl, scores } from '../lib/api';
  import { quizDate, availableQuizDates, refreshQuizDates, setQuizDate } from '../stores/quizzes';
  import { refreshLeaderboard, leaderboardPeriod } from '../stores/leaderboard';
  import { gameState } from '../stores/gameState';
  
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
  // Режим отображения изображения: original | hint1 | hint2
  let displayedImageMode = 'original';
  
  // Система очков
  let totalScore = 0;
  let roundScores = []; // очки за каждый раунд
  let showFinalResults = false;
  
  // Текущая картинка для отображения
  $: currentGuess = animeGuesses[currentImageIndex] || null;

  // Обновляем gameState для отображения в верхней панели
  $: {
    if (animeGuesses.length > 0) {
      gameState.set({
        title: 'УГАДАЙ АНИМЕ',
        round: currentImageIndex + 1,
        difficulty: 'Легко',
        score: totalScore
      });
    } else {
      gameState.set({
        title: '',
        round: 0,
        difficulty: '',
        score: 0
      });
    }
  }
  
  // Визуальная обратная связь
  let answerFeedback = ''; // 'correct' | 'incorrect' | ''
  let isChecking = false;
  
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
        const response = await fetch(`https://shikimori.one/api/animes?search=${encodeURIComponent(userAnswer.trim())}&limit=20&order=popularity`);
        const data = await response.json();

        if (data && data.length > 0) {
          const q = String(userAnswer || '').toLowerCase().trim();

          function relevanceScore(title) {
            if (!title) return 0;
            const t = String(title).toLowerCase();
            const norm = t.replace(/[\-–—_:()\[\]{}!?,.]/g, ' ').replace(/\s+/g, ' ').trim();

            let score = 0;
            // Very strong boost: normalized exact match
            if (norm === q) score += 1400;

            // Prefix and contains
            if (t.startsWith(q) || norm.startsWith(q)) score += 800; // base prefix boost
            const idx = t.indexOf(q);
            if (idx >= 0) score += Math.max(0, 450 - Math.min(idx, 300));

            // Prefer single-word/short base titles (e.g., "евангелион") over variants
            const words = norm.split(' ');
            if (words.length === 1 && words[0].startsWith(q)) score += 300;

            // Penalize cross-overs and collaborations (" x ", "×")
            if (/(\sx\s|×)/.test(t)) score -= 200;

            // Penalize early numbers / version markers (e.g., "1.11", "3.0", "2.22")
            const earlyChunk = t.slice(0, 10);
            if (/\d/.test(earlyChunk)) score -= 120;

            // Penalize heavy suffixes like season/movie parts appearing early
            if (/(season|movie|film|part|ova|tv|обнов|версия|фильм|часть|сезон)/i.test(earlyChunk)) score -= 80;

            // Prefer shorter titles slightly
            score -= Math.min(norm.length, 120) * 0.3;
            return score;
          }

          const scored = data.map((anime, idx) => {
            const main = anime.russian || anime.name || '';
            const alt = anime.name && anime.name !== anime.russian ? anime.name : '';
            const score = Math.max(relevanceScore(main), relevanceScore(alt));
            return { 
              title: main,
              titleAlt: alt || null,
              _score: score,
              _idx: idx // preserve API popularity order for ties
            };
          });

          scored.sort((a, b) => {
            if (b._score !== a._score) return b._score - a._score;
            // if scores equal, prefer single word then shorter title
            const wa = (a.title || '').split(/\s+/).length;
            const wb = (b.title || '').split(/\s+/).length;
            if (wa !== wb) return wa - wb;
            const la = (a.title || '').length;
            const lb = (b.title || '').length;
            if (la !== lb) return la - lb;
            // finally keep API popularity order
            return a._idx - b._idx;
          });

          userSuggestions = scored.slice(0, 10).map(({ title, titleAlt }) => ({ title, titleAlt }));
          showUserSuggestions = true;
        } else {
          userSuggestions = [];
          showUserSuggestions = false;
        }
      } catch (e) {
        console.error('[onUserAnswerInput] Error:', e);
        userSuggestions = [];
        showUserSuggestions = false;
      }
    }, 300);
  }
  
  function selectUserAnswer(suggestion) {
    console.log('[selectUserAnswer] Selected anime:', suggestion);
    userAnswer = String(suggestion.title || '').trim();
    console.log('[selectUserAnswer] Set userAnswer to:', userAnswer);
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
    
    // Ensure userAnswer is a string
    if (typeof userAnswer !== 'string') {
      console.error('[checkAnswer] userAnswer is not a string:', userAnswer);
      userAnswer = String(userAnswer || '');
    }
    
    const answer = userAnswer.trim();
    
    if (!guessId || !answer) {
      console.log('[checkAnswer] No guess ID or empty answer');
      return;
    }
    
    if (isChecking) {
      console.log('[checkAnswer] Already checking...');
      return;
    }
    
    isChecking = true;
    answerFeedback = '';
    
    console.log('[checkAnswer] Checking:', { guessId, answer, title: animeGuesses[currentImageIndex]?.title, userAnswerType: typeof userAnswer });
    
    try {
      const res = await apiGuesses.checkAnswer(guessId, answer);
      console.log('[checkAnswer] Response:', res);
    
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
        
        answerFeedback = 'correct';
        
        console.log('[checkAnswer] Correct! Score:', score, 'Total:', totalScore);
        
        // Переход к следующей картинке
        if (currentImageIndex < animeGuesses.length - 1) {
          setTimeout(() => {
            currentImageIndex++;
      userAnswer = '';
            unlockedClues = [];
            showTitle = false;
            displayedImageMode = 'original';
            answerFeedback = '';
            isChecking = false;
          }, 800);
    } else {
          // Все раунды пройдены - показываем финальные результаты
          setTimeout(async () => {
            userAnswer = '';
            answerFeedback = '';
            isChecking = false;
            showFinalResults = true;
            
            // Отправить очки на сервер
            await submitScore();
            
            // Обновить лидерборд после завершения квиза
            let period;
            leaderboardPeriod.subscribe(v => period = v)();
            await refreshLeaderboard(period || 'all');
          }, 800);
        }
      } else {
        // Неправильный ответ
        answerFeedback = 'incorrect';
        const correctAnswer = animeGuesses[currentImageIndex]?.title || 'Неизвестно';
        console.log('[checkAnswer] Incorrect answer. Correct:', correctAnswer);
        
        // Начисляем 0 очков
        roundScores[currentImageIndex] = 0;
        roundScores = [...roundScores];
        
        // Переход к следующей картинке
        if (currentImageIndex < animeGuesses.length - 1) {
          setTimeout(() => {
            currentImageIndex++;
            userAnswer = '';
            unlockedClues = [];
            showTitle = false;
            displayedImageMode = 'original';
            answerFeedback = '';
            isChecking = false;
          }, 800);
        } else {
          // Все раунды пройдены - показываем финальные результаты
          setTimeout(async () => {
            userAnswer = '';
            answerFeedback = '';
            isChecking = false;
            showFinalResults = true;
            
            // Отправить очки на сервер
            await submitScore();
            
            // Обновить лидерборд после завершения квиза
            let period;
            leaderboardPeriod.subscribe(v => period = v)();
            await refreshLeaderboard(period || 'all');
          }, 800);
        }
      }
    } catch (e) {
      console.error('[checkAnswer] Error:', e);
      alert('Ошибка проверки: ' + (e?.message || 'Неизвестная ошибка'));
      answerFeedback = '';
      isChecking = false;
    }
  }
  
  function unlockClue(clueIndex) {
    if (!unlockedClues.includes(clueIndex)) {
      unlockedClues = [...unlockedClues, clueIndex];
    }
    // Переключаемся на выбранную подсказку
    displayedImageMode = clueIndex === 0 ? 'hint1' : 'hint2';
  }
  
  function unlockTitleClue() {
    showTitle = true;
  }
  
  // Подсказки:
  // 1. Первая подсказка - картинка (hint1_image)
  // 2. Вторая подсказка - картинка (hint2_image)
  // 3. Третья подсказка - первая буква названия
  function getFirstLetterHint(title) {
    if (!title) return '';
    return title.charAt(0).toUpperCase();
  }
  
  function getTitleWithUnderscores(title) {
    if (!title) return '';
    return title
      .split(' ')
      .map(word => {
        if (word.length === 0) return '';
        return word.charAt(0).toUpperCase() + '_'.repeat(word.length - 1);
      })
      .join(' ');
  }

  // === Отправка очков на сервер ===
  async function submitScore() {
    if (!$currentUser || totalScore <= 0) return;
    
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      await scores.submit('anime', totalScore, today);
      console.log(`[submitScore] Score submitted: ${totalScore} points for anime quiz`);
    } catch (error) {
      console.error('[submitScore] Error submitting score:', error);
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
    
    // Устанавливаем дату на сегодня при открытии, если она доступна
    let dates;
    availableQuizDates.subscribe(v => dates = v)();
    let currentDate;
    quizDate.subscribe(v => currentDate = v)();
    
    const today = todayStr();
    
    // Если сегодняшняя дата доступна, устанавливаем её
    if (dates && dates.includes(today)) {
      if (currentDate !== today) {
        setQuizDate(today);
      }
      await fetchAllGuesses(today);
    } else {
      // Иначе используем текущую дату или загружаем данные для неё
      await fetchAllGuesses();
    }
    
    // init admin date from AniQuiz on first mount
    let d; quizDate.subscribe(v=>d=v)();
    adminUploadDate = d || todayStr();
  });
</script>

<div class="guess-anime-wrapper">
  <!-- Интерфейс для всех пользователей (админ загружает через отдельную панель) -->
  {#if animeGuesses.length === 0}
    <div class="quiz-container text-center">
      <div class="text-white/80 text-lg">Пока нет картинок для угадывания 😔</div>
        </div>
  {:else}
    <div class="quiz-container">
        <!-- Заголовок с раундом и очками - скрыт, отображается в верхней панели -->
        <div class="quiz-header" style="display: none;">
          <div class="header-left">
            <h1 class="quiz-title">УГАДАЙ АНИМЕ</h1>
            <div class="round-badge">
              <span class="round-text">Раунд {currentImageIndex + 1}</span>
              <span class="difficulty-badge">Легко</span>
                  </div>
                </div>
          <div class="score-display">
            <span class="score-value">{totalScore.toLocaleString()}</span>
            <span class="score-label">очков</span>
            </div>
        </div>
        
        <!-- Большая картинка по центру -->
        <div class="image-container">
          {#if displayedImageMode === 'hint2' && unlockedClues.includes(1) && currentGuess?.hint2_image}
            <img 
              src="{import.meta.env.VITE_API_URL.replace('/api', '')}{currentGuess.hint2_image}" 
              alt="Подсказка 2"
              class="quiz-image"
            />
          {:else if displayedImageMode === 'hint1' && unlockedClues.includes(0) && currentGuess?.hint1_image}
            <img 
              src="{import.meta.env.VITE_API_URL.replace('/api', '')}{currentGuess.hint1_image}" 
              alt="Подсказка 1"
              class="quiz-image"
            />
          {:else}
            <img 
              src={animeGuesses[currentImageIndex].image} 
              alt="Угадай аниме"
              class="quiz-image"
            />
            {/if}
            </div>
        
        <!-- Переключатель вида изображения -->
        <div class="view-toggle">
        <button 
            class="view-btn {displayedImageMode === 'original' ? 'active' : ''}"
            on:click={() => displayedImageMode = 'original'}
          >Оригинал</button>
          <button 
            class="view-btn {displayedImageMode === 'hint1' ? 'active' : ''}"
            on:click={() => { 
              if (!unlockedClues.includes(0)) unlockClue(0);
              if (currentGuess?.hint1_image) displayedImageMode = 'hint1';
            }}
            disabled={!currentGuess?.hint1_image}
          >Подсказка 1</button>
          <button 
            class="view-btn {displayedImageMode === 'hint2' ? 'active' : ''}"
            on:click={() => { 
              if (!unlockedClues.includes(1)) unlockClue(1);
              if (currentGuess?.hint2_image) displayedImageMode = 'hint2';
            }}
            disabled={!currentGuess?.hint2_image}
          >Подсказка 2</button>
          <button 
            class="view-btn {displayedImageMode === 'firstLetter' ? 'active' : ''}"
            on:click={() => { 
              if (!showTitle) unlockTitleClue();
              displayedImageMode = 'firstLetter';
            }}
          >Первая буква</button>
    </div>
    
        <!-- Первая буква (показывается между подсказками и полем ввода) -->
        {#if displayedImageMode === 'firstLetter' && showTitle}
          <div class="first-letter-display">
            <div class="first-letter-text">{getTitleWithUnderscores(animeGuesses[currentImageIndex].title)}</div>
        </div>
      {/if}
        
        <!-- Поле ввода ответа -->
        <div class="answer-container" use:clickOutside={{ enabled: showUserSuggestions, callback: () => showUserSuggestions = false }}>
          <input 
            type="text" 
            bind:value={userAnswer}
            placeholder="Введите название аниме"
            class="answer-input {answerFeedback === 'correct' ? 'answer-correct' : answerFeedback === 'incorrect' ? 'answer-incorrect' : ''}"
            on:input={onUserAnswerInput}
            on:keydown={(e) => { 
              if (e.key === 'Enter') {
                e.preventDefault();
                checkAnswer();
              }
              if (e.key === 'Escape') showUserSuggestions = false;
            }}
            autocomplete="off"
            disabled={isChecking}
          />
          
          <button 
            on:click={checkAnswer}
            class="guess-btn"
            disabled={isChecking || !userAnswer.trim()}
          >
            {isChecking ? '⏳' : 'ОТВЕТИТЬ'}
          </button>
          
          {#if showUserSuggestions && userSuggestions.length > 0}
            <div class="suggestions-dropdown">
              {#each userSuggestions as s}
                <div class="suggestion-item" on:click={() => selectUserAnswer(s)}>
                  <div class="suggestion-content">
                    <div class="suggestion-title">{s.title}</div>
                    {#if s.titleAlt}
                      <div class="suggestion-subtitle">{s.titleAlt}</div>
                    {/if}
                  </div>
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
        </div>
        
<!-- Модальное окно с финальными результатами -->
{#if showFinalResults}
  <div class="final-results-overlay" on:click={() => showFinalResults = false}>
    <div class="final-results-modal" on:click|stopPropagation>
      <h2 class="final-title">Финальный счёт</h2>
      
      <div class="final-score-box">
        <div class="final-score-value">{totalScore.toLocaleString()}</div>
      </div>
      
      <div class="rounds-breakdown">
        {#each animeGuesses as guess, idx}
          <div class="round-item">
            <div class="round-header">
              <span class="round-label">Раунд {idx + 1}</span>
              <span class="round-points">{roundScores[idx]?.toLocaleString() || 0} очков</span>
            </div>
            <div class="round-content">
              <img src={guess.image} alt={guess.title} class="round-thumb" />
              <div class="round-info">
                <div class="round-anime-title">{guess.title}</div>
              </div>
            </div>
          </div>
        {/each}
      </div>
      
      <button class="close-results-btn" on:click={() => showFinalResults = false}>
        Закрыть
          </button>
        </div>
      </div>
    {/if}

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
  .guess-anime-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    min-height: 100%;
  }

  .quiz-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 5px 10px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .quiz-header {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 15px;
    gap: 15px;
    position: relative;
  }
  
  .header-left {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  
  .quiz-title {
    font-size: clamp(1.5rem, 5vw, 2.5rem);
    font-weight: 900;
    color: var(--accent-primary, #9ecaff);
    letter-spacing: 2px;
    margin: 0;
    text-align: center;
    text-shadow: none;
  }
  
  .round-badge {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  
  .round-text {
    font-size: clamp(1rem, 3vw, 1.5rem);
    font-weight: 700;
    color: white;
  }
  
  .difficulty-badge {
    background: var(--accent-primary, #9ecaff);
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: clamp(0.75rem, 2vw, 0.875rem);
    font-weight: 700;
  }
  
  .score-display {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    position: absolute;
    right: 0;
    top: 0;
  }
  
  .score-value {
    font-size: clamp(1.8rem, 4vw, 2.8rem);
    font-weight: 900;
    color: var(--accent-primary, #9ecaff);
    line-height: 1;
    text-shadow: none;
  }
  
  .score-label {
    font-size: clamp(1rem, 2vw, 1.2rem);
    color: var(--text);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  
  .image-container {
    position: relative;
    width: 100%;
    max-width: 900px;
    margin: 3rem auto 1.5rem;
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

  .view-toggle {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin: 0 auto 12px;
    padding: 0 10px;
  }
  .view-btn {
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.06);
    color: white;
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .view-btn:hover:not(:disabled) { background: rgba(255,255,255,0.12); }
  .view-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .view-btn.active { background: var(--accent-primary, #9ecaff); border-color: var(--accent-primary-strong, #b3d6ff); }
  
  .first-letter-display {
    width: 100%;
    margin: 0 auto 15px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
  }
  
  .first-letter-text {
    font-size: clamp(1.2rem, 3vw, 1.8rem);
    font-weight: 600;
    color: var(--accent-primary, #9ecaff);
    letter-spacing: 0.05em;
    font-family: monospace;
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
    background: var(--panelStrong);
    border-color: var(--accent-primary, #9ecaff);
    color: var(--text);
  }
  
  .clue-btn.locked:hover:not(:disabled) {
    background: var(--extra);
    border-color: var(--accent-primary-strong, #b3d6ff);
    color: #FFFFFF;
    transform: translateY(-2px);
  }
  
  .clue-btn.unlocked {
    background: var(--extra);
    border-color: var(--accent-primary-strong, #b3d6ff);
    color: #FFFFFF;
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
    /* Transparent background as requested */
    background: transparent !important;
    background-color: transparent !important;
    border: 2px solid var(--accent-primary, #9ecaff);
    border-radius: 8px;
    color: #ffffff !important; /* Force white text for high contrast */
    -webkit-text-fill-color: #ffffff; /* Safari/Chrome */
    caret-color: #ffffff;
    -webkit-appearance: none;
    appearance: none;
    font-size: clamp(0.875rem, 2.5vw, 1rem);
    transition: all 0.3s;
    min-width: 0;
  }
  
  .answer-input:focus {
    outline: none;
    border-color: var(--accent-primary, #9ecaff);
    background: transparent !important; /* keep transparent on focus */
    background-color: transparent !important;
    box-shadow: 0 0 0 3px rgba(158, 202, 255, 0.18);
  }
  
  .answer-input::placeholder {
    color: rgba(255, 255, 255, 0.6);
  }

  /* Autofill fixes */
  .answer-input:-webkit-autofill,
  .answer-input:-webkit-autofill:hover,
  .answer-input:-webkit-autofill:focus,
  .answer-input:-internal-autofill-selected {
    -webkit-text-fill-color: #ffffff;
    transition: background-color 5000s ease-in-out 0s;
    -webkit-box-shadow: 0 0 0px 1000px rgba(0,0,0,0) inset; /* no white fill */
    box-shadow: 0 0 0px 1000px rgba(0, 0, 0, 0) inset; /* no white fill */
    border: 2px solid var(--accent-primary, #9ecaff);
    background: transparent !important;
    background-color: transparent !important;
  }
  
  .answer-input.answer-correct {
    border-color: var(--accent-primary, #9ecaff) !important;
    box-shadow: 0 0 10px rgba(158, 202, 255, 0.5);
  }
  
  .answer-input.answer-incorrect {
    border-color: #f44336 !important;
    box-shadow: 0 0 10px rgba(244, 67, 54, 0.5);
    animation: shake 0.3s;
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
  
  .guess-btn {
    padding: 14px 30px;
    background: var(--accent-primary, #9ecaff);
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
    background: var(--accent-primary-strong, #b3d6ff);
    transform: translateY(-2px);
    box-shadow: none;
  }
  
  .guess-btn:active {
    transform: translateY(0);
  }
  
  .guess-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
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
    bottom: 100%; /* show above the input */
    left: 0;
    right: 120px;
    margin-bottom: 8px;
    /* Solid non-transparent background */
    background: rgba(20, 24, 32, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    box-shadow: 0 16px 28px rgba(0, 0, 0, 0.45);
    overflow: hidden;
    max-height: 300px;
    overflow-y: auto;
    z-index: 100; /* above other elements */
  }
  
  .suggestion-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .suggestion-item:hover { background: rgba(255, 255, 255, 0.06); }
  
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
    color: #f5f6ff;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .suggestion-subtitle {
    color: rgba(245, 246, 255, 0.65);
    font-size: 0.875rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .suggestion-score {
    color: var(--text-secondary, rgba(245, 246, 255, 0.85));
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
    background: var(--accent-primary, #9ecaff);
    box-shadow: none;
  }
  
  .progress-dot.active {
    background: var(--accent-primary, #9ecaff);
    box-shadow: none;
    transform: scale(1.3);
  }
  
  .progress-text {
    color: rgba(255, 255, 255, 0.7);
    font-weight: 600;
    font-size: 0.875rem;
  }
  
  /* Модальное окно финальных результатов */
  .final-results-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
    animation: fadeIn 0.3s;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .final-results-modal {
    background: #1a1a1a;
    border-radius: 16px;
    max-width: 600px;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    padding: 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.4s;
  }
  
  @keyframes slideUp {
    from {
      transform: translateY(30px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  .final-title {
    text-align: center;
    font-size: clamp(1.5rem, 4vw, 2rem);
    font-weight: 900;
    color: white;
    margin: 0 0 16px 0;
    letter-spacing: 1px;
  }
  
  .final-score-box {
    background: linear-gradient(135deg, var(--accent-primary, #9ecaff) 0%, var(--accent-primary-strong, #b3d6ff) 100%);
    border-radius: 12px;
    padding: 20px;
    text-align: center;
    margin-bottom: 16px;
  }
  
  .final-score-value {
    font-size: clamp(2.5rem, 6vw, 4rem);
    font-weight: 900;
    color: white;
    line-height: 1;
  }
  
  .rounds-breakdown {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 16px;
  }
  
  .round-item {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 12px;
    transition: background 0.2s;
  }
  
  .round-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  
  .round-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  
  .round-label {
    color: var(--accent-primary, #9ecaff);
    font-weight: 700;
    font-size: clamp(0.85rem, 1.8vw, 0.95rem);
  }
  
  .round-points {
    color: white;
    font-weight: 700;
    font-size: clamp(0.85rem, 1.8vw, 0.95rem);
  }
  
  .round-content {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  
  .round-thumb {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: 6px;
    flex-shrink: 0;
  }
  
  .round-info {
    flex: 1;
    min-width: 0;
  }
  
  .round-anime-title {
    color: white;
    font-weight: 600;
    font-size: clamp(0.9rem, 2vw, 1rem);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  
  .close-results-btn {
    width: 100%;
    padding: 14px;
    background: var(--accent-primary, #9ecaff);
    color: white;
    font-weight: 900;
    font-size: 1rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  
  .close-results-btn:hover {
    background: var(--accent-primary-strong, #b3d6ff);
    transform: translateY(-2px);
    box-shadow: none;
  }
  
  .close-results-btn:active {
    transform: translateY(0);
  }
  
  @media (max-width: 768px) {
    .final-results-modal {
      padding: 20px 16px;
      max-height: 90vh;
    }
    
    .final-title {
      font-size: 1.5rem;
      margin-bottom: 12px;
    }
    
    .final-score-box {
      padding: 16px;
      margin-bottom: 12px;
    }
    
    .final-score-value {
      font-size: 2.5rem;
    }
    
    .rounds-breakdown {
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .round-item {
      padding: 10px;
    }
    
    .round-thumb {
      width: 50px;
      height: 50px;
    }
    
    .round-anime-title {
      font-size: 0.85rem;
    }
    
    .close-results-btn {
      padding: 12px;
      font-size: 0.9rem;
    }
  }
</style>
