'use strict';

const ANCModule = (() => {
  let _editId = null;
  let _patientId = null;
  let _pregnancyId = null;

  async function init() {}

  async function render() {
    const visits = await DB.ancVisits.list();
    const container = App.el('anc-content');
    if (!container) return;

    if (!visits.length) {
      container.innerHTML = `<div class="card"><div class="empty-state">
        <div class="empty-icon">📊</div><h3>No ANC visits recorded</h3>
        <button class="btn btn-primary mt-16" onclick="ANCModule.openNew()">➕ Record ANC Visit</button>
      </div></div>`;
      return;
    }

    container.innerHTML = `
      <div class="table-wrapper">
        <table class="anc-table">
          <thead><tr>
            <th>Date</th><th>Patient</th><th>GA</th>
            <th>BP</th><th>Weight</th><th>FHR</th><th>FH</th>
            <th>Presentation</th><th>Edema</th><th>Next Visit</th><th></th>
          </tr></thead>
          <tbody>
          ${visits.map(v => `
            <tr>
              <td>${App.fmtDate(v.date)}</td>
              <td id="anc-pt-${v.id}">…</td>
              <td><strong>${v.weeks||'—'}w${v.days?v.days+'d':''}</strong></td>
              <td>${v.bp_systolic?v.bp_systolic+'/'+v.bp_diastolic:'—'}</td>
              <td>${v.weight||'—'}kg</td>
              <td>${v.fhr||'—'}</td>
              <td>${v.fundal_height||'—'}cm</td>
              <td>${v.presentation||'—'}</td>
              <td>${v.edema||'—'}</td>
              <td>${App.fmtDate(v.next_visit)}</td>
              <td><div class="table-actions">
                <button class="btn btn-ghost btn-sm" onclick="ANCModule.openEdit('${v.id}')">✏️</button>
                <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="ANCModule.delete('${v.id}')">🗑</button>
              </div></td>
            </tr>
          `).join('')}
          </tbody>
        </table>
      </div>`;

    for (const v of visits) {
      const pt = await DB.patients.get(v.patient_id);
      const el = App.el('anc-pt-' + v.id);
      if (el && pt) el.textContent = `${pt.first_name} ${pt.last_name}`;
    }
  }

  async function openNew(patientId, pregnancyId) {
    _editId = null;
    _patientId = patientId || null;
    _pregnancyId = pregnancyId || null;
    const [patients, pregnancies] = await Promise.all([DB.patients.list(), DB.pregnancies.active()]);
    App.el('modal-anc-title').textContent = 'New ANC Visit';
    App.el('modal-anc-body').innerHTML = await _form({}, patients, pregnancies, patientId, pregnancyId);
    _bindPatientChange(patients, pregnancies);
    App.openModal('modal-anc');
  }

  async function openEdit(id) {
    _editId = id;
    const [v, patients, pregnancies] = await Promise.all([
      DB.ancVisits.get(id), DB.patients.list(), DB.pregnancies.active()
    ]);
    App.el('modal-anc-title').textContent = 'Edit ANC Visit';
    App.el('modal-anc-body').innerHTML = await _form(v, patients, pregnancies, v.patient_id, v.pregnancy_id);
    App.openModal('modal-anc');
  }

  function _bindPatientChange(patients, pregnancies) {
    const ptSel   = App.el('anc-patient');
    const pregSel = App.el('anc-preg');
    if (!ptSel || !pregSel) return;
    ptSel.addEventListener('change', () => {
      const pid = ptSel.value;
      const filtered = pregnancies.filter(pr => pr.patient_id === pid);
      pregSel.innerHTML = filtered.map(pr =>
        `<option value="${pr.id}">Preg #${pr.pregnancy_no||1} · LMP: ${App.fmtDate(pr.lmp)}</option>`
      ).join('') || '<option value="">No active pregnancy</option>';
      _updateGA();
    });
    pregSel.addEventListener('change', _updateGA);
    App.el('anc-date')?.addEventListener('change', _updateGA);
  }

  function _updateGA() {
    const pregId  = App.el('anc-preg')?.value;
    const date    = App.el('anc-date')?.value;
    // Can't easily async here — skip auto-fill of GA
    App.el('anc-date-info') && (App.el('anc-date-info').textContent = date ? '' : '');
  }

  async function _form(v, patients, pregnancies, selPid, selPregId) {
    const ptPregs = selPid ? pregnancies.filter(pr => pr.patient_id === selPid) : pregnancies;

    // Auto-calc GA if we have a pregnancy
    let autoGA = { weeks: v.weeks||'', days: v.days||0 };
    if (selPregId && !v.weeks) {
      const pr = pregnancies.find(p => p.id === selPregId);
      if (pr && pr.lmp) {
        const ga = App.calcGestationalAge(pr.lmp, v.date);
        if (ga) { autoGA.weeks = ga.weeks; autoGA.days = ga.days; }
      }
    }

    return `
      <div class="form-row">
        <div class="form-group">
          <label>Patient *</label>
          <select class="form-control" id="anc-patient">
            <option value="">— Select —</option>
            ${patients.map(p=>`<option value="${p.id}" ${p.id===selPid?'selected':''}>${p.first_name} ${p.last_name} (${p.patient_no||''})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Pregnancy</label>
          <select class="form-control" id="anc-preg">
            ${ptPregs.map(pr=>`<option value="${pr.id}" ${pr.id===selPregId?'selected':''}>#${pr.pregnancy_no||1} · LMP: ${App.fmtDate(pr.lmp)}</option>`).join('')||'<option value="">No active pregnancy</option>'}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Visit Date *</label>
          <input class="form-control" type="date" id="anc-date" value="${v.date||App.today()}">
        </div>
        <div class="form-group">
          <label>Gestational Age</label>
          <div style="display:flex;gap:8px">
            <input class="form-control" type="number" id="anc-weeks" value="${autoGA.weeks}" placeholder="Weeks" style="flex:2">
            <input class="form-control" type="number" id="anc-days"  value="${autoGA.days}"  placeholder="Days" max="6" style="flex:1">
          </div>
        </div>
      </div>

      <div class="form-section-title">Maternal Vitals</div>
      <div class="grid-3">
        <div class="form-group">
          <label>Weight (kg)</label>
          <input class="form-control" type="number" step="0.1" id="anc-wt" value="${v.weight||''}">
        </div>
        <div class="form-group">
          <label>BP Systolic</label>
          <input class="form-control" type="number" id="anc-bps" value="${v.bp_systolic||''}">
        </div>
        <div class="form-group">
          <label>BP Diastolic</label>
          <input class="form-control" type="number" id="anc-bpd" value="${v.bp_diastolic||''}">
        </div>
        <div class="form-group">
          <label>Pulse (/min)</label>
          <input class="form-control" type="number" id="anc-pulse" value="${v.pulse||''}">
        </div>
        <div class="form-group">
          <label>Haemoglobin (g/dL)</label>
          <input class="form-control" type="number" step="0.1" id="anc-hb" value="${v.hemoglobin||''}">
        </div>
        <div class="form-group">
          <label>Urine Protein</label>
          <select class="form-control" id="anc-uprot">
            ${['Nil','Trace','+','++','+++'].map(o=>`<option ${v.urine_protein===o?'selected':''}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Urine Sugar</label>
          <select class="form-control" id="anc-usugar">
            ${['Nil','Trace','+','++'].map(o=>`<option ${v.urine_sugar===o?'selected':''}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Edema</label>
          <select class="form-control" id="anc-edema">
            ${['Nil','Pedal','+','++','+++','Generalised'].map(o=>`<option ${v.edema===o?'selected':''}>${o}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-section-title">Fetal Assessment</div>
      <div class="grid-3">
        <div class="form-group">
          <label>Fundal Height (cm)</label>
          <input class="form-control" type="number" id="anc-fh" value="${v.fundal_height||''}">
        </div>
        <div class="form-group">
          <label>FHR (bpm)</label>
          <input class="form-control" type="number" id="anc-fhr" value="${v.fhr||''}">
        </div>
        <div class="form-group">
          <label>Lie</label>
          <select class="form-control" id="anc-lie">
            ${['','Longitudinal','Transverse','Oblique'].map(o=>`<option ${v.lie===o?'selected':''}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Presentation</label>
          <select class="form-control" id="anc-pres">
            ${['Cephalic','Breech','Shoulder','Face','Brow'].map(o=>`<option ${v.presentation===o?'selected':''}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Engagement</label>
          <select class="form-control" id="anc-eng">
            ${['','Engaged','Not Engaged','3/5','4/5','2/5'].map(o=>`<option ${v.engagement===o?'selected':''}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Descent (fifths)</label>
          <input class="form-control" type="number" id="anc-desc" min="0" max="5" value="${v.descent||''}">
        </div>
      </div>

      <div class="form-group">
        <label>Investigations Advised</label>
        <textarea class="form-control" id="anc-inv" rows="2">${App.escHtml(v.investigations||'')}</textarea>
      </div>
      <div class="form-group">
        <label>Remarks / Plan</label>
        <textarea class="form-control" id="anc-remarks" rows="2">${App.escHtml(v.remarks||'')}</textarea>
      </div>
      <div class="form-group">
        <label>Next Visit Date</label>
        <input class="form-control" type="date" id="anc-next" value="${v.next_visit||''}">
      </div>`;
  }

  async function save() {
    const pid   = App.el('anc-patient')?.value;
    const pregId= App.el('anc-preg')?.value;
    const date  = App.el('anc-date')?.value;
    if (!pid || !date) { App.toast('Patient and date required', 'warning'); return; }
    const n = id => parseFloat(App.el(id)?.value) || null;
    const v = id => App.el(id)?.value?.trim() || null;
    const data = {
      patient_id: pid, pregnancy_id: pregId || null, date,
      weeks:        parseInt(App.el('anc-weeks')?.value) || null,
      days:         parseInt(App.el('anc-days')?.value)  || 0,
      weight:       n('anc-wt'),
      bp_systolic:  n('anc-bps'), bp_diastolic: n('anc-bpd'),
      pulse:        n('anc-pulse'), hemoglobin: n('anc-hb'),
      urine_protein:v('anc-uprot'), urine_sugar: v('anc-usugar'),
      edema:        v('anc-edema'),
      fundal_height:n('anc-fh'), fhr: n('anc-fhr'),
      lie:          v('anc-lie'), presentation: v('anc-pres'),
      engagement:   v('anc-eng'), descent: n('anc-desc'),
      investigations:v('anc-inv'), remarks: v('anc-remarks'),
      next_visit:   v('anc-next'),
    };
    try {
      if (_editId) await DB.ancVisits.update(_editId, data);
      else         await DB.ancVisits.create(data);
      App.closeModal('modal-anc');
      App.toast('ANC visit saved');
      render();
    } catch (e) { App.toast(e.message, 'error'); }
  }

  async function deleteVisit(id) {
    App.confirm('Delete this ANC visit?', async () => {
      await DB.ancVisits.delete(id);
      App.toast('Deleted');
      render();
    });
  }

  return { init, render, openNew, openEdit, save, delete: deleteVisit };
})();

window.ANCModule = ANCModule;
