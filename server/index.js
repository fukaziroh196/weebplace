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
    // Prefer today's UTC date when not specified
    const today = (() => { const t=new Date(); return `${t.getUTCFullYear()}-${String(t.getUTCMonth()+1).padStart(2,'0')}-${String(t.getUTCDate()).padStart(2,'0')}`; })();
    db.all('SELECT * FROM anime_guesses WHERE quiz_date = ? ORDER BY created_at DESC', [today], (err, rows) => {
      if (Array.isArray(rows) && rows.length) return send(rows);
      // Fallback to latest non-empty date
      db.get('SELECT quiz_date as d FROM anime_guesses WHERE quiz_date IS NOT NULL ORDER BY quiz_date DESC LIMIT 1', [], (e1, row) => {
        const latest = row?.d || null;
        if (!latest) return db.all('SELECT * FROM anime_guesses ORDER BY created_at DESC', [], (e2, rows2) => send(rows2));
        db.all('SELECT * FROM anime_guesses WHERE quiz_date = ? ORDER BY created_at DESC', [latest], (e3, rows3) => send(rows3));
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

