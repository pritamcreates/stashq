import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './FileCabinet.module.css';

const LABELS = ['INBOX', 'ACTIVE', 'ARCHIVE', 'PERSONAL', 'REVIEW', 'DONE'];
const GAP = 36;
const CYCLE_MS = 2200;

const INITIAL_DRIVES = [
  { num: '01', title: 'WD_Black_4TB',      right: 'HDD · 92%', label: 'INBOX' },
  { num: '02', title: 'Samsung_T7_1TB',    right: 'SSD · 45%', label: 'ACTIVE' },
  { num: '03', title: 'Seagate_8TB',       right: 'HDD · 67%', label: 'ARCHIVE' },
  { num: '04', title: 'Crucial_MX500',     right: 'SSD · 38%', label: 'ACTIVE' },
  { num: '05', title: 'WD_Elements_2T',    right: 'HDD · 81%', label: 'INBOX' },
  { num: '06', title: 'SanDisk_Ext_1T',   right: 'SSD · 54%', label: 'PERSONAL' },
  { num: '07', title: 'Seagate_Backup_2T', right: 'HDD · 29%', label: 'ARCHIVE' },
];

export default function FileCabinet() {
  const [drives, setDrives] = useState(() =>
    INITIAL_DRIVES.map(d => ({ ...d, history: [] }))
  );
  const [topIdx, setTopIdx] = useState(0);
  const [openDd, setOpenDd] = useState(null); // index or null
  const [renaming, setRenaming] = useState(null); // { idx, value }
  const timerRef = useRef(null);
  const ddPortalRef = useRef(null);

  const cycle = useCallback(() => {
    setTopIdx(i => (i + 1) % INITIAL_DRIVES.length);
  }, []);

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(cycle, CYCLE_MS);
  }, [cycle]);

  useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [startTimer]);

  const handleCardClick = (e) => {
    if (e.target.closest('[data-action]')) return;
    clearInterval(timerRef.current);
    cycle();
    startTimer();
  };

  const setLabel = (driveIdx, label) => {
    setDrives(prev => prev.map((d, i) => i === driveIdx ? { ...d, label } : d));
    setOpenDd(null);
  };

  const doRename = () => {
    if (!renaming || !renaming.value.trim()) { setRenaming(null); return; }
    const newName = renaming.value.trim();
    setDrives(prev => prev.map((d, i) => {
      if (i !== renaming.idx) return d;
      return { ...d, title: newName, history: [...d.history, { name: d.title, ts: Date.now() }] };
    }));
    setRenaming(null);
  };

  const top = drives[topIdx];

  return (
    <div className={styles.root}>
      {/* Grid overlay */}
      <div className={styles.grid} />
      <div className={styles.lines} />

      {/* Animated card stack */}
      <div className={styles.stackWrap}>
        <div className={styles.cabinet} style={{ height: 280 }} onClick={handleCardClick}>
          {/* Center label */}
          <div className={styles.centerLabel}>
            <div className={styles.centerTitle}>{top.title}</div>
            <div className={styles.centerSub}>{top.right} · {top.label}</div>
          </div>

          {/* Cards */}
          {drives.map((drive, i) => {
            const offset = (i - topIdx + drives.length) % drives.length;
            const y = offset * GAP;
            const opacity = offset > 4 ? 0 : 1 - offset * 0.13;
            const isTop = offset === 0;

            return (
              <div
                key={i}
                className={`${styles.card} ${isTop ? styles.topCard : ''}`}
                style={{
                  transform: `translateY(${y}px)`,
                  opacity,
                  pointerEvents: offset <= 4 ? 'auto' : 'none',
                  transition: 'transform .5s cubic-bezier(.25,.46,.45,.94), opacity .4s ease, background .3s, border-color .3s',
                }}
              >
                {/* Label tab */}
                <button
                  className={styles.tab}
                  data-action="tab"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenDd(openDd === i ? null : i);
                  }}
                >
                  {drive.label}
                </button>

                {/* Label dropdown */}
                {openDd === i && (
                  <div className={styles.dropdown} onClick={e => e.stopPropagation()}>
                    {LABELS.map(lbl => (
                      <button
                        key={lbl}
                        className={`${styles.ddItem} ${drive.label === lbl ? styles.ddActive : ''}`}
                        data-action="label"
                        onClick={() => setLabel(i, lbl)}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                )}

                <div className={styles.cardLeft}>
                  <span className={styles.cardNum}>{drive.num}</span>
                  {renaming?.idx === i ? (
                    <input
                      className={styles.renameInput}
                      value={renaming.value}
                      data-action="rename-input"
                      autoFocus
                      onChange={e => setRenaming({ ...renaming, value: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') doRename(); if (e.key === 'Escape') setRenaming(null); }}
                      onBlur={doRename}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className={styles.cardTitle}>{drive.title}</span>
                  )}
                </div>

                <div className={styles.cardRight}>
                  <span className={styles.cardMeta}>{drive.right}</span>
                  <button
                    className={styles.editBtn}
                    data-action="edit"
                    title="Rename drive"
                    onClick={e => {
                      e.stopPropagation();
                      setRenaming({ idx: i, value: drive.title });
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                      <path d="M11.5 1.5a2.121 2.121 0 0 1 3 3L5 14H2v-3L11.5 1.5z"
                        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Tray */}
          <div className={styles.tray} />
        </div>
      </div>

      {/* Close dropdown when clicking outside */}
      {openDd !== null && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1 }}
          onClick={() => setOpenDd(null)}
        />
      )}
    </div>
  );
}
