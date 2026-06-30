// ================================================================
// MediCare Pro — App Shell
// Routing, auth guard, global utilities
// ================================================================
'use strict';

const App = (() => {

  let _currentPage = 'dashboard';
  let _currentPatientId = null;
  let _settings = {};

  // ── INIT ──────────────────────────────────────────────────────
  async function init() {
    try {
      await DB.open();
      _settings = await DB.settings.get();
      _applyTheme(_settings.preferences?.theme || 'light');

      const supabase = await Sync.init();

      if (Sync.isConfigured()) {
        const session = await Sync.getSession();
        if (session) {
          _userId = session.user.id;
          showApp();
        } else {
          showAuth();
        }
      } else {
        // Offline-only mode: skip auth, go straight to app
        showApp();
      }
    } catch (err) {
      console.error('[App] Init failed:', err);
      showApp(); // Fallback: open app anyway
    }
  }

  let _userId = null;

  // ── AUTH ──────────────────────────────────────────────────────
  function showAuth() {
    document.getElementById('auth-screen').classList.add('show');
    document.getElementById('app-shell').classList.remove('show');
    document.getElementById('setup-screen').classList.remove('show');
  }

  async function showApp() {
    document.getElementById('auth-screen').classList.remove('show');
    document.getElementById('setup-screen').classList.remove('show');
    document.getElementById('app-shell').classList.add('show');
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    await _initModules();
    navigate(_currentPage);
    updateSyncBadge();
    _loadDoctorProfile();
  }

  async function _loadDoctorProfile() {
    const s = await DB.settings.get();
    const name = s.profile?.name || 'Dr. Bincy';
    const spec  = s.profile?.specialization || 'Gynecologist & Obstetrician';
    el('sidebar-doc-name') && (el('sidebar-doc-name').textContent = name);
    el('sidebar-doc-spec') && (el('sidebar-doc-spec').textContent = spec);
    const initials = name.split(' ').filter(w => /[A-Z]/i.test(w[0])).map(w => w[0].toUpperCase()).join('').slice(0, 2);
    el('sidebar-av') && (el('sidebar-av').textContent = initials || 'Dr');
  }

  async function _initModules() {
    // Each module registers itself; call their init()
    const mods = ['Dashboard','Patients','Appointments','Consultations','Pregnancy','ANC','Prescriptions','Billing','Labs','Ultrasound','Reports','Settings'];
    for (const m of mods) {
      if (window[m + 'Module']?.init) {
        try { await window[m + 'Module'].init(); }
        catch(e) { console.warn(`[App] Module ${m} init failed:`, e); }
      }
    }
  }

  // ── NAVIGATION ────────────────────────────────────────────────
  const PAGE_TITLES = {
    dashboard:     'Dashboard',
    patients:      'Patients',
    'new-patient': 'New Patient',
    appointments:  'Appointments',
    consultations: 'Consultation Notes',
    pregnancy:     'Pregnancy Tracking',
    anc:           'ANC Follow-up',
    prescriptions: 'Prescriptions',
    billing:       'Billing & Invoices',
    labs:          'Laboratory Results',
    ultrasound:    'Ultrasound Records',
    reports:       'Reports',
    settings:      'Settings',
    backup:        'Backup & Restore',
  };

  function navigate(pageId, params) {
    if (params?.patientId) _currentPatientId = params.patientId;
    _currentPage = pageId;

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    // Show target
    const target = document.getElementById('page-' + pageId);
    if (target) target.classList.add('active');

    // Update nav active states
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll(`[data-page="${pageId}"]`).forEach(n => n.classList.add('active'));

    // Update title
    const title = PAGE_TITLES[pageId] || pageId;
    el('topbar-title') && (el('topbar-title').textContent = title);
    el('mobile-title') && (el('mobile-title').textContent = title);
    document.title = `${title} — MediCare Pro`;

    // Close mobile drawer if open
    closeMobileDrawer();

    // Render module
    const modMap = {
      dashboard:     'Dashboard',
      patients:      'Patients',
      appointments:  'Appointments',
      consultations: 'Consultations',
      pregnancy:     'Pregnancy',
      anc:           'ANC',
      prescriptions: 'Prescriptions',
      billing:       'Billing',
      labs:          'Labs',
      ultrasound:    'Ultrasound',
      reports:       'Reports',
      settings:      'Settings',
      backup:        'Settings',
    };
    const mod = modMap[pageId];
    if (mod && window[mod + 'Module']?.render) {
      window[mod + 'Module'].render(pageId, params);
    }
    // Scroll to top
    el('main-content') && (el('main-content').scrollTop = 0);
  }

  // Patient detail — special page
  async function openPatient(patientId) {
    _currentPatientId = patientId;
    if (window.PatientsModule?.openDetail) {
      window.PatientsModule.openDetail(patientId);
    }
  }

  // ── SEARCH ────────────────────────────────────────────────────
  let _searchDebounce;
  async function handleSearch(q) {
    clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(async () => {
      if (!q.trim()) { closeSearch(); return; }
      const results = await DB.patients.search(q.trim());
      showSearchResults(results);
    }, 200);
  }

  function showSearchResults(patients) {
    const container = el('search-results');
    if (!container) return;
    if (!patients.length) {
      container.innerHTML = '<div class="search-empty">No patients found</div>';
      container.classList.add('open');
      return;
    }
    container.innerHTML = patients.slice(0, 8).map(p => `
      <div class="search-item" onclick="App.openPatient('${p.id}');App.closeSearch()">
        <div class="search-av">${initials(p.first_name, p.last_name)}</div>
        <div>
          <div class="search-name">${p.first_name} ${p.last_name}</div>
          <div class="search-sub">${p.patient_no || ''} · ${p.phone || ''}</div>
        </div>
      </div>
    `).join('');
    container.classList.add('open');
  }

  function closeSearch() {
    const container = el('search-results');
    container?.classList.remove('open');
    el('global-search') && (el('global-search').value = '');
  }

  // ── THEME ─────────────────────────────────────────────────────
  function _applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = el('theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  async function toggleTheme() {
    const s    = await DB.settings.get();
    const prefs = s.preferences || {};
    const next = prefs.theme === 'dark' ? 'light' : 'dark';
    prefs.theme = next;
    await DB.settings.save({ ...s, preferences: prefs });
    _applyTheme(next);
  }

  // ── MOBILE DRAWER ─────────────────────────────────────────────
  function openMobileDrawer() {
    el('mobile-drawer')?.classList.add('open');
    el('drawer-backdrop')?.classList.add('open');
  }
  function closeMobileDrawer() {
    el('mobile-drawer')?.classList.remove('open');
    el('drawer-backdrop')?.classList.remove('open');
  }

  // ── SYNC BADGE ────────────────────────────────────────────────
  function updateSyncBadge() {
    const badge = el('sync-badge');
    if (!badge) return;
    const online = navigator.onLine;
    badge.textContent = online ? '● Online' : '○ Offline';
    badge.className = 'sync-badge ' + (online ? 'online' : 'offline');
  }

  // ── TOAST ─────────────────────────────────────────────────────
  function toast(msg, type = 'success', duration = 3000) {
    const t = el('toast-container');
    if (!t) return;
    const id = 'toast-' + Date.now();
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const div = document.createElement('div');
    div.id = id;
    div.className = `toast toast-${type}`;
    div.innerHTML = `<span class="toast-icon">${icons[type] || '✓'}</span><span>${msg}</span>`;
    t.appendChild(div);
    requestAnimationFrame(() => div.classList.add('show'));
    setTimeout(() => { div.classList.remove('show'); setTimeout(() => div.remove(), 300); }, duration);
  }

  // ── LOADING ───────────────────────────────────────────────────
  function loading(show, msg = 'Loading…') {
    const overlay = el('loading-overlay');
    const text    = el('loading-text');
    if (!overlay) return;
    overlay.classList.toggle('show', show);
    if (text) text.textContent = msg;
  }

  // ── MODAL ─────────────────────────────────────────────────────
  function openModal(id) {
    const m = el(id);
    if (!m) return;
    m.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(id) {
    const m = el(id);
    if (!m) return;
    m.classList.remove('open');
    document.body.style.overflow = '';
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      m.classList.remove('open');
    });
    document.body.style.overflow = '';
  }

  // ── CONFIRM DIALOG ────────────────────────────────────────────
  function confirm(msg, onYes, onNo) {
    const overlay = el('confirm-overlay');
    const msgEl   = el('confirm-msg');
    if (!overlay || !msgEl) { if (window.confirm(msg) && onYes) onYes(); return; }
    msgEl.textContent = msg;
    overlay.classList.add('open');

    const yesBtn = el('confirm-yes');
    const noBtn  = el('confirm-no');

    const cleanup = () => { overlay.classList.remove('open'); yesBtn.onclick = null; noBtn.onclick = null; };
    yesBtn.onclick = () => { cleanup(); onYes?.(); };
    noBtn.onclick  = () => { cleanup(); onNo?.(); };
  }

  // ── UTILITIES ─────────────────────────────────────────────────
  function el(id) { return document.getElementById(id); }

  function initials(first, last) {
    return ((first?.[0] || '') + (last?.[0] || '')).toUpperCase() || '?';
  }

  function fmtDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  }

  function fmtDateTime(isoStr) {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  }

  function calcAge(dob) {
    if (!dob) return '—';
    const diff = Date.now() - new Date(dob + 'T00:00:00').getTime();
    const y = Math.floor(diff / 31557600000);
    return y + ' yrs';
  }

  function calcAgeNum(dob) {
    if (!dob) return 0;
    return Math.floor((Date.now() - new Date(dob + 'T00:00:00').getTime()) / 31557600000);
  }

  function calcEDD(lmpStr) {
    if (!lmpStr) return null;
    const d = new Date(lmpStr + 'T00:00:00');
    d.setDate(d.getDate() + 280);
    return d.toISOString().slice(0, 10);
  }

  function calcGestationalAge(lmpStr, asOf) {
    if (!lmpStr) return null;
    const lmp  = new Date(lmpStr + 'T00:00:00');
    const now  = asOf ? new Date(asOf + 'T00:00:00') : new Date();
    const days = Math.floor((now - lmp) / 86400000);
    const weeks = Math.floor(days / 7);
    const rem   = days % 7;
    return { weeks, days: rem, total_days: days, label: `${weeks}w ${rem}d` };
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  function currencyFmt(n) {
    return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  }

  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  // Avatar colors for patients
  const AV_COLORS = ['#1a56db','#0e9f6e','#9061f9','#e74694','#e3a008','#16bdca','#f05252'];
  function avColor(str) {
    let h = 0;
    for (let i = 0; i < (str||'').length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
    return AV_COLORS[Math.abs(h) % AV_COLORS.length];
  }

  function avatar(first, last, size = 36) {
    const color = avColor((first||'') + (last||''));
    const ini   = initials(first, last);
    return `<div class="av" style="width:${size}px;height:${size}px;background:${color};font-size:${Math.round(size*0.4)}px">${ini}</div>`;
  }

  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── PRINT ─────────────────────────────────────────────────────
  function printElement(elementId, extraCss = '') {
    const content = el(elementId)?.innerHTML;
    if (!content) return;
    const w = window.open('', '_blank', 'width=800,height=900');
    w.document.write(`<!DOCTYPE html>
      <html><head><meta charset="UTF-8">
      <title>Print</title>
      <link rel="stylesheet" href="../css/app.css">
      <style>
        body { padding: 20px; background: white; }
        .no-print { display: none !important; }
        ${extraCss}
      </style>
      </head><body>${content}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 500);
  }

  // ── GLOBAL EVENTS ─────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    // Close search on outside click
    if (!e.target.closest('#search-wrapper')) closeSearch();
    // Close modals on backdrop click
    if (e.target.classList.contains('modal-overlay')) closeAllModals();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      el('global-search')?.focus();
    }
  });

  window.addEventListener('online',  () => { updateSyncBadge(); Sync.flush?.(); });
  window.addEventListener('offline', updateSyncBadge);

  // ── PUBLIC ────────────────────────────────────────────────────
  return {
    init, navigate, openPatient,
    handleSearch, closeSearch,
    toggleTheme,
    openMobileDrawer, closeMobileDrawer,
    updateSyncBadge,
    toast, loading, openModal, closeModal, closeAllModals, confirm,
    // Utilities (accessed by modules)
    el, initials, fmtDate, fmtDateTime, calcAge, calcAgeNum,
    calcEDD, calcGestationalAge, today, currencyFmt, autoGrow,
    avColor, avatar, escHtml, printElement,
    getPatientId: () => _currentPatientId,
    getUserId:    () => _userId || Sync.getUserId(),
    getSettings:  () => _settings,
  };
})();

window.App = App;

// Bootstrap
document.addEventListener('DOMContentLoaded', () => App.init());
