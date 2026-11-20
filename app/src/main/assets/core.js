(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HubCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SCHEMA = 16;
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
    return { version: SCHEMA, name: '拾集', assets: [], categoryMap: {}, categories: CATEGORIES.map(c => ({...c,statsEnabled:true})), wealthOrder:WEALTH_BLOCKS.map(b=>b.id), navPages:[{id:'home',visible:true},{id:'todos',visible:true}], goals: [], tasks: [], history: [], remoteHistory: [], salaryYears: [],
      allocationGoals: {},
      modules: MODULES.map(m => ({ id: m.id, enabled: m.enabled, visible: true })), pageOptions:defaultPageOptions(), accountSort:'amount-desc', lastSync: null, lastSyncAttempt:null, demo: false };
  }
  function migrate(value) {
    const s = Object.assign(empty(), value || {});
    if (!['amount-desc','amount-asc','original'].includes(s.accountSort)) s.accountSort='amount-desc';
    for (const k of ['assets', 'goals', 'tasks', 'history']) if (!Array.isArray(s[k])) s[k] = [];
    s.remoteHistory=normalizeAssetTrend(s.remoteHistory,true);
    const salaryByYear=new Map();
    for(const row of Array.isArray(s.salaryYears)?s.salaryYears:[]){
      const year=Number(row?.year),bonus=Number(row?.bonus),dividend=Number(row?.dividend);
      const months=Array.isArray(row?.months)&&row.months.length===12?row.months.map(n=>n===null||n===''?null:Number(n)):null;
      if(Number.isInteger(year)&&year>=1900&&year<=2100&&months&&months.every(n=>n===null||Number.isFinite(n)&&n>=0&&n<=1e12)&&[bonus,dividend].every(n=>Number.isFinite(n)&&n>=0&&n<=1e12))
        salaryByYear.set(year,{year,months:months.map(n=>n===null?null:round(n)),bonus:round(bonus),dividend:round(dividend)});
    }
    s.salaryYears=[...salaryByYear.values()].sort((a,b)=>a.year-b.year);
    s.assets=s.assets.filter(a=>a&&typeof a==='object'&&!(a.source==='xiaoqing'&&Number(a.balance)===0));
    s.goals=s.goals.filter(g=>g&&typeof g==='object').map(g=>({...g,visible:g.visible!==false}));
    const currentGoal=s.goals.find(g=>g.visible!==false)||s.goals[0];
    for(const g of s.goals)g.visible=g===currentGoal;
    if(Number(value?.version||0)<11&&s.assets.length)for(const g of s.goals)if(!g.scope||g.scope==='all'){
      g.baseline=s.assets.filter(a=>a.currency==='RMB'&&!a.reckonIn&&Number(a.balance)>0).reduce((sum,a)=>sum+Number(a.balance),0);
      g.createdDate=today();g.baselinePending=false;
    }
    s.tasks = s.tasks.filter(t=>t&&typeof t==='object').map(t=>({...t,priority:['low','medium','high'].includes(t.priority)?t.priority:'medium'}));
    s.categoryMap = s.categoryMap && typeof s.categoryMap === 'object' ? s.categoryMap : {};
    s.categories = Array.isArray(s.categories) ? s.categories.filter(c => c && typeof c.id==='string' && /^[a-zA-Z0-9_-]+$/.test(c.id) && typeof c.name==='string' && /^#[0-9a-fA-F]{6}$/.test(c.color)).map(c=>({...c,statsEnabled:c.statsEnabled===undefined?c.visible!==false:c.statsEnabled!==false})) : CATEGORIES.map(c => ({...c,statsEnabled:true}));
    if (!s.categories.some(c => c.id==='other')) s.categories.push({...CATEGORIES.find(c=>c.id==='other'),statsEnabled:true});
    for(const g of s.goals){
      if(g.scope && g.scope!=='all' && Number(value?.version||0)<13){g.baseline=totals(s).grossAssets;g.createdDate=today();g.baselinePending=!s.assets.length;}
      g.scope='all';
    }
    const order=Array.isArray(s.wealthOrder)?s.wealthOrder:[];
    s.wealthOrder=[...new Set(order.filter(id=>WEALTH_BLOCKS.some(b=>b.id===id)))].concat(WEALTH_BLOCKS.map(b=>b.id).filter(id=>!order.includes(id)));
    const nav=Array.isArray(s.navPages)?s.navPages:[];
    const validNav=nav.filter(row=>row&&['home','todos'].includes(row.id));
    s.navPages=[...new Map(validNav.map(row=>[row.id,{id:row.id,visible:row.visible!==false}])).values()];
    for(const id of ['home','todos'])if(!s.navPages.some(row=>row.id===id))s.navPages.push({id,visible:true});
    const savedGoals=s.allocationGoals&&typeof s.allocationGoals==='object'?s.allocationGoals:{};
    const legacyTargets=s.allocationTargets||{};
    const statsBase=s.assets.filter(a=>included(a)&&s.categories.find(c=>c.id===category(s,a))?.statsEnabled!==false).reduce((sum,a)=>sum+Number(a.balance),0);
    s.allocationGoals=Object.fromEntries(s.categories.filter(c=>savedGoals[c.id]||Number(legacyTargets[c.id])>0).map(c=>{
      const goal=savedGoals[c.id]||{mode:s.allocationMode,target:legacyTargets[c.id]};
      const raw=Number(goal.target),target=goal.mode==='percent'&&Number(value?.version||0)<12?round(statsBase*raw/100):raw;
      return [c.id,{target:Number.isFinite(target)&&target>=0?target:0}];
    }));
    delete s.allocationTargets;delete s.allocationMode;
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
  function goalValue(s) { return totals(s).grossAssets; }
  function goalMetrics(s, g, now = today()) {
    const current = goalValue(s, g), amount = Number(g.amount), remaining = Math.max(0, round(amount - current));
    const nowDay = dateDay(now), deadlineDay = dateDay(g.deadline), createdDay = dateDay(g.createdDate);
    const days = deadlineDay - nowDay, complete = remaining === 0;
    const elapsed = nowDay - createdDay, duration = deadlineDay - createdDay;
    const baseline = Number(g.baseline || 0), plan = baseline + (amount - baseline) * Math.max(0, Math.min(1, duration > 0 ? elapsed / duration : 1));
    let first = null, firstDay = Infinity;
    for (const h of s.history) {
      const day = dateDay(h.date), age = nowDay - day;
      if (age >= 7 && age <= 30 && Number.isFinite(h.grossAssets) && day < firstDay) { first = h; firstDay = day; }
    }
    let estimate = null, dailyRate = null;
    if (first) {
      const initial = first.grossAssets;
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
    const base=categories(s).filter(c=>c.statsEnabled!==false).reduce((sum,c)=>sum+Math.max(0,t.categories[c.id]||0),0);
    const targetBase=categories(s).filter(c=>c.statsEnabled!==false).reduce((sum,c)=>sum+Math.max(0,Number(s.allocationGoals?.[c.id]?.target)||0),0);
    return categories(s).map(c => {
      const current = t.categories[c.id], target = Number(s.allocationGoals?.[c.id]?.target)||0;
      const desired = target, targetShare=c.statsEnabled!==false&&targetBase>0?target/targetBase*100:0;
      const share = c.statsEnabled!==false&&base>0 ? current / base * 100 : 0;
      return Object.assign({}, c, { current, share, target, desired, targetShare, gap: round(desired - current),
        deviation:round(share-targetShare),
        progress: desired > 0 ? Math.max(0, Math.min(100, current / desired * 100)) : 0 });
    });
  }
  function annualSalary(s) {
    return (s.salaryYears||[]).map(row=>{
      const monthlySalary=round(row.months.reduce((sum,n)=>sum+(n||0),0));
      return {...row,monthlySalary,total:round(monthlySalary+row.bonus+row.dividend)};
    }).sort((a,b)=>a.year-b.year);
  }
  function categoryBasis(s) { return JSON.stringify(Object.entries(s.categoryMap).sort(([a],[b])=>a.localeCompare(b))); }
  function recordSnapshot(s, date = today()) {
    const t = totals(s), entry = { date, total: t.total, grossAssets:t.grossAssets, categories: t.categories, categoryBasis:categoryBasis(s) };
    s.history = s.history.filter(h => h.date !== date).concat(entry).sort((a, b) => dateDay(a.date) - dateDay(b.date));
    return entry;
  }
  function normalizeAssetTrend(payload,stored=false) {
    let rows=payload;
    for(let depth=0;depth<3&&!Array.isArray(rows)&&rows&&typeof rows==='object';depth++)
      rows=['list','records','rows','items','data','content'].map(key=>rows[key]).find(value=>Array.isArray(value)||value&&typeof value==='object');
    if(!Array.isArray(rows)||rows.length>5000)return [];
    const sample=rows.find(row=>row&&typeof row==='object'&&!Array.isArray(row));
    if(!sample)return [];
    const valueKey=['totalAsset','totalAssets','grossAssets','assetTotal','totalMoney','netAsset','netAssets',...(stored?['total']:['balance'])].find(key=>Object.hasOwn(sample,key));
    const dateKey=['date','changeDate','recordDate','createTime','createdAt','time','day'].find(key=>Object.hasOwn(sample,key));
    if(!valueKey||!dateKey)return [];
    const byDate=new Map();
    const ordered=valueKey==='balance'?[...rows].sort((a,b)=>String(a?.[dateKey]??'').localeCompare(String(b?.[dateKey]??''))):rows;
    for(const row of ordered){
      if(!row||typeof row!=='object'||Array.isArray(row))continue;
      if(valueKey==='balance'&&row.currency&&!['RMB','CNY'].includes(String(row.currency).toUpperCase()))continue;
      const rawDate=row[dateKey],rawValue=row[valueKey];
      let date='';
      if(typeof rawDate==='string')date=rawDate.slice(0,10).replaceAll('/','-');
      else if(typeof rawDate==='number'&&Number.isFinite(rawDate)){const d=new Date(rawDate<1e11?rawDate*1000:rawDate);if(Number.isFinite(d.getTime()))date=today(d);}
      const total=typeof rawValue==='number'?rawValue:typeof rawValue==='string'&&/^-?\d+(?:\.\d+)?$/.test(rawValue.trim())?Number(rawValue):NaN;
      if(Number.isFinite(dateDay(date))&&Number.isFinite(total)&&Math.abs(total)<=1e12)byDate.set(date,{date,total:round(total)});
    }
    return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
  }
  function monthChange(s, date = today()) {
    const start = date.slice(0, 7) + '-01', before = s.history.filter(h => h.date <= start).sort((a,b) => a.date.localeCompare(b.date)).pop();
    return before && dateDay(start)-dateDay(before.date)<=1 ? round(totals(s).total - before.total) : null;
  }
  function historyMonthChange(entries, date = today()) {
    const start=date.slice(0,7)+'-01', before=entries.filter(h=>h.date<=start).pop(), latest=entries.filter(h=>h.date<=date).pop();
    return before&&latest&&dateDay(start)-dateDay(before.date)<=1?round(latest.total-before.total):null;
  }
  function validateGoal(g) {
    if (!String(g.name || '').trim()) return '请填写目标名称';
    if (!Number.isFinite(Number(g.amount)) || Number(g.amount) <= 0 || Number(g.amount) > 1e12) return '请输入有效的目标金额';
    if (!Number.isFinite(dateDay(g.deadline))) return '请选择有效的截止日期';
    return null;
  }
  function demo() {
    const s = empty(); s.demo = true;
    s.allocationGoals={stock:{target:34400},bond:{target:25800},cash:{target:25800}};
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
    for(let i=60;i>=0;i-=10) { const d=new Date(); d.setDate(d.getDate()-i);s.history.push({date:today(d),total:81000-i*150,grossAssets:86000-i*150,categories:{stock:32000-i*50,bond:24000-i*50,cash:30000-i*50,other:0},categoryBasis:categoryBasis(s)}); }
    s.lastSync = new Date().toISOString();
    return s;
  }
  return { SCHEMA, WEALTH_BLOCKS, MODULES, PAGE_OPTIONS, CATEGORIES, categories, empty, migrate, cents, round, included, category, totals, today, autoSyncDue, dateDay, taskUrgency,
    goalValue, goalMetrics, allocation, annualSalary, recordSnapshot, normalizeAssetTrend, monthChange, historyMonthChange, validateGoal, demo };
});
