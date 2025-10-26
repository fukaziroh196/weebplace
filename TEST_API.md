# 🧪 Тестирование API на VDS

## Проверка работы API

Выполните на вашем VDS:

```bash
curl http://localhost:3000/api
```

Или с вашего компьютера:

```bash
curl http://185.177.219.234:3000/api
```

## Тест регистрации пользователя

```bash
curl -X POST http://185.177.219.234:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'
```

## Тест логина

```bash
curl -X POST http://185.177.219.234:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'
```

## 📊 Статус сервера на VDS

```bash
# Подключитесь к VDS
ssh root@185.177.219.234

# Проверьте статус
pm2 status

# Посмотрите логи
pm2 logs kristal-backend

# Мониторинг в реальном времени
pm2 monit
```

## ⚙️ Управление сервером

```bash
# Перезапуск
pm2 restart kristal-backend

# Остановка
pm2 stop kristal-backend

# Запуск
pm2 start kristal-backend

# Посмотреть логи (последние 50 строк)
pm2 logs kristal-backend --lines 50
```

## 🔄 Автоматическое обновление через GitHub

Теперь при каждом `git push` в main ветку, GitHub Actions автоматически:
1. Подключится к VDS
2. Загрузит новый код
3. Установит зависимости
4. Перезапустит сервер

Просто делайте:

```bash
git add .
git commit -m "Ваши изменения"
git push
```

И сервер автоматически обновится!

