import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './DriveModal.module.css';

const BLANK = {
  name: '', type: 'HDD', capacity: '', used: '',
  folder: '_ACTIVE', location: '', notes: '', price: '',
};

export default function DriveModal({ open, drive, onClose, onSave }) {
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const isEdit = !!drive?.id;

  useEffect(() => {
    if (open) {
      setForm(drive ? {
        name: drive.name || '',
        type: drive.type || 'HDD',
        capacity: drive.capacity ?? '',
        used: drive.used ?? '',
        folder: drive.folder || '_ACTIVE',
        location: drive.location || '',
        notes: drive.notes || '',
        price: drive.price ?? '',
      } : BLANK);
    }
  }, [open, drive]);

  if (!open) return null;

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const pct = form.capacity > 0
    ? Math.round((Number(form.used) / Number(form.capacity)) * 100)
    : 0;
  const fillClass = pct >= 90 ? styles.fillDanger : pct >= 75 ? styles.fillWarn : styles.fillSafe;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave({
      ...form,
      capacity: Number(form.capacity) || 0,
      used: Number(form.used) || 0,
      price: form.price ? Number(form.price) : 0,
      fillPct: pct,
    });
    setSaving(false);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.title}>{isEdit ? 'Edit Drive' : 'Add New Drive'}</h2>
            <p className={styles.sub}>{isEdit ? drive.name : 'Register a new storage drive'}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Name + Type */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Drive Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. WD_Black_4TB"
                required
                autoFocus
              />
            </div>
            <div className={styles.field}>
              <label>Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}>
                <option>HDD</option>
                <option>SSD</option>
                <option>NVMe</option>
                <option>SD Card</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          {/* Capacity + Used */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Capacity (GB)</label>
              <input
                type="number"
                min="0"
                value={form.capacity}
                onChange={e => set('capacity', e.target.value)}
                placeholder="e.g. 4000"
              />
            </div>
            <div className={styles.field}>
              <label>Used (GB)</label>
              <input
                type="number"
                min="0"
                value={form.used}
                onChange={e => set('used', e.target.value)}
                placeholder="e.g. 1200"
              />
            </div>
          </div>

          {/* Fill preview */}
          {form.capacity > 0 && (
            <div className={styles.fillPreview}>
              <div className={styles.fillPreviewRow}>
                <span>Fill preview</span>
                <span className={pct >= 90 ? styles.pctDanger : ''}>{pct}%</span>
              </div>
              <div className={styles.barBg}>
                <div className={`${styles.bar} ${fillClass}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          {/* Price + Location */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Price (Optional)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={e => set('price', e.target.value)}
                placeholder="e.g. 149.99"
              />
            </div>
            <div className={styles.field}>
              <label>Location / Label</label>
              <input
                type="text"
                value={form.location}
                onChange={e => set('location', e.target.value)}
                placeholder="e.g. Studio Shelf A"
              />
            </div>
          </div>

          {/* Notes */}
          <div className={styles.field}>
            <label>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              placeholder="Any notes about this drive…"
            />
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.save} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving…' : isEdit ? 'Update Drive' : 'Add Drive'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
