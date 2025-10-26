#!/bin/bash

# Скрипт для разового деплоя на VDS
# Использование: ./deploy.sh user@your-vds-ip

echo "🚀 Деплой Kristal Backend на VDS"

if [ -z "$1" ]; then
  echo "❌ Ошибка: Укажите пользователя и IP"
  echo "Использование: ./deploy.sh user@your-vds-ip"
  exit 1
fi

VDS_HOST=$1

echo "📦 Подключение к $VDS_HOST..."

# Копируем файлы на сервер
echo "📤 Загрузка файлов..."
scp -r server/ $VDS_HOST:/var/www/kristal/

echo "🔧 Настройка на сервере..."
ssh $VDS_HOST << 'ENDSSH'
  cd /var/www/kristal/server
  
  # Устанавливаем зависимости
  echo "📥 Установка зависимостей..."
  npm install
  
  # Создаем .env если не существует
  if [ ! -f .env ]; then
    echo "📝 Создание .env файла..."
    cat > .env << EOF
PORT=3000
JWT_SECRET=$(openssl rand -hex 32)
NODE_ENV=production
EOF
  fi
  
  # Создаем папку для загрузок
  mkdir -p uploads
  
  # Останавливаем старый процесс
  pm2 stop kristal-backend || true
  pm2 delete kristal-backend || true
  
  # Запускаем новый процесс
  echo "🚀 Запуск сервера..."
  pm2 start index.js --name kristal-backend
  pm2 save
  
  echo "✅ Деплой завершен!"
  pm2 status
  echo ""
  echo "📋 Логи:"
  pm2 logs kristal-backend --lines 20
ENDSSH

echo "✅ Готово! Сервер развернут на $VDS_HOST"

