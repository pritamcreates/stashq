import { useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import styles from './Toast.module.css';

export default function Toast() {
  const { toast } = useStore();
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.classList.remove(styles.show);
    if (toast) {
      void ref.current.offsetWidth; // force reflow
      ref.current.classList.add(styles.show);
    }
  }, [toast]);

  return (
    <div className={styles.toast} ref={ref}>
      <span className={styles.dot} />
      <span>{toast?.message}</span>
    </div>
  );
}
