import { searchAnimes, getAnimeDetails, mapAnimeToItem } from './shikimoriClient';

/** @type {import('./types').SourceModule} */
const ShikimoriSource = {
  info: {
    id: 'shikimori',
    name: 'Shikimori',
    version: '0.1.0'
  },
  async search(query, opts) {
    if (!query || !query.trim()) return [];
    const page = opts?.page ?? 1;
    const limit = opts?.limit ?? 20;
    const data = await searchAnimes(query.trim(), page, limit);
    return data.map(mapAnimeToItem);
  },
  async getById(id) {
    return getAnimeDetails(id);
  },
  async getStreams(id) {
    // Shikimori не хостит поток, это каталог. Для демо вернём тестовый HLS.
    // В реальном модуле-источнике поток даёт другой провайдер.
    return [
      {
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        type: 'hls',
        quality: '720p'
      }
    ];
  }
};

export default ShikimoriSource;


