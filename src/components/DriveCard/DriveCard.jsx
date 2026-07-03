import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Pencil, FolderOpen, Star, Trash2 } from 'lucide-react';
import styles from './DriveCard.module.css';

const FOLDERS = ['_ACTIVE', '_ARCHIVE', '_INBOX', '_PERSONAL'];

export default function DriveCard({ drive, onOpen, onEdit, onDelete, onMarkToday, onMoveFolder, searchQuery }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const menuRef = useRef(null);

  const pct = Number(drive.fillPct) || 0;
  const isDanger  = pct >= 90;
  const isWarn    = pct >= 75 && pct < 90;
  const isToday   = !!drive.isToday;

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
        setShowMove(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fillClass = isDanger ? styles.fillDanger : isWarn ? styles.fillWarn : styles.fillSafe;

  const highlight = (text) => {
    if (!searchQuery || !text) return text;
    const parts = String(text).split(new RegExp(`(${searchQuery})`, 'gi'));
    return parts.map((p, i) =>
      p.toLowerCase() === searchQuery.toLowerCase()
        ? <mark key={i} className="sh">{p}</mark>
        : p
    );
  };

  return (
    <div
      className={`${styles.card} ${isDanger ? styles.danger : ''} ${isToday ? styles.today : ''}`}
      onClick={() => onOpen(drive)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpen(drive)}
    >
      {/* Top row */}
      <div className={styles.top}>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${drive.type === 'SSD' ? styles.badgeSsd : styles.badgeHdd}`}>
            {drive.type || 'HDD'}
          </span>
          {isToday && <span className={`${styles.badge} ${styles.badgeToday}`}>Today</span>}
          {drive.lending?.isLent && (
            <span className={`${styles.badge} ${styles.badgeLent}`} title={`Lent to ${drive.lending.lentTo}`}>
              Lent
            </span>
          )}
        </div>

        {/* Menu */}
        <div className={styles.menuWrap} ref={menuRef}>
          <button
            className={styles.menuBtn}
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); setShowMove(false); }}
            aria-label="Drive options"
          >
            <MoreHorizontal size={16} />
          </button>

          {menuOpen && (
            <div className={styles.dropdown} onClick={e => e.stopPropagation()}>
              <button className={styles.ddItem} onClick={() => { onEdit(drive); setMenuOpen(false); }}>
                <Pencil size={13} /> Edit drive
              </button>
              <button
                className={styles.ddItem}
                onClick={() => { onMarkToday(drive); setMenuOpen(false); }}
              >
                <Star size={13} /> {isToday ? 'Unmark Today' : 'Mark as Today'}
              </button>
              <div className={styles.ddDivider} />
              <button
                className={`${styles.ddItem} ${styles.ddDanger}`}
                onClick={() => { onDelete(drive); setMenuOpen(false); }}
              >
                <Trash2 size={13} /> Delete drive
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Drive icon */}
      <div className={styles.iconWrap}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" color={isDanger ? '#dc2626' : '#888'}>
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <circle cx="18" cy="12" r="1"/>
          <line x1="4" y1="9" x2="14" y2="9"/>
          <line x1="4" y1="12" x2="11" y2="12"/>
        </svg>
      </div>

      {/* Name & location */}
      <div className={styles.name}>{highlight(drive.name)}</div>
      <div className={styles.loc}>{drive.location || '—'}</div>

      {/* Fill bar */}
      <div className={styles.barBg}>
        <div className={`${styles.bar} ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.fillNums}>
        <span className={`${styles.fillPct} ${isDanger ? styles.pctDanger : isWarn ? styles.pctWarn : ''}`}>
          {pct}%
        </span>
        <span>
          {drive.used ? `${drive.used} GB / ${drive.capacity} GB` : `${drive.capacity || 0} GB`}
        </span>
      </div>
    </div>
  );
}
