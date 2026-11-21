const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'attendance.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    full_name     TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('admin', 'recorder')),
    created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS members (
    id         INTEGER PRIMARY KEY,
    full_name  TEXT NOT NULL,
    gender     TEXT NOT NULL CHECK (gender IN ('M', 'F')),
    phone      TEXT,
    group_name TEXT NOT NULL DEFAULT 'መዘምራን',
    joined_on  TEXT,
    notes      TEXT,
    active     INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attendance (
    member_id   INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    date        TEXT NOT NULL,
    status      TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (member_id, date)
  );

  CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
`);

function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// First run: load the members from the handwritten form.
const { n } = db.prepare('SELECT COUNT(*) AS n FROM members').get();
if (n === 0) {
  const seed = require('./seed-members');
  const insert = db.prepare(
    'INSERT INTO members (full_name, gender, sort_order) VALUES (?, ?, ?)'
  );
  tx(() => seed.forEach((m, i) => insert.run(m.full_name, m.gender, i + 1)));
  console.log(`Seeded ${seed.length} members from the paper form.`);
}

module.exports = { db, tx };
