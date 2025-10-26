# 🚀 Backend для Kristal - Полная инструкция

## 📁 Что создано

```
📦 Backend сервер
  ├── server/
  │   ├── index.js          # API сервер (Express)
  │   ├── package.json      # Зависимости  
  │   ├── DEPLOY.md         # Инструкции по деплою на VDS
  │   ├── API.md            # Документация API
  │   └── README.md         # Описание
  │
📡 API клиент
  ├── src/lib/api.js        # Клиент для работы с API
  └── src/config.js         # Конфигурация API URL
  │
📚 Документация
  ├── INTEGRATION_GUIDE.md  # Инструкция по интеграции
  └── API_INTEGRATION.md    # Детали интеграции
```

## ⚡ Быстрый старт (Локально)

### 1. Установите зависимости сервера

```bash
cd server
npm install
```

### 2. Создайте `.env` файл

```bash
PORT=3000
JWT_SECRET=ваш-случайный-ключ-тут
NODE_ENV=development
```

### 3. Запустите сервер

```bash
npm start
```

Сервер запустится на `http://localhost:3000`

### 4. Запустите фронтенд

В другом терминале:

```bash
npm run dev
```

Приложение запустится на `http://localhost:5173`

## 📋 API Endpoints

### Публичные
- `POST /api/register` - Регистрация
- `POST /api/login` - Логин  
- `GET /api/anime-guesses` - Получить все картинки

### Требуют авторизации
- `GET /api/me` - Текущий пользователь
- `POST /api/anime-guesses/:id/check` - Проверить ответ
- `POST /api/library` - Сохранить библиотеку
- `GET /api/library` - Получить библиотеку

### Только админ
- `POST /api/anime-guesses` - Загрузить картинку
- `DELETE /api/anime-guesses/:id` - Удалить картинку

## 🌐 Деплой на VDS

См. подробную инструкцию в **`server/DEPLOY.md`**

Кратко:
```bash
# 1. Установите Node.js на VDS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs pm2 nginx

# 2. Загрузите файлы сервера
scp -r server/ user@your-vds-ip:/var/www/kristal/

# 3. Запустите
cd /var/www/kristal/server
npm install
pm2 start index.js

# 4. Настройте Nginx (см. DEPLOY.md)
```

## 🔧 Интеграция фронтенда

См. **`INTEGRATION_GUIDE.md`** - там пошаговая инструкция

## 📦 Что умеет Backend

✅ **Аутентификация**
- Регистрация/логин
- JWT токены
- Роли (админ/пользователь)
- Хэширование паролей (bcrypt)

✅ **Игра "Угадай аниме"**
- Загрузка картинок (админ)
- Получение списка картинок
- Проверка ответов
- Подсчет статистики (кто угадал)
- Удаление картинок

✅ **Библиотеки пользователей**
- Сохранение списков аниме
- Просмотренное, избранное, etc.
- Персональные данные

✅ **Хранение**
- SQLite база данных
- Загруженные файлы в папке `uploads/`
- Автоматическое создание таблиц

## 🔐 Безопасность

- JWT токены для аутентификации
- Хэширование паролей с bcrypt
- Валидация типов файлов
- Ограничение размера файлов (10MB)
- CORS настроен
- Проверка прав доступа

## 📊 База данных

Автоматически создается файл `database.sqlite`:

**users** - Пользователи  
**anime_guesses** - Картинки для игры  
**user_libraries** - Библиотеки пользователей

## 🔄 Обновление с localStorage на API

1. Все данные теперь на сервере
2. API для синхронизации
3. Работает онлайн
4. Единая база для всех

## 📞 Тестирование

```bash
# Регистрация
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'

# Логин
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'

# Получить картинки
curl http://localhost:3000/api/anime-guesses
```

## 🐛 Отладка

Проверьте логи:
```bash
# На локальном сервере
cd server
node index.js

# На VDS
pm2 logs kristal-backend
```

## 📝 Лицензия

MIT

---

**Готово к использованию!** 🎉

