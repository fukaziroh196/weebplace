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

  // Публичный профиль пользователя (минимальные данные)
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

