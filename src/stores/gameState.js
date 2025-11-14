import { writable } from 'svelte/store';

export const gameState = writable({
  title: '',
  round: 0,
  difficulty: '',
  score: 0
});

