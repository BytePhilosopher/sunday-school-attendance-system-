import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, AlertCircle, X } from 'lucide-react';

// ---------- Modal ----------
const openModals = []; // stack, so Escape only closes the top-most modal

export function Modal({ title, subtitle, onClose, children, footer, size }) {
  const idRef = useRef(Symbol('modal'));
  useEffect(() => {
    const id = idRef.current;
    openModals.push(id);
    return () => openModals.splice(openModals.indexOf(id), 1);
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && openModals.at(-1) === idRef.current && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size || ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="ዝጋ">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

// ---------- Toasts + confirm dialog ----------
const FeedbackContext = createContext(null);
export const useToast = () => useContext(FeedbackContext).toast;
export const useConfirm = () => useContext(FeedbackContext).confirm;

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const idRef = useRef(0);

  const toast = useCallback((message, type = 'success') => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  const confirm = useCallback(
    (opts) => new Promise((resolve) => setDialog({ ...opts, resolve })),
    []
  );
  const close = (result) => {
    dialog.resolve(result);
    setDialog(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type === 'error' ? 'error' : ''}`}>
            {t.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            {t.message}
          </div>
        ))}
      </div>
      {dialog && (
        <Modal
          size="sm"
          title={dialog.title}
          onClose={() => close(false)}
          footer={
            <>
              <button className="btn" onClick={() => close(false)}>
                ይቅር
              </button>
              <button className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} autoFocus>
                {dialog.confirmLabel || 'አዎ'}
              </button>
            </>
          }
        >
          {dialog.danger && (
            <div className="confirm-icon" style={{ background: 'var(--absent-soft)', color: 'var(--absent)' }}>
              <AlertTriangle size={24} />
            </div>
          )}
          <div style={{ color: 'var(--ink-2)' }}>{dialog.message}</div>
        </Modal>
      )}
    </FeedbackContext.Provider>
  );
}
