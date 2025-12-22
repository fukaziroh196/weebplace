# ⚡ СУПЕР БЫСТРЫЙ СТАРТ БЕЗ ДОМЕНА

## 🎯 Минимальные команды (скопируйте и выполните на VDS):

```bash
# 1. Установка
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git sqlite3

# 2. Создание директории
sudo mkdir -p /var/www/kristal/weebplace
sudo chown -R $USER:$USER /var/www/kristal
cd /var/www/kristal/weebplace

# 3. Клонирование (ЗАМЕНИТЕ на ваш репозиторий!)
git clone https://github.com/your-username/weebplace.git .

# 4. Установка зависимостей
cd server
npm install --production

# 5. Создание .env
cat > .env << ENVEOF
PORT=3000
NODE_ENV=production
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGIN=*
ENVEOF

# 6. Создание директорий
mkdir -p uploads/avatars

# 7. Systemd
sudo cp weebplace.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable weebplace
sudo systemctl start weebplace

# 8. Nginx (БЕЗ домена)
sudo cp nginx.conf.no-domain /etc/nginx/sites-available/weebplace
sudo ln -s /etc/nginx/sites-available/weebplace /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 9. Firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw --force enable

# 10. Узнать IP
echo "Ваш IP: $(curl -s ifconfig.me)"
```

## ✅ Готово! 

Сервер доступен по: `http://YOUR_IP/api`

## 🔍 Проверка:

```bash
# Health check
curl http://localhost:3000/health

# Логи
sudo journalctl -u weebplace -f
```

## 📝 Для фронтенда:

В `.env` фронтенда:
```env
VITE_API_URL=http://YOUR_VDS_IP/api
```
