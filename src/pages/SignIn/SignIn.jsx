import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, signInWithRedirect, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../../firebase';
import { useStore } from '../../store/useStore';
import stashqblack from '../../assets/stashqblack.png';
import styles from './SignIn.module.css';

export default function SignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setUser = useStore(s => s.setUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { setUser(user); navigate('/dashboard', { replace: true }); }
    });
    return unsub;
  }, [navigate, setUser]);

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      if (err.code === 'auth/popup-blocked') {
        try { await signInWithRedirect(auth, googleProvider); }
        catch { setError('Pop-up blocked. Please allow pop-ups for this site.'); setLoading(false); }
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setError('Sign-in cancelled.');
        setLoading(false);
      } else {
        setError('Sign-in failed: ' + (err.message || err.code));
        setLoading(false);
      }
    }
  };

  return (
    <div className={styles.page}>
      {/* ── GRID BACKGROUND ── */}
      <div className={styles.gridBg} />

      {/* ── FLOATING ACCENTS ── */}
      <div className={`${styles.blob} ${styles.blob1}`} />
      <div className={`${styles.blob} ${styles.blob2}`} />
      <div className={`${styles.blob} ${styles.blob3}`} />
      <div className={`${styles.sparkle} ${styles.sparkle1}`}>✦</div>
      <div className={`${styles.sparkle} ${styles.sparkle2}`}>✦</div>
      <div className={`${styles.sparkle} ${styles.sparkle3}`}>✦</div>

      {/* ── LOGO ── */}
      <header className={styles.header}>
        <div className={styles.logoMark}>
          <img src={stashqblack} alt="stashQ" className={styles.logoImg} />
        </div>
        <div className={styles.headerBadge}>
          <span className={styles.badgeDot} />
          <span>Secure · Private · Yours</span>
        </div>
      </header>

      {/* ── MAIN LAYOUT ── */}
      <main className={styles.main}>

        {/* LEFT — Hero */}
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Storage command center</p>
          <h1 className={styles.heading}>
            Your drives.<br />
            Organized.<br />
            <em>Protected.</em>
          </h1>
          <p className={styles.sub}>
            Track every HDD, SSD, and memory card.<br />
            One place. Real-time sync. Zero clutter.
          </p>

          {/* ── 3D STORAGE HARDWARE VISUAL ── */}
          <div className={styles.hardwareWrap}>

            {/* SSD card */}
            <div className={styles.ssdCard}>
              <div className={styles.ssdTop}>
                <div className={styles.ssdLabel}>
                  <span className={styles.ssdBrand}>WD_Black</span>
                  <span className={styles.ssdModel}>SSD 4TB</span>
                </div>
                <div className={styles.ssdLed} />
              </div>
              <div className={styles.ssdBody}>
                <div className={styles.ssdChips}>
                  <div className={styles.chip} />
                  <div className={styles.chip} />
                  <div className={styles.chip} />
                  <div className={styles.chip} />
                </div>
                <div className={styles.ssdConnector}>
                  {[...Array(18)].map((_, i) => (
                    <div key={i} className={styles.connPin} />
                  ))}
                </div>
              </div>
              <div className={styles.ssdShadow} />
            </div>

            {/* Memory card */}
            <div className={styles.sdCard}>
              <div className={styles.sdTop}>
                <div className={styles.sdLabel}>
                  <span className={styles.sdBrand}>SanDisk</span>
                  <span className={styles.sdCap}>256GB</span>
                </div>
                <div className={styles.sdLogo}>SD</div>
              </div>
              <div className={styles.sdContacts}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className={styles.sdPin} />
                ))}
              </div>
              <div className={styles.sdShadow} />
            </div>

            {/* HDD platter */}
            <div className={styles.hddCard}>
              <div className={styles.hddTop}>
                <div className={styles.hddLabel}>
                  <span className={styles.hddBrand}>Seagate</span>
                  <span className={styles.hddModel}>HDD 8TB</span>
                </div>
              </div>
              <div className={styles.hddPlatter}>
                <div className={styles.platterRing} />
                <div className={styles.platterRing2} />
                <div className={styles.platterCenter} />
                <div className={styles.hddArm} />
              </div>
              <div className={styles.hddShadow} />
            </div>

            {/* Annotation arrow */}
            <div className={styles.annotation}>
              <svg width="60" height="40" viewBox="0 0 60 40" fill="none">
                <path d="M4 4 C10 4, 50 4, 56 36" stroke="#999" strokeWidth="1.2" strokeDasharray="3 2" fill="none"/>
                <path d="M50 32 L56 36 L54 28" stroke="#999" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
              </svg>
              <span className={styles.annotationText}>A fresh archive.</span>
            </div>
          </div>

          {/* Stats */}
          <div className={styles.statsRow}>
            {[
              { val: '40+',  label: 'Drives tracked' },
              { val: '∞',    label: 'Cloud synced' },
              { val: '1/day', label: 'Cleanup cadence' },
            ].map(({ val, label }) => (
              <div className={styles.stat} key={label}>
                <div className={styles.statVal}>{val}</div>
                <div className={styles.statLabel}>{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT — Sign in */}
        <section className={styles.panel}>
          <div className={styles.panelCard}>
            <div className={styles.panelTop}>
              <h2 className={styles.panelTitle}>Welcome back.</h2>
              <p className={styles.panelSub}>
                Sign in to access your storage command center.
                New here? Your account is created automatically.
              </p>
            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}

            <button
              className={styles.googleBtn}
              disabled={loading}
              onClick={handleGoogle}
              aria-label="Sign in with Google"
            >
              <span className={styles.googleIconWrap}>
                <svg width="16" height="16" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
              </span>
              {loading ? 'Signing in…' : 'Continue with Google'}
            </button>

            <div className={styles.divider}>
              <span />
              <small>Your data lives only in your account</small>
              <span />
            </div>

            {/* Feature pills */}
            <div className={styles.features}>
              {['Drive Registry', 'Shoot Day Logs', 'Danger Alerts', 'Folder System'].map(f => (
                <div key={f} className={styles.featurePill}>
                  <span className={styles.featureDot} />
                  {f}
                </div>
              ))}
            </div>

            <p className={styles.terms}>
              stashQ keeps your data private — stored only in your Google account.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
