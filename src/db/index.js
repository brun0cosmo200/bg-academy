const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT || 3306,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

async function initDB() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(255) NOT NULL,
      email       VARCHAR(255) NOT NULL UNIQUE,
      password    VARCHAR(255),
      google_id   VARCHAR(255) UNIQUE,
      avatar      VARCHAR(500),
      role        ENUM('personal','aluno') NOT NULL DEFAULT 'personal',
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    await pool.execute(
      "ALTER TABLE users ADD COLUMN role ENUM('personal','aluno') NOT NULL DEFAULT 'personal'"
    );
    console.log('✓ Coluna role adicionada');
  } catch (e) {
    console.log('✓ Coluna role já existe');
  }

  console.log('✓ Tabela users pronta');
}

module.exports = { pool, initDB };