import { writable, get } from 'svelte/store';
import { auth, library as libraryApi, friendsApi, usersApi } from '../lib/api';
import { loadUnreadNotifications, clearNotificationsStore } from './notifications';

// Current user store
export const currentUser = writable(null);
export const apiToken = writable(null);

// User library stores
export const watched = writable([]);
export const favorites = writable([]);
export const wishlist = writable([]);
export const dropped = writable([]);
export const ratings = writable({});
export const notInterested = writable([]);
export const friends = writable([]);
export const friendProfiles = writable([]);
export const friendRequestsIncoming = writable([]);
export const friendRequestsOutgoing = writable([]);
export const comments = writable([]);
export const notifications = writable([]);

// Load current user from API
export async function loadCurrentUser() {
  try {
    const user = await auth.getMe();
    currentUser.set(user);
    await loadUserLibrary();
    await refreshFriendState();
    await loadUnreadNotifications().catch(() => {});
    return user;
  } catch (error) {
    currentUser.set(null);
    return null;
  }
}

// Load user library from API
async function loadUserLibrary() {
  try {
    const lib = await libraryApi.get();
    watched.set(lib.watched || []);
    favorites.set(lib.favorites || []);
    wishlist.set(lib.wishlist || []);
    dropped.set(lib.dropped || []);
    ratings.set(lib.ratings || {});
    notInterested.set(lib.notInterested || []);
    friends.set(lib.friends || []);
    friendRequestsIncoming.set(lib.friendRequestsIncoming || []);
    friendRequestsOutgoing.set(lib.friendRequestsOutgoing || []);
    comments.set(lib.comments || []);
    notifications.set(lib.notifications || []);
  } catch (error) {
    console.error('Failed to load library:', error);
  }
}

// Save library to API
async function saveLibrary(dataType, data) {
  try {
    await libraryApi.save(dataType, data);
  } catch (error) {
    console.error(`Failed to save ${dataType}:`, error);
  }
}

// Register
export async function register(username, password) {
  try {
    const result = await auth.register(username, password);
    currentUser.set(result.user);
    await loadUserLibrary();
    await refreshFriendState();
    await loadUnreadNotifications().catch(() => {});
    return result.user;
  } catch (error) {
    throw error;
  }
}

// Login
export async function login(username, password) {
  try {
    const result = await auth.login(username, password);
    currentUser.set(result.user);
    await loadUserLibrary();
    await refreshFriendState();
    await loadUnreadNotifications().catch(() => {});
    return result.user;
  } catch (error) {
    throw error;
  }
}

// Logout
export function logout() {
  auth.logout();
  currentUser.set(null);
  watched.set([]);
  favorites.set([]);
  wishlist.set([]);
  dropped.set([]);
  ratings.set({});
  notInterested.set([]);
  friends.set([]);
  friendProfiles.set([]);
  friendRequestsIncoming.set([]);
  friendRequestsOutgoing.set([]);
  comments.set([]);
  clearNotificationsStore();
}

// Update profile (avatar, etc.)
export async function updateProfile(formData) {
  const token = localStorage.getItem('api_token');
  if (!token) throw new Error('Не авторизован');
  
  const res = await fetch('/api/user/profile', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка сохранения');
  }
  
  const updated = await res.json();
  currentUser.update(u => ({ ...u, ...updated }));
  return updated;
}

// Change password
export async function changePassword(currentPassword, newPassword) {
  const token = localStorage.getItem('api_token');
  if (!token) throw new Error('Не авторизован');
  
  const res = await fetch('/api/user/password', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ currentPassword, newPassword })
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка смены пароля');
  }
  
  return true;
}

// ---------- Friends ----------
export async function refreshFriendState() {
  try {
    const state = await friendsApi.state();
    const list = state.friends || [];
    friendProfiles.set(list);
    friends.set(list.map((f) => f.id));
    friendRequestsIncoming.set(state.incoming || []);
    friendRequestsOutgoing.set(state.outgoing || []);
  } catch (error) {
    console.error('Failed to load friends:', error);
    friends.set([]);
    friendProfiles.set([]);
    friendRequestsIncoming.set([]);
    friendRequestsOutgoing.set([]);
  }
}

export async function sendFriendRequest(username) {
  const name = (username || '').trim();
  if (!name) throw new Error('Введите имя пользователя');
  await friendsApi.send(name);
  await refreshFriendState();
}

export async function acceptFriendRequest(requestId) {
  await friendsApi.respond(requestId, 'accept');
  await refreshFriendState();
}

export async function declineFriendRequest(requestId) {
  await friendsApi.respond(requestId, 'decline');
  await refreshFriendState();
}

export async function removeFriend(userId) {
  await friendsApi.remove(userId);
  await refreshFriendState();
}

export async function searchUsers(query) {
  if (!query) return [];
  return await usersApi.search(query);
}

// Watch for changes and auto-save to API
watched.subscribe((data) => {
  const user = currentUser.__value;
  if (user) saveLibrary('watched', data);
});

favorites.subscribe((data) => {
  const user = currentUser.__value;
  if (user) saveLibrary('favorites', data);
});

wishlist.subscribe((data) => {
  const user = currentUser.__value;
  if (user) saveLibrary('wishlist', data);
});

dropped.subscribe((data) => {
  const user = currentUser.__value;
  if (user) saveLibrary('dropped', data);
});

ratings.subscribe((data) => {
  const user = currentUser.__value;
  if (user) saveLibrary('ratings', data);
});

// Helper functions
export function addToWatched(item) {
  watched.update((list) => {
    if (!item?.id || list.some((x) => x.id === item.id)) return list;
    return [{ ...item, watchedAt: Date.now() }, ...list];
  });
}

export function addToFavorites(item) {
  favorites.update((list) => {
    if (!item?.id || list.some((x) => x.id === item.id)) return list;
    return [{ ...item, addedAt: Date.now() }, ...list];
  });
}

export function addToWishlist(item) {
  wishlist.update((list) => {
    if (!item?.id || list.some((x) => x.id === item.id)) return list;
    return [{ ...item, addedAt: Date.now() }, ...list];
  });
}

export function addToDropped(item) {
  dropped.update((list) => {
    if (!item?.id || list.some((x) => x.id === item.id)) return list;
    return [{ ...item, addedAt: Date.now() }, ...list];
  });
}

export function removeFromWatched(id) {
  watched.update((list) => list.filter((x) => x.id !== id));
}

export function removeFromFavorites(id) {
  favorites.update((list) => list.filter((x) => x.id !== id));
}

export function removeFromWishlist(id) {
  wishlist.update((list) => list.filter((x) => x.id !== id));
}

export function removeFromDropped(id) {
  dropped.update((list) => list.filter((x) => x.id !== id));
}

export function setRating(itemId, value) {
  ratings.update((map) => {
    const v = Math.max(1, Math.min(10, Math.round(value)));
    return { ...map, [itemId]: v };
  });
}

export function isFavorite(id) {
  let list;
  favorites.subscribe((v) => (list = v))();
  return (list || []).some((x) => x.id === id);
}

export function toggleFavorite(item) {
  if (isFavorite(item.id)) {
    removeFromFavorites(item.id);
  } else {
    addToFavorites(item);
  }
}

// Update current user avatar (from file)
export async function setCurrentUserAvatar(file) {
  try {
    // Проверяем, что пользователь авторизован
    const user = get(currentUser);
    if (!user) {
      throw new Error('User not authenticated');
    }

    if (!(file instanceof File)) {
      throw new Error('Invalid file: expected File object');
    }

    console.log('[setCurrentUserAvatar] Uploading avatar file:', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    const result = await auth.uploadAvatar(file);
    
    // Обновляем пользователя
    const updatedUser = await auth.getMe();
    currentUser.set(updatedUser);
    
    console.log('[setCurrentUserAvatar] Avatar uploaded successfully:', updatedUser);
    return updatedUser;
  } catch (error) {
    console.error('[setCurrentUserAvatar] Failed to upload avatar:', error);
    throw error;
  }
}

// Clear current user avatar
export async function clearCurrentUserAvatar() {
  try {
    const user = get(currentUser);
    if (!user) {
      throw new Error('User not authenticated');
    }

    await auth.deleteAvatar();
    
    // Обновляем пользователя
    const updatedUser = await auth.getMe();
    currentUser.set(updatedUser);
    
    return updatedUser;
  } catch (error) {
    console.error('[clearCurrentUserAvatar] Failed to delete avatar:', error);
    throw error;
  }
}

// Initialize on import
if (typeof window !== 'undefined') {
  const token = localStorage.getItem('api_token');
  if (token) {
    apiToken.set(token);
    loadCurrentUser();
  }
}


