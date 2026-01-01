import { writable } from 'svelte/store';
import { setQuizDate, availableQuizDates } from './quizzes';

// Possible values: 'home' | 'search' | 'details' | 'profile' | 'publicProfile' | 'admin' | 'lists' | 'messages' | 'catalog' | 'aniquiz' | 'guessAnime' | 'guessCharacter' | 'guessOpening' | 'adminQuiz'
export const activeView = writable('home');
export const detailsItem = writable(null); // { id, __sourceId, title?, image?, description? }
export const sidebarCollapsed = writable(false);
export const profileTab = writable('info'); // 'info' | 'achievements'
export const publicProfileUserId = writable(null);

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
  // Дата будет установлена автоматически в refreshQuizDates() при загрузке компонента
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

export function goToAdminQuiz() {
  activeView.set('adminQuiz');
}

export function goToAchievements() {
  activeView.set('profile');
  profileTab.set('achievements');
}

export function goToProfile() {
  activeView.set('profile');
  profileTab.set('info');
}

export function goToPublicProfile(userId) {
  publicProfileUserId.set(userId || null);
  activeView.set('publicProfile');
}




