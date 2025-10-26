# Интеграция фронтенда с Backend API

## Настройка

### 1. Установите зависимости сервера

```bash
cd server
npm install
```

### 2. Запустите сервер

```bash
npm start
```

Сервер будет доступен на `http://localhost:3000`

### 3. Измените API URL в проекте

Откройте `src/lib/api.js` и измените URL на ваш:

```javascript
const API_URL = 'http://localhost:3000/api';
// Или на продакшн:
// const API_URL = 'https://your-domain.com/api';
```

## Изменения в коде

### Обновите auth.js

Вместо текущего `src/stores/auth.js`, используйте новый `src/stores/authApi.js`:

```javascript
// В компонентах, где импортируется auth:
import { currentUser, login, register, logout } from '../stores/authApi';
```

### Обновите GuessAnimeView.svelte

Добавьте импорт API:

```javascript
import { animeGuesses as animeGuessesApi } from '../lib/api';
```

И обновите функции:

```javascript
// Загрузка с API
async function loadAnimeGuesses() {
  try {
    animeGuesses = await animeGuessesApi.getAll();
  } catch (error) {
    console.error('Failed to load guesses:', error);
    animeGuesses = [];
  }
}

// Загрузка на сервер
async function uploadImage() {
  if (!selectedFile || !selectedAnime) {
    alert('Выберите картинку и аниме из списка');
    return;
  }
  
  try {
    const result = await animeGuessesApi.upload(
      selectedFile,
      selectedAnime.title,
      selectedAnime.id,
      selectedAnime.__sourceId
    );
    
    animeGuesses = [...animeGuesses, result];
    selectedFile = null;
    selectedAnime = null;
    adminSearchQuery = '';
    document.getElementById('fileInput').value = '';
    alert('Картинка загружена!');
  } catch (error) {
    alert('Ошибка загрузки: ' + error.message);
  }
}

// Удаление с сервера
async function deleteGuess(id) {
  if (confirm('Удалить эту картинку?')) {
    try {
      await animeGuessesApi.delete(id);
      animeGuesses = animeGuesses.filter(g => g.id !== id);
    } catch (error) {
      alert('Ошибка удаления: ' + error.message);
    }
  }
}

// Проверка ответа на сервере
async function checkAnswer() {
  const guessId = animeGuesses[currentImageIndex]?.id;
  if (!guessId || !userAnswer.trim()) return;
  
  try {
    const result = await animeGuessesApi.checkAnswer(guessId, userAnswer);
    
    if (result.correct) {
      alert('Правильно! 🎉');
      userAnswer = '';
      // Обновим локальные данные
      animeGuesses[currentImageIndex].guessedBy = result.guessedBy;
    } else {
      alert('Неправильно! Попробуйте еще раз.');
    }
  } catch (error) {
    alert('Ошибка проверки: ' + error.message);
  }
}
```

## Тестирование

1. Запустите сервер: `cd server && npm start`
2. Запустите приложение: `npm run dev`
3. Зарегистрируйтесь или войдите
4. Как админ, загрузите картинки в "Угадай аниме"
5. Проверьте, что картинки сохраняются в БД

## Продакшн деплой

1. Загрузите код на VDS
2. Запустите сервер на VDS (см. server/DEPLOY.md)
3. Измените API_URL в `src/lib/api.js` на URL вашего сервера
4. Пересоберите приложение: `npm run build`

