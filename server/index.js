const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Создаем папки если их нет
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Инициализация базы данных
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Создание таблиц
db.serialize(() => {
  // Таблица пользователей
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    is_admin INTEGER DEFAULT 0,
    avatar_url TEXT
  )`);

  // Таблица для игры "Угадай аниме"
  db.run(`CREATE TABLE IF NOT EXISTS anime_guesses (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    image_url TEXT NOT NULL,
    title TEXT NOT NULL,
    anime_id TEXT NOT NULL,
    source_id TEXT,
    quiz_date TEXT,
    created_at INTEGER NOT NULL,
    guessed_by TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Migration: ensure quiz_date column exists
  db.get(`PRAGMA table_info(anime_guesses)`, (err, row) => {
    // no-op; we'll try to add column blindly, ignore error if exists
    db.run(`ALTER TABLE anime_guesses ADD COLUMN quiz_date TEXT`, (e) => { /* ignore */ });
  });

  // Таблица для библиотек пользователей
  db.run(`CREATE TABLE IF NOT EXISTS user_libraries (
    user_id TEXT,
    data_type TEXT,
    data_content TEXT,
    PRIMARY KEY (user_id, data_type),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
});

// Middleware для проверки JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Проверка админа
function requireAdmin(req, res, next) {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ============ API ENDPOINTS ============

// Регистрация
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password || password.length < 4) {
    return res.status(400).json({ error: 'Username and password (min 4 chars) required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = Date.now().toString() + Math.random().toString(36).substring(7);
    
    db.run(
      'INSERT INTO users (id, username, password_hash, created_at, is_admin) VALUES (?, ?, ?, ?, 0)',
      [userId, username, hashedPassword, Date.now()],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Username already exists' });
          }
          return res.status(500).json({ error: err.message });
        }

        const token = jwt.sign({ id: userId, username, isAdmin: false }, JWT_SECRET);
        res.json({ user: { id: userId, username, isAdmin: false }, token });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Логин
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, isAdmin: !!user.is_admin },
      JWT_SECRET
    );

    res.json({
      user: {
        id: user.id,
        username: user.username,
        isAdmin: !!user.is_admin,
        avatarUrl: user.avatar_url
      },
      token
    });
  });
});

// Получить текущего пользователя
app.get('/api/me', authenticateToken, (req, res) => {
  db.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      isAdmin: !!user.is_admin,
      avatarUrl: user.avatar_url
    });
  });
});

// Загрузка картинки для "Угадай аниме" (только админ)
app.post('/api/anime-guesses', authenticateToken, requireAdmin, upload.single('image'), (req, res) => {
  const { title, animeId, sourceId } = req.body;
  let quizDate = (req.body.quizDate || '').trim();
  // Normalize quizDate to YYYY-MM-DD (UTC)
  try {
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(quizDate)) {
      const d = new Date();
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      quizDate = `${y}-${m}-${day}`;
    }
  } catch (_) {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    quizDate = `${y}-${m}-${day}`;
  }

  if (!req.file || !title || !animeId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  const guessId = Date.now().toString() + Math.random().toString(36).substring(7);

  db.run(
    'INSERT INTO anime_guesses (id, user_id, image_url, title, anime_id, source_id, quiz_date, created_at, guessed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [guessId, req.user.id, imageUrl, title, animeId, sourceId || null, quizDate, Date.now(), '[]'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json({
        id: guessId,
        imageUrl,
        title,
        animeId,
        sourceId,
        quizDate,
        createdAt: Date.now(),
        guessedBy: []
      });
    }
  );
});

// Получить все картинки для "Угадай аниме"
app.get('/api/anime-guesses', (req, res) => {
  const qDate = (req.query.date || '').trim();
  const send = (guesses) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const parsedGuesses = guesses.map(guess => ({
      id: guess.id,
      image: guess.image_url,
      title: guess.title,
      animeId: guess.anime_id,
      sourceId: guess.source_id,
      quizDate: guess.quiz_date,
      createdAt: guess.created_at,
      guessedBy: JSON.parse(guess.guessed_by || '[]')
    }));

    res.json(parsedGuesses);
  };

  if (qDate) {
    db.all('SELECT * FROM anime_guesses WHERE quiz_date = ? ORDER BY created_at DESC', [qDate], (err, rows) => send(rows));
  } else {
    db.get('SELECT quiz_date as d FROM anime_guesses ORDER BY quiz_date DESC LIMIT 1', [], (err, row) => {
      const latest = row?.d || null;
      if (!latest) return db.all('SELECT * FROM anime_guesses ORDER BY created_at DESC', [], (e, rows) => send(rows));
      db.all('SELECT * FROM anime_guesses WHERE quiz_date = ? ORDER BY created_at DESC', [latest], (e, rows) => send(rows));
    });
  }
});

// List available quiz dates (desc)
app.get('/api/anime-guesses/dates', (req, res) => {
  db.all('SELECT DISTINCT quiz_date as date FROM anime_guesses WHERE quiz_date IS NOT NULL ORDER BY quiz_date DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json((rows || []).map(r => r.date));
  });
});

// Удалить картинку (только админ)
app.delete('/api/anime-guesses/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  // Сначала получим информацию о файле
  db.get('SELECT image_url FROM anime_guesses WHERE id = ?', [id], (err, guess) => {
    if (err || !guess) {
      return res.status(404).json({ error: 'Guess not found' });
    }

    // Удалим файл
    const imagePath = path.join(__dirname, guess.image_url);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Удалим запись из БД
    db.run('DELETE FROM anime_guesses WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json({ success: true });
    });
  });
});

// Проверить ответ в игре
app.post('/api/anime-guesses/:id/check', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { answer } = req.body;

  db.get('SELECT * FROM anime_guesses WHERE id = ?', [id], (err, guess) => {
    if (err || !guess) {
      return res.status(404).json({ error: 'Guess not found' });
    }

    const correct = answer.toLowerCase().trim() === guess.title.toLowerCase().trim();
    
    if (correct) {
      // Добавить пользователя в список угадавших
      const guessedBy = JSON.parse(guess.guessed_by || '[]');
      if (!guessedBy.includes(req.user.id)) {
        guessedBy.push(req.user.id);
        
        db.run('UPDATE anime_guesses SET guessed_by = ? WHERE id = ?', [JSON.stringify(guessedBy), id], (err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
        });
      }

      res.json({ correct: true, title: guess.title });
    } else {
      res.json({ correct: false });
    }
  });
});

// Сохранение библиотеки пользователя
app.post('/api/library', authenticateToken, (req, res) => {
  const { dataType, data } = req.body;
  const userId = req.user.id;

  if (!dataType) {
    return res.status(400).json({ error: 'dataType is required' });
  }

  db.run(
    `INSERT INTO user_libraries (user_id, data_type, data_content) 
     VALUES (?, ?, ?)
     ON CONFLICT(user_id, data_type) DO UPDATE SET data_content = ?`,
    [userId, dataType, JSON.stringify(data), JSON.stringify(data)],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json({ success: true });
    }
  );
});

// Получение библиотеки пользователя
app.get('/api/library', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const dataType = req.query.type;

  let query = 'SELECT data_type, data_content FROM user_libraries WHERE user_id = ?';
  let params = [userId];

  if (dataType) {
    query += ' AND data_type = ?';
    params.push(dataType);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const library = {};
    rows.forEach(row => {
      library[row.data_type] = JSON.parse(row.data_content || '[]');
    });

    res.json(library);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

