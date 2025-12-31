const { body, param, query } = require('express-validator');

module.exports = function registerBattleRoutes(app, { db, authenticateToken, requireAdmin, upload, handleValidationErrors, invalidateCache }) {
  // GET /api/battle-packs - Получить список баттл паков
  app.get('/api/battle-packs', (req, res) => {
    db.all('SELECT id, name, description, created_at FROM battle_packs ORDER BY created_at DESC', [], (err, rows) => {
      if (err) {
        console.error('[GET /api/battle-packs] Error:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ packs: rows || [] });
    });
  });

  // GET /api/battles/:packId - Получить аниме для конкретного баттл пака
  app.get('/api/battles/:packId', (req, res) => {
    const { packId } = req.params;
    
    db.all('SELECT id, title, image_url as image, anime_id, source_id, created_at FROM anime_battles WHERE pack_id = ? ORDER BY created_at', [packId], (err, rows) => {
      if (err) {
        console.error('[GET /api/battles/:packId] Error:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ anime: rows || [] });
    });
  });

  // POST /api/battle-packs - Создать новый баттл пак (только для админа)
  app.post('/api/battle-packs', authenticateToken, requireAdmin, [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Pack name is required')
      .isLength({ max: 200 }),
    body('description')
      .optional()
      .isLength({ max: 500 }),
    handleValidationErrors
  ], (req, res) => {
    const { name, description } = req.body;
    
    const packId = `pack_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    db.run(
      'INSERT INTO battle_packs (id, name, description, user_id, created_at) VALUES (?, ?, ?, ?, ?)',
      [packId, name, description || '', req.user.id, Date.now()],
      function(err) {
        if (err) {
          console.error('[POST /api/battle-packs] Error:', err);
          return res.status(500).json({ error: err.message });
        }
        
        console.log(`[POST /api/battle-packs] Battle pack created: ${name} by ${req.user.username}`);
        invalidateCache();
        res.json({ success: true, id: packId });
      }
    );
  });

  // POST /api/battles - Добавить аниме в баттл пак (только для админа)
  app.post('/api/battles', authenticateToken, requireAdmin, upload.single('image'), [
    body('title').trim().notEmpty().withMessage('title is required'),
    body('animeId').trim().notEmpty().withMessage('animeId is required'),
    body('packId').trim().notEmpty().withMessage('packId is required'),
    handleValidationErrors
  ], (req, res) => {
    const { title, animeId, sourceId, packId } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'image file is required' });
    }
    
    const imageUrl = `/uploads/${req.file.filename}`;
    const battleId = `battle_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    db.run(
      'INSERT INTO anime_battles (id, pack_id, user_id, title, image_url, anime_id, source_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [battleId, packId, req.user.id, title, imageUrl, animeId, sourceId || 'manual', Date.now()],
      function(err) {
        if (err) {
          console.error('[POST /api/battles] Error:', err);
          return res.status(500).json({ error: err.message });
        }
        
        console.log(`[POST /api/battles] Battle anime added: ${title} to pack ${packId} by ${req.user.username}`);
        invalidateCache();
        res.json({ success: true, id: battleId, imageUrl });
      }
    );
  });

  // POST /api/battle-results - Сохранить результаты баттла
  app.post('/api/battle-results', authenticateToken, [
    body('date').trim().notEmpty().withMessage('date is required'),
    body('results').isArray().withMessage('results must be array'),
    handleValidationErrors
  ], (req, res) => {
    const { date, results } = req.body;
    
    // Удаляем старые результаты для этой даты
    db.run('DELETE FROM battle_results WHERE user_id = ? AND quiz_date = ?', [req.user.id, date], (err) => {
      if (err) {
        console.error('[POST /api/battle-results] DELETE error:', err);
        return res.status(500).json({ error: err.message });
      }
      
      // Добавляем новые результаты
      let completed = 0;
      let errorOccurred = null;
      
      if (results.length === 0) {
        return res.json({ success: true });
      }
      
      results.forEach((result, index) => {
        const resultId = `result_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}`;
        
        db.run(
          'INSERT INTO battle_results (id, user_id, anime_id, wins, losses, points, quiz_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [resultId, req.user.id, result.animeId, result.wins, result.losses, result.points, date, Date.now()],
          function(err) {
            if (err && !errorOccurred) {
              console.error('[POST /api/battle-results] INSERT error:', err);
              errorOccurred = err;
            }
            
            completed++;
            if (completed === results.length) {
              if (errorOccurred) {
                return res.status(500).json({ error: errorOccurred.message });
              }
              
              console.log(`[POST /api/battle-results] Results saved for ${req.user.username} on ${date}`);
              invalidateCache();
              res.json({ success: true });
            }
          }
        );
      });
    });
  });

  // GET /api/battle-results - Получить результаты баттлов
  app.get('/api/battle-results', [
    query('date').optional().isLength({ max: 20 }),
    query('userId').optional().isLength({ max: 100 }),
    handleValidationErrors
  ], (req, res) => {
    const { date, userId } = req.query;
    
    let sql = `
      SELECT br.*, ab.title, ab.image_url as image 
      FROM battle_results br 
      LEFT JOIN anime_battles ab ON br.anime_id = ab.anime_id AND br.quiz_date = ab.quiz_date
    `;
    const params = [];
    const conditions = [];
    
    if (date) {
      conditions.push('br.quiz_date = ?');
      params.push(date);
    }
    
    if (userId) {
      conditions.push('br.user_id = ?');
      params.push(userId);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY br.points DESC, br.wins DESC';
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('[GET /api/battle-results] Error:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows || []);
    });
  });
};

