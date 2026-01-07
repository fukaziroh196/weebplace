const { query, param } = require('express-validator');

module.exports = function registerUsersRoutes(app, { db, handleValidationErrors }) {
  // Поиск пользователей (по username, регистронезависимо)
  app.get('/api/users/search', [
    query('q')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('q must be 2-50 chars'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('limit must be 1-50'),
    handleValidationErrors
  ], (req, res) => {
    const q = (req.query.q || '').trim();
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || '20', 10)));
    const like = `%${q}%`;
    db.all(
      `SELECT id, username, avatar_url AS avatarUrl, created_at AS createdAt, is_admin AS isAdmin
       FROM users
       WHERE username LIKE ? COLLATE NOCASE
       ORDER BY created_at DESC
       LIMIT ?`,
      [like, limit],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
      }
    );
  });

  // Профиль по username (регистронезависимо)
  app.get('/api/users/by-username/:username', [
    param('username')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('username must be 2-50 chars'),
    handleValidationErrors
  ], (req, res) => {
    const username = (req.params.username || '').trim();
    db.get(
      `SELECT id, username, avatar_url AS avatarUrl, created_at AS createdAt, is_admin AS isAdmin
       FROM users
       WHERE username = ? COLLATE NOCASE`,
      [username],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'User not found' });
        res.json(row);
      }
    );
  });

  // История игр пользователя (должен быть ПЕРЕД /api/users/:id)
  app.get('/api/users/:id/game-history', [
    param('id').trim().notEmpty().withMessage('User ID is required'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
    handleValidationErrors
  ], (req, res) => {
    const { id } = req.params;
    const limit = Math.min(100, parseInt(req.query.limit || '50', 10));

    // Маппинг типов квизов на названия режимов
    const modeMap = {
      'anime': 'Угадай аниме',
      'opening': 'Угадай опенинг',
      'character': 'Угадай персонажа',
      'battle': 'Аниме баттлы'
    };

    // Получаем историю из user_scores
    db.all(
      `SELECT quiz_type, score, quiz_date, created_at
       FROM user_scores
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [id, limit],
      (err, scoreRows) => {
        if (err) {
          console.error('[GET /api/users/:id/game-history] user_scores error:', err);
          return res.status(500).json({ error: err.message });
        }

        // Получаем историю баттлов
        db.all(
          `SELECT quiz_date, SUM(points) as total_points, SUM(wins) as total_wins, SUM(losses) as total_losses, MAX(created_at) as created_at
           FROM battle_results
           WHERE user_id = ?
           GROUP BY quiz_date
           ORDER BY created_at DESC
           LIMIT ?`,
          [id, limit],
          (err2, battleRows) => {
            if (err2) {
              console.error('[GET /api/users/:id/game-history] battle_results error:', err2);
              return res.status(500).json({ error: err2.message });
            }

            // Объединяем результаты
            const history = [];

            // Добавляем результаты из user_scores
            (scoreRows || []).forEach(row => {
              const mode = modeMap[row.quiz_type] || row.quiz_type;
              history.push({
                id: `score_${row.created_at}_${row.quiz_type}`,
                mode: mode,
                result: 'Победа', // Все записи в user_scores - это победы
                score: row.score,
                date: row.quiz_date,
                timestamp: row.created_at
              });
            });

            // Добавляем результаты баттлов
            (battleRows || []).forEach(row => {
              const result = row.total_wins > row.total_losses ? 'Победа' : 
                            row.total_wins < row.total_losses ? 'Поражение' : 'Ничья';
              history.push({
                id: `battle_${row.created_at}_${row.quiz_date}`,
                mode: 'Аниме баттлы',
                result: result,
                score: row.total_points || 0,
                date: row.quiz_date,
                timestamp: row.created_at
              });
            });

            // Сортируем по timestamp (новые сначала)
            history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            // Ограничиваем количество
            const limitedHistory = history.slice(0, limit);

            res.json(limitedHistory);
          }
        );
      }
    );
  });

  // Публичный профиль пользователя (минимальные данные) - должен быть ПОСЛЕ более специфичных роутов
  app.get('/api/users/:id', [
    param('id').trim().notEmpty().withMessage('User ID is required'),
    handleValidationErrors
  ], (req, res) => {
    const { id } = req.params;
    db.get(
      `SELECT id, username, avatar_url AS avatarUrl, created_at AS createdAt, is_admin AS isAdmin
       FROM users WHERE id = ?`,
      [id],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'User not found' });
        res.json(row);
      }
    );
  });
};

