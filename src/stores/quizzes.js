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
      const list = Array.isArray(dates) ? dates : [];
      const today = (() => { const t=new Date(); return `${t.getUTCFullYear()}-${String(t.getUTCMonth()+1).padStart(2,'0')}-${String(t.getUTCDate()).padStart(2,'0')}`; })();
      const initial = list.includes(today) ? today : (list[0] || '');
      quizDate.set(initial);
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


