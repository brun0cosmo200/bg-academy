require('dotenv').config();
const express = require('express');
const cors = require('cors');
const passport = require('./config/passport');
const authRoutes     = require('./routes/auth');
const alunoRoutes    = require('./routes/aluno');
const personalRoutes = require('./routes/personal');
const { initDB } = require('./db');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(passport.initialize());

app.use('/auth',     authRoutes);
app.use('/aluno',    alunoRoutes);
app.use('/personal', personalRoutes);

app.get('/', (req, res) => res.json({ status: 'BG Academy online 🟢' }));

const PORT = process.env.PORT || 3000;

initDB()
  .then(() => app.listen(PORT, () => console.log(`✓ Porta ${PORT}`)))
  .catch(err => { console.error(err); process.exit(1); });