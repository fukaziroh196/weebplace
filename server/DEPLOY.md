# Инструкция по развертыванию на VDS (Ubuntu 24)

## 1. Подготовка сервера

```bash
# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Устанавливаем Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Проверяем версии
node -v
npm -v

# Устанавливаем PM2 для управления процессом
sudo npm install -g pm2

# Устанавливаем Nginx
sudo apt install -y nginx
```

## 2. Настройка приложения

```bash
# Создаем директорию для приложения
sudo mkdir -p /var/www/kristal
cd /var/www/kristal

# Клонируем или загружаем проект
# Если используете git:
# git clone <your-repo> .

# Или копируем файлы через scp:
# scp -r server/ user@your-vds-ip:/var/www/kristal/

# Переходим в директорию сервера
cd /var/www/kristal/server

# Устанавливаем зависимости
npm install
```

## 3. Настройка переменных окружения

```bash
# Создаем файл .env
sudo nano .env
```

Добавьте:
```
PORT=3000
JWT_SECRET=your-super-secret-random-string-change-this
NODE_ENV=production
```

Сгенерируйте секретный ключ:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. Создание системного пользователя

```bash
# Создаем пользователя для приложения
sudo useradd -m -s /bin/bash kristal
sudo chown -R kristal:kristal /var/www/kristal

# Настраиваем права на папку загрузок
sudo mkdir -p /var/www/kristal/server/uploads
sudo chown -R kristal:kristal /var/www/kristal
```

## 5. Настройка PM2

```bash
# Переключаемся на пользователя приложения
sudo -u kristal bash

# Запускаем приложение через PM2
cd /var/www/kristal/server
pm2 start index.js --name kristal-backend

# Настраиваем автозапуск при перезагрузке
pm2 save
pm2 startup systemd

# Проверяем статус
pm2 status
pm2 logs kristal-backend
```

## 6. Настройка Nginx

```bash
# Создаем конфигурацию
sudo nano /etc/nginx/sites-available/kristal
```

Добавьте:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Замените на ваш домен или IP

    # Максимальный размер загружаемых файлов
    client_max_body_size 10M;

    # API Backend
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Загруженные файлы
    location /uploads {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Frontend (если будете деплоить фронтенд тоже)
    # location / {
    #     root /var/www/kristal/dist;
    #     try_files $uri $uri/ /index.html;
    # }
}
```

Активируем конфигурацию:
```bash
sudo ln -s /etc/nginx/sites-available/kristal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 7. Настройка Firewall

```bash
# Открываем необходимые порты
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 8. Настройка SSL (опционально, но рекомендуется)

```bash
# Устанавливаем Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получаем SSL сертификат
sudo certbot --nginx -d your-domain.com

# Автопродление настроится автоматически
```

## 9. Управление приложением

```bash
# Посмотреть логи
pm2 logs kristal-backend

# Перезапустить
pm2 restart kristal-backend

# Остановить
pm2 stop kristal-backend

# Посмотреть статус
pm2 status
```

## 10. Бэкап базы данных

```bash
# Создаем скрипт бэкапа
sudo nano /var/www/kristal/backup.sh
```

Добавьте:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/kristal"
mkdir -p $BACKUP_DIR

# Бэкап базы данных
cp /var/www/kristal/server/database.sqlite $BACKUP_DIR/database_$DATE.sqlite

# Бэкап загруженных файлов
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/kristal/server/uploads/

# Удаляем старые бэкапы (старше 7 дней)
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

Делаем скрипт исполняемым:
```bash
chmod +x /var/www/kristal/backup.sh

# Добавляем в cron для ежедневного бэкапа
sudo crontab -e
# Добавьте строку:
# 0 2 * * * /var/www/kristal/backup.sh
```

## 11. Мониторинг

Установите мониторинг:
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## Полезные команды

```bash
# Проверка использования ресурсов
pm2 monit

# Просмотр всех процессов
pm2 list

# Перезагрузка сервера
sudo reboot

# Проверка работы API
curl http://localhost:3000/api

# Проверка логов Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

## Доступ к API

После настройки ваш API будет доступен по адресам:
- HTTP: http://your-domain.com/api
- HTTPS: https://your-domain.com/api

Тестируйте эндпоинты:
```bash
# Регистрация
curl -X POST http://your-domain.com/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'

# Логин
curl -X POST http://your-domain.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'
```

