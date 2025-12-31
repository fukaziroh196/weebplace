const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

module.exports = function registerFriendsRoutes(app, { db, authenticateToken, handleValidationErrors }) {
  // Получить текущее состояние (друзья и заявки)
  app.get('/api/friends/state', authenticateToken, (req, res) => {
    const userId = req.user.id;

    // Список друзей
    db.all(
      `SELECT u.id, u.username, u.avatar_url AS avatarUrl, u.created_at AS createdAt
       FROM friendships f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = ?
       ORDER BY u.username COLLATE NOCASE`,
      [userId],
      (err, friends) => {
        if (err) return res.status(500).json({ error: err.message });

        // Входящие pending заявки
        db.all(
          `SELECT fr.id, fr.from_user_id AS fromId, fr.created_at AS createdAt,
                  u.username, u.avatar_url AS avatarUrl
           FROM friend_requests fr
           JOIN users u ON u.id = fr.from_user_id
           WHERE fr.to_user_id = ? AND fr.status = 'pending'
           ORDER BY fr.created_at DESC`,
          [userId],
          (err2, incoming) => {
            if (err2) return res.status(500).json({ error: err2.message });

            // Исходящие pending заявки
            db.all(
              `SELECT fr.id, fr.to_user_id AS toId, fr.created_at AS createdAt,
                      u.username, u.avatar_url AS avatarUrl
               FROM friend_requests fr
               JOIN users u ON u.id = fr.to_user_id
               WHERE fr.from_user_id = ? AND fr.status = 'pending'
               ORDER BY fr.created_at DESC`,
              [userId],
              (err3, outgoing) => {
                if (err3) return res.status(500).json({ error: err3.message });
                res.json({
                  friends: friends || [],
                  incoming: incoming || [],
                  outgoing: outgoing || []
                });
              }
            );
          }
        );
      }
    );
  });

  // Отправить заявку
  app.post('/api/friends/request', authenticateToken, [
    body('username')
      .trim()
      .notEmpty()
      .withMessage('username is required')
      .isLength({ min: 2, max: 50 })
      .withMessage('username must be 2-50 chars'),
    handleValidationErrors
  ], (req, res) => {
    const me = req.user.id;
    const username = (req.body.username || '').trim();

    // Находим целевого пользователя (регистронезависимо)
    db.get(
      `SELECT id, username, avatar_url AS avatarUrl FROM users WHERE username LIKE ? COLLATE NOCASE`,
      [username],
      (err, target) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
        if (target.id === me) return res.status(400).json({ error: 'Нельзя добавить себя' });

        // Уже друзья?
        db.get(
          `SELECT 1 FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
          [me, target.id, target.id, me],
          (err2, row) => {
            if (err2) return res.status(500).json({ error: err2.message });
            if (row) return res.status(400).json({ error: 'Уже в друзьях' });

            // Есть активная заявка в любую сторону?
            db.get(
              `SELECT * FROM friend_requests 
               WHERE ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))
                 AND status = 'pending'`,
              [me, target.id, target.id, me],
              (err3, reqRow) => {
                if (err3) return res.status(500).json({ error: err3.message });

                // Встречная заявка => сразу принимаем
                if (reqRow && reqRow.from_user_id === target.id && reqRow.to_user_id === me) {
                  db.run(`UPDATE friend_requests SET status = 'accepted' WHERE id = ?`, [reqRow.id]);
                  const now = Date.now();
                  db.run(`INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)`, [me, target.id, now]);
                  db.run(`INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)`, [target.id, me, now]);
                  return res.json({ success: true, autoAccepted: true, message: 'Встречная заявка принята' });
                }

                if (reqRow) return res.status(400).json({ error: 'Заявка уже существует' });

                // Создаём заявку
                const id = uuidv4();
                db.run(
                  `INSERT INTO friend_requests (id, from_user_id, to_user_id, status, created_at)
                   VALUES (?, ?, ?, 'pending', ?)`,
                  [id, me, target.id, Date.now()],
                  function (err4) {
                    if (err4) return res.status(500).json({ error: err4.message });
                    res.json({ success: true, requestId: id });
                  }
                );
              }
            );
          }
        );
      }
    );
  });

  // Ответить на заявку
  app.post('/api/friends/respond', authenticateToken, [
    body('requestId').trim().notEmpty().withMessage('requestId is required'),
    body('action').trim().isIn(['accept', 'decline']).withMessage('Invalid action'),
    handleValidationErrors
  ], (req, res) => {
    const me = req.user.id;
    const { requestId, action } = req.body;

    db.get(
      `SELECT * FROM friend_requests WHERE id = ? AND to_user_id = ? AND status = 'pending'`,
      [requestId, me],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Заявка не найдена' });

        if (action === 'decline') {
          db.run(`UPDATE friend_requests SET status = 'declined' WHERE id = ?`, [requestId], function (err2) {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ success: true });
          });
          return;
        }

        // accept
        const now = Date.now();
        db.run(`UPDATE friend_requests SET status = 'accepted' WHERE id = ?`, [requestId], function (err2) {
          if (err2) return res.status(500).json({ error: err2.message });

          db.run(`INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)`, [me, row.from_user_id, now]);
          db.run(`INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)`, [row.from_user_id, me, now]);
          res.json({ success: true });
        });
      }
    );
  });

  // Удалить из друзей
  app.post('/api/friends/remove', authenticateToken, [
    body('userId').trim().notEmpty().withMessage('userId is required'),
    handleValidationErrors
  ], (req, res) => {
    const me = req.user.id;
    const { userId } = req.body;
    if (userId === me) return res.status(400).json({ error: 'Некорректный пользователь' });

    db.serialize(() => {
      db.run(`DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`, [me, userId, userId, me]);
      db.run(`DELETE FROM friend_requests WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)`, [me, userId, userId, me]);
    });

    res.json({ success: true });
  });
};

