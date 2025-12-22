# ⚡ Быстрый деплой на Ubuntu 24

## 🎯 Минимальные шаги для запуска

### 1. На VDS выполните:

```bash
# Обновление и установка Node.js
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git sqlite3

# Создание директории
sudo mkdir -p /var/www/kristal/weebplace
sudo chown -R $USER:$USER /var/www/kristal
cd /var/www/kristal/weebplace

# Клонирование (замените на ваш репозиторий)
git clone https://github.com/your-username/weebplace.git .

# Установка зависимостей
cd server
npm install --production

# Создание .env
cat > .env << EOF
PORT=3000
NODE_ENV=production
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGIN=*
EOF

# Создание директорий
mkdir -p uploads/avatars
```

### 2. Настройка systemd:

```bash
# Копирование service файла
sudo cp /var/www/kristal/weebplace/server/weebplace.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable weebplace
sudo systemctl start weebplace

# Проверка
sudo systemctl status weebplace
curl http://localhost:3000/health
```

### 3. Настройка Nginx:

**Если у вас НЕТ домена (работа по IP):**
```bash
# Копирование конфигурации без домена
sudo cp /var/www/kristal/weebplace/server/nginx.conf.no-domain /etc/nginx/sites-available/weebplace

# Проверьте путь к uploads в конфиге (должен быть правильным)
# Активация
sudo ln -s /etc/nginx/sites-available/weebplace /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

**Если у вас ЕСТЬ домен:**
```bash
# Копирование конфигурации
sudo cp /var/www/kristal/weebplace/server/nginx.conf /etc/nginx/sites-available/weebplace

# Редактирование (измените server_name на ваш домен)
sudo nano /etc/nginx/sites-available/weebplace

# Активация
sudo ln -s /etc/nginx/sites-available/weebplace /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Настройка firewall:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## ✅ Готово!

Сервер должен быть доступен по адресу:
- `http://your-vds-ip/api`
- Health check: `http://your-vds-ip/health`

## 📝 Обновление кода:

```bash
cd /var/www/kristal/weebplace
git pull
cd server
npm install --production
sudo systemctl restart weebplace
```

## 🔍 Полезные команды:

```bash
# Логи
sudo journalctl -u weebplace -f

# Статус
sudo systemctl status weebplace

# Перезапуск
sudo systemctl restart weebplace
```

---

**Подробная инструкция:** см. `DEPLOY_UBUNTU24.md`

