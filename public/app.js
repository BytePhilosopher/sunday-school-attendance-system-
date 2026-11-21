/* global EthCal */
'use strict';

const SCHOOL = 'የደብረ ጽዮን ሰላም አርጊው ቅድስት ማርያም ሰ/ት/ቤት';
const FORM_TITLE = 'የመዘምራን መቆጣጠሪያ ቅጽ';

const STATUS = {
  present: { sym: '✓', label: 'ተገኝቷል', short: 'ተገኝ' },
  absent: { sym: '✗', label: 'ቀሪ', short: 'ቀሪ' },
  late: { sym: '◐', label: 'አርፍዷል', short: 'ዘግይቶ' },
  excused: { sym: 'ፈ', label: 'በፈቃድ', short: 'ፈቃድ' },
};
const GENDER = { M: 'ወ', F: 'ሴ' };

const state = { me: null };

// ---------- utilities ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && url !== '/api/login') {
    state.me = null;
    renderLogin();
    throw new Error(data.error || 'Unauthorized');
  }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

let toastTimer;
function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show' + (isError ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = isError ? 'err' : ''), 2600);
}

function pctOf(present, late, sessions) {
  if (!sessions) return null;
  return Math.round(((present + late) / sessions) * 100);
}
function pctHtml(p) {
  if (p === null) return '<span class="stat-note">—</span>';
  const cls = p >= 75 ? 'good' : p >= 50 ? 'mid' : 'low';
  return `<span class="pct ${cls}">${p}%</span>`;
}

function openModal(html, onMount) {
  const m = $('#modal');
  m.innerHTML = html;
  m.showModal();
  $$('[data-close]', m).forEach((b) => b.addEventListener('click', () => m.close()));
  onMount?.(m);
}

function ethSelectors(prefix, { year, month, day }, { withDay = true } = {}) {
  const yearNow = EthCal.toEth(EthCal.todayIso()).year;
  const years = [];
  for (let y = yearNow + 1; y >= yearNow - 10; y--) years.push(y);
  const days = [];
  for (let d = 1; d <= 30; d++) days.push(d);
  return `
    ${withDay ? `<select id="${prefix}-day" aria-label="ቀን">${days.map((d) => `<option ${d === day ? 'selected' : ''}>${d}</option>`).join('')}</select>` : ''}
    <select id="${prefix}-month" aria-label="ወር">${EthCal.MONTHS.map((m, i) => `<option value="${i + 1}" ${i + 1 === month ? 'selected' : ''}>${m}</option>`).join('')}</select>
    <select id="${prefix}-year" aria-label="ዓመት">${years.map((y) => `<option ${y === year ? 'selected' : ''}>${y}</option>`).join('')}</select>`;
}

// ---------- auth screens ----------
async function renderLogin() {
  const { needsSetup } = await fetch('/api/setup-status').then((r) => r.json());
  $('#app').innerHTML = `
    <div class="login-wrap">
      <div class="card login-card">
        <img src="logo.png" alt="logo" />
        <h1 style="font-size:18px;margin-top:8px">${SCHOOL}</h1>
        <p class="subtitle" style="margin:0">${FORM_TITLE}</p>
        ${needsSetup ? '<p class="stat-note" style="margin-top:12px">እንኳን ደህና መጡ! የመጀመሪያውን የአስተዳዳሪ መለያ ይፍጠሩ።<br/>Welcome! Create the first administrator account.</p>' : ''}
        <form id="login-form">
          ${needsSetup ? '<label class="field">ሙሉ ስም (Full name)<input type="text" name="full_name" required /></label>' : ''}
          <label class="field">የተጠቃሚ ስም (Username)<input type="text" name="username" autocomplete="username" required /></label>
          <label class="field">የይለፍ ቃል (Password)<input type="password" name="password" autocomplete="${needsSetup ? 'new-password' : 'current-password'}" required ${needsSetup ? 'minlength="6"' : ''} /></label>
          <div class="error" id="login-error"></div>
          <button class="btn btn-primary" type="submit">${needsSetup ? 'መለያ ፍጠር (Create account)' : 'ግባ (Log in)'}</button>
        </form>
      </div>
    </div>`;
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    try {
      const { user } = await api('POST', needsSetup ? '/api/setup' : '/api/login', body);
      state.me = user;
      if (!location.hash || location.hash === '#/') location.hash = '#/dashboard';
      route();
    } catch (err) {
      $('#login-error').textContent = err.message;
    }
  });
}

// ---------- shell & routing ----------
const ROUTES = {
  dashboard: { title: 'ዋና ገጽ', render: renderDashboard },
  take: { title: 'ክትትል መያዝ', render: renderTake },
  sheet: { title: 'ወርሃዊ ቅጽ', render: renderSheet },
  members: { title: 'አባላት', render: renderMembers },
  users: { title: 'ተጠቃሚዎች', render: renderUsers, admin: true },
};

function renderShell(active) {
  const links = Object.entries(ROUTES)
    .filter(([, r]) => !r.admin || state.me.role === 'admin')
    .map(([k, r]) => `<a href="#/${k}" class="${k === active ? 'active' : ''}">${r.title}</a>`)
    .join('');
  $('#app').innerHTML = `
    <header class="topbar">
      <div class="topbar-inner">
        <a class="brand" href="#/dashboard">
          <img src="logo.png" alt="" />
          <div><div class="brand-title">${SCHOOL}</div><div class="brand-sub">${FORM_TITLE}</div></div>
        </a>
        <nav class="nav">${links}</nav>
        <div class="userbox">
          <span>${esc(state.me.full_name)}</span>
          <button class="btn btn-sm btn-ghost" id="btn-pass" title="የይለፍ ቃል ቀይር">🔑</button>
          <button class="btn btn-sm" id="btn-logout">ውጣ</button>
        </div>
      </div>
    </header>
    <main id="view"></main>`;
  $('#btn-logout').onclick = async () => {
    await api('POST', '/api/logout').catch(() => {});
    state.me = null;
    renderLogin();
  };
  $('#btn-pass').onclick = () => changePasswordModal(state.me.id, true);
}

async function route() {
  if (!state.me) {
    try {
      state.me = (await api('GET', '/api/me')).user;
    } catch {
      return; // api() already rendered the login screen
    }
  }
  let key = (location.hash.match(/^#\/(\w+)/) || [])[1];
  if (!ROUTES[key] || (ROUTES[key].admin && state.me.role !== 'admin')) key = 'dashboard';
  renderShell(key);
  document.title = `${ROUTES[key].title} · ${FORM_TITLE}`;
  try {
    await ROUTES[key].render($('#view'));
  } catch (err) {
    $('#view').innerHTML = `<div class="card error">${esc(err.message)}</div>`;
  }
}
window.addEventListener('hashchange', route);

// ---------- dashboard ----------
async function renderDashboard(view) {
  const d = await api('GET', '/api/dashboard');
  const today = EthCal.todayIso();
  const last = d.sessions[0];
  const avg = d.sessions.length
    ? Math.round(d.sessions.reduce((s, x) => s + ((x.present + x.late) / x.total) * 100, 0) / d.sessions.length)
    : null;

  view.innerHTML = `
    <h1>እንኳን ደህና መጡ</h1>
    <p class="subtitle">${EthCal.format(today, { weekday: true })}</p>
    <div class="toolbar"><a class="btn btn-primary" href="#/take">✓ የዛሬን ክትትል ይያዙ</a></div>
    <div class="grid grid-4">
      <div class="card"><div class="stat-label">ንቁ አባላት</div><div class="stat-value">${d.members.total}</div>
        <div class="stat-note">ወንድ ${d.members.male} · ሴት ${d.members.female}</div></div>
      <div class="card"><div class="stat-label">የመጨረሻው ክትትል</div>
        <div class="stat-value">${last ? `${last.present + last.late}/${last.total}` : '—'}</div>
        <div class="stat-note">${last ? EthCal.format(last.date) : 'እስካሁን አልተመዘገበም'}</div></div>
      <div class="card"><div class="stat-label">አማካይ ተገኝነት</div><div class="stat-value">${avg === null ? '—' : avg + '%'}</div>
        <div class="stat-note">ባለፉት ${d.sessions.length} ክትትሎች</div></div>
      <div class="card"><div class="stat-label">ክትትል የሚያስፈልጋቸው</div>
        <div class="stat-value" style="color:var(--absent)">${d.atRisk.length}</div>
        <div class="stat-note">3 ተከታታይ ጊዜ የቀሩ</div></div>
    </div>
    <div class="grid grid-2" style="margin-top:16px">
      <div class="card">
        <h2>የቅርብ ጊዜ ክትትሎች</h2>
        ${
          d.sessions.length
            ? `<div class="bars">${d.sessions
                .map((s) => {
                  const w = (n) => ((n / s.total) * 100).toFixed(1);
                  const e = EthCal.toEth(s.date);
                  return `<div class="bar-row">
                    <span>${EthCal.WEEKDAYS[EthCal.weekday(s.date)]} ${EthCal.MONTHS[e.month - 1]} ${e.day}</span>
                    <div class="bar-track" title="ተገኝ ${s.present} · ዘግይቶ ${s.late} · ፈቃድ ${s.excused} · ቀሪ ${s.absent}">
                      <span class="p" style="width:${w(s.present)}%"></span><span class="l" style="width:${w(s.late)}%"></span><span class="e" style="width:${w(s.excused)}%"></span>
                    </div>
                    <b>${Math.round(((s.present + s.late) / s.total) * 100)}%</b></div>`;
                })
                .join('')}</div>
               <div class="legend"><span><b class="present">■</b> ተገኝቷል</span><span><b class="late">■</b> አርፍዷል</span><span><b class="excused">■</b> በፈቃድ</span><span>□ ቀሪ</span></div>`
            : '<div class="empty">እስካሁን ምንም ክትትል አልተያዘም።</div>'
        }
      </div>
      <div class="card">
        <h2>ሊጠየቁ የሚገባቸው አባላት</h2>
        <p class="stat-note" style="margin-top:-8px">ባለፉት 3 ክትትሎች ያልተገኙ — ስልክ ደውለው ይጠይቋቸው።</p>
        ${
          d.atRisk.length
            ? `<ul class="risk-list">${d.atRisk
                .map(
                  (m) => `<li><span><b>${esc(m.full_name)}</b><br/><span class="stat-note">መጨረሻ የተገኙት: ${m.last_seen ? EthCal.format(m.last_seen) : 'የለም'}</span></span>
                  ${m.phone ? `<a class="btn btn-sm" href="tel:${esc(m.phone)}">📞 ${esc(m.phone)}</a>` : ''}</li>`
                )
                .join('')}</ul>`
            : '<div class="empty">ሁሉም መልካም ነው 🙏</div>'
        }
      </div>
    </div>`;
}

// ---------- take attendance ----------
async function renderTake(view) {
  let date = sessionStorage.getItem('takeDate') || EthCal.todayIso();
  let group = sessionStorage.getItem('takeGroup') || '';
  let filter = '';
  const [allMembers, groups] = await Promise.all([api('GET', '/api/members'), api('GET', '/api/groups')]);
  const members = allMembers.filter((m) => m.active);
  let marks = {};

  view.innerHTML = `
    <h1>ክትትል መያዝ</h1>
    <p class="subtitle">ለእያንዳንዱ አባል ሁኔታውን ይጫኑ — ወዲያውኑ ይቀመጣል። ዳግም መጫን ምልክቱን ያጠፋል።</p>
    <div class="card" style="margin-bottom:16px">
      <div class="toolbar" style="margin:0">
        <div class="date-picker">
          <button class="btn btn-sm" id="prev-day" title="ያለፈው ቀን">‹</button>
          <span id="eth-picker"></span>
          <button class="btn btn-sm" id="next-day" title="የሚቀጥለው ቀን">›</button>
          <button class="btn btn-sm" id="today">ዛሬ</button>
        </div>
        <div class="spacer"></div>
        <div><div class="date-label" id="date-label"></div><div class="date-greg" id="date-greg"></div></div>
      </div>
    </div>
    <div class="toolbar">
      <input type="search" id="search" placeholder="🔍 ስም ይፈልጉ..." style="flex:1;min-width:180px" />
      ${groups.length > 1 ? `<select id="group"><option value="">ሁሉም ክፍሎች</option>${groups.map((g) => `<option ${g === group ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>` : ''}
      <button class="btn" id="all-present">ያልተመዘገቡትን በሙሉ "ተገኝቷል"</button>
      <button class="btn" id="rest-absent">ያልተመዘገቡትን በሙሉ "ቀሪ"</button>
    </div>
    <div class="counters" id="counters"></div>
    <div class="card" style="padding:0"><ul class="roll" id="roll"></ul></div>`;

  const visible = () =>
    members.filter((m) => (!group || m.group_name === group) && (!filter || m.full_name.toLowerCase().includes(filter)));

  function renderPicker() {
    const e = EthCal.toEth(date);
    $('#eth-picker').innerHTML = ethSelectors('tk', e);
    ['day', 'month', 'year'].forEach((p) =>
      $(`#tk-${p}`).addEventListener('change', () => {
        const y = +$('#tk-year').value, mo = +$('#tk-month').value;
        const d = Math.min(+$('#tk-day').value, EthCal.daysInMonth(y, mo));
        setDate(EthCal.toIso(y, mo, d));
      })
    );
    $('#date-label').textContent = EthCal.format(date, { weekday: true });
    $('#date-greg').textContent = new Date(date + 'T00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  function renderCounters() {
    const list = members.filter((m) => !group || m.group_name === group);
    const c = { present: 0, absent: 0, late: 0, excused: 0 };
    let none = 0;
    list.forEach((m) => (marks[m.id] ? c[marks[m.id]]++ : none++));
    $('#counters').innerHTML =
      Object.entries(STATUS).map(([k, s]) => `<span class="counter ${k}">${s.sym} ${s.label}<b>${c[k]}</b></span>`).join('') +
      `<span class="counter">ያልተመዘገበ<b>${none}</b></span><span class="counter">ጠቅላላ<b>${list.length}</b></span>`;
  }

  function rowHtml(m, i) {
    return `<li data-id="${m.id}">
      <span class="num">${i + 1}</span>
      <span class="name">${esc(m.full_name)}<small>${GENDER[m.gender]}${m.group_name !== 'መዘምራን' ? ' · ' + esc(m.group_name) : ''}</small></span>
      <span class="status-btns">${Object.entries(STATUS)
        .map(([k, s]) => `<button data-s="${k}" class="${marks[m.id] === k ? 'on' : ''}" title="${s.label}"><span class="sym">${s.sym}</span><span class="lbl">${s.short}</span></button>`)
        .join('')}</span></li>`;
  }

  function renderRoll() {
    const list = visible();
    $('#roll').innerHTML = list.length ? list.map(rowHtml).join('') : '<li class="empty">ምንም አባል አልተገኘም</li>';
    renderCounters();
  }

  async function setDate(d) {
    date = d;
    sessionStorage.setItem('takeDate', d);
    renderPicker();
    $('#roll').innerHTML = '<li class="empty">በመጫን ላይ...</li>';
    marks = await api('GET', `/api/attendance?date=${date}`);
    renderRoll();
  }

  async function save(records) {
    const prev = { ...marks };
    records.forEach((r) => (r.status ? (marks[r.member_id] = r.status) : delete marks[r.member_id]));
    renderRoll();
    try {
      await api('PUT', '/api/attendance', { date, records });
    } catch (err) {
      marks = prev;
      renderRoll();
      toast('አልተቀመጠም: ' + err.message, true);
    }
  }

  $('#roll').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-s]');
    if (!btn) return;
    const id = +btn.closest('li').dataset.id;
    const s = btn.dataset.s;
    save([{ member_id: id, status: marks[id] === s ? null : s }]);
  });
  $('#search').addEventListener('input', (e) => {
    filter = e.target.value.trim().toLowerCase();
    renderRoll();
  });
  $('#group')?.addEventListener('change', (e) => {
    group = e.target.value;
    sessionStorage.setItem('takeGroup', group);
    renderRoll();
  });
  const bulk = (status) => {
    const records = members
      .filter((m) => (!group || m.group_name === group) && !marks[m.id])
      .map((m) => ({ member_id: m.id, status }));
    if (!records.length) return toast('ሁሉም አስቀድመው ተመዝግበዋል');
    if (!confirm(`${records.length} አባላትን "${STATUS[status].label}" ብለው ይመዝግቡ?`)) return;
    save(records).then(() => toast('ተቀምጧል ✓'));
  };
  $('#all-present').onclick = () => bulk('present');
  $('#rest-absent').onclick = () => bulk('absent');
  $('#prev-day').onclick = () => setDate(EthCal.addDays(date, -1));
  $('#next-day').onclick = () => setDate(EthCal.addDays(date, 1));
  $('#today').onclick = () => setDate(EthCal.todayIso());

  await setDate(date);
}

// ---------- monthly sheet (digital version of the paper form) ----------
async function renderSheet(view) {
  const now = EthCal.toEth(EthCal.todayIso());
  let sel = JSON.parse(sessionStorage.getItem('sheetSel') || 'null') || { year: now.year, month: now.month, count: 1, group: '' };
  const [members, groups] = await Promise.all([api('GET', '/api/members'), api('GET', '/api/groups')]);

  view.innerHTML = `
    <h1>ወርሃዊ የክትትል ቅጽ</h1>
    <p class="subtitle">በወረቀት ላይ የነበረው ቅጽ ዲጂታል ቅጂ። ለማተም "አትም" ይጫኑ።</p>
    <div class="toolbar">
      <span id="sheet-picker" class="date-picker"></span>
      <select id="sheet-count"><option value="1">1 ወር</option><option value="3">3 ወራት (እንደ ወረቀቱ)</option></select>
      ${groups.length > 1 ? `<select id="sheet-group"><option value="">ሁሉም ክፍሎች</option>${groups.map((g) => `<option>${esc(g)}</option>`).join('')}</select>` : ''}
      <div class="spacer"></div>
      <button class="btn" id="csv">⬇ Excel/CSV</button>
      <button class="btn btn-primary" id="print">🖨 አትም</button>
    </div>
    <div class="card">
      <div class="sheet-head"><img src="logo.png" alt="" /><h2>${SCHOOL}</h2><h3 id="sheet-title">${FORM_TITLE}</h3></div>
      <div class="table-wrap" id="sheet-body"><div class="empty">በመጫን ላይ...</div></div>
      <div class="legend">${Object.values(STATUS).map((s) => `<span><b class="${Object.keys(STATUS).find((k) => STATUS[k] === s)}">${s.sym}</b> ${s.label}</span>`).join('')}<span>% = (ተገኝ + ዘግይቶ) ÷ ክትትሎች</span></div>
    </div>`;

  $('#sheet-picker').innerHTML = ethSelectors('sh', sel, { withDay: false });
  $('#sheet-count').value = String(sel.count);
  if ($('#sheet-group')) $('#sheet-group').value = sel.group;

  let lastTable = null;

  async function load() {
    sessionStorage.setItem('sheetSel', JSON.stringify(sel));
    // Months to show, oldest first (the selected month is the last one).
    const months = [];
    let { year, month } = sel;
    for (let i = 0; i < sel.count; i++) {
      months.unshift({ year, month, ...EthCal.monthRange(year, month) });
      month--;
      if (month < 1) { month = 13; year--; }
    }
    const records = await api('GET', `/api/attendance/range?from=${months[0].from}&to=${months[months.length - 1].to}`);
    const byKey = new Map(records.map((r) => [`${r.member_id}|${r.date}`, r.status]));
    const hasRecords = new Set(records.map((r) => r.member_id));
    months.forEach((m) => {
      m.dates = [...new Set(records.filter((r) => r.date >= m.from && r.date <= m.to).map((r) => r.date))].sort();
    });
    const rows = members.filter((m) => (!sel.group || m.group_name === sel.group) && (m.active || hasRecords.has(m.id)));
    const allDates = months.flatMap((m) => m.dates);

    $('#sheet-title').textContent = `${FORM_TITLE} — ${months.map((m) => `${EthCal.MONTHS[m.month - 1]} ${m.year}`).join(' · ')}`;

    if (!rows.length) {
      $('#sheet-body').innerHTML = '<div class="empty">ምንም አባል የለም</div>';
      return;
    }

    const head1 = months
      .map((m) => `<th class="month" colspan="${Math.max(m.dates.length, 1)}">ወር: ${EthCal.MONTHS[m.month - 1]} ${m.year}</th>`)
      .join('');
    const head2 = months
      .map((m) =>
        m.dates.length
          ? m.dates.map((d) => `<th class="day">${EthCal.toEth(d).day}<small>${EthCal.WEEKDAYS[EthCal.weekday(d)].slice(0, 2)}</small></th>`).join('')
          : '<th class="day"><small>—</small></th>'
      )
      .join('');

    const tableRows = [];
    const body = rows
      .map((m, i) => {
        const cells = [];
        let present = 0, late = 0, sessions = 0;
        months.forEach((mo) => {
          if (!mo.dates.length) cells.push('<td></td>');
          mo.dates.forEach((d) => {
            const s = byKey.get(`${m.id}|${d}`);
            if (s) sessions++;
            if (s === 'present') present++;
            if (s === 'late') late++;
            cells.push(`<td class="mark ${s ? 's-' + s : ''}">${s ? STATUS[s].sym : ''}</td>`);
          });
        });
        const pct = pctOf(present, late, sessions);
        tableRows.push([i + 1, m.full_name, GENDER[m.gender], ...allDates.map((d) => STATUS[byKey.get(`${m.id}|${d}`)]?.sym || ''), present + late, sessions, pct ?? '']);
        return `<tr><td>${i + 1}</td><td class="name">${esc(m.full_name)}</td><td>${GENDER[m.gender]}</td>${cells.join('')}
          <td><b>${present + late}</b>/${sessions}</td><td>${pctHtml(pct)}</td></tr>`;
      })
      .join('');

    const foot = months
      .map((mo) =>
        mo.dates.length
          ? mo.dates
              .map((d) => `<td>${rows.filter((m) => ['present', 'late'].includes(byKey.get(`${m.id}|${d}`))).length}</td>`)
              .join('')
          : '<td></td>'
      )
      .join('');

    $('#sheet-body').innerHTML = `
      <table class="sheet">
        <thead>
          <tr><th rowspan="2">ተ.ቁ</th><th rowspan="2">ስም</th><th rowspan="2">ፆታ</th>${head1}<th rowspan="2">ተገኝ</th><th rowspan="2">%</th></tr>
          <tr>${head2}</tr>
        </thead>
        <tbody>${body}</tbody>
        <tfoot><tr><td colspan="3">የተገኙ ብዛት</td>${foot}<td colspan="2"></td></tr></tfoot>
      </table>
      ${allDates.length ? '' : '<p class="empty no-print">በዚህ ወር ምንም ክትትል አልተያዘም። <a href="#/take">ክትትል ይያዙ →</a></p>'}`;

    lastTable = {
      name: `attendance-${months.map((m) => `${m.year}-${String(m.month).padStart(2, '0')}`).join('_')}.csv`,
      rows: [
        [SCHOOL], [$('#sheet-title').textContent], [],
        ['ተ.ቁ', 'ስም', 'ፆታ', ...allDates.map((d) => { const e = EthCal.toEth(d); return `${EthCal.MONTHS[e.month - 1]} ${e.day}`; }), 'ተገኝ', 'ክትትሎች', '%'],
        ...tableRows,
      ],
    };
  }

  const onChange = () => {
    sel = {
      year: +$('#sh-year').value,
      month: +$('#sh-month').value,
      count: +$('#sheet-count').value,
      group: $('#sheet-group')?.value || '',
    };
    load();
  };
  ['#sh-year', '#sh-month', '#sheet-count', '#sheet-group'].forEach((s) => $(s)?.addEventListener('change', onChange));
  $('#print').onclick = () => window.print();
  $('#csv').onclick = () => {
    if (!lastTable) return;
    const csv = lastTable.rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = lastTable.name;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  await load();
}

// ---------- members ----------
async function renderMembers(view) {
  let members = await api('GET', '/api/members');
  let filter = '';
  let showInactive = false;
  const isAdmin = state.me.role === 'admin';

  view.innerHTML = `
    <h1>አባላት</h1>
    <p class="subtitle">አዲስ አባል ይመዝግቡ፣ መረጃ ያስተካክሉ።</p>
    <div class="toolbar">
      <input type="search" id="m-search" placeholder="🔍 ስም ወይም ስልክ ይፈልጉ..." style="flex:1;min-width:180px" />
      <label style="display:flex;gap:6px;align-items:center;font-size:14px"><input type="checkbox" id="m-inactive" /> ያቋረጡትንም አሳይ</label>
      <button class="btn btn-primary" id="m-add">+ አዲስ አባል መዝግብ</button>
    </div>
    <div class="card" style="padding:0"><div class="table-wrap"><table class="data">
      <thead><tr><th>ተ.ቁ</th><th>ስም</th><th>ፆታ</th><th class="hide-mobile">ስልክ</th><th class="hide-mobile">ክፍል</th><th>ተገኝነት</th><th></th></tr></thead>
      <tbody id="m-body"></tbody>
    </table></div></div>`;

  function draw() {
    const list = members.filter(
      (m) =>
        (showInactive || m.active) &&
        (!filter || m.full_name.toLowerCase().includes(filter) || (m.phone || '').includes(filter))
    );
    $('#m-body').innerHTML = list.length
      ? list
          .map(
            (m, i) => `<tr class="${m.active ? '' : 'inactive'}">
          <td>${i + 1}</td>
          <td><b>${esc(m.full_name)}</b>${m.active ? '' : ' <span class="badge">ያቋረጠ</span>'}</td>
          <td>${GENDER[m.gender]}</td>
          <td class="hide-mobile">${m.phone ? `<a href="tel:${esc(m.phone)}">${esc(m.phone)}</a>` : '—'}</td>
          <td class="hide-mobile">${esc(m.group_name)}</td>
          <td>${pctHtml(pctOf(m.present || 0, m.late || 0, m.sessions))} <span class="stat-note">(${(m.present || 0) + (m.late || 0)}/${m.sessions})</span></td>
          <td style="text-align:right"><button class="btn btn-sm" data-edit="${m.id}">አስተካክል</button></td></tr>`
          )
          .join('')
      : '<tr><td colspan="7" class="empty">ምንም አባል አልተገኘም</td></tr>';
  }

  async function reload() {
    members = await api('GET', '/api/members');
    draw();
  }

  function memberModal(m) {
    const isNew = !m;
    m = m || { full_name: '', gender: 'M', phone: '', group_name: 'መዘምራን', joined_on: EthCal.todayIso(), notes: '', active: 1 };
    openModal(
      `<h2>${isNew ? 'አዲስ አባል መመዝገቢያ' : 'የአባል መረጃ ማስተካከያ'}</h2>
      <form id="member-form" class="form-grid">
        <label class="field full">ሙሉ ስም *<input type="text" name="full_name" value="${esc(m.full_name)}" required placeholder="ለምሳሌ፦ ዲ/ን ያሬድ ገነቱ" /></label>
        <div class="field"><span>ፆታ *</span><div class="radio-row">
          <label><input type="radio" name="gender" value="M" ${m.gender === 'M' ? 'checked' : ''}/> ወንድ</label>
          <label><input type="radio" name="gender" value="F" ${m.gender === 'F' ? 'checked' : ''}/> ሴት</label></div></div>
        <label class="field">ስልክ<input type="tel" name="phone" value="${esc(m.phone || '')}" placeholder="09..." /></label>
        <label class="field">ክፍል<input type="text" name="group_name" value="${esc(m.group_name)}" list="group-list" /></label>
        <label class="field">የተመዘገበበት ቀን<input type="date" name="joined_on" value="${esc(m.joined_on || '')}" />
          <span class="stat-note" id="joined-eth"></span></label>
        <label class="field full">ማስታወሻ<textarea name="notes" rows="2">${esc(m.notes || '')}</textarea></label>
        ${isNew ? '' : `<label class="full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="active" ${m.active ? 'checked' : ''}/> ንቁ አባል (ምልክቱን ማንሳት አባሉ ከክትትል ዝርዝር እንዲወጣ ያደርጋል፤ ታሪኩ ይቀመጣል)</label>`}
        <div class="error full" id="m-error"></div>
      </form>
      <datalist id="group-list">${[...new Set(members.map((x) => x.group_name))].map((g) => `<option>${esc(g)}</option>`).join('')}</datalist>
      <div class="modal-actions">
        ${!isNew && isAdmin ? '<button class="btn btn-danger" id="m-delete" style="margin-right:auto">ሰርዝ</button>' : ''}
        <button class="btn" data-close>ይቅር</button>
        <button class="btn btn-primary" id="m-save">${isNew ? 'መዝግብ' : 'አስቀምጥ'}</button>
      </div>`,
      (dlg) => {
        const form = $('#member-form', dlg);
        const showEth = () => {
          const v = form.joined_on.value;
          $('#joined-eth', dlg).textContent = v ? EthCal.format(v) : '';
        };
        form.joined_on.addEventListener('change', showEth);
        showEth();
        form.full_name.focus();
        const submit = async () => {
          if (!form.reportValidity()) return;
          const body = Object.fromEntries(new FormData(form));
          body.active = isNew ? true : form.active.checked;
          try {
            if (isNew) await api('POST', '/api/members', body);
            else await api('PUT', `/api/members/${m.id}`, body);
            dlg.close();
            toast(isNew ? 'አዲስ አባል ተመዝግቧል ✓' : 'ተቀምጧል ✓');
            reload();
          } catch (err) {
            $('#m-error', dlg).textContent = err.message;
          }
        };
        $('#m-save', dlg).onclick = submit;
        form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
        $('#m-delete', dlg)?.addEventListener('click', async () => {
          if (!confirm(`"${m.full_name}" እና የክትትል ታሪካቸውን በሙሉ ለመሰረዝ እርግጠኛ ነዎት? ይህ ሊመለስ አይችልም።\n\n(ለማቆየት "ንቁ አባል" ምልክቱን ማንሳት ይሻላል።)`)) return;
          try {
            await api('DELETE', `/api/members/${m.id}`);
            dlg.close();
            toast('ተሰርዟል');
            reload();
          } catch (err) {
            $('#m-error', dlg).textContent = err.message;
          }
        });
      }
    );
  }

  $('#m-search').addEventListener('input', (e) => { filter = e.target.value.trim().toLowerCase(); draw(); });
  $('#m-inactive').addEventListener('change', (e) => { showInactive = e.target.checked; draw(); });
  $('#m-add').onclick = () => memberModal(null);
  $('#m-body').addEventListener('click', (e) => {
    const id = e.target.closest('[data-edit]')?.dataset.edit;
    if (id) memberModal(members.find((m) => m.id === +id));
  });
  draw();
}

// ---------- users (accounts) ----------
async function renderUsers(view) {
  const users = await api('GET', '/api/users');
  view.innerHTML = `
    <h1>ተጠቃሚዎች</h1>
    <p class="subtitle">ክትትል መያዝ የሚችሉ ሰዎች መለያ። <b>መዝጋቢ</b> ክትትል መያዝና አባላትን መመዝገብ ይችላል፤ <b>አስተዳዳሪ</b> በተጨማሪ ተጠቃሚዎችን ያስተዳድራል፣ አባላትን ይሰርዛል።</p>
    <div class="toolbar"><div class="spacer"></div><button class="btn btn-primary" id="u-add">+ አዲስ ተጠቃሚ</button></div>
    <div class="card" style="padding:0"><div class="table-wrap"><table class="data">
      <thead><tr><th>ሙሉ ስም</th><th>የተጠቃሚ ስም</th><th>ሚና</th><th></th></tr></thead>
      <tbody>${users
        .map(
          (u) => `<tr><td><b>${esc(u.full_name)}</b></td><td>${esc(u.username)}</td>
          <td><span class="badge ${u.role === 'admin' ? 'badge-admin' : ''}">${u.role === 'admin' ? 'አስተዳዳሪ' : 'መዝጋቢ'}</span></td>
          <td style="text-align:right;white-space:nowrap">
            <button class="btn btn-sm" data-pass="${u.id}">የይለፍ ቃል</button>
            ${u.id === state.me.id ? '' : `<button class="btn btn-sm btn-danger" data-del="${u.id}">ሰርዝ</button>`}
          </td></tr>`
        )
        .join('')}</tbody>
    </table></div></div>`;

  view.addEventListener('click', async (e) => {
    const pass = e.target.closest('[data-pass]')?.dataset.pass;
    const del = e.target.closest('[data-del]')?.dataset.del;
    if (pass) changePasswordModal(+pass, +pass === state.me.id);
    if (del) {
      const u = users.find((x) => x.id === +del);
      if (!confirm(`"${u.full_name}" ን ለመሰረዝ እርግጠኛ ነዎት?`)) return;
      try {
        await api('DELETE', `/api/users/${del}`);
        toast('ተሰርዟል');
        route();
      } catch (err) {
        toast(err.message, true);
      }
    }
  });

  $('#u-add').onclick = () =>
    openModal(
      `<h2>አዲስ ተጠቃሚ</h2>
      <form id="u-form" class="form-grid">
        <label class="field full">ሙሉ ስም<input type="text" name="full_name" required /></label>
        <label class="field">የተጠቃሚ ስም<input type="text" name="username" required autocomplete="off" /></label>
        <label class="field">የይለፍ ቃል<input type="password" name="password" required minlength="6" autocomplete="new-password" /></label>
        <label class="field full">ሚና<select name="role"><option value="recorder">መዝጋቢ (Recorder)</option><option value="admin">አስተዳዳሪ (Admin)</option></select></label>
        <div class="error full" id="u-error"></div>
        <div class="modal-actions full"><button type="button" class="btn" data-close>ይቅር</button><button class="btn btn-primary">ፍጠር</button></div>
      </form>`,
      (dlg) => {
        $('#u-form', dlg).addEventListener('submit', async (e) => {
          e.preventDefault();
          try {
            await api('POST', '/api/users', Object.fromEntries(new FormData(e.target)));
            dlg.close();
            toast('ተጠቃሚ ተፈጥሯል ✓');
            route();
          } catch (err) {
            $('#u-error', dlg).textContent = err.message;
          }
        });
      }
    );
}

function changePasswordModal(userId, self) {
  openModal(
    `<h2>${self ? 'የይለፍ ቃሌን ቀይር' : 'የይለፍ ቃል ዳግም አስጀምር'}</h2>
    <form id="p-form" style="display:flex;flex-direction:column;gap:12px">
      <label class="field">አዲስ የይለፍ ቃል<input type="password" name="password" required minlength="6" autocomplete="new-password" /></label>
      <label class="field">ደግመው ያስገቡ<input type="password" name="confirm" required minlength="6" autocomplete="new-password" /></label>
      <div class="error" id="p-error"></div>
      <div class="modal-actions"><button type="button" class="btn" data-close>ይቅር</button><button class="btn btn-primary">አስቀምጥ</button></div>
    </form>`,
    (dlg) => {
      $('#p-form', dlg).addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        if (f.password.value !== f.confirm.value) return ($('#p-error', dlg).textContent = 'የይለፍ ቃሎቹ አይመሳሰሉም');
        try {
          await api('PUT', `/api/users/${userId}/password`, { password: f.password.value });
          dlg.close();
          toast('የይለፍ ቃል ተቀይሯል ✓');
        } catch (err) {
          $('#p-error', dlg).textContent = err.message;
        }
      });
    }
  );
}

route();
