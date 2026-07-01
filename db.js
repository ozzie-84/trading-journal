/* ============ שכבת נתונים (localStorage) ============ */
const DB = (() => {
  const KEYS = {
    entries: 'tj_entries_v1',
    trades: 'tj_trades_v1',
    strategies: 'tj_strategies_v1',
    settings: 'tj_settings_v1'
  };

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('DB read error', key, e);
      return fallback;
    }
  }
  function write(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  /* ---------- Settings ---------- */
  const defaultSettings = {
    theme: 'light',
    currency: '₪',
    dateFormat: 'dd/mm/yyyy'
  };
  function getSettings() {
    return Object.assign({}, defaultSettings, read(KEYS.settings, {}));
  }
  function saveSettings(s) {
    write(KEYS.settings, Object.assign({}, getSettings(), s));
  }

  /* ---------- Daily entries (portfolio value log) ---------- */
  function getEntries() {
    return read(KEYS.entries, []).sort((a, b) => a.date.localeCompare(b.date));
  }
  function getEntryByDate(date) {
    return getEntries().find(e => e.date === date);
  }
  function upsertEntry(entry) {
    const list = read(KEYS.entries, []);
    const idx = list.findIndex(e => e.date === entry.date);
    if (idx >= 0) {
      entry.id = list[idx].id;
      list[idx] = entry;
    } else {
      entry.id = entry.id || uid();
      list.push(entry);
    }
    write(KEYS.entries, list);
    return entry;
  }
  function deleteEntry(id) {
    const list = read(KEYS.entries, []).filter(e => e.id !== id);
    write(KEYS.entries, list);
  }

  /* ---------- Trades ---------- */
  function getTrades() {
    return read(KEYS.trades, []);
  }
  function upsertTrade(trade) {
    const list = read(KEYS.trades, []);
    const idx = list.findIndex(t => t.id === trade.id);
    if (idx >= 0) {
      list[idx] = trade;
    } else {
      trade.id = trade.id || uid();
      list.push(trade);
    }
    write(KEYS.trades, list);
    return trade;
  }
  function deleteTrade(id) {
    write(KEYS.trades, read(KEYS.trades, []).filter(t => t.id !== id));
  }

  /* ---------- Strategies ---------- */
  function getStrategies() {
    return read(KEYS.strategies, []);
  }
  function addStrategy(name) {
    name = (name || '').trim();
    if (!name) return;
    const list = read(KEYS.strategies, []);
    if (!list.includes(name)) {
      list.push(name);
      write(KEYS.strategies, list);
    }
    return name;
  }
  function renameStrategy(oldName, newName) {
    newName = (newName || '').trim();
    if (!newName) return;
    const list = read(KEYS.strategies, []).map(s => s === oldName ? newName : s);
    write(KEYS.strategies, list);
    const trades = read(KEYS.trades, []).map(t => t.strategy === oldName ? Object.assign({}, t, { strategy: newName }) : t);
    write(KEYS.trades, trades);
  }
  function deleteStrategy(name) {
    write(KEYS.strategies, read(KEYS.strategies, []).filter(s => s !== name));
  }

  /* ---------- Derived / computed helpers ---------- */
  function getTotals() {
    const entries = getEntries();
    const totalDeposits = entries.reduce((s, e) => s + (Number(e.deposits) || 0), 0);
    const totalWithdrawals = entries.reduce((s, e) => s + (Number(e.withdrawals) || 0), 0);
    const last = entries[entries.length - 1];
    const prev = entries.length > 1 ? entries[entries.length - 2] : null;
    const lastValue = last ? Number(last.value) : 0;
    const dailyChange = last && prev ? lastValue - Number(prev.value) : 0;
    const dailyChangePct = last && prev && Number(prev.value) !== 0 ? (dailyChange / Number(prev.value)) * 100 : 0;
    // Real P&L = current value - net deposits (deposits - withdrawals), assuming starting value 0 baseline captured by first entry's own deposit
    const netFlow = totalDeposits - totalWithdrawals;
    const realPnl = lastValue - netFlow;
    return {
      lastValue,
      lastDate: last ? last.date : null,
      dailyChange,
      dailyChangePct,
      totalDeposits,
      totalWithdrawals,
      realPnl,
      tradesCount: getTrades().length
    };
  }

  /* ---------- Backup / Restore ---------- */
  function exportBackup() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: read(KEYS.entries, []),
      trades: read(KEYS.trades, []),
      strategies: read(KEYS.strategies, []),
      settings: getSettings()
    };
  }
  function restoreBackup(data) {
    if (!data || typeof data !== 'object') throw new Error('קובץ גיבוי לא תקין');
    if (Array.isArray(data.entries)) write(KEYS.entries, data.entries);
    if (Array.isArray(data.trades)) write(KEYS.trades, data.trades);
    if (Array.isArray(data.strategies)) write(KEYS.strategies, data.strategies);
    if (data.settings) write(KEYS.settings, data.settings);
  }
  function clearAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  }

  return {
    uid, getSettings, saveSettings,
    getEntries, getEntryByDate, upsertEntry, deleteEntry,
    getTrades, upsertTrade, deleteTrade,
    getStrategies, addStrategy, renameStrategy, deleteStrategy,
    getTotals, exportBackup, restoreBackup, clearAll
  };
})();
