# ⚡ Быстрый старт - Деплой на VDS

## 📝 Краткая инструкция для тех, кто торопится

### Шаг 1: Подготовка VDS (один раз)

Подключитесь к VDS и выполните:

```bash
# Установка необходимого
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs git

# Установка PM2
sudo npm install -g pm2

# Создание директории
sudo mkdir -p /var/www/kristal
cd /var/www/kristal

# Клонирование репозитория
git clone https://github.com/ВАШ-USERNAME/ВАШ-РЕПОЗИТОРИЙ.git .

# Установка зависимостей
cd server
npm install

# Создание .env
cat > .env << EOF
PORT=3000
JWT_SECRET=$(openssl rand -hex 32)
NODE_ENV=production
EOF

# Создание папки для загрузок
mkdir -p uploads

# Запуск сервера
pm2 start index.js --name kristal-backend
pm2 save
pm2 startup systemd
```

### Шаг 2: Настройка GitHub Secrets

1. Откройте GitHub → Settings → Secrets → Actions
2. Добавьте секреты:
   - `VDS_HOST` = ваш-юзер@ваш-ip
   - `VDS_USER` = ваш-юзер  
   - `VDS_SSH_KEY` = приватный SSH ключ (см. инструкцию в DEPLOY_VDS_RU.md)

### Шаг 3: Первый деплой

```bash
git add .
git commit -m "Add deployment workflow"
git push
```

### Шаг 4: Подключение фронтенда к API

В файле `src/config.js` измените:

```javascript
export const API_BASE_URL = 'http://ваш-ip-адрес:3000/api';
```

---

## ✅ Готово! 

Теперь каждый `git push` автоматически деплоит ваш код на VDS.

---

## 🔍 Проверка

```bash
# Проверить статус
ssh ваш-юзер@ваш-ip
pm2 status

# Проверить логи
pm2 logs kristal-backend

# Проверить API
curl http://ваш-ip:3000/api
```

---

## 📚 Подробная инструкция

См. файл [DEPLOY_VDS_RU.md](./DEPLOY_VDS_RU.md)

