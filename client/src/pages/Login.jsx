import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { api } from '../lib/api.js';
import { FORM_TITLE, SCHOOL } from '../lib/constants.js';
import { Logo } from '../components/ui.jsx';

export default function Login({ onLogin }) {
  const [needsSetup, setNeedsSetup] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get('/api/setup-status')
      .then((r) => setNeedsSetup(r.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = Object.fromEntries(new FormData(e.currentTarget));
      const { user } = await api.post(needsSetup ? '/api/setup' : '/api/login', body);
      onLogin(user);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <section className="login-art">
        <Logo />
        <h1>{SCHOOL}</h1>
        <p>{FORM_TITLE} · ከ1983 ዓ.ም ጀምሮ</p>
      </section>

      <section className="login-form-side">
        {needsSetup !== null && (
          <form className="login-form" onSubmit={submit}>
            <div className="login-mobile-logo">
              <Logo />
              <div>{SCHOOL}</div>
            </div>
            <h2>{needsSetup ? 'እንኳን ደህና መጡ' : 'ይግቡ'}</h2>
            <p className="lead">
              {needsSetup
                ? 'ስርዓቱን ለመጀመር የመጀመሪያውን የአስተዳዳሪ መለያ ይፍጠሩ።'
                : 'ክትትል ለመያዝ በመለያዎ ይግቡ።'}
            </p>
            {needsSetup && (
              <label className="field">
                <span>ሙሉ ስም</span>
                <input className="input" name="full_name" required autoComplete="name" />
              </label>
            )}
            <label className="field">
              <span>የተጠቃሚ ስም</span>
              <input className="input" name="username" required autoComplete="username" autoFocus />
            </label>
            <label className="field">
              <span>የይለፍ ቃል</span>
              <input
                className="input"
                type="password"
                name="password"
                required
                minLength={needsSetup ? 6 : undefined}
                autoComplete={needsSetup ? 'new-password' : 'current-password'}
              />
            </label>
            {error && (
              <div className="form-error">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            <button className="btn btn-primary btn-block" style={{ height: 48, marginTop: 4 }} disabled={busy}>
              {needsSetup ? 'መለያ ፍጠር' : 'ግባ'}
              <ArrowRight size={18} />
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
