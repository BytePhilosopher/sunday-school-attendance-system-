import pg from 'pg';
import seedMembers from './seed-members.js';

if (!process.env.DATABASE_URL) {
  console.error('\n  DATABASE_URL is not set. Copy .env.example to .env and paste your Neon connection string.\n');
  process.exit(1);
}

// Return DATE columns as plain 'YYYY-MM-DD' strings (no timezone shifting).
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
});

export const q = (text, params) => pool.query(text, params);

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('admin', 'recorder')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (lower(username));

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  );

  CREATE TABLE IF NOT EXISTS members (
    id         SERIAL PRIMARY KEY,
    full_name  TEXT NOT NULL,
    gender     CHAR(1) NOT NULL CHECK (gender IN ('M', 'F')),
    phone      TEXT,
    group_name TEXT NOT NULL DEFAULT 'መዘምራን',
    joined_on  DATE,
    notes      TEXT,
    active     BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS attendance (
    member_id   INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    status      TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    recorded_by INT REFERENCES users(id) ON DELETE SET NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (member_id, date)
  );
  CREATE INDEX IF NOT EXISTS attendance_date_idx ON attendance (date);
`;

// Creates tables if needed and, on an empty database, loads the members from the paper form.
export async function migrate() {
  await q(SCHEMA);
  await tx(async (c) => {
    await c.query('LOCK TABLE members IN EXCLUSIVE MODE');
    const { rows } = await c.query('SELECT COUNT(*)::int AS n FROM members');
    if (rows[0].n > 0) return;
    await c.query(
      `INSERT INTO members (full_name, gender, sort_order)
       SELECT name, gender, ord FROM unnest($1::text[], $2::text[]) WITH ORDINALITY AS t(name, gender, ord)`,
      [seedMembers.map((m) => m.full_name), seedMembers.map((m) => m.gender)]
    );
    console.log(`Seeded ${seedMembers.length} members from the paper form.`);
  });
}
