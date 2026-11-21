import { Check, Clock, FileText, X } from 'lucide-react';
import { initial, pctTone } from '../lib/constants.js';

export const Logo = ({ className = '' }) => (
  <span className={`logo-ring ${className}`}>
    <img src="/logo.png" alt="የሰንበት ት/ቤቱ ዓርማ" />
  </span>
);

const toneOf = (seed) => {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % 5;
};

export function Avatar({ name, size, status, seed }) {
  const cls = status ? `st-${status}` : `tone-${toneOf(seed ?? name)}`;
  return <span className={`avatar ${size === 'sm' ? 'sm' : ''} ${cls}`}>{initial(name)}</span>;
}

export const STATUS_ICON = { present: Check, absent: X, late: Clock, excused: FileText };

export function Mark({ status, size = 13 }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={`mk mk-${status}`}>
      <Icon size={size} strokeWidth={3} />
    </span>
  );
}

export function Meter({ pct }) {
  const tone = pctTone(pct);
  return (
    <span className="meter">
      <span className="meter-track">
        <span className={`meter-fill fill-${tone}`} style={{ width: `${pct ?? 0}%` }} />
      </span>
      <span className={`meter-value num tone-${tone}`}>{pct === null ? '—' : `${pct}%`}</span>
    </span>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="empty">
      {Icon && (
        <span className="empty-icon">
          <Icon size={22} />
        </span>
      )}
      {title && <strong>{title}</strong>}
      {children && <div>{children}</div>}
    </div>
  );
}

export function PageHead({ eyebrow, title, children, actions }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%', style }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} />;
}

export function Ring({ value, total, color = 'var(--present)', size = 76 }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const frac = total ? value / total : 0;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: 'stroke-dashoffset .4s ease' }}
        />
      </svg>
      <span className="ring-label num">{Math.round(frac * 100)}%</span>
    </div>
  );
}
