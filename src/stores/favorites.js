import { writable, get } from 'svelte/store';

const API_BASE = '/api';

// Состояние избранных
export const favorites = writable([]);
export const favoritesLoading = writable(false);
export const favoritesError = writable(null);

// Загрузить свои избранные
export async function loadFavorites() {
  favoritesLoading.set(true);
  favoritesError.set(null);
  
  try {
    const token = localStorage.getItem('api_token');
    if (!token) {
      favorites.set([]);
      return [];
    }
    
    const res = await fetch(`${API_BASE}/favorites`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const data = await res.json();
    const list = data.favorites || [];
    favorites.set(list);
    return list;
  } catch (err) {
    favoritesError.set(err.message);
    return [];
  } finally {
    favoritesLoading.set(false);
  }
}

// Загрузить избранные любого пользователя
export async function loadUserFavorites(userId) {
  try {
    const res = await fetch(`${API_BASE}/users/${userId}/favorites`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.favorites || [];
  } catch (err) {
    console.error('Failed to load user favorites:', err);
    return [];
  }
}

// Добавить в избранное
export async function addFavorite(anime) {
  const token = localStorage.getItem('api_token');
  if (!token) throw new Error('Не авторизован');
  
  const res = await fetch(`${API_BASE}/favorites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      animeId: String(anime.id),
      title: anime.title || anime.russian || anime.name,
      imageUrl: anime.image || anime.imageUrl,
      score: anime.score,
      sourceId: anime.__sourceId || 'shikimori'
    })
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  
  const data = await res.json();
  if (data.favorite) {
    favorites.update(list => [...list, data.favorite]);
  }
  return data;
}

// Удалить из избранного по id записи
export async function removeFavorite(id) {
  const token = localStorage.getItem('api_token');
  if (!token) throw new Error('Не авторизован');
  
  const res = await fetch(`${API_BASE}/favorites/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  
  favorites.update(list => list.filter(f => f.id !== id));
  return true;
}

// Удалить по anime_id
export async function removeFavoriteByAnimeId(animeId) {
  const token = localStorage.getItem('api_token');
  if (!token) throw new Error('Не авторизован');
  
  const res = await fetch(`${API_BASE}/favorites/anime/${animeId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  
  favorites.update(list => list.filter(f => f.animeId !== String(animeId)));
  return true;
}

// Проверить, есть ли аниме в избранном
export function isFavorite(animeId) {
  const list = get(favorites);
  return list.some(f => f.animeId === String(animeId));
}

// Реактивная проверка избранного
export function createIsFavoriteStore(animeId) {
  return {
    subscribe: (fn) => {
      return favorites.subscribe(list => {
        fn(list.some(f => f.animeId === String(animeId)));
      });
    }
  };
}

