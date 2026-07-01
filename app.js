/* ============ אפליקציית יומן מסחר ומעקב תיק השקעות ============ */
'use strict';

/* ---------- Utilities ---------- */
const U = (() => {
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const fmt = DB.getSettings().dateFormat;
    if (fmt === 'mm/dd/yyyy') return `${m}/${d}/${y}`;
    if (fmt === 'yyyy-mm-dd') return `${y}-${m}-${d}`;
    return `${d}/${m}/${y}`;
  }
  function fmtMoney(n) {
    n = Number(n) || 0;
    const cur = DB.getSettings().currency;
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    return sign + cur + abs.toLocaleString('he-IL', { maximumFractionDigits: 0 });
  }
  function fmtMoneySigned(n) {
    n = Number(n) || 0;
    return (n > 0 ? '+' : '') + fmtMoney(n);
  }
  function fmtPct(n, digits) {
    n = Number(n) || 0;
    return (n > 0 ? '+' : '') + n.toFixed(digits == null ? 2 : digits) + '%';
  }
  function num(v) {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }
  function toast(msg) {
    const root = document.getElementById('toastRoot');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }
  function monthLabel(y, m) {
    const names = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
    return names[m] + ' ' + y;
  }
  function ymKey(dateStr) { return dateStr.slice(0, 7); }
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function cutoffDate(period) {
    const d = new Date();
    if (period === '1m') d.setMonth(d.getMonth() - 1);
    else if (period === '3m') d.setMonth(d.getMonth() - 3);
    else if (period === '6m') d.setMonth(d.getMonth() - 6);
    else if (period === '1y') d.setFullYear(d.getFullYear() - 1);
    else return null;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  return { todayStr, fmtDate, fmtMoney, fmtMoneySigned, fmtPct, num, toast, monthLabel, ymKey, daysInMonth, esc, cutoffDate };
})();

/* ---------- Modal helper ---------- */
const Modal = (() => {
  function open(html, onMount) {
    const root = document.getElementById('modalRoot');
    root.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal-sheet">${html}</div></div>`;
    const overlay = document.getElementById('modalOverlay');
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    if (onMount) onMount(root);
  }
  function close() {
    document.getElementById('modalRoot').innerHTML = '';
  }
  function confirm(message, onYes) {
    open(`
      <div class="modal-head"><h2>אישור</h2></div>
      <p style="margin-bottom:18px;">${U.esc(message)}</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="cfNo">ביטול</button>
        <button class="btn btn-danger" id="cfYes">מחיקה</button>
      </div>`, () => {
      document.getElementById('cfNo').onclick = close;
      document.getElementById('cfYes').onclick = () => { close(); onYes(); };
    });
  }
  return { open, close, confirm };
})();

/* ---------- Router ---------- */
const Router = (() => {
  const routes = {};
  function on(name, fn) { routes[name] = fn; }
  function go(name) {
    location.hash = '#/' + name;
  }
  function current() {
    const h = location.hash.replace('#/', '');
    return h || 'home';
  }
  function render() {
    const name = current().split('?')[0];
    document.querySelectorAll('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.route === name));
    const titles = { home: 'יומן מסחר', trades: 'עסקאות', insights: 'תובנות', calendar: 'לוח שנה', settings: 'הגדרות', history: 'היסטוריית שווי' };
    document.getElementById('pageTitle').textContent = titles[name] || 'יומן מסחר';
    const fn = routes[name] || routes.home;
    document.getElementById('screen').innerHTML = '';
    fn();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', render);
  return { on, go, render, current };
})();

/* ============================================================
   HOME SCREEN
============================================================ */
let homePeriod = 'all';
let perfMode = 'value';

function renderHome() {
  const t = DB.getTotals();
  const screen = document.getElementById('screen');
  const changeClass = t.dailyChange > 0 ? 'pos' : (t.dailyChange < 0 ? 'neg' : '');
  const realClass = t.realPnl > 0 ? 'pos' : (t.realPnl < 0 ? 'neg' : '');

  screen.innerHTML = `
    <div class="card">
      <h3>שווי התיק</h3>
      <div class="big-value">${t.lastValue ? U.fmtMoney(t.lastValue) : '—'}</div>
      <div class="sub-value">
        ${t.lastDate ? `עודכן לאחרונה: ${U.fmtDate(t.lastDate)}` : 'אין עדיין נתונים'}
        ${t.lastDate ? `<span class="pill ${changeClass}" style="margin-inline-start:8px;">${U.fmtMoneySigned(t.dailyChange)} (${U.fmtPct(t.dailyChangePct)})</span>` : ''}
      </div>
    </div>

    <div class="grid2">
      <div class="stat-box"><div class="label">סך הפקדות</div><div class="val">${U.fmtMoney(t.totalDeposits)}</div></div>
      <div class="stat-box"><div class="label">סך משיכות</div><div class="val">${U.fmtMoney(t.totalWithdrawals)}</div></div>
      <div class="stat-box"><div class="label">רווח/הפסד אמיתי</div><div class="val ${realClass}">${U.fmtMoneySigned(t.realPnl)}</div></div>
      <div class="stat-box"><div class="label">מס' עסקאות</div><div class="val">${t.tradesCount}</div></div>
    </div>

    <button class="btn btn-primary btn-block" id="dailyUpdateBtn" style="margin:14px 0 4px;">➕ עדכון יומי</button>
    <a href="#/history" style="display:block;text-align:center;font-size:13px;margin-bottom:10px;">צפייה בטבלת היסטוריה מלאה ←</a>

    <div class="section-title">שווי התיק לאורך זמן</div>
    <div class="chip-scroll" id="homePeriodChips">
      ${chipsHtml([['1m','חודש'],['3m','3 חודשים'],['6m','6 חודשים'],['1y','שנה'],['all','הכל']], homePeriod)}
    </div>
    <div class="card" style="height:220px;"><canvas id="homeValueChart"></canvas></div>

    <div class="section-title">ביצועים אמיתיים (מנוטרל הפקדות/משיכות)</div>
    <div class="seg" style="margin-bottom:10px;">
      <button data-mode="value" class="${perfMode==='value'?'active':''}">שווי תיק</button>
      <button data-mode="cum" class="${perfMode==='cum'?'active':''}">רווח מצטבר</button>
      <button data-mode="pct" class="${perfMode==='pct'?'active':''}">תשואה %</button>
    </div>
    <div class="card" style="height:220px;"><canvas id="homePerfChart"></canvas></div>
  `;

  document.getElementById('dailyUpdateBtn').onclick = openDailyUpdateModal;
  screen.querySelectorAll('#homePeriodChips .chip').forEach(c => {
    c.onclick = () => { homePeriod = c.dataset.val; renderHome(); };
  });
  screen.querySelectorAll('.seg button').forEach(b => {
    b.onclick = () => { perfMode = b.dataset.mode; renderHome(); };
  });

  drawHomeValueChart();
  drawHomePerfChart();
}

function chipsHtml(options, active) {
  return options.map(([val, label]) => `<div class="chip ${active===val?'active':''}" data-val="${val}">${label}</div>`).join('');
}

function filteredEntries(period) {
  const entries = DB.getEntries();
  const cutoff = U.cutoffDate(period);
  return cutoff ? entries.filter(e => e.date >= cutoff) : entries;
}

function drawHomeValueChart() {
  const entries = filteredEntries(homePeriod);
  if (!entries.length) { ChartsUI.destroy('homeValueChart'); return; }
  const labels = entries.map(e => U.fmtDate(e.date));
  const c = ChartsUI.themeColors();
  ChartsUI.lineChart('homeValueChart', labels, [{
    label: 'שווי תיק', data: entries.map(e => Number(e.value)),
    borderColor: c.primary, backgroundColor: 'rgba(37,99,235,.12)'
  }], {
    tooltipCallbacks: {
      afterBody: (items) => {
        const e = entries[items[0].dataIndex];
        const idx = items[0].dataIndex;
        const prev = entries[idx - 1];
        const chg = prev ? Number(e.value) - Number(prev.value) : 0;
        const pct = prev && Number(prev.value) ? (chg / Number(prev.value) * 100) : 0;
        return [
          `הפקדות: ${U.fmtMoney(e.deposits)}`,
          `משיכות: ${U.fmtMoney(e.withdrawals)}`,
          `שינוי יומי: ${U.fmtMoneySigned(chg)} (${U.fmtPct(pct)})`
        ];
      }
    }
  });
  document.getElementById('homeValueChart').onclick = (evt) => {
    const chart = Chart.getChart('homeValueChart');
    const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
    if (points.length) openDayDetailModal(entries[points[0].index].date);
  };
}

function computeRealPerformanceSeries(period) {
  const entries = filteredEntries(period);
  let cumDeposits = 0, cumWithdrawals = 0;
  // include flows before the period start for baseline continuity when not 'all'
  if (period !== 'all') {
    const all = DB.getEntries();
    const cutoff = U.cutoffDate(period);
    all.filter(e => e.date < cutoff).forEach(e => { cumDeposits += Number(e.deposits) || 0; cumWithdrawals += Number(e.withdrawals) || 0; });
  }
  const baselineValue = period !== 'all' && entries.length ? null : 0;
  let firstReal = null;
  const out = entries.map(e => {
    cumDeposits += Number(e.deposits) || 0;
    cumWithdrawals += Number(e.withdrawals) || 0;
    const real = Number(e.value) - (cumDeposits - cumWithdrawals);
    if (firstReal === null) firstReal = real;
    return { date: e.date, value: Number(e.value), real, cum: real, pct: firstReal !== 0 ? ((real - firstReal) / Math.abs(firstReal)) * 100 : 0 };
  });
  return out;
}

function drawHomePerfChart() {
  const series = computeRealPerformanceSeries(homePeriod);
  if (!series.length) { ChartsUI.destroy('homePerfChart'); return; }
  const labels = series.map(s => U.fmtDate(s.date));
  const c = ChartsUI.themeColors();
  let data, label, color;
  if (perfMode === 'value') { data = series.map(s => s.value); label = 'שווי תיק'; color = c.primary; }
  else if (perfMode === 'cum') { data = series.map(s => s.real); label = 'רווח מצטבר אמיתי'; color = c.green; }
  else { data = series.map(s => s.pct); label = 'תשואה %'; color = c.green; }
  ChartsUI.lineChart('homePerfChart', labels, [{
    label, data, borderColor: color, backgroundColor: color + '22'
  }]);
}

/* ============================================================
   DAILY UPDATE MODAL
============================================================ */
function openDailyUpdateModal(prefillDate) {
  const date = prefillDate || U.todayStr();
  const existing = DB.getEntryByDate(date);
  renderDailyForm(date, existing);
}

function renderDailyForm(date, existing, forceUpdate) {
  Modal.open(`
    <div class="modal-head"><h2>עדכון יומי</h2><button class="icon-btn" id="mClose">✕</button></div>
    <div class="field"><label>תאריך</label><input type="date" id="fDate" value="${date}"></div>
    <div class="field"><label>שווי התיק</label><input type="number" inputmode="decimal" id="fValue" placeholder="0" value="${existing ? existing.value : ''}"></div>
    <div class="field"><label>הפקדות שבוצעו היום</label><input type="number" inputmode="decimal" id="fDeposit" placeholder="0" value="${existing ? existing.deposits : ''}"></div>
    <div class="field"><label>משיכות שבוצעו היום</label><input type="number" inputmode="decimal" id="fWithdraw" placeholder="0" value="${existing ? existing.withdrawals : ''}"></div>
    <div class="field"><label>הערות (אופציונלי)</label><textarea id="fNotes">${existing && existing.notes ? U.esc(existing.notes) : ''}</textarea></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="mCancel">ביטול</button>
      <button class="btn btn-primary" id="mSave">שמירה</button>
    </div>
  `, () => {
    document.getElementById('mClose').onclick = Modal.close;
    document.getElementById('mCancel').onclick = Modal.close;
    document.getElementById('fDate').onchange = (e) => {
      const nd = e.target.value;
      const ex = DB.getEntryByDate(nd);
      renderDailyForm(nd, ex);
    };
    document.getElementById('mSave').onclick = () => {
      const d = document.getElementById('fDate').value;
      if (!d) { U.toast('נא לבחור תאריך'); return; }
      const dup = DB.getEntryByDate(d);
      if (dup && !forceUpdate) {
        confirmOverwrite(d);
        return;
      }
      saveDailyEntry(d, dup);
    };
  });
}

function confirmOverwrite(date) {
  Modal.open(`
    <div class="modal-head"><h2>קיימת כבר רשומה לתאריך זה</h2></div>
    <p style="margin-bottom:18px;">כבר קיים עדכון עבור ${U.fmtDate(date)}. מה תרצה לעשות?</p>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="ovCancel">ביטול</button>
      <button class="btn btn-primary" id="ovUpdate">עדכן רשומה קיימת</button>
    </div>
  `, () => {
    document.getElementById('ovCancel').onclick = () => renderDailyForm(date, DB.getEntryByDate(date));
    document.getElementById('ovUpdate').onclick = () => saveDailyEntry(date, DB.getEntryByDate(date));
  });
}

function saveDailyEntry(date, existing) {
  const entry = {
    id: existing ? existing.id : undefined,
    date,
    value: U.num(document.getElementById('fValue').value),
    deposits: U.num(document.getElementById('fDeposit').value),
    withdrawals: U.num(document.getElementById('fWithdraw').value),
    notes: document.getElementById('fNotes').value.trim()
  };
  DB.upsertEntry(entry);
  Modal.close();
  U.toast('העדכון נשמר בהצלחה');
  Router.render();
}

/* ============================================================
   DAY DETAIL MODAL (used by calendar + chart click)
============================================================ */
function openDayDetailModal(date) {
  const entry = DB.getEntryByDate(date);
  const trades = DB.getTrades().filter(t => t.closeDate === date || t.openDate === date);
  Modal.open(`
    <div class="modal-head"><h2>${U.fmtDate(date)}</h2><button class="icon-btn" id="mClose">✕</button></div>
    ${entry ? `
      <div class="grid2" style="margin-bottom:14px;">
        <div class="stat-box"><div class="label">שווי תיק</div><div class="val">${U.fmtMoney(entry.value)}</div></div>
        <div class="stat-box"><div class="label">הפקדות</div><div class="val">${U.fmtMoney(entry.deposits)}</div></div>
        <div class="stat-box"><div class="label">משיכות</div><div class="val">${U.fmtMoney(entry.withdrawals)}</div></div>
        <div class="stat-box"><div class="label">הערות</div><div class="val" style="font-size:13px;">${entry.notes ? U.esc(entry.notes) : '—'}</div></div>
      </div>
      <button class="btn btn-secondary btn-block" id="editEntryBtn" style="margin-bottom:14px;">✏️ עריכת רשומה</button>
    ` : '<p style="margin-bottom:14px;color:var(--text-dim);">אין עדכון שווי ליום זה.</p>'}
    ${trades.length ? `<div class="section-title" style="margin-top:0;">עסקאות ביום זה</div>` + trades.map(t => tradeCardHtml(t)).join('') : ''}
    <div class="modal-actions">
      <button class="btn btn-primary btn-block" id="addUpdateBtn">${entry ? 'עדכון נוסף' : '➕ הוסף עדכון ליום זה'}</button>
    </div>
  `, () => {
    document.getElementById('mClose').onclick = Modal.close;
    document.getElementById('addUpdateBtn').onclick = () => openDailyUpdateModal(date);
    const editBtn = document.getElementById('editEntryBtn');
    if (editBtn) editBtn.onclick = () => renderDailyForm(date, entry, true);
  });
}

/* ============================================================
   TRADES SCREEN
============================================================ */
let tradeFilters = { period: 'all', strategy: '', asset: '', result: '', plan: '' };

function tradeCardHtml(t) {
  const pnl = Number(t.pnl) || 0;
  const cls = pnl > 0 ? 'pos' : (pnl < 0 ? 'neg' : '');
  const stars = '★'.repeat(t.rating || 0) + '☆'.repeat(5 - (t.rating || 0));
  return `
    <div class="list-item">
      <div class="top">
        <span style="font-weight:700;">${U.esc(t.asset || '—')}</span>
        <span class="pill ${cls}">${U.fmtMoneySigned(pnl)}</span>
      </div>
      <div class="meta">${U.fmtDate(t.closeDate || t.openDate)} · ${U.esc(t.strategy || 'ללא אסטרטגיה')} ${t.followedPlan === false ? ' · ⚠️ לא לפי תוכנית' : ''}</div>
      ${t.description ? `<div class="meta">${U.esc(t.description)}</div>` : ''}
      <div class="meta" style="color:var(--amber);">${stars}</div>
      <div class="row-actions" style="margin-top:8px;">
        <button class="icon-mini" data-edit="${t.id}">✏️ עריכה</button>
        <button class="icon-mini" data-del="${t.id}">🗑️ מחיקה</button>
      </div>
    </div>`;
}

function getFilteredTrades() {
  let trades = DB.getTrades().slice().sort((a, b) => (b.closeDate || '').localeCompare(a.closeDate || ''));
  const cutoff = U.cutoffDate(tradeFilters.period);
  if (cutoff) trades = trades.filter(t => (t.closeDate || t.openDate) >= cutoff);
  if (tradeFilters.strategy) trades = trades.filter(t => t.strategy === tradeFilters.strategy);
  if (tradeFilters.asset) trades = trades.filter(t => (t.asset || '').toLowerCase().includes(tradeFilters.asset.toLowerCase()));
  if (tradeFilters.result === 'profit') trades = trades.filter(t => Number(t.pnl) > 0);
  if (tradeFilters.result === 'loss') trades = trades.filter(t => Number(t.pnl) < 0);
  if (tradeFilters.plan === 'yes') trades = trades.filter(t => t.followedPlan !== false);
  if (tradeFilters.plan === 'no') trades = trades.filter(t => t.followedPlan === false);
  return trades;
}

function renderTrades() {
  const screen = document.getElementById('screen');
  const strategies = DB.getStrategies();
  const trades = getFilteredTrades();
  const stats = computeTradeStats(trades);

  screen.innerHTML = `
    <button class="btn btn-primary btn-block" id="newTradeBtn" style="margin-bottom:14px;">➕ עסקה חדשה</button>

    <div class="grid2" style="margin-bottom:14px;">
      <div class="stat-box"><div class="label">מס' עסקאות</div><div class="val">${stats.count}</div></div>
      <div class="stat-box"><div class="label">אחוז הצלחה</div><div class="val">${stats.winRate.toFixed(1)}%</div></div>
      <div class="stat-box"><div class="label">רווח נקי</div><div class="val ${stats.net>=0?'pos':'neg'}">${U.fmtMoneySigned(stats.net)}</div></div>
      <div class="stat-box"><div class="label">רווח ממוצע/הפסד ממוצע</div><div class="val" style="font-size:14px;">${U.fmtMoney(stats.avgWin)} / ${U.fmtMoney(stats.avgLoss)}</div></div>
    </div>

    <details style="margin-bottom:12px;">
      <summary style="font-weight:700;cursor:pointer;">🔍 חיפוש וסינון</summary>
      <div style="margin-top:10px;">
        <div class="chip-scroll">${chipsHtml([['all','הכל'],['1m','חודש'],['3m','3 חודשים'],['6m','6 חודשים'],['1y','שנה']], tradeFilters.period)}</div>
        <div class="field"><label>אסטרטגיה</label>
          <select id="fltStrategy"><option value="">כל האסטרטגיות</option>${strategies.map(s => `<option ${tradeFilters.strategy===s?'selected':''} value="${U.esc(s)}">${U.esc(s)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>נכס בסיס</label><input type="text" id="fltAsset" value="${U.esc(tradeFilters.asset)}" placeholder="לדוגמה: AAPL"></div>
        <div class="field"><label>תוצאה</label>
          <select id="fltResult"><option value="">הכל</option><option value="profit" ${tradeFilters.result==='profit'?'selected':''}>רווח בלבד</option><option value="loss" ${tradeFilters.result==='loss'?'selected':''}>הפסד בלבד</option></select>
        </div>
        <div class="field"><label>לפי תוכנית מסחר</label>
          <select id="fltPlan"><option value="">הכל</option><option value="yes" ${tradeFilters.plan==='yes'?'selected':''}>לפי התוכנית</option><option value="no" ${tradeFilters.plan==='no'?'selected':''}>לא לפי התוכנית</option></select>
        </div>
      </div>
    </details>

    <div id="tradesList">
      ${trades.length ? trades.map(tradeCardHtml).join('') : emptyStateHtml('📒', 'אין עדיין עסקאות מתועדות')}
    </div>
  `;

  document.getElementById('newTradeBtn').onclick = () => openTradeModal();
  screen.querySelectorAll('.chip-scroll .chip').forEach(c => c.onclick = () => { tradeFilters.period = c.dataset.val; renderTrades(); });
  const sSel = document.getElementById('fltStrategy'); if (sSel) sSel.onchange = e => { tradeFilters.strategy = e.target.value; renderTrades(); };
  const aInp = document.getElementById('fltAsset'); if (aInp) aInp.oninput = debounce(e => { tradeFilters.asset = e.target.value; renderTrades(); }, 350);
  const rSel = document.getElementById('fltResult'); if (rSel) rSel.onchange = e => { tradeFilters.result = e.target.value; renderTrades(); };
  const pSel = document.getElementById('fltPlan'); if (pSel) pSel.onchange = e => { tradeFilters.plan = e.target.value; renderTrades(); };

  screen.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openTradeModal(DB.getTrades().find(t => t.id === b.dataset.edit)));
  screen.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    Modal.confirm('למחוק את העסקה?', () => { DB.deleteTrade(b.dataset.del); U.toast('העסקה נמחקה'); renderTrades(); });
  });
}

function debounce(fn, ms) {
  let h;
  return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); };
}

function emptyStateHtml(emoji, text) {
  return `<div class="empty-state"><div class="emoji">${emoji}</div><div>${text}</div></div>`;
}

/* ---------- Trade modal ---------- */
function openTradeModal(trade) {
  const strategies = DB.getStrategies();
  const t = trade || { openDate: U.todayStr(), closeDate: U.todayStr(), followedPlan: true, rating: 0 };
  renderTradeForm(t, strategies);
}

function renderTradeForm(t, strategies) {
  Modal.open(`
    <div class="modal-head"><h2>${t.id ? 'עריכת עסקה' : 'עסקה חדשה'}</h2><button class="icon-btn" id="mClose">✕</button></div>
    <div class="field"><label>תאריך פתיחה</label><input type="date" id="tOpen" value="${t.openDate || ''}"></div>
    <div class="field"><label>תאריך סגירה</label><input type="date" id="tClose" value="${t.closeDate || ''}"></div>
    <div class="field"><label>נכס בסיס</label><input type="text" id="tAsset" placeholder="לדוגמה: AAPL, BTC" value="${U.esc(t.asset || '')}"></div>
    <div class="field"><label>אסטרטגיה</label>
      <select id="tStrategySel">
        ${strategies.map(s => `<option value="${U.esc(s)}" ${t.strategy===s?'selected':''}>${U.esc(s)}</option>`).join('')}
        <option value="__new__">➕ אסטרטגיה חדשה...</option>
      </select>
    </div>
    <div class="field" id="tNewStratWrap" style="display:none;"><label>שם אסטרטגיה חדשה</label><input type="text" id="tNewStrat"></div>
    <div class="field"><label>תיאור העסקה</label><textarea id="tDesc">${t.description ? U.esc(t.description) : ''}</textarea></div>
    <div class="field"><label>רווח / הפסד</label><input type="number" inputmode="decimal" id="tPnl" value="${t.pnl != null ? t.pnl : ''}"></div>
    <div class="field"><label>פעלתי לפי תוכנית המסחר?</label>
      <div class="seg"><button type="button" data-val="yes" class="${t.followedPlan!==false?'active':''}" id="planYes">כן</button><button type="button" data-val="no" class="${t.followedPlan===false?'active':''}" id="planNo">לא</button></div>
    </div>
    <div class="field"><label>דירוג עצמי לאיכות הביצוע</label>
      <div class="stars" id="starRow">${[1,2,3,4,5].map(i => `<span class="star ${ (t.rating||0)>=i ? 'on':''}" data-star="${i}">★</span>`).join('')}</div>
    </div>
    <div class="field"><label>הערות</label><textarea id="tNotes">${t.notes ? U.esc(t.notes) : ''}</textarea></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="mCancel">ביטול</button>
      <button class="btn btn-primary" id="mSave">שמירה</button>
    </div>
  `, () => {
    let followed = t.followedPlan !== false;
    let rating = t.rating || 0;
    document.getElementById('mClose').onclick = Modal.close;
    document.getElementById('mCancel').onclick = Modal.close;
    document.getElementById('tStrategySel').onchange = (e) => {
      document.getElementById('tNewStratWrap').style.display = e.target.value === '__new__' ? 'block' : 'none';
    };
    document.getElementById('planYes').onclick = () => { followed = true; document.getElementById('planYes').classList.add('active'); document.getElementById('planNo').classList.remove('active'); };
    document.getElementById('planNo').onclick = () => { followed = false; document.getElementById('planNo').classList.add('active'); document.getElementById('planYes').classList.remove('active'); };
    document.querySelectorAll('#starRow .star').forEach(s => {
      s.onclick = () => {
        rating = Number(s.dataset.star);
        document.querySelectorAll('#starRow .star').forEach(x => x.classList.toggle('on', Number(x.dataset.star) <= rating));
      };
    });
    document.getElementById('mSave').onclick = () => {
      let strategy = document.getElementById('tStrategySel').value;
      if (strategy === '__new__') {
        const newName = document.getElementById('tNewStrat').value.trim();
        if (!newName) { U.toast('נא להזין שם אסטרטגיה'); return; }
        DB.addStrategy(newName);
        strategy = newName;
      }
      const asset = document.getElementById('tAsset').value.trim();
      if (!asset) { U.toast('נא להזין נכס בסיס'); return; }
      const trade = {
        id: t.id,
        openDate: document.getElementById('tOpen').value,
        closeDate: document.getElementById('tClose').value,
        asset,
        strategy,
        description: document.getElementById('tDesc').value.trim(),
        pnl: U.num(document.getElementById('tPnl').value),
        followedPlan: followed,
        rating,
        notes: document.getElementById('tNotes').value.trim()
      };
      DB.upsertTrade(trade);
      Modal.close();
      U.toast('העסקה נשמרה');
      Router.render();
    };
  });
}

/* ---------- Trade stats ---------- */
function computeTradeStats(trades) {
  const wins = trades.filter(t => Number(t.pnl) > 0);
  const losses = trades.filter(t => Number(t.pnl) < 0);
  const grossProfit = wins.reduce((s, t) => s + Number(t.pnl), 0);
  const grossLoss = losses.reduce((s, t) => s + Number(t.pnl), 0);
  const net = grossProfit + grossLoss;
  const best = trades.slice().sort((a,b) => Number(b.pnl)-Number(a.pnl))[0];
  const worst = trades.slice().sort((a,b) => Number(a.pnl)-Number(b.pnl))[0];
  return {
    count: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    grossProfit, grossLoss, net,
    avgWin: wins.length ? grossProfit / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    best, worst
  };
}

function computeStrategyStats() {
  const trades = DB.getTrades();
  const totalNet = trades.reduce((s, t) => s + Number(t.pnl), 0);
  const strategies = DB.getStrategies();
  const usedNames = new Set(trades.map(t => t.strategy).filter(Boolean));
  usedNames.forEach(n => { if (!strategies.includes(n)) strategies.push(n); });
  return strategies.map(name => {
    const list = trades.filter(t => t.strategy === name);
    const s = computeTradeStats(list);
    const followed = list.filter(t => t.followedPlan !== false).length;
    const notFollowed = list.length - followed;
    const avgRating = list.length ? list.reduce((sum, t) => sum + (Number(t.rating) || 0), 0) / list.length : 0;
    const pctOfTotal = totalNet !== 0 ? (s.net / totalNet) * 100 : 0;
    const pf = Math.abs(s.grossLoss) > 0 ? s.grossProfit / Math.abs(s.grossLoss) : (s.grossProfit > 0 ? Infinity : 0);
    return Object.assign({ name, followed, notFollowed, avgRating, pctOfTotal, profitFactor: pf }, s);
  }).sort((a, b) => b.net - a.net);
}

/* ============================================================
   INSIGHTS SCREEN (charts / strategies / reports)
============================================================ */
let insightsTab = 'charts';

function renderInsights() {
  const screen = document.getElementById('screen');
  screen.innerHTML = `
    <div class="tabs2">
      <button data-tab="charts" class="${insightsTab==='charts'?'active':''}">📈 גרפים</button>
      <button data-tab="strategies" class="${insightsTab==='strategies'?'active':''}">🏆 אסטרטגיות</button>
      <button data-tab="reports" class="${insightsTab==='reports'?'active':''}">🧾 דוחות</button>
    </div>
    <div id="insightsBody"></div>
  `;
  screen.querySelectorAll('.tabs2 button').forEach(b => b.onclick = () => { insightsTab = b.dataset.tab; renderInsights(); });
  if (insightsTab === 'charts') renderInsightsCharts();
  else if (insightsTab === 'strategies') renderInsightsStrategies();
  else renderInsightsReports();
}

function renderInsightsCharts() {
  const body = document.getElementById('insightsBody');
  const entries = DB.getEntries();
  const trades = DB.getTrades();
  const stratStats = computeStrategyStats().filter(s => s.count > 0);

  body.innerHTML = `
    <div class="section-title" style="margin-top:0;">התפתחות שווי התיק</div>
    <div class="card" style="height:200px;"><canvas id="chValue"></canvas></div>

    <div class="section-title">רווח מצטבר (אמיתי)</div>
    <div class="card" style="height:200px;"><canvas id="chCum"></canvas></div>

    <div class="section-title">התפלגות עסקאות לפי אסטרטגיה</div>
    <div class="card" style="height:230px;">${stratStats.length ? '<canvas id="chDist"></canvas>' : emptyStateHtml('📊','אין נתונים עדיין')}</div>

    <div class="section-title">אחוז הצלחה לפי אסטרטגיה</div>
    <div class="card" style="height:220px;">${stratStats.length ? '<canvas id="chWinRate"></canvas>' : emptyStateHtml('📊','אין נתונים עדיין')}</div>

    <div class="section-title">רווחים לפי אסטרטגיה</div>
    <div class="card" style="height:220px;">${stratStats.length ? '<canvas id="chProfitByStrat"></canvas>' : emptyStateHtml('📊','אין נתונים עדיין')}</div>

    <div class="section-title">השוואה בין אסטרטגיות</div>
    <div class="card" style="height:230px;">${stratStats.length ? '<canvas id="chCompare"></canvas>' : emptyStateHtml('📊','אין נתונים עדיין')}</div>

    <div class="section-title">מספר עסקאות לכל חודש</div>
    <div class="card" style="height:220px;">${trades.length ? '<canvas id="chTradesMonth"></canvas>' : emptyStateHtml('📊','אין נתונים עדיין')}</div>

    <div class="section-title">רווח חודשי</div>
    <div class="card" style="height:220px;">${trades.length ? '<canvas id="chMonthlyPnl"></canvas>' : emptyStateHtml('📊','אין נתונים עדיין')}</div>

    <div class="section-title">רווח שנתי</div>
    <div class="card" style="height:220px;">${trades.length ? '<canvas id="chYearlyPnl"></canvas>' : emptyStateHtml('📊','אין נתונים עדיין')}</div>
  `;

  if (entries.length) {
    const c = ChartsUI.themeColors();
    ChartsUI.lineChart('chValue', entries.map(e => U.fmtDate(e.date)), [{ label: 'שווי תיק', data: entries.map(e => Number(e.value)), borderColor: c.primary, backgroundColor: 'rgba(37,99,235,.12)' }]);
    const series = computeRealPerformanceSeries('all');
    ChartsUI.lineChart('chCum', series.map(s => U.fmtDate(s.date)), [{ label: 'רווח מצטבר', data: series.map(s => s.real), borderColor: c.green, backgroundColor: c.green + '22' }]);
  } else {
    document.getElementById('chValue') && (document.getElementById('chValue').parentElement.innerHTML = emptyStateHtml('📈','אין נתונים עדיין'));
    document.getElementById('chCum') && (document.getElementById('chCum').parentElement.innerHTML = emptyStateHtml('📈','אין נתונים עדיין'));
  }

  if (stratStats.length) {
    const colors = ChartsUI.palette(stratStats.length);
    ChartsUI.pieChart('chDist', stratStats.map(s => s.name), stratStats.map(s => s.count), colors);
    ChartsUI.barChart('chWinRate', stratStats.map(s => s.name), [{ label: 'אחוז הצלחה', data: stratStats.map(s => s.winRate), backgroundColor: colors }]);
    ChartsUI.barChart('chProfitByStrat', stratStats.map(s => s.name), [{ label: 'רווח נקי', data: stratStats.map(s => s.net), backgroundColor: stratStats.map(s => s.net >= 0 ? ChartsUI.themeColors().green : ChartsUI.themeColors().red) }]);
    ChartsUI.barChart('chCompare', stratStats.map(s => s.name), [
      { label: 'רווח נקי', data: stratStats.map(s => s.net), backgroundColor: ChartsUI.themeColors().primary },
      { label: 'אחוז הצלחה', data: stratStats.map(s => s.winRate), backgroundColor: ChartsUI.themeColors().green }
    ]);
  }

  if (trades.length) {
    const byMonth = groupByMonth(trades);
    const months = Object.keys(byMonth).sort();
    ChartsUI.barChart('chTradesMonth', months.map(m => monthShort(m)), [{ label: 'מס\' עסקאות', data: months.map(m => byMonth[m].length), backgroundColor: ChartsUI.themeColors().primary }]);
    ChartsUI.barChart('chMonthlyPnl', months.map(m => monthShort(m)), [{ label: 'רווח חודשי', data: months.map(m => byMonth[m].reduce((s,t)=>s+Number(t.pnl),0)), backgroundColor: months.map(m => byMonth[m].reduce((s,t)=>s+Number(t.pnl),0) >= 0 ? ChartsUI.themeColors().green : ChartsUI.themeColors().red) }]);

    const byYear = {};
    trades.forEach(t => { const y = (t.closeDate || t.openDate || '').slice(0,4); if (!y) return; byYear[y] = byYear[y] || []; byYear[y].push(t); });
    const years = Object.keys(byYear).sort();
    ChartsUI.barChart('chYearlyPnl', years, [{ label: 'רווח שנתי', data: years.map(y => byYear[y].reduce((s,t)=>s+Number(t.pnl),0)), backgroundColor: years.map(y => byYear[y].reduce((s,t)=>s+Number(t.pnl),0) >= 0 ? ChartsUI.themeColors().green : ChartsUI.themeColors().red) }]);
  }
}

function groupByMonth(trades) {
  const map = {};
  trades.forEach(t => {
    const key = U.ymKey(t.closeDate || t.openDate || U.todayStr());
    map[key] = map[key] || [];
    map[key].push(t);
  });
  return map;
}
function monthShort(ym) {
  const [y, m] = ym.split('-');
  const names = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'];
  return names[Number(m)-1] + ' ' + y.slice(2);
}

function renderInsightsStrategies() {
  const body = document.getElementById('insightsBody');
  const stats = computeStrategyStats();
  if (!stats.length) { body.innerHTML = emptyStateHtml('🏆', 'עדיין אין אסטרטגיות עם עסקאות'); return; }
  const medals = ['🥇','🥈','🥉'];
  body.innerHTML = stats.map((s, i) => `
    <div class="strategy-rank" data-strat="${U.esc(s.name)}">
      <div class="medal">${medals[i] || (i+1)}</div>
      <div class="name">${U.esc(s.name)}</div>
      <div class="${s.net>=0?'pos':'neg'}" style="font-weight:700;">${U.fmtMoneySigned(s.net)}</div>
    </div>
  `).join('');
  body.querySelectorAll('.strategy-rank').forEach(el => el.onclick = () => openStrategyDetail(el.dataset.strat, stats));
}

function openStrategyDetail(name, stats) {
  const s = (stats || computeStrategyStats()).find(x => x.name === name);
  if (!s) return;
  Modal.open(`
    <div class="modal-head"><h2>${U.esc(name)}</h2><button class="icon-btn" id="mClose">✕</button></div>
    <div class="grid2">
      <div class="stat-box"><div class="label">מס' עסקאות</div><div class="val">${s.count}</div></div>
      <div class="stat-box"><div class="label">אחוז הצלחה</div><div class="val">${s.winRate.toFixed(1)}%</div></div>
      <div class="stat-box"><div class="label">סך רווחים</div><div class="val pos">${U.fmtMoney(s.grossProfit)}</div></div>
      <div class="stat-box"><div class="label">סך הפסדים</div><div class="val neg">${U.fmtMoney(s.grossLoss)}</div></div>
      <div class="stat-box"><div class="label">רווח נקי</div><div class="val ${s.net>=0?'pos':'neg'}">${U.fmtMoneySigned(s.net)}</div></div>
      <div class="stat-box"><div class="label">רווח/הפסד ממוצע</div><div class="val" style="font-size:13px;">${U.fmtMoney(s.avgWin)} / ${U.fmtMoney(s.avgLoss)}</div></div>
      <div class="stat-box"><div class="label">יחס רווח/הפסד</div><div class="val">${isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : '∞'}</div></div>
      <div class="stat-box"><div class="label">דירוג עצמי ממוצע</div><div class="val">${'★'.repeat(Math.round(s.avgRating))}${'☆'.repeat(5-Math.round(s.avgRating))}</div></div>
      <div class="stat-box"><div class="label">העסקה הטובה ביותר</div><div class="val pos" style="font-size:14px;">${s.best ? U.fmtMoney(s.best.pnl) : '—'}</div></div>
      <div class="stat-box"><div class="label">העסקה הגרועה ביותר</div><div class="val neg" style="font-size:14px;">${s.worst ? U.fmtMoney(s.worst.pnl) : '—'}</div></div>
      <div class="stat-box"><div class="label">לפי תוכנית / לא לפי</div><div class="val" style="font-size:14px;">${s.followed} / ${s.notFollowed}</div></div>
      <div class="stat-box"><div class="label">% מסך הרווחים בחשבון</div><div class="val">${s.pctOfTotal.toFixed(1)}%</div></div>
    </div>
  `, () => { document.getElementById('mClose').onclick = Modal.close; });
}

/* ---------- Reports ---------- */
let reportPeriod = 'month';
function renderInsightsReports() {
  const body = document.getElementById('insightsBody');
  body.innerHTML = `
    <div class="tabs2">
      <button data-p="month" class="${reportPeriod==='month'?'active':''}">חודש</button>
      <button data-p="quarter" class="${reportPeriod==='quarter'?'active':''}">רבעון</button>
      <button data-p="year" class="${reportPeriod==='year'?'active':''}">שנה</button>
      <button data-p="all" class="${reportPeriod==='all'?'active':''}">כל התקופה</button>
    </div>
    <div id="reportBody"></div>
  `;
  body.querySelectorAll('.tabs2 button').forEach(b => b.onclick = () => { reportPeriod = b.dataset.p; renderInsightsReports(); });
  renderReportBody();
}

function renderReportBody() {
  const container = document.getElementById('reportBody');
  const now = new Date();
  let startDate;
  if (reportPeriod === 'month') { startDate = new Date(now.getFullYear(), now.getMonth(), 1); }
  else if (reportPeriod === 'quarter') { const q = Math.floor(now.getMonth()/3); startDate = new Date(now.getFullYear(), q*3, 1); }
  else if (reportPeriod === 'year') { startDate = new Date(now.getFullYear(), 0, 1); }
  else { startDate = null; }
  const startStr = startDate ? startDate.toISOString().slice(0,10) : null;

  const entries = DB.getEntries().filter(e => !startStr || e.date >= startStr);
  const trades = DB.getTrades().filter(t => !startStr || (t.closeDate || t.openDate) >= startStr);

  const deposits = entries.reduce((s,e)=>s+Number(e.deposits||0),0);
  const withdrawals = entries.reduce((s,e)=>s+Number(e.withdrawals||0),0);
  const valueChange = entries.length > 1 ? Number(entries[entries.length-1].value) - Number(entries[0].value) : (entries.length ? Number(entries[0].value) : 0);
  const profits = trades.filter(t=>Number(t.pnl)>0).reduce((s,t)=>s+Number(t.pnl),0);
  const losses = trades.filter(t=>Number(t.pnl)<0).reduce((s,t)=>s+Number(t.pnl),0);
  const realReturn = valueChange - (deposits - withdrawals);

  container.innerHTML = `
    <div class="grid2">
      <div class="stat-box"><div class="label">שינוי שווי התיק</div><div class="val ${valueChange>=0?'pos':'neg'}">${U.fmtMoneySigned(valueChange)}</div></div>
      <div class="stat-box"><div class="label">תשואה אמיתית (מנוטרל)</div><div class="val ${realReturn>=0?'pos':'neg'}">${U.fmtMoneySigned(realReturn)}</div></div>
      <div class="stat-box"><div class="label">רווחי עסקאות</div><div class="val pos">${U.fmtMoney(profits)}</div></div>
      <div class="stat-box"><div class="label">הפסדי עסקאות</div><div class="val neg">${U.fmtMoney(losses)}</div></div>
      <div class="stat-box"><div class="label">הפקדות</div><div class="val">${U.fmtMoney(deposits)}</div></div>
      <div class="stat-box"><div class="label">משיכות</div><div class="val">${U.fmtMoney(withdrawals)}</div></div>
    </div>
  `;
}

/* ============================================================
   CALENDAR SCREEN
============================================================ */
let calYear, calMonth;
function renderCalendar() {
  const now = new Date();
  if (calYear == null) { calYear = now.getFullYear(); calMonth = now.getMonth(); }
  const screen = document.getElementById('screen');
  const entries = DB.getEntries();
  const trades = DB.getTrades();
  const entryDates = new Set(entries.map(e => e.date));
  const tradeDates = new Set(trades.map(t => t.closeDate || t.openDate));

  const first = new Date(calYear, calMonth, 1);
  const startDow = first.getDay();
  const dim = U.daysInMonth(calYear, calMonth);

  let cells = '';
  const dows = ['א','ב','ג','ד','ה','ו','ש'];
  dows.forEach(d => cells += `<div class="cal-dow">${d}</div>`);
  for (let i = 0; i < startDow; i++) cells += `<div class="cal-day empty"></div>`;
  for (let d = 1; d <= dim; d++) {
    const dateStr = calYear + '-' + String(calMonth+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const has = entryDates.has(dateStr);
    const hasTrade = tradeDates.has(dateStr);
    cells += `<div class="cal-day ${has?'has-data':''} ${hasTrade?'has-trade':''}" data-date="${dateStr}">${d}</div>`;
  }

  screen.innerHTML = `
    <div class="cal-nav">
      <button class="icon-btn" id="prevMonth">›</button>
      <h3>${U.monthLabel(calYear, calMonth)}</h3>
      <button class="icon-btn" id="nextMonth">‹</button>
    </div>
    <div class="calendar-grid">${cells}</div>
    <div class="section-title">מקרא</div>
    <div class="sub-value">🟦 יש עדכון שווי &nbsp; 🟠 יש עסקה</div>
  `;
  document.getElementById('prevMonth').onclick = () => { calMonth--; if (calMonth<0){calMonth=11;calYear--;} renderCalendar(); };
  document.getElementById('nextMonth').onclick = () => { calMonth++; if (calMonth>11){calMonth=0;calYear++;} renderCalendar(); };
  screen.querySelectorAll('.cal-day[data-date]').forEach(el => el.onclick = () => openDayDetailModal(el.dataset.date));
}

/* ============================================================
   HISTORY TABLE SCREEN
============================================================ */
function renderHistory() {
  const screen = document.getElementById('screen');
  const entries = DB.getEntries().slice().sort((a,b) => b.date.localeCompare(a.date));
  screen.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>תאריך</th><th>שווי תיק</th><th>הפקדות</th><th>משיכות</th><th>שינוי יומי</th><th>אחוז שינוי</th><th>הערות</th><th></th></tr></thead>
        <tbody>
        ${entries.map((e, idx) => {
          const sorted = DB.getEntries();
          const pos = sorted.findIndex(x => x.id === e.id);
          const prev = pos > 0 ? sorted[pos-1] : null;
          const chg = prev ? Number(e.value) - Number(prev.value) : 0;
          const pct = prev && Number(prev.value) ? (chg/Number(prev.value))*100 : 0;
          return `<tr>
            <td>${U.fmtDate(e.date)}</td>
            <td>${U.fmtMoney(e.value)}</td>
            <td>${U.fmtMoney(e.deposits)}</td>
            <td>${U.fmtMoney(e.withdrawals)}</td>
            <td class="${chg>=0?'pos':'neg'}">${U.fmtMoneySigned(chg)}</td>
            <td class="${pct>=0?'pos':'neg'}">${U.fmtPct(pct)}</td>
            <td>${e.notes ? U.esc(e.notes) : ''}</td>
            <td class="row-actions">
              <button class="icon-mini" data-edit="${e.id}">✏️</button>
              <button class="icon-mini" data-del="${e.id}">🗑️</button>
            </td>
          </tr>`;
        }).join('') || `<tr><td colspan="8" style="text-align:center;color:var(--text-dim);">אין נתונים עדיין</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
  screen.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
    const e = DB.getEntries().find(x => x.id === b.dataset.edit);
    renderDailyForm(e.date, e, true);
  });
  screen.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    Modal.confirm('למחוק את הרשומה?', () => { DB.deleteEntry(b.dataset.del); U.toast('הרשומה נמחקה'); renderHistory(); });
  });
}

/* ============================================================
   SETTINGS SCREEN
============================================================ */
function renderSettings() {
  const s = DB.getSettings();
  const strategies = DB.getStrategies();
  const screen = document.getElementById('screen');
  screen.innerHTML = `
    <div class="card">
      <h3>תצוגה</h3>
      <div class="settings-item"><span>מצב כהה</span>
        <div class="seg" style="width:140px;"><button id="themeLight" class="${s.theme!=='dark'?'active':''}">בהיר</button><button id="themeDark" class="${s.theme==='dark'?'active':''}">כהה</button></div>
      </div>
      <div class="settings-item"><span>מטבע ברירת מחדל</span>
        <select id="currencySel">
          <option value="₪" ${s.currency==='₪'?'selected':''}>₪ שקל</option>
          <option value="$" ${s.currency==='$'?'selected':''}>$ דולר</option>
          <option value="€" ${s.currency==='€'?'selected':''}>€ אירו</option>
        </select>
      </div>
      <div class="settings-item"><span>פורמט תאריך</span>
        <select id="dateFmtSel">
          <option value="dd/mm/yyyy" ${s.dateFormat==='dd/mm/yyyy'?'selected':''}>DD/MM/YYYY</option>
          <option value="mm/dd/yyyy" ${s.dateFormat==='mm/dd/yyyy'?'selected':''}>MM/DD/YYYY</option>
          <option value="yyyy-mm-dd" ${s.dateFormat==='yyyy-mm-dd'?'selected':''}>YYYY-MM-DD</option>
        </select>
      </div>
    </div>

    <div class="card">
      <div class="row-between"><h3 style="margin:0;">אסטרטגיות</h3><button class="btn btn-secondary btn-sm" id="addStratBtn">➕ הוספה</button></div>
      <div id="stratList" style="margin-top:8px;">
        ${strategies.length ? strategies.map(name => `
          <div class="settings-item">
            <span>${U.esc(name)}</span>
            <div class="row-actions">
              <button class="icon-mini" data-rename="${U.esc(name)}">✏️</button>
              <button class="icon-mini" data-delstrat="${U.esc(name)}">🗑️</button>
            </div>
          </div>`).join('') : `<div class="sub-value">אין אסטרטגיות עדיין. הוסף באמצעות הכפתור למעלה.</div>`}
      </div>
    </div>

    <div class="card">
      <h3>ייצוא נתונים</h3>
      <div style="display:flex;gap:10px;margin-top:8px;">
        <button class="btn btn-secondary" style="flex:1;" id="exportCsvBtn">CSV ⬇️</button>
        <button class="btn btn-secondary" style="flex:1;" id="exportXlsxBtn">Excel ⬇️</button>
      </div>
    </div>

    <div class="card">
      <h3>גיבוי ושחזור</h3>
      <div style="display:flex;gap:10px;margin-top:8px;">
        <button class="btn btn-secondary" style="flex:1;" id="backupBtn">גיבוי מלא ⬇️</button>
        <button class="btn btn-secondary" style="flex:1;" id="restoreBtn">שחזור מגיבוי ⬆️</button>
      </div>
      <input type="file" id="restoreFile" accept="application/json" style="display:none;">
    </div>

    <div class="card">
      <h3>אודות</h3>
      <p class="sub-value">אפליקציית יומן מסחר ומעקב תיק השקעות. כל הנתונים נשמרים באופן מקומי במכשיר בלבד ואינם נשלחים לשום שרת.</p>
    </div>
  `;

  document.getElementById('themeLight').onclick = () => { DB.saveSettings({ theme: 'light' }); applyTheme(); renderSettings(); };
  document.getElementById('themeDark').onclick = () => { DB.saveSettings({ theme: 'dark' }); applyTheme(); renderSettings(); };
  document.getElementById('currencySel').onchange = (e) => { DB.saveSettings({ currency: e.target.value }); U.toast('נשמר'); };
  document.getElementById('dateFmtSel').onchange = (e) => { DB.saveSettings({ dateFormat: e.target.value }); U.toast('נשמר'); };

  document.getElementById('addStratBtn').onclick = () => {
    Modal.open(`
      <div class="modal-head"><h2>אסטרטגיה חדשה</h2></div>
      <div class="field"><label>שם</label><input type="text" id="newStratName"></div>
      <div class="modal-actions"><button class="btn btn-secondary" id="c1">ביטול</button><button class="btn btn-primary" id="c2">שמירה</button></div>
    `, () => {
      document.getElementById('c1').onclick = Modal.close;
      document.getElementById('c2').onclick = () => {
        const v = document.getElementById('newStratName').value.trim();
        if (!v) return;
        DB.addStrategy(v); Modal.close(); U.toast('נוספה אסטרטגיה'); renderSettings();
      };
    });
  };
  screen.querySelectorAll('[data-rename]').forEach(b => b.onclick = () => {
    Modal.open(`
      <div class="modal-head"><h2>עריכת שם אסטרטגיה</h2></div>
      <div class="field"><label>שם חדש</label><input type="text" id="renameInput" value="${U.esc(b.dataset.rename)}"></div>
      <div class="modal-actions"><button class="btn btn-secondary" id="c1">ביטול</button><button class="btn btn-primary" id="c2">שמירה</button></div>
    `, () => {
      document.getElementById('c1').onclick = Modal.close;
      document.getElementById('c2').onclick = () => {
        const v = document.getElementById('renameInput').value.trim();
        if (!v) return;
        DB.renameStrategy(b.dataset.rename, v); Modal.close(); U.toast('עודכן'); renderSettings();
      };
    });
  });
  screen.querySelectorAll('[data-delstrat]').forEach(b => b.onclick = () => {
    Modal.confirm('למחוק את האסטרטגיה? (עסקאות קיימות ישמרו את השם הישן)', () => {
      DB.deleteStrategy(b.dataset.delstrat); U.toast('נמחקה'); renderSettings();
    });
  });

  document.getElementById('exportCsvBtn').onclick = exportCsv;
  document.getElementById('exportXlsxBtn').onclick = exportXlsx;
  document.getElementById('backupBtn').onclick = downloadBackup;
  document.getElementById('restoreBtn').onclick = () => document.getElementById('restoreFile').click();
  document.getElementById('restoreFile').onchange = handleRestoreFile;
}

/* ---------- Export / Backup ---------- */
function csvEscape(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const entries = DB.getEntries();
  const trades = DB.getTrades();
  let csv = 'טבלת שווי\n';
  csv += ['תאריך','שווי','הפקדות','משיכות','הערות'].map(csvEscape).join(',') + '\n';
  entries.forEach(e => { csv += [e.date, e.value, e.deposits, e.withdrawals, e.notes].map(csvEscape).join(',') + '\n'; });
  csv += '\nעסקאות\n';
  csv += ['תאריך פתיחה','תאריך סגירה','נכס','אסטרטגיה','תיאור','רווח/הפסד','לפי תוכנית','דירוג','הערות'].map(csvEscape).join(',') + '\n';
  trades.forEach(t => { csv += [t.openDate,t.closeDate,t.asset,t.strategy,t.description,t.pnl,t.followedPlan!==false?'כן':'לא',t.rating,t.notes].map(csvEscape).join(',') + '\n'; });
  downloadBlob('﻿' + csv, 'trading-journal-export.csv', 'text/csv;charset=utf-8;');
  U.toast('הקובץ יוצא בהצלחה');
}

function exportXlsx() {
  if (typeof XLSX === 'undefined') { U.toast('שגיאה בטעינת ספריית האקסל'); return; }
  const wb = XLSX.utils.book_new();
  const entries = DB.getEntries().map(e => ({ תאריך: e.date, שווי: e.value, הפקדות: e.deposits, משיכות: e.withdrawals, הערות: e.notes }));
  const trades = DB.getTrades().map(t => ({ 'תאריך פתיחה': t.openDate, 'תאריך סגירה': t.closeDate, נכס: t.asset, אסטרטגיה: t.strategy, תיאור: t.description, 'רווח/הפסד': t.pnl, 'לפי תוכנית': t.followedPlan!==false?'כן':'לא', דירוג: t.rating, הערות: t.notes }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(entries), 'שווי תיק');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trades), 'עסקאות');
  XLSX.writeFile(wb, 'trading-journal-export.xlsx');
  U.toast('הקובץ יוצא בהצלחה');
}

function downloadBackup() {
  const data = DB.exportBackup();
  downloadBlob(JSON.stringify(data, null, 2), 'trading-journal-backup.json', 'application/json');
  U.toast('הגיבוי הורד בהצלחה');
}

function handleRestoreFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      Modal.confirm('שחזור יחליף את כל הנתונים הקיימים. להמשיך?', () => {
        DB.restoreBackup(data);
        applyTheme();
        U.toast('השחזור הושלם בהצלחה');
        Router.go('home');
      });
    } catch (err) {
      U.toast('קובץ גיבוי לא תקין');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/* ============================================================
   INIT & THEME
============================================================ */
function applyTheme() {
  const s = DB.getSettings();
  document.documentElement.setAttribute('data-theme', s.theme === 'dark' ? 'dark' : 'light');
}

function initApp() {
  applyTheme();
  Router.on('home', renderHome);
  Router.on('trades', renderTrades);
  Router.on('insights', renderInsights);
  Router.on('calendar', renderCalendar);
  Router.on('settings', renderSettings);
  Router.on('history', renderHistory);

  document.querySelectorAll('.navbtn').forEach(btn => {
    btn.onclick = () => Router.go(btn.dataset.route);
  });
  document.getElementById('fab').onclick = openDailyUpdateModal;
  document.getElementById('menuBtn').onclick = () => Router.go('settings');

  Router.render();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', initApp);
