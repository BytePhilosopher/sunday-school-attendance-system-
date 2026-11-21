import { useState } from 'react';
import { AlertCircle, KeyRound, Trash2, UserPlus } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { useFetch } from '../lib/hooks.js';
import { Avatar, PageHead, Skeleton } from '../components/ui.jsx';
import { Modal, useConfirm, useToast } from '../components/feedback.jsx';
import PasswordModal from '../components/PasswordModal.jsx';

const ROLE = { admin: 'አስተዳዳሪ', recorder: 'መዝጋቢ' };

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: users, reload } = useFetch('/api/users');
  const [adding, setAdding] = useState(false);
  const [pwFor, setPwFor] = useState(null);

  async function remove(u) {
    const ok = await confirm({
      title: 'ተጠቃሚውን ይሰርዙ?',
      message: `"${u.full_name}" ከዚህ በኋላ መግባት አይችሉም። የያዙት ክትትል ግን አይጠፋም።`,
      confirmLabel: 'አዎ፣ ሰርዝ',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/api/users/${u.id}`);
      toast('ተጠቃሚው ተሰርዟል');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <>
      <PageHead
        eyebrow="ተጠቃሚዎች"
        title="ክትትል የሚይዙ ሰዎች"
        actions={
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <UserPlus size={18} />
            አዲስ ተጠቃሚ
          </button>
        }
      >
        <b>መዝጋቢ</b> ክትትል መያዝና አባላትን መመዝገብ ይችላል። <b>አስተዳዳሪ</b> በተጨማሪ ተጠቃሚዎችን ያስተዳድራል፣ አባላትንም ይሰርዛል።
      </PageHead>

      <div className="card">
        {!users ? (
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            <Skeleton h={48} />
            <Skeleton h={48} />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ስም</th>
                  <th>ሚና</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="person">
                        <Avatar name={u.full_name} seed={`u${u.id}`} />
                        <div>
                          <div className="person-name">
                            {u.full_name} {u.id === me.id && <span className="pill pill-muted">እርስዎ</span>}
                          </div>
                          <div className="person-sub">@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`pill ${u.role === 'admin' ? 'pill-gold' : 'pill-brand'}`}>{ROLE[u.role]}</span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-sm" onClick={() => setPwFor(u)}>
                        <KeyRound size={15} />
                        <span className="hide-sm">የይለፍ ቃል</span>
                      </button>{' '}
                      {u.id !== me.id && (
                        <button className="btn btn-sm btn-danger" onClick={() => remove(u)} aria-label="ሰርዝ">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adding && (
        <NewUser
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            reload();
          }}
        />
      )}
      {pwFor && <PasswordModal userId={pwFor.id} self={pwFor.id === me.id} name={pwFor.full_name} onClose={() => setPwFor(null)} />}
    </>
  );
}

function NewUser({ onClose, onSaved }) {
  const toast = useToast();
  const [role, setRole] = useState('recorder');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...Object.fromEntries(new FormData(e.currentTarget)), role };
      await api.post('/api/users', body);
      toast('ተጠቃሚ ተፈጥሯል');
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="አዲስ ተጠቃሚ"
      subtitle="የመግቢያ ስምና የይለፍ ቃሉን ለሰውየው ይስጡ።"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            ይቅር
          </button>
          <button className="btn btn-primary" form="user-form" disabled={busy}>
            ፍጠር
          </button>
        </>
      }
    >
      <form id="user-form" className="form-grid" onSubmit={submit}>
        <label className="field full">
          <span>ሙሉ ስም</span>
          <input className="input" name="full_name" required autoFocus />
        </label>
        <label className="field">
          <span>የተጠቃሚ ስም</span>
          <input className="input" name="username" required autoComplete="off" />
        </label>
        <label className="field">
          <span>የይለፍ ቃል</span>
          <input className="input" type="password" name="password" required minLength={6} autoComplete="new-password" />
        </label>
        <div className="field full">
          <span className="field-label">ሚና</span>
          <div className="seg" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {Object.entries(ROLE).map(([k, label]) => (
              <button type="button" key={k} className={role === k ? 'on' : ''} onClick={() => setRole(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <div className="form-error full">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
