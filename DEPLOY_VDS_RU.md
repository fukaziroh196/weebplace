# 🚀 Развертывание на VDS - Краткая инструкция

## 🎯 Что нужно сделать?

1. **Подготовить VDS** (один раз)
2. **Создать SSH ключ для автоматического деплоя**
3. **Настроить GitHub Secrets**
4. **Автоматический деплой** при каждом push

---

## 📋 Пошаговая инструкция

### Шаг 1: Подготовка VDS (Ubuntu)

Подключитесь к вашему VDS через SSH:

```bash
ssh ваш-юзер@ваш-ip-адрес
```

Выполните следующие команды:

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

# Устанавливаем Git
sudo apt install -y git

# Создаем директорию для приложения
sudo mkdir -p /var/www/kristal
cd /var/www/kristal
```

---

### Шаг 2: Первоначальная настройка на VDS

```bash
# Клонируем репозиторий с GitHub
git clone https://github.com/ВАШ-USERNAME/ВАШ-РЕПОЗИТОРИЙ.git .

# Переходим в папку сервера
cd server

# Устанавливаем зависимости
npm install

# Создаем .env файл
cat > .env << EOF
PORT=3000
JWT_SECRET=$(openssl rand -hex 32)
NODE_ENV=production
EOF

# Создаем папку для загрузок
mkdir -p uploads

# Запускаем сервер
pm2 start index.js --name kristal-backend
pm2 save
pm2 startup systemd
```

---

### Шаг 3: Создание SSH ключа для автоматического деплоя

На вашем VDS выполните:

```bash
# Создаем SSH ключ
ssh-keygen -t rsa -b 4096 -C "deploy" -f ~/.ssh/deploy_key -N ""

# Добавляем ключ в authorized_keys
cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/deploy_key

# Показываем приватный ключ (скопируйте его!)
cat ~/.ssh/deploy_key
```

**ИМЕННО ЭТОТ КЛЮЧ ВАМ НУЖНО ДОБАВИТЬ В GITHUB SECRETS!**

---

### Шаг 4: Настройка GitHub Secrets

1. Откройте ваш репозиторий на GitHub
2. Перейдите: **Settings** → **Secrets and variables** → **Actions**
3. Нажмите **New repository secret**
4. Добавьте следующие секреты:

| Name | Value |
|------|-------|
| `VDS_HOST` | ваш-юзер@ваш-ip-адрес |
| `VDS_USER` | ваш-юзер |
| `VDS_SSH_KEY` | содержимое ~/.ssh/deploy_key (из шага 3) |

---

### Шаг 5: Создание GitHub Actions workflow

Создайте файл `.github/workflows/deploy.yml` в корне проекта:

```yaml
name: Deploy to VDS

on:
  push:
    branches: [ main, master ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to server
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.VDS_HOST }}
        username: ${{ secrets.VDS_USER }}
        key: ${{ secrets.VDS_SSH_KEY }}
        script: |
          cd /var/www/kristal
          git pull origin main
          cd server
          npm install
          pm2 restart kristal-backend
```

---

### Шаг 6: Первый деплой

После создания workflow файла:

```bash
# На вашем локальном компьютере
git add .github/workflows/deploy.yml
git commit -m "Add automatic deployment"
git push
```

Теперь каждый `git push` будет автоматически деплоить ваш код на VDS! 🎉

---

## 🔍 Как проверить, что все работает?

### На VDS:

```bash
# Проверить статус сервера
pm2 status

# Посмотреть логи
pm2 logs kristal-backend

# Проверить, что сервер работает
curl http://localhost:3000/api
```

### С вашего компьютера:

```bash
# Проверить API (замените на ваш IP)
curl http://ваш-ip-адрес:3000/api
```

---

## 🌐 Подключение к API с фронтенда

В файле `src/config.js` обновите `API_URL`:

```javascript
// Локальная разработка
// export const API_URL = 'http://localhost:3000';

// Production
export const API_URL = 'http://ваш-ip-адрес:3000';
// или
export const API_URL = 'https://ваш-домен.com:3000';
```

---

## 🔄 Обновление кода

Теперь просто делайте:

```bash
git add .
git commit -m "Ваше изменение"
git push
```

И ваш код автоматически обновится на VDS!

---

## 🛠️ Полезные команды

### Управление сервером на VDS:

```bash
# Перезапустить сервер
pm2 restart kristal-backend

# Остановить сервер
pm2 stop kristal-backend

# Запустить сервер
pm2 start kristal-backend

# Посмотреть логи
pm2 logs kristal-backend

# Мониторинг
pm2 monit
```

### Обновление вручную:

```bash
# Подключитесь к VDS
ssh ваш-юзер@ваш-ip-адрес

# Обновите код
cd /var/www/kristal
git pull origin main
cd server
npm install
pm2 restart kristal-backend
```

---

## ❌ Устранение проблем

### Ошибка "Connection refused"

- Проверьте, что сервер запущен: `pm2 status`
- Проверьте, что порт 3000 открыт на VDS

### Ошибка "Permission denied"

- Проверьте права на файлы: `sudo chown -R $USER:$USER /var/www/kristal`

### GitHub Actions не работает

- Проверьте, что секреты VDS_HOST, VDS_USER, VDS_SSH_KEY установлены
- Проверьте логи в GitHub: Actions → Ваш workflow → Runs

### Сервер не запускается

```bash
# Посмотрите логи
pm2 logs kristal-backend

# Запустите вручную для отладки
cd /var/www/kristal/server
npm start
```

---

## 🎉 Готово!

Теперь ваш бэкенд работает на VDS и автоматически обновляется при каждом push в GitHub!

