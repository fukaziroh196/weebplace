# 📡 Интеграция фронтенда с Backend API - Быстрая инструкция

## 🚀 Шаг 1: Запустите Backend сервер

```bash
cd server
npm install
npm start
```

Сервер запустится на `http://localhost:3000`

## 🔧 Шаг 2: Обновите файл `src/lib/api.js`

Уже создан - используйте его.

## 📝 Шаг 3: Обновите `src/components/GuessAnimeView.svelte`

Добавьте в начало файла (после существующих импортов):

```javascript
import { animeGuesses as animeGuessesApi } from '../lib/api';
```

Замените функции:

### 1. Загрузка данных (строки 27-39)
```javascript
async function loadAnimeGuesses() {
  try {
    loading = true;
    animeGuesses = await animeGuessesApi.getAll();
    loading = false;
  } catch (error) {
    console.error('Ошибка загрузки:', error);
    animeGuesses = [];
    loading = false;
  }
}
```

### 2. Загрузка картинки (строки 96-123)
```javascript
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
```

### 3. Удаление (строки 125-130)
```javascript
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
```

### 4. Проверка ответа (строки 167-188)
```javascript
async function checkAnswer() {
  const guessId = animeGuesses[currentImageIndex]?.id;
  if (!guessId || !userAnswer.trim()) return;
  
  try {
    const result = await animeGuessesApi.checkAnswer(guessId, userAnswer);
    
    if (result.correct) {
      const guess = animeGuesses.find(g => g.id === guessId);
      if (guess) {
        guess.guessedBy = result.guessedBy || [];
      }
      alert('Правильно! 🎉');
      userAnswer = '';
    } else {
      alert('Неправильно! Попробуйте еще раз.');
    }
  } catch (error) {
    alert('Ошибка проверки: ' + error.message);
  }
}
```

## 🔑 Шаг 4: Обновите аутентификацию (опционально)

Если хотите использовать API для авторизации, импортируйте из `src/stores/authApi.js`:

```javascript
// В компонентах ProfileView.svelte, UserMenu.svelte и т.д.
import { currentUser, login, register, logout } from '../stores/authApi';
```

## ✅ Шаг 5: Тестируйте

1. Откройте браузер: `http://localhost:5173`
2. Зарегистрируйтесь или войдите как админ
3. Зайдите в "Угадай аниме"
4. Загрузите картинки
5. Проверьте, что они сохраняются в БД на сервере

## 📦 Продакшн деплой

1. Обновите `src/lib/api.js`:
```javascript
const API_URL = 'https://your-domain.com/api';
```

2. Запустите сервер на VDS (см. `server/DEPLOY.md`)

3. Пересоберите фронтенд:
```bash
npm run build
```

Готово! 🎉

