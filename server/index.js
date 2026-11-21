import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { q, tx, migrate } from './db.js';

const PORT = Number(process.env.PORT) || 3000;
const SESSION_DAYS = 30;
const STATUSES = ['present', 'absent', 'late', 'excused'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

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
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  return crypto.timingSafeEqual(crypto.scryptSync(password, salt, 64), Buffer.from(hash, 'hex'));
}
function checkPassword(p) {
  if (typeof p !== 'string' || p.length < 6) fail(400, 'የይለፍ ቃል ቢያንስ 6 ፊደል መሆን አለበት');
  return p;
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

async function startSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const maxAge = SESSION_DAYS * 24 * 3600;
  await q(`INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, now() + make_interval(secs => $3))`, [
    token,
    userId,
    maxAge,
  ]);
  const secure = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`);
}

const publicUser = (u) => ({ id: u.id, username: u.username, full_name: u.full_name, role: u.role });

function str(v, { required = false, max = 200, name = 'field' } = {}) {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string') fail(400, `${name}: የተሳሳተ ዋጋ`);
  v = v.trim();
  if (required && !v) fail(400, `${name} ያስፈልጋል`);
  if (v.length > max) fail(400, `${name} በጣም ረጅም ነው`);
  return v;
}
function date(v, name = 'ቀን') {
  if (typeof v !== 'string' || !DATE_RE.test(v) || isNaN(Date.parse(v))) fail(400, `የተሳሳተ ${name}`);
  return v;
}
const intId = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) fail(400, 'የተሳሳተ መለያ ቁጥር');
  return n;
};

// ---------- auth ----------
app.use('/api', async (req, res, next) => {
  const token = parseCookies(req.headers.cookie).sid;
  if (token) {
    const { rows } = await q(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = $1 AND s.expires_at > now()`,
      [token]
    );
    if (rows[0]) {
      req.user = rows[0];
      req.sessionToken = token;
    }
  }
  next();
});
const requireAuth = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'እባክዎ ይግቡ' }));
const requireAdmin = (req, res, next) =>
  req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'ይህ ለአስተዳዳሪ ብቻ የተፈቀደ ነው' });

app.get('/api/setup-status', async (req, res) => {
  const { rows } = await q('SELECT COUNT(*)::int AS n FROM users');
  res.json({ needsSetup: rows[0].n === 0 });
});

// Creates the first admin account. Only works while there are no users.
app.post('/api/setup', async (req, res) => {
  const username = str(req.body.username, { required: true, max: 50, name: 'የተጠቃሚ ስም' });
  const full_name = str(req.body.full_name, { required: true, name: 'ሙሉ ስም' });
  const password = checkPassword(req.body.password);
  const user = await tx(async (c) => {
    await c.query('LOCK TABLE users IN EXCLUSIVE MODE');
    const { rows } = await c.query('SELECT COUNT(*)::int AS n FROM users');
    if (rows[0].n > 0) fail(409, 'መለያ አስቀድሞ ተፈጥሯል');
    return (
      await c.query(
        `INSERT INTO users (username, full_name, password_hash, role) VALUES ($1, $2, $3, 'admin') RETURNING *`,
        [username, full_name, hashPassword(password)]
      )
    ).rows[0];
  });
  await startSession(req, res, user.id);
  res.json({ user: publicUser(user) });
});

app.post('/api/login', async (req, res) => {
  const username = str(req.body.username, { required: true, name: 'የተጠቃሚ ስም' });
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const { rows } = await q('SELECT * FROM users WHERE lower(username) = lower($1)', [username]);
  const user = rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) fail(401, 'የተጠቃሚ ስም ወይም የይለፍ ቃል ተሳስቷል');
  await q('DELETE FROM sessions WHERE expires_at < now()');
  await startSession(req, res, user.id);
  res.json({ user: publicUser(user) });
});

app.post('/api/logout', async (req, res) => {
  if (req.sessionToken) await q('DELETE FROM sessions WHERE token = $1', [req.sessionToken]);
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

// ---------- user accounts ----------
app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await q('SELECT id, username, full_name, role, created_at FROM users ORDER BY id');
  res.json(rows);
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const username = str(req.body.username, { required: true, max: 50, name: 'የተጠቃሚ ስም' });
  const full_name = str(req.body.full_name, { required: true, name: 'ሙሉ ስም' });
  const role = req.body.role === 'admin' ? 'admin' : 'recorder';
  const password = checkPassword(req.body.password);
  try {
    const { rows } = await q(
      'INSERT INTO users (username, full_name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, full_name, hashPassword(password), role]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') fail(409, 'ይህ የተጠቃሚ ስም ተይዟል');
    throw err;
  }
});

app.put('/api/users/:id/password', requireAuth, async (req, res) => {
  const id = intId(req.params.id);
  if (req.user.role !== 'admin' && req.user.id !== id) fail(403, 'አልተፈቀደም');
  const password = checkPassword(req.body.password);
  const r = await q('UPDATE users SET password_hash = $1 WHERE id = $2', [hashPassword(password), id]);
  if (!r.rowCount) fail(404, 'ተጠቃሚው አልተገኘም');
  await q('DELETE FROM sessions WHERE user_id = $1 AND token <> $2', [id, req.sessionToken]);
  res.json({ ok: true });
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = intId(req.params.id);
  if (id === req.user.id) fail(400, 'የራስዎን መለያ መሰረዝ አይችሉም');
  const r = await q('DELETE FROM users WHERE id = $1', [id]);
  if (!r.rowCount) fail(404, 'ተጠቃሚው አልተገኘም');
  res.json({ ok: true });
});

// ---------- members ----------
function readMember(body) {
  if (body.gender !== 'M' && body.gender !== 'F') fail(400, 'ፆታ ያስፈልጋል');
  return [
    str(body.full_name, { required: true, name: 'ሙሉ ስም' }),
    body.gender,
    str(body.phone, { max: 30, name: 'ስልክ' }) || null,
    str(body.group_name, { max: 60, name: 'ክፍል' }) || 'መዘምራን',
    body.joined_on ? date(body.joined_on, 'የተመዘገበበት ቀን') : null,
    str(body.notes, { max: 1000, name: 'ማስታወሻ' }) || null,
    body.active !== false,
  ];
}

app.get('/api/members', requireAuth, async (req, res) => {
  const { rows } = await q(`
    SELECT m.*,
      COUNT(a.status)::int                                   AS sessions,
      COUNT(*) FILTER (WHERE a.status = 'present')::int      AS present,
      COUNT(*) FILTER (WHERE a.status = 'late')::int         AS late,
      COUNT(*) FILTER (WHERE a.status = 'absent')::int       AS absent,
      COUNT(*) FILTER (WHERE a.status = 'excused')::int      AS excused
    FROM members m LEFT JOIN attendance a ON a.member_id = m.id
    GROUP BY m.id
    ORDER BY m.sort_order, m.id`);
  res.json(rows);
});

app.post('/api/members', requireAuth, async (req, res) => {
  const { rows } = await q(
    `INSERT INTO members (full_name, gender, phone, group_name, joined_on, notes, active, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM members))
     RETURNING id`,
    readMember(req.body)
  );
  res.status(201).json(rows[0]);
});

app.put('/api/members/:id', requireAuth, async (req, res) => {
  const r = await q(
    `UPDATE members SET full_name = $1, gender = $2, phone = $3, group_name = $4, joined_on = $5, notes = $6, active = $7
     WHERE id = $8`,
    [...readMember(req.body), intId(req.params.id)]
  );
  if (!r.rowCount) fail(404, 'አባሉ አልተገኘም');
  res.json({ ok: true });
});

app.delete('/api/members/:id', requireAuth, requireAdmin, async (req, res) => {
  const r = await q('DELETE FROM members WHERE id = $1', [intId(req.params.id)]);
  if (!r.rowCount) fail(404, 'አባሉ አልተገኘም');
  res.json({ ok: true });
});

// ---------- attendance ----------
app.get('/api/attendance', requireAuth, async (req, res) => {
  const { rows } = await q('SELECT member_id, status FROM attendance WHERE date = $1', [date(req.query.date)]);
  res.json(Object.fromEntries(rows.map((r) => [r.member_id, r.status])));
});

// Body: { date, records: [{ member_id, status }] } — a null status clears the mark.
app.put('/api/attendance', requireAuth, async (req, res) => {
  const d = date(req.body.date);
  if (!Array.isArray(req.body.records)) fail(400, 'records must be a list');
  const set = [];
  const clear = [];
  for (const r of req.body.records) {
    const id = intId(r.member_id);
    if (r.status === null) clear.push(id);
    else if (STATUSES.includes(r.status)) set.push([id, r.status]);
    else fail(400, 'የተሳሳተ ሁኔታ');
  }
  await tx(async (c) => {
    if (set.length)
      await c.query(
        `INSERT INTO attendance (member_id, date, status, recorded_by)
         SELECT m, $1::date, s, $2 FROM unnest($3::int[], $4::text[]) AS t(m, s)
         ON CONFLICT (member_id, date) DO UPDATE
           SET status = EXCLUDED.status, recorded_by = EXCLUDED.recorded_by, recorded_at = now()`,
        [d, req.user.id, set.map((x) => x[0]), set.map((x) => x[1])]
      );
    if (clear.length) await c.query('DELETE FROM attendance WHERE date = $1 AND member_id = ANY($2::int[])', [d, clear]);
  });
  res.json({ ok: true });
});

app.get('/api/attendance/range', requireAuth, async (req, res) => {
  const { rows } = await q(
    'SELECT member_id, date, status FROM attendance WHERE date BETWEEN $1 AND $2 ORDER BY date',
    [date(req.query.from), date(req.query.to)]
  );
  res.json(rows);
});

// Days that have attendance recorded, with totals (used for calendar dots and charts).
app.get('/api/sessions', requireAuth, async (req, res) => {
  const { rows } = await q(
    `SELECT date,
       COUNT(*) FILTER (WHERE status = 'present')::int AS present,
       COUNT(*) FILTER (WHERE status = 'late')::int    AS late,
       COUNT(*) FILTER (WHERE status = 'absent')::int  AS absent,
       COUNT(*) FILTER (WHERE status = 'excused')::int AS excused,
       COUNT(*)::int AS total
     FROM attendance WHERE date BETWEEN $1 AND $2 GROUP BY date ORDER BY date`,
    [date(req.query.from), date(req.query.to)]
  );
  res.json(rows);
});

app.delete('/api/attendance/:date', requireAuth, requireAdmin, async (req, res) => {
  const r = await q('DELETE FROM attendance WHERE date = $1', [date(req.params.date)]);
  res.json({ deleted: r.rowCount });
});

// ---------- dashboard ----------
app.get('/api/dashboard', requireAuth, async (req, res) => {
  const [members, sessions, atRisk] = await Promise.all([
    q(`SELECT COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE gender = 'M')::int AS male,
         COUNT(*) FILTER (WHERE gender = 'F')::int AS female
       FROM members WHERE active`),
    q(`SELECT * FROM (
         SELECT date,
           COUNT(*) FILTER (WHERE status = 'present')::int AS present,
           COUNT(*) FILTER (WHERE status = 'late')::int    AS late,
           COUNT(*) FILTER (WHERE status = 'absent')::int  AS absent,
           COUNT(*) FILTER (WHERE status = 'excused')::int AS excused,
           COUNT(*)::int AS total
         FROM attendance GROUP BY date ORDER BY date DESC LIMIT 12
       ) s ORDER BY date`),
    // Active members whose last 3 recorded marks are all "absent" — they need a follow-up call.
    q(`WITH ranked AS (
         SELECT a.member_id, a.status,
                row_number() OVER (PARTITION BY a.member_id ORDER BY a.date DESC) AS rn
         FROM attendance a JOIN members m ON m.id = a.member_id AND m.active
       )
       SELECT m.id, m.full_name, m.gender, m.phone,
         (SELECT MAX(date) FROM attendance WHERE member_id = m.id AND status IN ('present', 'late')) AS last_seen
       FROM ranked r JOIN members m ON m.id = r.member_id
       WHERE r.rn <= 3
       GROUP BY m.id
       HAVING COUNT(*) = 3 AND bool_and(r.status = 'absent')
       ORDER BY m.sort_order`),
  ]);
  res.json({ members: members.rows[0], sessions: sessions.rows, atRisk: atRisk.rows });
});

// ---------- errors, static files, SPA fallback ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(DIST, 'index.html')) : next()));
}

app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(500).json({ error: 'የአገልጋይ ስህተት ተፈጥሯል' });
});

await migrate();
app.listen(PORT, () => console.log(`API ready on http://localhost:${PORT}`));
