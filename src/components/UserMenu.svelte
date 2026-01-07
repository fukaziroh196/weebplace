<script>
  import { currentUser, login, register, logout } from '../stores/authApi';
  import { goToProfile, goToAdmin, goToMessages, goToAchievements } from '../stores/ui';
  import { clickOutside } from '../lib/clickOutside';
  import { unreadTotal } from '../stores/messages';

  let showMenu = false;
  let mode = 'login'; // 'login' | 'register'
  let username = '';
  let password = '';
  let error = '';

  async function submit() {
    error = '';
    try {
      if (mode === 'login') await login(username, password);
      else await register(username, password);
      showMenu = false;
      username = '';
      password = '';
    } catch (e) {
      error = e?.message || 'Ошибка';
    }
  }

  function getAvatarGradient(name) {
    const colors = [
      ['#ff6b6b', '#ee5a24'],
      ['#74b9ff', '#0984e3'],
      ['#55efc4', '#00b894'],
      ['#fd79a8', '#e84393'],
      ['#a29bfe', '#6c5ce7'],
      ['#ffeaa7', '#fdcb6e'],
      ['#81ecec', '#00cec9'],
      ['#fab1a0', '#e17055'],
    ];
    const index = (name?.charCodeAt(0) || 0) % colors.length;
    return `linear-gradient(135deg, ${colors[index][0]} 0%, ${colors[index][1]} 100%)`;
  }


</script>

<div class="relative" use:clickOutside={{ enabled: true, callback: () => { showMenu = false; } }}>
  {#if $currentUser}
    <button class="user-menu-button flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white cursor-pointer transition-all select-none backdrop-blur-sm relative"
            on:click={() => { showMenu = !showMenu; }}>
      <div class="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0" style="background: {$currentUser?.avatarUrl ? 'transparent' : getAvatarGradient($currentUser.username)}">
        {#if $currentUser?.avatarUrl}
          <img src={$currentUser.avatarUrl} alt="avatar" class="block w-full h-full object-cover" />
        {:else}
          <span class="text-white font-semibold text-base">{$currentUser.username?.[0]?.toUpperCase() || 'U'}</span>
        {/if}
      </div>
      <span class="font-medium text-base whitespace-nowrap">{$currentUser.username}</span>
      {#if $unreadTotal > 0}
        <span class="absolute -top-1 -right-1 bg-pink-600 text-white text-xs rounded-full px-1.5 py-0.5">{$unreadTotal}</span>
      {/if}
    </button>
  {:else}
    <div class="w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-colors select-none overflow-hidden avatar-frame bg-pink-700 hover:bg-pink-600"
         on:click={() => { showMenu = !showMenu; }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    </div>
  {/if}

  {#if showMenu}
    <div class="absolute right-0 mt-2 rounded-xl overflow-hidden z-30 min-w-[220px] menu-surface p-2">
      {#if $currentUser}
        <div class="menu-header pb-2 mb-2 border-b border-white/10">
          <div class="flex items-center gap-3 px-2">
            <div class="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0" style={$currentUser?.avatarUrl ? '' : `background: ${getAvatarGradient($currentUser.username)}`}>
              {#if $currentUser?.avatarUrl}
                <img src={$currentUser.avatarUrl} alt="avatar" class="block w-full h-full object-cover" />
              {:else}
                <span class="text-white font-semibold text-lg">{$currentUser.username?.[0]?.toUpperCase() || 'U'}</span>
              {/if}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-white font-semibold text-sm truncate">{$currentUser.username}</div>
              <div class="text-white/60 text-xs truncate">otakuz.fun</div>
            </div>
          </div>
        </div>
      {/if}
      <button class="w-full text-left menu-item" on:click={() => { goToProfile(); showMenu = false; }}>Профиль</button>
      {#if $currentUser}
        <button class="w-full text-left menu-item" on:click={() => { goToMessages(); showMenu = false; }}>Сообщения</button>
      {/if}
      {#if $currentUser?.isAdmin}
        <button class="w-full text-left menu-item" on:click={() => { goToAdmin(); showMenu = false; }}>Админ‑панель</button>
      {/if}
      <button class="w-full text-left menu-item" on:click={() => { goToAchievements(); showMenu = false; }}>Достижения</button>
      <button class="w-full text-left menu-item">Настройки</button>
      <button class="w-full text-left menu-item">Отчёт</button>
      <div class="menu-divider my-1"></div>
      {#if $currentUser}
        <button class="w-full text-left menu-item" on:click={() => { logout(); showMenu = false; }}>Выйти</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Квадратная кнопка со скругленными углами */
  .user-menu-button {
    border-radius: 0.75rem !important;
  }

  /* Мобильные устройства - квадратная кнопка, только аватар */
  @media (max-width: 768px) {
    .user-menu-button {
      padding: 0.5rem !important;
      gap: 0 !important;
      min-width: 2.75rem;
      width: 2.75rem;
      height: 2.75rem;
      justify-content: center;
    }

    .user-menu-button > span:not(.absolute) {
      display: none !important;
    }

    .user-menu-button > div {
      width: 2rem !important;
      height: 2rem !important;
    }
  }
</style>

