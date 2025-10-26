<script>
  import { onMount } from 'svelte';
  import { currentUser } from '../stores/auth';
  import { fetchSuggestions, suggestions, enabledSourceIds, adminImages } from '../stores/sources';
  import { clickOutside } from '../lib/clickOutside';
  
  // Данные об угадываемых аниме
  let animeGuesses = [];
  let loading = false;
  let selectedFile = null;
  
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
  
  // Загрузить данные из localStorage
  function loadAnimeGuesses() {
    try {
      const saved = localStorage.getItem('animeGuesses');
      if (saved) {
        animeGuesses = JSON.parse(saved);
      } else {
        animeGuesses = [];
      }
    } catch (e) {
      console.error('Ошибка загрузки:', e);
      animeGuesses = [];
    }
  }
  
  // Сохранить данные в localStorage
  function saveAnimeGuesses() {
    try {
      localStorage.setItem('animeGuesses', JSON.stringify(animeGuesses));
    } catch (e) {
      console.error('Ошибка сохранения:', e);
    }
  }
  
  // Проверка, является ли пользователь админом
  $: isAdmin = $currentUser?.isAdmin || false;
  
  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      selectedFile = file;
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
  
  function uploadImage() {
    if (!selectedFile || !selectedAnime) {
      alert('Выберите картинку и аниме из списка');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const newGuess = {
        id: Date.now().toString(),
        image: e.target.result,
        title: selectedAnime.title,
        animeId: selectedAnime.id,
        sourceId: selectedAnime.__sourceId,
        createdAt: Date.now(),
        guessedBy: []
      };
      
      animeGuesses = [...animeGuesses, newGuess];
      saveAnimeGuesses();
      selectedFile = null;
      selectedAnime = null;
      adminSearchQuery = '';
      document.getElementById('fileInput').value = '';
      alert('Картинка загружена!');
    };
    reader.readAsDataURL(selectedFile);
  }
  
  function deleteGuess(id) {
    if (confirm('Удалить эту картинку?')) {
      animeGuesses = animeGuesses.filter(g => g.id !== id);
      saveAnimeGuesses();
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
  
  function checkAnswer() {
    const guessId = animeGuesses[currentImageIndex]?.id;
    if (!guessId || !userAnswer.trim()) return;
    
    const guess = animeGuesses.find(g => g.id === guessId);
    if (!guess) return;
    
    const correct = userAnswer.toLowerCase().trim() === guess.title.toLowerCase().trim();
    
    if (correct) {
      // Проверяем, не отгадывал ли уже этот пользователь
      const userId = $currentUser?.id;
      if (userId && !guess.guessedBy.includes(userId)) {
        guess.guessedBy.push(userId);
        saveAnimeGuesses();
      }
      alert('Правильно! 🎉');
      userAnswer = '';
    } else {
      alert('Неправильно! Попробуйте еще раз.');
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
  
  onMount(() => {
    loadAnimeGuesses();
  });
</script>

<div class="flex flex-col w-full">
  <h1 class="text-3xl font-bold text-white mb-6">🎌 Угадай аниме</h1>
  
  {#if isAdmin}
    <!-- Панель администратора для загрузки картинок -->
    <div class="bg-purple-900/70 backdrop-blur-md rounded-xl p-6 mb-6 glass-frame">
      <h2 class="text-2xl font-bold text-white mb-4">📤 Загрузить новую картинку</h2>
      
      <div class="flex flex-col gap-4">
        <div>
          <label class="block text-white/90 mb-2">Выберите картинку:</label>
          <input 
            type="file" 
            id="fileInput"
            accept="image/*" 
            class="text-white"
            on:change={handleFileSelect}
          />
          {#if selectedFile}
            <div class="mt-2 text-green-400">✓ {selectedFile.name}</div>
          {/if}
        </div>
        
        <div class="relative" use:clickOutside={{ enabled: showAdminSuggestions, callback: () => showAdminSuggestions = false }}>
          <label class="block text-white/90 mb-2">Выберите аниме из списка:</label>
          <input 
            type="text" 
            bind:value={adminSearchQuery}
            placeholder="Начните вводить название аниме..."
            class="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:border-pink-500"
            on:input={onAdminSearchInput}
            autocomplete="off"
          />
          
          {#if showAdminSuggestions && adminSuggestions.length > 0}
            <div class="absolute left-0 right-0 mt-2 rounded-xl overflow-hidden z-20 menu-surface" style="max-height: 300px; overflow-y: auto;">
              {#each adminSuggestions as s}
                <div class="px-3 py-2 cursor-pointer flex items-center gap-2 menu-item hover:bg-white/10"
                     on:click={() => selectAnime(s)}>
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
        
        {#if selectedAnime}
          <div class="bg-white/5 rounded-lg p-3 flex items-center gap-3">
            {#if selectedAnime.image}
              <img src={selectedAnime.image} alt={selectedAnime.title} class="w-16 h-16 rounded object-cover" />
            {/if}
            <div>
              <div class="text-white font-semibold">{selectedAnime.title}</div>
              {#if selectedAnime.russian && selectedAnime.russian !== selectedAnime.title}
                <div class="text-white/60 text-sm">{selectedAnime.russian}</div>
              {/if}
              <div class="text-white/60 text-xs">ID: {selectedAnime.id}</div>
            </div>
          </div>
        {/if}
        
        <button 
          on:click={uploadImage}
          class="bg-pink-700 hover:bg-pink-600 text-white px-6 py-3 rounded-lg font-semibold transition"
        >
          Загрузить
        </button>
      </div>
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
              <div class="text-white/60 text-xs">Отгадано: {guess.guessedBy.length}</div>
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
