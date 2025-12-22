# 🚀 Деплой без домена (по IP-адресу)

## 📋 Быстрая инструкция для работы по IP

### 1. Настройка VDS

```bash
# Обновление и установка
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git sqlite3

# Создание директории
sudo mkdir -p /var/www/kristal/weebplace
sudo chown -R $USER:$USER /var/www/kristal
cd /var/www/kristal/weebplace

# Клонирование проекта
git clone <your-repo> .

# Установка зависимостей
cd server
npm install --production
```

### 2. Настройка .env файла

```bash
# Создание .env
cat > .env << EOF
PORT=3000
NODE_ENV=production
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGIN=*
EOF
```

**Важно:** `CORS_ORIGIN=*` разрешает запросы с любого домена/IP. Это нормально для работы по IP.

### 3. Создание директорий

```bash
mkdir -p uploads/avatars
chmod -R 755 uploads
```

### 4. Настройка systemd

```bash
# Копирование service файла
sudo cp /var/www/kristal/weebplace/server/weebplace.service /etc/systemd/system/

# Редактирование (если нужно изменить пользователя)
sudo nano /etc/systemd/system/weebplace.service

# Активация
sudo systemctl daemon-reload
sudo systemctl enable weebplace
sudo systemctl start weebplace

# Проверка
sudo systemctl status weebplace
curl http://localhost:3000/health
```

### 5. Настройка Nginx (БЕЗ домена)

```bash
# Копирование конфигурации для работы по IP
sudo cp /var/www/kristal/weebplace/server/nginx.conf.no-domain /etc/nginx/sites-available/weebplace

# Проверка пути к uploads (должен быть правильным)
sudo nano /etc/nginx/sites-available/weebplace

# Активация
sudo ln -s /etc/nginx/sites-available/weebplace /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Проверка конфигурации
sudo nginx -t

# Перезагрузка
sudo systemctl reload nginx
```

### 6. Настройка Firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp  # На будущее, если добавите SSL
sudo ufw --force enable
```

### 7. Получение IP-адреса

```bash
# Узнайте ваш внешний IP
curl ifconfig.me
# или
hostname -I
```

## ✅ Готово!

Ваш сервер будет доступен по адресу:
- **API:** `http://YOUR_VDS_IP/api`
- **Health check:** `http://YOUR_VDS_IP/health`
- **Frontend (если деплоите):** `http://YOUR_VDS_IP/`

## 🔧 Настройка фронтенда

В файле `.env` фронтенда укажите:

```env
VITE_API_URL=http://YOUR_VDS_IP/api
```

Замените `YOUR_VDS_IP` на реальный IP вашего VDS.

## 📝 Обновление кода

```bash
cd /var/www/kristal/weebplace
git pull
cd server
npm install --production
sudo systemctl restart weebplace
```

## 🔍 Проверка работы

```bash
# Health check
curl http://YOUR_VDS_IP/health

# API endpoint
curl http://YOUR_VDS_IP/api/anime-guesses/dates

# Логи
sudo journalctl -u weebplace -f
```

## ⚠️ Важные замечания

### Безопасность при работе по IP:

1. **CORS:** Установлен `CORS_ORIGIN=*` - это нормально для работы по IP, но менее безопасно. Если знаете откуда будут идти запросы, можно указать конкретные IP.

2. **SSL:** Без домена нельзя использовать Let's Encrypt. Если нужен HTTPS:
   - Используйте самоподписанный сертификат (не рекомендуется для продакшена)
   - Или используйте Cloudflare Tunnel
   - Или купите домен (рекомендуется)

3. **Firewall:** Обязательно настройте firewall и ограничьте доступ к портам.

### Рекомендации:

- **Купите домен** (стоит ~$10-15/год) для:
  - SSL сертификата (бесплатный Let's Encrypt)
  - Лучшей безопасности
  - Профессионального вида
  - Простого запоминания адреса

- **Используйте Cloudflare** (бесплатно):
  - DDoS защита
  - SSL даже без домена (через Tunnel)
  - Кэширование

## 🆘 Устранение проблем

### Сервер не доступен извне:

```bash
# Проверьте firewall
sudo ufw status

# Проверьте что сервер слушает на правильном интерфейсе
sudo ss -tlnp | grep :80
sudo ss -tlnp | grep :3000

# Проверьте логи Nginx
sudo tail -f /var/log/nginx/error.log
```

### CORS ошибки:

Убедитесь что в `.env` установлено:
```env
CORS_ORIGIN=*
```

Или укажите конкретные IP/домены:
```env
CORS_ORIGIN=http://YOUR_VDS_IP,http://localhost:5173
```

## 📊 Мониторинг

```bash
# Статус сервиса
sudo systemctl status weebplace

# Логи в реальном времени
sudo journalctl -u weebplace -f

# Использование ресурсов
htop
df -h
```

---

**Готово!** Ваш сервер работает по IP-адресу без домена.

