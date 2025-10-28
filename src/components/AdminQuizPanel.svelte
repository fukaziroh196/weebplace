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
  let packSlots = Array.from({ length: 4 }, () => ({ file: null, title: '', uploading: false }));
  let packUploading = false;
  let packUploadError = '';

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
      
      // Очистить форму
      packSlots = Array.from({ length: 4 }, () => ({ file: null, title: '', uploading: false }));
      
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

  // === Загрузка опенинга ===
  let newOpening = {
    title: '',
    youtubeUrl: '',
    startTime: 0,
    endTime: 20
  };
  let openingUploading = false;
  let openingUploadError = '';

  async function submitOpening() {
    openingUploadError = '';
    
    if (!adminUploadDate) {
      openingUploadError = 'Выберите дату сета';
      return;
    }
    
    if (!newOpening.title.trim()) {
      openingUploadError = 'Введите название аниме';
      return;
    }
    
    if (!newOpening.youtubeUrl.trim()) {
      openingUploadError = 'Введите ссылку на YouTube';
      return;
    }

    try {
      openingUploading = true;
      console.log(`[submitOpening] Starting upload for ${adminUploadDate}`);
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/openings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('api_token')}`
        },
        body: JSON.stringify({
          quizDate: adminUploadDate,
          title: newOpening.title.trim(),
          youtubeUrl: newOpening.youtubeUrl.trim(),
          startTime: newOpening.startTime || 0,
          endTime: newOpening.endTime || 20
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('[submitOpening] Success:', result);
      
      // Очистить форму
      newOpening = { title: '', youtubeUrl: '', startTime: 0, endTime: 20 };
      
      alert(`✓ Опенинг успешно добавлен на дату ${adminUploadDate}!`);
    } catch (e) {
      console.error('[submitOpening] Error:', e);
      openingUploadError = `Ошибка загрузки: ${e?.message || 'Network error'}`;
      alert(openingUploadError);
    } finally {
      openingUploading = false;
    }
  }

  // === Вспомогательные функции ===
  function setDateToToday() {
    adminUploadDate = new Date().toISOString().split('T')[0];
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
            
            <input 
              type="text" 
              bind:value={slot.title}
              placeholder="Название аниме"
              class="title-input"
            />
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

    <!-- === ЗАГРУЗКА ОПЕНИНГА === -->
    <div class="upload-section">
      <div class="section-title">🎵 Загрузка опенинга</div>
      
      <div class="opening-form">
        <div class="form-group">
          <label>Название аниме (правильный ответ):</label>
          <input 
            type="text" 
            bind:value={newOpening.title}
            placeholder="Например: Attack on Titan"
            class="form-input"
          />
        </div>
        
        <div class="form-group">
          <label>Ссылка на YouTube:</label>
          <input 
            type="text" 
            bind:value={newOpening.youtubeUrl}
            placeholder="https://www.youtube.com/watch?v=..."
            class="form-input"
          />
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Начало (сек):</label>
            <input 
              type="number" 
              bind:value={newOpening.startTime}
              class="form-input"
              min="0"
            />
          </div>
          
          <div class="form-group">
            <label>Конец (сек):</label>
            <input 
              type="number" 
              bind:value={newOpening.endTime}
              class="form-input"
              min="1"
            />
          </div>
        </div>
        
        {#if openingUploadError}
          <div class="error-message">{openingUploadError}</div>
        {/if}
        
        <button 
          class="submit-btn"
          on:click={submitOpening}
          disabled={!newOpening.title.trim() || !newOpening.youtubeUrl.trim() || openingUploading}
        >
          {openingUploading ? '⏳ Загрузка...' : '✓ Загрузить опенинг'}
        </button>
      </div>
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

  /* === ФОРМА ОПЕНИНГА === */
  .opening-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .form-group label {
    color: rgba(255, 255, 255, 0.8);
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

