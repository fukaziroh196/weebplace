const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Инициализация таблиц и индексов
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

  // Migration: ensure quiz_date/hint columns exist
  db.get(`PRAGMA table_info(anime_guesses)`, () => {
    db.run(`ALTER TABLE anime_guesses ADD COLUMN quiz_date TEXT`, () => {});
  });
  db.run(`ALTER TABLE anime_guesses ADD COLUMN hint1_image TEXT`, () => {});
  db.run(`ALTER TABLE anime_guesses ADD COLUMN hint2_image TEXT`, () => {});

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

  // Таблица для уведомлений
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    payload TEXT,
    read INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
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
    db.run(`ALTER TABLE openings ADD COLUMN quiz_date TEXT`, (alterErr) => {
      if (alterErr && !alterErr.message.includes('duplicate column')) {
        console.error('[Migration] Error adding quiz_date to openings:', alterErr);
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

  // ============ ИНДЕКСЫ ============
  db.run(`CREATE INDEX IF NOT EXISTS idx_anime_guesses_quiz_date ON anime_guesses(quiz_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_anime_guesses_user_id ON anime_guesses(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_scores_user_id ON user_scores(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_scores_quiz_date ON user_scores(quiz_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_scores_quiz_type ON user_scores(quiz_type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_scores_user_type_date ON user_scores(user_id, quiz_type, quiz_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_battle_results_user_date ON battle_results(user_id, quiz_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_openings_quiz_date ON openings(quiz_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_project_news_created_at ON project_news(created_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_quiz_guesses_user_id ON quiz_guesses(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read, created_at DESC)`);
});

module.exports = { db, dbPath };

