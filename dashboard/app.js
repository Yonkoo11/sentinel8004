// AgentGuard Dashboard
(async function () {
  let allReports = [];
  let displayLimit = 100;

  try {
    const res = await fetch('data/scores.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allReports = data.reports || [];
    // Remove loading indicator
    const loadingRow = document.getElementById('loading-row');
    if (loadingRow) loadingRow.remove();

    // Compute stats
    const total = allReports.length;
    const trusted = allReports.filter(r => r.compositeScore >= 70).length;
    const fair = allReports.filter(r => r.compositeScore >= 30 && r.compositeScore < 70).length;
    const flagged = allReports.filter(r => r.compositeScore < 30).length;
    const owners = new Set(allReports.map(r => r.owner));
    const avg = total > 0 ? Math.round(allReports.reduce((s, r) => s + r.compositeScore, 0) / total) : 0;

    document.getElementById('stat-total').textContent = total.toLocaleString();
    document.getElementById('stat-trusted').textContent = trusted.toLocaleString();
    document.getElementById('stat-fair').textContent = fair.toLocaleString();
    document.getElementById('stat-flagged').textContent = flagged.toLocaleString();
    document.getElementById('stat-owners').textContent = owners.size.toLocaleString();

    // Hero
    const spamPct = total > 0 ? ((flagged / total) * 100).toFixed(1) + '%' : '--';
    document.getElementById('hero-spam-pct').textContent = spamPct;
    document.getElementById('hero-desc').textContent =
      `Out of ${total.toLocaleString()} agents on Celo's IdentityRegistry, ${flagged.toLocaleString()} score below 30/100. ` +
      `Only ${trusted} agents pass all trust checks. Average score: ${avg}/100. ` +
      `${owners.size} unique owner addresses.`;

    // Distribution chart (10 buckets of 10)
    const buckets = Array(10).fill(0);
    for (const r of allReports) {
      const idx = Math.min(9, Math.floor(r.compositeScore / 10));
      buckets[idx]++;
    }
    const maxLog = Math.max(...buckets.map(b => b > 0 ? Math.log10(b + 1) : 0), 1);
    const chart = document.getElementById('distribution-chart');
    const colors = ['#ef4444','#ef4444','#ef4444','#f59e0b','#f59e0b','#f59e0b','#f59e0b','#35D07F','#35D07F','#35D07F'];
    chart.innerHTML = buckets.map((count, i) => {
      const h = count > 0 ? Math.max(8, (Math.log10(count + 1) / maxLog) * 64) : 2;
      const label = `${i*10}-${i*10+9}: ${count.toLocaleString()} agents`;
      return `<div class="flex flex-col items-center gap-1" title="${label}">
        <div class="text-[9px] mono text-gray-500">${count > 0 ? count.toLocaleString() : ''}</div>
        <div class="w-6 rounded-t" style="height:${h}px;background:${colors[i]};opacity:0.8"></div>
        <div class="text-[9px] text-gray-600 mono">${i*10}</div>
      </div>`;
    }).join('');

    // Flag pills
    const allFlags = {};
    for (const r of allReports) {
      for (const layer of (r.layers || [])) {
        for (const flag of (layer.flags || [])) {
          const key = flag.split(':')[0];
          allFlags[key] = (allFlags[key] || 0) + 1;
        }
      }
    }
    const flagPills = document.getElementById('flag-pills');
    const sortedFlags = Object.entries(allFlags).sort((a, b) => b[1] - a[1]).slice(0, 8);
    flagPills.innerHTML = sortedFlags.map(([flag, count]) => {
      const isRed = ['MASS_REGISTRATION', 'METADATA_CLONE', 'AUTO_NAMING', 'UNLIMITED_APPROVALS'].includes(flag);
      const cls = isRed
        ? 'bg-red-950/50 text-red-400 border-red-900/50'
        : 'bg-surface-3 text-gray-400 border-white/5';
      return `<button class="text-[11px] px-2.5 py-1 rounded-full border ${cls} hover:opacity-80 transition-opacity flag-pill" data-flag="${flag}">
        ${flag.replace(/_/g, ' ')} <span class="text-gray-600 ml-1">${count.toLocaleString()}</span>
      </button>`;
    }).join('');

    // Flag pill click filters
    flagPills.querySelectorAll('.flag-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const flag = pill.dataset.flag;
        document.getElementById('search').value = flag;
        render();
      });
    });

    document.getElementById('scan-meta').textContent =
      data.scannedAt ? new Date(data.scannedAt).toLocaleString() : '';
  } catch (e) {
    document.getElementById('agent-table').innerHTML =
      `<tr><td colspan="5" class="px-5 py-12 text-center text-gray-500">
        <div class="text-lg mb-2">No scan data found</div>
        <div class="text-xs">Run the scanner first:</div>
        <code class="text-[11px] mt-2 block mono text-gray-400">npx tsx src/index.ts scan && npx tsx scripts/generate-dashboard.ts</code>
      </td></tr>`;
    return;
  }

  const search = document.getElementById('search');
  const scoreFilter = document.getElementById('score-filter');
  const sortBy = document.getElementById('sort-by');
  const loadMore = document.getElementById('load-more');

  function scoreBadge(score) {
    if (score >= 70) return { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' };
    if (score >= 30) return { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' };
    return { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' };
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
      if (q) {
        const flags = getFlags(r).join(' ').toLowerCase();
        if (!(r.name || '').toLowerCase().includes(q) &&
            !r.owner.toLowerCase().includes(q) &&
            !flags.includes(q)) {
          return false;
        }
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

    const showing = filtered.slice(0, displayLimit);
    const tbody = document.getElementById('agent-table');
    const rows = [];

    for (const r of showing) {
      const flags = getFlags(r);
      const flagTypes = [...new Set(flags.map(f => f.split(':')[0]))];
      const badge = scoreBadge(r.compositeScore);
      const barColor = scoreBarColor(r.compositeScore);
      const rowId = `row-${r.agentId}`;

      rows.push(`
        <tr class="agent-row cursor-pointer" onclick="toggleExpand('${rowId}')">
          <td class="px-5 py-3 mono text-gray-500 text-xs">${r.agentId}</td>
          <td class="px-5 py-3">
            <div class="font-medium text-sm">${escapeHtml(r.name || 'Unknown')}</div>
          </td>
          <td class="px-5 py-3 hidden lg:table-cell">
            <span class="mono text-xs text-gray-500">${truncAddr(r.owner)}</span>
          </td>
          <td class="px-5 py-3">
            <div class="flex items-center gap-3">
              <span class="mono text-xs font-medium w-7 ${badge.text}">${r.compositeScore}</span>
              <div class="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div class="score-bar ${barColor} h-full rounded-full" style="width:${r.compositeScore}%"></div>
              </div>
            </div>
          </td>
          <td class="px-5 py-3">
            ${flags.length > 0
              ? `<span class="mono text-xs text-red-400/70">${flags.length}</span>`
              : '<span class="text-xs text-gray-700">--</span>'}
          </td>
        </tr>
        <tr>
          <td colspan="5" class="p-0">
            <div id="${rowId}" class="expand-content">
              <div class="expand-inner">
                <div class="px-6 py-5 bg-surface-1/50 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                  <div>
                    <div class="text-[11px] text-gray-500 uppercase tracking-wider mb-3">Layer Breakdown</div>
                    ${(r.layers || []).map(l => `
                      <div class="flex items-center justify-between py-1.5">
                        <span class="text-gray-400 capitalize">${l.layer}</span>
                        <div class="flex items-center gap-2">
                          <div class="w-16 bg-white/5 rounded-full h-1">
                            <div class="${scoreBarColor(l.score / l.maxScore * 100)} h-full rounded-full" style="width:${(l.score/l.maxScore)*100}%"></div>
                          </div>
                          <span class="mono text-gray-300 w-10 text-right">${l.score}/${l.maxScore}</span>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                  <div>
                    ${flagTypes.length > 0 ? `
                      <div class="text-[11px] text-gray-500 uppercase tracking-wider mb-3">Risk Flags</div>
                      <div class="flex flex-wrap gap-1.5">
                        ${flagTypes.map(f => `<span class="bg-red-950/30 text-red-400/80 border border-red-900/30 rounded px-2 py-0.5 text-[10px]">${f}</span>`).join('')}
                      </div>
                    ` : '<div class="text-[11px] text-gray-500 uppercase tracking-wider mb-3">No Flags</div><div class="text-green-400/60 text-[11px]">Clean</div>'}
                  </div>
                  <div>
                    <div class="text-[11px] text-gray-500 uppercase tracking-wider mb-3">Details</div>
                    <div class="mono text-[11px] text-gray-400 break-all">${r.owner}</div>
                    ${r.confidence ? `<div class="mt-2 text-[11px]"><span class="text-gray-500">Confidence:</span> <span class="${r.confidence === 'high' ? 'text-green-400' : r.confidence === 'medium' ? 'text-yellow-400' : 'text-red-400'}">${r.confidence}</span></div>` : ''}
                    ${r.circuitBreakers && r.circuitBreakers.length > 0 ? `
                      <div class="mt-3 text-[11px] text-gray-500 uppercase tracking-wider mb-1">Circuit Breakers</div>
                      ${r.circuitBreakers.map(cb => `<div class="text-orange-400/80 text-[11px]">${escapeHtml(cb)}</div>`).join('')}
                    ` : ''}
                    ${r.errors && r.errors.length > 0 ? `
                      <div class="mt-3 text-[11px] text-gray-500 uppercase tracking-wider mb-1">Errors</div>
                      ${r.errors.map(e => `<div class="text-red-400/70 text-[11px]">${escapeHtml(e)}</div>`).join('')}
                    ` : ''}
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      `);
    }

    tbody.innerHTML = rows.join('');
    document.getElementById('showing-count').textContent =
      `Showing ${showing.length} of ${filtered.length} agents`;

    if (filtered.length > displayLimit) {
      loadMore.classList.remove('hidden');
      loadMore.textContent = `Load more (${filtered.length - displayLimit} remaining)`;
    } else {
      loadMore.classList.add('hidden');
    }
  }

  search.addEventListener('input', () => { displayLimit = 100; render(); });
  scoreFilter.addEventListener('change', () => { displayLimit = 100; render(); });
  sortBy.addEventListener('change', render);
  loadMore.addEventListener('click', () => { displayLimit += 100; render(); });

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
