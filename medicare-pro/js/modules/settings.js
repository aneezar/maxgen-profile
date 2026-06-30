'use strict';

const SettingsModule = (() => {

  async function init() {}

  async function render(pageId) {
    const container = App.el('settings-content');
    if (!container) return;
    const s = await DB.settings.get();
    const profile  = s.profile  || {};
    const clinic   = s.clinic   || {};
    const prefs    = s.preferences || {};

    container.innerHTML = `
      <div class="page-header"><h2>⚙️ Settings</h2></div>
      <div class="tabs">
        <div class="tab-btn active" onclick="settingsTab('profile',this)">Doctor Profile</div>
        <div class="tab-btn" onclick="settingsTab('clinic',this)">Clinic Info</div>
        <div class="tab-btn" onclick="settingsTab('preferences',this)">Preferences</div>
        <div class="tab-btn" onclick="settingsTab('backup',this)">Backup &amp; Restore</div>
      </div>

      <!-- Profile -->
      <div class="tab-panel active" id="stab-profile">
        <div class="card">
          <div class="form-section-title">Doctor Information</div>
          <div class="form-row">
            <div class="form-group"><label>Full Name</label>
              <input class="form-control" id="sp-name" value="${App.escHtml(profile.name||'Dr. Bincy')}">
            </div>
            <div class="form-group"><label>Specialization</label>
              <input class="form-control" id="sp-spec" value="${App.escHtml(profile.specialization||'Gynecologist & Obstetrician')}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Registration Number</label>
              <input class="form-control" id="sp-reg" value="${App.escHtml(profile.registration||'')}">
            </div>
            <div class="form-group"><label>Qualifications</label>
              <input class="form-control" id="sp-qual" value="${App.escHtml(profile.qualifications||'')}" placeholder="MBBS, MD, DGO">
            </div>
          </div>
          <div class="form-group"><label>Signature / Footer Text for Prescriptions</label>
            <input class="form-control" id="sp-sig" value="${App.escHtml(profile.signature||'')}">
          </div>
          <button class="btn btn-primary mt-8" onclick="SettingsModule.saveProfile()">Save Profile</button>
        </div>
      </div>

      <!-- Clinic -->
      <div class="tab-panel" id="stab-clinic">
        <div class="card">
          <div class="form-section-title">Clinic Details</div>
          <div class="form-group"><label>Clinic Name</label>
            <input class="form-control" id="sc-name" value="${App.escHtml(clinic.name||'')}">
          </div>
          <div class="form-group"><label>Address</label>
            <textarea class="form-control" id="sc-addr" rows="2">${App.escHtml(clinic.address||'')}</textarea>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Phone</label>
              <input class="form-control" id="sc-phone" value="${App.escHtml(clinic.phone||'')}">
            </div>
            <div class="form-group"><label>Email</label>
              <input class="form-control" id="sc-email" value="${App.escHtml(clinic.email||'')}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Working Days</label>
              <input class="form-control" id="sc-days" value="${App.escHtml(clinic.working_days||'Mon-Sat')}">
            </div>
            <div class="form-group"><label>Working Hours</label>
              <input class="form-control" id="sc-hours" value="${App.escHtml(clinic.working_hours||'9am - 6pm')}">
            </div>
          </div>
          <div class="form-group"><label>Consultation Fee (₹)</label>
            <input class="form-control" type="number" id="sc-fee" value="${clinic.consultation_fee||500}">
          </div>
          <div class="form-group"><label>Clinic Logo / Header Text</label>
            <input class="form-control" id="sc-logo-text" value="${App.escHtml(clinic.logo_text||'')}">
          </div>
          <button class="btn btn-primary mt-8" onclick="SettingsModule.saveClinic()">Save Clinic Info</button>
        </div>
      </div>

      <!-- Preferences -->
      <div class="tab-panel" id="stab-preferences">
        <div class="card">
          <div class="form-section-title">App Preferences</div>
          <div class="form-group">
            <label>Theme</label>
            <select class="form-control" id="pref-theme">
              <option value="light" ${prefs.theme==='light'?'selected':''}>Light</option>
              <option value="dark"  ${prefs.theme==='dark'?'selected':''}> Dark</option>
            </select>
          </div>
          <div class="form-group">
            <label>Date Format</label>
            <select class="form-control" id="pref-datefmt">
              <option value="en-IN" ${prefs.date_format==='en-IN'?'selected':''}>DD-MM-YYYY (India)</option>
              <option value="en-US" ${prefs.date_format==='en-US'?'selected':''}>MM/DD/YYYY (US)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Currency Symbol</label>
            <select class="form-control" id="pref-currency">
              <option value="₹" ${prefs.currency==='₹'?'selected':''}>₹ Indian Rupee</option>
              <option value="$" ${prefs.currency==='$'?'selected':''}>$ US Dollar</option>
              <option value="AED" ${prefs.currency==='AED'?'selected':''}>AED (Dirham)</option>
            </select>
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:12px">
            <input type="checkbox" id="pref-audit" ${prefs.audit_enabled!==false?'checked':''}>
            Enable Audit Log
          </label>
          <button class="btn btn-primary mt-8" onclick="SettingsModule.savePreferences()">Save Preferences</button>
        </div>
        <div class="card mt-16">
          <div class="form-section-title">Supabase Configuration</div>
          <p class="text-sm text-muted mb-12">Cloud sync credentials — edit <strong>js/config.js</strong> directly.</p>
          <div class="form-group"><label>Supabase URL</label>
            <input class="form-control" disabled value="${window.APP_CONFIG?.SUPABASE_URL||'Not configured'}">
          </div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <span class="badge ${window.APP_CONFIG?.SUPABASE_URL?.includes('supabase') ? 'badge-green' : 'badge-orange'}">
              ${window.APP_CONFIG?.SUPABASE_URL?.includes('supabase') ? '✓ Configured' : '⚠ Not configured'}
            </span>
            <span id="sync-badge-settings" class="sync-badge ${navigator.onLine ? 'online' : 'offline'}">
              ${navigator.onLine ? '● Online' : '○ Offline'}
            </span>
          </div>
          <button class="btn btn-outline btn-sm mt-12" onclick="Sync.flush && Sync.flush()">⟳ Sync Now</button>
        </div>
      </div>

      <!-- Backup -->
      <div class="tab-panel" id="stab-backup">
        <div class="card">
          <div class="form-section-title">Export Data</div>
          <p class="text-sm text-muted mb-12">Export all patient data as a JSON backup file.</p>
          <button class="btn btn-primary" onclick="SettingsModule.exportBackup()">⬇️ Download Backup</button>
        </div>
        <div class="card mt-16">
          <div class="form-section-title">Import / Restore</div>
          <p class="text-sm text-muted mb-12">Restore from a previously exported JSON backup.</p>
          <input type="file" id="import-file" accept=".json" class="form-control mb-8">
          <button class="btn btn-outline" onclick="SettingsModule.importBackup()">⬆️ Restore Backup</button>
        </div>
        <div class="card mt-16">
          <div class="form-section-title" style="color:var(--danger)">Danger Zone</div>
          <p class="text-sm text-muted mb-12">Clear all local data. This cannot be undone. Cloud data (if configured) is unaffected.</p>
          <button class="btn btn-danger" onclick="SettingsModule.clearLocalData()">🗑 Clear All Local Data</button>
        </div>
      </div>
    `;

    // Tab function
    window.settingsTab = function(name, btn) {
      document.querySelectorAll('#stab-profile, #stab-clinic, #stab-preferences, #stab-backup').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('#settings-content .tab-btn').forEach(b => b.classList.remove('active'));
      App.el('stab-' + name)?.classList.add('active');
      btn?.classList.add('active');
    };
  }

  async function saveProfile() {
    const s = await DB.settings.get();
    s.profile = {
      name:           App.el('sp-name')?.value?.trim()  || 'Dr. Bincy',
      specialization: App.el('sp-spec')?.value?.trim()  || '',
      registration:   App.el('sp-reg')?.value?.trim()   || '',
      qualifications: App.el('sp-qual')?.value?.trim()  || '',
      signature:      App.el('sp-sig')?.value?.trim()   || '',
    };
    await DB.settings.save(s);
    App.toast('Profile saved');
    // Refresh sidebar
    const name = s.profile.name;
    const spec  = s.profile.specialization;
    App.el('sidebar-doc-name') && (App.el('sidebar-doc-name').textContent = name);
    App.el('sidebar-doc-spec') && (App.el('sidebar-doc-spec').textContent = spec);
    const ini = name.split(' ').filter(w => /[A-Z]/i.test(w[0])).map(w => w[0].toUpperCase()).join('').slice(0, 2);
    App.el('sidebar-av') && (App.el('sidebar-av').textContent = ini || 'Dr');
  }

  async function saveClinic() {
    const s = await DB.settings.get();
    s.clinic = {
      name:              App.el('sc-name')?.value?.trim()  || '',
      address:           App.el('sc-addr')?.value?.trim()  || '',
      phone:             App.el('sc-phone')?.value?.trim() || '',
      email:             App.el('sc-email')?.value?.trim() || '',
      working_days:      App.el('sc-days')?.value?.trim()  || '',
      working_hours:     App.el('sc-hours')?.value?.trim() || '',
      consultation_fee:  parseFloat(App.el('sc-fee')?.value) || 500,
      logo_text:         App.el('sc-logo-text')?.value?.trim() || '',
    };
    await DB.settings.save(s);
    App.toast('Clinic info saved');
  }

  async function savePreferences() {
    const s = await DB.settings.get();
    s.preferences = {
      theme:         App.el('pref-theme')?.value    || 'light',
      date_format:   App.el('pref-datefmt')?.value  || 'en-IN',
      currency:      App.el('pref-currency')?.value || '₹',
      audit_enabled: App.el('pref-audit')?.checked  ?? true,
    };
    await DB.settings.save(s);
    document.documentElement.setAttribute('data-theme', s.preferences.theme);
    App.toast('Preferences saved');
  }

  async function exportBackup() {
    App.loading(true, 'Preparing backup…');
    try {
      const tables = ['patients','appointments','consultations','gyn_history','obs_history',
        'pregnancies','anc_visits','ultrasounds','lab_results','prescriptions','invoices','app_settings'];
      const backup = { version: 1, exported_at: new Date().toISOString(), data: {} };
      for (const t of tables) {
        backup.data[t] = await DB.getAll(t);
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `medicare-pro-backup-${App.today()}.json`;
      a.click(); URL.revokeObjectURL(url);
      App.toast('Backup downloaded');
    } catch (e) { App.toast('Export failed: ' + e.message, 'error'); }
    finally { App.loading(false); }
  }

  async function importBackup() {
    const file = App.el('import-file')?.files[0];
    if (!file) { App.toast('Select a backup file first', 'warning'); return; }
    App.confirm('This will MERGE backup data with existing data. Continue?', async () => {
      App.loading(true, 'Importing…');
      try {
        const text   = await file.text();
        const backup = JSON.parse(text);
        if (!backup.data) throw new Error('Invalid backup file');
        for (const [table, records] of Object.entries(backup.data)) {
          for (const record of records) {
            await DB.put(table, record);
          }
        }
        App.toast(`Imported ${Object.values(backup.data).flat().length} records`);
      } catch (e) { App.toast('Import failed: ' + e.message, 'error'); }
      finally { App.loading(false); }
    });
  }

  async function clearLocalData() {
    App.confirm('Clear ALL local data? This cannot be undone.', async () => {
      App.loading(true, 'Clearing…');
      const tables = ['patients','appointments','consultations','gyn_history','obs_history',
        'pregnancies','anc_visits','ultrasounds','lab_results','prescriptions','invoices','documents','audit_log','sync_queue'];
      for (const t of tables) {
        await DB.clearStore(t);
      }
      App.loading(false);
      App.toast('All local data cleared', 'warning');
    });
  }

  return { init, render, saveProfile, saveClinic, savePreferences, exportBackup, importBackup, clearLocalData };
})();

window.SettingsModule = SettingsModule;
