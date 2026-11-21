import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { api } from '../lib/api.js';
import { Modal, useToast } from './feedback.jsx';

export default function PasswordModal({ userId, self, name, onClose }) {
  const toast = useToast();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (f.password.value !== f.confirm.value) return setError('የይለፍ ቃሎቹ አይመሳሰሉም');
    setBusy(true);
    try {
      await api.put(`/api/users/${userId}/password`, { password: f.password.value });
      toast('የይለፍ ቃል ተቀይሯል');
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      size="sm"
      title={self ? 'የይለፍ ቃሌን ቀይር' : 'የይለፍ ቃል ዳግም አስጀምር'}
      subtitle={self ? 'ሌሎች የገቡባቸው መሣሪያዎች ይወጣሉ።' : name}
      onClose={onClose}
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label className="field">
          <span>አዲስ የይለፍ ቃል</span>
          <input className="input" type="password" name="password" required minLength={6} autoComplete="new-password" autoFocus />
        </label>
        <label className="field">
          <span>ደግመው ያስገቡ</span>
          <input className="input" type="password" name="confirm" required minLength={6} autoComplete="new-password" />
        </label>
        {error && (
          <div className="form-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
          <button type="button" className="btn" onClick={onClose}>
            ይቅር
          </button>
          <button className="btn btn-primary" disabled={busy}>
            አስቀምጥ
          </button>
        </div>
      </form>
    </Modal>
  );
}
