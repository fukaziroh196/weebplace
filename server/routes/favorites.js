const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

module.exports = function registerFavoritesRoutes(app, { db, authenticateToken, handleValidationErrors }) {
  // Получить избранные аниме пользователя
  app.get('/api/favorites', authenticateToken, (req, res) => {
    const userId = req.user.id;

    db.all(
      `SELECT id, anime_id AS animeId, title, image_url AS imageUrl, score, source_id AS sourceId, position, created_at AS createdAt
       FROM user_favorites
       WHERE user_id = ?
       ORDER BY position ASC, created_at DESC`,
      [userId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ favorites: rows || [] });
      }
    );
  });

  // Получить избранные аниме любого пользователя (публичный)
  app.get('/api/users/:userId/favorites', (req, res) => {
    const { userId } = req.params;

    db.all(
      `SELECT id, anime_id AS animeId, title, image_url AS imageUrl, score, source_id AS sourceId, position, created_at AS createdAt
       FROM user_favorites
       WHERE user_id = ?
       ORDER BY position ASC, created_at DESC`,
      [userId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ favorites: rows || [] });
      }
    );
  });

  // Добавить аниме в избранное
  app.post('/api/favorites', authenticateToken, [
    body('animeId').trim().notEmpty().withMessage('animeId is required'),
    body('title').trim().notEmpty().withMessage('title is required'),
    body('imageUrl').optional().trim(),
    body('score').optional().isFloat({ min: 0, max: 10 }),
    body('sourceId').optional().trim(),
    handleValidationErrors
  ], (req, res) => {
    const userId = req.user.id;
    const { animeId, title, imageUrl, score, sourceId } = req.body;

    // Проверяем лимит (максимум 20 избранных)
    db.get(
      `SELECT COUNT(*) as count FROM user_favorites WHERE user_id = ?`,
      [userId],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row.count >= 20) {
          return res.status(400).json({ error: 'Максимум 20 избранных аниме' });
        }

        // Получаем максимальную позицию
        db.get(
          `SELECT MAX(position) as maxPos FROM user_favorites WHERE user_id = ?`,
          [userId],
          (err2, posRow) => {
            if (err2) return res.status(500).json({ error: err2.message });

            const newPosition = (posRow?.maxPos || 0) + 1;
            const id = uuidv4();

            db.run(
              `INSERT INTO user_favorites (id, user_id, anime_id, title, image_url, score, source_id, position, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [id, userId, String(animeId), title, imageUrl || null, score || null, sourceId || 'shikimori', newPosition, Date.now()],
              function (err3) {
                if (err3) {
                  if (err3.message.includes('UNIQUE constraint')) {
                    return res.status(400).json({ error: 'Это аниме уже в избранном' });
                  }
                  return res.status(500).json({ error: err3.message });
                }
                res.json({
                  success: true,
                  favorite: {
                    id,
                    animeId,
                    title,
                    imageUrl,
                    score,
                    sourceId: sourceId || 'shikimori',
                    position: newPosition
                  }
                });
              }
            );
          }
        );
      }
    );
  });

  // Удалить аниме из избранного
  app.delete('/api/favorites/:id', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    db.run(
      `DELETE FROM user_favorites WHERE id = ? AND user_id = ?`,
      [id, userId],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Избранное не найдено' });
        }
        res.json({ success: true });
      }
    );
  });

  // Удалить по anime_id (альтернативный метод)
  app.delete('/api/favorites/anime/:animeId', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { animeId } = req.params;

    db.run(
      `DELETE FROM user_favorites WHERE anime_id = ? AND user_id = ?`,
      [animeId, userId],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Избранное не найдено' });
        }
        res.json({ success: true });
      }
    );
  });

  // Обновить порядок избранных
  app.put('/api/favorites/reorder', authenticateToken, [
    body('order').isArray().withMessage('order must be an array'),
    handleValidationErrors
  ], (req, res) => {
    const userId = req.user.id;
    const { order } = req.body; // массив id в новом порядке

    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: 'Invalid order array' });
    }

    db.serialize(() => {
      const stmt = db.prepare(`UPDATE user_favorites SET position = ? WHERE id = ? AND user_id = ?`);
      order.forEach((id, index) => {
        stmt.run(index + 1, id, userId);
      });
      stmt.finalize((err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      });
    });
  });
};

