# 🚀 Полная инструкция по деплою на Ubuntu 24

## 📋 Содержание
1. [Первоначальная настройка VDS](#1-первоначальная-настройка-vds)
2. [Клонирование и настройка проекта](#2-клонирование-и-настройка-проекта)
3. [Настройка Nginx](#3-настройка-nginx)
4. [Настройка systemd](#4-настройка-systemd)
5. [Настройка SSL (опционально)](#5-настройка-ssl-опционально)
6. [Деплой обновлений](#6-деплой-обновлений)
7. [Мониторинг и обслуживание](#7-мониторинг-и-обслуживание)

---

## 1. Первоначальная настройка VDS

### Вариант A: Автоматическая настройка

```bash
# На вашем VDS
cd /tmp
wget https://raw.githubusercontent.com/your-repo/weebplace/main/setup-vds.sh
chmod +x setup-vds.sh
./setup-vds.sh
```

### Вариант B: Ручная настройка

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Установка дополнительных пакетов
sudo apt install -y git nginx ufw certbot python3-certbot-nginx sqlite3 build-essential

# Создание директории
sudo mkdir -p /var/www/kristal/weebplace
sudo chown -R $USER:$USER /var/www/kristal

# Настройка firewall
sudo ufw --force enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## 2. Клонирование и настройка проекта

```bash
# Клонирование репозитория
cd /var/www/kristal/weebplace
git clone https://github.com/your-username/weebplace.git .

# Установка зависимостей бэкенда
cd server
npm install --production

# Создание .env файла
cp .env.example .env
nano .env
```

### Настройка .env файла

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Security - ОБЯЗАТЕЛЬНО измените!
# Сгенерируйте: openssl rand -hex 32
JWT_SECRET=ваш-секретный-ключ-здесь

# CORS - укажите ваш домен
CORS_ORIGIN=https://yourdomain.com
# Или для разработки:
# CORS_ORIGIN=*
```

**⚠️ ВАЖНО:** Сгенерируйте безопасный JWT_SECRET:
```bash
openssl rand -hex 32
```

### Создание директорий

```bash
mkdir -p uploads/avatars
chmod -R 755 uploads
```

---

## 3. Настройка Nginx

```bash
# Копирование конфигурации
sudo cp /var/www/kristal/weebplace/server/nginx.conf /etc/nginx/sites-available/weebplace

# Редактирование конфигурации
sudo nano /etc/nginx/sites-available/weebplace
```

**Измените:**
- `server_name _;` → `server_name your-domain.com;`
- Проверьте путь к uploads: `/var/www/kristal/weebplace/server/uploads`

```bash
# Активация конфигурации
sudo ln -s /etc/nginx/sites-available/weebplace /etc/nginx/sites-enabled/

# Удаление дефолтной конфигурации (если есть)
sudo rm -f /etc/nginx/sites-enabled/default

# Проверка конфигурации
sudo nginx -t

# Перезагрузка Nginx
sudo systemctl reload nginx
```

---

## 4. Настройка systemd

```bash
# Копирование service файла
sudo cp /var/www/kristal/weebplace/server/weebplace.service /etc/systemd/system/

# Редактирование (если нужно изменить пользователя)
sudo nano /etc/systemd/system/weebplace.service

# Перезагрузка systemd
sudo systemctl daemon-reload

# Включение автозапуска
sudo systemctl enable weebplace

# Запуск сервиса
sudo systemctl start weebplace

# Проверка статуса
sudo systemctl status weebplace
```

### Проверка работы

```bash
# Health check
curl http://localhost:3000/health

# Проверка логов
sudo journalctl -u weebplace -f
```

---

## 5. Настройка SSL (опционально)

```bash
# Установка Certbot (если еще не установлен)
sudo apt install -y certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d your-domain.com

# Автопродление настроится автоматически
# Проверка: sudo certbot renew --dry-run
```

После получения SSL:
1. Раскомментируйте HTTPS блок в nginx.conf
2. Отредактируйте пути к сертификатам
3. Перезагрузите Nginx: `sudo systemctl reload nginx`

---

## 6. Деплой обновлений

### Вариант A: Автоматический деплой

```bash
# С вашего локального компьютера
./deploy-ubuntu24.sh user@your-vds-ip
```

### Вариант B: Ручной деплой

```bash
# На VDS
cd /var/www/kristal/weebplace

# Обновление кода
git pull origin main

# Установка зависимостей
cd server
npm install --production

# Перезапуск сервиса
sudo systemctl restart weebplace

# Проверка
sudo systemctl status weebplace
curl http://localhost:3000/health
```

---

## 7. Мониторинг и обслуживание

### Просмотр логов

```bash
# Все логи
sudo journalctl -u weebplace -f

# Последние 100 строк
sudo journalctl -u weebplace -n 100

# Логи за сегодня
sudo journalctl -u weebplace --since today
```

### Управление сервисом

```bash
# Статус
sudo systemctl status weebplace

# Перезапуск
sudo systemctl restart weebplace

# Остановка
sudo systemctl stop weebplace

# Запуск
sudo systemctl start weebplace
```

### Резервное копирование

```bash
# Создание скрипта бэкапа
sudo nano /usr/local/bin/weebplace-backup.sh
```

Добавьте:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/weebplace"
mkdir -p $BACKUP_DIR

# Бэкап БД
cp /var/www/kristal/weebplace/server/database.sqlite $BACKUP_DIR/db_$DATE.sqlite

# Бэкап uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz -C /var/www/kristal/weebplace/server uploads/

# Удаление старых бэкапов (старше 7 дней)
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
chmod +x /usr/local/bin/weebplace-backup.sh

# Добавление в cron (ежедневно в 2:00)
sudo crontab -e
# Добавьте:
# 0 2 * * * /usr/local/bin/weebplace-backup.sh
```

### Мониторинг ресурсов

```bash
# Использование памяти и CPU
htop

# Использование диска
df -h

# Размер директорий
du -sh /var/www/kristal/weebplace/server/*
```

### Очистка старых файлов

```bash
# Очистка старых логов
sudo journalctl --vacuum-time=7d

# Очистка старых uploads (если нужно)
find /var/www/kristal/weebplace/server/uploads -type f -mtime +90 -delete
```

---

## 🔧 Устранение проблем

### Сервер не запускается

```bash
# Проверка логов
sudo journalctl -u weebplace -n 50

# Проверка .env файла
cat /var/www/kristal/weebplace/server/.env

# Проверка прав доступа
ls -la /var/www/kristal/weebplace/server/

# Запуск вручную для отладки
cd /var/www/kristal/weebplace/server
node index.js
```

### Nginx ошибки

```bash
# Проверка конфигурации
sudo nginx -t

# Просмотр логов
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Проблемы с правами доступа

```bash
# Установка правильных прав
sudo chown -R www-data:www-data /var/www/kristal/weebplace/server
sudo chmod -R 755 /var/www/kristal/weebplace/server
sudo chmod -R 775 /var/www/kristal/weebplace/server/uploads
```

### Порт занят

```bash
# Проверка занятых портов
sudo ss -tlnp | grep :3000

# Остановка процесса
sudo kill <PID>
# Или
sudo systemctl stop weebplace
```

---

## 📊 Проверка работоспособности

```bash
# Health check
curl http://localhost:3000/health

# API endpoint
curl http://localhost:3000/api/anime-guesses/dates

# С внешнего IP (если настроен)
curl http://your-vds-ip:3000/health
```

---

## ✅ Чеклист деплоя

- [ ] VDS настроен (Node.js, Nginx, firewall)
- [ ] Проект клонирован
- [ ] Зависимости установлены (`npm install`)
- [ ] `.env` файл создан и настроен
- [ ] JWT_SECRET сгенерирован и установлен
- [ ] Nginx настроен и перезагружен
- [ ] systemd service настроен и запущен
- [ ] Health check проходит
- [ ] SSL настроен (опционально)
- [ ] Резервное копирование настроено
- [ ] Мониторинг настроен

---

## 🎉 Готово!

Ваш сервер должен быть доступен по адресу:
- HTTP: `http://your-domain.com/api`
- HTTPS: `https://your-domain.com/api` (если настроен SSL)

Для фронтенда обновите `VITE_API_URL` в `.env`:
```env
VITE_API_URL=https://your-domain.com/api
```

