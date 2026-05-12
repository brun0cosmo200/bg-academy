const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { pool } = require('../db');

// ── GET /personal/lista — todos os personais ─────────────────────
router.get('/lista', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT u.id, u.name, u.email, u.avatar, u.created_at
      FROM users u
      WHERE u.role = 'personal'
      ORDER BY u.name ASC
    `);
    return res.json({ personais: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;