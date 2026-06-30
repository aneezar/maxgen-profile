'use strict';

const ConsultationsModule = (() => {
  let _editId = null;
  let _patientId = null;

  async function init() {}

  async function render() {
    const consults = await DB.consultations.list();
    const container = App.el('consultations-content');
    if (!container) return;

    if (!consults.length) {
      container.innerHTML = `<div class="card"><div class="empty-state">
        <div class="empty-icon">📋</div><h3>No consultation notes</h3>
        <button class="btn btn-primary mt-16" onclick="ConsultationsModule.openNew()">➕ New Note</button>
      </div></div>`;
      return;
    }

    container.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Date</th><th>Patient</th><th>Type</th><th>Complaint</th><th>Diagnosis</th><th>Vitals</th><th></th></tr></thead>
          <tbody id="consult-tbody">
            ${consults.map(c => `
              <tr>
                <td>${App.fmtDate(c.date)}</td>
                <td id="cpt-${c.id}">Loading…</td>
                <td>${c.visit_type||'consultation'}</td>
                <td>${App.escHtml((c.chief_complaint||'').slice(0,40))}</td>
                <td>${App.escHtml((c.diagnosis||'').slice(0,40))}</td>
                <td class="text-sm">${c.bp?'BP:'+c.bp:''} ${c.weight?'Wt:'+c.weight+'kg':''}</td>
                <td><div class="table-actions">
                  <button class="btn btn-ghost btn-sm" onclick="ConsultationsModule.openEdit('${c.id}')">✏️</button>
                  <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="ConsultationsModule.delete('${c.id}')">🗑</button>
                </div></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;

    for (const c of consults) {
      const pt = await DB.patients.get(c.patient_id);
      const el = App.el('cpt-' + c.id);
      if (el && pt) el.innerHTML = `<a onclick="PatientsModule.openDetail('${pt.id}')" style="cursor:pointer;color:var(--primary)">${App.escHtml(pt.first_name)} ${App.escHtml(pt.last_name)}</a>`;
    }
  }

  async function openNew(patientId) {
    _editId = null;
    _patientId = patientId || null;
    const patients = await DB.patients.list();
    App.el('modal-consult-title').textContent = 'New Consultation Note';
    App.el('modal-consult-body').innerHTML = _form({}, patients, patientId);
    App.openModal('modal-consult');
  }

  async function openEdit(id) {
    _editId = id;
    const [c, patients] = await Promise.all([DB.consultations.get(id), DB.patients.list()]);
    App.el('modal-consult-title').textContent = 'Edit Consultation';
    App.el('modal-consult-body').innerHTML = _form(c, patients, c.patient_id);
    App.openModal('modal-consult');
  }

  function view(id) { openEdit(id); }

  function _form(c, patients, selPid) {
    return `
      <div class="form-row">
        <div class="form-group">
          <label>Patient *</label>
          <select class="form-control" id="cf-patient">
            <option value="">— Select —</option>
            ${patients.map(p=>`<option value="${p.id}" ${p.id===selPid?'selected':''}>${p.first_name} ${p.last_name} (${p.patient_no||''})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Date *</label>
          <input class="form-control" type="date" id="cf-date" value="${c.date||App.today()}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Visit Type</label>
          <select class="form-control" id="cf-type">
            ${['consultation','follow-up','anc','emergency','procedure','review'].map(v=>`<option ${c.visit_type===v?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Next Visit</label>
          <input class="form-control" type="date" id="cf-next" value="${c.next_visit||''}">
        </div>
      </div>
      <div class="form-section-title mt-12">Vitals</div>
      <div class="vitals-grid">
        <div class="form-group">
          <label>Weight (kg)</label>
          <input class="form-control" type="number" step="0.1" id="cf-wt" value="${c.weight||''}">
        </div>
        <div class="form-group">
          <label>Height (cm)</label>
          <input class="form-control" type="number" id="cf-ht" value="${c.height||''}">
        </div>
        <div class="form-group">
          <label>BP (mmHg)</label>
          <input class="form-control" placeholder="120/80" id="cf-bp" value="${c.bp||''}">
        </div>
        <div class="form-group">
          <label>Pulse (/min)</label>
          <input class="form-control" type="number" id="cf-pulse" value="${c.pulse||''}">
        </div>
        <div class="form-group">
          <label>Temp (°F)</label>
          <input class="form-control" type="number" step="0.1" id="cf-temp" value="${c.temperature||''}">
        </div>
        <div class="form-group">
          <label>SpO2 (%)</label>
          <input class="form-control" type="number" id="cf-spo2" value="${c.spo2||''}">
        </div>
      </div>
      <div class="form-section-title">Clinical Notes</div>
      <div class="form-group">
        <label>Chief Complaint</label>
        <textarea class="form-control" id="cf-cc" rows="2">${App.escHtml(c.chief_complaint||'')}</textarea>
      </div>
      <div class="form-group">
        <label>History</label>
        <textarea class="form-control" id="cf-hist" rows="2">${App.escHtml(c.history||'')}</textarea>
      </div>
      <div class="form-group">
        <label>Examination Findings</label>
        <textarea class="form-control" id="cf-exam" rows="2">${App.escHtml(c.examination||'')}</textarea>
      </div>
      <div class="form-group">
        <label>Diagnosis</label>
        <textarea class="form-control" id="cf-dx" rows="2">${App.escHtml(c.diagnosis||'')}</textarea>
      </div>
      <div class="form-group">
        <label>Plan / Management</label>
        <textarea class="form-control" id="cf-plan" rows="2">${App.escHtml(c.plan||'')}</textarea>
      </div>
      <div class="form-group">
        <label>Next Visit Notes</label>
        <input class="form-control" id="cf-nextnotes" value="${App.escHtml(c.next_visit_notes||'')}">
      </div>
    `;
  }

  async function save() {
    const pid = App.el('cf-patient')?.value;
    const date = App.el('cf-date')?.value;
    if (!pid || !date) { App.toast('Patient and date required', 'warning'); return; }
    const v = id => App.el(id)?.value?.trim() || null;
    const n = id => parseFloat(App.el(id)?.value) || null;
    const data = {
      patient_id: pid, date,
      visit_type: v('cf-type') || 'consultation',
      weight: n('cf-wt'), height: n('cf-ht'),
      bp: v('cf-bp'), pulse: n('cf-pulse'),
      temperature: n('cf-temp'), spo2: n('cf-spo2'),
      chief_complaint: v('cf-cc'), history: v('cf-hist'),
      examination: v('cf-exam'), diagnosis: v('cf-dx'),
      plan: v('cf-plan'), next_visit: v('cf-next'),
      next_visit_notes: v('cf-nextnotes'),
    };
    try {
      if (_editId) await DB.consultations.update(_editId, data);
      else         await DB.consultations.create(data);
      App.closeModal('modal-consult');
      App.toast('Consultation saved');
      render();
    } catch (e) { App.toast(e.message, 'error'); }
  }

  async function deleteConsult(id) {
    App.confirm('Delete this consultation?', async () => {
      await DB.consultations.delete(id);
      App.toast('Deleted');
      render();
    });
  }

  return { init, render, openNew, openEdit, view, save, delete: deleteConsult };
})();

window.ConsultationsModule = ConsultationsModule;
