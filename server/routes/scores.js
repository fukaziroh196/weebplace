const { body } = require('express-validator');

module.exports = function registerScoresRoutes(app, { db, authenticateToken, handleValidationErrors, invalidateCache }) {
  // Submit quiz score
  app.post('/api/scores', authenticateToken, [
    body('quizType')
      .trim()
      .notEmpty()
      .withMessage('quizType is required')
      .isLength({ max: 50 })
      .withMessage('quizType too long')
      .escape(),
    body('score')
      .isNumeric()
      .withMessage('score must be a number'),
    body('date')
      .trim()
      .notEmpty()
      .withMessage('date is required')
      .isLength({ max: 20 })
      .escape(),
    handleValidationErrors
  ], (req, res) => {
    const { quizType, score, date } = req.body;
  
    const scoreId = `score_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
    db.run(
      'INSERT INTO user_scores (id, user_id, quiz_type, score, quiz_date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [scoreId, req.user.id, quizType, Number(score), date, Date.now()],
      function(err) {
        if (err) {
          console.error('[POST /api/scores] Error:', err);
          return res.status(500).json({ error: err.message });
        }
        
        console.log(`[POST /api/scores] Score submitted: ${score} points for ${quizType} by ${req.user.username}`);
        invalidateCache();
        res.json({ success: true, scoreId });
      }
    );
  });
};

