import { writable } from 'svelte/store';
import { leaderboard as leaderboardApi } from '../lib/api';

export const leaderboard = writable({ loading: false, data: [], error: '' });
export const leaderboardPeriod = writable('all');

export async function refreshLeaderboard(period = 'all') {
  try {
    leaderboard.update(state => ({ ...state, loading: true, error: '' }));
    console.log('[refreshLeaderboard] Loading for period:', period);
    const top = await leaderboardApi.list(6, period); // Загружаем 6 игроков
    if (Array.isArray(top) && top.length) {
      const data = top.map((r) => ({ 
        id: r.userId || r.id || r.username,
        userId: r.userId,
        name: r.username || r.name || 'Игрок', 
        username: r.username || r.name || 'Игрок',
        days: r.days ?? 0,
        guesses: r.guesses ?? 0,
        score: r.score ?? r.days ?? r.guesses ?? 0,
        value: r.value ?? r.days ?? r.guesses ?? 0,
        metric: r.metric || (period === 'day' ? 'guesses' : 'days'), 
        rank: r.rank || 0, 
        highlight: r.rank <= 3 
      }));
      leaderboard.set({ loading: false, data, error: '' });
      console.log('[refreshLeaderboard] Loaded', data.length, 'entries:', data);
    } else {
      leaderboard.set({ loading: false, data: [], error: '' });
      console.log('[refreshLeaderboard] No data received or empty array');
    }
  } catch (e) { 
    console.error('[refreshLeaderboard] Error:', e);
    leaderboard.set({ loading: false, data: [], error: e?.message || 'Не удалось загрузить лидерборд' });
  }
}

