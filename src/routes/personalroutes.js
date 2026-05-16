const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { pool } = require('../db');

// ── Middleware: só personais ─────────────────────────────────────
function personalOnly(req, res, next) {
  if (req.user.role !== 'personal')
    return res.status(403).json({ error: 'Apenas personais podem acessar este recurso.' });
  next();
}

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

// ── GET /personal/alunos — alunos vinculados ao personal ─────────
router.get('/alunos', authMiddleware, personalOnly, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        v.id as vinculo_id, v.status, v.created_at as vinculo_desde,
        u.id as aluno_id, u.name, u.email, u.avatar,
        p.idade, p.peso, p.altura, p.objetivo, p.nivel, p.frequencia, p.restricoes, p.obs
      FROM vinculos v
      JOIN users u ON u.id = v.aluno_id
      LEFT JOIN perfil_aluno p ON p.user_id = v.aluno_id
      WHERE v.personal_id = ?
      ORDER BY v.status ASC, v.created_at DESC
    `, [req.user.id]);

    const alunos = rows.map(r => ({
      ...r,
      restricoes: r.restricoes ? JSON.parse(r.restricoes) : []
    }));

    return res.json({ alunos });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── PATCH /personal/vinculo/:alunoId — aceita ou recusa ──────────
router.patch('/vinculo/:alunoId', authMiddleware, personalOnly, async (req, res) => {
  const { acao } = req.body; // 'aceitar' ou 'recusar'
  const alunoId = parseInt(req.params.alunoId);

  if (!['aceitar','recusar'].includes(acao))
    return res.status(400).json({ error: 'Ação inválida. Use "aceitar" ou "recusar".' });

  const novoStatus = acao === 'aceitar' ? 'ativo' : 'cancelado';

  try {
    const [result] = await pool.execute(`
      UPDATE vinculos SET status = ?
      WHERE aluno_id = ? AND personal_id = ?
    `, [novoStatus, alunoId, req.user.id]);

    if (result.affectedRows === 0)
      return res.status(404).json({ error: 'Vínculo não encontrado.' });

    return res.json({ message: `Vínculo ${acao === 'aceitar' ? 'aceito' : 'recusado'}.` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── POST /personal/treino — cria treino para aluno ───────────────
router.post('/treino', authMiddleware, personalOnly, async (req, res) => {
  const { aluno_id, titulo, descricao, exercicios } = req.body;

  if (!aluno_id) return res.status(400).json({ error: 'Informe o aluno.' });
  if (!titulo)   return res.status(400).json({ error: 'Título obrigatório.' });

  try {
    // verifica se o aluno está vinculado a este personal
    const [vinc] = await pool.execute(`
      SELECT id FROM vinculos
      WHERE aluno_id = ? AND personal_id = ? AND status = 'ativo'
    `, [aluno_id, req.user.id]);

    if (!vinc[0])
      return res.status(403).json({ error: 'Este aluno não está vinculado a você.' });

    const [result] = await pool.execute(`
      INSERT INTO treinos (aluno_id, personal_id, titulo, descricao, tipo)
      VALUES (?, ?, ?, ?, 'personal')
    `, [aluno_id, req.user.id, titulo, descricao || '']);

    const treinoId = result.insertId;

    if (exercicios && exercicios.length > 0) {
      for (let i = 0; i < exercicios.length; i++) {
        const ex = exercicios[i];
        await pool.execute(`
          INSERT INTO exercicios (treino_id, nome, series, reps, peso, obs, ordem)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [treinoId, ex.nome, ex.series || 3, ex.reps || '12', ex.peso || '', ex.obs || '', i]);
      }
    }

    return res.status(201).json({ message: 'Treino enviado ao aluno.', id: treinoId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── GET /personal/treinos/:alunoId — treinos enviados para aluno ─
router.get('/treinos/:alunoId', authMiddleware, personalOnly, async (req, res) => {
  try {
    const [treinos] = await pool.execute(`
      SELECT * FROM treinos
      WHERE aluno_id = ? AND personal_id = ?
      ORDER BY created_at DESC
    `, [req.params.alunoId, req.user.id]);

    for (const treino of treinos) {
      const [exercicios] = await pool.execute(
        'SELECT * FROM exercicios WHERE treino_id = ? ORDER BY ordem ASC', [treino.id]
      );
      treino.exercicios = exercicios;
    }

    return res.json({ treinos });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;