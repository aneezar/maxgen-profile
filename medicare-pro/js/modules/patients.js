'use strict';

const PatientsModule = (() => {
  let _all = [];
  let _filtered = [];
  let _editId = null;
  let _filterCat = 'all';

  async function init() {}

  async function render() {
    _all = await DB.patients.list();
    _applyFilter();
    _renderList(_filtered);
  }

  function _applyFilter() {
    _filtered = _filterCat === 'all' ? _all
      : _all.filter(p => p.category === _filterCat);
  }

  function filter(cat, btn) {
    _filterCat = cat;
    document.querySelectorAll('#patient-filters .pill-btn').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
    _applyFilter();
    _renderList(_filtered);
  }

  async function search(q) {
    if (!q.trim()) { _applyFilter(); _renderList(_filtered); return; }
    const results = await DB.patients.search(q);
    _renderList(results);
  }

  function _renderList(list) {
    const el = App.el('patients-list');
    if (!el) return;
    if (!list.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">👩</div>
        <h3>No patients found</h3>
        <p>Register your first patient to get started.</p>
        <button class="btn btn-primary mt-16" onclick="PatientsModule.openNew()">➕ New Patient</button>
      </div>`;
      return;
    }
    el.innerHTML = list.map(p => `
      <div class="patient-row" onclick="PatientsModule.openDetail('${p.id}')">
        ${App.avatar(p.first_name, p.last_name, 40)}
        <div class="patient-info">
          <div class="patient-name">${App.escHtml(p.first_name)} ${App.escHtml(p.last_name)}</div>
          <div class="patient-sub">${p.phone || ''} · ${App.calcAge(p.dob)} · G${p.gravida||0}P${p.para||0}</div>
        </div>
        <div class="patient-meta">
          <span class="badge ${_catBadge(p.category)}">${p.category || 'General'}</span>
          <div class="patient-no">${p.patient_no || ''}</div>
        </div>
      </div>
    `).join('');
  }

  // ── OPEN DETAIL ──────────────────────────────────────────────
  async function openDetail(id) {
    _editId = id;
    App.navigate('patient-detail');
    const [p, consults, appts, pregnancies, prescriptions, invoices, labs, ultrasounds] = await Promise.all([
      DB.patients.get(id),
      DB.consultations.byPatient(id),
      DB.appointments.byPatient(id),
      DB.pregnancies.byPatient(id),
      DB.prescriptions.byPatient(id),
      DB.invoices.byPatient(id),
      DB.labResults.byPatient(id),
      DB.ultrasounds.byPatient(id),
    ]);
    if (!p) return;

    const activePreg = pregnancies.find(pr => pr.status === 'active');
    const ga = activePreg ? App.calcGestationalAge(activePreg.lmp) : null;

    App.el('patient-detail-content').innerHTML = `
      <!-- Header -->
      <div class="patient-detail-header">
        <div class="patient-detail-avatar" style="background:${App.avColor(p.first_name+p.last_name)}">
          ${App.initials(p.first_name, p.last_name)}
        </div>
        <div style="flex:1">
          <div class="patient-detail-name">${App.escHtml(p.first_name)} ${App.escHtml(p.last_name)}</div>
          <div class="patient-detail-meta">
            <span>🪪 ${p.patient_no || '—'}</span>
            <span>📞 ${p.phone || '—'}</span>
            <span>🎂 ${App.fmtDate(p.dob)} (${App.calcAge(p.dob)})</span>
            <span>🩸 ${p.blood_group || '—'}</span>
            <span>G${p.gravida||0} P${p.para||0} A${p.abortions||0} L${p.live_births||0}</span>
            ${activePreg && ga ? `<span class="badge badge-pink">🤰 ${ga.label}</span>` : ''}
          </div>
        </div>
        <div class="patient-detail-actions">
          <button class="btn btn-outline btn-sm" onclick="PatientsModule.openEdit('${id}')">✏️ Edit</button>
          <button class="btn btn-primary btn-sm" onclick="ConsultationsModule.openNew('${id}')">📋 New Visit</button>
          <button class="btn btn-accent btn-sm" onclick="PrescriptionsModule.openNew('${id}')">💊 Prescribe</button>
          <button class="btn btn-outline btn-sm" onclick="App.navigate('patients')">← Back</button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs" id="pt-tabs">
        <div class="tab-btn active" onclick="ptTab('overview',this)">Overview</div>
        <div class="tab-btn" onclick="ptTab('consultations',this)">Consultations (${consults.length})</div>
        <div class="tab-btn" onclick="ptTab('pregnancy',this)">Pregnancy (${pregnancies.length})</div>
        <div class="tab-btn" onclick="ptTab('prescriptions',this)">Prescriptions (${prescriptions.length})</div>
        <div class="tab-btn" onclick="ptTab('billing',this)">Billing (${invoices.length})</div>
        <div class="tab-btn" onclick="ptTab('labs',this)">Labs (${labs.length})</div>
        <div class="tab-btn" onclick="ptTab('ultrasound',this)">US (${ultrasounds.length})</div>
      </div>

      <!-- Overview Tab -->
      <div class="tab-panel active" id="ptpanel-overview">
        <div class="grid-2">
          <div class="card">
            <div class="card-title mb-12">📋 Personal Info</div>
            ${_infoRow('Patient No', p.patient_no)}
            ${_infoRow('Date of Birth', App.fmtDate(p.dob))}
            ${_infoRow('Age', App.calcAge(p.dob))}
            ${_infoRow('Blood Group', p.blood_group)}
            ${_infoRow('Religion', p.religion)}
            ${_infoRow('Occupation', p.occupation)}
            ${_infoRow('Marital Status', p.marital_status)}
            ${_infoRow("Husband's Name", p.husband_name)}
            ${_infoRow('Referral', p.referral)}
          </div>
          <div class="card">
            <div class="card-title mb-12">📞 Contact</div>
            ${_infoRow('Phone', p.phone)}
            ${_infoRow('Alt Phone', p.phone_alt)}
            ${_infoRow('Email', p.email)}
            ${_infoRow('Address', p.address)}
            <div class="card-title mb-12 mt-12">🆘 Emergency</div>
            ${_infoRow('Name', p.emergency_name)}
            ${_infoRow('Phone', p.emergency_phone)}
          </div>
        </div>
        <div class="card mt-16">
          <div class="card-title mb-12">🤰 Obstetric Summary</div>
          <div class="grid-4">
            ${_obsBox('Gravida', p.gravida||0)}
            ${_obsBox('Para', p.para||0)}
            ${_obsBox('Live Births', p.live_births||0)}
            ${_obsBox('Abortions', p.abortions||0)}
          </div>
          ${p.notes ? `<div class="mt-12"><strong>Notes:</strong> <span class="text-muted">${App.escHtml(p.notes)}</span></div>` : ''}
        </div>
        ${appts.length ? `
        <div class="card mt-16">
          <div class="card-title mb-12">📅 Recent Appointments</div>
          ${appts.slice(0,3).map(a => `
            <div class="appt-slot">
              <div class="appt-time">${App.fmtDate(a.date)}</div>
              <div class="appt-info"><div class="appt-name">${a.type||'Consultation'}</div><div class="appt-type">${a.notes||''}</div></div>
              <span class="badge ${_apptBadge(a.status)}">${a.status}</span>
            </div>
          `).join('')}
        </div>` : ''}
      </div>

      <!-- Consultations Tab -->
      <div class="tab-panel" id="ptpanel-consultations">
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button class="btn btn-primary btn-sm" onclick="ConsultationsModule.openNew('${id}')">➕ New Note</button>
        </div>
        ${consults.length ? `
        <div class="timeline">
          ${consults.map(c => `
            <div class="timeline-item">
              <div class="timeline-dot">📋</div>
              <div class="timeline-content">
                <div class="timeline-date">${App.fmtDate(c.date)} · ${c.visit_type||'Consultation'}</div>
                <div class="timeline-title">${App.escHtml(c.chief_complaint||'Visit')}</div>
                ${c.diagnosis ? `<div class="timeline-body">Dx: ${App.escHtml(c.diagnosis)}</div>` : ''}
                ${c.bp ? `<div class="timeline-body text-sm">BP: ${c.bp} | Wt: ${c.weight||'—'}kg | Pulse: ${c.pulse||'—'}</div>` : ''}
                <div style="margin-top:6px;display:flex;gap:6px">
                  <button class="btn btn-ghost btn-sm" onclick="ConsultationsModule.view('${c.id}')">View</button>
                  <button class="btn btn-ghost btn-sm" onclick="ConsultationsModule.openEdit('${c.id}')">Edit</button>
                  <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="ConsultationsModule.delete('${c.id}')">Delete</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>` : `<div class="empty-state"><div class="empty-icon">📋</div><h3>No consultations yet</h3></div>`}
      </div>

      <!-- Pregnancy Tab -->
      <div class="tab-panel" id="ptpanel-pregnancy">
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button class="btn btn-primary btn-sm" onclick="PregnancyModule.openNew('${id}')">➕ New Pregnancy</button>
        </div>
        ${pregnancies.length ? pregnancies.map(pr => {
          const ga = App.calcGestationalAge(pr.lmp);
          return `
          <div class="card mb-12 ${pr.status==='active'?'preg-active':''}">
            ${pr.status==='active' ? `
            <div class="preg-card">
              <div class="preg-edd">EDD: ${App.fmtDate(pr.edd||App.calcEDD(pr.lmp))}</div>
              <div class="preg-weeks">${ga ? ga.weeks : '—'}<span style="font-size:18px;font-weight:400"> weeks</span></div>
              <div class="preg-label">${ga ? ga.days + ' days — Pregnancy #' + (pr.pregnancy_no||1) : ''}</div>
            </div>` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:${pr.status==='active'?'14px':'0'}">
              ${_infoRow('LMP', App.fmtDate(pr.lmp))}
              ${_infoRow('EDD', App.fmtDate(pr.edd))}
              ${_infoRow('Status', pr.status)}
              ${_infoRow('Blood Group', pr.blood_group)}
              ${_infoRow('Booking Date', App.fmtDate(pr.booking_date))}
              ${pr.delivery_date ? _infoRow('Delivery', App.fmtDate(pr.delivery_date)+' · '+pr.delivery_type) : ''}
            </div>
            <div style="margin-top:10px;display:flex;gap:6px">
              <button class="btn btn-primary btn-sm" onclick="ANCModule.openNew('${id}','${pr.id}')">📊 ANC Visit</button>
              <button class="btn btn-ghost btn-sm" onclick="PregnancyModule.openEdit('${pr.id}')">✏️ Edit</button>
            </div>
          </div>`;
        }).join('') : `<div class="empty-state"><div class="empty-icon">🤰</div><h3>No pregnancy records</h3></div>`}
      </div>

      <!-- Prescriptions Tab -->
      <div class="tab-panel" id="ptpanel-prescriptions">
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button class="btn btn-primary btn-sm" onclick="PrescriptionsModule.openNew('${id}')">➕ New Rx</button>
        </div>
        ${prescriptions.length ? prescriptions.map(rx => `
          <div class="card mb-8">
            <div class="card-header">
              <div>
                <div class="card-title">${rx.prescription_no||'Rx'}</div>
                <div class="card-subtitle">${App.fmtDate(rx.date)} · ${rx.diagnosis||''}</div>
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn btn-ghost btn-sm" onclick="PrescriptionsModule.openView('${rx.id}')">🖨 Print</button>
              </div>
            </div>
            <div>${(rx.drugs||[]).slice(0,3).map(d=>`<div class="text-sm text-muted">• ${App.escHtml(d.name||'')} — ${App.escHtml(d.sig||'')}</div>`).join('')}</div>
          </div>
        `).join('') : `<div class="empty-state"><div class="empty-icon">💊</div><h3>No prescriptions</h3></div>`}
      </div>

      <!-- Billing Tab -->
      <div class="tab-panel" id="ptpanel-billing">
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button class="btn btn-primary btn-sm" onclick="BillingModule.openNew('${id}')">➕ Invoice</button>
        </div>
        ${invoices.length ? `
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Invoice #</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
            <tbody>
            ${invoices.map(inv => `
              <tr>
                <td>${inv.invoice_no||'—'}</td>
                <td>${App.fmtDate(inv.date)}</td>
                <td>₹${App.currencyFmt(inv.total)}</td>
                <td>₹${App.currencyFmt(inv.paid)}</td>
                <td>₹${App.currencyFmt(inv.balance)}</td>
                <td><span class="badge ${_invBadge(inv.status)}">${inv.status}</span></td>
              </tr>
            `).join('')}
            </tbody>
          </table>
        </div>` : `<div class="empty-state"><div class="empty-icon">🧾</div><h3>No invoices</h3></div>`}
      </div>

      <!-- Labs Tab -->
      <div class="tab-panel" id="ptpanel-labs">
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button class="btn btn-primary btn-sm" onclick="LabsModule.openNew('${id}')">➕ Add Result</button>
        </div>
        ${labs.length ? labs.map(l => `
          <div class="card mb-8">
            <div class="card-header">
              <div><div class="card-title">${l.lab_name||'Lab Result'} · ${l.category||''}</div>
              <div class="card-subtitle">${App.fmtDate(l.date)}</div></div>
            </div>
            <div>${(l.tests||[]).slice(0,4).map(t=>`<div class="text-sm"><strong>${App.escHtml(t.name||'')}:</strong> ${App.escHtml(t.value||'')} ${App.escHtml(t.unit||'')} <span class="text-muted">(${t.normal||''})</span></div>`).join('')}</div>
          </div>
        `).join('') : `<div class="empty-state"><div class="empty-icon">🧪</div><h3>No lab results</h3></div>`}
      </div>

      <!-- Ultrasound Tab -->
      <div class="tab-panel" id="ptpanel-ultrasound">
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button class="btn btn-primary btn-sm" onclick="UltrasoundModule.openNew('${id}')">➕ Add US</button>
        </div>
        ${ultrasounds.length ? ultrasounds.map(u => `
          <div class="card mb-8">
            <div class="card-header">
              <div><div class="card-title">${u.type||'Ultrasound'} · ${u.weeks_by_us ? u.weeks_by_us+'w' : ''}</div>
              <div class="card-subtitle">${App.fmtDate(u.date)} · ${u.done_by||''}</div></div>
            </div>
            <div class="text-sm text-muted">${App.escHtml(u.impression||u.findings||'')}</div>
          </div>
        `).join('') : `<div class="empty-state"><div class="empty-icon">🔬</div><h3>No ultrasound records</h3></div>`}
      </div>
    `;
  }

  // ── NEW / EDIT PATIENT ────────────────────────────────────────
  function openNew() {
    _editId = null;
    App.navigate('new-patient');
    App.el('patient-form-title').textContent = 'New Patient';
    _renderForm({});
  }

  async function openEdit(id) {
    _editId = id;
    const p = await DB.patients.get(id);
    App.navigate('new-patient');
    App.el('patient-form-title').textContent = 'Edit Patient';
    _renderForm(p || {});
  }

  function _renderForm(p) {
    App.el('patient-form-content').innerHTML = `
      <div class="card mb-16">
        <div class="form-section-title">Personal Information</div>
        <div class="form-row">
          <div class="form-group">
            <label>First Name *</label>
            <input class="form-control" id="pf-first" value="${App.escHtml(p.first_name||'')}" placeholder="First name">
          </div>
          <div class="form-group">
            <label>Last Name *</label>
            <input class="form-control" id="pf-last" value="${App.escHtml(p.last_name||'')}" placeholder="Last name">
          </div>
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label>Date of Birth *</label>
            <input class="form-control" type="date" id="pf-dob" value="${p.dob||''}">
          </div>
          <div class="form-group">
            <label>Blood Group</label>
            <select class="form-control" id="pf-bg">
              ${['','A+','A-','B+','B-','O+','O-','AB+','AB-'].map(v=>`<option ${p.blood_group===v?'selected':''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Category *</label>
            <select class="form-control" id="pf-cat">
              ${['gynecology','obstetric','antenatal'].map(v=>`<option value="${v}" ${p.category===v?'selected':''}>${v.charAt(0).toUpperCase()+v.slice(1)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label>Religion</label>
            <input class="form-control" id="pf-religion" value="${App.escHtml(p.religion||'')}">
          </div>
          <div class="form-group">
            <label>Occupation</label>
            <input class="form-control" id="pf-occ" value="${App.escHtml(p.occupation||'')}">
          </div>
          <div class="form-group">
            <label>Marital Status</label>
            <select class="form-control" id="pf-ms">
              ${['Married','Single','Widowed','Divorced'].map(v=>`<option ${p.marital_status===v?'selected':''}>${v}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Husband's Name</label>
            <input class="form-control" id="pf-husb" value="${App.escHtml(p.husband_name||'')}">
          </div>
          <div class="form-group">
            <label>Referral Source</label>
            <input class="form-control" id="pf-ref" value="${App.escHtml(p.referral||'')}">
          </div>
        </div>
      </div>

      <div class="card mb-16">
        <div class="form-section-title">Contact Information</div>
        <div class="form-row">
          <div class="form-group">
            <label>Phone *</label>
            <input class="form-control" type="tel" id="pf-phone" value="${App.escHtml(p.phone||'')}">
          </div>
          <div class="form-group">
            <label>Alternate Phone</label>
            <input class="form-control" type="tel" id="pf-phone2" value="${App.escHtml(p.phone_alt||'')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Email</label>
            <input class="form-control" type="email" id="pf-email" value="${App.escHtml(p.email||'')}">
          </div>
          <div class="form-group">
            <label>Address</label>
            <input class="form-control" id="pf-addr" value="${App.escHtml(p.address||'')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Emergency Contact Name</label>
            <input class="form-control" id="pf-ename" value="${App.escHtml(p.emergency_name||'')}">
          </div>
          <div class="form-group">
            <label>Emergency Contact Phone</label>
            <input class="form-control" type="tel" id="pf-ephone" value="${App.escHtml(p.emergency_phone||'')}">
          </div>
        </div>
      </div>

      <div class="card mb-16">
        <div class="form-section-title">Obstetric History</div>
        <div class="form-row-4">
          <div class="form-group">
            <label>Gravida</label>
            <input class="form-control" type="number" id="pf-g" value="${p.gravida||0}" min="0">
          </div>
          <div class="form-group">
            <label>Para</label>
            <input class="form-control" type="number" id="pf-p" value="${p.para||0}" min="0">
          </div>
          <div class="form-group">
            <label>Live Births</label>
            <input class="form-control" type="number" id="pf-l" value="${p.live_births||0}" min="0">
          </div>
          <div class="form-group">
            <label>Abortions</label>
            <input class="form-control" type="number" id="pf-a" value="${p.abortions||0}" min="0">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>LMP</label>
            <input class="form-control" type="date" id="pf-lmp" value="${p.lmp||''}" oninput="document.getElementById('pf-edd').value=App.calcEDD(this.value)||''">
          </div>
          <div class="form-group">
            <label>EDD (auto-calculated)</label>
            <input class="form-control" type="date" id="pf-edd" value="${p.lmp ? App.calcEDD(p.lmp)||'' : ''}">
          </div>
        </div>
        <div class="form-group">
          <label>Chief Complaint</label>
          <textarea class="form-control" id="pf-cc" rows="2">${App.escHtml(p.chief_complaint||'')}</textarea>
        </div>
        <div class="form-group">
          <label>Past Medical History / Allergies</label>
          <textarea class="form-control" id="pf-pmh" rows="2">${App.escHtml(p.past_medical_history||'')}</textarea>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea class="form-control" id="pf-notes" rows="2">${App.escHtml(p.notes||'')}</textarea>
        </div>
      </div>
    `;
  }

  async function saveForm() {
    const data = _collectForm();
    if (!data) return;
    App.loading(true, 'Saving patient…');
    try {
      if (_editId) {
        await DB.patients.update(_editId, data);
        App.toast('Patient updated');
        openDetail(_editId);
      } else {
        const id = await DB.patients.create(data);
        App.toast('Patient registered');
        openDetail(id);
      }
    } catch (e) {
      App.toast('Save failed: ' + e.message, 'error');
    } finally {
      App.loading(false);
    }
  }

  async function saveModal() {
    const data = _collectForm();
    if (!data) return;
    App.loading(true);
    try {
      await DB.patients.create(data);
      App.closeModal('modal-patient');
      App.toast('Patient saved');
      render();
    } catch (e) {
      App.toast(e.message, 'error');
    } finally { App.loading(false); }
  }

  function _collectForm() {
    const v = id => App.el(id)?.value?.trim();
    if (!v('pf-first') || !v('pf-last')) { App.toast('First and last name required', 'warning'); return null; }
    if (!v('pf-dob'))   { App.toast('Date of birth required', 'warning'); return null; }
    if (!v('pf-phone')) { App.toast('Phone number required', 'warning'); return null; }
    return {
      first_name: v('pf-first'), last_name: v('pf-last'),
      dob: v('pf-dob'), blood_group: v('pf-bg'),
      category: v('pf-cat') || 'gynecology',
      religion: v('pf-religion'), occupation: v('pf-occ'),
      marital_status: v('pf-ms'), husband_name: v('pf-husb'),
      referral: v('pf-ref'),
      phone: v('pf-phone'), phone_alt: v('pf-phone2'),
      email: v('pf-email'), address: v('pf-addr'),
      emergency_name: v('pf-ename'), emergency_phone: v('pf-ephone'),
      gravida: parseInt(v('pf-g'))||0, para: parseInt(v('pf-p'))||0,
      live_births: parseInt(v('pf-l'))||0, abortions: parseInt(v('pf-a'))||0,
      lmp: v('pf-lmp'), chief_complaint: v('pf-cc'),
      past_medical_history: v('pf-pmh'), notes: v('pf-notes'),
    };
  }

  // Tab switch
  window.ptTab = function(name, btn) {
    document.querySelectorAll('#patient-detail-content .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#patient-detail-content .tab-panel').forEach(p => p.classList.remove('active'));
    btn?.classList.add('active');
    const panel = App.el('ptpanel-' + name);
    panel?.classList.add('active');
  };

  // Helpers
  function _infoRow(label, value) {
    return `<div class="mb-8"><span class="text-muted text-sm">${label}: </span><span>${value || '—'}</span></div>`;
  }
  function _obsBox(label, val) {
    return `<div class="vital-card"><div class="vital-label">${label}</div><div class="vital-value">${val}</div></div>`;
  }
  function _catBadge(c) {
    return { obstetric:'badge-pink', gynecology:'badge-blue', antenatal:'badge-green' }[c] || 'badge-gray';
  }
  function _apptBadge(s) {
    return { scheduled:'badge-blue', completed:'badge-green', cancelled:'badge-red' }[s] || 'badge-gray';
  }
  function _invBadge(s) {
    return { paid:'badge-green', pending:'badge-orange', partial:'badge-blue' }[s] || 'badge-gray';
  }

  return { init, render, filter, search, openNew, openEdit, openDetail, saveForm, saveModal };
})();

window.PatientsModule = PatientsModule;
