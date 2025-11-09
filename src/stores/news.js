import { writable } from 'svelte/store';
import { news as newsApi } from '../lib/api';

export const newsFeed = writable({
  loading: false,
  items: [],
  error: ''
});

let hasLoaded = false;

export async function loadNews(force = false, limit = 12) {
  if (hasLoaded && !force) {
    return;
  }

  newsFeed.update((state) => ({
    ...state,
    loading: true,
    error: ''
  }));

  try {
    const items = await newsApi.list(limit);
    newsFeed.set({
      loading: false,
      items: Array.isArray(items)
        ? items.map((item) => ({
            ...item,
            createdAt: item.createdAt ?? item.created_at ?? Date.now()
          }))
        : [],
      error: ''
    });
    hasLoaded = true;
  } catch (error) {
    newsFeed.set({
      loading: false,
      items: [],
      error: error?.message || 'Не удалось загрузить новости'
    });
  }
}

export async function publishNews(text) {
  const payload = (text || '').trim();
  if (!payload) {
    throw new Error('Текст новости не может быть пустым');
  }

  const created = await newsApi.create(payload);
  const normalized = {
    ...created,
    createdAt: created?.createdAt ?? created?.created_at ?? Date.now()
  };

  newsFeed.update((state) => {
    const items = [normalized, ...(state?.items || [])].slice(0, 20);
    return {
      loading: false,
      items,
      error: ''
    };
  });

  return normalized;
}

export async function updateNews(id, text) {
  const payload = (text || '').trim();
  if (!payload) {
    throw new Error('Текст новости не может быть пустым');
  }

  const updated = await newsApi.update(id, payload);
  const normalized = {
    ...updated,
    createdAt: updated?.createdAt ?? updated?.created_at ?? Date.now()
  };

  newsFeed.update((state) => {
    const items = (state?.items || []).map((item) =>
      item.id === normalized.id ? { ...item, ...normalized } : item
    );
    return {
      loading: false,
      items,
      error: ''
    };
  });

  return normalized;
}

export async function deleteNews(id) {
  await newsApi.remove(id);
  newsFeed.update((state) => ({
    loading: false,
    items: (state?.items || []).filter((item) => item.id !== id),
    error: ''
  }));
}

