const NodeCache = require('node-cache');

// Общий кэш для API
const cache = new NodeCache({
  stdTTL: 300,       // значение по умолчанию — 5 минут
  checkperiod: 120,  // проверять устаревшие записи раз в 2 минуты
  useClones: false
});

function get(key) {
  return cache.get(key);
}

function set(key, value, ttl) {
  cache.set(key, value, ttl);
}

function del(keys) {
  cache.del(keys);
}

function flushAll() {
  cache.flushAll();
}

module.exports = {
  cache,
  get,
  set,
  del,
  flushAll
};

