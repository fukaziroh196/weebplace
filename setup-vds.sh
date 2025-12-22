#!/bin/bash
# Скрипт первоначальной настройки VDS для Weebplace
# Использование: ./setup-vds.sh

set -e  # Остановка при ошибке

echo "🚀 Настройка VDS для Weebplace (Ubuntu 24)"
echo "=========================================="

# Проверка что мы на Ubuntu
if [ ! -f /etc/os-release ]; then
    echo "❌ Не удалось определить ОС"
    exit 1
fi

. /etc/os-release
if [ "$ID" != "ubuntu" ]; then
    echo "⚠️  Внимание: Этот скрипт предназначен для Ubuntu"
fi

# Обновление системы
echo ""
echo "📦 Обновление системы..."
sudo apt update && sudo apt upgrade -y

# Установка Node.js 20.x
echo ""
echo "📦 Установка Node.js 20.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "✅ Node.js уже установлен: $(node -v)"
fi

# Проверка версий
echo ""
echo "✅ Node.js: $(node -v)"
echo "✅ npm: $(npm -v)"

# Установка дополнительных пакетов
echo ""
echo "📦 Установка системных пакетов..."
sudo apt install -y \
    git \
    nginx \
    ufw \
    certbot \
    python3-certbot-nginx \
    sqlite3 \
    build-essential

# Создание директории для приложения
echo ""
echo "📁 Создание директорий..."
sudo mkdir -p /var/www/kristal/weebplace
sudo chown -R $USER:$USER /var/www/kristal

# Настройка firewall
echo ""
echo "🔥 Настройка firewall..."
sudo ufw --force enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status

# Создание пользователя для приложения (опционально)
echo ""
read -p "Создать отдельного пользователя для приложения? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if ! id "weebplace" &>/dev/null; then
        sudo useradd -m -s /bin/bash -d /var/www/kristal weebplace
        sudo chown -R weebplace:weebplace /var/www/kristal
        echo "✅ Пользователь weebplace создан"
    else
        echo "✅ Пользователь weebplace уже существует"
    fi
fi

# Настройка Nginx
echo ""
echo "🌐 Настройка Nginx..."
if [ -f "/etc/nginx/sites-available/weebplace" ]; then
    echo "⚠️  Конфигурация Nginx уже существует"
else
    echo "📝 Создайте конфигурацию Nginx вручную:"
    echo "   sudo cp /var/www/kristal/weebplace/server/nginx.conf /etc/nginx/sites-available/weebplace"
    echo "   sudo nano /etc/nginx/sites-available/weebplace  # Отредактируйте server_name"
    echo "   sudo ln -s /etc/nginx/sites-available/weebplace /etc/nginx/sites-enabled/"
    echo "   sudo nginx -t"
    echo "   sudo systemctl reload nginx"
fi

# Настройка systemd service
echo ""
echo "⚙️  Настройка systemd service..."
if [ -f "/etc/systemd/system/weebplace.service" ]; then
    echo "⚠️  Service уже существует"
else
    echo "📝 Создайте service вручную:"
    echo "   sudo cp /var/www/kristal/weebplace/server/weebplace.service /etc/systemd/system/"
    echo "   sudo systemctl daemon-reload"
    echo "   sudo systemctl enable weebplace"
fi

echo ""
echo "✅ Настройка VDS завершена!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Клонируйте репозиторий:"
echo "   cd /var/www/kristal/weebplace"
echo "   git clone <your-repo> ."
echo ""
echo "2. Установите зависимости:"
echo "   cd server"
echo "   npm install"
echo ""
echo "3. Создайте .env файл:"
echo "   cp .env.example .env"
echo "   nano .env  # Отредактируйте JWT_SECRET и другие настройки"
echo ""
echo "4. Настройте Nginx (см. выше)"
echo ""
echo "5. Настройте systemd service (см. выше)"
echo ""
echo "6. Запустите сервер:"
echo "   sudo systemctl start weebplace"
echo "   sudo systemctl status weebplace"
echo ""
echo "7. (Опционально) Настройте SSL:"
echo "   sudo certbot --nginx -d your-domain.com"

