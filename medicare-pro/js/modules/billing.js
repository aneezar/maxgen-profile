'use strict';

const BillingModule = (() => {
  let _editId = null;
  let _items  = [];

  const DEFAULT_SERVICES = [
    { description:'Consultation',      rate: 500 },
    { description:'ANC Visit',         rate: 400 },
    { description:'Ultrasound Scan',   rate: 800 },
    { description:'Lab Test',          rate: 300 },
    { description:'Delivery (Normal)', rate: 15000 },
    { description:'Delivery (LSCS)',   rate: 25000 },
    { description:'Procedure',         rate: 2000 },
  ];

  async function init() {}

  async function render() {
    const invoices = await DB.invoices.list();
    const container = App.el('billing-content');
    if (!container) return;

    // Summary stats
    const totalRevenue = invoices.reduce((s,i) => s + (i.paid||0), 0);
    const totalPending = invoices.filter(i => i.status !== 'paid').reduce((s,i) => s + (i.balance||0), 0);

    if (!invoices.length) {
      container.innerHTML = `<div class="card"><div class="empty-state">
        <div class="empty-icon">🧾</div><h3>No invoices yet</h3>
        <button class="btn btn-primary mt-16" onclick="BillingModule.openNew()">➕ New Invoice</button>
      </div></div>`;
      return;
    }

    container.innerHTML = `
      <div class="stats-grid mb-16">
        <div class="stat-card blue"><div class="stat-icon">🧾</div>
          <div class="stat-value">${invoices.length}</div><div class="stat-label">Total Invoices</div></div>
        <div class="stat-card green"><div class="stat-icon">💰</div>
          <div class="stat-value">₹${App.currencyFmt(totalRevenue)}</div><div class="stat-label">Total Collected</div></div>
        <div class="stat-card orange"><div class="stat-icon">⏳</div>
          <div class="stat-value">₹${App.currencyFmt(totalPending)}</div><div class="stat-label">Pending</div></div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Invoice #</th><th>Patient</th><th>Date</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Method</th><th>Status</th><th></th></tr></thead>
          <tbody>
          ${invoices.map(inv => `
            <tr>
              <td><strong>${inv.invoice_no||'—'}</strong></td>
              <td id="invpt-${inv.id}">…</td>
              <td>${App.fmtDate(inv.date)}</td>
              <td>₹${App.currencyFmt(inv.total)}</td>
              <td>₹${App.currencyFmt(inv.paid)}</td>
              <td>₹${App.currencyFmt(inv.balance)}</td>
              <td>${inv.payment_method||'Cash'}</td>
              <td><span class="badge ${_badge(inv.status)}">${inv.status}</span></td>
              <td><div class="table-actions">
                <button class="btn btn-ghost btn-sm" onclick="BillingModule.openView('${inv.id}')">🖨</button>
                <button class="btn btn-ghost btn-sm" onclick="BillingModule.openEdit('${inv.id}')">✏️</button>
                <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="BillingModule.delete('${inv.id}')">🗑</button>
              </div></td>
            </tr>
          `).join('')}
          </tbody>
        </table>
      </div>`;

    for (const inv of invoices) {
      const pt = await DB.patients.get(inv.patient_id);
      const el = App.el('invpt-' + inv.id);
      if (el && pt) el.textContent = `${pt.first_name} ${pt.last_name}`;
    }
  }

  async function openNew(patientId) {
    _editId = null;
    _items  = [_emptyItem()];
    const patients = await DB.patients.list();
    App.el('modal-invoice-title').textContent = 'New Invoice';
    App.el('modal-invoice-body').innerHTML = _form({}, patients, patientId);
    _renderItems();
    App.openModal('modal-invoice');
  }

  async function openEdit(id) {
    _editId = id;
    const [inv, patients] = await Promise.all([DB.invoices.get(id), DB.patients.list()]);
    _items = (inv.items||[]).length ? inv.items.map(i=>({...i})) : [_emptyItem()];
    App.el('modal-invoice-title').textContent = 'Edit Invoice';
    App.el('modal-invoice-body').innerHTML = _form(inv, patients, inv.patient_id);
    _renderItems();
    App.openModal('modal-invoice');
  }

  async function openView(id) {
    const inv = await DB.invoices.get(id);
    const pt  = await DB.patients.get(inv.patient_id);
    const s   = await DB.settings.get();
    const clinic = s.clinic || {};
    const doctor = s.profile || {};

    const w = window.open('', '_blank', 'width=700,height=900');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Invoice ${inv.invoice_no||''}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; color: #111; max-width: 650px; margin: auto; }
        .header { display:flex; justify-content:space-between; border-bottom: 2px solid #1a56db; padding-bottom: 14px; margin-bottom: 20px; }
        .clinic h2 { color: #1a56db; margin:0; font-size: 20px; }
        .clinic p  { margin: 2px 0; font-size: 12px; color: #555; }
        .inv-title { text-align:right; }
        .inv-title h3 { font-size: 24px; margin:0; color: #1a56db; }
        .pt-box { background:#f5f5f5; border-radius:8px; padding:12px; margin-bottom:20px; display:grid; grid-template-columns:1fr 1fr; font-size:13px; }
        table { width:100%; border-collapse:collapse; margin-bottom:16px; }
        th { background:#1a56db; color:#fff; padding:8px; font-size:12px; text-align:left; }
        td { padding:8px; border-bottom:1px solid #eee; font-size:13px; }
        .totals { text-align:right; }
        .totals p { margin: 4px 0; font-size: 14px; }
        .totals .grand { font-size: 18px; font-weight: 700; color: #1a56db; border-top: 2px solid #1a56db; padding-top: 8px; }
        .footer { margin-top: 30px; border-top: 1px solid #eee; padding-top: 14px; display:flex; justify-content:space-between; font-size:12px; color:#777; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>
      <div class="header">
        <div class="clinic">
          <h2>${clinic.name||'Gynecology Clinic'}</h2>
          <p>${clinic.address||''}</p>
          <p>${clinic.phone||''} ${clinic.email ? '| '+clinic.email : ''}</p>
          <p><strong>${doctor.name||'Dr. Bincy'}</strong> · ${doctor.specialization||'Gynecologist'}</p>
        </div>
        <div class="inv-title">
          <h3>INVOICE</h3>
          <p><strong>${inv.invoice_no||''}</strong></p>
          <p>Date: ${App.fmtDate(inv.date)}</p>
        </div>
      </div>
      <div class="pt-box">
        <div><strong>Patient:</strong> ${pt?.first_name||''} ${pt?.last_name||''}</div>
        <div><strong>Patient ID:</strong> ${pt?.patient_no||''}</div>
        <div><strong>Phone:</strong> ${pt?.phone||'—'}</div>
        <div><strong>Payment:</strong> ${inv.payment_method||'Cash'}</div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate (₹)</th><th>Amount (₹)</th></tr></thead>
        <tbody>
          ${(inv.items||[]).map((item,i)=>`<tr>
            <td>${i+1}</td><td>${item.description||''}</td>
            <td>${item.qty||1}</td><td>${App.currencyFmt(item.rate)}</td>
            <td>${App.currencyFmt(item.amount)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="totals">
        <p>Subtotal: ₹${App.currencyFmt(inv.subtotal)}</p>
        ${inv.discount ? `<p>Discount: -₹${App.currencyFmt(inv.discount)}</p>` : ''}
        ${inv.tax ? `<p>Tax: ₹${App.currencyFmt(inv.tax)}</p>` : ''}
        <p class="grand">Total: ₹${App.currencyFmt(inv.total)}</p>
        <p>Paid: ₹${App.currencyFmt(inv.paid)}</p>
        ${inv.balance > 0 ? `<p>Balance Due: ₹${App.currencyFmt(inv.balance)}</p>` : ''}
      </div>
      ${inv.notes ? `<p><em>Notes: ${inv.notes}</em></p>` : ''}
      <div class="footer">
        <div>Status: <strong>${inv.status}</strong></div>
        <div>Thank you for visiting!</div>
      </div>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  }

  function print() { if (_editId) openView(_editId); }

  function _form(inv, patients, selPid) {
    return `
      <div class="form-row">
        <div class="form-group">
          <label>Patient *</label>
          <select class="form-control" id="inv-patient">
            <option value="">— Select —</option>
            ${patients.map(p=>`<option value="${p.id}" ${p.id===selPid?'selected':''}>${p.first_name} ${p.last_name} (${p.patient_no||''})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Date *</label>
          <input class="form-control" type="date" id="inv-date" value="${inv.date||App.today()}">
        </div>
      </div>
      <div class="form-section-title">Items</div>
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:6px;margin-bottom:4px;font-size:12px;font-weight:600;color:var(--text2)">
        <div>Description</div><div>Qty</div><div>Rate (₹)</div><div>Amount (₹)</div><div></div>
      </div>
      <div id="inv-items-container"></div>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" onclick="BillingModule._addItem()">➕ Add Item</button>
        ${DEFAULT_SERVICES.map(s=>`<button class="btn btn-ghost btn-sm" onclick="BillingModule._quickAdd('${App.escHtml(s.description)}',${s.rate})">${s.description}</button>`).join('')}
      </div>
      <div id="inv-totals" class="invoice-totals mt-12"></div>
      <div class="form-row mt-8">
        <div class="form-group">
          <label>Discount (₹)</label>
          <input class="form-control" type="number" id="inv-disc" value="${inv.discount||0}" oninput="BillingModule._calcTotals()">
        </div>
        <div class="form-group">
          <label>Payment Method</label>
          <select class="form-control" id="inv-method">
            ${['Cash','Card','UPI','Bank Transfer','Insurance'].map(m=>`<option ${inv.payment_method===m?'selected':''}>${m}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Amount Paid (₹)</label>
          <input class="form-control" type="number" id="inv-paid" value="${inv.paid||0}" oninput="BillingModule._calcTotals()">
        </div>
        <div class="form-group">
          <label>Status</label>
          <select class="form-control" id="inv-status">
            ${['pending','partial','paid'].map(s=>`<option ${inv.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input class="form-control" id="inv-notes" value="${App.escHtml(inv.notes||'')}">
      </div>`;
  }

  function _renderItems() {
    const c = App.el('inv-items-container');
    if (!c) return;
    c.innerHTML = _items.map((item, i) => `
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:6px;margin-bottom:6px;align-items:center">
        <input class="form-control" placeholder="Description" id="it-desc-${i}" value="${App.escHtml(item.description||'')}">
        <input class="form-control" type="number" placeholder="1" id="it-qty-${i}" value="${item.qty||1}" oninput="BillingModule._calcLine(${i})">
        <input class="form-control" type="number" placeholder="0" id="it-rate-${i}" value="${item.rate||''}" oninput="BillingModule._calcLine(${i})">
        <input class="form-control" type="number" id="it-amt-${i}" value="${item.amount||''}" readonly>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="BillingModule._removeItem(${i})">✕</button>
      </div>
    `).join('');
    _calcTotals();
  }

  function _emptyItem() { return { description:'', qty:1, rate:'', amount:'' }; }

  function _calcLine(i) {
    const qty  = parseFloat(App.el('it-qty-'+i)?.value)  || 0;
    const rate = parseFloat(App.el('it-rate-'+i)?.value) || 0;
    const amt  = qty * rate;
    const el   = App.el('it-amt-'+i);
    if (el) el.value = amt || '';
    _calcTotals();
  }

  function _calcTotals() {
    const subtotal = _items.reduce((s,_,i) => s + (parseFloat(App.el('it-amt-'+i)?.value)||0), 0);
    const disc     = parseFloat(App.el('inv-disc')?.value) || 0;
    const total    = Math.max(0, subtotal - disc);
    const paid     = parseFloat(App.el('inv-paid')?.value) || 0;
    const balance  = Math.max(0, total - paid);
    const el = App.el('inv-totals');
    if (el) el.innerHTML = `
      <div class="total-row">Subtotal: ₹${App.currencyFmt(subtotal)}</div>
      ${disc ? `<div class="total-row">Discount: -₹${App.currencyFmt(disc)}</div>` : ''}
      <div class="total-row grand">Total: ₹${App.currencyFmt(total)}</div>
      <div class="total-row">Paid: ₹${App.currencyFmt(paid)} | Balance: ₹${App.currencyFmt(balance)}</div>
    `;
  }

  function _syncItems() {
    _items.forEach((item, i) => {
      item.description = App.el('it-desc-'+i)?.value?.trim() || '';
      item.qty         = parseFloat(App.el('it-qty-'+i)?.value)  || 1;
      item.rate        = parseFloat(App.el('it-rate-'+i)?.value) || 0;
      item.amount      = parseFloat(App.el('it-amt-'+i)?.value)  || 0;
    });
  }

  function _addItem() {
    _syncItems();
    _items.push(_emptyItem());
    _renderItems();
  }

  function _removeItem(i) {
    _syncItems();
    _items.splice(i, 1);
    if (!_items.length) _items.push(_emptyItem());
    _renderItems();
  }

  function _quickAdd(desc, rate) {
    _syncItems();
    // Fill last empty item or add new
    const last = _items[_items.length - 1];
    if (!last.description) {
      last.description = desc; last.rate = rate; last.qty = 1; last.amount = rate;
    } else {
      _items.push({ description: desc, qty: 1, rate, amount: rate });
    }
    _renderItems();
  }

  async function save() {
    _syncItems();
    const pid  = App.el('inv-patient')?.value;
    const date = App.el('inv-date')?.value;
    if (!pid || !date) { App.toast('Patient and date required', 'warning'); return; }
    const items    = _items.filter(i => i.description);
    const subtotal = items.reduce((s,i) => s + i.amount, 0);
    const disc     = parseFloat(App.el('inv-disc')?.value) || 0;
    const total    = Math.max(0, subtotal - disc);
    const paid     = parseFloat(App.el('inv-paid')?.value) || 0;
    const data = {
      patient_id: pid, date, items,
      subtotal, discount: disc, tax: 0, total, paid,
      balance: Math.max(0, total - paid),
      payment_method: App.el('inv-method')?.value || 'Cash',
      status: App.el('inv-status')?.value || 'pending',
      notes: App.el('inv-notes')?.value?.trim() || null,
    };
    try {
      if (_editId) await DB.invoices.update(_editId, data);
      else         await DB.invoices.create(data);
      App.closeModal('modal-invoice');
      App.toast('Invoice saved');
      render();
    } catch (e) { App.toast(e.message, 'error'); }
  }

  async function deleteInv(id) {
    App.confirm('Delete this invoice?', async () => {
      await DB.invoices.delete(id);
      App.toast('Deleted');
      render();
    });
  }

  function _badge(s) {
    return { paid:'badge-green', pending:'badge-orange', partial:'badge-blue' }[s] || 'badge-gray';
  }

  return { init, render, openNew, openEdit, openView, print, save, delete: deleteInv, _addItem, _removeItem, _quickAdd, _calcLine, _calcTotals };
})();

window.BillingModule = BillingModule;
