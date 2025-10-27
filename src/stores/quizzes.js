import { writable } from 'svelte/store';
import { animeGuesses as apiGuesses } from '../lib/api';

export const availableQuizDates = writable([]); // [YYYY-MM-DD]
export const quizDate = writable(''); // current selected date

export async function refreshQuizDates() {
  try {
    const dates = await apiGuesses.dates();
    availableQuizDates.set(Array.isArray(dates) ? dates : []);
    let cur;
    quizDate.subscribe((v) => (cur = v))();
    if (!cur) {
      const first = Array.isArray(dates) && dates.length ? dates[0] : '';
      quizDate.set(first);
    }
  } catch (_) {
    availableQuizDates.set([]);
  }
}

export function setQuizDate(dateStr) {
  quizDate.set(dateStr || '');
}

export function selectPreviousDate() {
  let cur; let list;
  quizDate.subscribe((v) => (cur = v))();
  availableQuizDates.subscribe((v) => (list = v))();
  const idx = (list || []).indexOf(cur);
  if (idx >= 0 && idx < (list.length - 1)) {
    quizDate.set(list[idx + 1]);
  }
}


