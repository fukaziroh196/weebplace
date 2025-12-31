const { body, query, param } = require('express-validator');

module.exports = function registerNotificationsRoutes(app, { db, authenticateToken, handleValidationErrors }) {
  // Получить уведомления (по умолчанию непрочитанные, limit 50)
  app.get('/api/notifications', authenticateToken, [
    query('status').optional().isIn(['all', 'unread']).withMessage('status must be all|unread'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
    handleValidationErrors
  ], (req, res) => {
    const status = (req.query.status || 'unread').toLowerCase();
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '50', 10)));
    const params = [req.user.id];
    let where = 'user_id = ?';
    if (status === 'unread') {
      where += ' AND read = 0';
    }
    db.all(
      `SELECT id, type, title, message, payload, read, created_at AS createdAt
       FROM notifications
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT ?`,
      [...params, limit],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
      }
    );
  });

  // Создать уведомление (например, при заявке в друзья)
  app.post('/api/notifications', authenticateToken, [
    body('userId').trim().notEmpty().withMessage('userId is required'),
    body('type').trim().notEmpty().withMessage('type is required').isLength({ max: 50 }),
    body('title').trim().notEmpty().withMessage('title is required').isLength({ max: 200 }),
    body('message').optional().isLength({ max: 500 }),
    handleValidationErrors
  ], (req, res) => {
    const { userId, type, title, message, payload } = req.body;
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = Date.now();
    db.run(
      `INSERT INTO notifications (id, user_id, type, title, message, payload, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, userId, type, title, message || '', payload ? JSON.stringify(payload) : null, createdAt],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id, createdAt });
      }
    );
  });

  // Отметить как прочитанное
  app.post('/api/notifications/:id/read', authenticateToken, [
    param('id').trim().notEmpty().withMessage('id is required'),
    handleValidationErrors
  ], (req, res) => {
    const { id } = req.params;
    db.run(
      `UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?`,
      [id, req.user.id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Notification not found' });
        res.json({ success: true });
      }
    );
  });

  // Отметить все как прочитанные
  app.post('/api/notifications/read-all', authenticateToken, (req, res) => {
    db.run(
      `UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0`,
      [req.user.id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, updated: this.changes || 0 });
      }
    );
  });
};

