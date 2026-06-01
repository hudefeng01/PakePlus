const STORAGE_KEY = 'phoebe-ledger-v2';

const categories = {
  expense: [
    { id: 'food', name: '餐饮', icon: '🍜', color: '#ff6b6b' },
    { id: 'shopping', name: '购物', icon: '🛍️', color: '#8b5cf6' },
    { id: 'transport', name: '交通', icon: '🚇', color: '#4f7cff' },
    { id: 'fun', name: '娱乐', icon: '🎮', color: '#ff9f43' },
    { id: 'medical', name: '医旅', icon: '💊', color: '#14b8a6' },
    { id: 'home', name: '居家', icon: '🏠', color: '#64748b' },
    { id: 'study', name: '学习', icon: '📚', color: '#06b6d4' },
    { id: 'other', name: '其他', icon: '✨', color: '#94a3b8' },
  ],
  income: [
    { id: 'salary', name: '工资', icon: '💰', color: '#18b978' },
    { id: 'bonus', name: '奖金', icon: '🎁', color: '#22c55e' },
    { id: 'parttime', name: '兼职', icon: '💻', color: '#0ea5e9' },
    { id: 'refund', name: '退款', icon: '↩️', color: '#84cc16' },
  ],
};

const accountMeta = {
  wechat: { name: '微信支付', icon: '💚', gradient: 'linear-gradient(135deg, #20c76f, #11a85a)' },
  alipay: { name: '支付宝', icon: '💙', gradient: 'linear-gradient(135deg, #1677ff, #5a7cff)' },
  bank: { name: '银行卡', icon: '💳', gradient: 'linear-gradient(135deg, #172033, #5b6478)' },
  cash: { name: '现金', icon: '👛', gradient: 'linear-gradient(135deg, #ff9f43, #ef5261)' },
};

let state;
let activePage = 'detail';
let entryType = 'expense';
let selectedCategory = 'food';
let trendChart;
let donutChart;
let bubbleTimer;

const petLines = [
  '愿光芒庇护你的钱包~',
  '今天有认真记账吗，开拓者？',
  '理性消费，菲比会为你骄傲的~',
  '又攒下一点啦，真厉害！',
  '钱要花在让自己开心的地方哦~',
  '记好账，才能走得更远呀~',
  '菲比正在帮你看着钱包呢！',
];

const $ = (id) => document.getElementById(id);
const yuan = (n) => `¥${Number(n || 0).toFixed(2)}`;
const signedYuan = (bill) => `${bill.type === 'income' ? '+' : '-'}${yuan(bill.amount)}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthKey = (date = new Date()) => date.toISOString().slice(0, 7);
const categoryOf = (bill) => [...categories.expense, ...categories.income].find(c => c.id === bill.category) || categories.expense.at(-1);

function relativeDate(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function makeDemoState() {
  return {
    budget: 5200,
    accounts: [
      { id: 'wechat', balance: 2380.5 },
      { id: 'alipay', balance: 3920.2 },
      { id: 'bank', balance: 18500 },
      { id: 'cash', balance: 620 },
    ],
    bills: [
      { id: crypto.randomUUID(), type: 'expense', category: 'food', amount: 32, date: relativeDate(0), accountId: 'wechat', note: '公司楼下牛肉面' },
      { id: crypto.randomUUID(), type: 'expense', category: 'transport', amount: 16, date: relativeDate(0), accountId: 'alipay', note: '地铁通勤' },
      { id: crypto.randomUUID(), type: 'income', category: 'salary', amount: 8800, date: relativeDate(-1), accountId: 'bank', note: '六月工资' },
      { id: crypto.randomUUID(), type: 'expense', category: 'shopping', amount: 268.9, date: relativeDate(-1), accountId: 'alipay', note: '生活用品补货' },
      { id: crypto.randomUUID(), type: 'expense', category: 'fun', amount: 88, date: relativeDate(-2), accountId: 'wechat', note: '电影和奶茶' },
      { id: crypto.randomUUID(), type: 'expense', category: 'food', amount: 46.5, date: relativeDate(-3), accountId: 'cash', note: '周末早午餐' },
      { id: crypto.randomUUID(), type: 'expense', category: 'medical', amount: 129, date: relativeDate(-4), accountId: 'alipay', note: '感冒药' },
      { id: crypto.randomUUID(), type: 'expense', category: 'home', amount: 310, date: relativeDate(-6), accountId: 'wechat', note: '水电燃气' },
      { id: crypto.randomUUID(), type: 'income', category: 'parttime', amount: 1200, date: relativeDate(-8), accountId: 'alipay', note: '设计稿尾款' },
      { id: crypto.randomUUID(), type: 'expense', category: 'study', amount: 199, date: relativeDate(-10), accountId: 'bank', note: '前端课程' },
    ],
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state = makeDemoState();
    saveState();
    return;
  }
  try {
    state = JSON.parse(raw);
  } catch {
    state = makeDemoState();
    saveState();
  }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function currentMonthBills() { return state.bills.filter(b => b.date.startsWith(monthKey())); }
function sumBills(bills, type) { return bills.filter(b => b.type === type).reduce((s, b) => s + Number(b.amount), 0); }

function switchPage(page) {
  activePage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.dataset.page === page));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.target === page));
  if (page === 'stats') setTimeout(renderCharts, 40);
}

function renderAll() {
  renderOverview();
  renderTimeline();
  renderAssets();
  renderBudget();
  renderAccountOptions();
  if (activePage === 'stats') renderCharts();
}

function renderOverview() {
  const bills = currentMonthBills();
  const income = sumBills(bills, 'income');
  const expense = sumBills(bills, 'expense');
  $('currentMonthText').textContent = `${new Date().getMonth() + 1}月`;
  $('monthExpense').textContent = yuan(expense);
  $('monthIncome').textContent = yuan(income);
  $('remainingBudget').textContent = yuan(Math.max(state.budget - expense, 0));
  $('billCount').textContent = `${state.bills.length} 笔`;
}

function dateLabel(date) {
  const d = new Date(`${date}T00:00:00`);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((d - start) / 86400000);
  if (diff === 0) return '今天';
  if (diff === -1) return '昨天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function renderTimeline() {
  const sorted = [...state.bills].sort((a, b) => b.date.localeCompare(a.date));
  const groups = sorted.reduce((map, bill) => {
    (map[bill.date] ||= []).push(bill);
    return map;
  }, {});
  $('timeline').innerHTML = Object.entries(groups).map(([date, bills]) => {
    const expense = sumBills(bills, 'expense');
    const income = sumBills(bills, 'income');
    return `<section class="day-block">
      <div class="day-head"><b>${dateLabel(date)}</b><span>支出 ${yuan(expense)} · 收入 ${yuan(income)}</span></div>
      ${bills.map(bill => {
        const cat = categoryOf(bill);
        return `<article class="bill-row">
          <div class="cat-icon" style="background:${cat.color}18">${cat.icon}</div>
          <div class="bill-main"><div class="bill-title">${cat.name}</div><div class="bill-note">${bill.note || accountMeta[bill.accountId]?.name || '无备注'}</div></div>
          <div class="bill-amount ${bill.type}">${signedYuan(bill)}</div>
        </article>`;
      }).join('')}
    </section>`;
  }).join('') || '<div class="empty">还没有账单，点击右下角 + 记一笔。</div>';
}

function renderCharts() {
  renderTrendChart();
  renderDonutChart();
  renderRanking();
}

function renderTrendChart() {
  const el = $('trendChart');
  trendChart ||= echarts.init(el, null, { renderer: 'svg' });
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 13 + i);
    return d.toISOString().slice(0, 10);
  });
  const values = days.map(day => sumBills(state.bills.filter(b => b.type === 'expense' && b.date === day), 'expense'));
  trendChart.setOption({
    grid: { left: 8, right: 8, top: 24, bottom: 28, containLabel: true },
    tooltip: { trigger: 'axis', formatter: (p) => `${p[0].axisValue}<br/>消费：${yuan(p[0].value)}` },
    xAxis: { type: 'category', boundaryGap: false, data: days.map(d => d.slice(5).replace('-', '/')), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#8991a4' } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#edf0f6' } }, axisLabel: { color: '#8991a4' } },
    series: [{
      data: values, type: 'line', smooth: true, symbolSize: 8,
      lineStyle: { width: 4, color: '#18b978' }, itemStyle: { color: '#18b978' },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(24,185,120,.35)' }, { offset: 1, color: 'rgba(24,185,120,0)' }]) },
    }],
  });
  trendChart.resize();
}

function categoryExpenseStats() {
  const map = {};
  currentMonthBills().filter(b => b.type === 'expense').forEach(b => { map[b.category] = (map[b.category] || 0) + Number(b.amount); });
  return Object.entries(map).map(([id, value]) => ({ ...categories.expense.find(c => c.id === id), value })).sort((a, b) => b.value - a.value);
}

function renderDonutChart() {
  const el = $('donutChart');
  donutChart ||= echarts.init(el, null, { renderer: 'svg' });
  const stats = categoryExpenseStats();
  const total = stats.reduce((s, x) => s + x.value, 0);
  donutChart.setOption({
    tooltip: { trigger: 'item', formatter: (p) => `${p.name}<br/>${yuan(p.value)} (${p.percent}%)` },
    graphic: [{ type: 'text', left: 'center', top: '42%', style: { text: `总支出\n${yuan(total)}`, textAlign: 'center', fill: '#18202f', fontSize: 16, fontWeight: 900, lineHeight: 24 } }],
    series: [{
      type: 'pie', radius: ['54%', '78%'], center: ['50%', '48%'], avoidLabelOverlap: true,
      itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 4 },
      label: { color: '#5b6478', formatter: '{b}' },
      data: stats.map(s => ({ name: s.name, value: s.value, itemStyle: { color: s.color } })),
    }],
  });
  donutChart.resize();
}

function renderRanking() {
  const stats = categoryExpenseStats();
  const total = stats.reduce((s, x) => s + x.value, 0);
  $('rankTotal').textContent = yuan(total);
  $('ranking').innerHTML = stats.map(s => `<div class="rank-row">
    <div class="rank-icon" style="background:${s.color}18">${s.icon}</div>
    <div><div class="rank-name">${s.name}</div><div class="rank-track"><div class="rank-fill" style="width:${total ? s.value / total * 100 : 0}%;background:${s.color}"></div></div></div>
    <div class="rank-money">${yuan(s.value)}</div>
  </div>`).join('') || '<div class="empty">本月暂无支出。</div>';
}

function renderAssets() {
  const total = state.accounts.reduce((s, a) => s + Number(a.balance), 0);
  $('assetTotal').textContent = yuan(total);
  $('assetList').innerHTML = state.accounts.map(a => {
    const meta = accountMeta[a.id];
    return `<article class="asset-card" style="background:${meta.gradient}">
      <div class="asset-emoji">${meta.icon}</div>
      <div class="asset-info"><div class="asset-name">${meta.name}</div><div class="asset-desc">记账后余额自动实时增减</div></div>
      <div class="asset-balance">${yuan(a.balance)}</div>
    </article>`;
  }).join('');
}

function renderBudget() {
  const expense = sumBills(currentMonthBills(), 'expense');
  const percent = state.budget ? Math.min(expense / state.budget * 100, 100) : 0;
  $('usedBudgetText').textContent = yuan(expense);
  $('totalBudgetText').textContent = yuan(state.budget);
  $('budgetBar').style.width = `${percent}%`;
  $('budgetInput').value = state.budget;
  const warning = percent >= 80;
  $('budgetCard').classList.toggle('warning', warning);
  $('budgetState').textContent = warning ? '预算预警' : '健康';
  $('budgetHint').textContent = warning ? `本月预算已使用 ${percent.toFixed(0)}%，建议收紧非必要消费。` : `本月预算已使用 ${percent.toFixed(0)}%，控制得很好。`;
}

function renderAccountOptions() {
  $('accountSelect').innerHTML = state.accounts.map(a => `<option value="${a.id}">${accountMeta[a.id].icon} ${accountMeta[a.id].name} · ${yuan(a.balance)}</option>`).join('');
}

function renderCategories() {
  $('categoryGrid').innerHTML = categories[entryType].map(c => `<button class="category ${selectedCategory === c.id ? 'active' : ''}" data-id="${c.id}" type="button">
    <span class="emoji" style="background:${c.color}18">${c.icon}</span><b>${c.name}</b>
  </button>`).join('');
}

function openSheet() {
  $('sheetMask').hidden = false;
  $('entrySheet').classList.add('open');
  $('entrySheet').setAttribute('aria-hidden', 'false');
  $('dateInput').value = todayISO();
  $('amountInput').focus();
}
function closeSheet() {
  $('entrySheet').classList.remove('open');
  $('entrySheet').setAttribute('aria-hidden', 'true');
  setTimeout(() => { $('sheetMask').hidden = true; }, 220);
}

function petSay(text) {
  const bubble = $('petBubble');
  bubble.textContent = text;
  bubble.classList.add('talking');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove('talking'), 1800);
}
function petTalk() {
  petSay(petLines[Math.floor(Math.random() * petLines.length)]);
}

function addBill(e) {
  e.preventDefault();
  const amount = Number($('amountInput').value);
  if (!amount || amount <= 0) return;
  const account = state.accounts.find(a => a.id === $('accountSelect').value);
  const bill = {
    id: crypto.randomUUID(), type: entryType, category: selectedCategory, amount,
    date: $('dateInput').value, accountId: account.id, note: $('noteInput').value.trim(),
  };
  account.balance += entryType === 'income' ? amount : -amount;
  state.bills.unshift(bill);
  saveState();
  $('entryForm').reset();
  selectedCategory = entryType === 'income' ? 'salary' : 'food';
  renderCategories();
  renderAll();
  closeSheet();
  petSay(entryType === 'income' ? '又有进账啦，真棒！' : '记好啦，菲比都看到咯~');
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `菲比记账备份-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function bindEvents() {
  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => switchPage(btn.dataset.target)));
  $('phoebeAvatar').addEventListener('click', petTalk);
  $('fab').addEventListener('click', openSheet);
  $('closeSheet').addEventListener('click', closeSheet);
  $('sheetMask').addEventListener('click', closeSheet);
  $('entryForm').addEventListener('submit', addBill);
  $('quickExport').addEventListener('click', exportData);
  $('exportJson').addEventListener('click', exportData);
  $('saveBudget').addEventListener('click', () => { state.budget = Math.max(0, Number($('budgetInput').value || 0)); saveState(); renderAll(); });
  $('resetDemo').addEventListener('click', () => { if (confirm('恢复体验数据会覆盖当前本地数据，确定继续？')) { state = makeDemoState(); saveState(); renderAll(); } });
  $('clearData').addEventListener('click', () => { if (confirm('确定清空所有本地账单、资产和预算？此操作不可恢复。')) { localStorage.removeItem(STORAGE_KEY); state = makeDemoState(); state.bills = []; saveState(); renderAll(); } });
  document.querySelectorAll('.seg-btn').forEach(btn => btn.addEventListener('click', () => {
    entryType = btn.dataset.type;
    selectedCategory = entryType === 'income' ? 'salary' : 'food';
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderCategories();
  }));
  $('categoryGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.category');
    if (!btn) return;
    selectedCategory = btn.dataset.id;
    renderCategories();
  });
  window.addEventListener('resize', () => { trendChart?.resize(); donutChart?.resize(); });
}

loadState();
bindEvents();
renderCategories();
$('dateInput').value = todayISO();
renderAll();
