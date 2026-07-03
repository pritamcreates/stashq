import { useState, useEffect } from 'react';
import { X, Calendar, User, FileText, Printer, Check, ArrowRightLeft, FolderOpen, Tag } from 'lucide-react';
import styles from './DriveDetailModal.module.css';

function fmtGB(gb) {
  if (gb >= 1000) return parseFloat((gb / 1000).toFixed(2)) + ' TB';
  return parseFloat(gb.toFixed(2)) + ' GB';
}

function getCostPerTB(price, capacity) {
  if (!price || !capacity) return '—';
  const tb = capacity / 1000;
  if (tb <= 0) return '—';
  return `$${(price / tb).toFixed(2)} / TB`;
}

// Simple parser for copy-pasted folder listings (e.g., indented folder names)
function parseTree(text) {
  if (!text || !text.trim()) return [];
  const lines = text.split('\n');
  const result = [];
  const stack = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Calculate indentation depth
    const indentMatch = line.match(/^(\s*)/);
    const depth = indentMatch ? indentMatch[1].length : 0;

    const node = { name: trimmed, children: [], id: Math.random().toString(36).substr(2, 9) };

    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    if (stack.length > 0) {
      stack[stack.length - 1].node.children.push(node);
    } else {
      result.push(node);
    }

    stack.push({ depth, node });
  }

  return result;
}

// Collapsible tree node component
function TreeNode({ node }) {
  const [collapsed, setCollapsed] = useState(false);
  const isFolder = node.children && node.children.length > 0;

  return (
    <div className={styles.treeNode}>
      <div
        className={`${styles.nodeHeader} ${isFolder ? styles.clickableNode : ''}`}
        onClick={() => isFolder && setCollapsed(!collapsed)}
      >
        {isFolder ? (
          <span className={styles.folderToggle}>{collapsed ? '▶' : '▼'}</span>
        ) : (
          <span className={styles.leafBullet}>•</span>
        )}
        <span className={isFolder ? styles.folderName : styles.fileName}>{node.name}</span>
      </div>
      {isFolder && !collapsed && (
        <div className={styles.nodeChildren}>
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DriveDetailModal({ drive, onClose, onEdit, onDelete, onUpdateDrive, showToast }) {
  const [tab, setTab] = useState('overview'); // 'overview' | 'lending' | 'explorer' | 'qr'
  const [borrower, setBorrower] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [lendNotes, setLendNotes] = useState('');
  const [treeInput, setTreeInput] = useState('');
  const [isSavingTree, setIsSavingTree] = useState(false);

  const lending = drive?.lending || { isLent: false, lentTo: '', lentDate: '', returnDate: '', notes: '' };

  useEffect(() => {
    if (drive) {
      setTreeInput(drive.dirTreeText || '');
    }
  }, [drive]);

  if (!drive) return null;

  // Checkout drive
  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!borrower.trim()) return;

    const newLending = {
      isLent: true,
      lentTo: borrower,
      lentDate: new Date().toISOString().split('T')[0],
      returnDate: returnDate || '',
      notes: lendNotes,
    };

    try {
      await onUpdateDrive(drive.id, { lending: newLending });
      showToast(`Drive lent to ${borrower}`);
      setBorrower('');
      setReturnDate('');
      setLendNotes('');
    } catch (err) {
      showToast('Error checking out: ' + err.message);
    }
  };

  // Check in drive
  const handleCheckin = async () => {
    try {
      await onUpdateDrive(drive.id, { lending: { isLent: false, lentTo: '', lentDate: '', returnDate: '', notes: '' } });
      showToast('Drive checked in / returned');
    } catch (err) {
      showToast('Error checking in: ' + err.message);
    }
  };

  // Save folder list tree
  const handleSaveTree = async () => {
    setIsSavingTree(true);
    try {
      await onUpdateDrive(drive.id, { dirTreeText: treeInput });
      showToast('Folder listing updated successfully');
    } catch (err) {
      showToast('Error saving folder listing: ' + err.message);
    } finally {
      setIsSavingTree(false);
    }
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  const parsedNodes = parseTree(drive.dirTreeText || '');

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.title}>{drive.name}</h2>
            <p className={styles.sub}>{drive.type} · {drive.folder || 'Registry'}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Tab Headers */}
        <div className={styles.tabs}>
          {[
            { id: 'overview', label: 'Overview', icon: FileText },
            { id: 'lending', label: 'Lending', icon: ArrowRightLeft },
            { id: 'explorer', label: 'File Explorer', icon: FolderOpen },
            { id: 'qr', label: 'QR Label', icon: Tag },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`${styles.tabBtn} ${tab === t.id ? styles.tabActive : ''}`}
                onClick={() => setTab(t.id)}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          
          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className={styles.overview}>
              <div className={styles.grid}>
                <div className={styles.detailItem}>
                  <div className={styles.itemLabel}>Capacity</div>
                  <div className={styles.itemVal}>{drive.capacity ? fmtGB(drive.capacity) : '—'}</div>
                </div>
                <div className={styles.detailItem}>
                  <div className={styles.itemLabel}>Used Space</div>
                  <div className={styles.itemVal}>{drive.used ? fmtGB(drive.used) : '—'}</div>
                </div>
                <div className={styles.detailItem}>
                  <div className={styles.itemLabel}>Fill %</div>
                  <div className={styles.itemVal}>{drive.fillPct || 0}%</div>
                </div>
                <div className={styles.detailItem}>
                  <div className={styles.itemLabel}>Location</div>
                  <div className={styles.itemVal}>{drive.location || '—'}</div>
                </div>
                <div className={styles.detailItem}>
                  <div className={styles.itemLabel}>Price</div>
                  <div className={styles.itemVal}>{drive.price ? `$${drive.price.toFixed(2)}` : '—'}</div>
                </div>
                <div className={styles.detailItem}>
                  <div className={styles.itemLabel}>Cost Per TB</div>
                  <div className={styles.itemVal}>{getCostPerTB(drive.price, drive.capacity)}</div>
                </div>
              </div>

              {drive.notes && (
                <div className={styles.notesSection}>
                  <div className={styles.itemLabel}>Notes</div>
                  <p className={styles.notesText}>{drive.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* LENDING */}
          {tab === 'lending' && (
            <div className={styles.lending}>
              {lending.isLent ? (
                <div className={styles.lendingStatusCard}>
                  <div className={styles.lendingHeader}>
                    <span className={styles.statusBadge}>Checked Out</span>
                    <button className={styles.returnBtn} onClick={handleCheckin}>
                      Check In / Returned
                    </button>
                  </div>
                  <div className={styles.lendingDetails}>
                    <div className={styles.lendRow}>
                      <User size={15} />
                      <span><strong>Borrowed by:</strong> {lending.lentTo}</span>
                    </div>
                    <div className={styles.lendRow}>
                      <Calendar size={15} />
                      <span><strong>Date lent:</strong> {lending.lentDate}</span>
                    </div>
                    {lending.returnDate && (
                      <div className={styles.lendRow}>
                        <Calendar size={15} />
                        <span><strong>Expected return:</strong> {lending.returnDate}</span>
                      </div>
                    )}
                    {lending.notes && (
                      <div className={styles.lendNotesField}>
                        <strong>Handover Notes:</strong>
                        <p>{lending.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCheckout} className={styles.lendForm}>
                  <div className={styles.field}>
                    <label>Borrower Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe (Assistant)"
                      value={borrower}
                      onChange={e => setBorrower(e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label>Return Date (Optional)</label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={e => setReturnDate(e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label>Lending Notes</label>
                    <textarea
                      placeholder="Special instructions or reason for check-out..."
                      rows={3}
                      value={lendNotes}
                      onChange={e => setLendNotes(e.target.value)}
                    />
                  </div>
                  <button type="submit" className={styles.checkoutBtn}>
                    Check Out Drive
                  </button>
                </form>
              )}
            </div>
          )}

          {/* FILE EXPLORER */}
          {tab === 'explorer' && (
            <div className={styles.explorer}>
              <div className={styles.explorerIntro}>
                <p>Paste your drive's directory structure below to keep a searchable offline file index.</p>
                <small>Tip: Run <code>tree /f</code> (Windows) or <code>find .</code> (Mac) and copy the result here.</small>
              </div>

              <div className={styles.explorerSplit}>
                <div className={styles.inputArea}>
                  <label className={styles.itemLabel}>Paste Folder List</label>
                  <textarea
                    value={treeInput}
                    onChange={e => setTreeInput(e.target.value)}
                    placeholder="Example:&#10;Photos/&#10;  Sharma_Wedding/&#10;    Raw/&#10;    Edits/&#10;Videos/"
                    rows={10}
                  />
                  <button
                    className={styles.saveTreeBtn}
                    onClick={handleSaveTree}
                    disabled={isSavingTree}
                  >
                    {isSavingTree ? 'Saving Tree...' : 'Save Folder List'}
                  </button>
                </div>

                <div className={styles.treeArea}>
                  <label className={styles.itemLabel}>Interactive Tree Preview</label>
                  {parsedNodes.length === 0 ? (
                    <div className={styles.emptyTree}>No folder tree saved yet.</div>
                  ) : (
                    <div className={styles.treeContainer}>
                      {parsedNodes.map(node => (
                        <TreeNode key={node.id} node={node} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* QR LABEL */}
          {tab === 'qr' && (
            <div className={styles.qrLabelSection}>
              <div id="printable-label" className={styles.labelCard}>
                <div className={styles.labelHeader}>
                  <img src="/stashqblack.png" alt="stashQ" className={styles.labelLogo} />
                  <div className={styles.labelTitle}>DRIVE LOG</div>
                </div>

                <div className={styles.labelContent}>
                  <div className={styles.labelText}>
                    <div className={styles.labelName}>{drive.name}</div>
                    <div className={styles.labelInfo}>
                      <span><strong>Type:</strong> {drive.type}</span>
                      <span><strong>Cap:</strong> {drive.capacity ? fmtGB(drive.capacity) : '—'}</span>
                    </div>
                    {drive.location && (
                      <div className={styles.labelLocation}>
                        <strong>Loc:</strong> {drive.location}
                      </div>
                    )}
                  </div>
                  <div className={styles.labelQrCode}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://pritamcreates.github.io/stashq/%23/dashboard?id=${drive.id}`}
                      alt="Drive QR Link"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.qrActions}>
                <button className={styles.printBtn} onClick={handlePrint}>
                  <Printer size={15} />
                  Print Label
                </button>
                <p className={styles.printTip}>
                  Click "Print Label" to print this sticker using standard label printers.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className={styles.detailActions}>
          <button className={styles.detailEdit} onClick={() => { onEdit(drive); onClose(); }}>
            Edit details
          </button>
          <button className={styles.detailDelete} onClick={() => { onDelete(drive); onClose(); }}>
            Delete
          </button>
        </div>

      </div>
    </div>
  );
}
