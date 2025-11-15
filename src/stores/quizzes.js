import { writable } from 'svelte/store';
import { animeGuesses as apiGuesses } from '../lib/api';

export const availableQuizDates = writable([]); // [YYYY-MM-DD]
export const quizDate = writable(''); // current selected date

export async function refreshQuizDates() {
  try {
    const dates = await apiGuesses.dates();
    const list = Array.isArray(dates) ? dates : [];
    availableQuizDates.set(list);
    
    let cur;
    quizDate.subscribe((v) => (cur = v))();
    
    const today = (() => { 
      const t = new Date(); 
      return `${t.getUTCFullYear()}-${String(t.getUTCMonth()+1).padStart(2,'0')}-${String(t.getUTCDate()).padStart(2,'0')}`; 
    })();
    
    // Если сегодняшняя дата доступна, всегда устанавливаем её (даже если уже установлена другая дата)
    if (list.includes(today)) {
      if (cur !== today) {
        quizDate.set(today);
      }
    } else if (!cur && list.length > 0) {
      // Если сегодняшняя дата недоступна и дата не установлена, используем последнюю доступную (самую новую)
      const sortedDates = [...list].sort().reverse();
      quizDate.set(sortedDates[0]);
    } else if (!cur) {
      // Если вообще нет дат, оставляем пустым
      quizDate.set('');
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


