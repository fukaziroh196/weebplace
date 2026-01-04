import { writable } from 'svelte/store';
import { setQuizDate, availableQuizDates } from './quizzes';

// Detect initial view from URL (client-side)
const normalizePath = (p) => {
  if (!p) return '/';
  try {
    // drop trailing slashes, keep root
    return p.replace(/\/+$/, '') || '/';
  } catch (_) {
    return '/';
  }
};
const initialPath = typeof window !== 'undefined' ? normalizePath(window.location.pathname) : '/';
const initialView =
  initialPath === '/profile'
    ? 'profile'
    : initialPath === '/friends'
      ? 'profile'
      : initialPath === '/tournaments'
        ? 'tournaments'
        : initialPath.startsWith('/user/')
          ? 'publicProfile'
          : 'home';

// Possible values: 'home' | 'search' | 'details' | 'profile' | 'publicProfile' | 'admin' | 'lists' | 'messages' | 'catalog' | 'aniquiz' | 'guessAnime' | 'guessCharacter' | 'guessOpening' | 'adminQuiz' | 'tournaments'
export const activeView = writable(initialView);
export const detailsItem = writable(null); // { id, __sourceId, title?, image?, description? }
export const sidebarCollapsed = writable(false);
export const profileTab = writable('info'); // 'info' | 'achievements'
export const publicProfileUserId = writable(null);
export const friendsModalOpen = writable(initialPath === '/friends');

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

export function openFriendsModal() {
  friendsModalOpen.set(true);
}

export function closeFriendsModal() {
  friendsModalOpen.set(false);
}




