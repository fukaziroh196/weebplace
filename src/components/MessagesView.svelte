<script>
  import { onMount } from 'svelte';
  import { users, currentUser, friends, friendRequestsOutgoing, sendFriendRequest, refreshFriendState } from '../stores/auth';
  import { conversations, allMessages, sendMessage, markConversationRead } from '../stores/messages';

  let selectedUserId = null;
  let messageText = '';
  let leftTab = 'chats'; // 'chats' | 'friends'
  let friendSearch = '';

  // Refresh library snapshot when opening Friends tab or returning focus
  onMount(() => {
    const onFocus = () => { try { refreshFriendState(); } catch(_) {} };
    try { window.addEventListener('focus', onFocus); } catch(_) {}
    return () => { try { window.removeEventListener('focus', onFocus); } catch(_) {} };
  });
  $: if (leftTab === 'friends') { try { refreshFriendState(); } catch(_) {} }

  function openConversation(userId) {
    selectedUserId = userId;
    markConversationRead(userId);
    setTimeout(() => {
      const el = document.querySelector('#messages-scroll');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  function submit() {
    const text = (messageText || '').trim();
    if (!text || !selectedUserId) return;
    // only friends can message
    if (!($friends || []).includes(selectedUserId)) {
      alert('Можно писать только друзьям');
      return;
    }
    sendMessage(selectedUserId, text);
    messageText = '';
    setTimeout(() => {
      const el = document.querySelector('#messages-scroll');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  $: msgs = ($currentUser ? ($allMessages || []).filter((m) => (m.fromId === $currentUser?.id && m.toId === selectedUserId) || (m.toId === $currentUser?.id && m.fromId === selectedUserId)).sort((a,b)=>a.createdAt-b.createdAt) : []);

  function avatarFor(userId) {
    const u = ($users || []).find((x) => x.id === userId);
    return u?.avatarUrl || '';
  }
</script>

<div class="mt-2 grid grid-cols-[260px_1fr] gap-4 h-[520px]">
  <div class="rounded-xl p-2 glass-frame overflow-auto">
    <div class="flex items-center gap-2 px-2 py-1">
      <button class="btn-kristal-ghost px-2 py-1 rounded-full text-sm font-medium" on:click={() => leftTab = 'chats'}>Диалоги</button>
      <button class="btn-kristal-ghost px-2 py-1 rounded-full text-sm font-medium" on:click={() => leftTab = 'friends'}>Друзья</button>
    </div>
    {#if $currentUser}
      {#if leftTab === 'friends'}
        <!-- Friends tab with search -->
        <div class="px-2 py-1">
          <input class="input-kristal w-full rounded px-2 py-1" placeholder="Поиск по нику..." bind:value={friendSearch} />
        </div>
        {#if (friendSearch || '').trim().length > 0}
          <div class="text-white/70 text-sm px-2 py-1">Результаты</div>
          {#each $users.filter(u => u.id !== $currentUser?.id && String(u.username||'').toLowerCase().includes(friendSearch.trim().toLowerCase())) as u (u.id)}
            <div class="menu-item flex items-center justify-between gap-2 px-2">
              <div class="text-white truncate">{u.username}</div>
              <button class="btn-kristal-ghost px-2 py-1 rounded disabled:opacity-50"
                      disabled={($friends || []).includes(u.id) || ($friendRequestsOutgoing || []).some(r=>r.toId===u.id)}
                      on:click={() => { try { sendFriendRequest(u.id); refreshFriendState(); } catch(_){} }}>
                {#if ($friends || []).includes(u.id)}В друзьях
                {:else if ($friendRequestsOutgoing || []).some(r=>r.toId===u.id)}Запрос отправлен
                {:else}Добавить{/if}
              </button>
            </div>
          {/each}
          <div class="menu-divider my-2"></div>
        {/if}
        <!-- Friends list -->
        {#if $friends.length}
          {#each $friends as fid}
            <div class="menu-item flex items-center gap-2 cursor-pointer" on:click={() => openConversation(fid)}>
              <div class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">{($users.find(u=>u.id===fid)?.username || 'U')[0]?.toUpperCase() || 'U'}</div>
              <div class="text-white truncate">{$users.find(u=>u.id===fid)?.username || fid}</div>
            </div>
          {/each}
        {:else}
          <div class="px-2 py-2 text-white/70">Пока нет друзей</div>
        {/if}
      {:else}
        <!-- Conversations list tab -->
        {#each $conversations as c}
          <div class="menu-item flex items-center gap-2 cursor-pointer" on:click={() => openConversation(c.userId)}>
            <div class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">{c.username?.[0]?.toUpperCase() || 'U'}</div>
            <div class="flex-1 min-w-0">
              <div class="text-white truncate">{c.username}</div>
              {#if c.lastMessage?.text}
                <div class="text-white/60 text-xs truncate">{c.lastMessage.text}</div>
              {/if}
            </div>
            {#if c.unread > 0}
              <span class="text-xs bg-pink-700 text-white rounded-full px-2 py-0.5">{c.unread}</span>
            {/if}
          </div>
        {/each}
      {/if}
    {:else}
      <div class="px-2 py-2 text-white/70">Войдите, чтобы видеть диалоги</div>
    {/if}
  </div>

  <div class="rounded-xl p-3 glass-frame flex flex-col overflow-hidden">
    {#if $currentUser && selectedUserId}
      <div id="messages-scroll" class="flex-1 overflow-auto space-y-2 pr-2">
        {#each msgs as m}
          <div class="flex items-end {m.fromId === $currentUser?.id ? 'justify-end' : 'justify-start'} gap-2">
            {#if m.fromId !== $currentUser?.id}
              <div class="w-7 h-7 rounded-full overflow-hidden bg-white/10 text-white flex items-center justify-center">
                {#if avatarFor(m.fromId)}
                  <img src={avatarFor(m.fromId)} alt="" class="w-full h-full object-cover" />
                {:else}
                  {(($users.find(u=>u.id===m.fromId)?.username || 'U')[0] || 'U').toUpperCase()}
                {/if}
              </div>
            {/if}
            <div class="max-w-[70%] px-3 py-2 rounded-xl text-sm"
                 style="background: {m.fromId === $currentUser?.id ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)'}; color: {m.fromId === $currentUser?.id ? '#8e2a8e' : '#fff'};">
              <div>{m.text}</div>
              <div class="text-[10px] opacity-70 mt-1">{new Date(m.createdAt).toLocaleString()}</div>
            </div>
            {#if m.fromId === $currentUser?.id}
              <div class="w-7 h-7 rounded-full overflow-hidden bg-white/10 text-[#8e2a8e] flex items-center justify-center">
                {#if avatarFor($currentUser?.id)}
                  <img src={avatarFor($currentUser?.id)} alt="" class="w-full h-full object-cover" />
                {:else}
                  {($currentUser?.username?.[0] || 'U').toUpperCase()}
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
      <div class="mt-2 flex gap-2">
        <input class="flex-1 rounded-full px-3 py-2 bg-white/10 text-white border border-white/25" bind:value={messageText} placeholder={($friends || []).includes(selectedUserId) ? 'Сообщение...' : 'Добавьте в друзья, чтобы написать'} disabled={!($friends || []).includes(selectedUserId)} on:keydown={(e)=>{ if(e.key==='Enter') submit(); }} />
        <button class="btn-kristal px-4 py-2 rounded-full disabled:opacity-50" disabled={!($friends || []).includes(selectedUserId)} on:click={submit}>Отправить</button>
      </div>
    {:else}
      <div class="text-white/70">{ $currentUser ? 'Выберите диалог слева' : 'Войдите, чтобы отправлять сообщения' }</div>
    {/if}
  </div>
</div>


