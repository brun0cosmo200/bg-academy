const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { pool } = require('../db');

// ── Middleware: só alunos ────────────────────────────────────────
function alunoOnly(req, res, next) {
  if (req.user.role !== 'aluno')
    return res.status(403).json({ error: 'Apenas alunos podem acessar este recurso.' });
  next();
}

// ── POST /aluno/perfil ───────────────────────────────────────────
router.post('/perfil', authMiddleware, alunoOnly, async (req, res) => {
  const { nome, idade, peso, altura, objetivo, nivel, frequencia, restricoes, obs } = req.body;

  const objetivos = ['emagrecer','massa','condicionamento','saude'];
  const niveis    = ['iniciante','intermediario','avancado'];

  if (!nome)                         return res.status(400).json({ error: 'Nome obrigatório.' });
  if (!idade || idade < 10)          return res.status(400).json({ error: 'Idade inválida.' });
  if (!peso  || peso < 30)           return res.status(400).json({ error: 'Peso inválido.' });
  if (!altura || altura < 100)       return res.status(400).json({ error: 'Altura inválida.' });
  if (!objetivos.includes(objetivo)) return res.status(400).json({ error: 'Objetivo inválido.' });
  if (!niveis.includes(nivel))       return res.status(400).json({ error: 'Nível inválido.' });

  const freq  = Math.min(7, Math.max(1, parseInt(frequencia) || 3));
  const restr = JSON.stringify(restricoes || []);

  try {
    await pool.execute(`
      INSERT INTO perfil_aluno (user_id, nome, idade, peso, altura, objetivo, nivel, frequencia, restricoes, obs)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nome=VALUES(nome), idade=VALUES(idade), peso=VALUES(peso), altura=VALUES(altura),
        objetivo=VALUES(objetivo), nivel=VALUES(nivel), frequencia=VALUES(frequencia),
        restricoes=VALUES(restricoes), obs=VALUES(obs)
    `, [req.user.id, nome, idade, peso, altura, objetivo, nivel, freq, restr, obs || '']);

    return res.status(200).json({ message: 'Perfil salvo.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── GET /aluno/perfil ────────────────────────────────────────────
router.get('/perfil', authMiddleware, alunoOnly, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM perfil_aluno WHERE user_id = ?', [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ perfil: null });
    const perfil = { ...rows[0], restricoes: JSON.parse(rows[0].restricoes || '[]') };
    return res.json({ perfil });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── POST /aluno/contratar/:personalId ────────────────────────────
router.post('/contratar/:personalId', authMiddleware, alunoOnly, async (req, res) => {
  const personalId = parseInt(req.params.personalId);

  try {
    // verifica se o personal existe
    const [p] = await pool.execute(
      "SELECT id FROM users WHERE id = ? AND role = 'personal'", [personalId]
    );
    if (!p[0]) return res.status(404).json({ error: 'Personal não encontrado.' });

    // cria ou atualiza vínculo
    await pool.execute(`
      INSERT INTO vinculos (aluno_id, personal_id, status)
      VALUES (?, ?, 'pendente')
      ON DUPLICATE KEY UPDATE personal_id = VALUES(personal_id), status = 'pendente'
    `, [req.user.id, personalId]);

    return res.json({ message: 'Solicitação enviada ao personal.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── GET /aluno/vinculo ───────────────────────────────────────────
router.get('/vinculo', authMiddleware, alunoOnly, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT v.status, v.created_at,
             u.id as personal_id, u.name as personal_name,
             u.email as personal_email, u.avatar as personal_avatar
      FROM vinculos v
      JOIN users u ON u.id = v.personal_id
      WHERE v.aluno_id = ?
    `, [req.user.id]);

    if (!rows[0]) return res.json({ vinculo: null });
    return res.json({ vinculo: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── DELETE /aluno/vinculo ────────────────────────────────────────
router.delete('/vinculo', authMiddleware, alunoOnly, async (req, res) => {
  try {
    await pool.execute(
      "UPDATE vinculos SET status = 'cancelado' WHERE aluno_id = ?", [req.user.id]
    );
    return res.json({ message: 'Vínculo cancelado.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── GET /aluno/treinos ───────────────────────────────────────────
router.get('/treinos', authMiddleware, alunoOnly, async (req, res) => {
  try {
    const [treinos] = await pool.execute(`
      SELECT t.*, u.name as personal_name
      FROM treinos t
      LEFT JOIN users u ON u.id = t.personal_id
      WHERE t.aluno_id = ?
      ORDER BY t.created_at DESC
    `, [req.user.id]);

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

// ── POST /aluno/treinos ──────────────────────────────────────────
router.post('/treinos', authMiddleware, alunoOnly, async (req, res) => {
  const { titulo, descricao, exercicios } = req.body;

  if (!titulo) return res.status(400).json({ error: 'Título obrigatório.' });

  try {
    const [result] = await pool.execute(`
      INSERT INTO treinos (aluno_id, titulo, descricao, tipo)
      VALUES (?, ?, ?, 'proprio')
    `, [req.user.id, titulo, descricao || '']);

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

    return res.status(201).json({ message: 'Treino criado.', id: treinoId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── PATCH /aluno/treinos/:id/exercicio/:exId ─────────────────────
router.patch('/treinos/:id/exercicio/:exId', authMiddleware, alunoOnly, async (req, res) => {
  const { feito } = req.body;
  try {
    await pool.execute(
      'UPDATE exercicios SET feito = ? WHERE id = ?', [feito ? 1 : 0, req.params.exId]
    );
    return res.json({ message: 'Atualizado.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── PATCH /aluno/treinos/:id/concluir ────────────────────────────
router.patch('/treinos/:id/concluir', authMiddleware, alunoOnly, async (req, res) => {
  try {
    await pool.execute(
      "UPDATE treinos SET status = 'concluido' WHERE id = ? AND aluno_id = ?",
      [req.params.id, req.user.id]
    );
    return res.json({ message: 'Treino concluído.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;