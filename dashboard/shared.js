// ══════════════════════════════════════════════════════════════
// AgentGuard — Shared Utilities
// ══════════════════════════════════════════════════════════════

// ── Scroll Reveal ──
function initReveals() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ── Count-Up Animation ──
function countUp(el, target, duration = 1000) {
  if (!el) return;
  const start = performance.now();
  const fmt = (n) => n.toLocaleString();
  const update = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = fmt(Math.round(eased * target));
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ── Active Nav Link ──
function initNav() {
  const page = document.body.dataset.page;
  if (!page) return;
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.dataset.page === page) {
      link.classList.add('active');
    }
  });
}

// ── Escape HTML ──
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── Truncate Address ──
function truncAddr(addr) {
  return addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '';
}

// ── Score Helpers ──
function scoreClass(s) {
  return s >= 70 ? 'high' : s >= 30 ? 'mid' : 'low';
}

function confDot(conf) {
  const color = conf === 'high' ? 'var(--celo)' : conf === 'medium' ? 'var(--yellow)' : 'var(--red)';
  return `<span class="conf-dot" style="background:${color}" title="${escapeHtml(conf || 'unknown')} confidence"></span>`;
}

// ── Get Flags from Report ──
function getFlags(report) {
  return report.layers ? report.layers.flatMap(l => l.flags || []) : [];
}

// ── Mobile Nav Toggle (#34) ──
function initMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  // Close on link click
  links.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// ── Init on DOM ready ──
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initReveals();
  initMobileNav();
});
