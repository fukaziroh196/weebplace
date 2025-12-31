const { body } = require('express-validator');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

module.exports = function registerPacksRoutes(app, { db, authenticateToken, requireAdmin, upload, uploadsDir, handleValidationErrors, invalidateCache }) {
  // Пример ZIP с manifest.csv
  app.get('/api/anime-guesses/batch/sample', (req, res) => {
    try {
      const date = (req.query.date || '').trim();
      const d = date || (() => { const x=new Date(); return `${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,'0')}-${String(x.getUTCDate()).padStart(2,'0')}`; })();
      const zip = new AdmZip();
      const manifest = [
        'filename,title,animeId,sourceId,quizDate',
        `01.jpg,Fullmetal Alchemist,12345,shikimori,${d}`,
        `02.png,Naruto,20,anilist,${d}`
      ].join('\n');
      zip.addFile('manifest.csv', Buffer.from(manifest, 'utf8'));
      const readme = 'Добавьте свои изображения 01.jpg, 02.png и обновите manifest.csv. Дата может быть разной по строкам.';
      zip.addFile('README.txt', Buffer.from(readme, 'utf8'));
      const buf = zip.toBuffer();
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="aniguess-batch-sample.zip"');
      res.send(buf);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Загрузка картинки для "Угадай аниме" (только админ)
  app.post('/api/anime-guesses', authenticateToken, requireAdmin, upload.single('image'), [
    body('title').trim().notEmpty().withMessage('title is required'),
    body('animeId').trim().notEmpty().withMessage('animeId is required'),
    body('quizDate').optional().isLength({ max: 20 }),
    handleValidationErrors
  ], (req, res) => {
    const { title, animeId, sourceId } = req.body;
    let quizDate = (req.body.quizDate || '').trim();
    // Normalize quizDate to YYYY-MM-DD (UTC)
    try {
      if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(quizDate)) {
        const d = new Date();
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        quizDate = `${y}-${m}-${day}`;
      }
    } catch (_) {
      const d = new Date();
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      quizDate = `${y}-${m}-${day}`;
    }

    if (!req.file || !title || !animeId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    const guessId = Date.now().toString() + Math.random().toString(36).substring(7);

    db.run(
      'INSERT INTO anime_guesses (id, user_id, image_url, title, anime_id, source_id, quiz_date, created_at, guessed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [guessId, req.user.id, imageUrl, title, animeId, sourceId || null, quizDate, Date.now(), '[]'],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        invalidateCache();
        res.json({
          id: guessId,
          imageUrl,
          title,
          animeId,
          sourceId,
          quizDate,
          createdAt: Date.now(),
          guessedBy: []
        });
      }
    );
  });

  // Пакетная загрузка: ZIP с картинками и manifest.csv (filename,title,animeId,sourceId,quizDate)
  app.post('/api/anime-guesses/batch', authenticateToken, requireAdmin, upload.single('archive'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'archive is required' });

      const defaultQuizDate = (req.body.quizDate || '').trim();
      const zipPath = path.join(uploadsDir, req.file.filename);
      fs.renameSync(path.join(uploadsDir, req.file.filename), zipPath); // already in uploadsDir

      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();

      let manifestCsv = null;
      for (const e of entries) {
        if (/manifest\.csv$/i.test(e.entryName)) { manifestCsv = e.getData().toString('utf8'); break; }
      }
      if (!manifestCsv) return res.status(400).json({ error: 'manifest.csv not found in archive' });

      function parseCsv(text) {
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (!lines.length) return [];
        const header = lines[0].replace(/;/g, ',').split(',').map(h => h.trim());
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].replace(/;/g, ',').split(',');
          const row = {};
          header.forEach((h, idx) => row[h] = (cols[idx] || '').trim());
          rows.push(row);
        }
        return rows;
      }

      const items = parseCsv(manifestCsv);

      let created = 0;
      const createdItems = [];
      for (const it of items) {
        const filename = it.filename || it.file || it.image || '';
        const title = it.title || '';
        const animeId = it.animeId || it.anime_id || '';
        const sourceId = it.sourceId || it.source_id || null;
        let quizDate = (it.quizDate || it.quiz_date || defaultQuizDate || '').trim();
        if (!filename || !title || !animeId) continue;

        // Normalize quizDate
        try {
          if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(quizDate)) {
            const d = new Date();
            quizDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
          }
        } catch (_) {}

        // Extract image entry
        const entry = entries.find(e => path.basename(e.entryName) === filename);
        if (!entry) continue;
        const buf = entry.getData();
        const uniqueName = Date.now().toString() + '-' + Math.round(Math.random() * 1e9) + path.extname(filename);
        const outPath = path.join(uploadsDir, uniqueName);
        fs.writeFileSync(outPath, buf);
        const imageUrl = `/uploads/${uniqueName}`;

        const guessId = Date.now().toString() + Math.random().toString(36).substring(7);
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO anime_guesses (id, user_id, image_url, title, anime_id, source_id, quiz_date, created_at, guessed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [guessId, req.user.id, imageUrl, title, animeId, sourceId || null, quizDate, Date.now(), '[]'],
            function(err) { if (err) reject(err); else resolve(); }
          );
        });
        created++;
        createdItems.push({ id: guessId, imageUrl, title, animeId, sourceId, quizDate });
      }

      // Remove uploaded zip to save space
      try { fs.unlinkSync(zipPath); } catch (_) {}

      invalidateCache();
      res.json({ created, items: createdItems });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // Валидация ZIP перед загрузкой: возвращает разобранный manifest и отсутствующие файлы
  app.post('/api/anime-guesses/validate-zip', authenticateToken, requireAdmin, upload.single('archive'), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'archive is required' });
  
      const zipPath = path.join(uploadsDir, req.file.filename);
      fs.renameSync(path.join(uploadsDir, req.file.filename), zipPath); // already in uploadsDir
  
      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();
  
      let manifestCsv = null;
      for (const e of entries) {
        if (/manifest\.csv$/i.test(e.entryName)) { manifestCsv = e.getData().toString('utf8'); break; }
      }
      if (!manifestCsv) return res.status(400).json({ error: 'manifest.csv not found in archive' });
  
      function parseCsv(text) {
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (!lines.length) return [];
        const header = lines[0].replace(/;/g, ',').split(',').map(h => h.trim());
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].replace(/;/g, ',').split(',');
          const row = {};
          header.forEach((h, idx) => row[h] = (cols[idx] || '').trim());
          rows.push(row);
        }
        return rows;
      }
  
      const items = parseCsv(manifestCsv);
  
      const missing = [];
      const normalized = [];
      for (const it of items) {
        const filename = it.filename || it.file || it.image || '';
        const title = it.title || '';
        const animeId = it.animeId || it.anime_id || '';
        const sourceId = it.sourceId || it.source_id || null;
        const quizDate = (it.quizDate || it.quiz_date || '').trim();
        const entry = entries.find(e => path.basename(e.entryName) === filename);
        if (!entry) {
          missing.push(filename || '(empty)');
        } else {
          normalized.push({ filename, title, animeId, sourceId, quizDate });
        }
      }
  
      // Remove uploaded zip to save space
      try { fs.unlinkSync(zipPath); } catch (_) {}
  
      res.json({ items: normalized, missing });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // === Atomic pack upload (exactly 4 images for a specific date) ===
  // fields: image1..image4, title1..title4, optional animeId1..4, sourceId1..4, required quizDate
  app.post('/api/packs', authenticateToken, requireAdmin, upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 },
    { name: 'hint1_1', maxCount: 1 },
    { name: 'hint1_2', maxCount: 1 },
    { name: 'hint1_3', maxCount: 1 },
    { name: 'hint1_4', maxCount: 1 },
    { name: 'hint2_1', maxCount: 1 },
    { name: 'hint2_2', maxCount: 1 },
    { name: 'hint2_3', maxCount: 1 },
    { name: 'hint2_4', maxCount: 1 },
  ]), (req, res) => {
    console.log('[/api/packs] New pack upload request');
    
    // Validate quiz date
    let quizDate = String(req.body.quizDate || '').trim();
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(quizDate)) {
      console.error('[/api/packs] Invalid quizDate:', quizDate);
      return res.status(400).json({ error: 'quizDate (YYYY-MM-DD) is required' });
    }
    
    // Validate images and titles
    const images = [req.files?.image1?.[0], req.files?.image2?.[0], req.files?.image3?.[0], req.files?.image4?.[0]];
    const titles = [req.body.title1, req.body.title2, req.body.title3, req.body.title4].map((t) => String(t || '').trim());

    // Validate hint images (optional)
    const hint1Images = [req.files?.[`hint1_1`]?.[0], req.files?.[`hint1_2`]?.[0], req.files?.[`hint1_3`]?.[0], req.files?.[`hint1_4`]?.[0]];
    const hint2Images = [req.files?.[`hint2_1`]?.[0], req.files?.[`hint2_2`]?.[0], req.files?.[`hint2_3`]?.[0], req.files?.[`hint2_4`]?.[0]];

    for (let i = 0; i < 4; i++) {
      if (!images[i]) {
        console.error(`[/api/packs] Missing image${i+1}`);
        return res.status(400).json({ error: `Missing image${i+1}` });
      }
      if (!titles[i]) {
        console.error(`[/api/packs] Missing title${i+1}`);
        return res.status(400).json({ error: `Missing title${i+1}` });
      }
    }

    console.log(`[/api/packs] Date: ${quizDate}, Images: ${images.map(f => f.filename).join(', ')}`);
    console.log(`[/api/packs] Titles: ${titles.join(' | ')}`);

    // Start transaction: replace pack for this date atomically
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (beginErr) => {
        if (beginErr) {
          console.error('[/api/packs] BEGIN error:', beginErr);
          return res.status(500).json({ error: 'Transaction start failed' });
        }

        // Step 1: Delete old entries for this date
        db.run('DELETE FROM anime_guesses WHERE quiz_date = ?', [quizDate], function (delErr) {
          if (delErr) {
            console.error('[/api/packs] DELETE error:', delErr);
            db.run('ROLLBACK');
            return res.status(500).json({ error: `Failed to clear old pack: ${delErr.message}` });
          }

          console.log(`[/api/packs] Deleted ${this.changes} old entries for ${quizDate}`);

          // Step 2: Insert new 4 entries
          const createdItems = [];
          let errorOccurred = null;
          let remaining = 4;

          images.forEach((img, idx) => {
            const imageUrl = `/uploads/${img.filename}`;
            const guessId = Date.now().toString() + Math.random().toString(36).substring(7) + '-' + idx;
            const title = titles[idx];
            const animeId = String(req.body[`animeId${idx + 1}`] || `manual-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`);
            const sourceId = req.body[`sourceId${idx + 1}`] || 'manual';

            // Handle hint images
            const hint1Url = hint1Images[idx] ? `/uploads/${hint1Images[idx].filename}` : null;
            const hint2Url = hint2Images[idx] ? `/uploads/${hint2Images[idx].filename}` : null;

            db.run(
              'INSERT INTO anime_guesses (id, user_id, image_url, title, anime_id, source_id, quiz_date, hint1_image, hint2_image, created_at, guessed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [guessId, req.user.id, imageUrl, title, animeId, sourceId, quizDate, hint1Url, hint2Url, Date.now(), '[]'],
              function (insertErr) {
                if (insertErr && !errorOccurred) {
                  console.error(`[/api/packs] INSERT error for ${title}:`, insertErr);
                  errorOccurred = insertErr;
                } else if (!insertErr) {
                  console.log(`[/api/packs] ✓ Inserted ${idx+1}/4: ${title}`);
                  createdItems.push({ 
                    id: guessId, 
                    imageUrl, 
                    image: imageUrl,
                    title, 
                    animeId, 
                    sourceId, 
                    quizDate,
                    guessedBy: []
                  });
                }

                remaining -= 1;

                // All 4 inserts finished
                if (remaining === 0) {
                  if (errorOccurred) {
                    console.error('[/api/packs] Rolling back due to insert errors');
                    db.run('ROLLBACK', () => {
                      res.status(500).json({ error: `Insert failed: ${errorOccurred.message}` });
                    });
                  } else {
                    db.run('COMMIT', (commitErr) => {
                      if (commitErr) {
                        console.error('[/api/packs] COMMIT error:', commitErr);
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: `Commit failed: ${commitErr.message}` });
                      }
                      console.log(`[/api/packs] ✓✓✓ Successfully committed pack for ${quizDate} ✓✓✓`);
                      invalidateCache();
                      res.json({ 
                        success: true,
                        created: createdItems.length, 
                        items: createdItems,
                        quizDate
                      });
                    });
                  }
                }
              }
            );
          });
        });
      });
    });
  });
};

