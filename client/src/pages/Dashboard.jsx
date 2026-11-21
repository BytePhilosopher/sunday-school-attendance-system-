import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, CalendarCheck, HeartHandshake, Phone, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '../lib/auth.js';
import { useFetch } from '../lib/hooks.js';
import { MONTHS, WEEKDAYS, formatEth, formatGreg, toEth, todayIso, weekday } from '../lib/ethiopian.js';
import { Avatar, Empty, Ring, Skeleton } from '../components/ui.jsx';

const rate = (s) => Math.round(((s.present + s.late) / s.total) * 100);

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error } = useFetch('/api/dashboard');
  const today = todayIso();
  const todaySession = data?.sessions.find((s) => s.date === today);
  const last = data?.sessions.at(-1);
  const avg = data?.sessions.length ? Math.round(data.sessions.reduce((a, s) => a + rate(s), 0) / data.sessions.length) : null;

  return (
    <>
      <section className="hero">
        <img src="/logo.png" alt="" className="hero-watermark" />
        <div className="hero-inner">
          <div>
            <div className="hero-greet">እንኳን ደህና መጡ፣ {user.full_name}</div>
            <div className="hero-date">{formatEth(today, { weekday: true })}</div>
            <div className="hero-greg">{formatGreg(today)}</div>
            <Link to="/attendance" className="btn btn-gold">
              {todaySession ? 'የዛሬውን ክትትል ይቀጥሉ' : 'የዛሬውን ክትትል ይጀምሩ'}
              <ArrowRight size={18} />
            </Link>
          </div>
          {todaySession && data && (
            <div className="hero-today">
              <Ring value={todaySession.present + todaySession.late} total={data.members.total} color="#f2bd45" size={70} />
              <div>
                <div className="hero-today-label">የዛሬ ተገኝነት</div>
                <div className="hero-today-value num">
                  {todaySession.present + todaySession.late} / {data.members.total}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {error && <div className="form-error">{error.message}</div>}

      <div className="stats">
        <Stat icon={Users} tint="brand" label="ንቁ አባላት" value={data?.members.total}
          note={data && `ወንድ ${data.members.male} · ሴት ${data.members.female}`} />
        <Stat icon={CalendarCheck} tint="present" label="የመጨረሻው ክትትል"
          value={data && (last ? `${last.present + last.late}/${last.total}` : '—')}
          note={data && (last ? formatEth(last.date) : 'እስካሁን አልተመዘገበም')} />
        <Stat icon={TrendingUp} tint="late" label="አማካይ ተገኝነት" value={data && (avg === null ? '—' : `${avg}%`)}
          note={data && `ባለፉት ${data.sessions.length} ክትትሎች`} />
        <Stat icon={HeartHandshake} tint="absent" label="መጠየቅ ያለባቸው" value={data?.atRisk.length}
          note="3 ተከታታይ ጊዜ የቀሩ" />
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>የቅርብ ጊዜ ክትትሎች</h2>
              <p>በየክትትሉ የተገኙ አባላት መጠን</p>
            </div>
            <Link to="/sheet" className="btn btn-sm">
              ወርሃዊ ቅጽ
            </Link>
          </div>
          {!data ? (
            <div className="chart"><Skeleton h={220} /></div>
          ) : data.sessions.length ? (
            <SessionsChart sessions={data.sessions} />
          ) : (
            <Empty icon={BarChart3} title="እስካሁን ክትትል አልተያዘም">
              የመጀመሪያውን ክትትል ሲይዙ እዚህ ይታያል።
            </Empty>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2>ሊጠየቁ የሚገባቸው</h2>
              <p>ባለፉት 3 ክትትሎች ያልተገኙ አባላት</p>
            </div>
          </div>
          {!data ? (
            <div style={{ padding: 24, display: 'grid', gap: 12 }}>
              <Skeleton h={40} /><Skeleton h={40} /><Skeleton h={40} />
            </div>
          ) : data.atRisk.length ? (
            <ul className="follow-list">
              {data.atRisk.map((m) => (
                <li key={m.id}>
                  <div className="person">
                    <Avatar name={m.full_name} status="absent" />
                    <div style={{ minWidth: 0 }}>
                      <div className="person-name">{m.full_name}</div>
                      <div className="person-sub">
                        መጨረሻ የተገኙት፦ {m.last_seen ? formatEth(m.last_seen) : 'ምንም'}
                      </div>
                    </div>
                  </div>
                  {m.phone && (
                    <a className="btn btn-sm" href={`tel:${m.phone}`} title={m.phone}>
                      <Phone size={15} />
                      <span className="hide-sm">ደውል</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={HeartHandshake} title="ሁሉም በመልካም ሁኔታ ላይ ናቸው">
              ተከታታይ ሶስት ጊዜ የቀረ አባል የለም።
            </Empty>
          )}
        </div>
      </div>
    </>
  );
}

const TINTS = {
  brand: ['var(--brand-soft)', 'var(--brand)'],
  present: ['var(--present-soft)', 'var(--present)'],
  late: ['var(--late-soft)', 'var(--late)'],
  absent: ['var(--absent-soft)', 'var(--absent)'],
};

function Stat({ icon: Icon, tint, label, value, note }) {
  const [bg, fg] = TINTS[tint];
  return (
    <div className="card stat">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon" style={{ background: bg, color: fg }}>
          <Icon size={19} />
        </span>
      </div>
      {value === undefined || value === null ? (
        <Skeleton h={38} w="50%" style={{ marginTop: 6 }} />
      ) : (
        <div className="stat-value num">{value}</div>
      )}
      <div className="stat-note">{note || ' '}</div>
    </div>
  );
}

function SessionsChart({ sessions }) {
  const pct = (n, s) => `${(n / s.total) * 100}%`;
  return (
    <div className="chart">
      <div className="chart-plot">
        <div className="chart-axis">
          {[0, 25, 50, 75, 100].map((v) => (
            <span key={v}>{v}%</span>
          ))}
        </div>
        {sessions.map((s) => (
          <div className="chart-col" key={s.date}>
            <div className="chart-tip">
              {formatEth(s.date, { year: false })} · ተገኝ {s.present} · አርፍዷል {s.late} · ፈቃድ {s.excused} · ቀሪ {s.absent}
            </div>
            <div className="chart-val num">{rate(s)}%</div>
            <div className="chart-bar" style={{ height: pct(s.present + s.late + s.excused, s) }}>
              <span style={{ flexGrow: s.present, background: 'var(--present)' }} />
              <span style={{ flexGrow: s.late, background: 'var(--gold-bright)' }} />
              <span style={{ flexGrow: s.excused, background: 'var(--excused)' }} />
            </div>
          </div>
        ))}
      </div>
      <div className="chart-labels">
        {sessions.map((s) => {
          const e = toEth(s.date);
          return (
            <span key={s.date}>
              <b className="num">{e.day}</b>
              {MONTHS[e.month - 1].slice(0, 3)}
              <span className="sr-only"> {WEEKDAYS[weekday(s.date)]}</span>
            </span>
          );
        })}
      </div>
      <div className="legend">
        <span><i style={{ background: 'var(--present)' }} />ተገኝቷል</span>
        <span><i style={{ background: 'var(--gold-bright)' }} />አርፍዷል</span>
        <span><i style={{ background: 'var(--excused)' }} />በፈቃድ</span>
      </div>
    </div>
  );
}
