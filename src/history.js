export const DEFAULT_HISTORY_LIMIT = 5;
export const MAX_HISTORY_LIMIT = 50;
export function historyLimit(value, fallback = DEFAULT_HISTORY_LIMIT) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_HISTORY_LIMIT ? value : fallback;
}

// Keep full results in memory if browser storage is unavailable or full. The
// caller reports failed persistence; reopening an entry never makes a request.
export function createHistory({ read, write, isValid, limit = DEFAULT_HISTORY_LIMIT }) {
  let cap = historyLimit(limit), entries = [];
  try {
    const saved = read();
    if (Array.isArray(saved)) entries = saved.filter(isValid).slice(0, cap);
  } catch { /* A fresh in-memory history remains usable. */ }
  function persist() {
    try { write(entries); return true; } catch { return false; }
  }
  return {
    list: () => entries.slice(),
    record(item) {
      entries = [item, ...entries.filter(h => h.mode !== item.mode || h.query !== item.query)].slice(0, cap);
      return persist();
    },
    setLimit(value) {
      cap = historyLimit(value, cap);
      entries = entries.slice(0, cap);
      return persist();
    },
  };
}
