import { writable } from 'svelte/store';
import { leaderboard as leaderboardApi } from '../lib/api';

export const leaderboard = writable([]);
export const leaderboardPeriod = writable('all');

export async function refreshLeaderboard(period = 'all') {
  try {
    console.log('[refreshLeaderboard] Loading for period:', period);
    const top = await leaderboardApi.list(5, period); // Загружаем только 5 игроков
    if (Array.isArray(top) && top.length) {
      const data = top.map((r) => ({ 
        name: r.username, 
        days: r.score ?? r.days ?? r.guesses ?? 0, 
        metric: r.metric || (period === 'day' ? 'guesses' : 'days'), 
        rank: r.rank || 0, 
        highlight: r.rank <= 3 
      }));
      leaderboard.set(data);
      console.log('[refreshLeaderboard] Loaded', data.length, 'entries');
    } else {
      leaderboard.set([]);
    }
  } catch (e) { 
    console.error('[refreshLeaderboard] Error:', e);
    leaderboard.set([]);
  }
}

