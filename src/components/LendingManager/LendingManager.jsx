import { User, Calendar, FileText, ArrowRightLeft } from 'lucide-react';
import { useStore } from '../../store/useStore';
import styles from './LendingManager.module.css';

export default function LendingManager({ onUpdateDrive, showToast }) {
  const { drives } = useStore();
  
  // Filter drives that are checked out
  const lentDrives = drives.filter(d => d.lending && d.lending.isLent);

  const handleReturn = async (drive) => {
    try {
      await onUpdateDrive(drive.id, {
        lending: { isLent: false, lentTo: '', lentDate: '', returnDate: '', notes: '' }
      });
      showToast(`Drive returned: ${drive.name}`);
    } catch (e) {
      showToast('Error returning drive: ' + e.message);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>👥 Lending & Check-out Registry</h2>
        <p className={styles.sub}>Track which storage drives are loaned out to team members, editors, or assistants.</p>
      </div>

      {lentDrives.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <ArrowRightLeft size={36} color="#aaa" />
          </div>
          <strong>No checked-out drives</strong>
          <span>All registered SSDs and HDDs are safely logged in the archives.</span>
        </div>
      ) : (
        <div className={styles.list}>
          {lentDrives.map(drive => {
            const lend = drive.lending;
            const isOverdue = lend.returnDate && new Date(lend.returnDate) < new Date();
            
            return (
              <div key={drive.id} className={`${styles.row} ${isOverdue ? styles.overdueRow : ''}`}>
                <div className={styles.driveCol}>
                  <div className={styles.driveName}>{drive.name}</div>
                  <div className={styles.driveMeta}>{drive.type} · {drive.location || 'No Location'}</div>
                </div>

                <div className={styles.detailCol}>
                  <div className={styles.metaRow}>
                    <User size={13} className={styles.icon} />
                    <span><strong>Lent to:</strong> {lend.lentTo}</span>
                  </div>
                  <div className={styles.metaRow}>
                    <Calendar size={13} className={styles.icon} />
                    <span><strong>Checkout Date:</strong> {lend.lentDate}</span>
                  </div>
                  {lend.returnDate && (
                    <div className={styles.metaRow}>
                      <Calendar size={13} className={styles.icon} />
                      <span className={isOverdue ? styles.overdueText : ''}>
                        <strong>Due Date:</strong> {lend.returnDate} {isOverdue && '(Overdue)'}
                      </span>
                    </div>
                  )}
                </div>

                {lend.notes && (
                  <div className={styles.notesCol}>
                    <FileText size={13} className={styles.icon} />
                    <p>{lend.notes}</p>
                  </div>
                )}

                <div className={styles.actionCol}>
                  <button className={styles.returnBtn} onClick={() => handleReturn(drive)}>
                    Check In
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
