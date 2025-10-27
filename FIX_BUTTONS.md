# Фикс кликабельности кнопок

## Что было исправлено

### 1. Кнопка "ПОВТОРИТЬ ПРЕДЫДУЩИЕ ДНИ"
✅ Добавлен `cursor: pointer`
✅ Добавлена функция `openReplay()` с логированием
✅ Добавлен эффект `:active` для визуального отклика
✅ Исправлен обработчик `on:click` в модалке

### 2. Кнопки квизов (АРКАДА)
✅ Заменены динамические импорты на прямые вызовы `activeView.set()`
✅ Добавлен `cursor: pointer`
✅ Добавлены console.log для отладки
✅ Добавлен эффект `:active` для визуального отклика

### 3. Модальное окно ReplayDatesModal
✅ Исправлен синтаксис `on:click|stopPropagation`
✅ Добавлено логирование при открытии и выборе даты
✅ Улучшена обработка Escape

## Что изменилось в коде

### Content.svelte
- Кнопки квизов теперь используют `activeView.set('guessAnime')` вместо динамических импортов
- Добавлены функции `openReplay()` и `closeReplay()` с логированием
- Добавлены стили `:active` для всех кнопок

### ReplayDatesModal.svelte
- Исправлен баг с запятой в атрибуте `style`
- Добавлено логирование открытия модалки и выбора даты

## Как проверить

1. Обновить код:
```bash
cd ~/Documents/GitHub/weebplace
git pull
npm run dev
```

2. Открыть http://127.0.0.1:5173

3. Открыть консоль браузера (F12)

4. Нажать на любую кнопку квиза - должен появиться лог:
   ```
   [Content] GoTo GuessAnime
   ```

5. Нажать "ПОВТОРИТЬ ПРЕДЫДУЩИЕ ДНИ" - должны появиться логи:
   ```
   [Content] Opening replay modal, dates: [...]
   [ReplayDatesModal] Opened, available dates: 2 ['2025-10-27', '2025-10-26']
   ```

6. Выбрать дату - должен появиться лог:
   ```
   [ReplayDatesModal] Chosen date: 2025-10-27
   [Content] Closing replay modal
   ```

7. Вернуться в главное меню (нажать "AniQuiz" в сайдбаре) - все кнопки должны быть кликабельными

## Если всё ещё не работает

### Проверь консоль браузера (F12)
- Должны появляться логи `[Content]` и `[ReplayDatesModal]`
- Если логов нет — кнопки не реагируют на клик (проблема с z-index или перекрытием)
- Если логи есть, но экран не меняется — проблема в навигации

### Проверь что нет перекрывающих элементов
```css
/* В app.css или инспекторе браузера проверь что у всех кнопок: */
cursor: pointer;
position: relative; /* или static */
z-index: auto; /* или низкое значение, не блокирует клики */
pointer-events: auto; /* не none */
```

### Проверь activeView
В консоли браузера выполни:
```javascript
// Проверить текущий activeView
import('../stores/ui.js').then(m => m.activeView.subscribe(v => console.log('activeView:', v)))

// Переключить вручную
import('../stores/ui.js').then(m => m.activeView.set('home'))
```

## На всякий случай - полный рестарт

```bash
# Останови npm run dev (Ctrl+C)
cd ~/Documents/GitHub/weebplace
rm -rf node_modules/.vite  # Очистить кеш Vite
npm run dev
# Открой в инкогнито или сделай Hard Refresh (Ctrl+Shift+R)
```

