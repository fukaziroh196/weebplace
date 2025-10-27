import { writable } from 'svelte/store';
import { stats as apiStats } from '../lib/api';

export const userStats = writable({ loading: false, data: null, error: '' });

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


