import { useState, useEffect } from 'react';
import { X, Calendar, User, FileText, Printer, Check, ArrowRightLeft, FolderOpen, Tag, Trash2, CheckCircle2, ChevronRight } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
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

    const node = { name: trimmed, children: [], id: Math.random().toString(36).substr(2, 9), path: trimmed };

    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    if (stack.length > 0) {
      const parent = stack[stack.length - 1].node;
      node.path = parent.path + '/' + trimmed;
      parent.children.push(node);
    } else {
      result.push(node);
    }

    stack.push({ depth, node });
  }

  return result;
}

// Collapsible tree node component
function TreeNode({ node, onSelectNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const isFolder = node.children && node.children.length > 0;

  return (
    <div className={styles.treeNode}>
      <div
        className={`${styles.nodeHeader} ${styles.clickableNode}`}
        onClick={() => onSelectNode(node)}
      >
        {isFolder ? (
          <span 
            className={styles.folderToggle} 
            onClick={(e) => { 
              e.stopPropagation(); 
              setCollapsed(!collapsed); 
            }}
          >
            {collapsed ? '▶' : '▼'}
          </span>
        ) : (
          <span className={styles.leafBullet}>•</span>
        )}
        <span className={isFolder ? styles.folderName : styles.fileName}>{node.name}</span>
      </div>
      {isFolder && !collapsed && (
        <div className={styles.nodeChildren}>
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} onSelectNode={onSelectNode} />
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

  // File/Folder metadata states
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeStatus, setNodeStatus] = useState('Raw');
  const [nodeSize, setNodeSize] = useState('');
  const [nodeNotes, setNodeNotes] = useState('');
  const [nodeTags, setNodeTags] = useState('');

  // Space cleanup form states
  const [cleanupGB, setCleanupGB] = useState('');
  const [cleanupDesc, setCleanupDesc] = useState('');
  const [isLoggingCleanup, setIsLoggingCleanup] = useState(false);

  const handleLogCleanup = async (e) => {
    e.preventDefault();
    const gbVal = parseFloat(cleanupGB);
    if (isNaN(gbVal) || gbVal <= 0) {
      showToast('⚠️ Enter a valid positive number for GB');
      return;
    }
    if (!cleanupDesc.trim()) {
      showToast('⚠️ Please describe what was cleaned up');
      return;
    }
    if (gbVal > (drive.used || 0)) {
      showToast('⚠️ Freed space cannot exceed currently used space!');
      return;
    }

    setIsLoggingCleanup(true);
    try {
      const remainingUsed = parseFloat(Math.max(0, (drive.used || 0) - gbVal).toFixed(2));
      const fillPct = drive.capacity > 0 ? Math.round((remainingUsed / drive.capacity) * 100) : 0;

      // 1. Log to firestore collection
      await addDoc(collection(db, 'cleanupLogs'), {
        uid: drive.uid,
        driveId: drive.id,
        driveName: drive.name,
        type: 'freed',
        freedGB: gbVal,
        detail: cleanupDesc.trim(),
        cleanedAt: serverTimestamp(),
      });

      // 2. Update drive space
      await onUpdateDrive(drive.id, {
        used: remainingUsed,
        fillPct,
      });

      showToast(`✅ Logged: Freed ${fmtGB(gbVal)} on ${drive.name}`);
      setCleanupGB('');
      setCleanupDesc('');
    } catch (err) {
      showToast('Error logging cleanup: ' + err.message);
    } finally {
      setIsLoggingCleanup(false);
    }
  };

  useEffect(() => {
    if (selectedNode && drive?.fileMetadata?.[selectedNode.path]) {
      const meta = drive.fileMetadata[selectedNode.path];
      setNodeStatus(meta.status || 'Raw');
      setNodeSize(meta.size || '');
      setNodeNotes(meta.notes || '');
      setNodeTags((meta.tags || []).join(', '));
    } else {
      setNodeStatus('Raw');
      setNodeSize('');
      setNodeNotes('');
      setNodeTags('');
    }
  }, [selectedNode, drive]);

  const handleSaveNodeMetadata = async (e) => {
    e?.preventDefault();
    if (!selectedNode) return;
    const pathKey = selectedNode.path;
    const currentMetadata = drive.fileMetadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      [pathKey]: {
        status: nodeStatus,
        size: nodeSize,
        notes: nodeNotes,
        tags: nodeTags.split(',').map(t => t.trim()).filter(Boolean),
      }
    };
    try {
      await onUpdateDrive(drive.id, { fileMetadata: updatedMetadata });
      showToast(`Metadata saved for ${selectedNode.name}`);
      setSelectedNode(null);
    } catch (err) {
      showToast('Error saving file metadata: ' + err.message);
    }
  };

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

              {/* Log Space Recovery Section */}
              <div className={styles.cleanupLogFormBox}>
                <div className={styles.itemLabel}>Log Space Recovery (Cleanup)</div>
                <form onSubmit={handleLogCleanup} className={styles.inlineCleanupForm}>
                  <div className={styles.inlineCleanupField}>
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      required
                      placeholder="Freed space (GB)"
                      className={styles.inlineInput}
                      value={cleanupGB}
                      onChange={e => setCleanupGB(e.target.value)}
                    />
                  </div>
                  <div className={styles.inlineCleanupField} style={{ flex: 2 }}>
                    <input
                      type="text"
                      required
                      placeholder="Description (e.g. Cleared raw duplicates)"
                      className={styles.inlineInput}
                      value={cleanupDesc}
                      onChange={e => setCleanupDesc(e.target.value)}
                    />
                  </div>
                  <button type="submit" className={styles.cleanupFormSubmit} disabled={isLoggingCleanup}>
                    {isLoggingCleanup ? 'Logging...' : 'Log'}
                  </button>
                </form>
              </div>
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
                        <TreeNode key={node.id} node={node} onSelectNode={setSelectedNode} />
                      ))}
                    </div>
                  )}
                </div>

                {selectedNode && (
                  <div className={styles.metadataSidebar}>
                    <div className={styles.sidebarHeader}>
                      <div>
                        <h4 className={styles.sidebarTitle}>File Details</h4>
                        <span className={styles.pathBreadcrumb} title={selectedNode.path}>
                          {selectedNode.path}
                        </span>
                      </div>
                      <button className={styles.sidebarClose} onClick={() => setSelectedNode(null)} aria-label="Close sidebar">&times;</button>
                    </div>

                    <form onSubmit={handleSaveNodeMetadata} className={styles.sidebarForm}>
                      <div className={styles.field}>
                        <label>Status</label>
                        <select value={nodeStatus} onChange={e => setNodeStatus(e.target.value)}>
                          <option>Raw</option>
                          <option>Editing</option>
                          <option>Delivered</option>
                          <option>Archived</option>
                        </select>
                      </div>

                      <div className={styles.field}>
                        <label>Custom Size / Details</label>
                        <input
                          type="text"
                          value={nodeSize}
                          onChange={e => setNodeSize(e.target.value)}
                          placeholder="e.g. 450 GB, 120 files"
                        />
                      </div>

                      <div className={styles.field}>
                        <label>Tags (comma separated)</label>
                        <input
                          type="text"
                          value={nodeTags}
                          onChange={e => setNodeTags(e.target.value)}
                          placeholder="wedding, raw, edits"
                        />
                      </div>

                      <div className={styles.field}>
                        <label>Notes / Details</label>
                        <textarea
                          value={nodeNotes}
                          onChange={e => setNodeNotes(e.target.value)}
                          placeholder="Add comments or instructions specific to this folder..."
                          rows={4}
                        />
                      </div>

                      <div className={styles.sidebarActions}>
                        <button type="button" className={styles.sidebarCancel} onClick={() => setSelectedNode(null)}>
                          Cancel
                        </button>
                        <button type="submit" className={styles.sidebarSave}>
                          Save
                        </button>
                      </div>
                    </form>
                  </div>
                )}
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
