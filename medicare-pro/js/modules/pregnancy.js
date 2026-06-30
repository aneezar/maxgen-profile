'use strict';

const PregnancyModule = (() => {
  let _editId = null;

  async function init() {}

  async function render() {
    const pregnancies = await DB.pregnancies.list();
    const container = App.el('pregnancy-content');
    if (!container) return;

    if (!pregnancies.length) {
      container.innerHTML = `<div class="card"><div class="empty-state">
        <div class="empty-icon">🤰</div><h3>No pregnancy records</h3>
        <button class="btn btn-primary mt-16" onclick="PregnancyModule.openNew()">➕ New Pregnancy</button>
      </div></div>`;
      return;
    }

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px">
        ${pregnancies.map(pr => {
          const ga = App.calcGestationalAge(pr.lmp);
          const isActive = pr.status === 'active';
          return `
          <div class="card">
            <div style="display:flex;gap:14px;align-items:flex-start">
              ${isActive ? `
              <div class="preg-card" style="flex:0 0 200px;margin-bottom:0">
                <div class="preg-edd" style="font-size:12px">EDD</div>
                <div style="font-size:13px;font-weight:600">${App.fmtDate(pr.edd||App.calcEDD(pr.lmp))}</div>
                <div class="preg-weeks" style="font-size:28px">${ga?ga.weeks:'—'}w</div>
                <div class="preg-label" style="font-size:12px">${ga?ga.days+'d':''}</div>
              </div>` : ''}
              <div style="flex:1">
                <div id="preg-ptname-${pr.id}" style="font-weight:700;margin-bottom:6px">Loading…</div>
                <div class="grid-3 mb-8">
                  <div><span class="text-muted text-sm">LMP: </span>${App.fmtDate(pr.lmp)}</div>
                  <div><span class="text-muted text-sm">EDD: </span>${App.fmtDate(pr.edd||App.calcEDD(pr.lmp))}</div>
                  <div><span class="text-muted text-sm">Status: </span><span class="badge ${_badge(pr.status)}">${pr.status}</span></div>
                  <div><span class="text-muted text-sm">Blood Grp: </span>${pr.blood_group||'—'}</div>
                  <div><span class="text-muted text-sm">Booking: </span>${App.fmtDate(pr.booking_date)}</div>
                  <div><span class="text-muted text-sm">Risk: </span>${_riskBadge(pr.risk_factors)}</div>
                </div>
                ${pr.complications ? `<div class="text-sm text-muted mb-8">⚠️ ${App.escHtml(pr.complications)}</div>` : ''}
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  <button class="btn btn-primary btn-sm" onclick="ANCModule.openNew('${pr.patient_id}','${pr.id}')">📊 ANC Visit</button>
                  <button class="btn btn-outline btn-sm" onclick="PregnancyModule.openEdit('${pr.id}')">✏️ Edit</button>
                  ${isActive ? `<button class="btn btn-outline btn-sm" onclick="PregnancyModule.markDelivery('${pr.id}')">🏥 Record Delivery</button>` : ''}
                  <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="PregnancyModule.delete('${pr.id}')">🗑</button>
                </div>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`;

    for (const pr of pregnancies) {
      const pt = await DB.patients.get(pr.patient_id);
      const el = App.el('preg-ptname-' + pr.id);
      if (el && pt) el.innerHTML = `<a onclick="PatientsModule.openDetail('${pt.id}')" style="cursor:pointer;color:var(--primary)">${App.escHtml(pt.first_name)} ${App.escHtml(pt.last_name)}</a> <span class="text-sm text-muted">· ${pt.patient_no||''}</span>`;
    }
  }

  async function openNew(patientId) {
    _editId = null;
    const patients = await DB.patients.list();
    App.el('modal-preg-title').textContent = 'New Pregnancy Record';
    App.el('modal-preg-body').innerHTML = _form({}, patients, patientId);
    _bindLmpChange();
    App.openModal('modal-preg');
  }

  async function openEdit(id) {
    _editId = id;
    const [pr, patients] = await Promise.all([DB.pregnancies.get(id), DB.patients.list()]);
    App.el('modal-preg-title').textContent = 'Edit Pregnancy';
    App.el('modal-preg-body').innerHTML = _form(pr, patients, pr.patient_id);
    _bindLmpChange();
    App.openModal('modal-preg');
  }

  async function markDelivery(id) {
    _editId = id;
    const pr = await DB.pregnancies.get(id);
    App.el('modal-preg-title').textContent = 'Record Delivery';
    App.el('modal-preg-body').innerHTML = `
      <div class="form-row">
        <div class="form-group"><label>Delivery Date</label><input class="form-control" type="date" id="pd-date" value="${App.today()}"></div>
        <div class="form-group"><label>Delivery Type</label>
          <select class="form-control" id="pd-type">
            ${['Normal Vaginal','Caesarean Section','Assisted Vaginal','LSCS'].map(v=>`<option>${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Baby Weight (kg)</label><input class="form-control" type="number" step="0.01" id="pd-wt"></div>
        <div class="form-group"><label>Baby Sex</label>
          <select class="form-control" id="pd-sex"><option>Female</option><option>Male</option><option>Not recorded</option></select>
        </div>
      </div>
      <div class="form-group"><label>Complications</label><textarea class="form-control" id="pd-comp" rows="2"></textarea></div>
      <div class="form-group"><label>Outcome</label>
        <select class="form-control" id="pd-outcome"><option>Live birth</option><option>Stillbirth</option><option>Neonatal death</option></select>
      </div>`;
    document.getElementById('modal-preg').querySelector('.modal-footer .btn-primary').onclick = async () => {
      await DB.pregnancies.update(id, {
        status: 'delivered',
        delivery_date: App.el('pd-date').value,
        delivery_type: App.el('pd-type').value,
        baby_weight: parseFloat(App.el('pd-wt').value) || null,
        baby_sex:    App.el('pd-sex').value,
        complications: App.el('pd-comp').value.trim(),
        outcome:     App.el('pd-outcome').value,
      });
      App.closeModal('modal-preg');
      App.toast('Delivery recorded');
      render();
    };
    App.openModal('modal-preg');
  }

  function _form(pr, patients, selPid) {
    const rf = pr.risk_factors || {};
    return `
      <div class="form-row">
        <div class="form-group">
          <label>Patient *</label>
          <select class="form-control" id="pregf-patient">
            <option value="">— Select —</option>
            ${patients.map(p=>`<option value="${p.id}" ${p.id===selPid?'selected':''}>${p.first_name} ${p.last_name} (${p.patient_no||''})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Pregnancy #</label>
          <input class="form-control" type="number" id="pregf-no" value="${pr.pregnancy_no||1}" min="1">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>LMP *</label>
          <input class="form-control" type="date" id="pregf-lmp" value="${pr.lmp||''}" oninput="PregnancyModule._onLmpChange(this.value)">
        </div>
        <div class="form-group">
          <label>EDD (auto-calculated)</label>
          <input class="form-control" type="date" id="pregf-edd" value="${pr.edd||App.calcEDD(pr.lmp)||''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>EDD by Ultrasound</label>
          <input class="form-control" type="date" id="pregf-eddus" value="${pr.edd_by_us||''}">
        </div>
        <div class="form-group">
          <label>Blood Group</label>
          <select class="form-control" id="pregf-bg">
            ${['','A+','A-','B+','B-','O+','O-','AB+','AB-'].map(v=>`<option ${pr.blood_group===v?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Booking Date</label>
          <input class="form-control" type="date" id="pregf-book" value="${pr.booking_date||App.today()}">
        </div>
        <div class="form-group">
          <label>Status</label>
          <select class="form-control" id="pregf-status">
            ${['active','delivered','aborted','ectopic'].map(v=>`<option ${pr.status===v?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-section-title mt-4">Risk Factors</div>
      <div class="grid-3">
        ${['diabetes','hypertension','anaemia','previous_cs','twins','preterm','placenta_previa','rh_negative','thyroid'].map(r=>`
          <label style="display:flex;align-items:center;gap:6px;font-weight:400;cursor:pointer">
            <input type="checkbox" id="rf-${r}" ${rf[r]?'checked':''}> ${r.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}
          </label>
        `).join('')}
      </div>
      <div class="form-group mt-12">
        <label>Notes / Complications</label>
        <textarea class="form-control" id="pregf-notes" rows="2">${App.escHtml(pr.notes||'')}</textarea>
      </div>`;
  }

  function _bindLmpChange() {}

  window.PregnancyModule._onLmpChange = function(val) {
    const eddEl = App.el('pregf-edd');
    if (eddEl) eddEl.value = App.calcEDD(val) || '';
  };

  async function save() {
    const pid  = App.el('pregf-patient')?.value;
    const lmp  = App.el('pregf-lmp')?.value;
    if (!pid || !lmp) { App.toast('Patient and LMP required', 'warning'); return; }
    const rfs  = ['diabetes','hypertension','anaemia','previous_cs','twins','preterm','placenta_previa','rh_negative','thyroid'];
    const risk = {};
    rfs.forEach(r => { risk[r] = App.el('rf-' + r)?.checked || false; });
    const data = {
      patient_id: pid, lmp,
      edd:         App.el('pregf-edd')?.value  || App.calcEDD(lmp),
      edd_by_us:   App.el('pregf-eddus')?.value || null,
      blood_group: App.el('pregf-bg')?.value   || null,
      booking_date:App.el('pregf-book')?.value || null,
      pregnancy_no:parseInt(App.el('pregf-no')?.value)||1,
      status:      App.el('pregf-status')?.value || 'active',
      risk_factors: risk,
      notes:       App.el('pregf-notes')?.value?.trim() || null,
    };
    try {
      if (_editId) await DB.pregnancies.update(_editId, data);
      else         await DB.pregnancies.create(data);
      App.closeModal('modal-preg');
      App.toast('Pregnancy record saved');
      render();
    } catch (e) { App.toast(e.message, 'error'); }
  }

  async function deletePreg(id) {
    App.confirm('Delete this pregnancy record and all ANC visits?', async () => {
      await DB.pregnancies.delete(id);
      App.toast('Deleted');
      render();
    });
  }

  function _badge(s) {
    return { active:'badge-pink', delivered:'badge-green', aborted:'badge-orange', ectopic:'badge-red' }[s] || 'badge-gray';
  }

  function _riskBadge(rf) {
    const hasRisk = rf && Object.values(rf).some(v => v);
    return hasRisk ? '<span class="badge badge-red">High Risk</span>' : '<span class="badge badge-green">Normal</span>';
  }

  return { init, render, openNew, openEdit, markDelivery, save, delete: deletePreg, _onLmpChange: ()=>{} };
})();

window.PregnancyModule = PregnancyModule;
