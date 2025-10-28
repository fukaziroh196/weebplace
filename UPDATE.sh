#!/bin/bash
# Быстрое обновление frontend и перезапуск сервера

echo "🔨 Сборка frontend..."
npm run build

echo "♻️ Перезапуск сервера..."
pm2 restart weebplace-server

echo "✅ Готово! Обнови страницу в браузере (Ctrl+Shift+R)"

