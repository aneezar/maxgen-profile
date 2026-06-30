'use strict';

const DashboardModule = (() => {

  async function init() {}

  async function render() {
    const today = App.today();
    const [patients, appts, pregnancies] = await Promise.all([
      DB.patients.list(),
      DB.appointments.byDate(today),
      DB.pregnancies.active(),
    ]);

    const totalPts    = patients.length;
    const todayAppts  = appts.length;
    const activePregs = pregnancies.length;

    // Upcoming appointments (next 7 days)
    const allAppts = await DB.appointments.upcoming(7);

    // Reminders: patients with next_visit overdue
    const reminders = patients.filter(p => p.last_visit && daysDiff(p.last_visit) < -14).slice(0, 5);

    // Recent patients
    const recent = [...patients].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

    App.el('dashboard-content').innerHTML = `
      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card blue">
          <div class="stat-icon">👩</div>
          <div class="stat-value">${totalPts}</div>
          <div class="stat-label">Total Patients</div>
        </div>
        <div class="stat-card pink">
          <div class="stat-icon">📅</div>
          <div class="stat-value">${todayAppts}</div>
          <div class="stat-label">Today's Appointments</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">🤰</div>
          <div class="stat-value">${activePregs}</div>
          <div class="stat-label">Active Pregnancies</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-icon">⏰</div>
          <div class="stat-value">${reminders.length}</div>
          <div class="stat-label">Follow-up Due</div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <div class="qa-btn" onclick="PatientsModule.openNew()">
          <span class="qa-icon">➕</span><span class="qa-label">New Patient</span>
        </div>
        <div class="qa-btn" onclick="AppointmentsModule.openNew()">
          <span class="qa-icon">📅</span><span class="qa-label">Appointment</span>
        </div>
        <div class="qa-btn" onclick="PrescriptionsModule.openNew()">
          <span class="qa-icon">💊</span><span class="qa-label">Prescription</span>
        </div>
        <div class="qa-btn" onclick="BillingModule.openNew()">
          <span class="qa-icon">🧾</span><span class="qa-label">Invoice</span>
        </div>
      </div>

      <div class="grid-2">
        <!-- Today's Appointments -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">📅 Today's Appointments</div>
              <div class="card-subtitle">${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</div>
            </div>
            <button class="btn btn-outline btn-sm" onclick="App.navigate('appointments')">View All</button>
          </div>
          ${appts.length ? appts.slice(0,6).map(a => `
            <div class="appt-slot" onclick="App.navigate('appointments')">
              <div class="appt-time">${fmtTime(a.time)}</div>
              <div class="appt-info">
                <div class="appt-name" id="appt-pt-${a.id}">Loading…</div>
                <div class="appt-type">${a.type || 'Consultation'}</div>
              </div>
              <span class="badge ${apptBadge(a.status)}">${a.status || 'scheduled'}</span>
            </div>
          `).join('') : '<div class="empty-state" style="padding:30px"><div class="empty-icon">📅</div><p>No appointments today</p></div>'}
          ${appts.length ? '<button class="btn btn-ghost btn-sm btn-block mt-8" onclick="App.navigate(\'appointments\')">See all →</button>' : ''}
        </div>

        <!-- Recent Patients -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">👩 Recent Patients</div>
            <button class="btn btn-outline btn-sm" onclick="App.navigate('patients')">View All</button>
          </div>
          ${recent.length ? recent.map(p => `
            <div class="patient-row" onclick="PatientsModule.openDetail('${p.id}')">
              ${App.avatar(p.first_name, p.last_name, 36)}
              <div class="patient-info">
                <div class="patient-name">${App.escHtml(p.first_name)} ${App.escHtml(p.last_name)}</div>
                <div class="patient-sub">${p.patient_no || ''} · ${App.calcAge(p.dob)}</div>
              </div>
              <span class="badge ${catBadge(p.category)}">${p.category || 'General'}</span>
            </div>
          `).join('') : '<div class="empty-state" style="padding:30px"><div class="empty-icon">👩</div><p>No patients yet</p></div>'}
        </div>
      </div>

      <!-- Active Pregnancies -->
      ${activePregs ? `
      <div class="card mt-16">
        <div class="card-header">
          <div class="card-title">🤰 Active Pregnancies</div>
          <button class="btn btn-outline btn-sm" onclick="App.navigate('pregnancy')">View All</button>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr>
              <th>Patient</th><th>GA</th><th>EDD</th><th>Risk</th><th></th>
            </tr></thead>
            <tbody>
            ${pregnancies.slice(0,5).map(pr => {
              const ga = App.calcGestationalAge(pr.lmp);
              return `<tr>
                <td id="preg-pt-${pr.id}">Loading…</td>
                <td><strong>${ga ? ga.label : '—'}</strong></td>
                <td>${App.fmtDate(pr.edd)}</td>
                <td>${pr.risk_factors && Object.values(pr.risk_factors).some(v=>v) ? '<span class="badge badge-red">High Risk</span>' : '<span class="badge badge-green">Normal</span>'}</td>
                <td><button class="btn btn-ghost btn-sm" onclick="App.navigate('anc')">ANC →</button></td>
              </tr>`;
            }).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}
    `;

    // Async load patient names for appointments
    appts.slice(0, 6).forEach(async a => {
      const pt = await DB.patients.get(a.patient_id);
      const el = App.el('appt-pt-' + a.id);
      if (el && pt) el.textContent = `${pt.first_name} ${pt.last_name}`;
    });

    // Async load patient names for pregnancies
    pregnancies.slice(0, 5).forEach(async pr => {
      const pt = await DB.patients.get(pr.patient_id);
      const el = App.el('preg-pt-' + pr.id);
      if (el && pt) el.textContent = `${pt.first_name} ${pt.last_name}`;
    });
  }

  function daysDiff(dateStr) {
    return Math.floor((new Date(dateStr) - new Date()) / 86400000);
  }

  function fmtTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hr = parseInt(h);
    return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
  }

  function apptBadge(s) {
    return { scheduled:'badge-blue', completed:'badge-green', cancelled:'badge-red' }[s] || 'badge-gray';
  }

  function catBadge(c) {
    return { obstetric:'badge-pink', gynecology:'badge-blue', antenatal:'badge-green' }[c] || 'badge-gray';
  }

  return { init, render };
})();

window.DashboardModule = DashboardModule;
