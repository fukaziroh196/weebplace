import { writable } from 'svelte/store';

function applyToBody() {
  try {
    const body = document.body;
    body.classList.remove('theme-light');
    body.classList.add('theme-dark');
  } catch (_) {}
}

// Always dark theme
export const theme = writable('dark');
applyToBody();

export function setTheme() {
  // Always dark
}

export function toggleTheme() {
  // Always dark
}











