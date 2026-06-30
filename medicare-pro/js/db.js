// ================================================================
// MediCare Pro — IndexedDB Layer (Offline-First)
// All reads/writes go through this module first.
// ================================================================
'use strict';

const DB = (() => {
  const CFG = window.APP_CONFIG;
  let _db = null;

  const STORES = [
    'patients','appointments','consultations','gyn_history','obs_history',
    'pregnancies','anc_visits','ultrasounds','lab_results','prescriptions',
    'invoices','documents','audit_log','app_settings','sync_queue'
  ];

  // ── OPEN ──────────────────────────────────────────────────────
  async function open() {
    if (_db) return _db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(CFG.DB_NAME, CFG.DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        const idx = (store, field, unique=false) =>
          store.createIndex(field, field, { unique });

        // patients
        if (!db.objectStoreNames.contains('patients')) {
          const s = db.createObjectStore('patients', { keyPath:'id' });
          idx(s,'patient_no', true); idx(s,'phone'); idx(s,'first_name'); idx(s,'last_name'); idx(s,'created_at');
        }
        // appointments
        if (!db.objectStoreNames.contains('appointments')) {
          const s = db.createObjectStore('appointments', { keyPath:'id' });
          idx(s,'patient_id'); idx(s,'date'); idx(s,'status');
        }
        // consultations
        if (!db.objectStoreNames.contains('consultations')) {
          const s = db.createObjectStore('consultations', { keyPath:'id' });
          idx(s,'patient_id'); idx(s,'date');
        }
        // gyn_history
        if (!db.objectStoreNames.contains('gyn_history')) {
          const s = db.createObjectStore('gyn_history', { keyPath:'id' });
          idx(s,'patient_id', true);
        }
        // obs_history
        if (!db.objectStoreNames.contains('obs_history')) {
          const s = db.createObjectStore('obs_history', { keyPath:'id' });
          idx(s,'patient_id', true);
        }
        // pregnancies
        if (!db.objectStoreNames.contains('pregnancies')) {
          const s = db.createObjectStore('pregnancies', { keyPath:'id' });
          idx(s,'patient_id'); idx(s,'status');
        }
        // anc_visits
        if (!db.objectStoreNames.contains('anc_visits')) {
          const s = db.createObjectStore('anc_visits', { keyPath:'id' });
          idx(s,'pregnancy_id'); idx(s,'patient_id'); idx(s,'date');
        }
        // ultrasounds
        if (!db.objectStoreNames.contains('ultrasounds')) {
          const s = db.createObjectStore('ultrasounds', { keyPath:'id' });
          idx(s,'patient_id'); idx(s,'pregnancy_id'); idx(s,'date');
        }
        // lab_results
        if (!db.objectStoreNames.contains('lab_results')) {
          const s = db.createObjectStore('lab_results', { keyPath:'id' });
          idx(s,'patient_id'); idx(s,'date');
        }
        // prescriptions
        if (!db.objectStoreNames.contains('prescriptions')) {
          const s = db.createObjectStore('prescriptions', { keyPath:'id' });
          idx(s,'patient_id'); idx(s,'date'); idx(s,'prescription_no', true);
        }
        // invoices
        if (!db.objectStoreNames.contains('invoices')) {
          const s = db.createObjectStore('invoices', { keyPath:'id' });
          idx(s,'patient_id'); idx(s,'date'); idx(s,'status'); idx(s,'invoice_no', true);
        }
        // documents
        if (!db.objectStoreNames.contains('documents')) {
          const s = db.createObjectStore('documents', { keyPath:'id' });
          idx(s,'patient_id'); idx(s,'date');
        }
        // audit_log
        if (!db.objectStoreNames.contains('audit_log')) {
          const s = db.createObjectStore('audit_log', { keyPath:'id' });
          idx(s,'timestamp');
        }
        // app_settings
        if (!db.objectStoreNames.contains('app_settings')) {
          db.createObjectStore('app_settings', { keyPath:'id' });
        }
        // sync_queue
        if (!db.objectStoreNames.contains('sync_queue')) {
          const s = db.createObjectStore('sync_queue', { keyPath:'id', autoIncrement:true });
          idx(s,'timestamp'); idx(s,'table_name');
        }
      };

      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ── LOW-LEVEL HELPERS ─────────────────────────────────────────
  function txn(storeName, mode='readonly') {
    return _db.transaction(storeName, mode).objectStore(storeName);
  }

  function req2p(r) {
    return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  }

  function getAll(storeName, indexName, value) {
    const store = txn(storeName);
    if (indexName && value !== undefined) {
      const idx = store.index(indexName);
      return req2p(idx.getAll(value));
    }
    return req2p(store.getAll());
  }

  function getOne(storeName, id) {
    return req2p(txn(storeName).get(id));
  }

  function put(storeName, data) {
    return req2p(txn(storeName, 'readwrite').put(data));
  }

  function del(storeName, id) {
    return req2p(txn(storeName, 'readwrite').delete(id));
  }

  function getByIndex(storeName, indexName, value) {
    return req2p(txn(storeName).index(indexName).get(value));
  }

  // Get range (date range queries)
  function getRange(storeName, indexName, lower, upper) {
    const range = IDBKeyRange.bound(lower, upper);
    return req2p(txn(storeName).index(indexName).getAll(range));
  }

  // ── SYNC QUEUE ────────────────────────────────────────────────
  async function enqueue(operation, tableName, data, recordId) {
    const store = txn('sync_queue', 'readwrite');
    return req2p(store.add({
      operation,  // 'insert' | 'update' | 'delete'
      table_name: tableName,
      record_id:  recordId || data?.id,
      data,
      timestamp:  new Date().toISOString(),
      synced:     false
    }));
  }

  async function getQueueItems() {
    const items = await getAll('sync_queue');
    return items.filter(i => !i.synced).sort((a,b) => a.timestamp.localeCompare(b.timestamp));
  }

  async function markSynced(id) {
    const store = txn('sync_queue', 'readwrite');
    const item = await req2p(store.get(id));
    if (item) { item.synced = true; await req2p(store.put(item)); }
  }

  async function clearSyncedQueue() {
    const store = txn('sync_queue', 'readwrite');
    const all = await req2p(store.getAll());
    for (const item of all.filter(i => i.synced)) {
      await req2p(store.delete(item.id));
    }
  }

  // ── AUDIT LOG ─────────────────────────────────────────────────
  async function audit(action, tableName, recordId, summary) {
    if (!window.APP_CONFIG.AUDIT_ENABLED) return;
    const entry = {
      id:         crypto.randomUUID(),
      timestamp:  new Date().toISOString(),
      action, table_name: tableName, record_id: recordId, summary
    };
    await put('audit_log', entry);
  }

  // ── UUID ──────────────────────────────────────────────────────
  function uuid() { return crypto.randomUUID(); }
  function now()  { return new Date().toISOString(); }

  // ── HIGH-LEVEL CRUD ───────────────────────────────────────────

  // PATIENTS
  const patients = {
    async create(data) {
      const record = { ...data, id: uuid(), created_at: now(), updated_at: now() };
      await put('patients', record);
      await enqueue('insert', 'patients', record);
      await audit('create', 'patients', record.id, `Registered ${record.first_name} ${record.last_name}`);
      return record;
    },
    async update(id, data) {
      const existing = await getOne('patients', id);
      if (!existing) throw new Error('Patient not found');
      const record = { ...existing, ...data, id, updated_at: now() };
      await put('patients', record);
      await enqueue('update', 'patients', record);
      await audit('update', 'patients', id, `Updated ${record.first_name} ${record.last_name}`);
      return record;
    },
    async delete(id) {
      const existing = await getOne('patients', id);
      await del('patients', id);
      await enqueue('delete', 'patients', { id });
      await audit('delete', 'patients', id, `Deleted patient`);
    },
    async get(id)           { return getOne('patients', id); },
    async getAll()          { return getAll('patients'); },
    async search(query) {
      const all = await getAll('patients');
      if (!query) return all.filter(p => !p.deleted_at).sort((a,b) => b.created_at.localeCompare(a.created_at));
      const q = query.toLowerCase();
      return all.filter(p =>
        !p.deleted_at && (
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
          (p.phone||'').includes(q) ||
          (p.patient_no||'').toLowerCase().includes(q) ||
          (p.husband_name||'').toLowerCase().includes(q)
        )
      ).sort((a,b) => b.created_at.localeCompare(a.created_at));
    }
  };

  // APPOINTMENTS
  const appointments = {
    async create(data) {
      const record = { ...data, id: uuid(), created_at: now(), updated_at: now() };
      await put('appointments', record);
      await enqueue('insert', 'appointments', record);
      return record;
    },
    async update(id, data) {
      const existing = await getOne('appointments', id);
      const record = { ...existing, ...data, id, updated_at: now() };
      await put('appointments', record);
      await enqueue('update', 'appointments', record);
      return record;
    },
    async delete(id) { await del('appointments', id); await enqueue('delete', 'appointments', { id }); },
    async get(id)                         { return getOne('appointments', id); },
    async getByPatient(patientId)         { return getAll('appointments', 'patient_id', patientId); },
    async getByDate(date)                 { return getAll('appointments', 'date', date); },
    async getRange(from, to)              { return getRange('appointments', 'date', from, to); },
    async getUpcoming(limit=10) {
      const today = new Date().toISOString().slice(0,10);
      const all = await getRange('appointments', 'date', today, '2099-12-31');
      return all.filter(a => a.status === 'scheduled').sort((a,b) => a.date.localeCompare(b.date)).slice(0, limit);
    }
  };

  // CONSULTATIONS
  const consultations = {
    async create(data) {
      const record = { ...data, id: uuid(), created_at: now(), updated_at: now() };
      await put('consultations', record);
      await enqueue('insert', 'consultations', record);
      return record;
    },
    async update(id, data) {
      const existing = await getOne('consultations', id);
      const record = { ...existing, ...data, id, updated_at: now() };
      await put('consultations', record);
      await enqueue('update', 'consultations', record);
      return record;
    },
    async delete(id) { await del('consultations', id); await enqueue('delete','consultations',{id}); },
    async get(id)               { return getOne('consultations', id); },
    async getByPatient(pid)     { const all = await getAll('consultations','patient_id',pid); return all.sort((a,b)=>b.date.localeCompare(a.date)); },
    async getRecent(limit=5)    { const all = await getAll('consultations'); return all.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,limit); }
  };

  // GYN HISTORY
  const gynHistory = {
    async upsert(data) {
      const existing = await getByIndex('gyn_history', 'patient_id', data.patient_id);
      const record = existing ? { ...existing, ...data, updated_at: now() } : { ...data, id: uuid(), created_at: now(), updated_at: now() };
      await put('gyn_history', record);
      await enqueue(existing ? 'update' : 'insert', 'gyn_history', record);
      return record;
    },
    async getByPatient(pid) { return getByIndex('gyn_history', 'patient_id', pid); }
  };

  // OBS HISTORY
  const obsHistory = {
    async upsert(data) {
      const existing = await getByIndex('obs_history', 'patient_id', data.patient_id);
      const record = existing ? { ...existing, ...data, updated_at: now() } : { ...data, id: uuid(), created_at: now(), updated_at: now() };
      await put('obs_history', record);
      await enqueue(existing ? 'update' : 'insert', 'obs_history', record);
      return record;
    },
    async getByPatient(pid) { return getByIndex('obs_history', 'patient_id', pid); }
  };

  // PREGNANCIES
  const pregnancies = {
    async create(data) {
      const record = { ...data, id: uuid(), created_at: now(), updated_at: now() };
      await put('pregnancies', record);
      await enqueue('insert', 'pregnancies', record);
      return record;
    },
    async update(id, data) {
      const existing = await getOne('pregnancies', id);
      const record = { ...existing, ...data, id, updated_at: now() };
      await put('pregnancies', record);
      await enqueue('update', 'pregnancies', record);
      return record;
    },
    async get(id)                     { return getOne('pregnancies', id); },
    async getByPatient(pid)           { const all = await getAll('pregnancies','patient_id',pid); return all.sort((a,b)=>b.created_at.localeCompare(a.created_at)); },
    async getActive(pid) {
      const all = await getAll('pregnancies','patient_id',pid);
      return all.filter(p => p.status === 'active');
    }
  };

  // ANC VISITS
  const ancVisits = {
    async create(data) {
      const record = { ...data, id: uuid(), created_at: now() };
      await put('anc_visits', record);
      await enqueue('insert', 'anc_visits', record);
      return record;
    },
    async update(id, data) {
      const existing = await getOne('anc_visits', id);
      const record = { ...existing, ...data, id };
      await put('anc_visits', record);
      await enqueue('update', 'anc_visits', record);
      return record;
    },
    async delete(id) { await del('anc_visits', id); await enqueue('delete','anc_visits',{id}); },
    async get(id)                   { return getOne('anc_visits', id); },
    async getByPregnancy(pregId)    { const all = await getAll('anc_visits','pregnancy_id',pregId); return all.sort((a,b)=>a.date.localeCompare(b.date)); }
  };

  // ULTRASOUNDS
  const ultrasounds = {
    async create(data) {
      const record = { ...data, id: uuid(), created_at: now() };
      await put('ultrasounds', record);
      await enqueue('insert', 'ultrasounds', record);
      return record;
    },
    async get(id)               { return getOne('ultrasounds', id); },
    async getByPatient(pid)     { const all = await getAll('ultrasounds','patient_id',pid); return all.sort((a,b)=>b.date.localeCompare(a.date)); },
    async getByPregnancy(pregId){ const all = await getAll('ultrasounds','pregnancy_id',pregId); return all.sort((a,b)=>b.date.localeCompare(a.date)); },
    async delete(id) { await del('ultrasounds', id); await enqueue('delete','ultrasounds',{id}); }
  };

  // LAB RESULTS
  const labResults = {
    async create(data) {
      const record = { ...data, id: uuid(), created_at: now() };
      await put('lab_results', record);
      await enqueue('insert', 'lab_results', record);
      return record;
    },
    async get(id)           { return getOne('lab_results', id); },
    async getByPatient(pid) { const all = await getAll('lab_results','patient_id',pid); return all.sort((a,b)=>b.date.localeCompare(a.date)); },
    async delete(id) { await del('lab_results', id); await enqueue('delete','lab_results',{id}); }
  };

  // PRESCRIPTIONS
  const prescriptions = {
    async create(data) {
      const record = { ...data, id: uuid(), created_at: now() };
      await put('prescriptions', record);
      await enqueue('insert', 'prescriptions', record);
      return record;
    },
    async get(id)           { return getOne('prescriptions', id); },
    async getByPatient(pid) { const all = await getAll('prescriptions','patient_id',pid); return all.sort((a,b)=>b.date.localeCompare(a.date)); },
    async delete(id) { await del('prescriptions', id); await enqueue('delete','prescriptions',{id}); }
  };

  // INVOICES
  const invoices = {
    async create(data) {
      const record = { ...data, id: uuid(), created_at: now(), updated_at: now() };
      await put('invoices', record);
      await enqueue('insert', 'invoices', record);
      return record;
    },
    async update(id, data) {
      const existing = await getOne('invoices', id);
      const record = { ...existing, ...data, id, updated_at: now() };
      await put('invoices', record);
      await enqueue('update', 'invoices', record);
      return record;
    },
    async get(id)           { return getOne('invoices', id); },
    async getByPatient(pid) { const all = await getAll('invoices','patient_id',pid); return all.sort((a,b)=>b.date.localeCompare(a.date)); },
    async getAll()          { return getAll('invoices'); },
    async delete(id) { await del('invoices', id); await enqueue('delete','invoices',{id}); }
  };

  // DOCUMENTS
  const documents = {
    async create(data) {
      const record = { ...data, id: uuid(), created_at: now() };
      await put('documents', record);
      await enqueue('insert', 'documents', record);
      return record;
    },
    async get(id)           { return getOne('documents', id); },
    async getByPatient(pid) { const all = await getAll('documents','patient_id',pid); return all.sort((a,b)=>b.date.localeCompare(a.date)); },
    async delete(id) { await del('documents', id); await enqueue('delete','documents',{id}); }
  };

  // SETTINGS
  const settings = {
    async get() {
      const all = await getAll('app_settings');
      return all[0] || { id: 'settings', profile:{}, clinic:{}, preferences:{ theme:'light', lang:'en' } };
    },
    async save(data) {
      const existing = await this.get();
      const record = { ...existing, ...data, id: 'settings', updated_at: now() };
      await put('app_settings', record);
      await enqueue('update', 'app_settings', record);
      return record;
    }
  };

  // AUDIT LOG READ
  const auditLog = {
    async getAll(limit=50) { const all = await getAll('audit_log'); return all.sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,limit); }
  };

  // STATS for dashboard
  async function getDashboardStats() {
    const today = new Date().toISOString().slice(0,10);
    const ym = today.slice(0,7);
    const [allPatients, todayAppts, allConsult, allPreg] = await Promise.all([
      getAll('patients'),
      getAll('appointments','date',today),
      getAll('consultations'),
      getAll('pregnancies')
    ]);
    const monthConsult = allConsult.filter(c => c.date?.startsWith(ym));
    const activePreg = allPreg.filter(p => p.status === 'active');
    return {
      totalPatients:      allPatients.filter(p => !p.deleted_at).length,
      todayAppointments:  todayAppts.filter(a => a.status === 'scheduled').length,
      activePregnancies:  activePreg.length,
      monthConsultations: monthConsult.length,
    };
  }

  // EXPORT all data for backup
  async function exportAll() {
    const result = {};
    for (const store of STORES) {
      result[store] = await getAll(store);
    }
    return result;
  }

  // IMPORT data (restore)
  async function importAll(data) {
    for (const [storeName, records] of Object.entries(data)) {
      if (!STORES.includes(storeName)) continue;
      const store = txn(storeName, 'readwrite');
      for (const record of records) {
        await req2p(store.put(record));
      }
    }
  }

  // ── MISSING CONVENIENCE METHODS ──────────────────────────────
  // Alias list() → getAll / search()
  patients.list = () => patients.search('');

  appointments.list     = () => getAll('appointments').then(a => a.sort((x,y) => y.date.localeCompare(x.date)));
  appointments.byDate   = (d) => appointments.getByDate(d);
  appointments.byPatient= (id) => appointments.getByPatient(id);
  appointments.upcoming = (days=7) => {
    const today = new Date().toISOString().slice(0,10);
    const limit = new Date(Date.now() + days*86400000).toISOString().slice(0,10);
    return getRange('appointments','date',today,limit);
  };

  consultations.list = () => getAll('consultations').then(a => a.sort((x,y) => y.date.localeCompare(x.date)));
  consultations.byPatient = (id) => consultations.getByPatient(id);

  pregnancies.list   = () => getAll('pregnancies').then(a => a.sort((x,y) => y.created_at.localeCompare(x.created_at)));
  pregnancies.active = () => getAll('pregnancies').then(a => a.filter(p => p.status === 'active'));
  pregnancies.byPatient = (id) => pregnancies.getByPatient(id);
  pregnancies.delete = async (id) => { await del('pregnancies', id); await enqueue('delete','pregnancies',{id}); };

  ancVisits.list      = () => getAll('anc_visits').then(a => a.sort((x,y) => y.date.localeCompare(x.date)));
  ancVisits.byPatient = (id) => getAll('anc_visits','patient_id',id).then(a => a.sort((x,y) => y.date.localeCompare(x.date)));

  ultrasounds.list   = () => getAll('ultrasounds').then(a => a.sort((x,y) => y.date.localeCompare(x.date)));
  ultrasounds.update = async (id, data) => {
    const existing = await getOne('ultrasounds', id);
    const record = { ...existing, ...data, id };
    await put('ultrasounds', record);
    await enqueue('update','ultrasounds',record);
    return record;
  };

  labResults.list   = () => getAll('lab_results').then(a => a.sort((x,y) => y.date.localeCompare(x.date)));
  labResults.update = async (id, data) => {
    const existing = await getOne('lab_results', id);
    const record = { ...existing, ...data, id };
    await put('lab_results', record);
    await enqueue('update','lab_results',record);
    return record;
  };

  prescriptions.list   = () => getAll('prescriptions').then(a => a.sort((x,y) => y.date.localeCompare(x.date)));
  prescriptions.byPatient = (id) => prescriptions.getByPatient(id);
  prescriptions.update = async (id, data) => {
    const existing = await getOne('prescriptions', id);
    const record = { ...existing, ...data, id };
    await put('prescriptions', record);
    await enqueue('update','prescriptions',record);
    return record;
  };

  invoices.list     = () => invoices.getAll();
  invoices.byPatient= (id) => invoices.getByPatient(id);

  // clearStore — for backup/restore wipe
  async function clearStore(storeName) {
    const store = txn(storeName, 'readwrite');
    return req2p(store.clear());
  }

  // ── PUBLIC API ────────────────────────────────────────────────
  return {
    open, uuid, now,
    patients, appointments, consultations,
    gynHistory, obsHistory, pregnancies, ancVisits,
    ultrasounds, labResults, prescriptions, invoices, documents,
    settings, auditLog,
    getDashboardStats, exportAll, importAll,
    // queue
    enqueue, getQueueItems, markSynced, clearSyncedQueue,
    // direct access for sync / backup
    put, getOne, getAll: (t) => getAll(t), clearStore,
  };
})();

window.DB = DB;
