const { body } = require('express-validator');

module.exports = function registerAuthRoutes(app, {
  db,
  bcrypt,
  jwt,
  SECRET,
  authenticateToken,
  avatarUpload,
  processAvatarImage,
  deleteOldAvatar,
  handleValidationErrors
}) {
  // Регистрация
  app.post('/api/register', [
    body('username')
      .trim()
      .isLength({ min: 3, max: 20 })
      .withMessage('Username must be between 3 and 20 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores')
      .escape(),
    body('password')
      .isLength({ min: 4, max: 100 })
      .withMessage('Password must be between 4 and 100 characters')
      .custom((value) => {
        if (value.includes(' ')) {
          throw new Error('Password cannot contain spaces');
        }
        return true;
      }),
    handleValidationErrors
  ], async (req, res) => {
    const { username, password } = req.body;

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

          const token = jwt.sign({ id: userId, username, isAdmin: false }, SECRET);
          res.json({ user: { id: userId, username, isAdmin: false }, token });
        }
      );
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Логин
  app.post('/api/login', [
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required')
      .escape(),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    handleValidationErrors
  ], (req, res) => {
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
        SECRET
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

  // Загрузка аватара (безопасный endpoint)
  app.post('/api/me/avatar', authenticateToken, avatarUpload.single('avatar'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Файл не был загружен' });
      }

      console.log('[POST /api/me/avatar] Upload request from user:', req.user.id);
      console.log('[POST /api/me/avatar] File info:', {
        mimetype: req.file.mimetype,
        size: req.file.size,
        originalname: req.file.originalname
      });

      // Получаем текущего пользователя для удаления старого аватара
      db.get('SELECT avatar_url FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (err || !user) {
          return res.status(404).json({ error: 'Пользователь не найден' });
        }

        try {
          // Обрабатываем и сохраняем новый аватар
          const newAvatarUrl = await processAvatarImage(req.file.buffer, req.user.id);
          
          // Удаляем старый аватар, если он существует
          if (user.avatar_url) {
            deleteOldAvatar(user.avatar_url);
          }

          // Обновляем в базе данных
          db.run(
            'UPDATE users SET avatar_url = ? WHERE id = ?',
            [newAvatarUrl, req.user.id],
            function(updateErr) {
              if (updateErr) {
                console.error('[POST /api/me/avatar] Database error:', updateErr);
                return res.status(500).json({ error: 'Ошибка при сохранении аватара в базу данных' });
              }

              console.log('[POST /api/me/avatar] Avatar uploaded successfully for user:', req.user.id);

              res.json({
                success: true,
                avatarUrl: newAvatarUrl
              });
            }
          );
        } catch (processError) {
          console.error('[POST /api/me/avatar] Processing error:', processError);
          res.status(400).json({ 
            error: processError.message || 'Ошибка при обработке изображения' 
          });
        }
      });
    } catch (error) {
      console.error('[POST /api/me/avatar] Error:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  });

  // Удаление аватара
  app.delete('/api/me/avatar', authenticateToken, (req, res) => {
    db.get('SELECT avatar_url FROM users WHERE id = ?', [req.user.id], (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      if (user.avatar_url) {
        deleteOldAvatar(user.avatar_url);
      }

      db.run(
        'UPDATE users SET avatar_url = NULL WHERE id = ?',
        [req.user.id],
        function(updateErr) {
          if (updateErr) {
            return res.status(500).json({ error: 'Ошибка при удалении аватара' });
          }

          res.json({ success: true, avatarUrl: null });
        }
      );
    });
  });

  // Обновление профиля пользователя (безопасная версия - только для других полей, не аватара)
  app.patch('/api/me', authenticateToken, (req, res) => {
    const { avatarUrl, ...otherFields } = req.body;
    
    if (avatarUrl !== undefined) {
      return res.status(400).json({ 
        error: 'Для загрузки аватара используйте POST /api/me/avatar. Для удаления используйте DELETE /api/me/avatar' 
      });
    }

    // Пока просто возвращаем текущего пользователя
    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      res.json({
        id: user.id,
        username: user.username,
        isAdmin: !!user.is_admin,
        avatarUrl: user.avatar_url
      });
    });
  });
};

