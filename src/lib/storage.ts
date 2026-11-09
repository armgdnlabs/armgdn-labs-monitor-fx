/** localStorage that never throws (private mode, quota, blocked site data). */
export const safeStorage = {
  getItem: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* quota or private mode */ } },
  removeItem: (k: string) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
