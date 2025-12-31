module.exports = function registerStatsRoutes(app, { db, cacheGet, cacheSet }) {
  // Глобальная статистика (самые угадываемые, быстрые игроки, последние режимы)
  app.get('/api/stats/global', async (req, res) => {
    const cacheKey = 'stats:global';
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const runQuery = (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) {
            if (err.code === 'SQLITE_ERROR') {
              return resolve([]);
            }
            return reject(err);
          }
          resolve(rows || []);
        });
      });

    try {
      const guessRows = await runQuery(`SELECT title, guessed_by FROM anime_guesses`);
      const popularMap = new Map();
      const playerGuessCount = new Map();

      (guessRows || []).forEach((row) => {
        let users = [];
        try {
          users = JSON.parse(row.guessed_by || '[]');
        } catch (_) {
          users = [];
        }
        if (!Array.isArray(users)) users = [];
        const guessesCount = users.length;
        if (guessesCount > 0) {
          popularMap.set(row.title, (popularMap.get(row.title) || 0) + guessesCount);
          users.forEach((uid) => {
            if (!uid) return;
            playerGuessCount.set(uid, (playerGuessCount.get(uid) || 0) + 1);
          });
        }
      });

      const mostGuessedAnime = Array.from(popularMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([title, guesses]) => ({ title, guesses }));

      const scoreRows = await runQuery(
        `SELECT user_id, SUM(score) as total_score
         FROM user_scores
         GROUP BY user_id
         ORDER BY total_score DESC
         LIMIT 5`
      );

      const userRows = await runQuery(`SELECT id, username FROM users`);
      const userMap = new Map(userRows.map((u) => [u.id, u.username]));

      let fastestPlayers = (scoreRows || []).map((row) => ({
        userId: row.user_id,
        username: userMap.get(row.user_id) || 'Игрок',
        score: Number(row.total_score) || 0
      }));

      // Fallback: if there were no scores, use guess counts to highlight active players
      if (!fastestPlayers.length && playerGuessCount.size) {
        fastestPlayers = Array.from(playerGuessCount.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([userId, count]) => ({
            userId,
            username: userMap.get(userId) || 'Игрок',
            score: count
          }));
      }

      const modeRows = await runQuery(
        `SELECT quiz_type, COUNT(*) as plays
         FROM user_scores
         GROUP BY quiz_type
         ORDER BY plays DESC
         LIMIT 5`
      );

      const recentModes = (modeRows || []).map((row) => ({
        mode: row.quiz_type,
        plays: Number(row.plays) || 0
      }));

      const payload = {
        mostGuessedAnime,
        fastestPlayers,
        recentModes
      };
      cacheSet(cacheKey, payload, 300);
      res.json(payload);
    } catch (error) {
      console.error('[stats/global] error:', error);
      res.status(500).json({ error: error.message || 'Не удалось загрузить статистику' });
    }
  });
};

