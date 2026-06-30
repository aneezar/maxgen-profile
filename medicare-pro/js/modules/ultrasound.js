'use strict';

const UltrasoundModule = (() => {
  let _editId = null;

  async function init() {}

  async function render() {
    const records = await DB.ultrasounds.list();
    const container = App.el('ultrasound-content');
    if (!container) return;

    if (!records.length) {
      container.innerHTML = `<div class="card"><div class="empty-state">
        <div class="empty-icon">🔬</div><h3>No ultrasound records</h3>
        <button class="btn btn-primary mt-16" onclick="UltrasoundModule.openNew()">➕ New Record</button>
      </div></div>`;
      return;
    }

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${records.map(u => `
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">${u.type||'Obstetric'} Ultrasound ${u.weeks_by_us ? '· '+u.weeks_by_us+'w' : ''}</div>
                <div class="card-subtitle" id="uspt-${u.id}">…</div>
              </div>
              <div style="display:flex;gap:6px">
                <span class="text-sm text-muted">${App.fmtDate(u.date)}</span>
                <button class="btn btn-ghost btn-sm" onclick="UltrasoundModule.openEdit('${u.id}')">✏️</button>
                <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="UltrasoundModule.delete('${u.id}')">🗑</button>
              </div>
            </div>
            <div class="grid-3 mb-8">
              ${u.bpd ? `<div><span class="text-muted text-sm">BPD: </span>${u.bpd}mm</div>` : ''}
              ${u.fl  ? `<div><span class="text-muted text-sm">FL: </span>${u.fl}mm</div>` : ''}
              ${u.ac  ? `<div><span class="text-muted text-sm">AC: </span>${u.ac}mm</div>` : ''}
              ${u.hc  ? `<div><span class="text-muted text-sm">HC: </span>${u.hc}mm</div>` : ''}
              ${u.efw ? `<div><span class="text-muted text-sm">EFW: </span>${u.efw}g</div>` : ''}
              ${u.afi ? `<div><span class="text-muted text-sm">AFI: </span>${u.afi}cm</div>` : ''}
              ${u.fhr ? `<div><span class="text-muted text-sm">FHR: </span>${u.fhr}bpm</div>` : ''}
              ${u.placenta ? `<div><span class="text-muted text-sm">Placenta: </span>${u.placenta}</div>` : ''}
              ${u.cervical_length ? `<div><span class="text-muted text-sm">Cervix: </span>${u.cervical_length}cm</div>` : ''}
            </div>
            ${u.impression ? `<div class="text-sm"><strong>Impression:</strong> ${App.escHtml(u.impression)}</div>` : ''}
            ${u.done_by ? `<div class="text-sm text-muted">Done by: ${App.escHtml(u.done_by)}</div>` : ''}
          </div>
        `).join('')}
      </div>`;

    for (const u of records) {
      const pt = await DB.patients.get(u.patient_id);
      const el = App.el('uspt-' + u.id);
      if (el && pt) el.textContent = `${pt.first_name} ${pt.last_name} · ${pt.patient_no||''}`;
    }
  }

  async function openNew(patientId) {
    _editId = null;
    const [patients, pregnancies] = await Promise.all([DB.patients.list(), DB.pregnancies.active()]);
    App.el('modal-us-title').textContent = 'New Ultrasound Record';
    App.el('modal-us-body').innerHTML = _form({}, patients, pregnancies, patientId);
    App.openModal('modal-us');
  }

  async function openEdit(id) {
    _editId = id;
    const [u, patients, pregnancies] = await Promise.all([
      DB.ultrasounds.get(id), DB.patients.list(), DB.pregnancies.active()
    ]);
    App.el('modal-us-title').textContent = 'Edit Ultrasound';
    App.el('modal-us-body').innerHTML = _form(u, patients, pregnancies, u.patient_id);
    App.openModal('modal-us');
  }

  function _form(u, patients, pregnancies, selPid) {
    const ptPregs = selPid ? pregnancies.filter(p => p.patient_id === selPid) : [];
    return `
      <div class="form-row">
        <div class="form-group">
          <label>Patient *</label>
          <select class="form-control" id="us-patient">
            <option value="">— Select —</option>
            ${patients.map(p=>`<option value="${p.id}" ${p.id===selPid?'selected':''}>${p.first_name} ${p.last_name} (${p.patient_no||''})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Date *</label>
          <input class="form-control" type="date" id="us-date" value="${u.date||App.today()}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type</label>
          <select class="form-control" id="us-type">
            ${['obstetric','gynecological','follicular','dating','anomaly','doppler','biophysical','other'].map(t=>`<option ${u.type===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Weeks by US</label>
          <input class="form-control" type="number" id="us-weeks" value="${u.weeks_by_us||''}">
        </div>
      </div>
      <div class="form-section-title">Biometry (mm)</div>
      <div class="grid-3">
        <div class="form-group"><label>BPD</label><input class="form-control" type="number" step="0.1" id="us-bpd" value="${u.bpd||''}"></div>
        <div class="form-group"><label>FL</label><input class="form-control" type="number" step="0.1" id="us-fl" value="${u.fl||''}"></div>
        <div class="form-group"><label>AC</label><input class="form-control" type="number" step="0.1" id="us-ac" value="${u.ac||''}"></div>
        <div class="form-group"><label>HC</label><input class="form-control" type="number" step="0.1" id="us-hc" value="${u.hc||''}"></div>
        <div class="form-group"><label>EFW (g)</label><input class="form-control" type="number" step="1" id="us-efw" value="${u.efw||''}"></div>
        <div class="form-group"><label>FHR (bpm)</label><input class="form-control" type="number" id="us-fhr" value="${u.fhr||''}"></div>
      </div>
      <div class="form-section-title">Additional</div>
      <div class="grid-3">
        <div class="form-group"><label>AFI (cm)</label><input class="form-control" type="number" step="0.1" id="us-afi" value="${u.afi||''}"></div>
        <div class="form-group"><label>Placenta</label><input class="form-control" id="us-placenta" value="${App.escHtml(u.placenta||'')}"></div>
        <div class="form-group"><label>Cervical Length (cm)</label><input class="form-control" type="number" step="0.1" id="us-cerv" value="${u.cervical_length||''}"></div>
      </div>
      <div class="form-group">
        <label>Findings</label>
        <textarea class="form-control" id="us-findings" rows="2">${App.escHtml(u.findings||'')}</textarea>
      </div>
      <div class="form-group">
        <label>Impression / Conclusion</label>
        <textarea class="form-control" id="us-impression" rows="2">${App.escHtml(u.impression||'')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Recommendation</label><input class="form-control" id="us-rec" value="${App.escHtml(u.recommendation||'')}"></div>
        <div class="form-group"><label>Done By</label><input class="form-control" id="us-doneby" value="${App.escHtml(u.done_by||'')}"></div>
      </div>`;
  }

  async function save() {
    const pid  = App.el('us-patient')?.value;
    const date = App.el('us-date')?.value;
    if (!pid || !date) { App.toast('Patient and date required', 'warning'); return; }
    const n = id => parseFloat(App.el(id)?.value) || null;
    const v = id => App.el(id)?.value?.trim() || null;
    const data = {
      patient_id: pid, date,
      type: v('us-type') || 'obstetric',
      weeks_by_us: parseInt(App.el('us-weeks')?.value) || null,
      bpd: n('us-bpd'), fl: n('us-fl'), ac: n('us-ac'), hc: n('us-hc'),
      efw: n('us-efw'), fhr: n('us-fhr'), afi: n('us-afi'),
      placenta: v('us-placenta'), cervical_length: n('us-cerv'),
      findings: v('us-findings'), impression: v('us-impression'),
      recommendation: v('us-rec'), done_by: v('us-doneby'),
    };
    try {
      if (_editId) await DB.ultrasounds.update(_editId, data);
      else         await DB.ultrasounds.create(data);
      App.closeModal('modal-us');
      App.toast('Ultrasound record saved');
      render();
    } catch (e) { App.toast(e.message, 'error'); }
  }

  async function deleteUS(id) {
    App.confirm('Delete this ultrasound record?', async () => {
      await DB.ultrasounds.delete(id);
      App.toast('Deleted');
      render();
    });
  }

  return { init, render, openNew, openEdit, save, delete: deleteUS };
})();

window.UltrasoundModule = UltrasoundModule;
