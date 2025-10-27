import { writable } from 'svelte/store';

// Possible values: 'home' | 'search' | 'details' | 'profile' | 'admin' | 'lists' | 'messages' | 'catalog' | 'aniquiz' | 'guessAnime' | 'guessCharacter' | 'guessOpening'
export const activeView = writable('home');
export const detailsItem = writable(null); // { id, __sourceId, title?, image?, description? }
export const sidebarCollapsed = writable(false);

export function goToSearch() {
  activeView.set('search');
}

export function goHome() {
  activeView.set('home');
  detailsItem.set(null);
}

export function goToDetails(item) {
  detailsItem.set(item || null);
  activeView.set('details');
}

export function goToProfile() {
  activeView.set('profile');
}

export function goToAdmin() {
  activeView.set('admin');
}

export function goToLists() {
  activeView.set('lists');
}

export function goToMessages() {
  activeView.set('messages');
}

export function toggleSidebar() {
  sidebarCollapsed.update((v) => !v);
}

export function goToCatalog() {
  activeView.set('catalog');
}

export function goToGuessAnime() {
  activeView.set('guessAnime');
}

export function goToAniQuiz() {
  activeView.set('aniquiz');
}

export function goToGuessCharacter() {
  activeView.set('guessCharacter');
}

export function goToGuessOpening() {
  activeView.set('guessOpening');
}




