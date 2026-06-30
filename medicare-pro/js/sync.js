// ================================================================
// MediCare Pro — Sync Engine
// Offline-first: IndexedDB → Supabase background sync
// ================================================================
'use strict';

const Sync = (() => {
  const CFG = window.APP_CONFIG;
  let _supabase = null;
  let _userId   = null;
  let _timer    = null;
  let _online   = navigator.onLine;
  let _syncInProgress = false;

  const configured = () =>
    CFG.SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
    CFG.SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';

  // ── INIT ──────────────────────────────────────────────────────
  async function init() {
    if (!configured()) return;

    _supabase = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });

    // Auth state
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
      _userId = session.user.id;
      _setupSync();
    }

    _supabase.auth.onAuthStateChange((_event, session) => {
      _userId = session?.user?.id || null;
      if (_userId) _setupSync();
      else         _teardownSync();
    });

    window.addEventListener('online',  _onOnline);
    window.addEventListener('offline', _onOffline);

    return _supabase;
  }

  function _setupSync() {
    if (_timer) clearInterval(_timer);
    _timer = setInterval(flush, CFG.SYNC_INTERVAL_MS);
    // Sync on start if online
    if (navigator.onLine) setTimeout(flush, 2000);
  }

  function _teardownSync() {
    if (_timer) { clearInterval(_timer); _timer = null; }
  }

  async function _onOnline() {
    _online = true;
    _updateStatusBadge(true);
    await flush();
  }

  function _onOffline() {
    _online = false;
    _updateStatusBadge(false);
  }

  function _updateStatusBadge(online) {
    const el = document.getElementById('sync-badge');
    if (!el) return;
    el.textContent = online ? '● Online' : '○ Offline';
    el.className   = 'sync-badge ' + (online ? 'online' : 'offline');
  }

  // ── FLUSH QUEUE → SUPABASE ────────────────────────────────────
  async function flush() {
    if (!_supabase || !_userId || !navigator.onLine || _syncInProgress) return;
    _syncInProgress = true;

    try {
      const queue = await DB.getQueueItems();
      if (!queue.length) return;

      for (const item of queue) {
        try {
          await _processQueueItem(item);
          await DB.markSynced(item.id);
        } catch (err) {
          console.warn('[Sync] Failed to process queue item', item.id, err.message);
        }
      }

      await DB.clearSyncedQueue();
    } finally {
      _syncInProgress = false;
    }
  }

  async function _processQueueItem(item) {
    if (!_supabase) return;
    const tableName = item.table_name;

    if (item.operation === 'insert') {
      const payload = { ...item.data, user_id: _userId };
      // Remove IndexedDB-only fields
      delete payload._local;
      const { error } = await _supabase.from(tableName).upsert(payload, { onConflict: 'id' });
      if (error) throw error;

    } else if (item.operation === 'update') {
      const payload = { ...item.data, user_id: _userId };
      delete payload._local;
      const { error } = await _supabase.from(tableName).upsert(payload, { onConflict: 'id' });
      if (error) throw error;

    } else if (item.operation === 'delete') {
      const { error } = await _supabase.from(tableName).delete().eq('id', item.record_id);
      if (error) throw error;
    }
  }

  // ── PULL FROM SUPABASE → INDEXEDDB ───────────────────────────
  // Called once on first login to hydrate local DB from cloud
  async function pullAll() {
    if (!_supabase || !_userId || !navigator.onLine) return;

    const TABLES = [
      'patients','appointments','consultations','gyn_history','obs_history',
      'pregnancies','anc_visits','ultrasounds','lab_results','prescriptions',
      'invoices','documents','app_settings'
    ];

    for (const tableName of TABLES) {
      try {
        const { data, error } = await _supabase
          .from(tableName).select('*').eq('user_id', _userId);
        if (error || !data) continue;

        for (const record of data) {
          await DB.put(tableName, record);
        }
      } catch (err) {
        console.warn(`[Sync] Pull failed for ${tableName}:`, err.message);
      }
    }
  }

  // ── AUTH ──────────────────────────────────────────────────────
  async function signIn(email, password) {
    if (!_supabase) throw new Error('Supabase not configured');
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    _userId = data.user.id;
    _setupSync();
    // Pull cloud data into local DB
    await pullAll();
    return data.user;
  }

  async function signUp(email, password) {
    if (!_supabase) throw new Error('Supabase not configured');
    const { data, error } = await _supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    if (_supabase) await _supabase.auth.signOut();
    _userId = null;
    _teardownSync();
  }

  async function getSession() {
    if (!_supabase) return null;
    const { data: { session } } = await _supabase.auth.getSession();
    return session;
  }

  function isConfigured() { return configured(); }
  function getUserId()    { return _userId; }
  function isOnline()     { return navigator.onLine; }
  function getClient()    { return _supabase; }

  return { init, flush, pullAll, signIn, signUp, signOut, getSession, isConfigured, getUserId, isOnline, getClient };
})();

window.Sync = Sync;
