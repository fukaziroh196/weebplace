import { writable, derived, get } from 'svelte/store';
import { notificationsApi } from '../lib/api';

export const notifications = writable([]);
export const unreadCount = derived(notifications, (list) => (list || []).length);

export async function loadUnreadNotifications(limit = 50) {
  try {
    const items = await notificationsApi.list({ status: 'unread', limit });
    notifications.set(items || []);
    return items;
  } catch (e) {
    console.error('[notifications] loadUnread failed', e);
    notifications.set([]);
    return [];
  }
}

export async function markNotificationRead(id) {
  try {
    await notificationsApi.markRead(id);
    notifications.update((list) => list.filter((n) => n.id !== id));
  } catch (e) {
    console.error('[notifications] markRead failed', e);
  }
}

export async function markAllNotificationsRead() {
  try {
    await notificationsApi.markAllRead();
    notifications.set([]);
  } catch (e) {
    console.error('[notifications] markAllRead failed', e);
  }
}

export function clearNotificationsStore() {
  notifications.set([]);
}

