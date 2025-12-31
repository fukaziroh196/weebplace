const { body, param, query } = require('express-validator');

module.exports = function registerOpeningsRoutes(app, { db, authenticateToken, requireAdmin, handleValidationErrors, invalidateCache, cacheGet, cacheSet }) {
  // GET /api/openings - Получить опенинги (по дате или все)
  app.get('/api/openings', [
    query('date').optional().isLength({ max: 20 }),
    handleValidationErrors
  ], (req, res) => {
    const { date } = req.query;
    const cacheKey = `openings:${date || 'all'}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    
    let queryStr = 'SELECT id, title, youtube_url, start_time, end_time, quiz_date, created_at FROM openings';
    let params = [];
    
    if (date) {
      queryStr += ' WHERE quiz_date = ?';
      params.push(date);
    }
    
    queryStr += ' ORDER BY quiz_date DESC, created_at DESC';
    
    db.all(queryStr, params, (err, rows) => {
      if (err) {
        console.error('[GET /api/openings] Error:', err);
        return res.status(500).json({ error: err.message });
      }
      cacheSet(cacheKey, rows || [], 300); // 5 минут
      res.json(rows || []);
    });
  });

  // POST /api/openings - Добавить опенинг (только для админа)
  app.post('/api/openings', authenticateToken, requireAdmin, [
    body('quizDate').trim().notEmpty().withMessage('Quiz date is required').isLength({ max: 20 }),
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
    body('youtubeUrl').trim().notEmpty().withMessage('YouTube URL is required').isURL().withMessage('Invalid URL'),
    body('startTime').optional().isInt({ min: 0, max: 100000 }),
    body('endTime').optional().isInt({ min: 0, max: 100000 }),
    handleValidationErrors
  ], (req, res) => {
    console.log('[POST /api/openings] Request body:', req.body);
    console.log('[POST /api/openings] User:', req.user);
    
    const { quizDate, title, youtubeUrl, startTime, endTime } = req.body;

    const id = Date.now().toString() + Math.random().toString(36).substring(7);
    const createdAt = Date.now();
    const userId = req.user?.id || null;

    db.run(
      'INSERT INTO openings (id, title, youtube_url, start_time, end_time, quiz_date, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, youtubeUrl, startTime || 0, endTime || 20, quizDate, createdAt, userId],
      function (err) {
        if (err) {
          console.error('[POST /api/openings] INSERT Error:', err);
          return res.status(500).json({ error: err.message || 'Database error' });
        }

        console.log('[POST /api/openings] Success! Opening created with ID:', id);
        invalidateCache();
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
  app.delete('/api/openings/:id', authenticateToken, requireAdmin, [
    param('id').trim().notEmpty().withMessage('Opening ID is required').escape(),
    handleValidationErrors
  ], (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM openings WHERE id = ?', [id], function(err) {
      if (err) {
        console.error('[DELETE /api/openings/:id] Error:', err);
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Opening not found' });
      }

      invalidateCache();
      res.json({ success: true, deleted: this.changes });
    });
  });
};

