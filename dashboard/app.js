// Sentinel8004 — Registry Page Logic
(async function () {
  const IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
  let allReports = [];
  let displayLimit = 50;

  try {
    const res = await fetch('data/scores.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allReports = data.reports || [];

    const loadingRow = document.getElementById('loading-row');
    if (loadingRow) loadingRow.remove();

    const total = allReports.length;
    const trusted = allReports.filter(r => r.compositeScore >= 70).length;
    const fair = allReports.filter(r => r.compositeScore >= 30 && r.compositeScore < 70).length;
    const flagged = allReports.filter(r => r.compositeScore < 30).length;

    // Quick stats
    countUp(document.getElementById('qs-total'), total);
    countUp(document.getElementById('qs-trusted'), trusted);
    countUp(document.getElementById('qs-fair'), fair);
    countUp(document.getElementById('qs-flagged'), flagged);

    // Grey out zero stats (Issue 16)
    if (trusted === 0) document.getElementById('qs-trusted').style.color = 'var(--text-muted)';
    if (fair === 0) document.getElementById('qs-fair').style.color = 'var(--text-muted)';

    // Footer attestation count
    const footerEl = document.getElementById('footer-attestations');
    if (footerEl) footerEl.textContent = (data.onchainStats?.written || total).toLocaleString();

    // Distribution chart (Proposal C horizontal bars)
    const buckets = Array(10).fill(0);
    for (const r of allReports) {
      const idx = Math.min(9, Math.floor(r.compositeScore / 10));
      buckets[idx]++;
    }
    const maxBucket = Math.max(...buckets, 1);
    const barColors = ['var(--red)','var(--red)','var(--red)','var(--yellow)','var(--yellow)','var(--yellow)','var(--yellow)','var(--celo)','var(--celo)','var(--celo)'];
    const distChart = document.getElementById('dist-chart');
    if (distChart) {
      distChart.innerHTML = buckets.map((count, i) => {
        const pct = maxBucket > 0 ? (count / maxBucket) * 100 : 0;
        return `<div class="dist-row">
          <div class="dist-label">${i*10}-${i*10+9}</div>
          <div class="dist-bar-track">
            <div class="dist-bar-fill" data-width="${pct}" style="background:${barColors[i]}"></div>
          </div>
          <div class="dist-count">${count.toLocaleString()}</div>
        </div>`;
      }).join('');

      // Animate bars
      const distObs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.querySelectorAll('.dist-bar-fill').forEach(bar => {
              setTimeout(() => { bar.style.width = bar.dataset.width + '%'; }, 80);
            });
            distObs.unobserve(e.target);
          }
        });
      }, { threshold: 0.2 });
      distObs.observe(distChart);
    }

    // Scan date
    if (data.scannedAt) {
      const d = new Date(data.scannedAt);
      const el = document.getElementById('scan-date');
      if (el) el.textContent = 'Last scan: ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const freshEl = document.getElementById('data-freshness');
      if (freshEl) {
        const now = new Date();
        const scanDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const ago = Math.round((today - scanDay) / 86400000);
        const label = ago <= 1 ? 'Today' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        freshEl.textContent = 'Scanned: ' + label;
      }
    }

    // Table
    const searchInput = document.getElementById('search');
    const scoreFilter = document.getElementById('score-filter');
    const sortBy = document.getElementById('sort-by');
    const loadMore = document.getElementById('load-more');

    function render() {
      const q = searchInput.value.toLowerCase();
      const filter = scoreFilter.value;
      const sort = sortBy.value;

      let filtered = allReports.filter(r => {
        if (q) {
          const flags = getFlags(r).join(' ').toLowerCase();
          if (!(r.name || '').toLowerCase().includes(q) &&
              !r.owner.toLowerCase().includes(q) &&
              !flags.includes(q)) return false;
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
      const tbody = document.getElementById('agent-table-body');
      const rows = [];

      for (const r of showing) {
        const flags = getFlags(r);
        const flagTypes = [...new Set(flags.map(f => f.split(':')[0]))];
        const redFlagSet = new Set(['MASS_REGISTRATION', 'METADATA_CLONE', 'ALL_ENDPOINTS_DEAD', 'NEGATIVE_REPUTATION', 'UNLIMITED_APPROVALS', 'SYBIL_BOOSTED']);
        const sc = scoreClass(r.compositeScore);
        const rowId = `expand-${r.agentId}`;

        rows.push(`
          <tr data-expand="${rowId}" tabindex="0" aria-expanded="false">
            <td class="mono" style="color: var(--text-muted); font-size: 12px;">${r.agentId}</td>
            <td class="agent-name">${escapeHtml(r.name || 'Unknown')}</td>
            <td class="mono agent-owner">${truncAddr(r.owner)}</td>
            <td>
              <div class="score-cell">
                <span class="score-num score-${sc}">${r.compositeScore}</span>
                <span class="score-bar-track" role="meter" aria-valuenow="${r.compositeScore}" aria-valuemin="0" aria-valuemax="100" aria-label="Trust score ${r.compositeScore} out of 100"><span class="score-bar-fill bar-${sc}" style="width:${r.compositeScore}%"></span></span>
                ${confDot(r.confidence)}
              </div>
            </td>
            <td>
              ${flagTypes.length > 0
                ? `<span class="flag-chip ${redFlagSet.has(flagTypes[0]) ? 'flag-chip-red' : 'flag-chip-yellow'}">${flagTypes[0]}</span>${flagTypes.length > 1 ? `<span class="mono" style="font-size: 10px; color: var(--text-muted); margin-left: 4px;" title="${flagTypes.slice(1).join(', ')}">+${flagTypes.length - 1}</span>` : ''}`
                : '<span style="color: var(--text-muted); font-size: 12px;">—</span>'}
            </td>
          </tr>
          <tr><td colspan="5" style="padding: 0;">
            <div class="expand-wrap" id="${rowId}">
              <div class="expand-inner">
                <div>
                  <h4 class="detail-heading">Layer Breakdown</h4>
                  ${(r.layers || []).map(l => {
                    const pct = l.maxScore > 0 ? (l.score / l.maxScore) * 100 : 0;
                    const cls = scoreClass(pct);
                    return `<div class="layer-row">
                      <span style="text-transform: capitalize;">${l.layer}</span>
                      <span style="display: flex; align-items: center; gap: 6px;">
                        <span class="score-bar-track" style="width: 40px;"><span class="score-bar-fill bar-${cls}" style="width:${pct}%"></span></span>
                        <span class="mono" style="color: var(--text-primary); font-size: 11px;">${l.score}/${l.maxScore}</span>
                      </span>
                    </div>`;
                  }).join('')}
                </div>
                <div>
                  ${flagTypes.length > 0 ? `
                    <h4 class="detail-heading">Risk Flags</h4>
                    <div>${flagTypes.map(f => `<span class="flag-chip ${redFlagSet.has(f) ? 'flag-chip-red' : 'flag-chip-yellow'}">${f}</span>`).join('')}</div>
                  ` : `<h4 class="detail-heading">Flags</h4><div style="color: var(--celo); font-size: 11px;">Clean</div>`}
                  ${r.circuitBreakers && r.circuitBreakers.length > 0 ? `
                    <div class="detail-heading" style="margin-top: 12px;">Circuit Breakers</div>
                    ${r.circuitBreakers.map(cb => `<div style="color: var(--yellow); font-size: 11px;">${escapeHtml(cb)}</div>`).join('')}
                  ` : ''}
                </div>
                <div>
                  <h4 class="detail-heading">Details</h4>
                  <div class="mono" style="font-size: 11px; color: var(--text-secondary); word-break: break-all;">${escapeHtml(r.owner)}</div>
                  ${r.confidence ? `<div style="margin-top: 8px; font-size: 11px;"><span style="color: var(--text-muted);">Confidence:</span> <span class="score-${sc}">${r.confidence}</span></div>` : ''}
                  ${r.errors && r.errors.length > 0 ? `
                    <div class="detail-heading" style="margin-top: 12px;">Errors</div>
                    ${r.errors.map(e => `<div style="color: var(--red); opacity: 0.7; font-size: 11px;">${escapeHtml(e)}</div>`).join('')}
                  ` : ''}
                  <div style="display: flex; gap: 12px; margin-top: 12px; flex-wrap: wrap;">
                    <a href="https://celoscan.io/nft/${IDENTITY_REGISTRY}/${r.agentId}" target="_blank" class="celoscan-link">
                      View on CeloScan &#8599;
                    </a>
                    ${r.ipfsCID ? `<a href="https://ipfs.filebase.io/ipfs/${r.ipfsCID}" target="_blank" style="font-family: var(--mono); font-size: 11px; color: var(--celo); text-decoration: none;">
                      IPFS Report &#8599;
                    </a>` : ''}
                  </div>
                </div>
              </div>
            </div>
          </td></tr>
        `);
      }

      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 48px; color: var(--text-muted);">
          <div style="font-size: 14px; margin-bottom: 4px;">No agents match your search</div>
          <div style="font-size: 12px;">Try a different name, address, or flag.</div>
        </td></tr>`;
      } else {
        tbody.innerHTML = rows.join('');
      }
      document.getElementById('showing-count').textContent =
        filtered.length > 0 ? `Showing ${showing.length} of ${filtered.length} agents` : '';

      if (filtered.length > displayLimit) {
        loadMore.classList.remove('hidden');
        loadMore.textContent = `Load more (${filtered.length - displayLimit} remaining)`;
      } else {
        loadMore.classList.add('hidden');
      }
    }

    let searchTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { displayLimit = 50; render(); }, 200);
    });
    scoreFilter.addEventListener('change', () => { displayLimit = 50; render(); });
    sortBy.addEventListener('change', render);
    loadMore.addEventListener('click', () => { displayLimit += 50; render(); });

    render();

  } catch (e) {
    document.getElementById('agent-table-body').innerHTML =
      `<tr><td colspan="5" style="text-align: center; padding: 48px; color: var(--text-muted);">
        <div style="font-size: 14px; margin-bottom: 8px;">Unable to load scan data</div>
        <div style="font-size: 12px; color: var(--text-muted);">Check back later or verify the data source.</div>
      </td></tr>`;
  }
})();

// Event delegation for row expand (click + keyboard accessible)
document.addEventListener('click', function(e) {
  const row = e.target.closest('tr[data-expand]');
  if (!row) return;
  const el = document.getElementById(row.dataset.expand);
  if (el) {
    const isOpen = el.classList.toggle('open');
    row.setAttribute('aria-expanded', isOpen);
  }
});
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const row = e.target.closest('tr[data-expand]');
  if (!row) return;
  e.preventDefault();
  const el = document.getElementById(row.dataset.expand);
  if (el) {
    const isOpen = el.classList.toggle('open');
    row.setAttribute('aria-expanded', isOpen);
  }
});
