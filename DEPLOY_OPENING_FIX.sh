#!/bin/bash

echo "🔧 Исправление ошибки 500 при загрузке опенингов..."
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}1. Коммит изменений...${NC}"
git add server/index.js
git commit -m "fix: добавлено подробное логирование для отладки ошибки 500 при загрузке опенингов"

echo ""
echo -e "${YELLOW}2. Пуш на GitHub...${NC}"
git push origin main

echo ""
echo -e "${YELLOW}3. Подключаемся к серверу и обновляем...${NC}"
ssh root@185.177.219.234 << 'ENDSSH'
cd /var/www/kristal/weebplace

echo "📥 Получаем последние изменения..."
git pull origin main

echo ""
echo "🔄 Перезапускаем сервис..."
sudo systemctl restart weebplace

echo ""
echo "⏳ Ожидание запуска сервиса (3 сек)..."
sleep 3

echo ""
echo "📊 Статус сервиса:"
sudo systemctl status weebplace --no-pager | head -20

echo ""
echo "📋 Последние 30 строк логов:"
sudo journalctl -u weebplace -n 30 --no-pager

echo ""
echo "✅ Обновление завершено!"
echo ""
echo "🧪 Теперь попробуйте загрузить опенинг в админ-панели."
echo "📝 Логи будут показывать подробную информацию об ошибке."

ENDSSH

echo ""
echo -e "${GREEN}✅ Деплой завершен!${NC}"
echo ""
echo -e "${YELLOW}Инструкции:${NC}"
echo "1. Попробуйте загрузить опенинг через админ-панель"
echo "2. Если ошибка повторится, выполните команду:"
echo -e "   ${GREEN}ssh root@185.177.219.234 'journalctl -u weebplace -n 50 --no-pager'${NC}"
echo "3. Скопируйте логи и покажите мне"

