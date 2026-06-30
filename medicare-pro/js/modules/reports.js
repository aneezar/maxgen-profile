'use strict';

const ReportsModule = (() => {

  async function init() {}

  async function render() {
    const container = App.el('reports-content');
    if (!container) return;
    container.innerHTML = `
      <div class="page-header"><h2>Reports &amp; Analytics</h2></div>
      <div class="grid-2 mb-16">
        <div class="card" style="cursor:pointer" onclick="ReportsModule.showPatientReport()">
          <div class="qa-icon">👩</div>
          <div class="card-title mt-8">Patient Statistics</div>
          <div class="card-subtitle">Total patients, demographics, categories</div>
        </div>
        <div class="card" style="cursor:pointer" onclick="ReportsModule.showPregnancyReport()">
          <div class="qa-icon">🤰</div>
          <div class="card-title mt-8">Pregnancy Report</div>
          <div class="card-subtitle">Active pregnancies, deliveries, outcomes</div>
        </div>
        <div class="card" style="cursor:pointer" onclick="ReportsModule.showAppointmentReport()">
          <div class="qa-icon">📅</div>
          <div class="card-title mt-8">Appointment Report</div>
          <div class="card-subtitle">Visits, cancellations, follow-ups</div>
        </div>
        <div class="card" style="cursor:pointer" onclick="ReportsModule.showRevenueReport()">
          <div class="qa-icon">💰</div>
          <div class="card-title mt-8">Revenue Report</div>
          <div class="card-subtitle">Collections, pending, payment methods</div>
        </div>
      </div>
      <div id="report-output"></div>
    `;
  }

  async function showPatientReport() {
    const patients = await DB.patients.list();
    const byCategory = {};
    patients.forEach(p => { byCategory[p.category||'other'] = (byCategory[p.category||'other']||0) + 1; });
    const byAge = { '< 20':0, '20-30':0, '31-40':0, '41-50':0, '> 50':0 };
    patients.forEach(p => {
      const age = App.calcAgeNum(p.dob);
      if (age < 20) byAge['< 20']++;
      else if (age <= 30) byAge['20-30']++;
      else if (age <= 40) byAge['31-40']++;
      else if (age <= 50) byAge['41-50']++;
      else byAge['> 50']++;
    });

    App.el('report-output').innerHTML = `
      <div class="card">
        <div class="card-header"><div class="card-title">Patient Statistics Report</div>
          <button class="btn btn-outline btn-sm" onclick="window.print()">🖨 Print</button>
        </div>
        <div class="grid-2">
          <div>
            <div class="form-section-title">By Category</div>
            ${Object.entries(byCategory).map(([k,v])=>`
              <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
                <span>${k}</span><strong>${v}</strong>
              </div>
            `).join('')}
            <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:700">
              <span>Total</span><strong>${patients.length}</strong>
            </div>
          </div>
          <div>
            <div class="form-section-title">By Age Group</div>
            ${Object.entries(byAge).map(([k,v])=>`
              <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
                <span>${k} years</span><strong>${v}</strong>
              </div>
            `).join('')}
          </div>
        </div>
      </div>`;
  }

  async function showPregnancyReport() {
    const pregnancies = await DB.pregnancies.list();
    const active    = pregnancies.filter(p => p.status === 'active').length;
    const delivered = pregnancies.filter(p => p.status === 'delivered').length;
    const highRisk  = pregnancies.filter(p => p.risk_factors && Object.values(p.risk_factors).some(v=>v)).length;

    App.el('report-output').innerHTML = `
      <div class="card">
        <div class="card-header"><div class="card-title">Pregnancy Report</div>
          <button class="btn btn-outline btn-sm" onclick="window.print()">🖨 Print</button>
        </div>
        <div class="stats-grid">
          <div class="stat-card pink"><div class="stat-value">${active}</div><div class="stat-label">Active</div></div>
          <div class="stat-card green"><div class="stat-value">${delivered}</div><div class="stat-label">Delivered</div></div>
          <div class="stat-card orange"><div class="stat-value">${highRisk}</div><div class="stat-label">High Risk</div></div>
          <div class="stat-card blue"><div class="stat-value">${pregnancies.length}</div><div class="stat-label">Total</div></div>
        </div>
        <div class="table-wrapper mt-16">
          <table>
            <thead><tr><th>Patient</th><th>GA</th><th>EDD</th><th>Status</th><th>Risk</th></tr></thead>
            <tbody id="preg-report-body"></tbody>
          </table>
        </div>
      </div>`;

    const tbody = App.el('preg-report-body');
    for (const pr of pregnancies.slice(0, 20)) {
      const pt = await DB.patients.get(pr.patient_id);
      const ga = App.calcGestationalAge(pr.lmp);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${pt ? pt.first_name+' '+pt.last_name : '—'}</td>
        <td>${ga ? ga.label : '—'}</td>
        <td>${App.fmtDate(pr.edd)}</td>
        <td><span class="badge ${pr.status==='active'?'badge-pink':'badge-green'}">${pr.status}</span></td>
        <td>${pr.risk_factors && Object.values(pr.risk_factors).some(v=>v) ? '<span class="badge badge-red">High</span>' : '<span class="badge badge-green">Normal</span>'}
        </td>`;
      tbody.appendChild(tr);
    }
  }

  async function showAppointmentReport() {
    const all = await DB.appointments.list();
    const byStatus = {};
    all.forEach(a => { byStatus[a.status||'scheduled'] = (byStatus[a.status||'scheduled']||0) + 1; });
    const byType = {};
    all.forEach(a => { byType[a.type||'consultation'] = (byType[a.type||'consultation']||0) + 1; });

    App.el('report-output').innerHTML = `
      <div class="card">
        <div class="card-header"><div class="card-title">Appointment Report</div>
          <button class="btn btn-outline btn-sm" onclick="window.print()">🖨 Print</button>
        </div>
        <div class="grid-2">
          <div>
            <div class="form-section-title">By Status</div>
            ${Object.entries(byStatus).map(([k,v])=>`
              <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
                <span>${k}</span><strong>${v}</strong>
              </div>`).join('')}
            <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:700">
              <span>Total</span><strong>${all.length}</strong>
            </div>
          </div>
          <div>
            <div class="form-section-title">By Type</div>
            ${Object.entries(byType).map(([k,v])=>`
              <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
                <span>${k}</span><strong>${v}</strong>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
  }

  async function showRevenueReport() {
    const invoices = await DB.invoices.list();
    const total    = invoices.reduce((s,i) => s + (i.total||0), 0);
    const collected= invoices.reduce((s,i) => s + (i.paid||0), 0);
    const pending  = invoices.reduce((s,i) => s + (i.balance||0), 0);
    const byMethod = {};
    invoices.filter(i=>i.paid>0).forEach(i => { byMethod[i.payment_method||'Cash'] = (byMethod[i.payment_method||'Cash']||0) + i.paid; });

    App.el('report-output').innerHTML = `
      <div class="card">
        <div class="card-header"><div class="card-title">Revenue Report</div>
          <button class="btn btn-outline btn-sm" onclick="window.print()">🖨 Print</button>
        </div>
        <div class="stats-grid mb-16">
          <div class="stat-card blue"><div class="stat-icon">🧾</div>
            <div class="stat-value">${invoices.length}</div><div class="stat-label">Invoices</div></div>
          <div class="stat-card green"><div class="stat-icon">💰</div>
            <div class="stat-value">₹${App.currencyFmt(collected)}</div><div class="stat-label">Collected</div></div>
          <div class="stat-card orange"><div class="stat-icon">⏳</div>
            <div class="stat-value">₹${App.currencyFmt(pending)}</div><div class="stat-label">Pending</div></div>
          <div class="stat-card pink"><div class="stat-icon">📊</div>
            <div class="stat-value">₹${App.currencyFmt(total)}</div><div class="stat-label">Total Billed</div></div>
        </div>
        <div class="form-section-title">Collections by Payment Method</div>
        ${Object.entries(byMethod).map(([k,v])=>`
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
            <span>${k}</span><strong>₹${App.currencyFmt(v)}</strong>
          </div>`).join('')}
      </div>`;
  }

  return { init, render, showPatientReport, showPregnancyReport, showAppointmentReport, showRevenueReport };
})();

window.ReportsModule = ReportsModule;
