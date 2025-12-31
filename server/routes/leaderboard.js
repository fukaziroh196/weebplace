module.exports = function registerLeaderboardRoutes(app, { db, cacheGet, cacheSet }) {
  // Leaderboard: count distinct quiz dates where user guessed at least one image
  app.get('/api/leaderboard', (req, res) => {
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit || '50', 10)));
    const period = String(req.query.period || 'all'); // 'all' | 'week' | 'day'
    const dayParam = (req.query.date || '').trim();

    const cacheKey = `leaderboard:${period}:${dayParam || 'na'}:${limit}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    db.all('SELECT quiz_date, guessed_by FROM anime_guesses WHERE quiz_date IS NOT NULL', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      // Determine latest date if needed
      const allDates = Array.from(new Set((rows || []).map(r => r.quiz_date).filter(Boolean))).sort();
      const latest = allDates[allDates.length - 1] || null;

      const inWeekRange = (d, end) => {
        try {
          const endDate = new Date(end + 'T00:00:00Z');
          const startDate = new Date(endDate);
          startDate.setUTCDate(startDate.getUTCDate() - 6);
          const cur = new Date(d + 'T00:00:00Z');
          return cur >= startDate && cur <= endDate;
        } catch (_) { return false; }
      };

      if (period === 'day') {
        const day = dayParam || latest;
        const userIdToGuesses = new Map();
        for (const r of rows || []) {
          if (r.quiz_date !== day) continue;
          let users = [];
          try { users = JSON.parse(r.guessed_by || '[]'); } catch (_) { users = []; }
          if (!Array.isArray(users)) continue;
          for (const uid of users) {
            if (!uid) continue;
            userIdToGuesses.set(uid, (userIdToGuesses.get(uid) || 0) + 1);
          }
        }
        const results = Array.from(userIdToGuesses.entries()).map(([userId, guesses]) => ({ userId, guesses }));
        results.sort((a, b) => b.guesses - a.guesses);
        db.all('SELECT id, username FROM users', [], (e2, users) => {
          if (e2) return res.status(500).json({ error: e2.message });
          const idToName = new Map((users || []).map(u => [u.id, u.username]));
          const top = results.slice(0, limit).map((r, idx) => ({ rank: idx + 1, userId: r.userId, username: idToName.get(r.userId) || 'user', guesses: r.guesses, metric: 'guesses', date: day }));
          cacheSet(cacheKey, top, 60);
          res.json(top);
        });
        return;
      }

      // week or all
      const userIdToDates = new Map();
      for (const r of rows || []) {
        const d = r.quiz_date;
        if (!d) continue;
        if (period === 'week' && latest && !inWeekRange(d, latest)) continue;
        let users = [];
        try { users = JSON.parse(r.guessed_by || '[]'); } catch (_) { users = []; }
        if (!Array.isArray(users)) continue;
        for (const uid of users) {
          if (!uid) continue;
          if (!userIdToDates.has(uid)) userIdToDates.set(uid, new Set());
          userIdToDates.get(uid).add(d);
        }
      }
      const results = Array.from(userIdToDates.entries()).map(([userId, dates]) => ({ userId, days: (dates ? dates.size : 0) }));
      results.sort((a, b) => b.days - a.days);
      db.all('SELECT id, username FROM users', [], (e2, users) => {
        if (e2) return res.status(500).json({ error: e2.message });
        const idToName = new Map((users || []).map(u => [u.id, u.username]));
        const top = results.slice(0, limit).map((r, idx) => ({ rank: idx + 1, userId: r.userId, username: idToName.get(r.userId) || 'user', days: r.days, metric: 'days' }));
        cacheSet(cacheKey, top, 60);
        res.json(top);
      });
    });
  });
};

