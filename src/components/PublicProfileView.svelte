<script>
  import { onMount } from 'svelte';
  import { publicProfileUserId, goToProfile } from '../stores/ui';
  import { publicUser, publicUserLoading, publicUserError, loadPublicUser, clearPublicUser } from '../stores/users';
  import { currentUser } from '../stores/authApi';
  import { sendFriendRequest, removeFriend, friends } from '../stores/authApi';

  let lastId = null;

  $: targetId = $publicProfileUserId;
  $: if (targetId && targetId !== lastId) {
    lastId = targetId;
    loadPublicUser(targetId);
  }

  onMount(() => {
    if (targetId) loadPublicUser(targetId);
    return () => clearPublicUser();
  });

  async function handleAddFriend() {
    if (!$publicUser?.username) return;
    try {
      await sendFriendRequest($publicUser.username);
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Не удалось отправить заявку');
    }
  }

  async function handleRemoveFriend() {
    if (!$publicUser?.id) return;
    try {
      await removeFriend($publicUser.id);
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Не удалось удалить из друзей');
    }
  }

  $: isMe = $currentUser?.id && $publicUser?.id && $currentUser.id === $publicUser.id;
  $: alreadyFriend = ($friends || []).includes($publicUser?.id);
</script>

<div class="public-profile-page">
  <div class="public-profile-header">
    <button class="back-btn" on:click={() => goToProfile()}>← Назад</button>
    <div class="title-wrap">
      <div class="title">Профиль пользователя</div>
      {#if $publicUser?.username}
        <div class="subtitle">@{$publicUser.username}</div>
      {/if}
    </div>
  </div>

  {#if $publicUserLoading}
    <div class="card">Загрузка…</div>
  {:else if $publicUserError}
    <div class="card error">{$publicUserError}</div>
  {:else if !$publicUser}
    <div class="card empty">Выберите пользователя из списка друзей или поиска.</div>
  {:else}
    <div class="card profile-card">
      <div class="avatar">
        {#if $publicUser.avatarUrl}
          <img src={$publicUser.avatarUrl} alt="avatar" />
        {:else}
          <div class="placeholder">{($publicUser.username?.[0] || 'U').toUpperCase()}</div>
        {/if}
      </div>
      <div class="info">
        <div class="name">{$publicUser.username}</div>
        <div class="meta">На сайте с {new Date($publicUser.createdAt).toLocaleDateString('ru-RU')}</div>
        {#if $publicUser.isAdmin}
          <div class="badge">Admin</div>
        {/if}
        {#if !isMe}
          <div class="actions">
            {#if alreadyFriend}
              <button class="outline" on:click={handleRemoveFriend}>Удалить из друзей</button>
            {:else}
              <button class="primary" on:click={handleAddFriend}>Добавить в друзья</button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .public-profile-page {
    padding: 1rem clamp(1rem, 3vw, 2rem);
    color: var(--text-primary, #f5f6ff);
  }
  .public-profile-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .back-btn {
    border: 1px solid var(--divider-color, rgba(255,255,255,0.2));
    background: var(--surface-secondary, rgba(255,255,255,0.08));
    color: inherit;
    border-radius: 999px;
    padding: 0.4rem 0.9rem;
    cursor: pointer;
  }
  .title-wrap { display: flex; flex-direction: column; gap: 0.2rem; }
  .title { font-size: 1.4rem; font-weight: 800; }
  .subtitle { color: var(--text-secondary, rgba(255,255,255,0.7)); }
  .card {
    background: var(--surface-primary, rgba(255,255,255,0.08));
    border: 1px solid var(--divider-color, rgba(255,255,255,0.18));
    border-radius: 1rem;
    padding: 1rem;
    backdrop-filter: blur(18px);
  }
  .card.error { color: #ffb7d5; }
  .card.empty { color: var(--text-secondary, rgba(255,255,255,0.65)); }
  .profile-card {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  .avatar {
    width: 96px;
    height: 96px;
    border-radius: 1rem;
    overflow: hidden;
    background: var(--surface-secondary, rgba(255,255,255,0.05));
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--divider-color, rgba(255,255,255,0.15));
  }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    color: var(--text-secondary, rgba(255,255,255,0.7));
  }
  .info { display: flex; flex-direction: column; gap: 0.35rem; }
  .name { font-size: 1.3rem; font-weight: 800; }
  .meta { color: var(--text-secondary, rgba(255,255,255,0.7)); }
  .badge {
    display: inline-flex;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    background: rgba(255, 215, 0, 0.15);
    color: #ffd700;
    font-weight: 700;
    font-size: 0.85rem;
  }
  .actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
  .actions button {
    border: none;
    border-radius: 999px;
    padding: 0.45rem 0.9rem;
    cursor: pointer;
    font-weight: 700;
  }
  .actions .primary {
    background: var(--admin-submit-gradient, linear-gradient(135deg, #ff7ab7, #7a6bff));
    color: #fff;
  }
  .actions .outline {
    background: transparent;
    border: 1px solid var(--divider-color, rgba(255,255,255,0.25));
    color: inherit;
  }
</style>

