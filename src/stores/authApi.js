import { writable } from 'svelte/store';
import { auth, library as libraryApi } from '../lib/api';

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
  friendRequestsIncoming.set([]);
  friendRequestsOutgoing.set([]);
  comments.set([]);
  notifications.set([]);
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

// Initialize on import
if (typeof window !== 'undefined') {
  const token = localStorage.getItem('api_token');
  if (token) {
    apiToken.set(token);
    loadCurrentUser();
  }
}


