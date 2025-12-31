const { body, query } = require('express-validator');

const allowedTypes = ['watched', 'favorites', 'wishlist', 'dropped', 'ratings', 'notInterested', 'friends', 'friendRequestsIncoming', 'friendRequestsOutgoing', 'comments', 'notifications'];

module.exports = function registerLibraryRoutes(app, { db, authenticateToken, handleValidationErrors }) {
  // Сохранение библиотеки пользователя
  app.post('/api/library', authenticateToken, [
    body('dataType')
      .trim()
      .notEmpty()
      .withMessage('dataType is required')
      .isIn(allowedTypes)
      .withMessage('Invalid dataType'),
    body('data')
      .notEmpty()
      .withMessage('data is required'),
    handleValidationErrors
  ], (req, res) => {
    const { dataType, data } = req.body;
    const userId = req.user.id;

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
      .isIn(allowedTypes)
      .withMessage('Invalid dataType'),
    handleValidationErrors
  ], (req, res) => {
    const userId = req.user.id;
    const dataType = req.query.type;

    let queryStr = 'SELECT data_type, data_content FROM user_libraries WHERE user_id = ?';
    let params = [userId];

    if (dataType) {
      queryStr += ' AND data_type = ?';
      params.push(dataType);
    }

    db.all(queryStr, params, (err, rows) => {
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
};

