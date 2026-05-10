require('dotenv').config();
const express = require('express');
const cors = require('cors');
const passport = require('./config/passport');
const authRoutes = require('./routes/auth');
const { initDB } = require('./db');

const app = express();

// ── Middlewares ──────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(passport.initialize());

// ── Rotas ────────────────────────────────────────────────────────
app.use('/auth', authRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'BG Academy Auth online 🟢' });
});

// ── Start ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✓ Servidor rodando na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Erro ao conectar no banco:', err);
    process.exit(1);
  });
