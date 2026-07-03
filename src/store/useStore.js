import { create } from 'zustand';

export const useStore = create((set, get) => ({
  /* ── Auth ── */
  user: null,
  authReady: false,
  setUser: (user) => set({ user, authReady: true }),
  setAuthReady: () => set({ authReady: true }),

  /* ── Drives ── */
  drives: [],
  setDrives: (drives) => set({ drives }),

  /* ── Cleanup logs ── */
  cleanupLogs: [],
  setCleanupLogs: (cleanupLogs) => set({ cleanupLogs }),

  /* ── Toast ── */
  toast: null,
  showToast: (message) => {
    set({ toast: { message, id: Date.now() } });
    setTimeout(() => {
      const current = get().toast;
      if (current && current.message === message) set({ toast: null });
    }, 2800);
  },

  /* ── Active view state ── */
  activeFolder: null,
  setActiveFolder: (folder) => set({ activeFolder: folder }),

  activeView: 'dashboard', // 'dashboard' | 'file-records' | 'danger' | 'cleanup' | 'folder'
  activeViewData: null,
  setActiveView: (view, data = null) => set({ activeView: view, activeViewData: data }),

  /* ── Drive filter ── */
  driveFilter: 'ALL',
  setDriveFilter: (driveFilter) => set({ driveFilter }),

  /* ── Search ── */
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
