// script.js - Investor dashboard logic (no admin included)
// Put this file next to dashboard.html and style.css

/* ---------- Storage Key ---------- */
const STORAGE_KEY = 'AlphaProfit_System_User';

/* ---------- Default Data ---------- */
const defaults = {
  user: {
    username: localStorage.getItem('AlphaProfitUser_session') || localStorage.getItem('AlphaProfit_username') || null
  },
  walletBalance: 0,
  totalStaked: 0,
  pendingRewards: 0,
  deposits: [],     // {id, img, plan, note, status:'pending'|'approved'|'rejected', date, approvedAmount}
  withdrawals: [],  // {id, amount, method, account, status, date}
  history: [],
  referralCode: localStorage.getItem('AlphaProfit_refcode') || Math.random().toString(36).substring(2,9).toUpperCase(),
  referralBalance: 0,
  totalCommission: 0,
  totalReferrals: 0,
  activeReferrals: 0,
  referralDepositValue: 0,
  stats: { investors: 1, activePlans: 0, payouts: 0 }
};

/* ---------- Load or init ---------- */
let data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaults;
if(!data.user.username){
  // fallback to ask user (if login didn't set it)
  const u = prompt('Enter your name for the dashboard (demo)') || 'Trader';
  data.user.username = u;
  localStorage.setItem('AlphaProfit_username', u);
  save();
}
document.getElementById('welcomeTitle').textContent = `Welcome Alpha Trader, ${data.user.username}!`;

/* ---------- Helpers ---------- */
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function money(n){ return `₱${(Number(n)||0).toLocaleString('en-PH',{minimumFractionDigits:2})}`; }

let toastTimer = null;
function showToast(msg, type='info'){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show';
  if(type === 'success') t.style.borderLeftColor = '#00ff88';
  else if(type === 'error') t.style.borderLeftColor = '#ff4444';
  else t.style.borderLeftColor = '#00e0ff';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.className = 'toast', 3000);
}

/* ---------- Tabs ---------- */
function openTab(key){
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  switch(key){
    case 'dashboard':
      document.getElementById('dashboard').classList.add('active');
      document.getElementById('tabDashboard').classList.add('active');
      initChart();
      break;
    case 'deposit':
      document.getElementById('deposit').classList.add('active');
      document.getElementById('tabDeposit').classList.add('active');
      break;
    case 'plans':
      document.getElementById('plans').classList.add('active');
      document.getElementById('tabPlans').classList.add('active');
      break;
    case 'withdraw':
      document.getElementById('withdraw').classList.add('active');
      document.getElementById('tabWithdraw').classList.add('active');
      break;
    case 'referral':
      document.getElementById('referral').classList.add('active');
      document.getElementById('tabReferral').classList.add('active');
      break;
    case 'faq':
      document.getElementById('faq').classList.add('active');
      document.getElementById('tabFAQ').classList.add('active');
      break;
  }
}

/* ---------- Render ---------- */
function renderAll(){
  // Stats
  document.getElementById('statWallet').textContent = money(data.walletBalance);
  document.getElementById('statStaked').textContent = money(data.totalStaked);
  document.getElementById('statRewards').textContent = money(data.pendingRewards);

  // Wallet overview
  document.getElementById('walletBalance').textContent = money(data.walletBalance);
  document.getElementById('walletMeta').textContent = data.walletBalance > 0 ? 'Ready for staking or withdrawal' : 'No approved wallet balance yet';

  // Pending deposits list (dashboard)
  const pendingEl = document.getElementById('pendingDepositsList');
  if(!data.deposits.length) pendingEl.innerHTML = `<div class="small-muted" style="padding:12px;text-align:center;color:#9aa">No pending receipts.</div>`;
  else {
    pendingEl.innerHTML = data.deposits.slice().reverse().map(d => {
      const thumb = d.img ? `<img src="${d.img}" class="receipt-thumb" alt="receipt">` : `<div class="receipt-thumb"></div>`;
      return `<div class="list-item">
                <div class="list-left">${thumb}<div><div style="font-weight:700">${d.plan ? d.plan+' Deposit' : 'Deposit Receipt'}</div><div style="color:#bfcbd9;font-size:.9rem">${d.note||''}</div></div></div>
                <div style="text-align:right">
                  <div class="status ${d.status}">${d.status.toUpperCase()}</div>
                  <div style="font-size:.85rem;color:#9aa;margin-top:6px">${d.date}</div>
                  ${d.status === 'approved' && d.approvedAmount ? `<div style="margin-top:6px;color:#9f9">Approved: ${money(d.approvedAmount)}</div>` : ''}
                </div>
              </div>`;
    }).join('');
  }

  // My deposit submissions on deposit tab
  const myDeposits = document.getElementById('myDepositsList');
  if(!data.deposits.length) myDeposits.innerHTML = `<div class="small-muted" style="padding:12px;text-align:center;color:#9aa">You have not uploaded any receipts yet.</div>`;
  else myDeposits.innerHTML = data.deposits.slice().reverse().map(d => {
    return `<div class="list-item"><div><div style="font-weight:700">${d.plan||'General'} • ${d.status.toUpperCase()}</div><div style="color:#bfcbd9">${d.note||''}</div></div><div style="text-align:right;color:#9aa">${d.date}</div></div>`;
  }).join('');

  // referral
  document.getElementById('referralBalance').textContent = money(data.referralBalance);
  document.getElementById('totalCommission').textContent = money(data.totalCommission);
  document.getElementById('referralInput').value = `https://alphaprofit.io/signup?ref=${data.referralCode}`;
  document.getElementById('referralInput2').value = `https://alphaprofit.io/signup?ref=${data.referralCode}`;
  document.getElementById('referralMain').textContent = money(data.referralBalance);
  document.getElementById('rTotal').textContent = data.totalReferrals;
  document.getElementById('rActive').textContent = data.activeReferrals;
  document.getElementById('rTotal2').textContent = data.totalReferrals;
  document.getElementById('rActive2').textContent = data.activeReferrals;
  document.getElementById('rValue2').textContent = money(data.referralDepositValue);

  // withdrawals
  renderWithdrawals();

  // Show proceed / activate buttons if walletBalance > 0
  updateActivateButtons();

  // save
  save();
}

/* ---------- Chart ---------- */
let walletChart = null;
function initChart(){
  const ctx = document.getElementById('walletChart');
  if(!ctx) return;
  // ensure today's snapshot exists
  const today = new Date().toLocaleDateString();
  const last = data.history.length ? data.history[data.history.length-1] : null;
  if(!last || last.date !== today) data.history.push({ date: today, balance: data.walletBalance });
  else last.balance = data.walletBalance;

  const labels = data.history.map(h => h.date);
  const points = data.history.map(h => h.balance);

  if(walletChart) walletChart.destroy();
  walletChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Wallet Balance',
        data: points,
        borderColor: '#00e0ff',
        backgroundColor: 'rgba(0,224,255,0.12)',
        tension: 0.28,
        fill: true,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255,255,255,0.02)' } },
        y: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255,255,255,0.02)' } }
      }
    }
  });
}

/* ---------- Deposit form handlers ---------- */
const depositFileInput = document.getElementById('depositFileInput');
const depositPreview = document.getElementById('depositPreview');

depositFileInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = ev => {
    depositPreview.src = ev.target.result;
    depositPreview.style.display = 'block';
  };
  r.readAsDataURL(f);
});

function clearDepositForm(){
  depositFileInput.value = '';
  depositPreview.src = '';
  depositPreview.style.display = 'none';
  document.getElementById('depositNoteInput').value = '';
  document.getElementById('depositPlan').value = '';
}

function submitDepositForm(){
  const f = depositFileInput.files[0];
  const plan = document.getElementById('depositPlan').value || null;
  const note = document.getElementById('depositNoteInput').value.trim() || '';
  if(!f){ showToast('Please select a receipt image to upload', 'error'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    const dep = {
      id: 'dep_' + Date.now(),
      img: ev.target.result,
      plan,
      note,
      status: 'pending',
      date: new Date().toLocaleString(),
      approvedAmount: 0
    };
    data.deposits.push(dep);
    data.history.push({ type: 'Deposit Uploaded', date: dep.date, status: 'pending' });
    save();
    renderAll();
    clearDepositForm();
    showToast('Receipt uploaded — awaiting admin verification', 'success');
    openTab('dashboard');
  };
  reader.readAsDataURL(f);
}

/* Modal version (plan-aware) */
const depositModal = document.getElementById('depositModal');
const depositModalFile = document.getElementById('depositModalFile');
const depositModalPreview = document.getElementById('depositModalPreview');
const depositModalNote = document.getElementById('depositModalNote');
const depositModalPlanText = document.getElementById('depositModalPlan');
let depositModalPlanSelected = null;

function openDepositModal(plan=null){
  depositModalPlanSelected = plan;
  document.getElementById('depositModalTitle').textContent = plan ? `Upload Receipt for ${plan}` : 'Upload Deposit Receipt';
  depositModalPlanText.textContent = plan ? `Plan: ${plan}` : 'Plan: General deposit';
  depositModalFile.value = '';
  depositModalPreview.style.display = 'none';
  depositModalNote.value = '';
  depositModal.classList.add('show');
}

function closeDepositModal(){
  depositModal.classList.remove('show');
  depositModalFile.value = '';
  depositModalPreview.src = '';
}

/* preview */
depositModalFile.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = ev => { depositModalPreview.src = ev.target.result; depositModalPreview.style.display = 'block'; };
  r.readAsDataURL(f);
});

function submitDepositModal(){
  const f = depositModalFile.files[0];
  const note = depositModalNote.value.trim() || '';
  if(!f){ showToast('Please upload a receipt image', 'error'); return; }
  const r = new FileReader();
  r.onload = ev => {
    const dep = {
      id: 'dep_' + Date.now(),
      img: ev.target.result,
      plan: depositModalPlanSelected,
      note,
      status: 'pending',
      date: new Date().toLocaleString(),
      approvedAmount: 0
    };
    data.deposits.push(dep);
    data.history.push({ type: 'Deposit Uploaded', date: dep.date, status: 'pending' });
    save(); renderAll(); closeDepositModal(); showToast('Receipt uploaded — awaiting admin verification', 'success'); openTab('dashboard');
  };
  r.readAsDataURL(f);
}

/* ---------- Activate plan (gated by wallet credit) ---------- */
function activatePlanFlow(planName){
  if(data.walletBalance <= 0){
    showToast('Please upload receipt and wait for admin verification/credit before activating a plan.', 'error');
    openTab('deposit');
    return;
  }
  const plans = { Basic:{min:2500,max:50000}, Premium:{min:10000,max:50000}, VIP:{min:50000,max:250000} };
  const plan = plans[planName];
  const input = prompt(`Activate ${planName}\nEntry: ${money(plan.min)} - ${money(plan.max)}\nWallet: ${money(data.walletBalance)}\nEnter amount to stake:`);
  if(input === null) return;
  let amount = parseFloat(String(input).replace(/,/g,'').trim());
  amount = Math.round(amount * 100) / 100;
  if(isNaN(amount) || amount <= 0){ showToast('Invalid amount', 'error'); return; }
  if(amount < plan.min || amount > plan.max){ showToast(`Amount must be between ${money(plan.min)} and ${money(plan.max)}`, 'error'); return; }
  if(amount > data.walletBalance){ showToast('Insufficient wallet balance. Please wait for admin credit.', 'error'); return; }

  data.walletBalance -= amount;
  data.totalStaked += amount;
  data.history.push({ type: `Staked (${planName})`, amount, date: new Date().toLocaleString() });
  data.stats.activePlans = (data.stats.activePlans || 0) + 1;
  save(); renderAll(); showToast(`Staked ${money(amount)} in ${planName} plan`, 'success'); openTab('dashboard');
}

/* ---------- Withdraw ---------- */
function updateAccountPlaceholder(){
  const method = document.getElementById('withdrawMethod').value;
  const acc = document.getElementById('withdrawAccount');
  if(method === 'GCash') acc.placeholder = 'GCash number (0917xxxxxxx)';
  else if(method === 'Bank Transfer') acc.placeholder = 'Bank account number (Bank - Acc#)';
  else if(method === 'USDT (Binance)') acc.placeholder = 'Binance USDT address';
  else if(method === 'BTC Wallet') acc.placeholder = 'Bitcoin wallet address';
  else acc.placeholder = 'Account / wallet';
}

function submitWithdrawal(){
  const method = document.getElementById('withdrawMethod').value;
  const account = document.getElementById('withdrawAccount').value.trim();
  const amount = parseFloat(document.getElementById('withdrawAmount').value);
  if(!method) return showToast('Select withdrawal method', 'error');
  if(!account) return showToast('Enter account or wallet', 'error');
  if(!amount || amount <= 0) return showToast('Enter valid amount', 'error');
  const available = data.walletBalance + data.referralBalance;
  if(amount > available) return showToast(`Not enough balance. Available: ${money(available)}`, 'error');

  let walletDeduct = 0, referralDeduct = 0;
  if(amount <= data.walletBalance) walletDeduct = amount;
  else { walletDeduct = data.walletBalance; referralDeduct = amount - walletDeduct; }

  data.walletBalance -= walletDeduct;
  data.referralBalance -= referralDeduct;

  const w = { id: 'w_' + Date.now(), amount, method, account, status: 'pending', date: new Date().toLocaleString() };
  data.withdrawals.push(w);
  data.history.push({ type: 'Withdrawal Request', amount, date: w.date, status: 'pending' });
  save(); renderAll(); showToast('Withdrawal requested — awaiting admin approval', 'success');

  document.getElementById('withdrawMethod').value = '';
  document.getElementById('withdrawAccount').value = '';
  document.getElementById('withdrawAmount').value = '';
}

function renderWithdrawals(){
  const el = document.getElementById('withdrawalList');
  if(!data.withdrawals.length){ el.innerHTML = `<div class="small-muted" style="padding:12px;text-align:center;color:#9aa">No withdrawal history yet.</div>`; return; }
  el.innerHTML = data.withdrawals.slice().reverse().map(w => {
    return `<div class="list-item"><div style="display:flex;gap:10px;align-items:center;"><i class="fas fa-money-check-alt" style="color:#00e0ff"></i><div><div style="font-weight:700">${money(w.amount)} • ${w.method}</div><div style="color:#bfcbd9">${w.account}</div></div></div><div style="text-align:right"><div class="status ${w.status}">${w.status.toUpperCase()}</div><div style="font-size:.85rem;color:#9aa;margin-top:6px">${w.date}</div></div></div>`;
  }).join('');
}

/* ---------- Referral helpers ---------- */
function copyReferral(){ navigator.clipboard.writeText(document.getElementById('referralInput').value).then(()=> showToast('Referral link copied!','success')); }
function copyReferralLink2(){ copyReferral(); }

/* ---------- Activate / Proceed button visibility ---------- */
function updateActivateButtons(){
  const goBtn = document.getElementById('btnGoToPlans');
  const actBtn = document.getElementById('btnActivateInvestment');
  if(data.walletBalance > 0){
    goBtn.style.display = 'inline-block';
    actBtn.style.display = 'inline-block';
    actBtn.style.boxShadow = '0 0 20px rgba(0,255,136,0.25)';
  } else {
    goBtn.style.display = 'none';
    actBtn.style.display = 'none';
    actBtn.style.boxShadow = 'none';
  }
}

/* ---------- FAQ ---------- */
function toggleFAQ(el){ el.classList.toggle('open'); }

/* ---------- Quick file input (dashboard top) ---------- */
document.getElementById('quickFileInput').addEventListener('change', function(e){
  const f = e.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = ev => {
    const dep = { id:'dep_'+Date.now(), img:ev.target.result, plan:null, note:'', status:'pending', date:new Date().toLocaleString(), approvedAmount:0 };
    data.deposits.push(dep); save(); renderAll(); showToast('Receipt uploaded — awaiting admin verification','success');
  };
  r.readAsDataURL(f);
});

/* deposit modal outside click close */
document.getElementById('depositModal').addEventListener('click', (e) => {
  if(e.target === document.getElementById('depositModal')) closeDepositModal();
});

/* ---------- Logout ---------- */
function logout(){
  // clear session key used by index.html (keeps data)
  localStorage.removeItem('AlphaProfitUser_session');
  // go back to login
  window.location.href = 'index.html';
}

/* ---------- Initialization ---------- */
document.addEventListener('DOMContentLoaded', () => {
  renderAll();
  initChart();
});
