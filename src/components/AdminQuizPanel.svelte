<script>
  import { onMount } from 'svelte';
  import { currentUser } from '../stores/authApi';
  import { animeGuesses as apiGuesses } from '../lib/api';
  import { refreshQuizDates, setQuizDate } from '../stores/quizzes';
  import { goHome } from '../stores/ui';

  // === Проверка прав ===
  let isAdmin = false;
  $: isAdmin = $currentUser?.role === 'admin' || $currentUser?.is_admin === 1 || $currentUser?.isAdmin === true;

  // === Выбор даты пака ===
  let selectedDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  let adminUploadDate = selectedDate;

  // === Загрузка картинок (4 шт) ===
  let packSlots = Array.from({ length: 4 }, () => ({ file: null, title: '', hint1File: null, hint2File: null, uploading: false }));
  let packUploading = false;
  let packUploadError = '';
  
  // Автодополнение для картинок
  let imageSuggestions = Array(4).fill([]);
  let imageShowSuggestions = Array(4).fill(false);

  $: canSubmitPack = packSlots.every((s) => s.file && s.title.trim());

  function handleImageSelect(index, event) {
    const file = event.target.files?.[0];
    if (file) {
      packSlots[index].file = file;
      packSlots = [...packSlots];
    }
  }

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
      
      // Загрузить подсказки для каждой картинки
      if (result.items && Array.isArray(result.items)) {
        for (let i = 0; i < result.items.length; i++) {
          const slot = packSlots[i];
          const item = result.items[i];
          
          if ((slot.hint1File || slot.hint2File) && item.id) {
            try {
              const formData = new FormData();
              if (slot.hint1File) formData.append('hint1', slot.hint1File);
              if (slot.hint2File) formData.append('hint2', slot.hint2File);
              
              const hintRes = await fetch(`${import.meta.env.VITE_API_URL}/anime-guesses/${item.id}/hints`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('api_token')}`
                },
                body: formData
              });
              
              if (!hintRes.ok) {
                console.error(`[submitPack] Failed to upload hints for slot ${i + 1}`);
              } else {
                console.log(`[submitPack] Hints uploaded for slot ${i + 1}`);
              }
            } catch (e) {
              console.error(`[submitPack] Error uploading hints for slot ${i + 1}:`, e);
            }
          }
        }
      }
      
      // Очистить форму
      packSlots = Array.from({ length: 4 }, () => ({ file: null, title: '', hint1File: null, hint2File: null, uploading: false }));
      
      // Обновить список дат
      await refreshQuizDates();
      
      alert(`✓ Пак картинок успешно загружен на дату ${adminUploadDate}!\n${result.created || 4} изображений добавлено.`);
    } catch (e) {
      console.error('[submitPack] Error:', e);
      packUploadError = `Ошибка загрузки: ${e?.message || 'Network error'}`;
      alert(packUploadError);
    } finally {
      packUploading = false;
    }
  }

  // === Загрузка опенингов (3 шт) ===
  let openingSlots = Array.from({ length: 3 }, () => ({ 
    title: '', 
    youtubeUrl: '', 
    startTime: 0, 
    endTime: 20 
  }));
  let openingPackUploading = false;
  let openingPackError = '';
  
  // Автодополнение для опенингов
  let openingSuggestions = Array(3).fill([]);
  let openingShowSuggestions = Array(3).fill(false);

  $: canSubmitOpeningPack = openingSlots.every((s) => s.title.trim() && s.youtubeUrl.trim());

  async function submitOpeningPack() {
    openingPackError = '';
    
    if (!adminUploadDate) {
      openingPackError = 'Выберите дату сета';
      return;
    }
    
    if (!canSubmitOpeningPack) {
      openingPackError = 'Заполните все 3 опенинга (название и ссылку)';
      return;
    }

    try {
      openingPackUploading = true;
      console.log(`[submitOpeningPack] Starting upload for ${adminUploadDate}`);
      
      // Загружаем 3 опенинга последовательно
      for (let i = 0; i < openingSlots.length; i++) {
        const opening = openingSlots[i];
        
        const response = await fetch(`${import.meta.env.VITE_API_URL}/openings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('api_token')}`
          },
          body: JSON.stringify({
            quizDate: adminUploadDate,
            title: opening.title.trim(),
            youtubeUrl: opening.youtubeUrl.trim(),
            startTime: opening.startTime || 0,
            endTime: opening.endTime || 20
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} на опенинге ${i + 1}`);
        }
        
        console.log(`[submitOpeningPack] Opening ${i + 1} uploaded successfully`);
      }
      
      // Очистить форму
      openingSlots = Array.from({ length: 3 }, () => ({ 
        title: '', 
        youtubeUrl: '', 
        startTime: 0, 
        endTime: 20 
      }));
      
      alert(`✓ Пак опенингов (3 шт) успешно загружен на дату ${adminUploadDate}!`);
    } catch (e) {
      console.error('[submitOpeningPack] Error:', e);
      openingPackError = `Ошибка загрузки: ${e?.message || 'Network error'}`;
      alert(openingPackError);
    } finally {
      openingPackUploading = false;
    }
  }

  // === Просмотр загруженных данных ===
  let uploadedImages = [];
  let uploadedOpenings = [];
  let loadingData = false;

  async function loadUploadedData() {
    if (!adminUploadDate) return;
    
    loadingData = true;
    try {
      // Загрузить картинки для выбранной даты
      const imagesRes = await fetch(`${import.meta.env.VITE_API_URL}/anime-guesses?date=${adminUploadDate}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('api_token')}`
        }
      });
      if (imagesRes.ok) {
        uploadedImages = await imagesRes.json();
      }
      
      // Загрузить опенинги для выбранной даты
      const openingsRes = await fetch(`${import.meta.env.VITE_API_URL}/openings?date=${adminUploadDate}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('api_token')}`
        }
      });
      if (openingsRes.ok) {
        uploadedOpenings = await openingsRes.json();
      }
    } catch (e) {
      console.error('[loadUploadedData] Error:', e);
    } finally {
      loadingData = false;
    }
  }

  // === Удаление картинки ===
  async function deleteImage(id) {
    if (!confirm('Удалить эту картинку?')) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/anime-guesses/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('api_token')}`
        }
      });
      
      if (response.ok) {
        alert('✓ Картинка удалена');
        await loadUploadedData();
      } else {
        throw new Error('Ошибка удаления');
      }
    } catch (e) {
      console.error('[deleteImage] Error:', e);
      alert('Ошибка удаления: ' + e.message);
    }
  }

  // === Удаление опенинга ===
  async function deleteOpening(id) {
    if (!confirm('Удалить этот опенинг?')) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/openings/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('api_token')}`
        }
      });
      
      if (response.ok) {
        alert('✓ Опенинг удалён');
        await loadUploadedData();
      } else {
        throw new Error('Ошибка удаления');
      }
    } catch (e) {
      console.error('[deleteOpening] Error:', e);
      alert('Ошибка удаления: ' + e.message);
    }
  }

  // === Поиск аниме для автодополнения ===
  let searchTimeout;
  
  async function searchAnime(query, index, type) {
    if (!query || query.length < 2) {
      if (type === 'image') {
        imageSuggestions[index] = [];
        imageShowSuggestions[index] = false;
      } else {
        openingSuggestions[index] = [];
        openingShowSuggestions[index] = false;
      }
      return;
    }
    
    // Debounce
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      try {
        // Используем Shikimori API (русские названия)
        const response = await fetch(`https://shikimori.one/api/animes?search=${encodeURIComponent(query)}&limit=10&order=popularity`);
        const data = await response.json();
        
        if (data && data.length > 0) {
          const suggestions = data.map(anime => ({
            title: anime.russian || anime.name,  // Русское название в приоритете
            titleAlt: anime.name !== anime.russian ? anime.name : null  // Оригинальное название
          }));
          
          if (type === 'image') {
            imageSuggestions[index] = suggestions;
            imageShowSuggestions[index] = true;
            imageSuggestions = [...imageSuggestions];
            imageShowSuggestions = [...imageShowSuggestions];
          } else {
            openingSuggestions[index] = suggestions;
            openingShowSuggestions[index] = true;
            openingSuggestions = [...openingSuggestions];
            openingShowSuggestions = [...openingShowSuggestions];
          }
        }
      } catch (e) {
        console.error('[searchAnime] Error:', e);
      }
    }, 300);
  }
  
  function selectImageSuggestion(index, title) {
    packSlots[index].title = title;
    packSlots = [...packSlots];
    imageShowSuggestions[index] = false;
    imageShowSuggestions = [...imageShowSuggestions];
  }
  
  function selectOpeningSuggestion(index, title) {
    openingSlots[index].title = title;
    openingSlots = [...openingSlots];
    openingShowSuggestions[index] = false;
    openingShowSuggestions = [...openingShowSuggestions];
  }

  // === Вспомогательные функции ===
  function setDateToToday() {
    adminUploadDate = new Date().toISOString().split('T')[0];
  }
  
  // Реактивная загрузка данных при смене даты
  $: if (adminUploadDate) {
    loadUploadedData();
  }

  onMount(() => {
    if (!isAdmin) {
      goHome();
    }
  });
</script>

{#if !isAdmin}
  <div class="text-center text-white/60 py-20">
    У вас нет доступа к этой странице
  </div>
{:else}
  <div class="admin-container">
    <div class="admin-header">
      <h1 class="admin-main-title">ПАНЕЛЬ АДМИНИСТРАТОРА</h1>
      <button class="back-btn" on:click={goHome}>← Назад</button>
    </div>

    <!-- === ВЫБОР ДАТЫ === -->
    <div class="date-section">
      <div class="section-title">📅 Выберите дату пака</div>
      <div class="date-controls">
        <input 
          type="date" 
          bind:value={adminUploadDate}
          class="date-input"
        />
        <button class="today-btn" on:click={setDateToToday}>Сегодня</button>
      </div>
      <div class="selected-date">Выбрана дата: <strong>{adminUploadDate}</strong></div>
    </div>

    <!-- === ЗАГРУЗКА КАРТИНОК === -->
    <div class="upload-section">
      <div class="section-title">🖼️ Загрузка картинок (4 шт)</div>
      
      <div class="pack-grid">
        {#each packSlots as slot, idx}
          <div class="pack-slot">
            <div class="slot-number">{idx + 1}</div>
            
            <label class="file-upload-label">
              <input 
                type="file" 
                accept="image/*"
                on:change={(e) => handleImageSelect(idx, e)}
                class="file-input"
              />
              {#if slot.file}
                <div class="file-preview">
                  <img src={URL.createObjectURL(slot.file)} alt="Preview {idx+1}" />
                </div>
              {:else}
                <div class="file-placeholder">
                  <div class="upload-icon">📷</div>
                  <div class="upload-text">Выбрать</div>
                </div>
              {/if}
            </label>
            
            <div class="autocomplete-wrapper">
              <input 
                type="text" 
                bind:value={slot.title}
                on:input={() => searchAnime(slot.title, idx, 'image')}
                on:focus={() => { if (imageSuggestions[idx]?.length > 0) imageShowSuggestions[idx] = true; imageShowSuggestions = [...imageShowSuggestions]; }}
                on:blur={() => setTimeout(() => { imageShowSuggestions[idx] = false; imageShowSuggestions = [...imageShowSuggestions]; }, 200)}
                placeholder="Название аниме"
                class="title-input"
                autocomplete="off"
              />
              {#if imageShowSuggestions[idx] && imageSuggestions[idx]?.length > 0}
                <div class="suggestions-dropdown">
                  {#each imageSuggestions[idx] as suggestion}
                    <button 
                      type="button"
                      class="suggestion-item"
                      on:click={() => selectImageSuggestion(idx, suggestion.title)}
                    >
                      <div class="suggestion-title">{suggestion.title}</div>
                      {#if suggestion.titleAlt}
                        <div class="suggestion-alt">{suggestion.titleAlt}</div>
                      {/if}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
            
            <div class="hint-section">
              <div class="hint-label">Подсказки (необязательно):</div>
              <div class="hint-uploads">
                <label class="hint-file-label">
                  <input 
                    type="file" 
                    accept="image/*"
                    on:change={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        packSlots[idx].hint1File = file;
                        packSlots = [...packSlots];
                      }
                    }}
                    class="file-input"
                  />
                  <div class="hint-placeholder">
                    {#if slot.hint1File}
                      <div class="hint-preview">
                        <img src={URL.createObjectURL(slot.hint1File)} alt="Hint 1" />
                        <span class="hint-number">1</span>
                      </div>
                    {:else}
                      <div class="hint-icon">🖼️</div>
                      <div class="hint-text">Подсказка 1</div>
                    {/if}
                  </div>
                </label>
                
                <label class="hint-file-label">
                  <input 
                    type="file" 
                    accept="image/*"
                    on:change={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        packSlots[idx].hint2File = file;
                        packSlots = [...packSlots];
                      }
                    }}
                    class="file-input"
                  />
                  <div class="hint-placeholder">
                    {#if slot.hint2File}
                      <div class="hint-preview">
                        <img src={URL.createObjectURL(slot.hint2File)} alt="Hint 2" />
                        <span class="hint-number">2</span>
                      </div>
                    {:else}
                      <div class="hint-icon">🖼️</div>
                      <div class="hint-text">Подсказка 2</div>
                    {/if}
                  </div>
                </label>
              </div>
            </div>
          </div>
        {/each}
      </div>
      
      {#if packUploadError}
        <div class="error-message">{packUploadError}</div>
      {/if}
      
      <button 
        class="submit-btn"
        on:click={submitPack}
        disabled={!canSubmitPack || packUploading}
      >
        {packUploading ? '⏳ Загрузка...' : '✓ Загрузить пак картинок'}
      </button>
    </div>

    <!-- === ЗАГРУЗКА ОПЕНИНГОВ (3 шт) === -->
    <div class="upload-section">
      <div class="section-title">🎵 Загрузка опенингов (3 шт)</div>
      
      <div class="openings-grid">
        {#each openingSlots as slot, idx}
          <div class="opening-slot">
            <div class="slot-header">Опенинг {idx + 1}</div>
            
            <div class="form-group">
              <label>Название аниме:</label>
              <div class="autocomplete-wrapper">
                <input 
                  type="text" 
                  bind:value={slot.title}
                  on:input={() => searchAnime(slot.title, idx, 'opening')}
                  on:focus={() => { if (openingSuggestions[idx]?.length > 0) openingShowSuggestions[idx] = true; openingShowSuggestions = [...openingShowSuggestions]; }}
                  on:blur={() => setTimeout(() => { openingShowSuggestions[idx] = false; openingShowSuggestions = [...openingShowSuggestions]; }, 200)}
                  placeholder="Attack on Titan"
                  class="form-input"
                  autocomplete="off"
                />
                {#if openingShowSuggestions[idx] && openingSuggestions[idx]?.length > 0}
                  <div class="suggestions-dropdown">
                    {#each openingSuggestions[idx] as suggestion}
                      <button 
                        type="button"
                        class="suggestion-item"
                        on:click={() => selectOpeningSuggestion(idx, suggestion.title)}
                      >
                        <div class="suggestion-title">{suggestion.title}</div>
                        {#if suggestion.titleAlt}
                          <div class="suggestion-alt">{suggestion.titleAlt}</div>
                        {/if}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
            
            <div class="form-group">
              <label>Ссылка YouTube:</label>
              <input 
                type="text" 
                bind:value={slot.youtubeUrl}
                placeholder="https://www.youtube.com/watch?v=..."
                class="form-input"
              />
            </div>
            
            <div class="form-row-compact">
              <div class="form-group-compact">
                <label>Старт (сек):</label>
                <input 
                  type="number" 
                  bind:value={slot.startTime}
                  class="form-input"
                  min="0"
                />
              </div>
              
              <div class="form-group-compact">
                <label>Конец (сек):</label>
                <input 
                  type="number" 
                  bind:value={slot.endTime}
                  class="form-input"
                  min="1"
                />
              </div>
            </div>
          </div>
        {/each}
      </div>
      
      {#if openingPackError}
        <div class="error-message">{openingPackError}</div>
      {/if}
      
      <button 
        class="submit-btn"
        on:click={submitOpeningPack}
        disabled={!canSubmitOpeningPack || openingPackUploading}
      >
        {openingPackUploading ? '⏳ Загрузка...' : '✓ Загрузить пак опенингов'}
      </button>
    </div>

    <!-- === ПРОСМОТР ЗАГРУЖЕННЫХ КАРТИНОК === -->
    <div class="view-section">
      <div class="section-title">📋 Загруженные картинки на {adminUploadDate}</div>
      
      {#if loadingData}
        <div class="loading-text">⏳ Загрузка...</div>
      {:else if uploadedImages.length === 0}
        <div class="empty-text">Нет загруженных картинок на эту дату</div>
      {:else}
        <div class="uploaded-list">
          {#each uploadedImages as img}
            <div class="uploaded-item">
              <div class="item-preview">
                <img src={`${import.meta.env.VITE_API_URL.replace('/api', '')}${img.image_url}`} alt={img.title} />
              </div>
              <div class="item-info">
                <div class="item-title">{img.title}</div>
                {#if img.hint1_image || img.hint2_image}
                  <div class="item-hints">
                    {#if img.hint1_image}
                      <span class="hint-badge">🖼️ Подсказка 1</span>
                    {/if}
                    {#if img.hint2_image}
                      <span class="hint-badge">🖼️ Подсказка 2</span>
                    {/if}
                  </div>
                {/if}
                <div class="item-date">{img.quiz_date || 'Без даты'}</div>
              </div>
              <button class="delete-btn" on:click={() => deleteImage(img.id)}>
                🗑️ Удалить
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- === ПРОСМОТР ЗАГРУЖЕННЫХ ОПЕНИНГОВ === -->
    <div class="view-section">
      <div class="section-title">📋 Загруженные опенинги на {adminUploadDate}</div>
      
      {#if loadingData}
        <div class="loading-text">⏳ Загрузка...</div>
      {:else if uploadedOpenings.length === 0}
        <div class="empty-text">Нет загруженных опенингов на эту дату</div>
      {:else}
        <div class="uploaded-list">
          {#each uploadedOpenings as opening}
            <div class="uploaded-item">
              <div class="item-icon">🎵</div>
              <div class="item-info">
                <div class="item-title">{opening.title}</div>
                <div class="item-url">{opening.youtube_url}</div>
                <div class="item-date">
                  {opening.start_time}s - {opening.end_time}s | {opening.quiz_date || 'Без даты'}
                </div>
              </div>
              <button class="delete-btn" on:click={() => deleteOpening(opening.id)}>
                🗑️ Удалить
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .admin-container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
  }

  .admin-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
  }

  .admin-main-title {
    font-size: clamp(1.5rem, 4vw, 2.5rem);
    font-weight: 900;
    color: var(--accent, #A239CA);
    letter-spacing: 1px;
    text-shadow: 0 0 20px rgba(162, 57, 202, 0.5);
  }

  .back-btn {
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  /* === СЕКЦИИ === */
  .date-section,
  .upload-section {
    background: rgba(162, 57, 202, 0.1);
    border: 1px solid rgba(162, 57, 202, 0.3);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
  }

  .section-title {
    font-size: 1.3rem;
    font-weight: 900;
    color: white;
    margin-bottom: 20px;
    text-transform: uppercase;
  }

  /* === ВЫБОР ДАТЫ === */
  .date-controls {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
  }

  .date-input {
    flex: 1;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font-size: 1rem;
    transition: all 0.3s;
  }

  .date-input:focus {
    outline: none;
    border-color: var(--accent, #A239CA);
    background: rgba(255, 255, 255, 0.08);
  }

  .today-btn {
    padding: 12px 24px;
    background: var(--accent, #A239CA);
    color: white;
    font-weight: 700;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
  }

  .today-btn:hover {
    background: var(--accent2, #8B2FC9);
    transform: translateY(-2px);
  }

  .selected-date {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.95rem;
  }

  .selected-date strong {
    color: var(--accent, #A239CA);
    font-weight: 700;
  }

  /* === ПАК КАРТИНОК === */
  .pack-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 20px;
  }

  .pack-slot {
    background: rgba(0, 0, 0, 0.3);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .slot-number {
    background: var(--accent, #A239CA);
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 1.1rem;
  }

  .file-upload-label {
    cursor: pointer;
    display: block;
  }

  .file-input {
    display: none;
  }

  .file-preview {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    overflow: hidden;
  }

  .file-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .file-placeholder {
    width: 100%;
    aspect-ratio: 16 / 9;
    border: 2px dashed rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transition: all 0.3s;
  }

  .file-placeholder:hover {
    border-color: var(--accent, #A239CA);
    background: rgba(162, 57, 202, 0.1);
  }

  .upload-icon {
    font-size: 2rem;
    margin-bottom: 8px;
  }

  .upload-text {
    color: rgba(255, 255, 255, 0.6);
    font-weight: 600;
    font-size: 0.9rem;
  }

  .title-input {
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font-size: 0.9rem;
    transition: all 0.3s;
  }

  .title-input:focus {
    outline: none;
    border-color: var(--accent, #A239CA);
    background: rgba(255, 255, 255, 0.08);
  }

  .title-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  /* === ПОДСКАЗКИ === */
  .hint-section {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .hint-label {
    font-size: 0.85rem;
    color: var(--muted);
    margin-bottom: 8px;
    font-weight: 600;
  }

  .hint-uploads {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .hint-file-label {
    cursor: pointer;
    display: block;
  }

  .hint-placeholder {
    width: 100%;
    aspect-ratio: 4 / 3;
    border: 1px dashed rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transition: all 0.3s;
    position: relative;
    overflow: hidden;
  }

  .hint-placeholder:hover {
    border-color: var(--accent);
    background: rgba(91, 117, 83, 0.1);
  }

  .hint-preview {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .hint-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hint-number {
    position: absolute;
    top: 4px;
    right: 4px;
    background: var(--accent);
    color: white;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .hint-icon {
    font-size: 1.5rem;
    margin-bottom: 4px;
  }

  .hint-text {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.75rem;
    font-weight: 600;
  }

  /* === ФОРМА ОПЕНИНГА === */
  .openings-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 20px;
  }

  .opening-slot {
    background: rgba(0, 0, 0, 0.15);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 16px;
    transition: all 0.3s ease;
  }

  .opening-slot:hover {
    border-color: var(--accent);
    background: rgba(0, 0, 0, 0.2);
  }

  .slot-header {
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--accent);
    text-transform: uppercase;
    margin-bottom: 16px;
    text-align: center;
    padding-bottom: 12px;
    border-bottom: 2px solid rgba(255, 255, 255, 0.1);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }
  
  .form-group-compact {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  
  .form-row-compact {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .form-group label,
  .form-group-compact label {
    color: var(--text);
    font-weight: 600;
    font-size: 0.9rem;
  }

  .form-input {
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font-size: 1rem;
    transition: all 0.3s;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--accent, #A239CA);
    background: rgba(255, 255, 255, 0.08);
  }

  .form-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  /* === КНОПКИ === */
  .submit-btn {
    width: 100%;
    padding: 16px 24px;
    background: var(--accent, #A239CA);
    color: white;
    font-weight: 900;
    font-size: 1.1rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
    text-transform: uppercase;
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--accent2, #8B2FC9);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(162, 57, 202, 0.5);
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  /* === ПРОСМОТР ЗАГРУЖЕННЫХ === */
  .view-section {
    background: rgba(0, 0, 0, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 24px;
    margin-top: 32px;
  }

  .loading-text {
    text-align: center;
    color: var(--muted);
    padding: 20px;
    font-size: 1.1rem;
  }

  .empty-text {
    text-align: center;
    color: rgba(255, 255, 255, 0.4);
    padding: 20px;
    font-size: 1rem;
  }

  .uploaded-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .uploaded-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    transition: all 0.3s ease;
  }

  .uploaded-item:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--accent);
  }

  .item-preview {
    width: 80px;
    height: 80px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    background: rgba(0, 0, 0, 0.2);
  }

  .item-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .item-icon {
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    flex-shrink: 0;
  }

  .item-info {
    flex: 1;
    min-width: 0;
  }

  .item-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-url {
    font-size: 0.85rem;
    color: var(--muted);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-hints {
    display: flex;
    gap: 6px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }

  .hint-badge {
    font-size: 0.75rem;
    color: var(--accent);
    padding: 3px 8px;
    background: rgba(91, 117, 83, 0.15);
    border-radius: 4px;
    display: inline-block;
    font-weight: 600;
  }

  .item-date {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .delete-btn {
    padding: 10px 20px;
    background: rgba(244, 67, 54, 0.2);
    border: 1px solid rgba(244, 67, 54, 0.4);
    border-radius: 8px;
    color: #f44336;
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .delete-btn:hover {
    background: rgba(244, 67, 54, 0.3);
    border-color: #f44336;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(244, 67, 54, 0.4);
  }

  /* === АВТОДОПОЛНЕНИЕ === */
  .autocomplete-wrapper {
    position: relative;
  }

  .suggestions-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 300px;
    overflow-y: auto;
    background: var(--panelStrong);
    border: 2px solid var(--accent);
    border-radius: 8px;
    margin-top: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    z-index: 100;
  }

  .suggestion-item {
    width: 100%;
    padding: 12px 16px;
    text-align: left;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .suggestion-item:last-child {
    border-bottom: none;
  }

  .suggestion-item:hover {
    background: rgba(91, 117, 83, 0.2);
  }

  .suggestion-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 2px;
  }

  .suggestion-alt {
    font-size: 0.85rem;
    color: var(--muted);
  }

  .error-message {
    color: #f44336;
    font-weight: 600;
    padding: 12px;
    background: rgba(244, 67, 54, 0.1);
    border: 1px solid rgba(244, 67, 54, 0.3);
    border-radius: 8px;
  }

  /* === АДАПТИВНОСТЬ === */
  @media (max-width: 768px) {
    .admin-container {
      padding: 16px;
    }

    .admin-header {
      flex-direction: column;
      gap: 16px;
      align-items: flex-start;
    }

    .pack-grid {
      grid-template-columns: 1fr;
    }

    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>

