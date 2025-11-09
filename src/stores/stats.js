import { writable } from 'svelte/store';
import { stats as apiStats } from '../lib/api';

export const userStats = writable({ loading: false, data: null, error: '' });
export const globalStats = writable({
  loading: false,
  data: {
    mostGuessedAnime: [],
    fastestPlayers: [],
    recentModes: []
  },
  error: ''
});

export async function loadUserStats() {
  userStats.set({ loading: true, data: null, error: '' });
  try {
    const data = await apiStats.me();
    userStats.set({ loading: false, data, error: '' });
    return data;
  } catch (e) {
    userStats.set({ loading: false, data: null, error: e?.message || 'Ошибка' });
    return null;
  }
}

export async function loadGlobalStats() {
  globalStats.set({
    loading: true,
    data: {
      mostGuessedAnime: [],
      fastestPlayers: [],
      recentModes: []
    },
    error: ''
  });

  try {
    const data = await apiStats.global();
    globalStats.set({
      loading: false,
      data: {
        mostGuessedAnime: data?.mostGuessedAnime || [],
        fastestPlayers: data?.fastestPlayers || [],
        recentModes: data?.recentModes || []
      },
      error: ''
    });
    return data;
  } catch (e) {
    globalStats.set({
      loading: false,
      data: {
        mostGuessedAnime: [],
        fastestPlayers: [],
        recentModes: []
      },
      error: e?.message || 'Ошибка загрузки статистики'
    });
    return null;
  }
}


