const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

// ── LOCAL (email + senha) ────────────────────────────────────────
passport.use(new LocalStrategy(
  { usernameField: 'email' },
  async (email, password, done) => {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM users WHERE email = ?', [email]
      );
      const user = rows[0];

      if (!user) return done(null, false, { message: 'E-mail não encontrado.' });
      if (!user.password) return done(null, false, { message: 'Esta conta usa login Google.' });

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return done(null, false, { message: 'Senha incorreta.' });

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// ── GOOGLE OAuth ─────────────────────────────────────────────────
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('⚠️  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET não configurados. Login Google desativado.');
} else
passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.GOOGLE_CALLBACK_URL,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email  = profile.emails[0].value;
      const name   = profile.displayName;
      const avatar = profile.photos[0]?.value;
      const googleId = profile.id;

      // Já existe com esse google_id?
      let [rows] = await pool.execute(
        'SELECT * FROM users WHERE google_id = ?', [googleId]
      );

      if (rows[0]) return done(null, rows[0]);

      // Já existe com esse email (cadastro local)?
      [rows] = await pool.execute(
        'SELECT * FROM users WHERE email = ?', [email]
      );

      if (rows[0]) {
        // Vincula o google_id à conta existente
        await pool.execute(
          'UPDATE users SET google_id = ?, avatar = ? WHERE id = ?',
          [googleId, avatar, rows[0].id]
        );
        return done(null, { ...rows[0], google_id: googleId, avatar });
      }

      // Cria conta nova
      const [result] = await pool.execute(
        'INSERT INTO users (name, email, google_id, avatar) VALUES (?, ?, ?, ?)',
        [name, email, googleId, avatar]
      );

      const newUser = { id: result.insertId, name, email, google_id: googleId, avatar };
      return done(null, newUser);
    } catch (err) {
      return done(err);
    }
  }
));

module.exports = passport;
