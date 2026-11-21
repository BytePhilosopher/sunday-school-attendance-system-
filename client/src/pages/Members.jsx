import { useMemo, useState } from 'react';
import { AlertCircle, Pencil, Phone, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { useFetch } from '../lib/hooks.js';
import { formatEth, todayIso } from '../lib/ethiopian.js';
import { GENDER_LONG, attendancePct } from '../lib/constants.js';
import { Avatar, Empty, Meter, PageHead, Skeleton } from '../components/ui.jsx';
import { Modal, useConfirm, useToast } from '../components/feedback.jsx';

export default function Members() {
  const { data: members, loading, reload } = useFetch('/api/members');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('active');
  const [editing, setEditing] = useState(null); // null = closed, {} = new, member = edit

  const counts = useMemo(() => {
    const list = members || [];
    return { active: list.filter((m) => m.active).length, inactive: list.filter((m) => !m.active).length, all: list.length };
  }, [members]);

  const visible = (members || []).filter((m) => {
    if (view === 'active' && !m.active) return false;
    if (view === 'inactive' && m.active) return false;
    const q = search.trim();
    return !q || m.full_name.includes(q) || (m.phone || '').includes(q) || m.group_name.includes(q);
  });

  return (
    <>
      <PageHead
        eyebrow="አባላት"
        title="የመዘምራን ዝርዝር"
        actions={
          <button className="btn btn-primary" onClick={() => setEditing({})}>
            <UserPlus size={18} />
            አዲስ አባል መዝግብ
          </button>
        }
      >
        አዲስ አባላትን ይመዝግቡ፣ መረጃቸውን ያስተካክሉ እና የተገኝነት ታሪካቸውን ይመልከቱ።
      </PageHead>

      <div className="toolbar">
        <div className="input-icon grow">
          <Search size={17} />
          <input className="input" type="search" placeholder="በስም፣ በስልክ ወይም በክፍል ይፈልጉ…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="seg">
          {[
            ['active', 'ንቁ'],
            ['inactive', 'ያቋረጡ'],
            ['all', 'ሁሉም'],
          ].map(([k, label]) => (
            <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>
              {label} <span className="muted num">{counts[k]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {loading && !members ? (
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} h={48} />
            ))}
          </div>
        ) : visible.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>ተ.ቁ</th>
                  <th>ስም</th>
                  <th className="hide-sm">ፆታ</th>
                  <th className="hide-sm">ስልክ</th>
                  <th>ተገኝነት</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((m, i) => (
                  <tr key={m.id} className={m.active ? '' : 'inactive'}>
                    <td className="muted num">{i + 1}</td>
                    <td>
                      <div className="person">
                        <Avatar name={m.full_name} seed={m.id} />
                        <div style={{ minWidth: 0 }}>
                          <div className="person-name">
                            {m.full_name} {!m.active && <span className="pill pill-muted">ያቋረጠ</span>}
                          </div>
                          <div className="person-sub">
                            {m.group_name}
                            {m.joined_on && ` · ከ${formatEth(m.joined_on)}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hide-sm">
                      <span className="pill">{GENDER_LONG[m.gender]}</span>
                    </td>
                    <td className="hide-sm">
                      {m.phone ? (
                        <a href={`tel:${m.phone}`} className="num" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Phone size={14} />
                          {m.phone}
                        </a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <Meter pct={attendancePct(m.present, m.late, m.sessions)} />
                      <div className="person-sub num">
                        {m.present + m.late} / {m.sessions} ክትትሎች
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="icon-btn bordered" onClick={() => setEditing(m)} title="አስተካክል" aria-label={`${m.full_name} አስተካክል`}>
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={Users} title="ምንም አባል አልተገኘም">
            {search ? 'የፍለጋ ቃሉን ይቀይሩ።' : 'አዲስ አባል ለመመዝገብ ከላይ ያለውን ቁልፍ ይጫኑ።'}
          </Empty>
        )}
      </div>

      {editing && (
        <MemberForm
          member={editing.id ? editing : null}
          groups={[...new Set((members || []).map((m) => m.group_name))]}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function MemberForm({ member, groups, onClose, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const isNew = !member;
  const [form, setForm] = useState(
    member
      ? { ...member, phone: member.phone || '', notes: member.notes || '', joined_on: member.joined_on || '' }
      : { full_name: '', gender: 'M', phone: '', group_name: 'መዘምራን', joined_on: todayIso(), notes: '', active: true }
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isNew) await api.post('/api/members', form);
      else await api.put(`/api/members/${member.id}`, form);
      toast(isNew ? `${form.full_name} ተመዝግበዋል` : 'ለውጡ ተቀምጧል');
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: 'አባሉን ይሰርዙ?',
      message: `"${member.full_name}" እና የክትትል ታሪካቸው በሙሉ ይሰረዛል፤ ይህ ሊመለስ አይችልም። ታሪኩን ለማቆየት "ንቁ አባል" የሚለውን ምልክት ማንሳት ይሻላል።`,
      confirmLabel: 'አዎ፣ ሰርዝ',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/api/members/${member.id}`);
      toast('አባሉ ተሰርዟል');
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal
      title={isNew ? 'አዲስ አባል መመዝገቢያ' : 'የአባል መረጃ'}
      subtitle={isNew ? 'የአዲሱን መዘምር መረጃ ያስገቡ።' : member.full_name}
      onClose={onClose}
      footer={
        <>
          {!isNew && user.role === 'admin' && (
            <button type="button" className="btn btn-danger left" onClick={remove}>
              <Trash2 size={16} />
              ሰርዝ
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            ይቅር
          </button>
          <button className="btn btn-primary" form="member-form" disabled={busy}>
            {isNew ? 'መዝግብ' : 'አስቀምጥ'}
          </button>
        </>
      }
    >
      <form id="member-form" className="form-grid" onSubmit={submit}>
        <label className="field full">
          <span>ሙሉ ስም</span>
          <input className="input" value={form.full_name} onChange={set('full_name')} required autoFocus placeholder="ለምሳሌ፦ ዲ/ን ያሬድ ገነቱ" />
        </label>
        <div className="field">
          <span className="field-label">ፆታ</span>
          <div className="seg" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {['M', 'F'].map((g) => (
              <button type="button" key={g} className={form.gender === g ? 'on' : ''} onClick={() => setForm((f) => ({ ...f, gender: g }))}>
                {GENDER_LONG[g]}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>ስልክ ቁጥር</span>
          <input className="input num" type="tel" value={form.phone} onChange={set('phone')} placeholder="09…" />
        </label>
        <label className="field">
          <span>ክፍል</span>
          <input className="input" value={form.group_name} onChange={set('group_name')} list="group-options" />
          <datalist id="group-options">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>
            የተመዘገበበት ቀን {form.joined_on && <span className="hint">· {formatEth(form.joined_on)}</span>}
          </span>
          <input className="input" type="date" value={form.joined_on} onChange={set('joined_on')} />
        </label>
        <label className="field full">
          <span>ማስታወሻ</span>
          <textarea className="textarea" value={form.notes} onChange={set('notes')} rows={2} />
        </label>
        {!isNew && (
          <label className="check full">
            <input type="checkbox" checked={form.active} onChange={set('active')} />
            <span>
              <b>ንቁ አባል</b>
              <br />
              <span className="muted">ምልክቱን ማንሳት አባሉን ከክትትል ዝርዝር ያወጣል፤ የቀደመ ታሪኩ ግን ይቀመጣል።</span>
            </span>
          </label>
        )}
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
