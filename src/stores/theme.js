import { writable } from 'svelte/store';

function applyToBody(mode) {
  try {
    const body = document.body;
    body.classList.remove('theme-dark', 'theme-light');
    body.classList.add(mode === 'light' ? 'theme-light' : 'theme-dark');
  } catch (_) {}
}

const initial = (() => {
  try {
    return localStorage.getItem('theme') || 'light';
  } catch (_) {
    return 'light';
  }
})();

export const theme = writable(initial);
applyToBody(initial);

theme.subscribe((m) => {
  try { localStorage.setItem('theme', m); } catch (_) {}
  applyToBody(m);
});

export function setTheme(mode) {
  theme.set(mode === 'light' ? 'light' : 'dark');
}

export function toggleTheme() {
  let current;
  const unsub = theme.subscribe((v) => (current = v));
  unsub();
  theme.set(current === 'light' ? 'dark' : 'light');
}











