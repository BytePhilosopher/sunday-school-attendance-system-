import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ClipboardCheck, KeyRound, LayoutDashboard, LogOut, Sheet, UserCog, Users } from 'lucide-react';
import { useAuth } from '../lib/auth.js';
import { api } from '../lib/api.js';
import { FORM_TITLE, SCHOOL, SCHOOL_SHORT } from '../lib/constants.js';
import { Avatar, Logo } from './ui.jsx';
import PasswordModal from './PasswordModal.jsx';

const NAV = [
  { to: '/', label: 'ዋና ገጽ', short: 'ዋና', icon: LayoutDashboard, end: true },
  { to: '/attendance', label: 'ክትትል መያዝ', short: 'ክትትል', icon: ClipboardCheck },
  { to: '/sheet', label: 'ወርሃዊ ቅጽ', short: 'ቅጽ', icon: Sheet },
  { to: '/members', label: 'አባላት', short: 'አባላት', icon: Users },
  { to: '/users', label: 'ተጠቃሚዎች', short: 'ተጠቃሚ', icon: UserCog, admin: true },
];

export default function Layout() {
  const { user, setUser } = useAuth();
  const [pwOpen, setPwOpen] = useState(false);
  const items = NAV.filter((n) => !n.admin || user.role === 'admin');

  const logout = async () => {
    await api.post('/api/logout').catch(() => {});
    setUser(null);
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <NavLink to="/" className="side-brand">
          <Logo />
          <div>
            <div className="side-brand-title">{SCHOOL}</div>
            <div className="side-brand-sub">{FORM_TITLE}</div>
          </div>
        </NavLink>
        <nav className="side-nav">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon size={19} strokeWidth={1.9} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="tibeb" />
          <div className="user-chip">
            <Avatar name={user.full_name} size="sm" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-chip-name">{user.full_name}</div>
              <div className="user-chip-role">{user.role === 'admin' ? 'አስተዳዳሪ' : 'መዝጋቢ'}</div>
            </div>
            <button className="icon-btn" title="የይለፍ ቃል ቀይር" onClick={() => setPwOpen(true)}>
              <KeyRound size={17} />
            </button>
            <button className="icon-btn" title="ውጣ" onClick={logout}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <header className="mobile-top">
        <Logo />
        <div className="mobile-top-title">
          {SCHOOL_SHORT}
          <small>{FORM_TITLE}</small>
        </div>
        <button className="icon-btn" title="የይለፍ ቃል ቀይር" onClick={() => setPwOpen(true)}>
          <KeyRound size={19} />
        </button>
        <button className="icon-btn" title="ውጣ" onClick={logout}>
          <LogOut size={19} />
        </button>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        {items.map(({ to, short, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}>
            <Icon size={21} strokeWidth={1.9} />
            {short}
          </NavLink>
        ))}
      </nav>

      {pwOpen && <PasswordModal userId={user.id} self onClose={() => setPwOpen(false)} />}
    </div>
  );
}
