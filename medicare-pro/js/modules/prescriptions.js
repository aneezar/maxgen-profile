'use strict';

const PrescriptionsModule = (() => {
  let _editId = null;
  let _drugs  = [];
  let _settingsCache = null;

  async function init() {}

  async function render() {
    const rxList = await DB.prescriptions.list();
    const container = App.el('prescriptions-content');
    if (!container) return;

    if (!rxList.length) {
      container.innerHTML = `<div class="card"><div class="empty-state">
        <div class="empty-icon">💊</div><h3>No prescriptions</h3>
        <button class="btn btn-primary mt-16" onclick="PrescriptionsModule.openNew()">➕ New Prescription</button>
      </div></div>`;
      return;
    }

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${rxList.map(rx => `
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">${rx.prescription_no||'Rx'} <span class="text-muted text-sm">· ${App.fmtDate(rx.date)}</span></div>
                <div class="card-subtitle" id="rxpt-${rx.id}">Loading…</div>
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn btn-success btn-sm" onclick="PrescriptionsModule.openView('${rx.id}')">🖨 Print</button>
                <button class="btn btn-ghost btn-sm" onclick="PrescriptionsModule.openEdit('${rx.id}')">✏️</button>
                <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="PrescriptionsModule.delete('${rx.id}')">🗑</button>
              </div>
            </div>
            <div class="text-sm text-muted mb-8">${App.escHtml(rx.diagnosis||'')}</div>
            <div>${(rx.drugs||[]).map(d=>`<div class="text-sm">• <strong>${App.escHtml(d.name||'')}</strong> ${App.escHtml(d.strength||'')} — ${App.escHtml(d.sig||'')} × ${d.days||''} days</div>`).join('')}</div>
          </div>
        `).join('')}
      </div>`;

    for (const rx of rxList) {
      const pt = await DB.patients.get(rx.patient_id);
      const el = App.el('rxpt-' + rx.id);
      if (el && pt) el.textContent = `${pt.first_name} ${pt.last_name} · ${pt.patient_no||''}`;
    }
  }

  async function openNew(patientId) {
    _editId = null;
    _drugs  = [_emptyDrug()];
    const patients = await DB.patients.list();
    App.el('modal-rx-title').textContent = 'New Prescription';
    App.el('modal-rx-body').innerHTML = _form({}, patients, patientId);
    _renderDrugs();
    App.openModal('modal-rx');
  }

  async function openEdit(id) {
    _editId = id;
    const [rx, patients] = await Promise.all([DB.prescriptions.get(id), DB.patients.list()]);
    _drugs = (rx.drugs || []).length ? rx.drugs.map(d => ({...d})) : [_emptyDrug()];
    App.el('modal-rx-title').textContent = 'Edit Prescription';
    App.el('modal-rx-body').innerHTML = _form(rx, patients, rx.patient_id);
    _renderDrugs();
    App.openModal('modal-rx');
  }

  async function openView(id) {
    const rx = await DB.prescriptions.get(id);
    const pt = await DB.patients.get(rx.patient_id);
    const s  = await DB.settings.get();
    const clinic = s.clinic || {};
    const doctor = s.profile || {};

    const w = window.open('', '_blank', 'width=700,height=900');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Prescription ${rx.prescription_no||''}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; color: #111; max-width: 600px; margin: auto; }
        .header { text-align:center; border-bottom: 2px solid #1a56db; padding-bottom: 14px; margin-bottom: 20px; }
        .header h2 { color: #1a56db; margin: 0; font-size: 22px; }
        .header p  { margin: 2px 0; font-size: 13px; color: #555; }
        .rx-symbol { font-size: 32px; color: #1a56db; font-style: italic; }
        .pt-info { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:20px; font-size:13px; }
        .drug-list { list-style: none; padding: 0; }
        .drug-item { padding: 10px 0; border-bottom: 1px dashed #ddd; }
        .drug-name { font-size: 15px; font-weight: 700; }
        .drug-sig  { font-size: 13px; color: #444; margin-top: 3px; }
        .advice    { background: #f0f4ff; border-radius: 8px; padding: 12px; margin-top: 20px; font-size: 13px; }
        .footer    { margin-top: 30px; display:flex; justify-content:space-between; font-size: 12px; color: #777; }
        .sign      { text-align:right; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>
      <div class="header">
        <h2>${clinic.name || 'Gynecology Clinic'}</h2>
        <p>${clinic.address || ''}</p>
        <p>${clinic.phone ? 'Ph: '+clinic.phone : ''} ${clinic.email ? '| '+clinic.email : ''}</p>
        <p><strong>${doctor.name || 'Dr. Bincy'}</strong> — ${doctor.specialization || 'Gynecologist & Obstetrician'}</p>
        ${doctor.registration ? `<p>Reg. No: ${doctor.registration}</p>` : ''}
      </div>
      <div class="pt-info">
        <div><strong>Patient:</strong> ${pt?.first_name||''} ${pt?.last_name||''}</div>
        <div><strong>Date:</strong> ${App.fmtDate(rx.date)}</div>
        <div><strong>Age:</strong> ${App.calcAge(pt?.dob)}</div>
        <div><strong>Rx #:</strong> ${rx.prescription_no||''}</div>
      </div>
      ${rx.diagnosis ? `<p><strong>Diagnosis:</strong> ${rx.diagnosis}</p>` : ''}
      <div class="rx-symbol">Rx</div>
      <ul class="drug-list">
        ${(rx.drugs||[]).map(d=>`
          <li class="drug-item">
            <div class="drug-name">${d.name||''} ${d.strength||''}</div>
            <div class="drug-sig">${d.sig||''} × ${d.days||''} days (Qty: ${d.qty||''})</div>
          </li>
        `).join('')}
      </ul>
      ${rx.advice ? `<div class="advice"><strong>Advice:</strong> ${rx.advice}</div>` : ''}
      ${rx.next_visit ? `<p><strong>Next Visit:</strong> ${App.fmtDate(rx.next_visit)}</p>` : ''}
      <div class="footer">
        <div>Printed: ${new Date().toLocaleDateString('en-IN')}</div>
        <div class="sign">
          <br><br>___________________<br>
          ${doctor.name || 'Dr. Bincy'}<br>
          ${doctor.specialization || 'Gynecologist & Obstetrician'}
        </div>
      </div>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  }

  function print() { if (_editId) openView(_editId); }

  function _form(rx, patients, selPid) {
    return `
      <div class="form-row">
        <div class="form-group">
          <label>Patient *</label>
          <select class="form-control" id="rx-patient">
            <option value="">— Select —</option>
            ${patients.map(p=>`<option value="${p.id}" ${p.id===selPid?'selected':''}>${p.first_name} ${p.last_name} (${p.patient_no||''})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Date *</label>
          <input class="form-control" type="date" id="rx-date" value="${rx.date||App.today()}">
        </div>
      </div>
      <div class="form-group">
        <label>Diagnosis</label>
        <input class="form-control" id="rx-dx" value="${App.escHtml(rx.diagnosis||'')}">
      </div>
      <div class="form-section-title">Medications</div>
      <div id="rx-drugs-container"></div>
      <button class="btn btn-outline btn-sm mt-8" onclick="PrescriptionsModule._addDrug()">➕ Add Drug</button>
      <div class="form-group mt-12">
        <label>General Advice</label>
        <textarea class="form-control" id="rx-advice" rows="2">${App.escHtml(rx.advice||'')}</textarea>
      </div>
      <div class="form-group">
        <label>Next Visit</label>
        <input class="form-control" type="date" id="rx-next" value="${rx.next_visit||''}">
      </div>`;
  }

  function _renderDrugs() {
    const container = App.el('rx-drugs-container');
    if (!container) return;
    container.innerHTML = _drugs.map((d, i) => `
      <div class="drug-row" id="drug-row-${i}">
        <div>
          <input class="form-control" placeholder="Drug name" id="drug-name-${i}" value="${App.escHtml(d.name||'')}">
        </div>
        <div>
          <input class="form-control" placeholder="Strength" id="drug-str-${i}" value="${App.escHtml(d.strength||'')}">
        </div>
        <div>
          <input class="form-control" placeholder="Sig (1-0-1)" id="drug-sig-${i}" value="${App.escHtml(d.sig||'')}">
        </div>
        <div>
          <input class="form-control" placeholder="Days" type="number" id="drug-days-${i}" value="${d.days||''}">
        </div>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="PrescriptionsModule._removeDrug(${i})">✕</button>
      </div>
    `).join('');
  }

  function _emptyDrug() { return { name:'', strength:'', sig:'', days:'', qty:'' }; }

  function _addDrug() {
    _syncDrugs();
    _drugs.push(_emptyDrug());
    _renderDrugs();
  }

  function _removeDrug(i) {
    _syncDrugs();
    _drugs.splice(i, 1);
    if (!_drugs.length) _drugs.push(_emptyDrug());
    _renderDrugs();
  }

  function _syncDrugs() {
    _drugs.forEach((d, i) => {
      d.name     = App.el('drug-name-' + i)?.value?.trim() || '';
      d.strength = App.el('drug-str-'  + i)?.value?.trim() || '';
      d.sig      = App.el('drug-sig-'  + i)?.value?.trim() || '';
      d.days     = App.el('drug-days-' + i)?.value?.trim() || '';
    });
  }

  async function save() {
    _syncDrugs();
    const pid  = App.el('rx-patient')?.value;
    const date = App.el('rx-date')?.value;
    if (!pid || !date) { App.toast('Patient and date required', 'warning'); return; }
    const drugs = _drugs.filter(d => d.name);
    if (!drugs.length) { App.toast('Add at least one drug', 'warning'); return; }
    const data = {
      patient_id: pid, date,
      diagnosis: App.el('rx-dx')?.value?.trim()    || null,
      advice:    App.el('rx-advice')?.value?.trim() || null,
      next_visit:App.el('rx-next')?.value           || null,
      drugs,
    };
    try {
      if (_editId) await DB.prescriptions.update(_editId, data);
      else         await DB.prescriptions.create(data);
      App.closeModal('modal-rx');
      App.toast('Prescription saved');
      render();
    } catch (e) { App.toast(e.message, 'error'); }
  }

  async function deleteRx(id) {
    App.confirm('Delete this prescription?', async () => {
      await DB.prescriptions.delete(id);
      App.toast('Deleted');
      render();
    });
  }

  return { init, render, openNew, openEdit, openView, print, save, delete: deleteRx, _addDrug, _removeDrug };
})();

window.PrescriptionsModule = PrescriptionsModule;
