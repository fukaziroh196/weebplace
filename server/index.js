const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const AdmZip = require('adm-zip');

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

  // Таблица для баттлов аниме
  db.run(`CREATE TABLE IF NOT EXISTS anime_battles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    anime_id TEXT NOT NULL,
    source_id TEXT,
    quiz_date TEXT NOT NULL,
    created_at INTEGER NOT NULL,
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
  console.log('[requireAdmin] Checking user:', req.user);
  if (!req.user.isAdmin) {
    console.log('[requireAdmin] Access denied: isAdmin =', req.user.isAdmin);
    return res.status(403).json({ error: 'Admin access required' });
  }
  console.log('[requireAdmin] Access granted');
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
// Получить все картинки для "Угадай аниме"
app.get('/api/anime-guesses', (req, res) => {
  const qDate = (req.query.date || '').trim();
  const send = (err, guesses) => {
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
      hint1_image: guess.hint1_image,
      hint2_image: guess.hint2_image,
      createdAt: guess.created_at,
      guessedBy: JSON.parse(guess.guessed_by || '[]')
    }));

    res.json(parsedGuesses);
  };

  if (qDate) {
    db.all('SELECT * FROM anime_guesses WHERE quiz_date = ? ORDER BY created_at DESC', [qDate], (err, rows) => send(err, rows));
  } else {
    // Prefer today's UTC date when not specified
    const today = (() => { const t=new Date(); return `${t.getUTCFullYear()}-${String(t.getUTCMonth()+1).padStart(2,'0')}-${String(t.getUTCDate()).padStart(2,'0')}`; })();
    db.all('SELECT * FROM anime_guesses WHERE quiz_date = ? ORDER BY created_at DESC', [today], (err, rows) => {
      if (err) return send(err);
      if (Array.isArray(rows) && rows.length) return send(null, rows);
      // Fallback to latest non-empty date
      db.get('SELECT quiz_date as d FROM anime_guesses WHERE quiz_date IS NOT NULL ORDER BY quiz_date DESC LIMIT 1', [], (e1, row) => {
        const latest = row?.d || null;
        if (!latest) return db.all('SELECT * FROM anime_guesses ORDER BY created_at DESC', [], (e2, rows2) => send(e2, rows2));
        db.all('SELECT * FROM anime_guesses WHERE quiz_date = ? ORDER BY created_at DESC', [latest], (e3, rows3) => send(e3, rows3));
      });
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

// Leaderboard: count distinct quiz dates where user guessed at least one image
app.get('/api/leaderboard', (req, res) => {
  const limit = Math.max(1, Math.min(200, parseInt(req.query.limit || '50', 10)));
  const period = String(req.query.period || 'all'); // 'all' | 'week' | 'day'
  const dayParam = (req.query.date || '').trim();

  db.all('SELECT quiz_date, guessed_by FROM anime_guesses WHERE quiz_date IS NOT NULL', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    // Determine latest date if needed
    const allDates = Array.from(new Set((rows || []).map(r => r.quiz_date).filter(Boolean))).sort();
    const latest = allDates[allDates.length - 1] || null;

    const inWeekRange = (d, end) => {
      try {
        const endDate = new Date(end + 'T00:00:00Z');
        const startDate = new Date(endDate);
        startDate.setUTCDate(startDate.getUTCDate() - 6);
        const cur = new Date(d + 'T00:00:00Z');
        return cur >= startDate && cur <= endDate;
      } catch (_) { return false; }
    };

    if (period === 'day') {
      const day = dayParam || latest;
      const userIdToGuesses = new Map();
      for (const r of rows || []) {
        if (r.quiz_date !== day) continue;
        let users = [];
        try { users = JSON.parse(r.guessed_by || '[]'); } catch (_) { users = []; }
        if (!Array.isArray(users)) continue;
        for (const uid of users) {
          if (!uid) continue;
          userIdToGuesses.set(uid, (userIdToGuesses.get(uid) || 0) + 1);
        }
      }
      const results = Array.from(userIdToGuesses.entries()).map(([userId, guesses]) => ({ userId, guesses }));
      results.sort((a, b) => b.guesses - a.guesses);
      db.all('SELECT id, username FROM users', [], (e2, users) => {
        if (e2) return res.status(500).json({ error: e2.message });
        const idToName = new Map((users || []).map(u => [u.id, u.username]));
        const top = results.slice(0, limit).map((r, idx) => ({ rank: idx + 1, userId: r.userId, username: idToName.get(r.userId) || 'user', guesses: r.guesses, metric: 'guesses', date: day }));
        res.json(top);
      });
      return;
    }

    // week or all
    const userIdToDates = new Map();
    for (const r of rows || []) {
      const d = r.quiz_date;
      if (!d) continue;
      if (period === 'week' && latest && !inWeekRange(d, latest)) continue;
      let users = [];
      try { users = JSON.parse(r.guessed_by || '[]'); } catch (_) { users = []; }
      if (!Array.isArray(users)) continue;
      for (const uid of users) {
        if (!uid) continue;
        if (!userIdToDates.has(uid)) userIdToDates.set(uid, new Set());
        userIdToDates.get(uid).add(d);
      }
    }
    const results = Array.from(userIdToDates.entries()).map(([userId, dates]) => ({ userId, days: (dates ? dates.size : 0) }));
    results.sort((a, b) => b.days - a.days);
    db.all('SELECT id, username FROM users', [], (e2, users) => {
      if (e2) return res.status(500).json({ error: e2.message });
      const idToName = new Map((users || []).map(u => [u.id, u.username]));
      const top = results.slice(0, limit).map((r, idx) => ({ rank: idx + 1, userId: r.userId, username: idToName.get(r.userId) || 'user', days: r.days, metric: 'days' }));
      res.json(top);
    });
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

// Отдельный endpoint для подсказок больше не нужен - они загружаются с паком

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
      res.json({ success: true, scoreId });
    }
  );
});

// ==================== BATTLE ENDPOINTS ====================

// GET /api/battles - Получить аниме для баттла (все пакеты)
app.get('/api/battles', (req, res) => {
  // Баттлы не привязаны к датам, всегда показываем все
  db.all('SELECT id, title, image_url as image, anime_id, source_id, quiz_date, created_at FROM anime_battles ORDER BY created_at', [], (err, rows) => {
    if (err) {
      console.error('[GET /api/battles] Error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ anime: rows || [] });
  });
});

// POST /api/battles - Добавить аниме для баттла (только для админа)
app.post('/api/battles', authenticateToken, requireAdmin, upload.single('image'), (req, res) => {
  const { title, animeId, sourceId, quizDate } = req.body;
  
  if (!title || !animeId || !req.file) {
    return res.status(400).json({ error: 'title, animeId, and image file are required' });
  }
  
  const imageUrl = `/uploads/${req.file.filename}`;
  const battleId = `battle_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  // Используем переданную дату или дефолтную для баттлов
  const battleDate = quizDate || 'battle';
  
  db.run(
    'INSERT INTO anime_battles (id, user_id, title, image_url, anime_id, source_id, quiz_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [battleId, req.user.id, title, imageUrl, animeId, sourceId || 'manual', battleDate, Date.now()],
    function(err) {
      if (err) {
        console.error('[POST /api/battles] Error:', err);
        return res.status(500).json({ error: err.message });
      }
      
      console.log(`[POST /api/battles] Battle anime added: ${title} by ${req.user.username}`);
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

