import styles from './Dialog.module.css';

/**
 * Generic confirm dialog.
 *
 * Props:
 *   open        boolean
 *   icon        ReactNode
 *   iconBg      string  (CSS color for the icon background)
 *   title       string
 *   message     string | ReactNode
 *   cancelLabel string  (default "Cancel")
 *   confirmLabel string (default "Confirm")
 *   confirmDanger boolean  (red confirm button)
 *   onCancel    () => void
 *   onConfirm   () => void
 */
export default function Dialog({
  open,
  icon,
  iconBg = '#f5f5f5',
  title,
  message,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  confirmDanger = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.backdrop} />
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        {icon && (
          <div className={styles.iconWrap} style={{ background: iconBg }}>
            {icon}
          </div>
        )}
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        <div className={styles.btns}>
          <button className={styles.cancel} onClick={onCancel}>{cancelLabel}</button>
          <button
            className={`${styles.confirm} ${confirmDanger ? styles.danger : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
