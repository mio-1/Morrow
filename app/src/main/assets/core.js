(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HubCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SCHEMA = 10;
  const WEALTH_BLOCKS = [
    {id:'summary',name:'资产概览'}, {id:'goals',name:'存钱目标'}, {id:'allocation',name:'资产配置'}
  ];
  const MODULES = [
    { id: 'wealth', name: '资产统计', shortName: '资产', description: '账户余额与资产变化', icon: 'wallet', page: 'wealth', enabled: true },
    { id: 'goals', name: '长期目标', shortName: '目标', description: '把想要的生活变成进度', icon: 'flag', page: 'goals', enabled: true },
    { id: 'allocation', name: '资产配置', shortName: '配置', description: '股票、债券、现金各有目标', icon: 'pie', page: 'allocation', enabled: true },
    { id: 'todos', name: '待办清单', shortName: '待办', description: '记下计划，一件件完成', icon: 'check', page: 'todos', enabled: false }
  ];
  const PAGE_OPTIONS = {
    wealth: [
      { id:'summary', name:'资产概览', description:'显示计入资产总额与本月变化' },
      { id:'accounts', name:'账户列表', description:'显示账户入口与余额管理' },
      { id:'trend', name:'资产趋势', description:'显示资产变化入口' },
      { id:'goals', name:'存钱目标', description:'显示目标进度与目标入口' },
      { id:'allocation', name:'资产配置', description:'显示类别占比与配置入口' }
    ],
    goals: [
      { id:'monthly', name:'每月所需金额', description:'显示按截止日期计算的月度进度' },
      { id:'forecast', name:'预计达成日期', description:'在目标详情中显示趋势预测' }
    ],
    allocation: [
      { id:'share', name:'当前占比', description:'显示每类资产占总资产的比例' },
      { id:'gap', name:'目标差距', description:'显示当前金额与目标的差距' },
      { id:'progress', name:'进度条', description:'用进度条展示目标完成情况' }
    ],
    todos: [
      { id:'completed', name:'显示已完成', description:'在待办页面保留已完成的事项' }
    ]
  };
  function defaultPageOptions() { return Object.fromEntries(Object.entries(PAGE_OPTIONS).map(([id,options]) => [id,Object.fromEntries(options.map(o => [o.id,true]))])); }
  const CATEGORIES = [
    { id: 'stock', name: '股票', color: '#356bee' },
    { id: 'bond', name: '债券', color: '#9cb8f8' },
    { id: 'cash', name: '现金', color: '#b5c7dd' },
    { id: 'other', name: '其他', color: '#8796ae' }
  ];
  function empty() {
    return { version: SCHEMA, name: '拾集', assets: [], categoryMap: {}, categories: CATEGORIES.map(c => ({...c,visible:true})), wealthOrder:WEALTH_BLOCKS.map(b=>b.id), goals: [], tasks: [], history: [],
      allocationMode: 'amount', allocationTargets: { stock: 0, bond: 0, cash: 0, other: 0 }, allocationGoals: {},
      modules: MODULES.map(m => ({ id: m.id, enabled: m.enabled, visible: true })), pageOptions:defaultPageOptions(), lastSync: null, lastSyncAttempt:null, demo: false };
  }
  function migrate(value) {
    const s = Object.assign(empty(), value || {});
    for (const k of ['assets', 'goals', 'tasks', 'history']) if (!Array.isArray(s[k])) s[k] = [];
    s.assets=s.assets.filter(a=>a&&typeof a==='object'&&!(a.source==='xiaoqing'&&Number(a.balance)===0));
    s.goals=s.goals.filter(g=>g&&typeof g==='object').map(g=>({...g,visible:g.visible!==false}));
    s.tasks = s.tasks.filter(t=>t&&typeof t==='object').map(t=>({...t,priority:['low','medium','high'].includes(t.priority)?t.priority:'medium'}));
    s.categoryMap = s.categoryMap && typeof s.categoryMap === 'object' ? s.categoryMap : {};
    s.categories = Array.isArray(s.categories) ? s.categories.filter(c => c && typeof c.id==='string' && /^[a-zA-Z0-9_-]+$/.test(c.id) && typeof c.name==='string' && /^#[0-9a-fA-F]{6}$/.test(c.color)).map(c=>({...c,visible:c.visible!==false})) : CATEGORIES.map(c => ({...c,visible:true}));
    if (!s.categories.some(c => c.id==='other')) s.categories.push({...CATEGORIES.find(c=>c.id==='other'),visible:true});
    const order=Array.isArray(s.wealthOrder)?s.wealthOrder:[];
    s.wealthOrder=[...new Set(order.filter(id=>WEALTH_BLOCKS.some(b=>b.id===id)))].concat(WEALTH_BLOCKS.map(b=>b.id).filter(id=>!order.includes(id)));
    s.allocationTargets = Object.assign(empty().allocationTargets, s.allocationTargets || {});
    const savedGoals=s.allocationGoals&&typeof s.allocationGoals==='object'?s.allocationGoals:{};
    s.allocationGoals=Object.fromEntries(s.categories.filter(c=>savedGoals[c.id]||Number(s.allocationTargets[c.id])>0).map(c=>{
      const goal=savedGoals[c.id]||{mode:s.allocationMode,target:s.allocationTargets[c.id]};
      const mode=goal.mode==='percent'?'percent':'amount',target=Number(goal.target);
      return [c.id,{mode,target:Number.isFinite(target)&&target>=0?target:0}];
    }));
    const existing = Array.isArray(s.modules) ? s.modules.filter(m => MODULES.some(d => d.id === m.id)) : [];
    s.modules = existing.map(m => ({ id:m.id, enabled:!!m.enabled, visible:m.visible !== false }))
      .concat(MODULES.filter(m => !existing.some(e => e.id === m.id)).map(m => ({ id: m.id, enabled: m.enabled, visible:true })));
    const savedOptions=s.pageOptions && typeof s.pageOptions==='object' ? s.pageOptions : {};
    s.pageOptions=Object.fromEntries(Object.entries(PAGE_OPTIONS).map(([id,options]) => [id,Object.fromEntries(options.map(o => [o.id,savedOptions[id]?.[o.id] !== false]))]));
    delete s.menuShortcuts;
    s.demo = false;
    s.version = SCHEMA;
    return s;
  }
  function cents(n) { return Math.round(Number(n || 0) * 100); }
  function round(n) { return Math.round(n * 100) / 100; }
  function included(a) { return !a.reckonIn && a.currency === 'RMB' && cents(a.balance) > 0; }
  function categories(s) { return s.categories || CATEGORIES; }
  function category(s, a) { return categories(s).some(c => c.id === s.categoryMap[a.code]) ? s.categoryMap[a.code] : 'other'; }
  function totals(s) {
    const values = Object.fromEntries(categories(s).map(c=>[c.id,0]));
    let total = 0, grossAssets = 0, liabilities = 0, excludedTotal = 0, count = 0, excluded = 0, foreign = 0;
    for (const a of s.assets) {
      if (a.currency !== 'RMB') { foreign++; continue; }
      const amount = cents(a.balance), id = s.categoryMap?.[a.code];
      if (amount < 0) { liabilities -= amount; total += amount; continue; }
      if (a.reckonIn) { excluded++; excludedTotal += amount; continue; }
      values[Object.hasOwn(values,id) ? id : 'other'] += amount;
      total += amount;
      grossAssets+=amount;
      count++;
    }
    return { total: total / 100, grossAssets:grossAssets/100, liabilities:liabilities/100, excludedTotal:excludedTotal/100, categories: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v / 100])), included:count, excluded, foreign };
  }
  function dateDay(date) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
    if (!match) return NaN;
    const y = +match[1], m = +match[2], d = +match[3];
    const utc = new Date(Date.UTC(y, m - 1, d));
    if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) return NaN;
    return utc.getTime() / 86400000;
  }
  function today(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function autoSyncDue(s, now = Date.now()) {
    const lastSync=Date.parse(s.lastSync||''), lastAttempt=Date.parse(s.lastSyncAttempt||'');
    const latest=Math.max(Number.isFinite(lastSync)?lastSync:0,Number.isFinite(lastAttempt)?lastAttempt:0);
    return now-latest>12*60*60*1000;
  }
  function taskUrgency(task, now = today()) {
    const days = dateDay(task.deadline) - dateDay(now);
    if (!Number.isFinite(days)) return null;
    const level = {low:0, medium:1, high:2}[task.priority] ?? 1;
    const timePressure = 1 / (1 + Math.exp((days - 7) / 4));
    const score = Math.max(0, Math.min(1, 0.78 * timePressure + 0.11 * level));
    return {days, score, hue:Math.round(214 + 158 * score), label:days < 0 ? `逾期 ${-days} 天` : days === 0 ? '今天到期' : `剩 ${days} 天`};
  }
  function goalValue(s, g) { const t = totals(s); return g.scope && g.scope !== 'all' ? (t.categories[g.scope] || 0) : t.total; }
  function goalMetrics(s, g, now = today()) {
    const current = goalValue(s, g), amount = Number(g.amount), remaining = Math.max(0, round(amount - current));
    const nowDay = dateDay(now), deadlineDay = dateDay(g.deadline), createdDay = dateDay(g.createdDate);
    const days = deadlineDay - nowDay, complete = remaining === 0;
    const elapsed = nowDay - createdDay, duration = deadlineDay - createdDay;
    const baseline = Number(g.baseline || 0), plan = baseline + (amount - baseline) * Math.max(0, Math.min(1, duration > 0 ? elapsed / duration : 1));
    const scoped = g.scope && g.scope !== 'all', basis = scoped ? categoryBasis(s) : null;
    let first = null, firstDay = Infinity;
    for (const h of s.history) {
      const day = dateDay(h.date), age = nowDay - day;
      if (age >= 7 && age <= 30 && (!scoped || h.categoryBasis === basis) && day < firstDay) { first = h; firstDay = day; }
    }
    let estimate = null, dailyRate = null;
    if (first) {
      const initial = g.scope && g.scope !== 'all' ? first.categories[g.scope] || 0 : first.total;
      const span = nowDay - firstDay;
      dailyRate = (current - initial) / span;
      if (dailyRate > 0 && !complete) { const d = new Date((nowDay + Math.ceil(remaining / dailyRate)) * 86400000); estimate = d.toISOString().slice(0, 10); }
    }
    return { current, remaining, percent: amount > 0 ? Math.max(0, round(current / amount * 100)) : 0,
      bar: amount > 0 ? Math.max(0, Math.min(100, current / amount * 100)) : 0, days, complete,
      monthly: complete ? 0 : days > 0 ? round(remaining / days * 30.4375) : null,
      ahead: round(current - plan), estimate, dailyRate, overdue: !complete && days < 0 };
  }
  function allocation(s) {
    const t = totals(s);
    return categories(s).map(c => {
      const saved=s.allocationGoals?.[c.id], mode=saved?.mode||s.allocationMode||'amount', percent=mode==='percent';
      const current = t.categories[c.id], target = Number(saved?.target ?? s.allocationTargets?.[c.id] ?? 0);
      const desired = percent ? t.grossAssets * target / 100 : target;
      const share = t.grossAssets > 0 ? current / t.grossAssets * 100 : 0;
      return Object.assign({}, c, { current, share, mode, target, desired, gap: round(desired - current),
        deviation: percent ? round(share - target) : null,
        progress: desired > 0 ? Math.max(0, Math.min(100, current / desired * 100)) : 0 });
    });
  }
  function categoryBasis(s) { return JSON.stringify(Object.entries(s.categoryMap).sort(([a],[b])=>a.localeCompare(b))); }
  function recordSnapshot(s, date = today()) {
    const t = totals(s), entry = { date, total: t.total, categories: t.categories, categoryBasis:categoryBasis(s) };
    s.history = s.history.filter(h => h.date !== date).concat(entry).sort((a, b) => dateDay(a.date) - dateDay(b.date));
    return entry;
  }
  function monthChange(s, date = today()) {
    const start = date.slice(0, 7) + '-01', before = s.history.filter(h => h.date <= start).sort((a,b) => a.date.localeCompare(b.date)).pop();
    return before && dateDay(start)-dateDay(before.date)<=1 ? round(totals(s).total - before.total) : null;
  }
  function validateGoal(g) {
    if (!String(g.name || '').trim()) return '请填写目标名称';
    if (!Number.isFinite(Number(g.amount)) || Number(g.amount) <= 0 || Number(g.amount) > 1e12) return '请输入有效的目标金额';
    if (!Number.isFinite(dateDay(g.deadline))) return '请选择有效的截止日期';
    return null;
  }
  function validateAllocation(mode, targets, defs = CATEGORIES) {
    const vals = defs.map(c => Number(targets[c.id]));
    if (vals.some(v => !Number.isFinite(v) || v < 0)) return '目标不能是负数或空值';
    if (mode === 'percent' && Math.abs(vals.reduce((a,b) => a+b,0) - 100) > 0.001) return '比例目标的合计需要等于 100%';
    return null;
  }
  function demo() {
    const s = empty(); s.demo = true;
    s.allocationMode='percent';s.allocationTargets={stock:40,bond:30,cash:30,other:0};
    s.assets = [
      { code:'demo-stock', name:'股票账户', balance:32000, currency:'RMB', reckonIn:false, type:'other' },
      { code:'demo-bond', name:'债券账户', balance:24000, currency:'RMB', reckonIn:false, type:'other' },
      { code:'demo-cash', name:'日常储蓄', balance:30000, currency:'RMB', reckonIn:false, type:'debit_card' },
      { code:'demo-credit', name:'不计入的信用卡', balance:-5000, currency:'RMB', reckonIn:true, type:'credit_card' }
    ];
    s.categoryMap = { 'demo-stock':'stock', 'demo-bond':'bond', 'demo-cash':'cash' };
    const date = today(), future = new Date(); future.setFullYear(future.getFullYear()+2);
    const start = new Date(); start.setDate(start.getDate()-90);
    s.goals = [{ id:'demo-goal',name:'攒下第一笔底气',amount:200000,deadline:today(future),scope:'all',createdDate:today(start),baseline:70000,demo:true }];
    for(let i=60;i>=0;i-=10) { const d=new Date(); d.setDate(d.getDate()-i);s.history.push({date:today(d),total:81000-i*150,categories:{stock:32000-i*50,bond:24000-i*50,cash:30000-i*50,other:0},categoryBasis:categoryBasis(s)}); }
    s.lastSync = new Date().toISOString();
    return s;
  }
  return { SCHEMA, WEALTH_BLOCKS, MODULES, PAGE_OPTIONS, CATEGORIES, categories, empty, migrate, cents, round, included, category, totals, today, autoSyncDue, dateDay, taskUrgency,
    goalValue, goalMetrics, allocation, recordSnapshot, monthChange, validateGoal, validateAllocation, demo };
});
