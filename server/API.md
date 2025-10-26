# API Документация

## База URL
`http://your-domain.com/api`

## Аутентификация

Все защищенные эндпоинты требуют заголовок:
```
Authorization: Bearer <token>
```

## Эндпоинты

### 1. Регистрация
**POST** `/api/register`

Request body:
```json
{
  "username": "string",
  "password": "string"
}
```

Response:
```json
{
  "user": {
    "id": "string",
    "username": "string",
    "isAdmin": false
  },
  "token": "string"
}
```

---

### 2. Логин
**POST** `/api/login`

Request body:
```json
{
  "username": "string",
  "password": "string"
}
```

Response:
```json
{
  "user": {
    "id": "string",
    "username": "string",
    "isAdmin": false,
    "avatarUrl": "string"
  },
  "token": "string"
}
```

---

### 3. Получить текущего пользователя
**GET** `/api/me` (Auth required)

Response:
```json
{
  "id": "string",
  "username": "string",
  "isAdmin": false,
  "avatarUrl": "string"
}
```

---

### 4. Загрузить картинку для "Угадай аниме"
**POST** `/api/anime-guesses` (Auth required, Admin only)

Content-Type: `multipart/form-data`

Fields:
- `image` (file) - изображение
- `title` (string) - название аниме
- `animeId` (string) - ID аниме
- `sourceId` (string, optional) - ID источника

Response:
```json
{
  "id": "string",
  "imageUrl": "/uploads/filename.jpg",
  "title": "string",
  "animeId": "string",
  "sourceId": "string",
  "createdAt": 1234567890,
  "guessedBy": []
}
```

---

### 5. Получить все картинки
**GET** `/api/anime-guesses`

Response:
```json
[
  {
    "id": "string",
    "image": "/uploads/filename.jpg",
    "title": "string",
    "animeId": "string",
    "sourceId": "string",
    "createdAt": 1234567890,
    "guessedBy": ["user_id_1", "user_id_2"]
  }
]
```

---

### 6. Удалить картинку
**DELETE** `/api/anime-guesses/:id` (Auth required, Admin only)

Response:
```json
{
  "success": true
}
```

---

### 7. Проверить ответ в игре
**POST** `/api/anime-guesses/:id/check` (Auth required)

Request body:
```json
{
  "answer": "string"
}
```

Response (correct):
```json
{
  "correct": true,
  "title": "string"
}
```

Response (incorrect):
```json
{
  "correct": false
}
```

---

### 8. Сохранить библиотеку пользователя
**POST** `/api/library` (Auth required)

Request body:
```json
{
  "dataType": "watched|favorites|wishlist|dropped|ratings",
  "data": {}
}
```

Response:
```json
{
  "success": true
}
```

---

### 9. Получить библиотеку пользователя
**GET** `/api/library?type=<optional>` (Auth required)

Response:
```json
{
  "watched": [],
  "favorites": [],
  "wishlist": [],
  "dropped": [],
  "ratings": {}
}
```

## Коды ошибок

- `400` - Bad Request (некорректные данные)
- `401` - Unauthorized (не авторизован)
- `403` - Forbidden (нет доступа, требуется админ)
- `404` - Not Found
- `500` - Internal Server Error

## Примеры использования

### JavaScript (Fetch API)

```javascript
// Логин
const loginResponse = await fetch('http://your-domain.com/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'test', password: 'test123' })
});

const { token } = await loginResponse.json();

// Загрузка картинки
const formData = new FormData();
formData.append('image', file);
formData.append('title', 'Naruto');
formData.append('animeId', '123');

const uploadResponse = await fetch('http://your-domain.com/api/anime-guesses', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});

// Получить все картинки
const guesses = await fetch('http://your-domain.com/api/anime-guesses');

// Проверить ответ
const checkResponse = await fetch(`http://your-domain.com/api/anime-guesses/${id}/check`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ answer: 'Naruto' })
});
```

### cURL

```bash
# Регистрация
curl -X POST http://your-domain.com/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'

# Логин
curl -X POST http://your-domain.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'

# Загрузка файла (нужен токен)
curl -X POST http://your-domain.com/api/anime-guesses \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@path/to/image.jpg" \
  -F "title=Naruto" \
  -F "animeId=123"
```

