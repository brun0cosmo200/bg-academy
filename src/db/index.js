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
  // users
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      name       VARCHAR(255) NOT NULL,
      email      VARCHAR(255) NOT NULL UNIQUE,
      password   VARCHAR(255),
      google_id  VARCHAR(255) UNIQUE,
      avatar     VARCHAR(500),
      role       ENUM('personal','aluno') NOT NULL DEFAULT 'personal',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try { await pool.execute("ALTER TABLE users ADD COLUMN role ENUM('personal','aluno') NOT NULL DEFAULT 'personal'"); } catch(e){}

  // perfil_aluno
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS perfil_aluno (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT NOT NULL UNIQUE,
      nome       VARCHAR(255),
      idade      INT,
      peso       DECIMAL(5,1),
      altura     INT,
      objetivo   ENUM('emagrecer','massa','condicionamento','saude'),
      nivel      ENUM('iniciante','intermediario','avancado'),
      frequencia INT DEFAULT 3,
      restricoes JSON,
      obs        TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // vinculos
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS vinculos (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      aluno_id   INT NOT NULL,
      personal_id INT NOT NULL,
      status     ENUM('pendente','ativo','cancelado') NOT NULL DEFAULT 'pendente',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unico_vinculo (aluno_id),
      FOREIGN KEY (aluno_id)    REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (personal_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // treinos
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS treinos (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      aluno_id    INT NOT NULL,
      personal_id INT,
      titulo      VARCHAR(255) NOT NULL,
      descricao   TEXT,
      tipo        ENUM('personal','proprio') DEFAULT 'proprio',
      status      ENUM('pendente','concluido') DEFAULT 'pendente',
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (aluno_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // exercicios
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS exercicios (
      id        INT AUTO_INCREMENT PRIMARY KEY,
      treino_id INT NOT NULL,
      nome      VARCHAR(255) NOT NULL,
      series    INT DEFAULT 3,
      reps      VARCHAR(50) DEFAULT '12',
      peso      VARCHAR(50),
      obs       TEXT,
      feito     TINYINT(1) DEFAULT 0,
      ordem     INT DEFAULT 0,
      FOREIGN KEY (treino_id) REFERENCES treinos(id) ON DELETE CASCADE
    )
  `);

  console.log('✓ Tabelas prontas');
}

module.exports = { pool, initDB };