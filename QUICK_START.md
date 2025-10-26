# ⚡ Быстрый старт - Деплой через GitHub

## 📦 Что нужно

- GitHub аккаунт
- VDS с Ubuntu 24
- SSH доступ к VDS

## 🚀 Шаг 1: Инициализация Git

```bash
# Если Git еще не инициализирован
git init

# Добавьте все файлы (кроме тех, что в .gitignore)
git add .

# Сделайте первый коммит
git commit -m "Initial commit: Kristal anime app with backend"

# Создайте репозиторий на GitHub и добавьте remote
git remote add origin https://github.com/your-username/your-repo.git

# Запушьте код
git push -u origin main
```

## 🔐 Шаг 2: Настройка SSH для деплоя

На вашем VDS выполните:

```bash
# Создайте SSH ключ для деплоя
ssh-keygen -t rsa -b 4096 -C "github-deploy" -f ~/.ssh/github_deploy -N ""

# Скопируйте публичный ключ
cat ~/.ssh/github_deploy.pub

# Добавьте его в authorized_keys
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys

# Скопируйте ПРИВАТНЫЙ ключ (нужен для GitHub)
cat ~/.ssh/github_deploy
```

## 📝 Шаг 3: Настройка GitHub Secrets

1. Откройте ваш GitHub репозиторий
2. Settings → Secrets and variables → Actions
3. Add new secret для каждого:

**VDS_HOST**: IP адрес вашего VDS  
**VDS_USER**: имя пользователя на VDS  
**VDS_SSH_KEY**: приватный ключ из предыдущего шага (весь текст включая `-----BEGIN OPENSSH PRIVATE KEY-----`)

## 🛠️ Шаг 4: Первый деплой на VDS

### 4.1 На VDS выполните:

```bash
# Установите Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Установите PM2
sudo npm install -g pm2

# Установите Git
sudo apt install -y git

# Создайте директорию
sudo mkdir -p /var/www/kristal
cd /var/www/kristal

# Клонируйте репозиторий
git clone https://github.com/your-username/your-repo.git .

# Или если уже есть код
git pull origin main

# Перейдите в папку сервера
cd server

# Установите зависимости
npm install

# Создайте .env
nano .env
```

Добавьте в `.env`:
```env
PORT=3000
JWT_SECRET=ваш-случайный-ключ
NODE_ENV=production
```

Сгенерируйте секрет:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4.2 Запустите сервер

```bash
# Создайте папку для загрузок
mkdir -p uploads

# Запустите сервер
pm2 start index.js --name kristal-backend

# Сохраните процесс
pm2 save

# Проверьте статус
pm2 status
pm2 logs kristal-backend
```

### 4.3 Настройте Nginx

```bash
sudo nano /etc/nginx/sites-available/kristal
```

Добавьте:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # или IP адрес

    client_max_body_size 10M;

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads {
        proxy_pass http://localhost:3000;
    }
}
```

Активируйте:
```bash
sudo ln -s /etc/nginx/sites-available/kristal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## ✅ Шаг 5: Проверка

Проверьте что сервер работает:

```bash
curl http://your-ip/api/anime-guesses
```

Должен вернуть пустой массив `[]`.

## 🔄 Шаг 6: Автоматический деплой

Теперь при каждом push в main ветку, GitHub Actions автоматически обновит код на VDS!

```bash
# Внесите изменения
git add .
git commit -m "Update code"
git push
```

Деплой запустится автоматически. Смотрите процесс в GitHub → Actions.

## 🎯 Итого

- ✅ Код на GitHub
- ✅ Автоматический деплой через GitHub Actions
- ✅ Сервер на VDS
- ✅ Nginx настроен
- ✅ Готово к работе!

## 📞 Полезные команды

```bash
# На VDS - посмотреть логи
pm2 logs kristal-backend

# Перезапустить сервер
pm2 restart kristal-backend

# Обновить код вручную
cd /var/www/kristal
git pull
cd server
pm2 restart kristal-backend
```

