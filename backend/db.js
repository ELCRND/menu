import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER || "ttk_user",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "ttk_db",
  password: process.env.DB_PASSWORD || "0042",
  port: Number(process.env.DB_PORT) || 5432,
  // Настройки пула для стабильной работы
  max: 20, // Максимум одновременных подключений
  idleTimeoutMillis: 30000, // Закрывать неактивные соединения через 30 сек
  connectionTimeoutMillis: 2000, // Таймаут ожидания подключения 2 сек
});

// Проверка подключения при старте сервера
pool.on("error", (err) => {
  console.error("Неожиданная ошибка на неактивном клиенте PostgreSQL:", err);
  process.exit(-1);
});

export default pool;
