// admin.js - Admin dashboard logic
// Works with the same localStorage key used by investor: "AlphaProfit_System_User"
// Includes void hooks for API integration: apiApproveDeposit, apiRejectDeposit, syncWithServer, sendAdminNotification

const STORAGE_KEY = 'AlphaProfit_System_User';

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(msg, type = 'info'){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show';
  if(type === 'success') t.style.borderLeftColor = '#00ff88';
  else if(type === 'error') t.style.borderLeftColor = '#ff4444';
  else t.style.borderLeftColor = '#00e0ff';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.className = 'toast', 3000);
}

/* ---------- Data load/save ---------- */
function loadData(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw){
    const initial = {
      user: { username: 'DemoInvestor' },
      walletBalance: 0,
      totalStaked: 0,
      pendingRewards: 0,
      deposits: [],
      withdrawals: [],
      history: [],
      referralCode: 'DEMOREF',
      referralBalance: 0,
      totalCommission: 0,
      totalReferrals: 0,
      activeReferrals: 0,
      referralDepositValue: 0,
      stats: { investors: 1, activePlans: 0, payouts: 0 }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  try { return JSON.parse(raw); } catch(e) { console.error('Invalid stored data', e); return null; }
}

function saveData(obj){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

/* ---------- Utility ---------- */
function money(n){ return `₱${(Number(n)||0).toLocaleString('en-PH',{minimumFractionDigits:2})}`; }

/* ---------- Render Overview ---------- */
function renderOverview(){
  const data = loadData();
  document.getElementById('statInvestors').textContent = (data.stats && data.stats.investors) ? data.stats.investors : 0;

  const approved = (data.deposits || []).filter(d => d.status === 'approved');
  const totalApproved = approved.reduce((s, x) => s + (Number(x.approvedAmount) || 0), 0);
  document.getElementById('statDeposits').textContent = money(totalApproved);

  document.getElementById('statStaked').textContent = money(data.totalStaked || 0);

  const pendingCount = (data.deposits || []).filter(d => d.status === 'pending').length;
  document.getElementById('statPending').textContent = pendingCount;
}

/* ---------- Render Pending Deposits ---------- */
function renderPending(){
  const data = loadData();
  const listEl = document.getElementById('pendingList');
  const filterText = document.getElementById('filterUser') ? document.getElementById('filterUser').value.trim().toLowerCase() : '';
  const fStatus = document.getElementById('filterStatus') ? document.getElementById('filterStatus').value : 'pending';

  let items = (data.deposits || []).slice().reverse();
  if(fStatus === 'pending') items = items.filter(i => i.status === 'pending');
  if(filterText) items = items.filter(i => (i.plan || '').toLowerCase().includes(filterText) || (i.note||'').toLowerCase().includes(filterText) || (i.id||'').toLowerCase().includes(filterText));

  if(!items.length){ listEl.innerHTML = `<div class="small-muted" style="padding:12px;color:#9aa;text-align:center">No pending deposits found.</div>`; return; }

  listEl.innerHTML = items.map(d => {
    const img = d.img ? `<img src="${d.img}" class="thumb" alt="receipt">` : `<div class="thumb"></div>`;
    const approvedInput = `<input id="approveAmt_${d.id}" type="number" placeholder="Approve amount (₱)" style="padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);background:#0f0f12;color:#fff;width:160px">`;
    return `<div class="list-row">
      <div class="left">
        ${img}
        <div>
          <div style="font-weight:700">${d.plan ? d.plan+' Deposit' : 'Deposit Receipt'} • ${d.status.toUpperCase()}</div>
          <div class="meta">${d.note || ''}</div>
          <div class="meta" style="margin-top:6px;color:#9aa">${d.date}</div>
        </div>
      </div>
      <div class="actions">
        ${approvedInput}
        <div style="display:flex;gap:8px;">
          <button class="approve" onclick="adminApproveDeposit('${d.id}')">Approve</button>
          <button class="reject" onclick="adminRejectDeposit('${d.id}')">Reject</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ---------- Approve / Reject deposit ---------- */
function adminApproveDeposit(depId){
  const data = loadData();
  const idx = (data.deposits||[]).findIndex(d => d.id === depId);
  if(idx === -1){ showToast('Deposit not found', 'error'); return; }

  const input = document.getElementById(`approveAmt_${depId}`);
  let amount = 0;
  if(input && input.value) amount = parseFloat(input.value) || 0;

  data.deposits[idx].status = 'approved';
  data.deposits[idx].approvedAmount = amount;
  data.deposits[idx].approvedAt = new Date().toLocaleString();

  // credit wallet (single-user model used in demo)
  data.walletBalance = (Number(data.walletBalance) || 0) + amount;

  // log
  data.history = data.history || [];
  data.history.push({ id: 'log_' + Date.now(), action: 'approve_deposit', depositId: depId, amount, date: new Date().toISOString(), note: data.deposits[idx].note || '' });

  saveData(data);
  renderPending();
  renderApproved();
  renderOverview();
  showToast(`Approved deposit and credited ${money(amount)}`, 'success');

  // void hooks
  apiApproveDeposit(depId, amount);
  sendAdminNotification(`Deposit approved: ${depId}`, `Amount: ${money(amount)}`);
}

function adminRejectDeposit(depId){
  const data = loadData();
  const idx = (data.deposits||[]).findIndex(d => d.id === depId);
  if(idx === -1){ showToast('Deposit not found', 'error'); return; }

  data.deposits[idx].status = 'rejected';
  data.deposits[idx].rejectedAt = new Date().toLocaleString();
  data.history = data.history || [];
  data.history.push({ id: 'log_' + Date.now(), action: 'reject_deposit', depositId: depId, date: new Date().toISOString() });

  saveData(data);
  renderPending();
  renderOverview();
  showToast('Deposit rejected', 'error');

  apiRejectDeposit(depId);
  sendAdminNotification(`Deposit rejected: ${depId}`, `Note: ${data.deposits[idx].note || '—'}`);
}

/* ---------- Approved list ---------- */
function renderApproved(){
  const data = loadData();
  const approved = (data.deposits||[]).filter(d => d.status === 'approved').slice().reverse();
  const el = document.getElementById('approvedList');
  if(!approved.length){ el.innerHTML = `<div class="small-muted" style="padding:12px;color:#9aa;text-align:center">No approved deposits.</div>`; return; }

  el.innerHTML = approved.map(d => {
    return `<div class="list-row">
      <div class="left">
        ${d.img ? `<img src="${d.img}" class="thumb">` : `<div class="thumb"></div>`}
        <div>
          <div style="font-weight:700">${d.plan || 'General'} • APPROVED</div>
          <div class="meta">Approved amount: ${money(d.approvedAmount || 0)}</div>
          <div class="meta" style="margin-top:6px;color:#9aa">${d.approvedAt || d.date}</div>
        </div>
      </div>
      <div style="text-align:right"><div class="meta">${d.note || ''}</div></div>
    </div>`;
  }).join('');
}

/* ---------- Withdrawals Admin ---------- */
function renderWithdrawalsAdmin(){
  const data = loadData();
  const el = document.getElementById('withdrawList');
  const filterText = (document.getElementById('filterWithdraw') || { value: '' }).value.trim().toLowerCase();
  const statusFilter = (document.getElementById('filterWithdrawStatus') || { value: 'pending' }).value;

  let items = (data.withdrawals || []).slice().reverse();
  if(statusFilter === 'pending') items = items.filter(w => w.status === 'pending');
  if(filterText) items = items.filter(w => (w.method||'').toLowerCase().includes(filterText) || (w.account||'').toLowerCase().includes(filterText) || String(w.amount||'').includes(filterText));

  if(!items.length){ el.innerHTML = `<div class="small-muted" style="padding:12px;color:#9aa;text-align:center">No withdrawal requests.</div>`; return; }

  el.innerHTML = items.map(w => {
    return `<div class="list-row">
      <div class="left">
        <i class="fas fa-money-check-alt" style="font-size:22px;color:#00e0ff"></i>
        <div style="margin-left:8px">
          <div style="font-weight:700">${money(w.amount)} • ${w.method}</div>
          <div class="meta">${w.account}</div>
          <div class="meta" style="margin-top:6px;color:#9aa">${w.date}</div>
        </div>
      </div>
      <div class="actions">
        <button class="process" onclick="adminApproveWithdrawal('${w.id}')">Mark Processed</button>
        <button class="reject" onclick="adminRejectWithdrawal('${w.id}')">Reject & Refund</button>
      </div>
    </div>`;
  }).join('');
}

function adminApproveWithdrawal(wid){
  const data = loadData();
  const idx = (data.withdrawals||[]).findIndex(w => w.id === wid);
  if(idx === -1){ showToast('Withdrawal not found', 'error'); return; }

  data.withdrawals[idx].status = 'approved';
  data.withdrawals[idx].approvedAt = new Date().toLocaleString();
  data.history = data.history || [];
  data.history.push({ id: 'log_' + Date.now(), action: 'approve_withdrawal', withdrawalId: wid, amount: data.withdrawals[idx].amount, date: new Date().toISOString() });

  saveData(data);
  renderWithdrawalsAdmin();
  renderOverview();
  showToast('Withdrawal marked as processed', 'success');

  apiApproveWithdrawal(wid);
  sendAdminNotification(`Withdrawal processed: ${wid}`, `Amount: ${money(data.withdrawals[idx].amount)}`);
}

function adminRejectWithdrawal(wid){
  const data = loadData();
  const idx = (data.withdrawals||[]).findIndex(w => w.id === wid);
  if(idx === -1){ showToast('Withdrawal not found', 'error'); return; }
  const w = data.withdrawals[idx];
  w.status = 'rejected';
  w.rejectedAt = new Date().toLocaleString();

  // refund to wallet
  const refund = Number(w.amount) || 0;
  data.walletBalance = (Number(data.walletBalance) || 0) + refund;

  data.history = data.history || [];
  data.history.push({ id: 'log_' + Date.now(), action: 'reject_withdrawal', withdrawalId: wid, amount: refund, date: new Date().toISOString() });

  saveData(data);
  renderWithdrawalsAdmin();
  renderOverview();
  showToast(`Withdrawal rejected and refunded ${money(refund)}`, 'success');

  apiRejectWithdrawal(wid);
  sendAdminNotification(`Withdrawal rejected: ${wid}`, `Refunded: ${money(refund)}`);
}

/* ---------- Activity logs ---------- */
function renderActivityLog(){
  const data = loadData();
  const el = document.getElementById('activityLog');
  if(!data.history || !data.history.length){ el.innerHTML = `<div class="small-muted" style="padding:12px;color:#9aa;text-align:center">No activity logs yet.</div>`; return; }
  el.innerHTML = data.history.slice().reverse().map(h => {
    return `<div class="list-row"><div style="font-weight:700">${(h.action||'action').replace(/_/g,' ')}</div><div style="text-align:right;color:#9aa">${new Date(h.date).toLocaleString()}</div></div>`;
  }).join('');
}
function clearLogs(){
  if(!confirm('Clear activity logs?')) return;
  const data = loadData();
  data.history = [];
  saveData(data);
  renderActivityLog();
  showToast('Activity logs cleared', 'success');
}

/* ---------- Approve / Reject All (void) ---------- */
function approveAllPending(){
  // void: marks pending as approved (approvedAmount=0). For real workflow, admin should set amounts per deposit.
  if(!confirm('Mark all pending deposits as approved (amount 0)?')) return;
  const data = loadData();
  (data.deposits || []).forEach(d => { if(d.status === 'pending'){ d.status = 'approved'; d.approvedAmount = 0; d.approvedAt = new Date().toLocaleString(); data.history.push({ id:'log_'+Date.now(), action:'auto_approve', depositId:d.id, date:new Date().toISOString() }); }});
  saveData(data);
  renderPending(); renderApproved(); renderOverview();
  showToast('All pending deposits marked approved (amount 0). Use individual approve to credit amounts.', 'success');
}
function rejectAllPending(){
  if(!confirm('Reject all pending deposits?')) return;
  const data = loadData();
  (data.deposits||[]).forEach(d => { if(d.status === 'pending') d.status = 'rejected'; });
  saveData(data);
  renderPending(); renderOverview();
  showToast('All pending deposits rejected', 'error');
}

/* ---------- Manual Credit Modal ---------- */
function openManualCreditModal(){
  document.getElementById('manualUser').value = '';
  document.getElementById('manualAmount').value = '';
  document.getElementById('manualNote').value = '';
  document.getElementById('manualCreditModal').classList.add('show');
}
function closeManualCreditModal(){ document.getElementById('manualCreditModal').classList.remove('show'); }

function submitManualCredit(){
  const user = document.getElementById('manualUser').value.trim();
  const amount = parseFloat(document.getElementById('manualAmount').value);
  const note = document.getElementById('manualNote').value.trim();

  if(!user){ showToast('Enter username (or session key)', 'error'); return; }
  if(!amount || amount <= 0){ showToast('Enter valid amount', 'error'); return; }

  // In this single-user demo model, we ignore username and credit the global walletBalance.
  const data = loadData();
  data.walletBalance = (Number(data.walletBalance) || 0) + amount;
  data.history = data.history || [];
  data.history.push({ id: 'log_' + Date.now(), action: 'manual_credit', amount, user, note, date: new Date().toISOString() });
  saveData(data);
  renderOverview();
  showToast(`Credited ${money(amount)} to ${user} (demo)`, 'success');

  // void hook
  sendAdminNotification('Manual credit', `Credited ${money(amount)} to ${user}. Note: ${note}`);
  closeManualCreditModal();
}

/* ---------- Import JSON Modal ---------- */
function openImportModal(){ document.getElementById('importModal').classList.add('show'); }
function closeImportModal(){ document.getElementById('importModal').classList.remove('show'); }

function importJsonData(){
  const raw = document.getElementById('importJson').value.trim();
  if(!raw) return showToast('Paste JSON first', 'error');
  try {
    const parsed = JSON.parse(raw);
    // basic validation
    if(!parsed) throw new Error('Invalid JSON');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    showToast('Imported JSON into localStorage (void)', 'success');
    document.getElementById('importJson').value = '';
    closeImportModal();
    boot(); // reload UI
  } catch(e){
    console.error(e);
    showToast('Invalid JSON', 'error');
  }
}

/* ---------- Export logs CSV ---------- */
function exportActivityCSV(){
  const data = loadData();
  const rows = (data.history || []).map(h => ({ date: h.date || '', action: h.action || '', details: JSON.stringify(h) }));
  if(!rows.length) return showToast('No logs to export', 'error');
  const csv = ['Date,Action,Details', ...rows.map(r => `"${r.date}","${r.action}","${(r.details||'').replace(/"/g,'""')}"`)].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `alphaprofit_activity_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Activity exported as CSV', 'success');
}

/* ---------- Search ---------- */
function globalSearch(){
  const q = document.getElementById('globalSearch').value.trim().toLowerCase();
  if(!q) return showToast('Enter search term', 'error');
  const data = loadData();
  const deposits = (data.deposits||[]).filter(d => (d.plan||'').toLowerCase().includes(q) || (d.note||'').toLowerCase().includes(q) || (d.id||'').toLowerCase().includes(q));
  const withdrawals = (data.withdrawals||[]).filter(w => (w.method||'').toLowerCase().includes(q) || (w.account||'').toLowerCase().includes(q) || String(w.amount||'').includes(q));
  const combined = [];
  deposits.forEach(d => combined.push({ type:'deposit', obj:d }));
  withdrawals.forEach(w => combined.push({ type:'withdraw', obj:w }));
  if(!combined.length) return showToast('No results found', 'info');

  openTab('logs');
  const el = document.getElementById('activityLog');
  el.innerHTML = combined.map(c => {
    if(c.type === 'deposit') return `<div class="list-row"><div style="font-weight:700">Deposit • ${c.obj.plan||'General'}</div><div style="color:#9aa">${c.obj.date}</div></div>`;
    else return `<div class="list-row"><div style="font-weight:700">Withdrawal • ${money(c.obj.amount)}</div><div style="color:#9aa">${c.obj.date}</div></div>`;
  }).join('');
}

/* ---------- Void API hooks (placeholders) ---------- */
function apiApproveDeposit(depId, amount){ console.log(`[void] apiApproveDeposit(${depId}, ${amount})`); /* implement real API call here */ }
function apiRejectDeposit(depId){ console.log(`[void] apiRejectDeposit(${depId})`); }
function apiApproveWithdrawal(wid){ console.log(`[void] apiApproveWithdrawal(${wid})`); }
function apiRejectWithdrawal(wid){ console.log(`[void] apiRejectWithdrawal(${wid})`); }
function syncWithServer(){ console.log('[void] syncWithServer called'); showToast('Sync (void) — no server configured', 'info'); }

/* ---------- Notifications (void) ---------- */
function sendAdminNotification(title, message){ console.log(`[void notification] ${title}: ${message}`); }

/* ---------- Tab handling ---------- */
function openTab(tabKey){
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.getElementById(tabKey).classList.add('active');
  document.querySelectorAll('.tab').forEach(t => { if(t.dataset.tab === tabKey) t.classList.add('active'); });
  // refresh content when opening
  if(tabKey === 'overview') renderOverview();
  if(tabKey === 'pending') renderPending();
  if(tabKey === 'withdrawals') renderWithdrawalsAdmin();
  if(tabKey === 'approved') renderApproved();
  if(tabKey === 'logs') renderActivityLog();
}

/* ---------- Admin logout ---------- */
function adminLogout(){ if(confirm('Log out admin console?')) window.location.href = 'index.html'; }

/* ---------- Boot ---------- */
function boot(){
  renderOverview();
  renderPending();
  renderWithdrawalsAdmin();
  renderApproved();
  renderActivityLog();
}
boot();
