#!/bin/bash
# Быстрый рестарт - используй этот скрипт после git pull

echo "🔄 Перезапуск Weebplace..."

# На VDS
if [ -f "/var/www/kristal/weebplace/server/index.js" ]; then
  echo "📦 Обнаружен VDS - перезапускаем сервер..."
  
  # Сборка фронтенда
  echo "🔨 Собираю фронтенд..."
  cd /var/www/kristal/weebplace
  npm install --silent
  npm run build
  
  # Установка зависимостей бэкенда
  echo "📦 Устанавливаю зависимости бэкенда..."
  cd /var/www/kristal/weebplace/server
  npm install --silent
  
  # Перезапуск сервиса
  echo "♻️ Перезапускаю сервис..."
  sudo systemctl restart weebplace
  sudo systemctl status weebplace --no-pager -l | head -20
  echo ""
  echo "✅ Сервер перезапущен. Логи: sudo journalctl -u weebplace -f"
  exit 0
fi

# Локально
if [ -d "$HOME/Documents/GitHub/weebplace" ]; then
  echo "💻 Обнаружен локальный проект"
  cd "$HOME/Documents/GitHub/weebplace"
  
  # Проверить .env
  if [ ! -f ".env" ]; then
    echo "⚠️  Файл .env не найден, создаю..."
    echo 'VITE_API_URL=http://185.177.219.234/api' > .env
  fi
  
  cat .env
  
  echo ""
  echo "✅ Готово! Запусти: npm run dev"
  echo "   Затем открой: http://127.0.0.1:5173"
  exit 0
fi

echo "❌ Не могу определить где мы - VDS или локально"
exit 1
