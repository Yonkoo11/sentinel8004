// AgentGuard Dashboard
(async function () {
  let allReports = [];

  try {
    const res = await fetch('data/scores.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allReports = data.reports || [];

    // Stats
    document.getElementById('stat-total').textContent = allReports.length;
    const avg = allReports.length > 0
      ? Math.round(allReports.reduce((s, r) => s + r.compositeScore, 0) / allReports.length)
      : 0;
    document.getElementById('stat-avg').textContent = avg;
    document.getElementById('stat-flagged').textContent =
      allReports.filter(r => r.compositeScore < 30).length;

    const owners = new Set(allReports.map(r => r.owner));
    document.getElementById('stat-owners').textContent = owners.size;
    document.getElementById('scan-meta').textContent =
      `Scanned ${data.scannedAt ? new Date(data.scannedAt).toLocaleString() : 'N/A'}`;
  } catch (e) {
    document.getElementById('agent-table').innerHTML =
      `<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">
        Failed to load data. Run the scanner and generate-dashboard script first.<br>
        <code class="text-xs mt-2 block">npx tsx scripts/generate-dashboard.ts</code>
      </td></tr>`;
    return;
  }

  const search = document.getElementById('search');
  const scoreFilter = document.getElementById('score-filter');
  const sortBy = document.getElementById('sort-by');

  function scoreBadgeColor(score) {
    if (score >= 70) return 'bg-green-900/50 text-green-400 border-green-800';
    if (score >= 30) return 'bg-yellow-900/50 text-yellow-400 border-yellow-800';
    return 'bg-red-900/50 text-red-400 border-red-800';
  }

  function scoreBarColor(score) {
    if (score >= 70) return 'bg-green-500';
    if (score >= 30) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  function truncAddr(addr) {
    return addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '';
  }

  function getFlags(report) {
    return report.layers ? report.layers.flatMap(l => l.flags || []) : [];
  }

  function render() {
    const q = search.value.toLowerCase();
    const filter = scoreFilter.value;
    const sort = sortBy.value;

    let filtered = allReports.filter(r => {
      if (q && !(r.name || '').toLowerCase().includes(q) && !r.owner.toLowerCase().includes(q)) {
        return false;
      }
      if (filter === 'high' && r.compositeScore < 70) return false;
      if (filter === 'mid' && (r.compositeScore < 30 || r.compositeScore >= 70)) return false;
      if (filter === 'low' && r.compositeScore >= 30) return false;
      return true;
    });

    filtered.sort((a, b) => {
      if (sort === 'score-desc') return b.compositeScore - a.compositeScore;
      if (sort === 'score-asc') return a.compositeScore - b.compositeScore;
      if (sort === 'id-asc') return a.agentId - b.agentId;
      if (sort === 'id-desc') return b.agentId - a.agentId;
      if (sort === 'flags') return getFlags(b).length - getFlags(a).length;
      return 0;
    });

    const tbody = document.getElementById('agent-table');
    const rows = [];

    for (const r of filtered.slice(0, 200)) {
      const flags = getFlags(r);
      const flagTypes = [...new Set(flags.map(f => f.split(':')[0]))];
      const badgeClass = scoreBadgeColor(r.compositeScore);
      const barColor = scoreBarColor(r.compositeScore);
      const rowId = `row-${r.agentId}`;

      rows.push(`
        <tr class="agent-row border-b border-gray-800/50 cursor-pointer" onclick="toggleExpand('${rowId}')">
          <td class="px-4 py-3 text-gray-400">#${r.agentId}</td>
          <td class="px-4 py-3 font-medium">${escapeHtml(r.name || 'Unknown')}</td>
          <td class="px-4 py-3 text-gray-500 hidden md:table-cell font-mono text-xs">${truncAddr(r.owner)}</td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-2">
              <span class="text-xs px-2 py-0.5 rounded border ${badgeClass}">${r.compositeScore}</span>
              <div class="flex-1 bg-gray-800 rounded-full h-1.5">
                <div class="score-bar ${barColor} h-1.5 rounded-full" style="width: ${r.compositeScore}%"></div>
              </div>
            </div>
          </td>
          <td class="px-4 py-3 text-xs text-gray-500">${flags.length > 0 ? flags.length : ''}</td>
        </tr>
        <tr>
          <td colspan="5" class="p-0">
            <div id="${rowId}" class="expand-content bg-gray-950/50">
              <div class="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <div class="text-gray-500 mb-2">Layer Breakdown</div>
                  ${(r.layers || []).map(l => `
                    <div class="flex justify-between py-1 border-b border-gray-800/30">
                      <span class="text-gray-400">${l.layer}</span>
                      <span>${l.score}/${l.maxScore}</span>
                    </div>
                  `).join('')}
                </div>
                <div>
                  ${flagTypes.length > 0 ? `
                    <div class="text-gray-500 mb-2">Flags</div>
                    ${flagTypes.map(f => `<span class="inline-block bg-red-900/30 text-red-400 border border-red-800/50 rounded px-2 py-0.5 mr-1 mb-1">${f}</span>`).join('')}
                  ` : ''}
                  <div class="text-gray-500 mt-3 mb-1">Owner</div>
                  <div class="font-mono text-gray-400">${r.owner}</div>
                  ${r.errors && r.errors.length > 0 ? `
                    <div class="text-gray-500 mt-3 mb-1">Errors</div>
                    ${r.errors.map(e => `<div class="text-red-400">${escapeHtml(e)}</div>`).join('')}
                  ` : ''}
                </div>
              </div>
            </div>
          </td>
        </tr>
      `);
    }

    tbody.innerHTML = rows.join('');
    document.getElementById('showing-count').textContent =
      `Showing ${Math.min(filtered.length, 200)} of ${filtered.length} agents`;
  }

  search.addEventListener('input', render);
  scoreFilter.addEventListener('change', render);
  sortBy.addEventListener('change', render);

  render();
})();

function toggleExpand(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
