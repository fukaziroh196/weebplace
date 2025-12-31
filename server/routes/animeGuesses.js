module.exports = function registerAnimeGuessesRoutes(app, { db }) {
  // Получить все картинки для "Угадай аниме" с пагинацией
  app.get('/api/anime-guesses', (req, res) => {
    const qDate = (req.query.date || '').trim();
    let limit = parseInt(req.query.limit || '50', 10);
    if (Number.isNaN(limit) || limit <= 0) limit = 50;
    limit = Math.min(Math.max(limit, 1), 200);
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const offset = (page - 1) * limit;

    const today = (() => { const t=new Date(); return `${t.getUTCFullYear()}-${String(t.getUTCMonth()+1).padStart(2,'0')}-${String(t.getUTCDate()).padStart(2,'0')}`; })();
    const targetDate = qDate || today;

    const send = (err, guesses, total, usedDate) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const parsedGuesses = (guesses || []).map(guess => ({
        id: guess.id,
        image: guess.image_url,
        title: guess.title,
        animeId: guess.anime_id,
        sourceId: guess.source_id,
        quizDate: guess.quiz_date,
        hint1_image: guess.hint1_image,
        hint2_image: guess.hint2_image,
        createdAt: guess.created_at,
        guessedBy: JSON.parse(guess.guessed_by || '[]')
      }));

      const totalPages = Math.max(1, Math.ceil((total || 0) / limit));

      res.json({
        items: parsedGuesses,
        pagination: { page, limit, total: total || 0, totalPages },
        quizDate: usedDate
      });
    };

    function fetchByDate(dateStr, fallbackAllowed = false) {
      db.get('SELECT COUNT(*) as total FROM anime_guesses WHERE quiz_date = ?', [dateStr], (countErr, countRow) => {
        if (countErr) return send(countErr);
        const total = countRow?.total || 0;
        if (total === 0 && fallbackAllowed) {
          // Найти последнюю доступную дату
          db.get('SELECT quiz_date FROM anime_guesses WHERE quiz_date IS NOT NULL ORDER BY quiz_date DESC LIMIT 1', (lastErr, lastRow) => {
            if (lastErr) return send(lastErr);
            const lastDate = lastRow?.quiz_date;
            if (!lastDate) return send(null, [], 0, dateStr);
            fetchByDate(lastDate, false);
          });
          return;
        }

        db.all('SELECT * FROM anime_guesses WHERE quiz_date = ? ORDER BY created_at DESC LIMIT ? OFFSET ?', [dateStr, limit, offset], (err, rows) => send(err, rows, total, dateStr));
      });
    }

    fetchByDate(targetDate, !qDate);
  });
};

