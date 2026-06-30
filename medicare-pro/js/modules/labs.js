'use strict';

const LabsModule = (() => {
  let _editId = null;
  let _tests  = [];

  const COMMON_TESTS = {
    blood: [
      { name:'Haemoglobin', unit:'g/dL', normal:'12-16' },
      { name:'Blood Group', unit:'', normal:'' },
      { name:'Platelet Count', unit:'lakh/µL', normal:'1.5-4.5' },
      { name:'WBC', unit:'cells/µL', normal:'4000-11000' },
      { name:'PCV/HCT', unit:'%', normal:'36-46' },
    ],
    thyroid: [
      { name:'TSH', unit:'µIU/mL', normal:'0.5-5.0' },
      { name:'Free T3', unit:'pg/mL', normal:'2.3-4.2' },
      { name:'Free T4', unit:'ng/dL', normal:'0.8-1.8' },
    ],
    diabetes: [
      { name:'Fasting Blood Sugar', unit:'mg/dL', normal:'70-100' },
      { name:'Post Prandial Blood Sugar', unit:'mg/dL', normal:'<140' },
      { name:'HbA1c', unit:'%', normal:'<5.7' },
      { name:'GTT 1hr', unit:'mg/dL', normal:'<140' },
      { name:'GTT 2hr', unit:'mg/dL', normal:'<200' },
    ],
    antenatal: [
      { name:'Hb%', unit:'g/dL', normal:'12-16' },
      { name:'Blood Group & Rh', unit:'', normal:'' },
      { name:'VDRL', unit:'', normal:'Non-reactive' },
      { name:'HBsAg', unit:'', normal:'Negative' },
      { name:'HIV', unit:'', normal:'Non-reactive' },
      { name:'GCT (50g)', unit:'mg/dL', normal:'<140' },
      { name:'Urine Routine', unit:'', normal:'Normal' },
    ],
  };

  async function init() {}

  async function render() {
    const labs = await DB.labResults.list();
    const container = App.el('labs-content');
    if (!container) return;

    if (!labs.length) {
      container.innerHTML = `<div class="card"><div class="empty-state">
        <div class="empty-icon">🧪</div><h3>No lab results</h3>
        <button class="btn btn-primary mt-16" onclick="LabsModule.openNew()">➕ Add Result</button>
      </div></div>`;
      return;
    }

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${labs.map(l => `
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">${App.escHtml(l.lab_name||'Lab Result')}</div>
                <div class="card-subtitle" id="labpt-${l.id}">…</div>
              </div>
              <div style="display:flex;gap:6px">
                <span class="badge badge-blue">${l.category||'blood'}</span>
                <span class="text-sm text-muted">${App.fmtDate(l.date)}</span>
                <button class="btn btn-ghost btn-sm" onclick="LabsModule.openEdit('${l.id}')">✏️</button>
                <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="LabsModule.delete('${l.id}')">🗑</button>
              </div>
            </div>
            <div class="grid-3">
              ${(l.tests||[]).map(t=>`
                <div style="padding:6px 0;border-bottom:1px solid var(--border)">
                  <div class="text-sm" style="font-weight:600">${App.escHtml(t.name||'')}</div>
                  <div>${App.escHtml(t.value||'—')} <span class="text-muted text-sm">${App.escHtml(t.unit||'')}</span></div>
                  <div class="text-sm text-muted">${t.normal ? 'Ref: '+t.normal : ''}</div>
                </div>
              `).join('')}
            </div>
            ${l.remarks ? `<div class="mt-8 text-sm text-muted">${App.escHtml(l.remarks)}</div>` : ''}
          </div>
        `).join('')}
      </div>`;

    for (const l of labs) {
      const pt = await DB.patients.get(l.patient_id);
      const el = App.el('labpt-' + l.id);
      if (el && pt) el.textContent = `${pt.first_name} ${pt.last_name} · ${App.fmtDate(l.date)}`;
    }
  }

  async function openNew(patientId) {
    _editId = null;
    _tests  = [];
    const patients = await DB.patients.list();
    App.el('modal-lab-title').textContent = 'Add Lab Result';
    App.el('modal-lab-body').innerHTML = _form({}, patients, patientId);
    App.openModal('modal-lab');
  }

  async function openEdit(id) {
    _editId = id;
    const [l, patients] = await Promise.all([DB.labResults.get(id), DB.patients.list()]);
    _tests = (l.tests||[]).map(t=>({...t}));
    App.el('modal-lab-title').textContent = 'Edit Lab Result';
    App.el('modal-lab-body').innerHTML = _form(l, patients, l.patient_id);
    _renderTests();
    App.openModal('modal-lab');
  }

  function _form(l, patients, selPid) {
    return `
      <div class="form-row">
        <div class="form-group">
          <label>Patient *</label>
          <select class="form-control" id="lab-patient">
            <option value="">— Select —</option>
            ${patients.map(p=>`<option value="${p.id}" ${p.id===selPid?'selected':''}>${p.first_name} ${p.last_name} (${p.patient_no||''})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Date *</label>
          <input class="form-control" type="date" id="lab-date" value="${l.date||App.today()}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Lab Name</label>
          <input class="form-control" id="lab-name" value="${App.escHtml(l.lab_name||'')}" placeholder="e.g. City Lab">
        </div>
        <div class="form-group">
          <label>Category</label>
          <select class="form-control" id="lab-cat" onchange="LabsModule._loadPreset(this.value)">
            ${['blood','thyroid','diabetes','antenatal','urine','other'].map(c=>`<option ${l.category===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-section-title">
        Test Results
        <button class="btn btn-outline btn-sm" onclick="LabsModule._loadPreset(document.getElementById('lab-cat').value)" style="margin-left:8px">Load Preset</button>
        <button class="btn btn-ghost btn-sm" onclick="LabsModule._addTest()">➕ Add Row</button>
      </div>
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:6px;margin-bottom:4px;font-size:12px;font-weight:600;color:var(--text2)">
        <div>Test Name</div><div>Value</div><div>Unit</div><div>Normal Range</div><div></div>
      </div>
      <div id="lab-tests-container"></div>
      <div class="form-group mt-12">
        <label>Remarks</label>
        <textarea class="form-control" id="lab-remarks" rows="2">${App.escHtml(l.remarks||'')}</textarea>
      </div>`;
  }

  function _renderTests() {
    const c = App.el('lab-tests-container');
    if (!c) return;
    c.innerHTML = _tests.map((t, i) => `
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:6px;margin-bottom:6px;align-items:center">
        <input class="form-control" id="lt-name-${i}" value="${App.escHtml(t.name||'')}">
        <input class="form-control" id="lt-val-${i}" value="${App.escHtml(t.value||'')}">
        <input class="form-control" id="lt-unit-${i}" value="${App.escHtml(t.unit||'')}">
        <input class="form-control" id="lt-norm-${i}" value="${App.escHtml(t.normal||'')}">
        <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="LabsModule._removeTest(${i})">✕</button>
      </div>
    `).join('');
  }

  function _loadPreset(cat) {
    const preset = COMMON_TESTS[cat] || [];
    _tests = preset.map(t => ({...t, value:''}));
    _renderTests();
  }

  function _addTest() {
    _syncTests();
    _tests.push({ name:'', value:'', unit:'', normal:'' });
    _renderTests();
  }

  function _removeTest(i) {
    _syncTests();
    _tests.splice(i, 1);
    _renderTests();
  }

  function _syncTests() {
    _tests.forEach((t, i) => {
      t.name   = App.el('lt-name-' + i)?.value?.trim() || '';
      t.value  = App.el('lt-val-'  + i)?.value?.trim() || '';
      t.unit   = App.el('lt-unit-' + i)?.value?.trim() || '';
      t.normal = App.el('lt-norm-' + i)?.value?.trim() || '';
    });
  }

  async function save() {
    _syncTests();
    const pid  = App.el('lab-patient')?.value;
    const date = App.el('lab-date')?.value;
    if (!pid || !date) { App.toast('Patient and date required', 'warning'); return; }
    const data = {
      patient_id: pid, date,
      lab_name: App.el('lab-name')?.value?.trim() || null,
      category: App.el('lab-cat')?.value || 'blood',
      tests:    _tests.filter(t => t.name),
      remarks:  App.el('lab-remarks')?.value?.trim() || null,
    };
    try {
      if (_editId) await DB.labResults.update(_editId, data);
      else         await DB.labResults.create(data);
      App.closeModal('modal-lab');
      App.toast('Lab result saved');
      render();
    } catch (e) { App.toast(e.message, 'error'); }
  }

  async function deleteLab(id) {
    App.confirm('Delete this lab result?', async () => {
      await DB.labResults.delete(id);
      App.toast('Deleted');
      render();
    });
  }

  return { init, render, openNew, openEdit, save, delete: deleteLab, _addTest, _removeTest, _loadPreset };
})();

window.LabsModule = LabsModule;
