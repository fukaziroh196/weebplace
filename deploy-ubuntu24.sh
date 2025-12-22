#!/bin/bash
# Улучшенный скрипт деплоя для Ubuntu 24
# Использование: ./deploy-ubuntu24.sh [user@host]

set -e  # Остановка при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка аргументов
if [ -z "$1" ]; then
    # Локальный деплой (на текущий сервер)
    echo -e "${GREEN}🚀 Локальный деплой Weebplace${NC}"
    DEPLOY_LOCAL=true
else
    # Удаленный деплой
    VDS_HOST=$1
    echo -e "${GREEN}🚀 Деплой Weebplace на $VDS_HOST${NC}"
    DEPLOY_LOCAL=false
fi

# Функция для выполнения команд
run_cmd() {
    if [ "$DEPLOY_LOCAL" = true ]; then
        eval "$1"
    else
        ssh $VDS_HOST "$1"
    fi
}

# Функция для копирования файлов
copy_files() {
    if [ "$DEPLOY_LOCAL" = true ]; then
        echo "📁 Файлы уже на месте"
    else
        echo -e "${YELLOW}📤 Копирование файлов на сервер...${NC}"
        rsync -avz --exclude 'node_modules' --exclude '.git' \
            --exclude 'uploads' --exclude 'database.sqlite' \
            server/ $VDS_HOST:/var/www/kristal/weebplace/server/
    fi
}

# Основной процесс деплоя
main() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Weebplace Deployment Script${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""

    # Копирование файлов
    copy_files

    # Выполнение команд на сервере
    echo -e "${YELLOW}🔧 Настройка на сервере...${NC}"
    
    run_cmd "cd /var/www/kristal/weebplace/server"

    # Резервная копия базы данных
    echo -e "${YELLOW}💾 Создание резервной копии БД...${NC}"
    run_cmd "if [ -f database.sqlite ]; then cp database.sqlite database.sqlite.backup.\$(date +%Y%m%d_%H%M%S); fi"

    # Установка зависимостей
    echo -e "${YELLOW}📥 Установка зависимостей...${NC}"
    run_cmd "npm install --production"

    # Проверка .env файла
    echo -e "${YELLOW}📝 Проверка .env файла...${NC}"
    run_cmd "if [ ! -f .env ]; then
        echo '⚠️  .env файл не найден, создаю из примера...'
        cp .env.example .env
        echo '⚠️  ВАЖНО: Отредактируйте .env и установите JWT_SECRET!'
    fi"

    # Создание директорий
    echo -e "${YELLOW}📁 Создание директорий...${NC}"
    run_cmd "mkdir -p uploads/avatars"

    # Проверка конфигурации
    echo -e "${YELLOW}✅ Проверка конфигурации...${NC}"
    run_cmd "if [ -f .env ]; then
        source .env
        if [ \"\$NODE_ENV\" = \"production\" ] && [ -z \"\$JWT_SECRET\" ]; then
            echo '❌ ОШИБКА: JWT_SECRET не установлен в .env!'
            exit 1
        fi
    fi"

    # Перезапуск сервиса
    echo -e "${YELLOW}♻️  Перезапуск сервиса...${NC}"
    run_cmd "sudo systemctl daemon-reload"
    run_cmd "sudo systemctl restart weebplace"
    
    # Ожидание запуска
    sleep 2

    # Проверка статуса
    echo -e "${YELLOW}📊 Проверка статуса...${NC}"
    run_cmd "sudo systemctl status weebplace --no-pager -l | head -20"

    # Проверка health endpoint
    echo -e "${YELLOW}🏥 Проверка health endpoint...${NC}"
    sleep 1
    if run_cmd "curl -s http://localhost:3000/health | grep -q 'ok'"; then
        echo -e "${GREEN}✅ Сервер работает!${NC}"
    else
        echo -e "${RED}⚠️  Health check не прошел, проверьте логи:${NC}"
        echo "   sudo journalctl -u weebplace -f"
    fi

    # Показ логов
    echo ""
    echo -e "${GREEN}📋 Последние логи:${NC}"
    run_cmd "sudo journalctl -u weebplace -n 20 --no-pager"

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✅ Деплой завершен!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "📝 Полезные команды:"
    echo "   Логи: sudo journalctl -u weebplace -f"
    echo "   Статус: sudo systemctl status weebplace"
    echo "   Перезапуск: sudo systemctl restart weebplace"
    echo "   Health: curl http://localhost:3000/health"
}

# Запуск
main

