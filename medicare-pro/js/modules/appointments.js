'use strict';

const AppointmentsModule = (() => {
  let _editId = null;
  let _dateFilter = App?.today ? App.today() : new Date().toISOString().slice(0,10);

  async function init() {
    _dateFilter = new Date().toISOString().slice(0, 10);
  }

  async function render() {
    const el = App.el('appt-date-filter');
    if (el && !el.value) el.value = _dateFilter;
    await _renderList(_dateFilter);
  }

  async function filterDate(date) {
    _dateFilter = date;
    await _renderList(date);
  }

  async function _renderList(date) {
    const appts = date
      ? await DB.appointments.byDate(date)
      : await DB.appointments.upcoming(30);

    const container = App.el('appointments-content');
    if (!container) return;

    if (!appts.length) {
      container.innerHTML = `<div class="card"><div class="empty-state">
        <div class="empty-icon">📅</div>
        <h3>No appointments${date ? ' on this date' : ''}</h3>
        <button class="btn btn-primary mt-16" onclick="AppointmentsModule.openNew()">➕ Book Appointment</button>
      </div></div>`;
      return;
    }

    container.innerHTML = `
      <div class="card" style="padding:0">
        ${appts.map(a => `
          <div class="patient-row" style="cursor:default">
            <div style="text-align:center;min-width:60px">
              <div style="font-size:15px;font-weight:700">${fmtTime(a.time)}</div>
              <div class="text-sm text-muted">${a.duration_mins||15}min</div>
            </div>
            <div class="patient-info" id="appt-name-${a.id}">
              <div class="patient-name">Loading…</div>
              <div class="patient-sub">${a.type||'Consultation'} ${a.notes ? '· ' + a.notes : ''}</div>
            </div>
            <span class="badge ${_badge(a.status)}">${a.status}</span>
            <div class="table-actions">
              <button class="btn btn-ghost btn-sm" onclick="AppointmentsModule.markStatus('${a.id}','completed')">✓</button>
              <button class="btn btn-ghost btn-sm" onclick="AppointmentsModule.openEdit('${a.id}')">✏️</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="AppointmentsModule.delete('${a.id}')">🗑</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Load patient names
    for (const a of appts) {
      const pt = await DB.patients.get(a.patient_id);
      const el = App.el('appt-name-' + a.id);
      if (el && pt) el.innerHTML = `
        <div class="patient-name" onclick="PatientsModule.openDetail('${pt.id}')" style="cursor:pointer;color:var(--primary)">
          ${App.escHtml(pt.first_name)} ${App.escHtml(pt.last_name)}
        </div>
        <div class="patient-sub">${pt.patient_no||''} · ${pt.phone||''}</div>
      `;
    }
  }

  async function openNew(patientId) {
    _editId = null;
    const patients = await DB.patients.list();
    App.el('modal-appt-title').textContent = 'New Appointment';
    App.el('modal-appt-body').innerHTML = `
      <div class="form-group">
        <label>Patient *</label>
        <select class="form-control" id="appt-patient">
          <option value="">— Select patient —</option>
          ${patients.map(p => `<option value="${p.id}" ${p.id===patientId?'selected':''}>${p.first_name} ${p.last_name} (${p.patient_no||''})</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date *</label>
          <input class="form-control" type="date" id="appt-date" value="${_dateFilter}">
        </div>
        <div class="form-group">
          <label>Time *</label>
          <input class="form-control" type="time" id="appt-time" value="09:00">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type</label>
          <select class="form-control" id="appt-type">
            ${['consultation','anc','follow-up','procedure','scan','delivery','other'].map(v=>`<option>${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Duration (min)</label>
          <select class="form-control" id="appt-dur">
            ${[15,20,30,45,60].map(v=>`<option ${v===15?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-control" id="appt-notes" rows="2"></textarea>
      </div>
    `;
    App.openModal('modal-appt');
  }

  async function openEdit(id) {
    _editId = id;
    const [a, patients] = await Promise.all([DB.appointments.get(id), DB.patients.list()]);
    App.el('modal-appt-title').textContent = 'Edit Appointment';
    App.el('modal-appt-body').innerHTML = `
      <div class="form-group">
        <label>Patient</label>
        <select class="form-control" id="appt-patient">
          ${patients.map(p => `<option value="${p.id}" ${p.id===a.patient_id?'selected':''}>${p.first_name} ${p.last_name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Date</label><input class="form-control" type="date" id="appt-date" value="${a.date||''}"></div>
        <div class="form-group"><label>Time</label><input class="form-control" type="time" id="appt-time" value="${a.time||'09:00'}"></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type</label>
          <select class="form-control" id="appt-type">
            ${['consultation','anc','follow-up','procedure','scan','delivery','other'].map(v=>`<option ${a.type===v?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select class="form-control" id="appt-status">
            ${['scheduled','completed','cancelled','no-show'].map(v=>`<option ${a.status===v?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group"><label>Notes</label><textarea class="form-control" id="appt-notes" rows="2">${App.escHtml(a.notes||'')}</textarea></div>
    `;
    App.openModal('modal-appt');
  }

  async function save() {
    const pid   = App.el('appt-patient')?.value;
    const date  = App.el('appt-date')?.value;
    const time  = App.el('appt-time')?.value;
    if (!pid || !date || !time) { App.toast('Patient, date and time required', 'warning'); return; }
    const data = {
      patient_id: pid, date, time,
      type:   App.el('appt-type')?.value || 'consultation',
      status: App.el('appt-status')?.value || 'scheduled',
      duration_mins: parseInt(App.el('appt-dur')?.value || 15),
      notes: App.el('appt-notes')?.value?.trim() || '',
    };
    try {
      if (_editId) await DB.appointments.update(_editId, data);
      else         await DB.appointments.create(data);
      App.closeModal('modal-appt');
      App.toast('Appointment saved');
      await _renderList(_dateFilter);
    } catch (e) { App.toast(e.message, 'error'); }
  }

  async function markStatus(id, status) {
    await DB.appointments.update(id, { status });
    await _renderList(_dateFilter);
    App.toast('Status updated');
  }

  async function deleteAppt(id) {
    App.confirm('Delete this appointment?', async () => {
      await DB.appointments.delete(id);
      await _renderList(_dateFilter);
      App.toast('Appointment deleted');
    });
  }

  function _badge(s) {
    return { scheduled:'badge-blue', completed:'badge-green', cancelled:'badge-red', 'no-show':'badge-orange' }[s] || 'badge-gray';
  }

  function fmtTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hr = parseInt(h);
    return `${hr > 12 ? hr-12 : hr||12}:${m} ${hr>=12?'PM':'AM'}`;
  }

  return { init, render, filterDate, openNew, openEdit, save, markStatus, delete: deleteAppt };
})();

window.AppointmentsModule = AppointmentsModule;
