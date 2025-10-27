<script>
  import { currentUser } from '../stores/authApi';
  import { adminImages, addUserSource, userSources, enabledSourceIds, playbackSourceId, setPlaybackSource } from '../stores/sources';
  import { goHome } from '../stores/ui';
  let customImageAnimeId = '';
  let customImageUrl = '';
  let searchQuery = '';
  let searchResults = [];
  // user sources form
  let srcId = '';
  let srcName = '';
  let srcSearch = '';
  let srcGetById = '';
  let srcGetStreams = '';
  let srcScript = '';

  async function searchTitles() {
    const q = (searchQuery || '').trim();
    if (!q) { searchResults = []; return; }
    try {
      const res = await fetch(`https://shikimori.one/api/animes?search=${encodeURIComponent(q)}&limit=10&order=popularity`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      searchResults = Array.isArray(data) ? data : [];
    } catch (_) {
      searchResults = [];
    }
  }

  function save() {
    if (!customImageAnimeId || !customImageUrl) return;
    adminImages.set({ ...$adminImages, [customImageAnimeId]: customImageUrl });
    customImageAnimeId = '';
    customImageUrl = '';
  }

  function remove(id) {
    const map = { ...$adminImages };
    delete map[id];
    adminImages.set(map);
  }

  async function addSource() {
    try {
      const hasScript = (srcScript || '').trim().length > 0;
      let id = (srcId || '').trim();
      let name = (srcName || '').trim();
      if (hasScript) {
        if (!id) id = `user-${Date.now()}`;
        if (!name) name = 'Custom Source';
      }
      if (!id || !name) {
        alert('Введите ID и Название (или вставьте JS и мы подставим значения по умолчанию)');
        return;
      }

      let spec;
      if (hasScript) {
        spec = { id, name, script: srcScript.trim() };
      } else {
        const search = (srcSearch || '').trim();
        if (!search) { alert('Укажите хотя бы endpoint поиска (GET search) или вставьте JS скрипт'); return; }
        spec = { id, name, endpoints: { search, getById: (srcGetById||'').trim(), getStreams: (srcGetStreams||'').trim() } };
      }
      addUserSource(spec);
      alert(`Источник "${name}" добавлен и включён`);
      srcId = srcName = srcSearch = srcGetById = srcGetStreams = srcScript = '';
    } catch (err) {
      alert('Ошибка добавления источника: ' + (err?.message || 'неизвестно'));
    }
  }

  // File import (.json)
  async function onImportSource(e) {
    const input = e.currentTarget; // сохранить ссылку до await
    try {
      const file = input?.files?.[0];
      if (!file) return;
      const text = await file.text();
      const spec = JSON.parse(text);
      if (!spec?.id || !spec?.name) throw new Error('Некорректный формат источника');
      addUserSource(spec);
    } catch (err) {
      alert('Не удалось импортировать источник: ' + (err?.message || 'ошибка'));
    } finally {
      try { if (input) input.value = ''; } catch (_) {}
    }
  }

  function deleteUserSource(id) {
    if (!confirm(`Удалить источник "${id}"?`)) return;
    try {
      let list; userSources.subscribe((v) => (list = v))();
      const next = (list || []).filter((s) => s.id !== id);
      userSources.set(next);
      // persist
      try { localStorage.setItem('sources:user', JSON.stringify(next)); } catch (_) {}
      // disable in enabled list
      let ids; enabledSourceIds.subscribe((v) => (ids = v))();
      const set = new Set(ids || []); set.delete(id); enabledSourceIds.set([...set]);
      // reset playback if it referenced this source
      let cur; playbackSourceId.subscribe((v) => (cur = v))();
      if (cur === id) setPlaybackSource(null);
      // Для гарантии убрать из реестра — проще перезагрузить окно
      setTimeout(() => location.reload(), 50);
    } catch (_) {}
  }

  function clearAllUserSources() {
    if (!confirm('Удалить ВСЕ пользовательские источники и сбросить источник плеера?')) return;
    try {
      userSources.set([]);
      enabledSourceIds.set(['shikimori']);
      setPlaybackSource(null);
      try {
        localStorage.removeItem('sources:user');
        localStorage.removeItem('sources:playback');
      } catch (_) {}
    } catch (_) {}
    // перезапустить, чтобы реестр источников перечитался из localStorage
    setTimeout(() => location.reload(), 50);
  }
</script>

{#if !$currentUser?.isAdmin}
  <div class="mt-4 text-white/80">Нет доступа. <button class="underline" on:click={goHome}>На главную</button></div>
{:else}
  <div class="mt-4">
    <h1 class="text-2xl font-bold text-white mb-4">Админ‑панель</h1>
    <div class="bg-pink-900/50 rounded-xl p-4 glass-frame flex flex-col gap-3">
      <div class="flex gap-2 items-center">
        <input class="flex-1 px-3 py-2 rounded border border-white/30 bg-white/80 text-black" placeholder="Поиск по названию" bind:value={searchQuery} on:keydown={(e)=>{ if(e.key==='Enter') searchTitles(); }} />
        <button class="bg-pink-600 text-white rounded px-3 py-2 font-semibold" on:click={searchTitles}>Найти</button>
      </div>
      {#if searchResults.length}
        <div class="grid grid-cols-2 gap-2 max-h-64 overflow-auto">
          {#each searchResults as it}
            <div class="bg-white/10 rounded p-2 cursor-pointer hover:bg-white/20" on:click={() => { customImageAnimeId = it.id; }}>
              <div class="text-white/90 text-sm">{it.russian || it.name} <span class="text-white/60">(ID: {it.id})</span></div>
            </div>
          {/each}
        </div>
      {/if}
      <div class="text-white/90">Добавить/изменить обложку</div>
      <div class="flex gap-2 items-center">
        <input class="px-3 py-2 rounded border border-white/30 bg-white/80 text-black w-40" placeholder="ID аниме" bind:value={customImageAnimeId} />
        <input class="flex-1 px-3 py-2 rounded border border-white/30 bg-white/80 text-black" placeholder="URL изображения" bind:value={customImageUrl} />
        <button class="bg-pink-600 text-white rounded px-3 py-2 font-semibold" on:click={save}>Сохранить</button>
      </div>
    </div>

    <div class="mt-4 bg-pink-900/50 rounded-xl p-4 glass-frame">
      <div class="text-white/90 mb-2">Текущие переопределения</div>
      {#if Object.keys($adminImages || {}).length}
        <div class="grid grid-cols-3 gap-3">
          {#each Object.entries($adminImages) as [id, url]}
            <div class="bg-white/10 rounded-xl p-2">
              <div class="text-white/80 text-sm mb-2">ID: {id}</div>
              <img src={url} alt={id} class="w-full h-40 object-cover rounded" />
              <button class="mt-2 bg-white/90 text-pink-700 rounded px-3 py-1 text-sm font-semibold hover:bg-white" on:click={() => remove(id)}>Удалить</button>
            </div>
          {/each}
        </div>
      {:else}
        <div class="text-white/60">Нет записей</div>
      {/if}
    </div>

    <div class="mt-6 bg-pink-900/50 rounded-xl p-4 glass-frame">
      <div class="text-white/90 mb-2">Пользовательские источники</div>
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <input class="w-full px-3 py-2 rounded border border-white/30 bg-white/80 text-black" placeholder="ID" bind:value={srcId} />
          <input class="w-full px-3 py-2 rounded border border-white/30 bg-white/80 text-black" placeholder="Название" bind:value={srcName} />
          <input class="w-full px-3 py-2 rounded border border-white/30 bg-white/80 text-black" placeholder="GET search: https://api.example.com?q=&#123;q&#125;" bind:value={srcSearch} />
          <input class="w-full px-3 py-2 rounded border border-white/30 bg-white/80 text-black" placeholder="GET byId: https://api.example.com/&#123;id&#125;" bind:value={srcGetById} />
          <input class="w-full px-3 py-2 rounded border border-white/30 bg-white/80 text-black" placeholder="GET streams: https://api.example.com/&#123;id&#125;/streams" bind:value={srcGetStreams} />
          <div class="text-white/80 text-xs">Или оставьте поля пустыми и вставьте JS ниже. Должны быть объявлены async функции: search(query, opts), getById(id), getStreams(id)</div>
          <textarea rows="6" class="w-full px-3 py-2 rounded border border-white/30 bg-white/80 text-black" bind:value={srcScript} placeholder="Вставьте JS: search/getById/getStreams"></textarea>
          <div class="flex items-center gap-3">
            <button class="bg-pink-600 text-white rounded px-3 py-2 font-semibold" on:click={addSource}>Добавить источник</button>
            <label class="bg-white/20 text-white rounded px-3 py-2 font-semibold cursor-pointer">
              Импорт .json
              <input type="file" accept="application/json" class="hidden" on:change={onImportSource} />
            </label>
            <button class="bg-white/10 hover:bg-white/20 text-white rounded px-3 py-2 font-semibold" on:click={clearAllUserSources}>Удалить все</button>
          </div>
        </div>
        <div class="space-y-2">
          <div class="text-white/80">Включённые источники (для поиска):</div>
          {#each $userSources as s}
            <label class="flex items-center gap-2 text-white/80">
              <input type="checkbox" checked={($enabledSourceIds || []).includes(s.id)} on:change={(e) => {
                const checked = e.currentTarget.checked;
                let ids; enabledSourceIds.subscribe((v) => (ids = v))();
                const set = new Set(ids || []);
                if (checked) set.add(s.id); else set.delete(s.id);
                enabledSourceIds.set([...set]);
              }} />
              <span class="flex-1">{s.name} ({s.id})</span>
              <button class="ml-2 text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20" on:click={() => deleteUserSource(s.id)}>Удалить</button>
            </label>
          {/each}
          <div class="text-white/80 mt-4">Источник для плеера (используется только для «Смотреть»):</div>
          <select class="w-full px-3 py-2 rounded border border-white/30 bg-white/80 text-black" bind:value={$playbackSourceId} on:change={(e)=> setPlaybackSource(e.currentTarget.value)}>
            <option value="">— не выбран —</option>
            {#each $userSources as s}
              <option value={s.id}>{s.name} ({s.id})</option>
            {/each}
          </select>
        </div>
      </div>
    </div>
  </div>
{/if}


