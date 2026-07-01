/* ============ עזרי גרפים (Chart.js) ============ */
const ChartsUI = (() => {
  let instances = {};

  function destroy(id) {
    if (instances[id]) {
      instances[id].destroy();
      delete instances[id];
    }
  }

  function themeColors() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      grid: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)',
      text: dark ? '#94a3b8' : '#64748b',
      primary: dark ? '#3b82f6' : '#2563eb',
      green: dark ? '#22c55e' : '#16a34a',
      red: dark ? '#f87171' : '#dc2626'
    };
  }

  function lineChart(canvasId, labels, datasets, opts) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const c = themeColors();
    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: datasets.map(d => Object.assign({
        tension: .35, fill: true, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2
      }, d)) },
      options: Object.assign({
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: datasets.length > 1, labels: { color: c.text } },
          tooltip: {
            callbacks: opts && opts.tooltipCallbacks
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: c.text, maxTicksLimit: 6 } },
          y: { grid: { color: c.grid }, ticks: { color: c.text } }
        }
      }, opts && opts.override || {})
    });
    return instances[canvasId];
  }

  function barChart(canvasId, labels, datasets, opts) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const c = themeColors();
    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: Object.assign({
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: datasets.length > 1, labels: { color: c.text } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: c.text } },
          y: { grid: { color: c.grid }, ticks: { color: c.text } }
        }
      }, opts || {})
    });
    return instances[canvasId];
  }

  function pieChart(canvasId, labels, data, colors) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const c = themeColors();
    instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: c.text, boxWidth: 12, font: { size: 11 } } } }
      }
    });
    return instances[canvasId];
  }

  function palette(n) {
    const base = ['#2563eb','#16a34a','#d97706','#dc2626','#9333ea','#0891b2','#db2777','#65a30d','#4338ca','#ea580c'];
    const out = [];
    for (let i = 0; i < n; i++) out.push(base[i % base.length]);
    return out;
  }

  return { lineChart, barChart, pieChart, palette, destroy, themeColors };
})();
