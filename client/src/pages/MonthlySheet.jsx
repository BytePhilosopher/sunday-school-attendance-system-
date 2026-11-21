import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download, Printer, Sheet } from 'lucide-react';
import { useFetch, useSessionState } from '../lib/hooks.js';
import { MONTHS, WEEKDAYS_SHORT, monthRange, shiftMonth, toEth, todayIso, weekday } from '../lib/ethiopian.js';
import { FORM_TITLE, GENDER, SCHOOL, STATUS, STATUSES, attendancePct } from '../lib/constants.js';
import { Empty, Logo, Mark, Meter, PageHead, Skeleton } from '../components/ui.jsx';

export default function MonthlySheet() {
  const now = toEth(todayIso());
  const [sel, setSel] = useSessionState('sheetSel', { year: now.year, month: now.month, count: 1, group: '' });

  // Months shown, oldest first; the selected month is the last column group (like the paper form).
  const months = useMemo(() => {
    const list = [];
    for (let i = sel.count - 1; i >= 0; i--) {
      const m = shiftMonth(sel, -i);
      list.push({ ...m, ...monthRange(m.year, m.month) });
    }
    return list;
  }, [sel]);

  const membersQ = useFetch('/api/members');
  const recordsQ = useFetch(`/api/attendance/range?from=${months[0].from}&to=${months.at(-1).to}`);

  const sheet = useMemo(() => {
    if (!membersQ.data || !recordsQ.data) return null;
    const records = recordsQ.data;
    const byKey = new Map(records.map((r) => [`${r.member_id}|${r.date}`, r.status]));
    const withRecords = new Set(records.map((r) => r.member_id));
    const cols = months.map((m) => ({
      ...m,
      dates: [...new Set(records.filter((r) => r.date >= m.from && r.date <= m.to).map((r) => r.date))].sort(),
    }));
    const allDates = cols.flatMap((c) => c.dates);
    const groups = [...new Set(membersQ.data.map((m) => m.group_name))];
    const rows = membersQ.data
      .filter((m) => (!sel.group || m.group_name === sel.group) && (m.active || withRecords.has(m.id)))
      .map((m) => {
        const marks = allDates.map((d) => byKey.get(`${m.id}|${d}`));
        const present = marks.filter((s) => s === 'present').length;
        const late = marks.filter((s) => s === 'late').length;
        const sessions = marks.filter(Boolean).length;
        return { m, marks, attended: present + late, sessions, pct: attendancePct(present, late, sessions) };
      });
    const perDate = allDates.map((_, i) => rows.filter((r) => r.marks[i] === 'present' || r.marks[i] === 'late').length);
    return { cols, allDates, rows, perDate, groups };
  }, [membersQ.data, recordsQ.data, months, sel.group]);

  const periodLabel = months.map((m) => `${MONTHS[m.month - 1]} ${m.year}`).join(' · ');

  function downloadCsv() {
    if (!sheet) return;
    const header = ['ተ.ቁ', 'ስም', 'ፆታ', ...sheet.allDates.map((d) => {
      const e = toEth(d);
      return `${MONTHS[e.month - 1]} ${e.day}`;
    }), 'ተገኝ', 'ክትትሎች', '%'];
    const body = sheet.rows.map((r, i) => [
      i + 1, r.m.full_name, GENDER[r.m.gender], ...r.marks.map((s) => (s ? STATUS[s].mark : '')), r.attended, r.sessions, r.pct ?? '',
    ]);
    const csv = [[SCHOOL], [`${FORM_TITLE} — ${periodLabel}`], [], header, ...body]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `attendance-${months.map((m) => `${m.year}-${String(m.month).padStart(2, '0')}`).join('_')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const update = (patch) => setSel((s) => ({ ...s, ...patch }));

  return (
    <>
      <PageHead
        eyebrow="ወርሃዊ ቅጽ"
        title="የመዘምራን መቆጣጠሪያ ቅጽ"
        actions={
          <>
            <button className="btn" onClick={downloadCsv} disabled={!sheet}>
              <Download size={17} />
              Excel
            </button>
            <button className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={17} />
              አትም
            </button>
          </>
        }
      >
        በወረቀት ይያዝ የነበረው ቅጽ ዲጂታል ቅጂ። ለማተም ወይም በ Excel ለመክፈት ይጠቀሙ።
      </PageHead>

      <div className="toolbar no-print">
        <div className="month-nav">
          <button className="icon-btn" onClick={() => update(shiftMonth(sel, -1))} aria-label="ያለፈው ወር">
            <ChevronLeft size={18} />
          </button>
          <strong>
            {MONTHS[sel.month - 1]} {sel.year}
          </strong>
          <button className="icon-btn" onClick={() => update(shiftMonth(sel, 1))} aria-label="የሚቀጥለው ወር">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="seg">
          <button className={sel.count === 1 ? 'on' : ''} onClick={() => update({ count: 1 })}>
            1 ወር
          </button>
          <button className={sel.count === 3 ? 'on' : ''} onClick={() => update({ count: 3 })}>
            3 ወራት
          </button>
        </div>
        {sheet && sheet.groups.length > 1 && (
          <select className="select" style={{ width: 'auto' }} value={sel.group} onChange={(e) => update({ group: e.target.value })}>
            <option value="">ሁሉም ክፍሎች</option>
            {sheet.groups.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        )}
      </div>

      <div className="card sheet-paper">
        <div className="sheet-head">
          <Logo />
          <div>
            <h2>{SCHOOL}</h2>
            <h3>{FORM_TITLE}</h3>
            <p>{periodLabel}</p>
          </div>
        </div>
        <div className="tibeb" />

        {!sheet ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} h={30} />
            ))}
          </div>
        ) : !sheet.rows.length ? (
          <Empty icon={Sheet} title="ምንም አባል የለም" />
        ) : (
          <>
            <div className="sheet-scroll">
              <table className="sheet">
                <thead>
                  <tr>
                    <th rowSpan={2} className="c-idx stick-1">ተ.ቁ</th>
                    <th rowSpan={2} className="c-name stick-2">ስም</th>
                    <th rowSpan={2} className="c-sex">ፆታ</th>
                    {sheet.cols.map((c) => (
                      <th key={`${c.year}-${c.month}`} className="month" colSpan={Math.max(c.dates.length, 1)}>
                        ወር፦ {MONTHS[c.month - 1]} {c.year}
                      </th>
                    ))}
                    <th rowSpan={2}>ተገኝ</th>
                    <th rowSpan={2} style={{ minWidth: 150 }}>ተገኝነት</th>
                  </tr>
                  <tr>
                    {sheet.cols.map((c) =>
                      c.dates.length ? (
                        c.dates.map((d) => (
                          <th key={d} className="day">
                            <span className="num">{toEth(d).day}</span>
                            <small>{WEEKDAYS_SHORT[weekday(d)]}</small>
                          </th>
                        ))
                      ) : (
                        <th key={`e-${c.month}`} className="day">
                          <small>—</small>
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.map((r, i) => {
                    let k = 0;
                    return (
                      <tr key={r.m.id}>
                        <td className="c-idx stick-1">{i + 1}</td>
                        <td className="c-name stick-2">{r.m.full_name}</td>
                        <td className="c-sex">{GENDER[r.m.gender]}</td>
                        {sheet.cols.map((c) =>
                          c.dates.length ? (
                            c.dates.map((d) => {
                              const s = r.marks[k++];
                              return <td key={d}>{s && <Mark status={s} />}</td>;
                            })
                          ) : (
                            <td key={`e-${c.month}`} />
                          )
                        )}
                        <td className="c-total">
                          <b>{r.attended}</b>/{r.sessions}
                        </td>
                        <td>
                          <Meter pct={r.pct} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="stick-1" style={{ textAlign: 'left', paddingLeft: 12 }}>
                      የተገኙ ብዛት
                    </td>
                    {(() => {
                      let k = 0;
                      return sheet.cols.map((c) =>
                        c.dates.length ? (
                          c.dates.map((d) => (
                            <td key={d} className="num">
                              {sheet.perDate[k++]}
                            </td>
                          ))
                        ) : (
                          <td key={`e-${c.month}`} />
                        )
                      );
                    })()}
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
            {!sheet.allDates.length && (
              <p className="muted no-print" style={{ marginTop: 14 }}>
                በዚህ ጊዜ ውስጥ ምንም ክትትል አልተያዘም። <Link to="/attendance">ክትትል ይያዙ</Link>
              </p>
            )}
            <div className="sheet-legend">
              {STATUSES.map((s) => (
                <span key={s}>
                  <Mark status={s} size={12} />
                  {STATUS[s].label}
                </span>
              ))}
              <span>ተገኝነት = (ተገኝ + አርፍዷል) ÷ የተያዙ ክትትሎች</span>
            </div>
          </>
        )}
      </div>
    </>
  );
}
