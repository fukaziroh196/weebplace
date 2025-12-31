const { body, param } = require('express-validator');

module.exports = function registerNewsRoutes(app, { db, authenticateToken, requireAdmin, handleValidationErrors }) {
  // Новости проекта (GET с пагинацией)
  app.get('/api/news', (req, res) => {
    let limit = parseInt(req.query.limit, 10);
    if (Number.isNaN(limit) || limit <= 0) limit = 12;
    limit = Math.min(Math.max(limit, 1), 50);
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const offset = (page - 1) * limit;

    db.get('SELECT COUNT(*) as total FROM project_news', (countErr, countRow) => {
      if (countErr) {
        return res.status(500).json({ error: countErr.message });
      }
      const total = countRow?.total || 0;
      const totalPages = Math.max(1, Math.ceil(total / limit));

      db.all(
        `SELECT n.id, n.text, n.created_at, n.user_id, u.username 
         FROM project_news n 
         LEFT JOIN users u ON u.id = n.user_id 
         ORDER BY n.created_at DESC 
         LIMIT ? OFFSET ?`,
        [limit, offset],
        (err, rows) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          const items = (rows || []).map((row) => ({
            id: row.id,
            text: row.text,
            createdAt: row.created_at,
            author: {
              id: row.user_id,
              username: row.username || 'Администратор'
            }
          }));
          res.json({
            items,
            pagination: { page, limit, total, totalPages }
          });
        }
      );
    });
  });

  app.post('/api/news', authenticateToken, requireAdmin, [
    body('text')
      .trim()
      .notEmpty()
      .withMessage('Текст новости не может быть пустым')
      .isLength({ max: 280 })
      .withMessage('Новость слишком длинная (максимум 280 символов)')
      .escape(),
    handleValidationErrors
  ], (req, res) => {
    const text = (req.body?.text || '').trim();

    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = Date.now();

    db.run(
      'INSERT INTO project_news (id, user_id, text, created_at) VALUES (?, ?, ?, ?)',
      [id, req.user.id, text, createdAt],
      (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        db.get(
          `SELECT n.id, n.text, n.created_at, n.user_id, u.username 
           FROM project_news n 
           LEFT JOIN users u ON u.id = n.user_id 
           WHERE n.id = ?`,
          [id],
          (selectErr, row) => {
            if (selectErr || !row) {
              return res.status(200).json({
                id,
                text,
                createdAt,
                author: {
                  id: req.user.id,
                  username: req.user.username || 'Администратор'
                }
              });
            }

            res.json({
              id: row.id,
              text: row.text,
              createdAt: row.created_at,
              author: {
                id: row.user_id,
                username: row.username || 'Администратор'
              }
            });
          }
        );
      }
    );
  });

  app.patch('/api/news/:id', authenticateToken, requireAdmin, [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('ID новости обязателен')
      .escape(),
    body('text')
      .trim()
      .notEmpty()
      .withMessage('Текст новости не может быть пустым')
      .isLength({ max: 280 })
      .withMessage('Новость слишком длинная (максимум 280 символов)')
      .escape(),
    handleValidationErrors
  ], (req, res) => {
    const id = (req.params?.id || '').trim();
    const text = (req.body?.text || '').trim();

    db.run(
      'UPDATE project_news SET text = ?, created_at = ? WHERE id = ?',
      [text, Date.now(), id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Новость не найдена' });
        }

        db.get(
          `SELECT n.id, n.text, n.created_at, n.user_id, u.username 
           FROM project_news n 
           LEFT JOIN users u ON u.id = n.user_id 
           WHERE n.id = ?`,
          [id],
          (selectErr, row) => {
            if (selectErr || !row) {
              return res.status(200).json({
                id,
                text,
                createdAt: Date.now(),
                author: {
                  id: req.user.id,
                  username: req.user.username || 'Администратор'
                }
              });
            }

            res.json({
              id: row.id,
              text: row.text,
              createdAt: row.created_at,
              author: {
                id: row.user_id,
                username: row.username || 'Администратор'
              }
            });
          }
        );
      }
    );
  });

  app.delete('/api/news/:id', authenticateToken, requireAdmin, [
    param('id')
      .trim()
      .notEmpty()
      .withMessage('ID новости обязателен')
      .escape(),
    handleValidationErrors
  ], (req, res) => {
    const id = (req.params?.id || '').trim();

    db.run(
      'DELETE FROM project_news WHERE id = ?',
      [id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Новость не найдена' });
        }

        res.json({ success: true });
      }
    );
  });
};

