import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTHS, WEEKDAYS_SHORT, daysInMonth, formatGreg, shiftMonth, toEth, toIso, todayIso, weekday } from '../lib/ethiopian.js';

// A month-grid calendar in the Ethiopian calendar. `marked` is a Set of ISO dates with attendance recorded.
export default function EthDatePicker({ value, onChange, onClose, marked = new Set(), onMonthChange }) {
  const ref = useRef(null);
  const sel = toEth(value);
  const [view, setView] = useState({ year: sel.year, month: sel.month });
  const today = todayIso();

  useEffect(() => {
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => onMonthChange?.(view), [view.year, view.month]); // eslint-disable-line react-hooks/exhaustive-deps

  const n = daysInMonth(view.year, view.month);
  const offset = weekday(toIso(view.year, view.month, 1));
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(<span key={`b${i}`} />);
  for (let d = 1; d <= n; d++) {
    const iso = toIso(view.year, view.month, d);
    const cls = [iso === value && 'sel', iso === today && 'today', marked.has(iso) && 'has'].filter(Boolean).join(' ');
    cells.push(
      <button key={iso} type="button" className={cls} onClick={() => onChange(iso)} title={formatGreg(iso)}>
        {d}
      </button>
    );
  }

  return (
    <div className="picker-pop" ref={ref}>
      <div className="picker-head">
        <button type="button" className="icon-btn" onClick={() => setView((v) => shiftMonth(v, -1))} aria-label="ያለፈው ወር">
          <ChevronLeft size={18} />
        </button>
        <strong>
          {MONTHS[view.month - 1]} {view.year}
        </strong>
        <button type="button" className="icon-btn" onClick={() => setView((v) => shiftMonth(v, 1))} aria-label="የሚቀጥለው ወር">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="picker-grid">
        {WEEKDAYS_SHORT.map((w) => (
          <span key={w} className="wd">{w}</span>
        ))}
        {cells}
      </div>
      <div className="picker-foot">
        <span>
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: 'var(--gold-bright)', marginRight: 6 }} />
          ክትትል የተያዘበት ቀን
        </span>
        <button type="button" className="btn btn-sm" onClick={() => onChange(today)}>
          ዛሬ
        </button>
      </div>
    </div>
  );
}
