import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, AlertTriangle, Trash2, Camera,
  Folder, LogOut
} from 'lucide-react';
import { auth } from '../../firebase';
import { useStore } from '../../store/useStore';
import Dialog from '../Dialog/Dialog';
import stashqblack from '../../assets/stashqblack.png';
import styles from './Sidebar.module.css';

function fmtGB(gb) {
  if (gb >= 1000) return parseFloat((gb / 1000).toFixed(2)) + ' TB';
  return parseFloat(gb.toFixed(2)) + ' GB';
}

export default function Sidebar({ onNavigate, activeView, activeFolder }) {
  const { user, drives } = useStore();
  const navigate = useNavigate();
  const [showSignOut, setShowSignOut] = useState(false);

  const total = drives.reduce((s, d) => s + (Number(d.capacity) || 0), 0);
  const used  = drives.reduce((s, d) => s + (Number(d.used) || 0), 0);
  const free  = total - used;
  const pct   = total > 0 ? Math.round((used / total) * 100) : 0;
  const isCritical = pct >= 90;

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const initials = displayName.charAt(0).toUpperCase();

  const nav = (view, folder) => onNavigate?.(view, folder);

  const NavItem = ({ view, folder, icon: Icon, label }) => {
    const isActive = activeView === view && activeFolder === (folder ?? null);
    return (
      <button
        className={`${styles.navItem} ${isActive ? styles.active : ''}`}
        onClick={() => nav(view, folder)}
      >
        <Icon size={16} />
        {label}
      </button>
    );
  };

  const confirmSignOut = async () => {
    await signOut(auth);
    navigate('/', { replace: true });
  };

  return (
    <>
      <aside className={styles.sidebar}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logoMark}>
            <img src={stashqblack} alt="stashQ" className={styles.logoImg} />
          </div>

          <div className={styles.userCard}>
            <div className={styles.avatar}>
              {user?.photoURL
                ? <img src={user.photoURL} alt="avatar" />
                : initials
              }
            </div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{displayName}</div>
              <div className={styles.userEmail}>{user?.email}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem view="danger"    icon={AlertTriangle}   label="Danger Zone" />
          <NavItem view="cleanup"   icon={Trash2}          label="Cleanup Log" />

          <div className={styles.navLabel}>Tools</div>
          <NavItem view="shoot-day" icon={Camera} label="Shoot Day" />
        </nav>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.storageSummary}>
            <div className={styles.storageRow}>
              <span>Total storage</span>
              <span>{total ? fmtGB(total) : '—'}</span>
            </div>
            <div className={styles.barBg}>
              <div
                className={`${styles.barFill} ${isCritical ? styles.barDanger : ''}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className={styles.storageRow}>
              <span>{used ? fmtGB(used) + ' used' : '—'}</span>
              <span>{free ? fmtGB(free) + ' free' : '—'}</span>
            </div>
            {isCritical && (
              <div className={styles.warnRow}>
                <span className={styles.blinkWarn} />
                <span className={styles.warnTxt}>Storage critical — {pct}% used</span>
              </div>
            )}
          </div>

          <button className={styles.signOut} onClick={() => setShowSignOut(true)}>
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      <Dialog
        open={showSignOut}
        icon={<LogOut size={18} color="#555" />}
        iconBg="#f5f5f5"
        title="Sign out?"
        message="You'll need to sign back in with Google to access your drives."
        cancelLabel="Cancel"
        confirmLabel="Sign out"
        onCancel={() => setShowSignOut(false)}
        onConfirm={confirmSignOut}
      />
    </>
  );
}
