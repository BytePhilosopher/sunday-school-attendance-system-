const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { db, tx } = require('./db');

const PORT = Number(process.env.PORT) || 3000;
const SESSION_DAYS = 30;
const STATUSES = ['present', 'absent', 'late', 'excused'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- helpers ----------
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message);
};

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function startSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const maxAge = SESSION_DAYS * 24 * 3600;
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    Date.now() + maxAge * 1000
  );
  const secure = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`);
}

const publicUser = (u) => u && { id: u.id, username: u.username, full_name: u.full_name, role: u.role };

function str(v, { required = false, max = 200, name = 'field' } = {}) {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string') fail(400, `${name} must be text`);
  v = v.trim();
  if (required && !v) fail(400, `${name} ያስፈልጋል (required)`);
  if (v.length > max) fail(400, `${name} is too long`);
  return v;
}
function date(v, name = 'date') {
  if (typeof v !== 'string' || !DATE_RE.test(v) || isNaN(Date.parse(v))) fail(400, `invalid ${name}`);
  return v;
}

// ---------- auth middleware ----------
app.use('/api', (req, res, next) => {
  const token = parseCookies(req.headers.cookie).sid;
  if (token) {
    const row = db
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > ?`
      )
      .get(token, Date.now());
    if (row) {
      req.user = row;
      req.sessionToken = token;
    }
  }
  next();
});
const requireAuth = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'እባክዎ ይግቡ (please log in)' }));
const requireAdmin = (req, res, next) =>
  req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'ለአስተዳዳሪ ብቻ (admins only)' });

// ---------- auth routes ----------
app.get('/api/setup-status', (req, res) => {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  res.json({ needsSetup: n === 0 });
});

// Creates the first admin account. Only works while there are no users.
app.post('/api/setup', (req, res) => {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n > 0) fail(409, 'Setup already completed');
  const username = str(req.body.username, { required: true, max: 50, name: 'username' });
  const full_name = str(req.body.full_name, { required: true, name: 'full name' });
  const password = req.body.password;
  if (typeof password !== 'string' || password.length < 6) fail(400, 'የይለፍ ቃል ቢያንስ 6 ፊደል (password min 6 chars)');
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (username, full_name, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(username, full_name, hashPassword(password), 'admin');
  startSession(req, res, lastInsertRowid);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid)) });
});

app.post('/api/login', (req, res) => {
  const username = str(req.body.username, { required: true, name: 'username' });
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !verifyPassword(password, user.password_hash)) fail(401, 'የተሳሳተ ስም ወይም የይለፍ ቃል (wrong username or password)');
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  startSession(req, res, user.id);
  res.json({ user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
  if (req.sessionToken) db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

// ---------- users (accounts that can take attendance) ----------
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT id, username, full_name, role, created_at FROM users ORDER BY id').all());
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const username = str(req.body.username, { required: true, max: 50, name: 'username' });
  const full_name = str(req.body.full_name, { required: true, name: 'full name' });
  const role = req.body.role === 'admin' ? 'admin' : 'recorder';
  const password = req.body.password;
  if (typeof password !== 'string' || password.length < 6) fail(400, 'የይለፍ ቃል ቢያንስ 6 ፊደል (password min 6 chars)');
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) fail(409, 'ይህ ስም ተይዟል (username taken)');
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (username, full_name, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(username, full_name, hashPassword(password), role);
  res.status(201).json({ id: Number(lastInsertRowid) });
});

app.put('/api/users/:id/password', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (req.user.role !== 'admin' && req.user.id !== id) fail(403, 'Not allowed');
  const password = req.body.password;
  if (typeof password !== 'string' || password.length < 6) fail(400, 'የይለፍ ቃል ቢያንስ 6 ፊደል (password min 6 chars)');
  const r = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), id);
  if (!r.changes) fail(404, 'User not found');
  // Sign out the user's other sessions.
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(id, req.sessionToken);
  res.json({ ok: true });
});

app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) fail(400, 'ራስዎን መሰረዝ አይችሉም (cannot delete yourself)');
  const r = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (!r.changes) fail(404, 'User not found');
  res.json({ ok: true });
});

// ---------- members ----------
function readMember(body) {
  const gender = body.gender === 'F' ? 'F' : body.gender === 'M' ? 'M' : fail(400, 'ፆታ ያስፈልጋል (gender required)');
  const joined_on = body.joined_on ? date(body.joined_on, 'joined date') : null;
  return {
    full_name: str(body.full_name, { required: true, name: 'ስም (name)' }),
    gender,
    phone: str(body.phone, { max: 30, name: 'phone' }) || null,
    group_name: str(body.group_name, { max: 60, name: 'group' }) || 'መዘምራን',
    joined_on,
    notes: str(body.notes, { max: 1000, name: 'notes' }) || null,
    active: body.active === false || body.active === 0 ? 0 : 1,
  };
}

app.get('/api/members', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT m.*,
         COUNT(a.status)                                   AS sessions,
         SUM(a.status = 'present')                         AS present,
         SUM(a.status = 'late')                            AS late,
         SUM(a.status = 'absent')                          AS absent,
         SUM(a.status = 'excused')                         AS excused
       FROM members m LEFT JOIN attendance a ON a.member_id = m.id
       GROUP BY m.id
       ORDER BY m.sort_order, m.id`
    )
    .all();
  res.json(rows);
});

app.get('/api/groups', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT DISTINCT group_name FROM members ORDER BY group_name').all().map((r) => r.group_name));
});

app.post('/api/members', requireAuth, (req, res) => {
  const m = readMember(req.body);
  const { next } = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM members').get();
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO members (full_name, gender, phone, group_name, joined_on, notes, active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(m.full_name, m.gender, m.phone, m.group_name, m.joined_on, m.notes, m.active, next);
  res.status(201).json({ id: Number(lastInsertRowid) });
});

app.put('/api/members/:id', requireAuth, (req, res) => {
  const m = readMember(req.body);
  const r = db
    .prepare(
      `UPDATE members SET full_name = ?, gender = ?, phone = ?, group_name = ?, joined_on = ?, notes = ?, active = ?
       WHERE id = ?`
    )
    .run(m.full_name, m.gender, m.phone, m.group_name, m.joined_on, m.notes, m.active, Number(req.params.id));
  if (!r.changes) fail(404, 'Member not found');
  res.json({ ok: true });
});

app.delete('/api/members/:id', requireAuth, requireAdmin, (req, res) => {
  const r = db.prepare('DELETE FROM members WHERE id = ?').run(Number(req.params.id));
  if (!r.changes) fail(404, 'Member not found');
  res.json({ ok: true });
});

// ---------- attendance ----------
app.get('/api/attendance', requireAuth, (req, res) => {
  const d = date(req.query.date);
  const rows = db.prepare('SELECT member_id, status FROM attendance WHERE date = ?').all(d);
  res.json(Object.fromEntries(rows.map((r) => [r.member_id, r.status])));
});

// Body: { date, records: [{ member_id, status }] } — status null clears the mark.
app.put('/api/attendance', requireAuth, (req, res) => {
  const d = date(req.body.date);
  const records = Array.isArray(req.body.records) ? req.body.records : fail(400, 'records must be a list');
  const upsert = db.prepare(
    `INSERT INTO attendance (member_id, date, status, recorded_by) VALUES (?, ?, ?, ?)
     ON CONFLICT (member_id, date) DO UPDATE SET status = excluded.status,
       recorded_by = excluded.recorded_by, recorded_at = CURRENT_TIMESTAMP`
  );
  const remove = db.prepare('DELETE FROM attendance WHERE member_id = ? AND date = ?');
  tx(() => {
    for (const r of records) {
      const memberId = Number(r.member_id);
      if (!Number.isInteger(memberId)) fail(400, 'invalid member_id');
      if (r.status === null) remove.run(memberId, d);
      else if (STATUSES.includes(r.status)) upsert.run(memberId, d, r.status, req.user.id);
      else fail(400, 'invalid status');
    }
  });
  res.json({ ok: true });
});

app.get('/api/attendance/range', requireAuth, (req, res) => {
  const from = date(req.query.from, 'from');
  const to = date(req.query.to, 'to');
  res.json(
    db
      .prepare('SELECT member_id, date, status FROM attendance WHERE date BETWEEN ? AND ? ORDER BY date')
      .all(from, to)
  );
});

// Delete an entire session (e.g. recorded on the wrong day).
app.delete('/api/attendance/:date', requireAuth, requireAdmin, (req, res) => {
  const d = date(req.params.date);
  const r = db.prepare('DELETE FROM attendance WHERE date = ?').run(d);
  res.json({ deleted: r.changes });
});

// ---------- dashboard ----------
app.get('/api/dashboard', requireAuth, (req, res) => {
  const members = db.prepare('SELECT id, full_name, gender, phone, group_name FROM members WHERE active = 1').all();
  const sessions = db
    .prepare(
      `SELECT date,
         SUM(status = 'present') AS present, SUM(status = 'late') AS late,
         SUM(status = 'absent') AS absent, SUM(status = 'excused') AS excused,
         COUNT(*) AS total
       FROM attendance GROUP BY date ORDER BY date DESC LIMIT 12`
    )
    .all();

  // Members whose last 3 recorded marks are all "absent" — need a follow-up call.
  const recent = db
    .prepare(
      `SELECT member_id, date, status FROM attendance
       WHERE member_id IN (SELECT id FROM members WHERE active = 1)
       ORDER BY date DESC`
    )
    .all();
  const history = new Map();
  for (const r of recent) {
    const h = history.get(r.member_id) || [];
    if (h.length < 3) h.push(r);
    history.set(r.member_id, h);
  }
  const atRisk = members
    .filter((m) => {
      const h = history.get(m.id);
      return h && h.length === 3 && h.every((r) => r.status === 'absent');
    })
    .map((m) => ({ ...m, last_seen: lastSeen(m.id) }));

  res.json({
    members: {
      total: members.length,
      male: members.filter((m) => m.gender === 'M').length,
      female: members.filter((m) => m.gender === 'F').length,
    },
    sessions,
    atRisk,
  });
});

const lastSeenStmt = db.prepare(
  "SELECT MAX(date) AS d FROM attendance WHERE member_id = ? AND status IN ('present', 'late')"
);
const lastSeen = (id) => lastSeenStmt.get(id).d;

// ---------- errors & SPA fallback ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Attendance system running at http://localhost:${PORT}`);
});
