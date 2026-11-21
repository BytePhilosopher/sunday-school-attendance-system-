import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCheck, ChevronLeft, ChevronRight, CircleCheck, LoaderCircle, Search, UserX, Users } from 'lucide-react';
import { api } from '../lib/api.js';
import { useFetch, useSessionState } from '../lib/hooks.js';
import { addDays, formatEth, formatGreg, monthRange, todayIso } from '../lib/ethiopian.js';
import { GENDER_LONG, STATUS, STATUSES } from '../lib/constants.js';
import { Avatar, Empty, PageHead, Ring, STATUS_ICON, Skeleton } from '../components/ui.jsx';
import { useConfirm, useToast } from '../components/feedback.jsx';
import EthDatePicker from '../components/EthDatePicker.jsx';

const DOT = { present: 'var(--present)', absent: 'var(--absent)', late: 'var(--late)', excused: 'var(--excused)' };

export default function TakeAttendance() {
  const toast = useToast();
  const confirm = useConfirm();
  const [date, setDate] = useSessionState('takeDate', todayIso());
  const [group, setGroup] = useSessionState('takeGroup', '');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const [markedDates, setMarkedDates] = useState(new Set());

  const membersQ = useFetch('/api/members');
  const marksQ = useFetch(`/api/attendance?date=${date}`);
  const marks = marksQ.data || {};
  const today = todayIso();

  const members = useMemo(() => (membersQ.data || []).filter((m) => m.active), [membersQ.data]);
  const groups = useMemo(() => [...new Set(members.map((m) => m.group_name))], [members]);
  const inGroup = useMemo(() => members.filter((m) => !group || m.group_name === group), [members, group]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
    inGroup.forEach((m) => c[marks[m.id] || 'unmarked']++);
    return c;
  }, [inGroup, marks]);
  const markedCount = inGroup.length - counts.unmarked;

  const visible = inGroup.filter((m) => {
    if (filter === 'unmarked' && marks[m.id]) return false;
    if (STATUSES.includes(filter) && marks[m.id] !== filter) return false;
    return !search || m.full_name.includes(search.trim()) || (m.phone || '').includes(search.trim());
  });

  const loadMarkedDates = useCallback(({ year, month }) => {
    const { from, to } = monthRange(year, month);
    api
      .get(`/api/sessions?from=${from}&to=${to}`)
      .then((rows) => setMarkedDates((prev) => new Set([...prev, ...rows.map((r) => r.date)])))
      .catch(() => {});
  }, []);

  useEffect(() => setFilter('all'), [date]);

  async function save(records) {
    const before = Object.fromEntries(records.map((r) => [r.member_id, marks[r.member_id]]));
    marksQ.setData((m) => {
      const next = { ...(m || {}) };
      records.forEach((r) => (r.status ? (next[r.member_id] = r.status) : delete next[r.member_id]));
      return next;
    });
    setPending((p) => p + 1);
    try {
      await api.put('/api/attendance', { date, records });
      setMarkedDates((s) => new Set(s).add(date));
      return true;
    } catch (err) {
      marksQ.setData((m) => {
        const next = { ...(m || {}) };
        Object.entries(before).forEach(([id, s]) => (s ? (next[id] = s) : delete next[id]));
        return next;
      });
      toast(`አልተቀመጠም፦ ${err.message}`, 'error');
      return false;
    } finally {
      setPending((p) => p - 1);
    }
  }

  const toggle = (id, status) => save([{ member_id: id, status: marks[id] === status ? null : status }]);

  async function bulk(status) {
    const records = inGroup.filter((m) => !marks[m.id]).map((m) => ({ member_id: m.id, status }));
    if (!records.length) return toast('ሁሉም አባላት አስቀድመው ተመዝግበዋል');
    const ok = await confirm({
      title: `${records.length} አባላትን "${STATUS[status].label}" ብለው ይመዝግቡ?`,
      message: 'ይህ ምልክት ያልተደረገባቸውን አባላት ብቻ ይመለከታል። በኋላ በየግል ማስተካከል ይችላሉ።',
      confirmLabel: 'አዎ፣ መዝግብ',
    });
    if (ok && (await save(records))) toast(`${records.length} አባላት ተመዝግበዋል`);
  }

  const loading = membersQ.loading || (marksQ.loading && !marksQ.data);

  return (
    <>
      <PageHead
        eyebrow="ክትትል መያዝ"
        title="የዕለቱ ክትትል"
        actions={
          <>
            <button className="btn" onClick={() => bulk('present')}>
              <CheckCheck size={17} />
              ቀሪዎቹን ተገኝ አድርግ
            </button>
            <button className="btn" onClick={() => bulk('absent')}>
              <UserX size={17} />
              ቀሪዎቹን ቀሪ አድርግ
            </button>
          </>
        }
      >
        የአባሉን ሁኔታ ይጫኑ፤ ወዲያውኑ ይቀመጣል። ዳግም መጫን ምልክቱን ያነሳል።
      </PageHead>

      <div className="card day-card">
        <div className="day-nav">
          <button className="icon-btn bordered" onClick={() => setDate(addDays(date, -1))} aria-label="ያለፈው ቀን">
            <ChevronLeft size={19} />
          </button>
          <div style={{ position: 'relative' }}>
            <div className="day-title">{formatEth(date, { weekday: true })}</div>
            <div className="day-sub">
              <span>{formatGreg(date)}</span>
              <button className="btn btn-sm" onClick={() => setPickerOpen((o) => !o)}>
                <CalendarDays size={15} />
                ቀን ቀይር
              </button>
              {date !== today && (
                <button className="btn btn-sm btn-ghost" onClick={() => setDate(today)}>
                  ወደ ዛሬ
                </button>
              )}
              {date > today && <span className="pill pill-gold">ወደፊት ያለ ቀን</span>}
            </div>
            {pickerOpen && (
              <EthDatePicker
                value={date}
                marked={markedDates}
                onMonthChange={loadMarkedDates}
                onChange={(d) => {
                  setDate(d);
                  setPickerOpen(false);
                }}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
          <button className="icon-btn bordered" onClick={() => setDate(addDays(date, 1))} aria-label="የሚቀጥለው ቀን">
            <ChevronRight size={19} />
          </button>
        </div>

        <div className="day-progress">
          <Ring value={markedCount} total={inGroup.length} color="var(--brand)" />
          <div className="day-progress-text">
            <b className="num">
              {markedCount} / {inGroup.length} ተመዝግበዋል
            </b>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {pending > 0 ? (
                <>
                  <LoaderCircle size={14} className="spin" /> በማስቀመጥ ላይ…
                </>
              ) : (
                <>
                  <CircleCheck size={14} color="var(--present)" /> ሁሉም ተቀምጧል
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="filters">
        <Chip on={filter === 'all'} onClick={() => setFilter('all')} count={inGroup.length}>
          ሁሉም
        </Chip>
        <Chip on={filter === 'unmarked'} onClick={() => setFilter('unmarked')} count={counts.unmarked} dot="var(--line-strong)">
          ያልተመዘገቡ
        </Chip>
        {STATUSES.map((s) => (
          <Chip key={s} on={filter === s} onClick={() => setFilter(s)} count={counts[s]} dot={DOT[s]}>
            {STATUS[s].label}
          </Chip>
        ))}
      </div>

      <div className="toolbar">
        <div className="input-icon grow">
          <Search size={17} />
          <input className="input" type="search" placeholder="በስም ወይም በስልክ ይፈልጉ…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {groups.length > 1 && (
          <select className="select" style={{ width: 'auto' }} value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">ሁሉም ክፍሎች</option>
            {groups.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} h={52} />
            ))}
          </div>
        ) : visible.length ? (
          <ul className="roll">
            {visible.map((m) => {
              const st = marks[m.id];
              return (
                <li key={m.id} className={st ? `st-${st}` : ''}>
                  <span className="idx">{inGroup.indexOf(m) + 1}</span>
                  <Avatar name={m.full_name} status={st} seed={m.id} />
                  <div style={{ minWidth: 0 }}>
                    <div className="person-name">{m.full_name}</div>
                    <div className="person-sub">
                      {GENDER_LONG[m.gender]}
                      {groups.length > 1 && ` · ${m.group_name}`}
                    </div>
                  </div>
                  <div className="seg" role="group" aria-label={`${m.full_name} — ሁኔታ`}>
                    {STATUSES.map((s) => {
                      const Icon = STATUS_ICON[s];
                      return (
                        <button key={s} className={`s-${s} ${st === s ? 'on' : ''}`} aria-pressed={st === s} onClick={() => toggle(m.id, s)}>
                          <Icon size={15} strokeWidth={2.5} />
                          {STATUS[s].short}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty icon={Users} title="ምንም አባል አልተገኘም">
            {members.length ? 'ፍለጋውን ወይም ማጣሪያውን ይቀይሩ።' : 'መጀመሪያ በ"አባላት" ገጽ አባላትን ይመዝግቡ።'}
          </Empty>
        )}
      </div>
    </>
  );
}

function Chip({ on, onClick, count, dot, children }) {
  return (
    <button className={`chip ${on ? 'on' : ''}`} onClick={onClick}>
      {dot && <span className="dot" style={{ background: dot }} />}
      {children}
      <span className="count">{count}</span>
    </button>
  );
}
