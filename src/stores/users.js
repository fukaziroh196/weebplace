import { writable } from 'svelte/store';
import { usersApi } from '../lib/api';

export const publicUser = writable(null);
export const publicUserLoading = writable(false);
export const publicUserError = writable('');

let lastLoadedId = null;

export async function loadPublicUser(id) {
  const userId = (id || '').trim();
  if (!userId) {
    publicUser.set(null);
    publicUserError.set('Не указан пользователь');
    return;
  }
  if (userId === lastLoadedId && publicUser.__value) return;
  lastLoadedId = userId;
  publicUserLoading.set(true);
  publicUserError.set('');
  try {
    const u = await usersApi.get(userId);
    publicUser.set(u);
  } catch (e) {
    publicUser.set(null);
    publicUserError.set(e?.message || 'Не удалось загрузить профиль');
  } finally {
    publicUserLoading.set(false);
  }
}

export function clearPublicUser() {
  publicUser.set(null);
  publicUserError.set('');
  publicUserLoading.set(false);
  lastLoadedId = null;
}

