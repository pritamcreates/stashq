import { useState, useEffect, useCallback } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  getDocs, query, where, orderBy, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store/useStore';
import { X, Plus, Search, Check, Printer, ChevronLeft } from 'lucide-react';
import styles from './ShootDayForm.module.css';

const TEAM_KEYS = ['p1','v1','p2','v2','p3','v3'];
const DEFAULT_ROLES = ['Photographer','Videographer','Photographer','Videographer','Photographer','Videographer'];
const ROLE_OPTIONS = ['Photographer','Videographer','BTS / Drone','Photo Assistant','Video Assistant','Director','Other'];

function today() { return new Date().toISOString().split('T')[0]; }
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function calcGB(team) {
  return parseFloat(((team || []).reduce((s, m) => s + (parseFloat(m.gb) || 0), 0)).toFixed(2));
}

const BLANK_FORM = () => ({
  clientName: '', eventDate: today(), eventType: '', venue: '',
  team: TEAM_KEYS.map((_, i) => ({
    role: DEFAULT_ROLES[i], name: '', camera: '',
    singleB: false, doubleB: false, no: '', gb: '',
  })),
  managedDate: today(), hddSingle: '', hddDouble: '', gmail: '', notes: '',
  deliverables: { photos: false, videos: false, short: false },
});

export default function ShootDayForm({ onBack }) {
  const { user, showToast } = useStore();
  const [form, setForm] = useState(BLANK_FORM);
  const [records, setRecords] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadRecords = useCallback(async () => {
    if (!user) return;
    try {
      const snap = await getDocs(query(
        collection(db, 'shootDayRecords'),
        where('uid', '==', user.uid),
        orderBy('createdAt', 'desc')
      ));
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      const snap = await getDocs(query(
        collection(db, 'shootDayRecords'),
        where('uid', '==', user.uid)
      ));
      setRecords(snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toDate?.()?.getTime?.() ?? 0) - (a.createdAt?.toDate?.()?.getTime?.() ?? 0))
      );
    }
  }, [user]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const setField = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const setTeam = (i, field, value) => setForm(f => {
    const team = [...f.team];
    team[i] = { ...team[i], [field]: value };
    return { ...f, team };
  });

  const setDeliverable = (key, value) => setForm(f => ({
    ...f, deliverables: { ...f.deliverables, [key]: value }
  }));

  const loadRecord = (rec) => {
    setActiveId(rec.id);
    setForm({
      clientName: rec.clientName || '',
      eventDate: rec.eventDate || today(),
      eventType: rec.eventType || '',
      venue: rec.venue || '',
      team: TEAM_KEYS.map((_, i) => {
        const row = (rec.team || [])[i] || {};
        return {
          role: row.role || DEFAULT_ROLES[i],
          name: row.name || '', camera: row.camera || '',
          singleB: !!row.singleB, doubleB: !!row.doubleB,
          no: row.no || '', gb: row.gb || '',
        };
      }),
      managedDate: rec.managedDate || today(),
      hddSingle: rec.hddSingle || '',
      hddDouble: rec.hddDouble || '',
      gmail: rec.gmail || '',
      notes: rec.notes || '',
      deliverables: {
        photos: !!(rec.deliverables?.photos),
        videos: !!(rec.deliverables?.videos),
        short:  !!(rec.deliverables?.short),
      },
    });
    setDrawerOpen(false);
  };

  const newRecord = () => {
    setActiveId(null);
    setForm(BLANK_FORM());
  };

  // ── Drive sync helpers ──
  async function syncDrives(newData, prevData) {
    const result = { created: 0, updated: 0 };
    const newGB  = calcGB(newData.team);
    const prevGB = prevData ? calcGB(prevData.team) : 0;
    const snap   = await getDocs(query(collection(db, 'drives'), where('uid', '==', user.uid)));
    const drives = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const pairs = [
      { newName: newData.hddSingle, prevName: prevData?.hddSingle },
      { newName: newData.hddDouble, prevName: prevData?.hddDouble },
    ];
    for (const { newName, prevName } of pairs) {
      if (!newName && !prevName) continue;
      const nameChanged = prevName && prevName.toLowerCase() !== (newName || '').toLowerCase();
      if (nameChanged) {
        const old = drives.find(d => d.name.toLowerCase() === prevName.toLowerCase());
        if (old) {
          const rev = parseFloat(Math.max(0, (old.used || 0) - prevGB).toFixed(2));
          await updateDoc(doc(db, 'drives', old.id), { used: rev, fillPct: old.capacity > 0 ? Math.round(rev / old.capacity * 100) : 0 });
          result.updated++;
        }
        if (newName && newGB > 0) { const r = await applyGB(drives, newName, newGB, newData.clientName); result[r]++; }
      } else if (newName) {
        const delta = newGB - prevGB;
        if (delta !== 0 || !prevData) { const r = await applyGB(drives, newName, prevData ? delta : newGB, newData.clientName); result[r]++; }
      }
    }
    return result;
  }

  async function applyGB(drives, name, delta, event) {
    const match = drives.find(d => d.name.toLowerCase() === name.toLowerCase());
    if (match) {
      const nu = parseFloat(Math.max(0, (match.used || 0) + delta).toFixed(2));
      const fp = match.capacity > 0 ? Math.round(nu / match.capacity * 100) : 0;
      await updateDoc(doc(db, 'drives', match.id), { used: nu, fillPct: fp });
      match.used = nu;
      return 'updated';
    } else if (delta > 0) {
      const nd = { uid: user.uid, name, type: 'HDD', capacity: 0, used: parseFloat(delta.toFixed(2)), fillPct: 0, folder: '_ACTIVE', location: '', notes: `Auto-added from Shoot Day: ${event || ''}`, createdAt: serverTimestamp() };
      const ref = await addDoc(collection(db, 'drives'), nd);
      drives.push({ id: ref.id, ...nd });
      return 'created';
    }
    return 'skipped';
  }

  const save = async () => {
    if (!form.clientName.trim()) { showToast('⚠️ Client name is required'); return; }
    setSaving(true);
    const prevData = activeId ? records.find(r => r.id === activeId) : null;
    try {
      const payload = { ...form, uid: user.uid };
      if (activeId) {
        await updateDoc(doc(db, 'shootDayRecords', activeId), { ...payload, updatedAt: serverTimestamp() });
      } else {
        const ref = await addDoc(collection(db, 'shootDayRecords'), { ...payload, createdAt: serverTimestamp() });
        setActiveId(ref.id);
      }
      const sr = await syncDrives(form, prevData);
      await loadRecords();
      if (sr.created > 0 || sr.updated > 0)
        showToast(`✅ Saved — ${sr.created > 0 ? sr.created + ' drive(s) added, ' : ''}${sr.updated > 0 ? sr.updated + ' updated' : ''} in Drive Registry`);
      else
        showToast(prevData ? '✅ Record updated' : '✅ Record saved');
    } catch (e) {
      showToast('Error: ' + e.message);
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDoc(doc(db, 'shootDayRecords', deleteTarget));
      if (activeId === deleteTarget) { setActiveId(null); setForm(BLANK_FORM()); }
      await loadRecords();
      showToast('Record deleted');
    } catch (e) { showToast('Delete failed: ' + e.message); }
    setDeleteTarget(null);
  };

  const filtered = records.filter(r =>
    !search || (r.clientName || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.eventType || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.root}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <div className={styles.topLeft}>
          {onBack && (
            <button className={styles.backBtn} onClick={onBack}>
              <ChevronLeft size={14} /> Dashboard
            </button>
          )}
          <span className={styles.pageTitle}>Shoot Day Records</span>
        </div>
        <div className={styles.topRight}>
          <button className={`${styles.recordsBtn} ${drawerOpen ? styles.active : ''}`} onClick={() => setDrawerOpen(v => !v)}>
            Past Records
            <span className={styles.badge}>{records.length}</span>
          </button>
          <button className={styles.newBtn} onClick={newRecord}>
            <Plus size={13} /> New Record
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        <div className={styles.formPanel}>

          {/* Event Info */}
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Event Info</div>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label>Client Name</label>
                <input type="text" value={form.clientName} onChange={e => setField('clientName', e.target.value)} placeholder="e.g. Sharma Family" />
              </div>
              <div className={styles.field}>
                <label>Event Date</label>
                <input type="date" value={form.eventDate} onChange={e => setField('eventDate', e.target.value)} />
              </div>
            </div>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label>Event Type</label>
                <input type="text" value={form.eventType} onChange={e => setField('eventType', e.target.value)} placeholder="e.g. Wedding, Corporate" />
              </div>
              <div className={styles.field}>
                <label>Venue / Address</label>
                <input type="text" value={form.venue} onChange={e => setField('venue', e.target.value)} placeholder="e.g. Taj Palace, Delhi" />
              </div>
            </div>
          </section>

          {/* Team & Gear */}
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Team & Gear</div>
            <div className={styles.teamTableWrap}>
              <table className={styles.teamTable}>
                <thead>
                  <tr>
                    <th style={{width:130}}>Role</th>
                    <th>Name</th>
                    <th style={{width:110}}>Camera</th>
                    <th style={{width:68,textAlign:'center'}}>Single B.</th>
                    <th style={{width:68,textAlign:'center'}}>Double B.</th>
                    <th style={{width:80}}>Files</th>
                    <th style={{width:90}}>Size (GB)</th>
                  </tr>
                </thead>
                <tbody>
                  {form.team.map((row, i) => (
                    <tr key={i}>
                      <td>
                        <select value={row.role} onChange={e => setTeam(i, 'role', e.target.value)}>
                          {ROLE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </td>
                      <td><input type="text" value={row.name} onChange={e => setTeam(i, 'name', e.target.value)} placeholder="Name" /></td>
                      <td><input type="text" value={row.camera} onChange={e => setTeam(i, 'camera', e.target.value)} placeholder="Model" /></td>
                      <td style={{textAlign:'center'}}>
                        <div className={styles.cbWrap}>
                          <input type="checkbox" id={`sb-${i}`} checked={row.singleB} onChange={e => setTeam(i, 'singleB', e.target.checked)} />
                          <label htmlFor={`sb-${i}`} className={`${styles.cbBox} ${row.singleB ? styles.cbChecked : ''}`}>
                            {row.singleB && <Check size={11} color="#fff" strokeWidth={2.5} />}
                          </label>
                        </div>
                      </td>
                      <td style={{textAlign:'center'}}>
                        <div className={styles.cbWrap}>
                          <input type="checkbox" id={`db-${i}`} checked={row.doubleB} onChange={e => setTeam(i, 'doubleB', e.target.checked)} />
                          <label htmlFor={`db-${i}`} className={`${styles.cbBox} ${row.doubleB ? styles.cbChecked : ''}`}>
                            {row.doubleB && <Check size={11} color="#fff" strokeWidth={2.5} />}
                          </label>
                        </div>
                      </td>
                      <td><input type="number" value={row.no} min="0" onChange={e => setTeam(i, 'no', e.target.value)} placeholder="0" /></td>
                      <td><input type="number" value={row.gb} min="0" step="0.01" onChange={e => setTeam(i, 'gb', e.target.value)} placeholder="0.0" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Storage & Management */}
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Storage & Management</div>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label>Gmail Account</label>
                <input type="text" value={form.gmail} onChange={e => setField('gmail', e.target.value)} placeholder="account@gmail.com" />
                <div className={styles.fieldWarn}>
                  ⚠ Store only non-sensitive info. Avoid real passwords.
                </div>
              </div>
              <div className={styles.field}>
                <label>Date Managed</label>
                <input type="date" value={form.managedDate} onChange={e => setField('managedDate', e.target.value)} />
              </div>
            </div>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label>HDD Name (Single Backup)</label>
                <input type="text" value={form.hddSingle} onChange={e => setField('hddSingle', e.target.value)} placeholder="e.g. WD_Black_4TB" />
              </div>
              <div className={styles.field}>
                <label>HDD Name (Double Backup)</label>
                <input type="text" value={form.hddDouble} onChange={e => setField('hddDouble', e.target.value)} placeholder="e.g. Seagate_8TB" />
              </div>
            </div>
          </section>

          {/* Deliverables */}
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Deliverables</div>
            <div className={styles.deliveryGrid}>
              {[['photos','Final Photos'],['videos','Final Videos'],['short','Short Video']].map(([key, label]) => (
                <div
                  key={key}
                  className={`${styles.deliveryItem} ${form.deliverables[key] ? styles.deliveryChecked : ''}`}
                  onClick={() => setDeliverable(key, !form.deliverables[key])}
                >
                  <input
                    type="checkbox"
                    checked={form.deliverables[key]}
                    onChange={() => {}}
                    onClick={e => e.stopPropagation()}
                  />
                  <label>{label}</label>
                </div>
              ))}
            </div>
          </section>

          {/* Notes */}
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Notes</div>
            <div className={styles.field}>
              <label>Event Notes</label>
              <textarea
                rows={5}
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                placeholder="Add any notes, special instructions, reminders…"
              />
            </div>
          </section>

          {/* Actions */}
          <div className={styles.actions}>
            <button className={styles.clearBtn} onClick={newRecord}>Clear</button>
            <button className={styles.printBtn} onClick={() => window.print()}>
              <Printer size={14} /> Print
            </button>
            <button className={styles.saveBtn} disabled={saving} onClick={save}>
              <Check size={13} />
              {saving ? 'Saving…' : activeId ? 'Update Record' : 'Save Record'}
            </button>
          </div>
        </div>
      </div>

      {/* Records Drawer */}
      {drawerOpen && <div className={styles.drawerOverlay} onClick={() => setDrawerOpen(false)} />}
      <div className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ''}`}>
        <div className={styles.drawerHeader}>
          <div className={styles.drawerHeaderLeft}>
            <span className={styles.drawerTitle}>Past Records</span>
            <span className={styles.drawerCount}>{records.length}</span>
          </div>
          <button className={styles.drawerClose} onClick={() => setDrawerOpen(false)}><X size={16} /></button>
        </div>
        <div className={styles.drawerSearch}>
          <Search size={13} color="#bbb" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search records…"
          />
        </div>
        <div className={styles.drawerBody}>
          {filtered.length === 0 ? (
            <div className={styles.emptyRecords}>
              <strong>No records yet</strong>
              <span>Save your first shoot day record.</span>
            </div>
          ) : filtered.map(r => {
            const d = r.eventDate ? new Date(r.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
            return (
              <div
                key={r.id}
                className={`${styles.recordRow} ${activeId === r.id ? styles.recordSelected : ''}`}
                onClick={() => loadRecord(r)}
              >
                <div className={styles.recordLeft}>
                  <div className={styles.recordClient}>{r.clientName || 'Unnamed'}</div>
                  <div className={styles.recordMeta}>{d} · {r.eventType || '—'}</div>
                </div>
                <div className={styles.recordRight}>
                  <span className={styles.savedBadge}>Saved</span>
                  <button
                    className={styles.delBtn}
                    onClick={e => { e.stopPropagation(); setDeleteTarget(r.id); }}
                  >×</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete confirm */}
      {deleteTarget && (
        <div className={styles.delOverlay} onClick={() => setDeleteTarget(null)}>
          <div className={styles.delBox} onClick={e => e.stopPropagation()}>
            <div className={styles.delIcon}>🗑️</div>
            <h3>Delete record?</h3>
            <p>This record will be permanently removed.</p>
            <div className={styles.delBtns}>
              <button className={styles.delCancel} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className={styles.delConfirm} onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
