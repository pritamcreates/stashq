import { useState, useEffect } from 'react';
import { Play, RotateCcw, HelpCircle, HardDrive, Cpu, Zap } from 'lucide-react';
import styles from './DitCalculator.module.css';

const INTERFACES = [
  { name: 'USB 2.0 (HDD/Card)', speed: 40, desc: 'Legacy standard' },
  { name: 'USB 3.0 (External HDD)', speed: 100, desc: 'Standard external hard drives' },
  { name: 'SATA III SSD (SATA USB-C)', speed: 500, desc: 'Average internal/external SSD' },
  { name: 'NVMe USB-C (USB 3.2 Gen 2)', speed: 1050, desc: 'Fast external SSDs (SanDisk Extreme)' },
  { name: 'Thunderbolt 3 / 4 SSD', speed: 2800, desc: 'High-end PCIe NVMe arrays (WD_Black)' },
];

export default function DitCalculator() {
  const [size, setSize] = useState('500');
  const [unit, setUnit] = useState('GB'); // 'GB' | 'TB'
  const [speedIndex, setSpeedIndex] = useState(3); // Default: NVMe SSD
  const [simulate, setSimulate] = useState(false);
  const [progress, setProgress] = useState(0);

  const selectedSpeed = INTERFACES[speedIndex];
  
  // Total size in Gigabytes
  const totalGB = parseFloat(size) * (unit === 'TB' ? 1000 : 1);
  const totalMB = totalGB * 1000;

  // Time in seconds
  const totalSeconds = totalMB / selectedSpeed.speed;

  // Format time helper
  const fmtTime = (sec) => {
    if (isNaN(sec) || sec <= 0) return '0s';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.round(sec % 60);

    const parts = [];
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0) parts.push(`${mins}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  };

  // Run mock copying progress simulation
  useEffect(() => {
    let timer;
    if (simulate) {
      // Calculate a scaled simulation duration (between 1 and 8 seconds) based on totalSeconds
      const simDurationMs = Math.min(Math.max(totalSeconds * 20, 1000), 8000);
      const stepIncrement = 5000 / simDurationMs; // 100% / (simDurationMs / 50ms interval)

      timer = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            setSimulate(false);
            return 100;
          }
          return Math.min(100, p + stepIncrement);
        });
      }, 50);
    }
    return () => clearInterval(timer);
  }, [simulate, totalSeconds]);

  const startSimulation = () => {
    setProgress(0);
    setSimulate(true);
  };

  const resetSimulation = () => {
    setProgress(0);
    setSimulate(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>⚡ DIT Data Copy Calculator</h2>
        <p className={styles.sub}>Estimate data dump transfer times based on data sizes and interface speeds.</p>
      </div>

      <div className={styles.grid}>
        
        {/* Form controls panel */}
        <div className={styles.controlPanel}>
          <div className={styles.field}>
            <label className={styles.label}>Data Size</label>
            <div className={styles.inputGroup}>
              <input
                type="number"
                min="0.1"
                step="any"
                className={styles.sizeInput}
                value={size}
                onChange={e => setSize(e.target.value)}
              />
              <select className={styles.unitSelect} value={unit} onChange={e => setUnit(e.target.value)}>
                <option>GB</option>
                <option>TB</option>
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Connection Casing / Protocol</label>
            <div className={styles.interfacesList}>
              {INTERFACES.map((inf, index) => (
                <button
                  key={inf.name}
                  className={`${styles.infItem} ${speedIndex === index ? styles.infActive : ''}`}
                  onClick={() => { setSpeedIndex(index); resetSimulation(); }}
                >
                  <div className={styles.infHeader}>
                    <span className={styles.infName}>{inf.name}</span>
                    <span className={styles.infSpeed}>{inf.speed} MB/s</span>
                  </div>
                  <span className={styles.infDesc}>{inf.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results summary panel */}
        <div className={styles.resultsPanel}>
          <div className={styles.resultsBox}>
            <div className={styles.statLabel}>Total Data Size</div>
            <div className={styles.statVal}>{size ? `${parseFloat(size)} ${unit}` : '—'}</div>
          </div>

          <div className={styles.resultsBox}>
            <div className={styles.statLabel}>Estimated Duration</div>
            <div className={styles.timeVal}>{size ? fmtTime(totalSeconds) : '—'}</div>
            <small className={styles.approxNote}>*Speeds may vary based on file sizes & system temperatures.</small>
          </div>

          {/* Simulation View */}
          <div className={styles.simulationSection}>
            <div className={styles.simHeader}>
              <span>Copy Simulation</span>
              <span>{Math.round(progress)}%</span>
            </div>
            
            <div className={styles.barBg}>
              <div className={styles.barFill} style={{ width: `${progress}%` }} />
            </div>

            <div className={styles.simControls}>
              {!simulate && progress < 100 ? (
                <button className={styles.simBtn} onClick={startSimulation} disabled={!size || totalSeconds <= 0}>
                  <Play size={13} />
                  Simulate Copy
                </button>
              ) : (
                <button className={styles.resetBtn} onClick={resetSimulation}>
                  <RotateCcw size={13} />
                  Reset
                </button>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
