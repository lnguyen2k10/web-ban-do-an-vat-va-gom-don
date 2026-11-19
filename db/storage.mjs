import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions';

const tables = /\blees_shop\.(shop|sessions|checkout|notifications)\b/g;
const sqliteSQL = sql => sql.replace(tables, '$1').replace(/\buser_id\b/g, 'user').replace(/ FOR UPDATE\b/g, '');
const postgresSQL = sql => {
  let parameter = 0;
  return sql.replace(/\?/g, () => '$' + ++parameter);
};

function sqliteDriver(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS shop (id INTEGER PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user TEXT NOT NULL, expiry INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS checkout (key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, order_ids TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, order_ids TEXT NOT NULL, next_try INTEGER NOT NULL, attempts INTEGER NOT NULL);
  `);
  const direct = {
    get: (sql, ...params) => db.prepare(sqliteSQL(sql)).get(...params),
    all: (sql, ...params) => db.prepare(sqliteSQL(sql)).all(...params),
    run: (sql, ...params) => db.prepare(sqliteSQL(sql)).run(...params).changes
  };
  let tail = Promise.resolve();
  function queue(fn) {
    const next = tail.then(fn);
    tail = next.catch(() => {});
    return next;
  }
  return {
    kind: 'sqlite',
    get: (...args) => queue(() => direct.get(...args)),
    all: (...args) => queue(() => direct.all(...args)),
    run: (...args) => queue(() => direct.run(...args)),
    transaction: fn => queue(async () => {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = await fn(direct);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }),
    close: () => queue(() => db.close())
  };
}

function pgConnection(client) {
  const query = (sql, params) => client.query(postgresSQL(sql), params);
  return {
    get: async (sql, ...params) => (await query(sql, params)).rows[0],
    all: async (sql, ...params) => (await query(sql, params)).rows,
    run: async (sql, ...params) => (await query(sql, params)).rowCount
  };
}

async function postgresDriver(connectionString, env) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Cần URL kết nối PostgreSQL.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const mode = url.searchParams.get('sslmode');
  if (mode === 'disable' && !local) throw new Error('Kết nối PostgreSQL từ xa phải dùng TLS.');
  for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  const ca = env.DATABASE_SSL_CA?.replace(/\\n/g, '\n');
  const pool = new pg.Pool({
    connectionString: url.href,
    ssl: local && (mode === 'disable' || !mode) ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    max: 5,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 10000
  });
  if (env.VERCEL) attachDatabasePool(pool);
  pool.on('error', error => console.error('PostgreSQL pool:', error.code || error.name));
  const driver = {
    kind: 'postgres',
    ...pgConnection(pool),
    async transaction(fn) {
      const client = await pool.connect();
      let discard;
      try {
        await client.query('BEGIN');
        const result = await fn(pgConnection(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch (rollbackError) { discard = rollbackError; }
        throw error;
      } finally {
        client.release(discard);
      }
    },
    close: () => pool.end()
  };
  try {
    if (env.DB_SKIP_MIGRATIONS === '1') {
      await driver.get('SELECT id FROM lees_shop.shop WHERE id=1');
    } else await driver.transaction(async tx => {
      await tx.get('SELECT pg_advisory_xact_lock(736180537189310201)');
      await tx.run(readFileSync(new URL('./postgres.sql', import.meta.url), 'utf8'));
    });
  } catch (error) {
    await pool.end();
    throw error;
  }
  return driver;
}

export async function openStorage(env = process.env) {
  const url = env.DATABASE_URL || env.SUPABASE_DB_URL || env.POSTGRES_URL;
  if (env.DB_ENGINE && !['sqlite', 'postgres'].includes(env.DB_ENGINE)) throw new Error('DB_ENGINE phải là sqlite hoặc postgres.');
  if (env.VERCEL && (!url || env.DB_ENGINE === 'sqlite')) throw new Error('Vercel cần DATABASE_URL.');
  if (env.DB_ENGINE === 'sqlite') return sqliteDriver(env.DB_PATH || 'data/shop.sqlite');
  if (url) return postgresDriver(url, env);
  if (env.DB_ENGINE === 'postgres') throw new Error('Thiếu DATABASE_URL cho PostgreSQL.');
  return sqliteDriver(env.DB_PATH || 'data/shop.sqlite');
}

export async function initShop(storage, factory) {
  await storage.run('INSERT INTO lees_shop.shop (id, payload) VALUES (1, ?) ON CONFLICT (id) DO NOTHING', JSON.stringify(factory()));
}

export async function loadShop(storage, lock = false) {
  const row = await storage.get('SELECT payload FROM lees_shop.shop WHERE id=1' + (lock ? ' FOR UPDATE' : ''));
  return JSON.parse(row.payload);
}

export function writeShop(storage, fn) {
  return storage.transaction(async tx => {
    const db = await loadShop(tx, true);
    const result = await fn(db, tx);
    await tx.run('UPDATE lees_shop.shop SET payload=? WHERE id=1', JSON.stringify(db));
    return result;
  });
}
