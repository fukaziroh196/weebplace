const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const AdmZip = require('adm-zip');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const { cache, get: cacheGet, set: cacheSet, flushAll: cacheFlushAll } = require('./cache');
const registerLeaderboardRoutes = require('./routes/leaderboard');
const registerStatsRoutes = require('./routes/stats');
const registerNewsRoutes = require('./routes/news');
const registerAnimeGuessesRoutes = require('./routes/animeGuesses');
const { body, param, query, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET;

// Security: JWT_SECRET обязателен в продакшене
if (!JWT_SECRET && NODE_ENV === 'production') {
  console.error('❌ ERROR: JWT_SECRET is required in production!');
  console.error('Set JWT_SECRET in .env file or environment variables');
  process.exit(1);
}

if (!JWT_SECRET) {
  console.warn('⚠️  WARNING: Using default JWT_SECRET. This is insecure for production!');
}

const SECRET = JWT_SECRET || 'your-super-secret-key-change-in-production';

// ============ SECURITY MIDDLEWARE ============
// Helmet для безопасности заголовков
app.use(helmet({
  contentSecurityPolicy: false, // Отключаем для API
  crossOriginEmbedderPolicy: false
}));

// Compression для уменьшения размера ответов
app.use(compression());

// Логирование запросов
if (NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Rate limiting для защиты от DDoS
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // максимум 100 запросов с одного IP
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // максимум 5 попыток входа/регистрации
  message: { error: 'Too many authentication attempts, please try again later.' },
  skipSuccessfulRequests: true,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 20, // максимум 20 загрузок в час
  message: { error: 'Too many uploads, please try again later.' },
});

// CORS настройка
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*', // В продакшене укажите конкретный домен
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parser с увеличенным лимитом для загрузки файлов
app.use(express.json({ limit: '50mb' })); // Увеличено для больших файлов
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Применяем rate limiting
app.use('/api/', apiLimiter);
app.use('/api/register', authLimiter);
app.use('/api/login', authLimiter);
app.use('/api/anime-guesses', uploadLimiter);
app.use('/api/packs', uploadLimiter);
// Статические файлы - только для чтения, без выполнения
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    // Устанавливаем безопасные заголовки
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    
    // Для изображений устанавливаем правильный Content-Type
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    }
  }
}));

// Создаем папки если их нет
const uploadsDir = path.join(__dirname, 'uploads');
const avatarsDir = path.join(__dirname, 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

// Настройка multer для загрузки файлов (общая)
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

// Безопасная настройка multer для аватаров
const avatarStorage = multer.memoryStorage(); // Используем memory storage для обработки через Sharp

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // Максимум 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Разрешаем только JPEG и PNG
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const allowedExtensions = /\.(jpg|jpeg|png)$/i;
    
    const isValidMime = allowedMimeTypes.includes(file.mimetype);
    const isValidExt = allowedExtensions.test(file.originalname);
    
    if (isValidMime && isValidExt) {
      return cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения в формате JPEG или PNG'));
    }
  }
});

// Функция для безопасной обработки и сохранения аватара
async function processAvatarImage(fileBuffer, userId) {
  try {
    // 1. Проверяем реальный формат через Sharp
    const metadata = await sharp(fileBuffer).metadata();
    
    // Проверяем, что это действительно изображение
    if (!metadata.format || !['jpeg', 'png'].includes(metadata.format)) {
      throw new Error('Файл не является валидным изображением JPEG или PNG');
    }
    
    // 2. Проверяем размеры изображения
    const MAX_DIMENSION = 6000;
    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
      throw new Error(`Размер изображения слишком большой. Максимум: ${MAX_DIMENSION}x${MAX_DIMENSION}px`);
    }
    
    // 3. Генерируем безопасное имя файла (UUID)
    const fileId = uuidv4();
    const filename = `${fileId}.jpg`; // Всегда сохраняем как JPG для безопасности
    
    // 4. Пересохраняем изображение через Sharp (это уничтожит любой вредоносный код)
    // Обрезаем до квадрата и масштабируем до 512x512
    const outputPath = path.join(avatarsDir, filename);
    
    await sharp(fileBuffer)
      .resize(512, 512, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ 
        quality: 90,
        mozjpeg: true
      })
      .toFile(outputPath);
    
    // 5. Возвращаем относительный путь
    return `/uploads/avatars/${filename}`;
  } catch (error) {
    console.error('[processAvatarImage] Error:', error);
    throw error;
  }
}

// Функция для удаления старого аватара
function deleteOldAvatar(avatarUrl) {
  if (!avatarUrl || !avatarUrl.startsWith('/uploads/avatars/')) {
    return; // Не удаляем, если это не наш аватар или data URL
  }
  
  const filename = path.basename(avatarUrl);
  const filePath = path.join(avatarsDir, filename);
  
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log('[deleteOldAvatar] Deleted:', filePath);
    } catch (error) {
      console.error('[deleteOldAvatar] Error deleting file:', error);
    }
  }
}

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
    hint1_image TEXT,
    hint2_image TEXT,
    created_at INTEGER NOT NULL,
    guessed_by TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Migration: ensure quiz_date column exists
  db.get(`PRAGMA table_info(anime_guesses)`, (err, row) => {
    // no-op; we'll try to add column blindly, ignore error if exists
    db.run(`ALTER TABLE anime_guesses ADD COLUMN quiz_date TEXT`, (e) => { /* ignore */ });
  });
  
  // Migration: ensure hint columns exist
  db.run(`ALTER TABLE anime_guesses ADD COLUMN hint1_image TEXT`, (e) => { /* ignore duplicate column */ });
  db.run(`ALTER TABLE anime_guesses ADD COLUMN hint2_image TEXT`, (e) => { /* ignore duplicate column */ });

  // Таблица для очков пользователей
  db.run(`CREATE TABLE IF NOT EXISTS user_scores (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    quiz_type TEXT NOT NULL,
    score INTEGER NOT NULL,
    quiz_date TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Таблица для новостей проекта
  db.run(`CREATE TABLE IF NOT EXISTS project_news (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

// Таблица для баттл паков
db.run(`CREATE TABLE IF NOT EXISTS battle_packs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
)`);

// Таблица для аниме в баттл паках
db.run(`CREATE TABLE IF NOT EXISTS anime_battles (
  id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  anime_id TEXT NOT NULL,
  source_id TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (pack_id) REFERENCES battle_packs(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
)`);

  // Таблица для результатов баттлов
  db.run(`CREATE TABLE IF NOT EXISTS battle_results (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    anime_id TEXT NOT NULL,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    quiz_date TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Таблица для библиотек пользователей
  db.run(`CREATE TABLE IF NOT EXISTS user_libraries (
    user_id TEXT,
    data_type TEXT,
    data_content TEXT,
    PRIMARY KEY (user_id, data_type),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Таблица для опенингов
  db.run(`CREATE TABLE IF NOT EXISTS openings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    youtube_url TEXT NOT NULL,
    start_time INTEGER DEFAULT 0,
    end_time INTEGER DEFAULT 20,
    quiz_date TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    created_by TEXT,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`);
  
  // Migration: ensure quiz_date column exists in openings table
  db.get(`PRAGMA table_info(openings)`, (err) => {
    if (err) {
      console.error('[Migration] Error checking openings table:', err);
      return;
    }
    // Try to add quiz_date column if it doesn't exist
    db.run(`ALTER TABLE openings ADD COLUMN quiz_date TEXT`, (alterErr) => {
      if (alterErr && !alterErr.message.includes('duplicate column')) {
        console.error('[Migration] Error adding quiz_date to openings:', alterErr);
      } else if (!alterErr) {
        console.log('[Migration] Added quiz_date column to openings table');
      }
    });
  });

  // Таблица для угаданных квизов (решает race condition)
  db.run(`CREATE TABLE IF NOT EXISTS quiz_guesses (
    quiz_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    guessed_at INTEGER NOT NULL,
    PRIMARY KEY (quiz_id, user_id),
    FOREIGN KEY (quiz_id) REFERENCES anime_guesses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // ============ ИНДЕКСЫ ДЛЯ ОПТИМИЗАЦИИ ============
  console.log('[DB] Creating indexes for performance...');
  
  // Индексы для anime_guesses
  db.run(`CREATE INDEX IF NOT EXISTS idx_anime_guesses_quiz_date ON anime_guesses(quiz_date)`, (err) => {
    if (err && !err.message.includes('already exists')) console.error('[DB] Index error:', err);
  });
  db.run(`CREATE INDEX IF NOT EXISTS idx_anime_guesses_user_id ON anime_guesses(user_id)`, (err) => {
    if (err && !err.message.includes('already exists')) console.error('[DB] Index error:', err);
  });
  
  // Индексы для user_scores
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_scores_user_id ON user_scores(user_id)`, (err) => {
    if (err && !err.message.includes('already exists')) console.error('[DB] Index error:', err);
  });
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_scores_quiz_date ON user_scores(quiz_date)`, (err) => {
    if (err && !err.message.includes('already exists')) console.error('[DB] Index error:', err);
  });
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_scores_quiz_type ON user_scores(quiz_type)`, (err) => {
    if (err && !err.message.includes('already exists')) console.error('[DB] Index error:', err);
  });
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_scores_user_type_date ON user_scores(user_id, quiz_type, quiz_date)`, (err) => {
    if (err && !err.message.includes('already exists')) console.error('[DB] Index error:', err);
  });
  
  // Индексы для battle_results
  db.run(`CREATE INDEX IF NOT EXISTS idx_battle_results_user_date ON battle_results(user_id, quiz_date)`, (err) => {
    if (err && !err.message.includes('already exists')) console.error('[DB] Index error:', err);
  });
  
  // Индексы для openings
  db.run(`CREATE INDEX IF NOT EXISTS idx_openings_quiz_date ON openings(quiz_date)`, (err) => {
    if (err && !err.message.includes('already exists')) console.error('[DB] Index error:', err);
  });
  
  // Индексы для project_news
  db.run(`CREATE INDEX IF NOT EXISTS idx_project_news_created_at ON project_news(created_at DESC)`, (err) => {
    if (err && !err.message.includes('already exists')) console.error('[DB] Index error:', err);
  });
  
  // Индекс для quiz_guesses (уже есть PRIMARY KEY, но добавим для user_id)
  db.run(`CREATE INDEX IF NOT EXISTS idx_quiz_guesses_user_id ON quiz_guesses(user_id)`, (err) => {
    if (err && !err.message.includes('already exists')) console.error('[DB] Index error:', err);
  });
  
  console.log('[DB] Indexes created successfully');
});

// Middleware для проверки JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Проверка админа
function requireAdmin(req, res, next) {
  console.log('[requireAdmin] Checking user:', req.user);
  if (!req.user.isAdmin) {
    console.log('[requireAdmin] Access denied: isAdmin =', req.user.isAdmin);
    return res.status(403).json({ error: 'Admin access required' });
  }
  console.log('[requireAdmin] Access granted');
  next();
}

// Кэширование: общая функция инвалидировать все кэши статистики/лидерборда
function invalidateCache() {
  cacheFlushAll();
}

// ============ ВАЛИДАЦИЯ ============
// Middleware для обработки ошибок валидации
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Подключение вынесенных роутов
registerLeaderboardRoutes(app, { db, cacheGet, cacheSet });
registerStatsRoutes(app, { db, cacheGet, cacheSet });
registerNewsRoutes(app, { db, authenticateToken, requireAdmin, handleValidationErrors });
registerAnimeGuessesRoutes(app, { db });

// ============ API ENDPOINTS ============

// Регистрация
app.post('/api/register', [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores')
    .escape(),
  body('password')
    .isLength({ min: 4, max: 100 })
    .withMessage('Password must be between 4 and 100 characters')
    .custom((value) => {
      if (value.includes(' ')) {
        throw new Error('Password cannot contain spaces');
      }
      return true;
    }),
  handleValidationErrors
], async (req, res) => {
  const { username, password } = req.body;

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

        const token = jwt.sign({ id: userId, username, isAdmin: false }, SECRET);
        res.json({ user: { id: userId, username, isAdmin: false }, token });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Логин
app.post('/api/login', [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .escape(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
], (req, res) => {
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
      SECRET
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

// Загрузка аватара (безопасный endpoint)
app.post('/api/me/avatar', authenticateToken, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }

    console.log('[POST /api/me/avatar] Upload request from user:', req.user.id);
    console.log('[POST /api/me/avatar] File info:', {
      mimetype: req.file.mimetype,
      size: req.file.size,
      originalname: req.file.originalname
    });

    // Получаем текущего пользователя для удаления старого аватара
    db.get('SELECT avatar_url FROM users WHERE id = ?', [req.user.id], async (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      try {
        // Обрабатываем и сохраняем новый аватар
        const newAvatarUrl = await processAvatarImage(req.file.buffer, req.user.id);
        
        // Удаляем старый аватар, если он существует
        if (user.avatar_url) {
          deleteOldAvatar(user.avatar_url);
        }

        // Обновляем в базе данных
        db.run(
          'UPDATE users SET avatar_url = ? WHERE id = ?',
          [newAvatarUrl, req.user.id],
          function(updateErr) {
            if (updateErr) {
              console.error('[POST /api/me/avatar] Database error:', updateErr);
              return res.status(500).json({ error: 'Ошибка при сохранении аватара в базу данных' });
            }

            console.log('[POST /api/me/avatar] Avatar uploaded successfully for user:', req.user.id);

            res.json({
              success: true,
              avatarUrl: newAvatarUrl
            });
          }
        );
      } catch (processError) {
        console.error('[POST /api/me/avatar] Processing error:', processError);
        res.status(400).json({ 
          error: processError.message || 'Ошибка при обработке изображения' 
        });
      }
    });
  } catch (error) {
    console.error('[POST /api/me/avatar] Error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Удаление аватара
app.delete('/api/me/avatar', authenticateToken, (req, res) => {
  db.get('SELECT avatar_url FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.avatar_url) {
      deleteOldAvatar(user.avatar_url);
    }

    db.run(
      'UPDATE users SET avatar_url = NULL WHERE id = ?',
      [req.user.id],
      function(updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: 'Ошибка при удалении аватара' });
        }

        res.json({ success: true, avatarUrl: null });
      }
    );
  });
});

// Обновление профиля пользователя (безопасная версия - только для других полей, не аватара)
app.patch('/api/me', authenticateToken, (req, res) => {
  // Удаляем avatarUrl из body, если он есть - аватары загружаются через отдельный endpoint
  const { avatarUrl, ...otherFields } = req.body;
  
  if (avatarUrl !== undefined) {
    return res.status(400).json({ 
      error: 'Для загрузки аватара используйте POST /api/me/avatar. Для удаления используйте DELETE /api/me/avatar' 
    });
  }

  // Здесь можно добавить обновление других полей профиля
  // Пока просто возвращаем текущего пользователя
  db.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
      id: user.id,
      username: user.username,
      isAdmin: !!user.is_admin,
      avatarUrl: user.avatar_url
    });
  });
});

// Статистика пользователя: уникальные дни, текущее/лучшее комбо, распределение по датам
app.get('/api/stats/me', authenticateToken, (req, res) => {
  const userId = req.user.id;
  db.all('SELECT quiz_date, guessed_by FROM anime_guesses WHERE quiz_date IS NOT NULL', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const dates = new Set();
    const counts = {};
    for (const r of rows || []) {
      let users = [];
      try { users = JSON.parse(r.guessed_by || '[]'); } catch (_) { users = []; }
      if (Array.isArray(users) && users.includes(userId)) {
        dates.add(r.quiz_date);
        counts[r.quiz_date] = (counts[r.quiz_date] || 0) + 1;
      }
    }

    const list = Array.from(dates).sort();
    function isNextDay(a, b) { // returns true if b is the next day after a
      try {
        const da = new Date(a + 'T00:00:00Z');
        const dbd = new Date(b + 'T00:00:00Z');
        const diff = (dbd - da) / (24*3600*1000);
        return Math.round(diff) === 1;
      } catch (_) { return false; }
    }
    let currentStreak = 0, bestStreak = 0;
    let prev = null;
    for (const d of list) {
      if (prev && isNextDay(prev, d)) currentStreak += 1; else currentStreak = 1;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
      prev = d;
    }

    // todayGuessed: if today's UTC date exists in list
    const today = (() => { const t=new Date(); return `${t.getUTCFullYear()}-${String(t.getUTCMonth()+1).padStart(2,'0')}-${String(t.getUTCDate()).padStart(2,'0')}`; })();
    const todayGuessed = dates.has(today);

    res.json({
      totalDays: list.length,
      currentStreak,
      bestStreak,
      todayGuessed,
      perDayCounts: counts
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

      invalidateCache();
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

// Пакетная загрузка: ZIP с картинками и manifest.csv (filename,title,animeId,sourceId,quizDate)
app.post('/api/anime-guesses/batch', authenticateToken, requireAdmin, upload.single('archive'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'archive is required' });

    const defaultQuizDate = (req.body.quizDate || '').trim();
    const zipPath = path.join(uploadsDir, req.file.filename);
    fs.renameSync(path.join(uploadsDir, req.file.filename), zipPath); // already in uploadsDir

    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    let manifestCsv = null;
    for (const e of entries) {
      if (/manifest\.csv$/i.test(e.entryName)) { manifestCsv = e.getData().toString('utf8'); break; }
    }
    if (!manifestCsv) return res.status(400).json({ error: 'manifest.csv not found in archive' });

    function parseCsv(text) {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (!lines.length) return [];
      const header = lines[0].replace(/;/g, ',').split(',').map(h => h.trim());
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].replace(/;/g, ',').split(',');
        const row = {};
        header.forEach((h, idx) => row[h] = (cols[idx] || '').trim());
        rows.push(row);
      }
      return rows;
    }

    const items = parseCsv(manifestCsv);
    if (!items.length) return res.status(400).json({ error: 'manifest.csv is empty' });

    let created = 0;
    const createdItems = [];
    for (const it of items) {
      const filename = it.filename || it.file || it.image || '';
      const title = it.title || '';
      const animeId = it.animeId || it.anime_id || '';
      const sourceId = it.sourceId || it.source_id || null;
      let quizDate = (it.quizDate || it.quiz_date || defaultQuizDate || '').trim();
      if (!filename || !title || !animeId) continue;

      // Normalize quizDate
      try {
        if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(quizDate)) {
          const d = new Date();
          quizDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
        }
      } catch (_) {}

      // Extract image entry
      const entry = entries.find(e => path.basename(e.entryName) === filename);
      if (!entry) continue;
      const buf = entry.getData();
      const uniqueName = Date.now().toString() + '-' + Math.round(Math.random() * 1e9) + path.extname(filename);
      const outPath = path.join(uploadsDir, uniqueName);
      fs.writeFileSync(outPath, buf);
      const imageUrl = `/uploads/${uniqueName}`;

      const guessId = Date.now().toString() + Math.random().toString(36).substring(7);
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO anime_guesses (id, user_id, image_url, title, anime_id, source_id, quiz_date, created_at, guessed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [guessId, req.user.id, imageUrl, title, animeId, sourceId || null, quizDate, Date.now(), '[]'],
          function(err) { if (err) reject(err); else resolve(); }
        );
      });
      created++;
      createdItems.push({ id: guessId, imageUrl, title, animeId, sourceId, quizDate });
    }

    // Remove uploaded zip to save space
    try { fs.unlinkSync(zipPath); } catch (_) {}

    invalidateCache();
    res.json({ created, items: createdItems });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Валидация ZIP перед загрузкой: возвращает разобранный manifest и отсутствующие файлы
app.post('/api/anime-guesses/batch/validate', authenticateToken, requireAdmin, upload.single('archive'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'archive is required' });
    const zipPath = path.join(uploadsDir, req.file.filename);
    fs.renameSync(path.join(uploadsDir, req.file.filename), zipPath);

    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    let manifestCsv = null;
    for (const e of entries) { if (/manifest\.csv$/i.test(e.entryName)) { manifestCsv = e.getData().toString('utf8'); break; } }
    if (!manifestCsv) { try { fs.unlinkSync(zipPath); } catch(_){}; return res.status(400).json({ error: 'manifest.csv not found' }); }

    const lines = manifestCsv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const header = lines[0].replace(/;/g, ',').split(',').map(h => h.trim());
    const items = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].replace(/;/g, ',').split(',');
      const row = {}; header.forEach((h, idx) => row[h] = (cols[idx] || '').trim());
      if (Object.keys(row).length) items.push(row);
    }
    const filesInZip = new Set(entries.map(e => path.basename(e.entryName)));
    const missingFiles = [];
    let ok = 0;
    for (const it of items) {
      const f = (it.filename || it.file || it.image || '').trim();
      if (!f || !filesInZip.has(f)) missingFiles.push(f || '(empty)'); else ok++;
    }
    try { fs.unlinkSync(zipPath); } catch(_){}
    res.json({ total: items.length, ok, missing: missingFiles.slice(0, 100), sample: items.slice(0, 10) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Пример ZIP с manifest.csv
app.get('/api/anime-guesses/batch/sample', (req, res) => {
  try {
    const date = (req.query.date || '').trim();
    const d = date || (() => { const x=new Date(); return `${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,'0')}-${String(x.getUTCDate()).padStart(2,'0')}`; })();
    const zip = new AdmZip();
    const manifest = [
      'filename,title,animeId,sourceId,quizDate',
      `01.jpg,Fullmetal Alchemist,12345,shikimori,${d}`,
      `02.png,Naruto,20,anilist,${d}`
    ].join('\n');
    zip.addFile('manifest.csv', Buffer.from(manifest, 'utf8'));
    const readme = 'Добавьте свои изображения 01.jpg, 02.png и обновите manifest.csv. Дата может быть разной по строкам.';
    zip.addFile('README.txt', Buffer.from(readme, 'utf8'));
    const buf = zip.toBuffer();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="aniguess-batch-sample.zip"');
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// List available quiz dates (desc)
app.get('/api/anime-guesses/dates', (req, res) => {
  db.all('SELECT DISTINCT quiz_date as date FROM anime_guesses WHERE quiz_date IS NOT NULL ORDER BY quiz_date DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json((rows || []).map(r => r.date));
  });
});

// === Atomic pack upload (exactly 4 images for a specific date) ===
// fields: image1..image4, title1..title4, optional animeId1..4, sourceId1..4, required quizDate
app.post('/api/packs', authenticateToken, requireAdmin, upload.fields([
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 },
  { name: 'image3', maxCount: 1 },
  { name: 'image4', maxCount: 1 },
  { name: 'hint1_1', maxCount: 1 },
  { name: 'hint1_2', maxCount: 1 },
  { name: 'hint1_3', maxCount: 1 },
  { name: 'hint1_4', maxCount: 1 },
  { name: 'hint2_1', maxCount: 1 },
  { name: 'hint2_2', maxCount: 1 },
  { name: 'hint2_3', maxCount: 1 },
  { name: 'hint2_4', maxCount: 1 },
]), (req, res) => {
  console.log('[/api/packs] New pack upload request');
  
  // Validate quiz date
  let quizDate = String(req.body.quizDate || '').trim();
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(quizDate)) {
    console.error('[/api/packs] Invalid quizDate:', quizDate);
    return res.status(400).json({ error: 'quizDate (YYYY-MM-DD) is required' });
  }
  
  // Validate images and titles
  const images = [req.files?.image1?.[0], req.files?.image2?.[0], req.files?.image3?.[0], req.files?.image4?.[0]];
  const titles = [req.body.title1, req.body.title2, req.body.title3, req.body.title4].map((t) => String(t || '').trim());

  // Validate hint images (optional)
  const hint1Images = [req.files?.[`hint1_1`]?.[0], req.files?.[`hint1_2`]?.[0], req.files?.[`hint1_3`]?.[0], req.files?.[`hint1_4`]?.[0]];
  const hint2Images = [req.files?.[`hint2_1`]?.[0], req.files?.[`hint2_2`]?.[0], req.files?.[`hint2_3`]?.[0], req.files?.[`hint2_4`]?.[0]];

  for (let i = 0; i < 4; i++) {
    if (!images[i]) {
      console.error(`[/api/packs] Missing image${i+1}`);
      return res.status(400).json({ error: `Missing image${i+1}` });
    }
    if (!titles[i]) {
      console.error(`[/api/packs] Missing title${i+1}`);
      return res.status(400).json({ error: `Missing title${i+1}` });
    }
  }

  console.log(`[/api/packs] Date: ${quizDate}, Images: ${images.map(f => f.filename).join(', ')}`);
  console.log(`[/api/packs] Titles: ${titles.join(' | ')}`);

  // Start transaction: replace pack for this date atomically
  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (beginErr) => {
      if (beginErr) {
        console.error('[/api/packs] BEGIN error:', beginErr);
        return res.status(500).json({ error: 'Transaction start failed' });
      }

      // Step 1: Delete old entries for this date
      db.run('DELETE FROM anime_guesses WHERE quiz_date = ?', [quizDate], function (delErr) {
        if (delErr) {
          console.error('[/api/packs] DELETE error:', delErr);
          db.run('ROLLBACK');
          return res.status(500).json({ error: `Failed to clear old pack: ${delErr.message}` });
        }

        console.log(`[/api/packs] Deleted ${this.changes} old entries for ${quizDate}`);

        // Step 2: Insert new 4 entries
        const createdItems = [];
        let errorOccurred = null;
        let remaining = 4;

        images.forEach((img, idx) => {
          const imageUrl = `/uploads/${img.filename}`;
          const guessId = Date.now().toString() + Math.random().toString(36).substring(7) + '-' + idx;
          const title = titles[idx];
          const animeId = String(req.body[`animeId${idx + 1}`] || `manual-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`);
          const sourceId = req.body[`sourceId${idx + 1}`] || 'manual';

          // Handle hint images
          const hint1Url = hint1Images[idx] ? `/uploads/${hint1Images[idx].filename}` : null;
          const hint2Url = hint2Images[idx] ? `/uploads/${hint2Images[idx].filename}` : null;

          db.run(
            'INSERT INTO anime_guesses (id, user_id, image_url, title, anime_id, source_id, quiz_date, hint1_image, hint2_image, created_at, guessed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [guessId, req.user.id, imageUrl, title, animeId, sourceId, quizDate, hint1Url, hint2Url, Date.now(), '[]'],
            function (insertErr) {
              if (insertErr && !errorOccurred) {
                console.error(`[/api/packs] INSERT error for ${title}:`, insertErr);
                errorOccurred = insertErr;
              } else if (!insertErr) {
                console.log(`[/api/packs] ✓ Inserted ${idx+1}/4: ${title}`);
                createdItems.push({ 
                  id: guessId, 
                  imageUrl, 
                  image: imageUrl,
                  title, 
                  animeId, 
                  sourceId, 
                  quizDate,
                  guessedBy: []
                });
              }

              remaining -= 1;

              // All 4 inserts finished
              if (remaining === 0) {
                if (errorOccurred) {
                  console.error('[/api/packs] Rolling back due to insert errors');
                  db.run('ROLLBACK', () => {
                    res.status(500).json({ error: `Insert failed: ${errorOccurred.message}` });
                  });
                } else {
                  db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                      console.error('[/api/packs] COMMIT error:', commitErr);
                      db.run('ROLLBACK');
                      return res.status(500).json({ error: `Commit failed: ${commitErr.message}` });
                    }
                    console.log(`[/api/packs] ✓✓✓ Successfully committed pack for ${quizDate} ✓✓✓`);
                    invalidateCache();
                    res.json({ 
                      success: true,
                      created: createdItems.length, 
                      items: createdItems,
                      quizDate
                    });
                  });
                }
              }
            }
          );
        });
      });
    });
  });
});

// Удалить картинку (только админ)
app.delete('/api/anime-guesses/:id', authenticateToken, requireAdmin, [
  param('id')
    .trim()
    .notEmpty()
    .withMessage('Quiz ID is required')
    .escape(),
  handleValidationErrors
], (req, res) => {
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

      invalidateCache();
      res.json({ success: true });
    });
  });
});

// Отдельный endpoint для подсказок больше не нужен - они загружаются с паком

// Проверить ответ в игре
app.post('/api/anime-guesses/:id/check', authenticateToken, [
  param('id')
    .trim()
    .notEmpty()
    .withMessage('Quiz ID is required')
    .escape(),
  body('answer')
    .trim()
    .notEmpty()
    .withMessage('Answer is required')
    .isLength({ max: 200 })
    .withMessage('Answer is too long')
    .escape(),
  handleValidationErrors
], (req, res) => {
  const { id } = req.params;
  const { answer } = req.body;

  db.get('SELECT * FROM anime_guesses WHERE id = ?', [id], (err, guess) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!guess) {
      return res.status(404).json({ error: 'Guess not found' });
    }

    const correct = answer.toLowerCase().trim() === guess.title.toLowerCase().trim();
    
    if (correct) {
      // Использование новой таблицы quiz_guesses для предотвращения race condition
      // INSERT OR IGNORE гарантирует атомарность - если запись уже есть, она просто игнорируется
      db.run(
        'INSERT OR IGNORE INTO quiz_guesses (quiz_id, user_id, guessed_at) VALUES (?, ?, ?)',
        [id, req.user.id, Date.now()],
        function(insertErr) {
          if (insertErr) {
            console.error('[quiz check] Error inserting guess:', insertErr);
            return res.status(500).json({ error: 'Failed to save guess' });
          }
          
          // Также обновляем старую таблицу для обратной совместимости (можно будет убрать позже)
          // Но делаем это только если INSERT был успешным (this.changes > 0 означает что запись была добавлена)
          if (this.changes > 0) {
            db.get('SELECT guessed_by FROM anime_guesses WHERE id = ?', [id], (getErr, row) => {
              if (!getErr && row) {
                try {
                  const guessedBy = JSON.parse(row.guessed_by || '[]');
                  if (!guessedBy.includes(req.user.id)) {
                    guessedBy.push(req.user.id);
                    db.run('UPDATE anime_guesses SET guessed_by = ? WHERE id = ?', 
                      [JSON.stringify(guessedBy), id], 
                      (updateErr) => {
                        if (updateErr) console.error('[quiz check] Error updating guessed_by:', updateErr);
                      });
                  }
                } catch (parseErr) {
                  console.error('[quiz check] Error parsing guessed_by:', parseErr);
                }
              }
            });
          }
          
          invalidateCache();
          res.json({ correct: true, title: guess.title });
        }
      );
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
app.get('/api/library', authenticateToken, [
  query('type')
    .optional()
    .isIn(['watched', 'favorites', 'wishlist', 'dropped', 'ratings', 'notInterested', 'friends', 'friendRequestsIncoming', 'friendRequestsOutgoing', 'comments', 'notifications'])
    .withMessage('Invalid dataType'),
  handleValidationErrors
], (req, res) => {
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

// ==================== OPENINGS ENDPOINTS ====================

// GET /api/openings - Получить опенинги (по дате или все)
app.get('/api/openings', (req, res) => {
  const { date } = req.query;
  
  let query = 'SELECT id, title, youtube_url, start_time, end_time, quiz_date, created_at FROM openings';
  let params = [];
  
  if (date) {
    query += ' WHERE quiz_date = ?';
    params.push(date);
  }
  
  query += ' ORDER BY quiz_date DESC, created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('[GET /api/openings] Error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows || []);
  });
});

// POST /api/openings - Добавить опенинг (только для админа)
app.post('/api/openings', authenticateToken, requireAdmin, (req, res) => {
  console.log('[POST /api/openings] Request body:', req.body);
  console.log('[POST /api/openings] User:', req.user);
  
  const { quizDate, title, youtubeUrl, startTime, endTime } = req.body;

  if (!quizDate || !title || !youtubeUrl) {
    console.error('[POST /api/openings] Missing required fields');
    return res.status(400).json({ error: 'Quiz date, title and YouTube URL are required' });
  }

  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(quizDate)) {
    console.error('[POST /api/openings] Invalid date format:', quizDate);
    return res.status(400).json({ error: 'Invalid date format (YYYY-MM-DD required)' });
  }

  const id = Date.now().toString() + Math.random().toString(36).substring(7);
  const createdAt = Date.now();
  const userId = req.user?.id || null;

  console.log('[POST /api/openings] Inserting new opening:', {
    id, title, youtubeUrl, startTime, endTime, quizDate, userId
  });

  db.run(
    'INSERT INTO openings (id, title, youtube_url, start_time, end_time, quiz_date, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, title, youtubeUrl, startTime || 0, endTime || 20, quizDate, createdAt, userId],
    function (err) {
      if (err) {
        console.error('[POST /api/openings] INSERT Error:', err);
        console.error('[POST /api/openings] Error message:', err.message);
        console.error('[POST /api/openings] Error stack:', err.stack);
        return res.status(500).json({ error: err.message || 'Database error' });
      }

      console.log('[POST /api/openings] Success! Opening created with ID:', id);
      
      res.json({
        success: true,
        opening: {
          id,
          title,
          youtube_url: youtubeUrl,
          start_time: startTime || 0,
          end_time: endTime || 20,
          quiz_date: quizDate,
          created_at: createdAt
        }
      });
    }
  );
});

// DELETE /api/openings/:id - Удалить опенинг (только для админа)
app.delete('/api/openings/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM openings WHERE id = ?', [id], function (err) {
    if (err) {
      console.error('[DELETE /api/openings] Error:', err);
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Opening not found' });
    }

    res.json({ success: true, deleted: this.changes });
  });
});

// Submit quiz score
app.post('/api/scores', authenticateToken, (req, res) => {
  const { quizType, score, date } = req.body;
  
  if (!quizType || typeof score !== 'number' || !date) {
    return res.status(400).json({ error: 'quizType, score, and date are required' });
  }
  
  const scoreId = `score_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  db.run(
    'INSERT INTO user_scores (id, user_id, quiz_type, score, quiz_date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [scoreId, req.user.id, quizType, score, date, Date.now()],
    function(err) {
      if (err) {
        console.error('[POST /api/scores] Error:', err);
        return res.status(500).json({ error: err.message });
      }
      
      console.log(`[POST /api/scores] Score submitted: ${score} points for ${quizType} by ${req.user.username}`);
      invalidateCache();
      res.json({ success: true, scoreId });
    }
  );
});

// ==================== BATTLE ENDPOINTS ====================

// GET /api/battle-packs - Получить список баттл паков
app.get('/api/battle-packs', (req, res) => {
  db.all('SELECT id, name, description, created_at FROM battle_packs ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      console.error('[GET /api/battle-packs] Error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ packs: rows || [] });
  });
});

// GET /api/battles/:packId - Получить аниме для конкретного баттл пака
app.get('/api/battles/:packId', (req, res) => {
  const { packId } = req.params;
  
  db.all('SELECT id, title, image_url as image, anime_id, source_id, created_at FROM anime_battles WHERE pack_id = ? ORDER BY created_at', [packId], (err, rows) => {
    if (err) {
      console.error('[GET /api/battles/:packId] Error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ anime: rows || [] });
  });
});

// POST /api/battle-packs - Создать новый баттл пак (только для админа)
app.post('/api/battle-packs', authenticateToken, requireAdmin, (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Pack name is required' });
  }
  
  const packId = `pack_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  db.run(
    'INSERT INTO battle_packs (id, name, description, user_id, created_at) VALUES (?, ?, ?, ?, ?)',
    [packId, name, description || '', req.user.id, Date.now()],
    function(err) {
      if (err) {
        console.error('[POST /api/battle-packs] Error:', err);
        return res.status(500).json({ error: err.message });
      }
      
      console.log(`[POST /api/battle-packs] Battle pack created: ${name} by ${req.user.username}`);
      res.json({ success: true, id: packId });
    }
  );
});

// POST /api/battles - Добавить аниме в баттл пак (только для админа)
app.post('/api/battles', authenticateToken, requireAdmin, upload.single('image'), (req, res) => {
  const { title, animeId, sourceId, packId } = req.body;
  
  if (!title || !animeId || !packId || !req.file) {
    return res.status(400).json({ error: 'title, animeId, packId, and image file are required' });
  }
  
  const imageUrl = `/uploads/${req.file.filename}`;
  const battleId = `battle_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  db.run(
    'INSERT INTO anime_battles (id, pack_id, user_id, title, image_url, anime_id, source_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [battleId, packId, req.user.id, title, imageUrl, animeId, sourceId || 'manual', Date.now()],
    function(err) {
      if (err) {
        console.error('[POST /api/battles] Error:', err);
        return res.status(500).json({ error: err.message });
      }
      
      console.log(`[POST /api/battles] Battle anime added: ${title} to pack ${packId} by ${req.user.username}`);
      res.json({ success: true, id: battleId, imageUrl });
    }
  );
});

// POST /api/battle-results - Сохранить результаты баттла
app.post('/api/battle-results', authenticateToken, (req, res) => {
  const { date, results } = req.body;
  
  if (!date || !Array.isArray(results)) {
    return res.status(400).json({ error: 'date and results array are required' });
  }
  
  // Удаляем старые результаты для этой даты
  db.run('DELETE FROM battle_results WHERE user_id = ? AND quiz_date = ?', [req.user.id, date], (err) => {
    if (err) {
      console.error('[POST /api/battle-results] DELETE error:', err);
      return res.status(500).json({ error: err.message });
    }
    
    // Добавляем новые результаты
    let completed = 0;
    let errorOccurred = null;
    
    if (results.length === 0) {
      return res.json({ success: true });
    }
    
    results.forEach((result, index) => {
      const resultId = `result_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}`;
      
      db.run(
        'INSERT INTO battle_results (id, user_id, anime_id, wins, losses, points, quiz_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [resultId, req.user.id, result.animeId, result.wins, result.losses, result.points, date, Date.now()],
        function(err) {
          if (err && !errorOccurred) {
            console.error('[POST /api/battle-results] INSERT error:', err);
            errorOccurred = err;
          }
          
          completed++;
          if (completed === results.length) {
            if (errorOccurred) {
              return res.status(500).json({ error: errorOccurred.message });
            }
            
            console.log(`[POST /api/battle-results] Results saved for ${req.user.username} on ${date}`);
            invalidateCache();
            res.json({ success: true });
          }
        }
      );
    });
  });
});

// GET /api/battle-results - Получить результаты баттлов
app.get('/api/battle-results', (req, res) => {
  const { date, userId } = req.query;
  
  let query = `
    SELECT br.*, ab.title, ab.image_url as image 
    FROM battle_results br 
    LEFT JOIN anime_battles ab ON br.anime_id = ab.anime_id AND br.quiz_date = ab.quiz_date
  `;
  let params = [];
  let conditions = [];
  
  if (date) {
    conditions.push('br.quiz_date = ?');
    params.push(date);
  }
  
  if (userId) {
    conditions.push('br.user_id = ?');
    params.push(userId);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY br.points DESC, br.wins DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('[GET /api/battle-results] Error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows || []);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  
  // Multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
    return res.status(400).json({ error: err.message });
  }
  
  // Default error
  res.status(err.status || 500).json({ 
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

// Graceful shutdown
let server;

function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('HTTP server closed.');
    
    // Закрываем базу данных
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        process.exit(1);
      } else {
        console.log('Database closed.');
        process.exit(0);
      }
    });
  });
  
  // Принудительное завершение через 10 секунд
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Запуск сервера
server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
});

// Обработка сигналов для graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Обработка необработанных ошибок
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Не завершаем процесс, только логируем
});

