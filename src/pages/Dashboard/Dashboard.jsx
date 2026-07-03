import { useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, where, orderBy, serverTimestamp
} from 'firebase/firestore';
import { Plus, Search, Menu, X, AlertTriangle } from 'lucide-react';

import { auth, db } from '../../firebase';
import { useStore } from '../../store/useStore';
import Sidebar from '../../components/Sidebar/Sidebar';
import DriveCard from '../../components/DriveCard/DriveCard';
import DriveModal from '../../components/DriveModal/DriveModal';
import ShootDayForm from '../../components/ShootDayForm/ShootDayForm';
import Dialog from '../../components/Dialog/Dialog';
import Toast from '../../components/Toast/Toast';
import styles from './Dashboard.module.css';

// ── helpers ──────────────────────────────────────────────────────
function fmtGB(gb) {
  if (gb >= 1000) return parseFloat((gb / 1000).toFixed(2)) + ' TB';
  return parseFloat(gb.toFixed(2)) + ' GB';
}
function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function streak(logs) {
  if (!logs.length) return 0;
  const days = new Set(logs.map(l => {
    const d = l.cleanedAt?.toDate ? l.cleanedAt.toDate() : new Date();
    return d.toDateString();
  }));
  let count = 0;
  const d = new Date();
  while (days.has(d.toDateString())) { count++; d.setDate(d.getDate() - 1); }
  return count;
}

const FOLDERS = ['_ACTIVE', '_ARCHIVE', '_INBOX', '_PERSONAL'];
const FOLDER_COLORS = { _ACTIVE: '#2563eb', _ARCHIVE: '#8b5cf6', _INBOX: '#f59e0b', _PERSONAL: '#10b981' };

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, setUser, drives, setDrives, cleanupLogs, setCleanupLogs, showToast } = useStore();

  const [view, setView] = useState('dashboard'); // 'dashboard'|'folder'|'danger'|'cleanup'|'shoot-day'
  const [activeFolder, setActiveFolder] = useState(null);
  const [driveFilter, setDriveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modals / dialogs
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDrive, setEditingDrive] = useState(null);
  const [viewingDrive, setViewingDrive] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Auth guard ────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { navigate('/', { replace: true }); return; }
      setUser(u);
    });
    return unsub;
  }, [navigate, setUser]);

  // ── Data loading ─────────────────────────────────────────────
  const loadDrives = useCallback(async () => {
    if (!user) return;
    const snap = await getDocs(query(
      collection(db, 'drives'),
      where('uid', '==', user.uid)
    ));
    setDrives(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, [user, setDrives]);

  const loadLogs = useCallback(async () => {
    if (!user) return;
    try {
      const snap = await getDocs(query(
        collection(db, 'cleanupLogs'),
        where('uid', '==', user.uid),
        orderBy('cleanedAt', 'desc')
      ));
      setCleanupLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      const snap = await getDocs(query(collection(db, 'cleanupLogs'), where('uid', '==', user.uid)));
      setCleanupLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
  }, [user, setCleanupLogs]);

  useEffect(() => {
    if (user) { loadDrives(); loadLogs(); }
  }, [user, loadDrives, loadLogs]);

  // ── Derived stats ─────────────────────────────────────────────
  const totalCap  = drives.reduce((s, d) => s + (Number(d.capacity) || 0), 0);
  const totalUsed = drives.reduce((s, d) => s + (Number(d.used) || 0), 0);
  const freedGB   = cleanupLogs.reduce((s, l) => s + (Number(l.freedGB) || 0), 0);
  const dangerDrives = drives.filter(d => (Number(d.fillPct) || 0) >= 90);
  const todayDrive   = drives.find(d => d.isToday);
  const streakCount  = streak(cleanupLogs);

  // ── Drive CRUD ────────────────────────────────────────────────
  const openAdd  = () => { setEditingDrive(null); setModalOpen(true); };
  const openEdit = (d) => { setEditingDrive(d); setModalOpen(true); };

  const saveDrive = async (formData) => {
    try {
      if (editingDrive?.id) {
        await updateDoc(doc(db, 'drives', editingDrive.id), formData);
        showToast('✅ Drive updated');
      } else {
        await addDoc(collection(db, 'drives'), { ...formData, uid: user.uid, createdAt: serverTimestamp() });
        showToast('✅ Drive added');
      }
      await loadDrives();
      setModalOpen(false);
    } catch (e) { showToast('Error: ' + e.message); }
  };

  const deleteDrive = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDoc(doc(db, 'drives', deleteTarget.id));
      showToast('Drive deleted');
      setDeleteTarget(null);
      await loadDrives();
    } catch (e) { showToast('Error: ' + e.message); }
  };

  const markToday = async (drive) => {
    try {
      // Toggle — unmark all first, then mark this one if not already today
      const promises = drives.map(d =>
        updateDoc(doc(db, 'drives', d.id), { isToday: d.id === drive.id ? !drive.isToday : false })
      );
      await Promise.all(promises);
      await loadDrives();
      showToast(drive.isToday ? 'Unmarked as Today' : `✅ ${drive.name} marked as Today`);
    } catch (e) { showToast('Error: ' + e.message); }
  };

  const moveFolder = async (drive, folder) => {
    try {
      await updateDoc(doc(db, 'drives', drive.id), { folder });
      showToast(`Moved to ${folder}`);
      await loadDrives();
    } catch (e) { showToast('Error: ' + e.message); }
  };

  // ── Navigate between views ────────────────────────────────────
  const goToView = (v, folder = null) => {
    setView(v);
    setActiveFolder(folder);
    setSidebarOpen(false);
  };

  // ── Filtered drives ───────────────────────────────────────────
  const filteredDrives = drives.filter(d => {
    const matchSearch = !searchQuery || d.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType   = driveFilter === 'ALL' || d.type === driveFilter;
    const matchFolder = view === 'folder' ? d.folder === activeFolder
                      : view === 'danger'  ? (Number(d.fillPct) || 0) >= 90
                      : true;
    return matchSearch && matchType && matchFolder;
  });

  // ── Render ────────────────────────────────────────────────────
  const displayName = user?.displayName?.split(' ')[0] || 'there';

  return (
    <div className={styles.layout}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`${styles.sidebarWrap} ${sidebarOpen ? styles.sidebarMobileOpen : ''}`}>
        <Sidebar
          onNavigate={goToView}
          activeView={view}
          activeFolder={activeFolder}
        />
      </div>

      {/* Main */}
      <main className={styles.main}>
        {/* Shoot Day panel overlay */}
        {view === 'shoot-day' && (
          <div className={styles.fullPanel}>
            <ShootDayForm onBack={() => goToView('dashboard')} />
          </div>
        )}

        {view !== 'shoot-day' && (
          <>
            {/* Topbar */}
            <div className={styles.topbar}>
              <div className={styles.topLeft}>
                <button
                  className={styles.hamburger}
                  onClick={() => setSidebarOpen(v => !v)}
                  aria-label="Toggle sidebar"
                >
                  <Menu size={18} />
                </button>
                <div className={styles.searchBox}>
                  <Search size={14} color="#bbb" />
                  <input
                    type="text"
                    placeholder="Search drives…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.topRight}>
                {dangerDrives.length > 0 && (
                  <div className={styles.warnBadge} onClick={() => goToView('danger')}>
                    <span className={styles.blinkWarn} />
                    {dangerDrives.length} drive{dangerDrives.length > 1 ? 's' : ''} critical
                  </div>
                )}
                <button className={styles.addBtn} onClick={openAdd}>
                  <Plus size={15} /> Add Drive
                </button>
              </div>
            </div>

            <div className={styles.content}>
              {/* ── DASHBOARD VIEW ── */}
              {(view === 'dashboard' || view === 'folder' || view === 'danger' || view === 'cleanup') && (
                <>
                  {/* Welcome */}
                  {view === 'dashboard' && (
                    <div className={styles.welcome}>
                      <h1>Good to see you, {displayName} 👋</h1>
                      <p>Here's an overview of your storage ecosystem.</p>
                    </div>
                  )}
                  {view === 'folder' && (
                    <div className={styles.welcome}>
                      <h1>{activeFolder}</h1>
                      <p>{filteredDrives.length} drive{filteredDrives.length !== 1 ? 's' : ''} in this folder</p>
                    </div>
                  )}
                  {view === 'danger' && (
                    <div className={styles.welcome}>
                      <h1>⚠️ Danger Zone</h1>
                      <p>Drives at 90%+ capacity — take action before they fill up.</p>
                    </div>
                  )}
                  {view === 'cleanup' && (
                    <div className={styles.welcome}>
                      <h1>Cleanup Log</h1>
                      <p>{cleanupLogs.length} cleanup entries recorded</p>
                    </div>
                  )}

                  {/* Stats row */}
                  {view === 'dashboard' && (
                    <div className={styles.statsRow}>
                      {[
                        { label: 'Total HDDs', val: drives.filter(d => d.type === 'HDD').length, sub: 'registered drives', cls: styles.cHdd },
                        { label: 'Total SSDs',  val: drives.filter(d => d.type === 'SSD').length, sub: 'registered drives', cls: styles.cSsd },
                        { label: 'Danger Drives', val: dangerDrives.length, sub: '90%+ filled', cls: styles.cDanger },
                        { label: 'Space Freed',   val: freedGB > 0 ? fmtGB(freedGB) : '0 GB', sub: 'via cleanup logs', cls: styles.cFreed },
                      ].map(({ label, val, sub, cls }) => (
                        <div key={label} className={`${styles.statCard} ${cls}`}>
                          <div className={styles.statLabel}>{label}</div>
                          <div className={styles.statValue}>{val}</div>
                          <div className={styles.statSub}>{sub}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Main grid */}
                  <div className={styles.mainGrid}>
                    {/* Left: drives */}
                    <div>
                      {view === 'dashboard' && (
                        <div className={styles.sectionHeader}>
                          <span className={styles.sectionTitle}>Drive Registry</span>
                          <div className={styles.filterTabs}>
                            {['ALL', 'HDD', 'SSD'].map(f => (
                              <button
                                key={f}
                                className={`${styles.filterTab} ${driveFilter === f ? styles.filterActive : ''}`}
                                onClick={() => setDriveFilter(f)}
                              >{f}</button>
                            ))}
                          </div>
                        </div>
                      )}

                      {view === 'cleanup' ? (
                        /* Cleanup log full list */
                        <div className={styles.cleanupFull}>
                          {cleanupLogs.length === 0 ? (
                            <div className={styles.emptyState}>
                              <div className={styles.bigIcon}>🗂️</div>
                              <strong>No cleanup logs yet</strong>
                              <span>Logs are created when you mark drive cleanups in drive details.</span>
                            </div>
                          ) : cleanupLogs.map(log => (
                            <div key={log.id} className={styles.logRow}>
                              <div className={styles.logIcon}>
                                {log.type === 'freed' ? '🟢' : log.type === 'moved' ? '🔵' : '🔷'}
                              </div>
                              <div className={styles.logBody}>
                                <div className={styles.logDrive}>{log.driveName || '—'}</div>
                                <div className={styles.logDetail}>{log.detail || '—'}</div>
                              </div>
                              <div className={styles.logDate}>{fmtDate(log.cleanedAt)}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        /* Drive cards grid */
                        <div className={styles.drivesGrid}>
                          {filteredDrives.length === 0 ? (
                            <div className={styles.emptyState}>
                              <div className={styles.bigIcon}>💾</div>
                              <strong>No drives found</strong>
                              <span>
                                {searchQuery ? 'Try a different search.' : 'Add your first drive to get started.'}
                              </span>
                              {!searchQuery && (
                                <button className={styles.emptyBtn} onClick={openAdd}>
                                  <Plus size={13} /> Add Drive
                                </button>
                              )}
                            </div>
                          ) : filteredDrives.map(drive => (
                            <DriveCard
                              key={drive.id}
                              drive={drive}
                              searchQuery={searchQuery}
                              onOpen={setViewingDrive}
                              onEdit={openEdit}
                              onDelete={setDeleteTarget}
                              onMarkToday={markToday}
                              onMoveFolder={moveFolder}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right column */}
                    {(view === 'dashboard') && (
                      <div className={styles.rightCol}>
                        {/* Streak card */}
                        <div className={styles.streakCard}>
                          <div className={styles.streakLeft}>
                            <div className={styles.streakFire}>🔥</div>
                            <div>
                              <div className={styles.streakTitle}>Cleanup Streak</div>
                              <div className={styles.streakSub}>Days of consecutive cleanup activity</div>
                            </div>
                          </div>
                          <div className={styles.streakNum}>{streakCount}</div>
                        </div>

                        {/* Today's drive */}
                        <div className={styles.todayCard}>
                          <div className={styles.todayTag}>
                            <span className={styles.blinkDot} /> Today's Drive
                          </div>
                          {todayDrive ? (
                            <>
                              <div className={styles.todayName}>{todayDrive.name}</div>
                              <div className={styles.todayMeta}>{todayDrive.type} · {todayDrive.folder}</div>
                              <div className={styles.todayProgRow}>
                                <span>Usage</span>
                                <span>{todayDrive.fillPct || 0}%</span>
                              </div>
                              <div className={styles.todayBar}>
                                <div
                                  className={styles.todayFill}
                                  style={{ width: `${todayDrive.fillPct || 0}%` }}
                                />
                              </div>
                              <div className={styles.todayActions}>
                                <button className={`${styles.todayBtn} ${styles.todayPrimary}`} onClick={() => openEdit(todayDrive)}>Edit</button>
                                <button className={`${styles.todayBtn} ${styles.todaySecondary}`} onClick={() => markToday(todayDrive)}>Unmark</button>
                              </div>
                            </>
                          ) : (
                            <div className={styles.todayEmpty}>
                              No drive marked for today.<br/>
                              <span>Use the ⋯ menu on any drive card.</span>
                            </div>
                          )}
                        </div>

                        {/* Cleanup log preview */}
                        <div className={styles.cleanupBox}>
                          <div className={styles.cleanupHeader}>
                            <span className={styles.cleanupTitle}>Cleanup Log</span>
                            <span className={styles.cleanupCount}>{cleanupLogs.length}</span>
                          </div>
                          {cleanupLogs.length === 0 ? (
                            <div className={styles.logEmpty}>No entries yet.</div>
                          ) : cleanupLogs.slice(0, 4).map(log => (
                            <div key={log.id} className={styles.logEntry}>
                              <div className={styles.logIconSm}>
                                {log.type === 'freed' ? '🟢' : log.type === 'moved' ? '🔵' : '🔷'}
                              </div>
                              <div className={styles.logBodySm}>
                                <div className={styles.logDriveSm}>{log.driveName || '—'}</div>
                                <div className={styles.logDetailSm}>{log.detail || '—'}</div>
                              </div>
                              <div className={styles.logDateSm}>{fmtDate(log.cleanedAt)}</div>
                            </div>
                          ))}
                          {cleanupLogs.length > 4 && (
                            <button className={styles.seeAllBtn} onClick={() => goToView('cleanup')}>
                              See all {cleanupLogs.length} entries →
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </main>

      {/* Drive detail modal (view) */}
      {viewingDrive && (
        <div className={styles.detailOverlay} onClick={() => setViewingDrive(null)}>
          <div className={styles.detailModal} onClick={e => e.stopPropagation()}>
            <div className={styles.detailHeader}>
              <div>
                <h2 className={styles.detailTitle}>{viewingDrive.name}</h2>
                <p className={styles.detailSub}>{viewingDrive.type} · {viewingDrive.folder}</p>
              </div>
              <button className={styles.closeBtn} onClick={() => setViewingDrive(null)}><X size={18} /></button>
            </div>
            <div className={styles.detailGrid}>
              {[
                ['Capacity', viewingDrive.capacity ? fmtGB(viewingDrive.capacity) : '—'],
                ['Used', viewingDrive.used ? fmtGB(viewingDrive.used) : '—'],
                ['Fill', `${viewingDrive.fillPct || 0}%`],
                ['Location', viewingDrive.location || '—'],
              ].map(([label, val]) => (
                <div key={label} className={styles.detailItem}>
                  <div className={styles.detailItemLabel}>{label}</div>
                  <div className={styles.detailItemVal}>{val}</div>
                </div>
              ))}
            </div>
            {viewingDrive.notes && (
              <div className={styles.detailNotes}>
                <div className={styles.detailItemLabel}>Notes</div>
                <p>{viewingDrive.notes}</p>
              </div>
            )}
            <div className={styles.detailActions}>
              <button className={styles.detailEdit} onClick={() => { openEdit(viewingDrive); setViewingDrive(null); }}>
                Edit Drive
              </button>
              <button className={styles.detailDelete} onClick={() => { setDeleteTarget(viewingDrive); setViewingDrive(null); }}>
                <AlertTriangle size={13} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      <DriveModal
        open={modalOpen}
        drive={editingDrive}
        onClose={() => setModalOpen(false)}
        onSave={saveDrive}
      />

      {/* Delete confirm */}
      <Dialog
        open={!!deleteTarget}
        icon={<AlertTriangle size={18} color="#dc2626" />}
        iconBg="#fef2f2"
        title="Delete Drive?"
        message={`"${deleteTarget?.name}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        confirmDanger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteDrive}
      />

      <Toast />
    </div>
  );
}
