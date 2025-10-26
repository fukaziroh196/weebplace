# 🚀 Деплой через GitHub

## ⚙️ Настройка GitHub Actions для автоматического деплоя

### 1. Подготовка VDS

Выполните на VDS (один раз):

```bash
# Создайте директорию
sudo mkdir -p /var/www/kristal
cd /var/www/kristal

# Установите Git
sudo apt install -y git

# Клонируйте репозиторий (или создайте новый)
git init
git remote add origin https://github.com/your-username/your-repo.git

# Установите Node.js и PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# Создайте SSH ключ для автоматического деплоя
ssh-keygen -t rsa -b 4096 -C "deploy" -f ~/.ssh/deploy_key -N ""

# Покажите публичный ключ
cat ~/.ssh/deploy_key.pub

# Добавьте ключ в authorized_keys
cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys

# Покажите приватный ключ (его нужно добавить в GitHub Secrets)
cat ~/.ssh/deploy_key
```

### 2. Настройка GitHub Secrets

1. Откройте ваш репозиторий на GitHub
2. Перейдите: Settings → Secrets and variables → Actions
3. Добавьте следующие секреты:

```
VDS_HOST=your-vds-ip-address
VDS_USER=your-username
VDS_SSH_KEY=<приватный ключ из предыдущего шага>
```

### 3. Настройка репозитория

```bash
# Инициализируйте Git (если еще не сделали)
git init

# Добавьте remote
git remote add origin https://github.com/your-username/your-repo.git

# Добавьте файлы
git add .

# Сделайте коммит
git commit -m "Initial commit with backend"

# Запушьте в main ветку
git branch -M main
git push -u origin main
```

### 4. Настройка workflow (уже создан)

Файл `.github/workflows/deploy.yml` уже создан и готов к работе!

### 5. Первый деплой

После пуша в main ветку, GitHub Actions автоматически:
- Подключится к вашему VDS
- Загрузит код
- Установит зависимости
- Перезапустит сервер

### 6. Дальнейшие деплои

Просто делайте `git push` в main ветку — деплой запустится автоматически!

```bash
git add .
git commit -m "Update code"
git push
```

## 📝 Ручной деплой (альтернатива)

Если не хотите использовать GitHub Actions:

### Вариант 1: Через скрипт

```bash
chmod +x server/deploy.sh
./server/deploy.sh user@your-vds-ip
```

### Вариант 2: Ручной SSH

```bash
# Загрузите файлы
scp -r server/ user@your-vds-ip:/var/www/kristal/

# Подключитесь к VDS
ssh user@your-vds-ip

# В терминале VDS:
cd /var/www/kristal/server
npm install
pm2 restart kristal-backend
```

## 🔄 Обновление кода

После изменения кода:

```bash
git add .
git commit -m "Your changes"
git push
```

GitHub Actions автоматически развернет изменения.

## 📊 Мониторинг деплоя

Смотрите логи деплоя в GitHub:
- Перейдите: Actions → Deploy to VDS → Последний запуск

На VDS смотрите логи сервера:
```bash
ssh user@your-vds-ip
pm2 logs kristal-backend
```

## 🛠️ Устранение проблем

### Деплой не запускается
- Проверьте секреты в GitHub Settings → Secrets
- Убедитесь, что workflow файл в `.github/workflows/`

### Ошибка подключения
- Проверьте SSH ключ
- Убедитесь, что порт 22 открыт
- Проверьте права на ключ: `chmod 600`

### Сервер не запускается
```bash
ssh user@your-vds-ip
cd /var/www/kristal/server
npm start  # Проверьте ошибки
```

## 🔐 Безопасность

1. **Никогда не коммитьте секреты в Git**
2. **Используйте GitHub Secrets**
3. **Меняйте JWT_SECRET регулярно**
4. **Настройте firewall на VDS**
5. **Используйте SSL сертификаты**

## 📋 Чек-лист первого деплоя

- [ ] VDS настроен (Node.js, PM2, Nginx)
- [ ] SSH ключ создан и добавлен в GitHub Secrets
- [ ] GitHub Secrets настроены (VDS_HOST, VDS_USER, VDS_SSH_KEY)
- [ ] Код залит в GitHub
- [ ] Workflow файл на месте
- [ ] Первый деплой успешно выполнен
- [ ] Сервер доступен по IP/домену

## 🎉 Готово!

Теперь каждый push в main автоматически деплоит приложение!

