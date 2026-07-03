import { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit2, Database, ExternalLink, Tag, Folder } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store/useStore';
import Dialog from '../Dialog/Dialog';
import styles from './FileRecords.module.css';

const STATUS_LABELS = {
  raw: 'Raw RAWs',
  managed: 'Managed',
  'backed-up': 'Backed Up',
  'needs-cleanup': 'Needs Cleanup',
  archived: 'Archived',
};

export default function FileRecords({ showToast }) {
  const { user, drives } = useStore();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDrive, setFilterDrive] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modal form states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form, setForm] = useState({
    name: '',
    driveId: '',
    size: '',
    path: '',
    status: 'raw',
    tags: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadRecords = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'fileRecords'),
        where('uid', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecords(list);
    } catch (e) {
      showToast('Error loading file records: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [user]);

  const openAdd = () => {
    setEditingRecord(null);
    setForm({
      name: '',
      driveId: drives[0]?.id || '',
      size: '',
      path: '',
      status: 'raw',
      tags: '',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEdit = (rec) => {
    setEditingRecord(rec);
    setForm({
      name: rec.name || '',
      driveId: rec.driveId || '',
      size: rec.size || '',
      path: rec.path || '',
      status: rec.status || 'raw',
      tags: (rec.tags || []).join(', '),
      notes: rec.notes || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('⚠️ Please enter a file/folder name');
      return;
    }
    if (!form.driveId) {
      showToast('⚠️ Please select a target disk');
      return;
    }

    setSaving(true);
    const selectedDrive = drives.find(d => d.id === form.driveId);
    const driveName = selectedDrive ? selectedDrive.name : 'Unknown Disk';

    const tagsArray = form.tags
      ? form.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    const payload = {
      name: form.name.trim(),
      driveId: form.driveId,
      driveName,
      size: form.size.trim(),
      path: form.path.trim(),
      status: form.status,
      tags: tagsArray,
      notes: form.notes.trim(),
    };

    try {
      if (editingRecord) {
        await updateDoc(doc(db, 'fileRecords', editingRecord.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        showToast('✅ File record updated');
      } else {
        await addDoc(collection(db, 'fileRecords'), {
          ...payload,
          uid: user.uid,
          createdAt: serverTimestamp(),
        });
        showToast('✅ File record registered');
      }
      setModalOpen(false);
      loadRecords();
    } catch (err) {
      showToast('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDoc(doc(db, 'fileRecords', deleteTarget.id));
      showToast('🗑️ Record deleted');
      setDeleteTarget(null);
      loadRecords();
    } catch (e) {
      showToast('Delete failed: ' + e.message);
    }
  };

  const filteredRecords = records.filter(r => {
    const matchSearch =
      !search ||
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.path?.toLowerCase().includes(search.toLowerCase()) ||
      r.driveName?.toLowerCase().includes(search.toLowerCase());

    const matchDrive = filterDrive === 'ALL' || r.driveId === filterDrive;
    const matchStatus = filterStatus === 'ALL' || r.status === filterStatus;

    return matchSearch && matchDrive && matchStatus;
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>📂 Managed File & Folder Records</h2>
          <p className={styles.sub}>Index specific project folders, footage exports, or master outputs back to their physical disks.</p>
        </div>
        <button className={styles.addBtn} onClick={openAdd}>
          <Plus size={14} /> Add File Record
        </button>
      </div>

      {/* Filters bar */}
      <div className={styles.filtersBar}>
        <div className={styles.searchBox}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search files, paths, disks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select value={filterDrive} onChange={e => setFilterDrive(e.target.value)} className={styles.select}>
          <option value="ALL">All Disks</option>
          {drives.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={styles.select}>
          <option value="ALL">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Grid / List */}
      {loading ? (
        <div className={styles.loading}>Loading records...</div>
      ) : filteredRecords.length === 0 ? (
        <div className={styles.emptyState}>
          <Database size={32} className={styles.emptyIcon} />
          <strong>No file records found</strong>
          <span>Log folder paths and assign them to SSDs/HDDs for quick discovery.</span>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>File / Folder Name</th>
                <th>Target Disk</th>
                <th>Size / Details</th>
                <th>Status</th>
                <th>Path Location</th>
                <th>Tags</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map(rec => (
                <tr key={rec.id}>
                  <td>
                    <div className={styles.fileName}>{rec.name}</div>
                    {rec.notes && <div className={styles.fileNotes} title={rec.notes}>{rec.notes}</div>}
                  </td>
                  <td>
                    <span className={styles.diskBadge}>
                      <Database size={11} /> {rec.driveName}
                    </span>
                  </td>
                  <td><span className={styles.sizeText}>{rec.size || '—'}</span></td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles['status_' + rec.status]}`}>
                      {STATUS_LABELS[rec.status] || rec.status}
                    </span>
                  </td>
                  <td>
                    <span className={styles.pathText} title={rec.path}>
                      {rec.path || '—'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.tagsContainer}>
                      {(rec.tags || []).map(t => (
                        <span key={t} className={styles.tagBadge}>
                          <Tag size={9} /> {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button onClick={() => openEdit(rec)} className={styles.actionBtn} title="Edit">
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => setDeleteTarget(rec)} className={`${styles.actionBtn} ${styles.delete}`} title="Delete">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal Dialog */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>{editingRecord ? 'Edit File Record' : 'Register File Record'}</h3>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label>File or Folder Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Project_Handoff_V2"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Assign to Storage Disk</label>
                  <select
                    value={form.driveId}
                    onChange={e => setForm(f => ({ ...f, driveId: e.target.value }))}
                  >
                    <option value="" disabled>Select disk...</option>
                    {drives.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.type})</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Size / File Details</label>
                  <input
                    type="text"
                    placeholder="e.g. 420 GB"
                    value={form.size}
                    onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
                  />
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  >
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Tags (comma separated)</label>
                  <input
                    type="text"
                    placeholder="RAW, archive, final"
                    value={form.tags}
                    onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label>File Directory / Path (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. /Backup/Projects/Handoff"
                  value={form.path}
                  onChange={e => setForm(f => ({ ...f, path: e.target.value }))}
                />
              </div>

              <div className={styles.field}>
                <label>Description & Notes</label>
                <textarea
                  placeholder="Additional context or contents logs..."
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div className={styles.modalBtns}>
                <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn} disabled={saving}>
                  {saving ? 'Saving...' : editingRecord ? 'Save Changes' : 'Register Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        icon={<Trash2 size={18} color="#dc2626" />}
        iconBg="#fef2f2"
        title="Delete File Record?"
        message={`"${deleteTarget?.name}" index will be permanently removed. This does not delete any files on the physical disk.`}
        confirmLabel="Delete Index"
        confirmDanger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
