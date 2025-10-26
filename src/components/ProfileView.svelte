<script>
  import { currentUser, watched, favorites, comments, login, register, addComment, removeFromFavorites, promoteToAdmin, setCurrentUserAvatar, clearCurrentUserAvatar, users, friends, friendRequestsIncoming, friendRequestsOutgoing } from '../stores/auth';
  import { sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend, refreshFriendState } from '../stores/auth';
  import AvatarCropper from './AvatarCropper.svelte';
  let mode = 'login';
  let username = '';
  let password = '';
  let error = '';
  let commentText = '';
  let adminSecret = '';
  let adminError = '';
  let showCropper = false;
  let tempImage = '';

  async function submit() {
    error = '';
    try {
      if (mode === 'login') await login(username, password);
      else await register(username, password);
      username = '';
      password = '';
    } catch (e) {
      error = e?.message || 'Ошибка';
    }
  }

  function postComment() {
    if ((commentText || '').trim()) {
      addComment(commentText.trim());
      commentText = '';
    }
  }

</script>

{#if !$currentUser}
  <div class="mt-4">
    <h1 class="text-2xl font-bold text-white mb-4">Профиль</h1>
    <div class="bg-pink-900/50 rounded-xl p-4 glass-frame">
      <div class="flex gap-3 mb-3">
        <button class="px-3 py-1 rounded-full text-sm font-medium {mode === 'login' ? 'bg-pink-600 text-white' : 'bg-white/20 text-white'}" on:click={() => mode = 'login'}>Войти</button>
        <button class="px-3 py-1 rounded-full text-sm font-medium {mode === 'register' ? 'bg-pink-600 text-white' : 'bg-white/20 text-white'}" on:click={() => mode = 'register'}>Регистрация</button>
      </div>
      <div class="grid grid-cols-2 gap-3 max-w-[480px]">
        <input class="px-3 py-2 rounded border border-white/30 bg-white/80 text-black" placeholder="Имя" bind:value={username} />
        <input class="px-3 py-2 rounded border border-white/30 bg-white/80 text-black" type="password" placeholder="Пароль" bind:value={password} />
      </div>
      {#if error}
        <div class="text-red-300 text-sm mt-2">{error}</div>
      {/if}
      <button class="mt-3 bg-pink-600 text-white rounded px-4 py-2 font-semibold" on:click={submit}>{mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</button>
    </div>
  </div>
{:else}
  <div class="mt-4">
    <div class="flex items-start gap-6 mb-4">
      <div class="relative group w-[250px] h-[250px]">
        {#if $currentUser.avatarUrl}
          <img src={$currentUser.avatarUrl} alt="avatar" class="w-[250px] h-[250px] object-cover" />
        {:else}
          <div class="w-[250px] h-[250px] bg-pink-700 flex items-center justify-center text-white text-7xl font-bold">{$currentUser.username[0]?.toUpperCase() || 'U'}</div>
        {/if}
        <div class="absolute left-0 right-0 bottom-0 p-2 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <label class="bg-white/90 text-pink-700 rounded px-3 py-1 text-sm font-semibold hover:bg-white cursor-pointer">
            Загрузить
            <input type="file" accept="image/*" class="hidden" on:change={(e) => {
              const file = e.currentTarget.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => { tempImage = String(reader.result); showCropper = true; };
              reader.readAsDataURL(file);
            }} />
          </label>
          {#if $currentUser.avatarUrl}
            <button class="bg-white/90 text-pink-700 rounded px-3 py-1 text-sm font-semibold hover:bg-white" on:click={clearCurrentUserAvatar}>Удалить</button>
          {/if}
        </div>
      </div>
      <div>
        <div class="text-3xl font-bold text-white">{$currentUser.username}</div>
        <div class="text-white/70 text-sm">С нами с {new Date($currentUser.createdAt).toLocaleDateString()}</div>
      </div>
    </div>

    {#if showCropper}
      <AvatarCropper src={tempImage} onCancel={() => { showCropper = false; tempImage = ''; }} onApply={(url) => { setCurrentUserAvatar(url); showCropper = false; tempImage = ''; }} />
    {/if}

    <div class="grid grid-cols-2 gap-6">
      <div>
        <h2 class="text-white font-semibold mb-2">Друзья</h2>
        <div class="bg-pink-900/50 rounded-xl p-3 glass-frame space-y-2">
          {#if $friends.length}
            {#each $friends as fid}
              <div class="flex items-center justify-between bg-white/10 rounded px-3 py-2">
                <div class="text-white">{@html ($users.find(u=>u.id===fid)?.username || fid)}</div>
                <button class="text-white/90 hover:text-white" on:click={() => removeFriend(fid)}>Удалить</button>
              </div>
            {/each}
          {:else}
            <div class="text-white/70">Пока нет друзей</div>
          {/if}
        </div>
        <!-- Блок заявок в друзья перенесён в меню сообщений -->
      </div>
      <div>
        <h2 class="text-white font-semibold mb-2">Просмотренное</h2>
        {#if $watched.length}
          <div class="grid grid-cols-3 gap-3">
            {#each $watched as it}
              <div class="bg-pink-900/50 rounded-xl h-32 overflow-hidden relative">
                {#if it.image}
                  <img src={it.image} alt={it.title} class="absolute inset-0 w-full h-full object-cover opacity-90" loading="lazy" />
                {/if}
                <div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-white text-xs">{it.title}</div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="text-white/70">Пока пусто</div>
        {/if}
      </div>

      <div>
        <h2 class="text-white font-semibold mb-2">Избранное</h2>
        {#if $favorites.length}
          <div class="grid grid-cols-3 gap-3">
            {#each $favorites as it}
              <div class="bg-pink-900/50 rounded-xl h-32 overflow-hidden relative cursor-pointer"
                   on:click={() => window.open(it.url || '#', '_blank')}>
                {#if it.image}
                  <img src={it.image} alt={it.title} class="absolute inset-0 w-full h-full object-cover opacity-80" />
                {/if}
                <button class="absolute top-1 right-1 bg-white/90 text-pink-700 rounded-full w-6 h-6 text-xs flex items-center justify-center hover:bg-white"
                        title="Удалить из избранного"
                        on:click|stopPropagation={() => removeFromFavorites(it.id)}>×</button>
                <div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-white text-xs">{it.title}</div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="text-white/70">Пока пусто</div>
        {/if}
      </div>
    </div>

    <div class="mt-6">
      <h2 class="text-white font-semibold mb-2">Комментарии</h2>
      <div class="bg-pink-900/50 rounded-xl p-3 glass-frame">
        <div class="flex gap-2 mb-3">
          <input class="flex-1 px-3 py-2 rounded border border-white/30 bg-white/80 text-black" placeholder="Оставьте комментарий" bind:value={commentText} />
          <button class="bg-pink-600 text-white rounded px-3 py-2 font-semibold" on:click={postComment}>Отправить</button>
        </div>
        {#if $comments.length}
          <div class="flex flex-col gap-2 max-h-[220px] overflow-auto pr-2 scrollable scrollable--active">
            {#each $comments as c}
              <div class="bg-white/10 rounded px-3 py-2 text-white/90 text-sm">
                <div class="text-white font-medium text-xs mb-1">{new Date(c.createdAt).toLocaleString()}</div>
                {c.text}
              </div>
            {/each}
          </div>
        {:else}
          <div class="text-white/70">Комментариев пока нет</div>
        {/if}
      </div>
    </div>
  </div>

  {#if !$currentUser?.isAdmin}
    <div class="mt-6">
      <div class="bg-pink-900/40 rounded-xl p-3 glass-frame">
        <div class="text-white/80 mb-2">Хотите права администратора (для установки обложек)?</div>
        <div class="flex gap-2 items-center">
          <input class="px-3 py-2 rounded border border-white/30 bg-white/80 text-black w-56" placeholder="Секрет администратора" bind:value={adminSecret} />
          <button class="bg-pink-600 text-white rounded px-3 py-2 font-semibold" on:click={() => { try { promoteToAdmin(adminSecret); adminError=''; } catch(e){ adminError = e?.message || 'Ошибка'; } }}>Получить доступ</button>
          {#if adminError}
            <span class="text-red-300 text-sm">{adminError}</span>
          {/if}
        </div>
      </div>
    </div>
  {/if}
{/if}


