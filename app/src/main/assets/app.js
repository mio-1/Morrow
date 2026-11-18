(function () {
  'use strict';
  const C = window.HubCore, app = document.getElementById('app'), overlay = document.getElementById('overlay');
  const native = !!window.NativeHub, pending = new Map();
  let state = C.empty(), page = 'home', wealthTab = 'accounts', moduleSettingsId = 'wealth', connected = false, busy = false, toastTimer, nextId = 0;
  const paths = {
    home:'M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
    flag:'M5 22V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0',
    pie:'M21 12a9 9 0 1 1-9-9v9zm-5-9a9 9 0 0 1 5 5h-5z',
    grid:'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',
    wallet:'M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h16v11H5a3 3 0 0 1-3-3V6m19 7h-5v4h5',
    check:'M5 12l4 4L20 5', list:'M8 6h13M8 12h13M8 18h13M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2', plus:'M12 5v14M5 12h14', close:'M6 6l12 12M18 6L6 18',
    arrow:'M9 5l7 7-7 7', sync:'M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5m-4 9a8 8 0 0 0 14 2l3-3m0 5v-5h-5',
    settings:'M4 7h9m4 0h3M4 17h3m4 0h9M15 5v4M9 15v4',
    trend:'M3 18l6-6 4 3 8-10m-6 0h6v6', calendar:'M4 5h16v16H4zM8 3v4m8-4v4M4 10h16',
    leaf:'M20 3C6 2 1 8 5 15c7 7 15-1 15-12zM5 21l10-12',
    trash:'M3 6h18M9 3h6m-10 3 1 15h12l1-15M10 10v7m4-7v7', archive:'M3 5h18v4H3zM5 9v11h14V9M10 13h4',
    lock:'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4', edit:'M14 5l5 5M3 21l5-1L21 7l-5-5L3 15z',
    clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 4v5l4 2'
  };
  function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.grid}"/></svg>`; }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function money(n, decimals = 0) { return Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); }
  function yuan(n) { return '¥' + money(n); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function catName(id) { return esc((C.categories(state).find(c => c.id === id) || { name:'全部计入资产' }).name); }
  function hint(text) { return `<div class="hint-box">${text}</div>`; }
  function call(action, args = {}) {
    if (!native) {
      if (action === 'load') return Promise.resolve({ ok:true, state:JSON.parse(localStorage.getItem('shiji-state') || '{}'), connected:false });
      if (action === 'save') { localStorage.setItem('shiji-state', JSON.stringify(args.state)); return Promise.resolve({ ok:true }); }
      return Promise.resolve({ ok:false, error:'浏览器仅供界面预览，请安装 APK 后登录同步。' });
    }
    return new Promise((resolve, reject) => {
      const id = String(++nextId), timer = setTimeout(() => { pending.delete(id); reject(new Error('操作超时，请稍后重试')); }, 55000);
      pending.set(id, { resolve, timer });
      window.NativeHub.call(id, action, JSON.stringify(args));
    });
  }
  window.onNativeResult = (id, result) => { const p = pending.get(id); if (p) { clearTimeout(p.timer); pending.delete(id); p.resolve(result); } };
  async function persist() {
    try { const result = await call('save', {state}); if (!result.ok) toast(result.error || '保存失败，请重试'); }
    catch (e) { toast('本地保存未完成，请重试'); }
  }
  function save() { if (!state.demo) persist(); }
  function toast(text) { const el = document.getElementById('toast'); el.textContent = text; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3600); }
  function emptyCard(title, text, action, label, type = 'flag') {
    return `<div class="card empty"><div class="empty-icon">${icon(type)}</div><h3>${title}</h3><p>${text}</p>${action ? `<button class="primary" data-action="${action}">${icon('plus')}${label}</button>` : ''}</div>`;
  }
  function pageOption(moduleId, optionId) { return state.pageOptions?.[moduleId]?.[optionId] !== false; }
  function hasAssets() { return state.assets.length > 0 || !!state.lastSync; }
  function syncLabel() {
    if (!state.lastSync) return '尚未同步';
    const d = new Date(state.lastSync); return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  function render() {
    const tabs = [{ id:'home', label:'资产', icon:'wallet' }, { id:'todos', label:'待办', icon:'list' }, { id:'settings', label:'设置', icon:'settings' }];
    const views = { home:homeView, goals:goalsView, wealth:wealthView, allocation:allocationPage, settings:settingsView, connections:connectionsView, xiaoqing:xiaoqingView, 'module-settings':moduleSettingsView, todos:todosView, 'todo-library':todoLibraryView };
    app.innerHTML = `<main class="shell">
      ${(views[page] || homeView)()}</main><nav class="bottom-nav" aria-label="主导航">${tabs.map(t => { const active=page===t.id || t.id==='home' && ['goals','wealth','allocation'].includes(page) || t.id==='todos' && page==='todo-library' || t.id==='settings' && ['module-settings','connections','xiaoqing'].includes(page); return `<button class="nav-item ${active ? 'active' : ''}" data-action="nav" data-page="${t.id}" ${active ? 'aria-current="page"' : ''}>${icon(t.icon)}<span>${t.label}</span></button>`; }).join('')}</nav>`;
  }
  function title(eyebrow, name, subtitle, button) {
    return `<div class="page-title"><div>${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<h1>${name}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${button || ''}</div>`;
  }
  function homeView() {
    const visible=C.PAGE_OPTIONS.wealth.filter(o=>pageOption('wealth',o.id));
    return title('', '资产', '', `<button class="icon-btn" aria-label="资产页面设置" data-action="page-settings" data-id="wealth">${icon('settings')}</button>`) +
      (pageOption('wealth','summary')?wealthWidget():'') +
      (pageOption('wealth','accounts')?`<section class="section asset-link-section"><button class="settings-row asset-page-link" data-action="open-accounts"><span class="row-glyph">${icon('wallet')}</span><div><h3>账户列表</h3><p>${state.assets.length} 个账户 · 查看余额和分类</p></div>${icon('arrow')}</button></section>`:'') +
      (pageOption('wealth','trend')?`<section class="section asset-link-section"><button class="settings-row asset-page-link" data-action="open-trend"><span class="row-glyph">${icon('trend')}</span><div><h3>资产趋势</h3><p>${state.history.length} 天记录 · 查看资产变化</p></div>${icon('arrow')}</button></section>`:'') +
      (pageOption('wealth','goals')?goalsWidget():'') +
      (pageOption('wealth','allocation')?allocationWidget():'') +
      (!visible.length?emptyCard('资产页还没有内容','在设置里选择要显示的模块。','open-modules','设置资产页','grid'):'');
  }
  function homeTrend() {
    const entries = state.history;
    if (entries.length < 2) return '';
    const values = entries.map(e => e.total), low = Math.min(...values), high = Math.max(...values), span = high-low || 1;
    const start = C.dateDay(entries[0].date), days = C.dateDay(entries[entries.length-1].date)-start || 1;
    const points = entries.map(e => `${((C.dateDay(e.date)-start)/days*300).toFixed(1)},${(55-(e.total-low)/span*45).toFixed(1)}`).join(' ');
    return `<svg class="home-trend" viewBox="0 0 300 64" preserveAspectRatio="none" role="img" aria-label="计入资产走势"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg><div class="home-trend-labels"><span>${esc(entries[0].date)}</span><span>${esc(entries[entries.length-1].date)}</span></div>`;
  }
  function wealthWidget() {
    const t = C.totals(state), change = C.monthChange(state), assets = hasAssets();
    const active = state.goals.filter(g => !C.goalMetrics(state,g).complete).length;
    return `<section><div class="hero"><div class="hero-label">当前总资产 ${state.demo ? '<span class="chip gold">示例</span>' : ''}</div>
      <div class="asset-value">${assets ? `<span class="currency-symbol">¥</span>${money(t.total,2)}` : '等待第一笔同步'}</div>
      <p class="hero-sub">${assets ? `${t.included} 个计入账户 · ${t.excluded} 个“不计入”账户已排除` : '连接小青账后显示资产和目标进度'}</p>
      ${homeTrend()}<div class="hero-bottom"><small>${assets ? `最近同步 ${syncLabel()}` : '尚未同步'}</small><button class="sync ${busy ? 'busy' : ''}" data-action="${connected?'sync':'connect'}" ${busy ? 'disabled' : ''}>${icon('sync')}${busy ? '同步中' : connected ? '同步资产' : '连接账户'}</button></div></div>
      ${t.foreign ? `<div class="warning-note">${t.foreign} 个外币账户暂未折算，未计入人民币目标，请在小青账核对。</div>` : ''}
      <div class="stat-grid"><div class="mini-stat"><div class="label">${icon('trend')}本月资产变化</div><strong>${change == null ? '—' : (change > 0 ? '+' : '') + yuan(change)}</strong><small>${change == null ? '需要月初或更早的余额记录' : '含资产价格涨跌和账户变动'}</small></div><div class="mini-stat"><div class="label">${icon('flag')}正在靠近的目标</div><strong>${active}<span class="muted" style="font-size:11px;font-weight:400"> 个</span></strong><small>${state.goals.length ? '按各自截止日期追踪' : '为未来，先起一个名字'}</small></div></div></section>`;
  }
  function goalsWidget() {
    return `<section class="section"><div class="section-head"><h2>存钱目标 <span class="section-count">${state.goals.length}</span></h2><button class="subtle" data-action="nav" data-page="goals">全部目标${icon('arrow')}</button></div>${state.goals.length ? state.goals.slice(0,2).map(goalCard).join('') : emptyCard('设置第一个存钱目标','填写金额和截止日期，进度会随资产更新。','add-goal','新建目标')}</section>`;
  }
  function goalCard(g, tailored = false) {
    const m = C.goalMetrics(state,g), tag = m.complete ? '已达成' : m.overdue ? '已逾期' : `剩余 ${m.days} 天`;
    return `<button class="card goal-card" data-action="goal-detail" data-id="${esc(g.id)}"><div class="goal-top"><div class="goal-icon">${icon(g.scope === 'all' ? 'flag' : 'pie')}</div><div class="goal-title"><h3>${esc(g.name)}</h3><small>${esc(g.deadline)} 截止 · ${catName(g.scope)}</small></div><span class="chip ${m.complete ? 'green' : m.overdue ? 'warn' : 'gray'}">${tag}</span></div>
      <div class="goal-numbers"><strong>${hasAssets() ? yuan(m.current) : '—'}</strong><span>/ ${yuan(g.amount)}</span></div><div class="progress"><i style="width:${hasAssets() ? m.bar : 0}%"></i></div><div class="goal-foot"><b>${hasAssets() ? `${money(m.percent,1)}% 已完成` : '同步资产后计算进度'}</b>${!tailored||pageOption('goals','monthly') ? `<span>${!hasAssets()?'等待资产数据':m.complete ? '这一程，已经抵达' : m.monthly == null ? '需调整截止日期' : `每月还需 ${yuan(m.monthly)}`}</span>` : ''}</div></button>`;
  }
  function allocationWidget() {
    const rows = C.allocation(state), t = C.totals(state); let acc = 0;
    const segments = rows.filter(r => r.current > 0).map(r => { const from=acc; acc += r.current; return {r,from}; });
    const positiveTotal = segments.reduce((n,s) => n+s.r.current,0);
    const gradient = positiveTotal ? segments.map(({r,from}) => `${r.color} ${from/positiveTotal*360}deg ${(from+r.current)/positiveTotal*360}deg`).join(',') : '#e8ede5 0deg 360deg';
    const unclassified = state.assets.filter(a => C.included(a) && !state.categoryMap[a.code]).length;
    return `<section class="section"><div class="section-head"><h2>资产配置</h2><button class="subtle" data-action="assets-allocation">查看详情${icon('arrow')}</button></div><div class="card"><div class="allocation-top"><div class="donut" style="--segments:${gradient}"><div class="donut-hole"><strong>${t.total > 0 ? '100%' : '—'}</strong><span>资产配置</span></div></div><div class="allocation-legend">${rows.map(r => `<div class="legend-row"><span class="legend-name"><i class="dot" style="background:${r.color}"></i>${esc(r.name)}</span><b>${money(r.share,1)}%</b></div>`).join('')}</div></div><p class="allocation-note">${unclassified ? `${unclassified} 个计入账户尚在“其他”类别，可在账户页归类。` : hasAssets() ? '为股票、债券、现金设置自己的配置目标。' : '连接资产后查看各类别占比。'}${t.total <= 0 ? '' : ' 圆环展示正余额构成。'}</p></div></section>`;
  }
  function goalsView() {
    const visible=state.goals.filter(g=>pageOption('goals','completed')||!C.goalMetrics(state,g).complete);
    return title('','长期目标','为每个目标设定自己的时间和金额。',`<button class="icon-btn" aria-label="新建目标" data-action="add-goal">${icon('plus')}</button>`) +
      `<div class="goal-tab-controls"><span class="subtle">${visible.length} 个目标 · 独立截止日期</span><span class="chip green">${state.goals.filter(g => C.goalMetrics(state,g).complete).length} 个已达成</span></div>` +
      (visible.length ? visible.map(g=>goalCard(g,true)).join('') : state.goals.length ? hint('已完成目标已隐藏，可以在这个功能的设置中重新显示。') : emptyCard('未来的你，会感谢今天','设置目标金额和截止日期，进度会随资产同步更新。','add-goal','创建长期目标')) +
      '<p class="footnote">目标按所选资产口径分别计算；共享同一份资产的目标属于阶段里程碑，不代表资金已独立分配，不能把它们的已攒金额相加。</p>';
  }
  function wealthView() {
    const t=C.totals(state);
    const sections=['accounts','trend'].filter(id=>pageOption('wealth',id));
    const selected=sections.includes(wealthTab)?wealthTab:sections[0];
    return title('','资产统计','账户余额与资产变化。') +
      (pageOption('wealth','summary') ? `<div class="card wealth-summary"><span>计入资产</span><strong>${hasAssets()?yuan(t.total):'—'}</strong><small>${t.included} 个计入账户 · ${t.excluded} 个不计入账户</small></div>` : '') +
      (sections.length>1 ? `<div class="split-tabs wealth-tabs"><button data-action="wealth-tab" data-tab="accounts" class="${selected === 'accounts' ? 'selected' : ''}">账户</button><button data-action="wealth-tab" data-tab="trend" class="${selected === 'trend' ? 'selected' : ''}">趋势</button></div>` : '') +
      (selected === 'accounts' ? accountsView() : selected === 'trend' ? trendView() : hint('这个页面的内容已全部关闭。可在资产统计设置中重新开启。'));
  }
  function allocationPage() {
    return title('','资产配置','查看每类资产距离目标还有多远。') + allocationView();
  }
  function allocationView() {
    const rows = C.allocation(state);
    return `<div class="section-head"><h2>${state.allocationMode === 'percent' ? '按当前总资产配置' : '按固定金额积累'}</h2><div class="section-actions"><button class="mini-button" data-action="categories">类别</button><button class="mini-button" data-action="allocation-edit">设置目标</button></div></div>` +
      rows.map(r => `<article class="card allocation-row"><div class="allocation-row-top"><div class="allocation-row-title"><i class="dot" style="background:${r.color}"></i><h3>${esc(r.name)}</h3></div>${pageOption('allocation','share') ? `<span class="chip gray">当前 ${money(r.share,1)}%</span>` : ''}</div><div class="allocation-value">${yuan(r.current)}</div><div class="allocation-target">${state.allocationMode === 'percent' ? `目标 ${money(r.target,1)}% · 按当前总资产应为 ${yuan(r.desired)}` : r.target>0?`固定目标 ${yuan(r.target)}`:'尚未设置目标金额'}</div>${pageOption('allocation','progress') ? `<div class="progress"><i style="background:${r.color};width:${r.progress}%"></i></div>` : ''}${pageOption('allocation','gap') ? `<div class="allocation-bottom"><span>${!hasAssets()?'等待资产数据':state.allocationMode==='amount'&&r.target<=0?'设置后显示差距':r.gap >= 0 ? `距离目标 ${yuan(r.gap)}` : `高于目标 ${yuan(-r.gap)}`}</span><b>${state.allocationMode === 'percent' ? `${r.deviation > 0 ? '+' : ''}${money(r.deviation,1)} 个百分点` : r.target > 0 ? `${money(r.current/r.target*100,1)}% 已完成` : '未设置金额'}</b></div>` : ''}</article>`).join('') +
      '<p class="footnote">比例目标随当前计入资产总额变化；固定金额目标保持不变。这些是你设定的目标，差距仅作记录。截止日期请在“目标”中为对应类别单独设置。</p>';
  }
  function accountsView() {
    const t = C.totals(state);
    return `<div class="section-head"><h2>${state.assets.length} 个账户</h2><div class="section-actions"><button class="mini-button" data-action="manual-asset">手动添加</button><button class="mini-button ${busy ? 'busy' : ''}" data-action="sync" ${busy?'disabled':''}>${busy?'同步中':'同步'}</button></div></div>` +
      (hasAssets() ? `<div class="card">${state.assets.map(a => `<div class="account ${a.reckonIn ? 'excluded' : ''}"><div class="account-badge">${icon(a.liabilities?'wallet':'pie')}</div><div class="account-main"><h3>${esc(a.name)}</h3><small>${a.reckonIn ? '不计入 · 已排除' : a.currency !== 'RMB' ? '外币暂未折算' : '计入目标'} · ${a.source === 'manual' ? '手动账户' : '小青账'}${a.source === 'manual' ? ` <button class="text-btn" data-action="manual-asset" data-id="${esc(a.code)}">编辑</button>` : ''}</small></div><div class="account-value"><strong>${esc(a.currency === 'RMB' ? '¥' : a.currency+' ')}${money(a.balance,2)}</strong><select aria-label="${esc(a.name)}的资产类别" data-category-code="${esc(a.code)}">${C.categories(state).map(c => `<option value="${c.id}" ${C.category(state,a)===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div></div>`).join('')}</div>` : emptyCard('先把资产连接进来','登录小青账后读取资产，也可以先手动添加账户。','connect','连接小青账','wallet')) +
      `<p class="footnote">计入 ${t.included} 个账户，排除 ${t.excluded} 个“不计入”账户。同步账户沿用小青账的标记；隐藏账户不会自动排除。负余额按原值参与计算，不会重复扣除。人民币以外的账户暂不折算。</p>`;
  }
  function trendView() {
    const history = state.history, values = history.map(h => h.total), count = history.length;
    let chart = '<div class="trend-empty">还没有足够的历史记录<br>每次同步会保存当天资产快照，逐步画出你的积累曲线。</div>';
    if (count > 1) {
      const low=Math.min(...values), high=Math.max(...values), span=high-low || 1;
      const from=C.dateDay(history[0].date),dateSpan=C.dateDay(history[count-1].date)-from || 1;
      const points=values.map((v,i) => `${(C.dateDay(history[i].date)-from)/dateSpan*300},${75-(v-low)/span*65}`).join(' ');
      chart = `<svg class="trend" viewBox="0 0 300 85" preserveAspectRatio="none" role="img" aria-label="资产随同步日期的变化曲线"><polyline points="${points}" stroke="#356bee" stroke-width="2.5" fill="none" vector-effect="non-scaling-stroke"/></svg><div class="trend-labels"><span>${esc(history[0].date)}</span><span>${esc(history[count-1].date)}</span></div>`;
    }
    return `<div class="card chart-card"><div class="section-head"><h2>计入资产的变化</h2><span class="chip gray">${count} 天记录</span></div><strong style="font-size:28px">${hasAssets()?yuan(C.totals(state).total):'—'}</strong>${chart}</div><p class="footnote">从首次使用本 App 开始记录，每天保留最近一次同步。曲线是资产余额变化，含价格涨跌，不等同于净存入金额。历史快照暂保存在这台设备。</p>`;
  }
  function taskRow(t, inLibrary=false) {
    const overdue=t.deadline&&!t.done&&C.dateDay(t.deadline)<C.dateDay(C.today());
    return `<div class="task-row ${t.done?'done':''}"><button class="task-check" data-action="toggle-task" data-id="${esc(t.id)}" aria-label="${t.done?'恢复':'完成'}${esc(t.text)}" aria-pressed="${!!t.done}">${t.done?icon('check'):''}</button><button class="task-content" data-action="edit-task" data-id="${esc(t.id)}"><span class="task-text">${esc(t.text)}</span>${inLibrary?`<small class="task-meta ${overdue?'overdue':''}">${t.done?'已完成':t.deadline?`${overdue?'已逾期 · ':''}${esc(t.deadline)}`:'未安排日期'}</small>`:''}</button><button class="task-more" data-action="edit-task" data-id="${esc(t.id)}" aria-label="编辑${esc(t.text)}">${icon('arrow')}</button></div>`;
  }
  function dateHeading(date) {
    const day=C.dateDay(date), today=C.dateDay(C.today()), d=new Date(day*86400000);
    const dateLabel=`${d.getUTCFullYear()!==new Date().getFullYear()?`${d.getUTCFullYear()}年`:''}${d.getUTCMonth()+1}月${d.getUTCDate()}日`;
    const label=day===today?'今天':day===today+1?'明天':day<today?'已逾期':dateLabel;
    return `<div class="todo-group-head"><h2>${label}</h2><span>${day<today?`${dateLabel} · `:''}${['周日','周一','周二','周三','周四','周五','周六'][d.getUTCDay()]}</span></div>`;
  }
  function taskGroup(label, tasks, key, inLibrary=false) {
    return `<section class="todo-group" data-group="${esc(key)}"><div class="todo-group-head"><h2>${label}</h2><span>${tasks.length}</span></div><div class="todo-group-card">${tasks.map(t=>taskRow(t,inLibrary)).join('')}</div></section>`;
  }
  function todosView() {
    const dated=state.tasks.filter(t=>!t.done&&Number.isFinite(C.dateDay(t.deadline))).slice().sort((a,b)=>C.dateDay(a.deadline)-C.dateDay(b.deadline));
    const dates=[...new Set(dated.map(t=>t.deadline))];
    const completed=pageOption('todos','completed')?state.tasks.filter(t=>t.done).slice().reverse():[];
    const actions=`<div class="todo-actions"><button class="icon-btn" aria-label="添加待办" data-action="add-task">${icon('plus')}</button><button class="icon-btn" aria-label="待办库" data-action="nav" data-page="todo-library">${icon('archive')}</button><button class="icon-btn" aria-label="待办页面设置" data-action="page-settings" data-id="todos">${icon('settings')}</button></div>`;
    return title('','待办','',actions)+
      (dated.length?dates.map(date=>`<section class="todo-group" data-date="${esc(date)}">${dateHeading(date)}<div class="todo-group-card">${dated.filter(t=>t.deadline===date).map(t=>taskRow(t)).join('')}</div></section>`).join(''):emptyCard('没有待完成的日程','给待办设置日期后，会按日期显示在这里。','add-task','添加待办','check'))+
      (completed.length?taskGroup('已完成',completed,'completed',true):'');
  }
  function todoLibraryView() {
    const open=state.tasks.filter(t=>!t.done), undated=open.filter(t=>!Number.isFinite(C.dateDay(t.deadline))).slice().reverse();
    const planned=open.filter(t=>Number.isFinite(C.dateDay(t.deadline))).slice().sort((a,b)=>C.dateDay(a.deadline)-C.dateDay(b.deadline));
    const completed=state.tasks.filter(t=>t.done).slice().reverse();
    return `<button class="back-link" data-action="nav" data-page="todos">${icon('arrow')}待办</button>`+title('','待办库','',`<button class="icon-btn" aria-label="添加待办" data-action="add-task">${icon('plus')}</button>`)+
      (undated.length?taskGroup('未安排',undated,'undated',true):'')+
      (planned.length?taskGroup('已安排',planned,'planned',true):'')+
      (completed.length?taskGroup('已完成',completed,'completed',true):'')+
      (!state.tasks.length?emptyCard('待办库还是空的','','add-task','添加待办','archive'):'');
  }
  function settingsView() {
    return title('','设置','管理每个页面显示的内容。') +
      `<section class="settings-section"><h2>页面</h2><div class="settings-group"><button class="settings-row" data-action="page-settings" data-id="wealth"><span class="row-glyph">${icon('wallet')}</span><div><h3>资产页面</h3><p>概览、账户、趋势、长期目标、资产配置</p></div>${icon('arrow')}</button><button class="settings-row" data-action="page-settings" data-id="todos"><span class="row-glyph">${icon('list')}</span><div><h3>待办页面</h3><p>已完成事项</p></div>${icon('arrow')}</button></div></section>` +
      `<section class="settings-section"><h2>连接与数据</h2><div class="settings-group"><button class="settings-row" data-action="nav" data-page="connections"><span class="row-glyph">${icon('sync')}</span><div><h3>连接管理</h3><p>${connected?'已连接小青账 · 管理外部服务':'管理小青账与其他外部服务'}</p></div>${icon('arrow')}</button></div></section>` +
      `<section class="settings-section"><h2>应用</h2><div class="settings-group"><button class="settings-row" data-action="check-update"><span class="row-glyph">${icon('sync')}</span><div><h3>检查更新</h3></div>${icon('arrow')}</button></div></section>`;
  }
  function versionParts(value) {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value || ''));
    return match ? match.slice(1).map(Number) : null;
  }
  function newerVersion(latest, current) {
    const a = versionParts(latest), b = versionParts(current);
    if (!a || !b) return false;
    return a.some((part, i) => part > b[i] && a.slice(0, i).every((value, j) => value === b[j]));
  }
  async function checkUpdate() {
    openSheet('检查更新','<div class="update-status">正在检查…</div>');
    const status = overlay.querySelector('.update-status');
    try {
      const result = await call('checkUpdate');
      if (!status.isConnected) return;
      if (!result.ok) { status.textContent = result.error || '检查更新失败'; return; }
      const current = esc(result.currentVersion || '');
      if (!result.published) { status.innerHTML = `<strong>暂无已发布版本</strong><span>当前版本 ${current}</span>`; return; }
      const latest = esc(result.latestVersion);
      const newer = Number.isInteger(result.latestCode) && Number.isInteger(result.currentCode)
        ? result.latestCode > result.currentCode : newerVersion(result.latestVersion, result.currentVersion);
      status.innerHTML = `<strong>${newer ? '发现新版本' : '已是最新版本'}</strong><span>当前 ${current} · 最新 ${latest}</span>${newer ? `<button class="primary full" data-action="open-update" data-url="${esc(result.url)}">查看更新</button>` : ''}`;
    } catch (error) { if (status.isConnected) status.textContent = error.message || '检查更新失败'; }
  }
  function connectionsView() {
    return `<button class="back-link" data-action="nav" data-page="settings">${icon('arrow')}设置</button>` + title('','连接管理','集中管理与外部服务的数据连接。') +
      `<section class="settings-section"><h2>已支持的服务</h2><div class="settings-group"><button class="settings-row" data-action="nav" data-page="xiaoqing"><div><h3>小青账</h3><p>${connected?`已连接 · 最近同步 ${syncLabel()}`:'未连接 · 读取资产账户'}</p></div>${icon('arrow')}</button></div><p class="settings-note">以后接入其他服务时，会在这里分别管理。</p></section>`;
  }
  function xiaoqingView() {
    return `<button class="back-link" data-action="nav" data-page="connections">${icon('arrow')}连接管理</button>` + title('','小青账','只读同步资产账户。') +
      `<section class="settings-section"><h2>连接状态</h2><div class="settings-group"><div class="settings-toggle-row"><div><h3>${connected?'已连接':'未连接'}</h3><p>${connected?`最近同步 ${syncLabel()}`:'连接后可将资产账户用于统计与目标进度'}</p></div><span class="chip ${connected?'green':'gray'}">${connected?'已连接':'未连接'}</span></div>${connected?`<button class="settings-row" data-action="sync"><div><h3>同步资产</h3><p>读取小青账最新账户余额</p></div>${icon('sync')}</button><button class="settings-row" data-action="login"><div><h3>重新登录</h3><p>更新连接凭证</p></div>${icon('arrow')}</button><button class="settings-row danger" data-action="logout-confirm"><div><h3>断开连接</h3><p>清除令牌与同步缓存，保留目标和待办</p></div>${icon('arrow')}</button>`:`<button class="settings-row" data-action="login"><div><h3>连接小青账</h3><p>使用手机号和密码登录</p></div>${icon('arrow')}</button>`}</div></section>`;
  }
  function optionRows(id, pageName) {
    return C.PAGE_OPTIONS[id].map(option => `<div class="settings-toggle-row"><div><h3>${option.name}</h3></div><button class="switch ${pageOption(id,option.id)?'on':''}" role="switch" aria-checked="${pageOption(id,option.id)}" aria-label="在${pageName}页面显示${option.name}" data-action="toggle-page-option" data-module="${id}" data-option="${option.id}"><i></i></button></div>`).join('');
  }
  function moduleSettingsView() {
    const id=moduleSettingsId==='todos'?'todos':'wealth', name=id==='todos'?'待办':'资产';
    const detail=id==='wealth'?`<section class="settings-section"><h2>长期目标详情</h2><div class="settings-group">${optionRows('goals','长期目标')}</div></section><section class="settings-section"><h2>资产配置详情</h2><div class="settings-group">${optionRows('allocation','资产配置')}</div></section>`:'';
    return `<button class="back-link" data-action="nav" data-page="settings">${icon('arrow')}设置</button>` + title('',name+'页面','选择这个页面要显示的模块。') +
      `<section class="settings-section"><h2>页面模块</h2><div class="settings-group">${optionRows(id,name)}</div></section>`+detail;
  }
  function openSheet(titleText, body) {
    overlay.innerHTML = `<div class="backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(titleText)}"><div class="handle"></div><div class="sheet-head"><h2>${esc(titleText)}</h2><button class="icon-btn" aria-label="关闭" data-action="close">${icon('close')}</button></div>${body}</section></div>`;
    document.body.style.overflow='hidden';
    setTimeout(()=>overlay.querySelector('input:not([type="date"]):not([type="checkbox"])')?.focus(),160);
  }
  function closeSheet() { overlay.innerHTML=''; document.body.style.overflow=''; }
  function formError(text) { const el=overlay.querySelector('.form-error'); if(el)el.textContent=text; else toast(text); }
  function taskForm(id) {
    const task=state.tasks.find(t=>t.id===id);
    openSheet(task?'编辑待办':'添加待办',`<form data-form="task" ${task?`data-id="${esc(task.id)}"`:''}><label class="form-field"><span>待办内容</span><input name="text" maxlength="140" value="${esc(task?.text||'')}" placeholder="要做的事" required></label><label class="form-field"><span>待完成日期</span><input name="deadline" type="date" value="${esc(task?.deadline||'')}"></label><div class="form-error" role="alert"></div><button class="primary full" type="submit">${task?'保存修改':'添加待办'}</button></form>${task?`<button class="task-delete-action" data-action="delete-task" data-id="${esc(task.id)}">删除待办</button>`:''}`);
  }
  function goalForm(id) {
    const g=state.goals.find(g=>g.id===id), date=new Date();date.setFullYear(date.getFullYear()+1);
    openSheet(g?'编辑目标':'给未来起个名字',`<form data-form="goal" data-id="${esc(id||'')}"><label class="form-field"><span>目标名称</span><input name="name" maxlength="40" placeholder="例如：攒下第一笔底气" value="${esc(g?.name||'')}" required></label><label class="form-field"><span>目标金额 · 人民币</span><input name="amount" type="number" inputmode="decimal" min="0.01" max="1000000000000" step="0.01" placeholder="200000" value="${g?.amount||''}" required></label><label class="form-field"><span>截止日期</span><input name="deadline" type="date" value="${esc(g?.deadline||C.today(date))}" required></label><label class="form-field"><span>用哪部分资产计算进度</span><select name="scope"><option value="all">全部计入资产</option>${C.categories(state).map(c=>`<option value="${c.id}" ${g?.scope===c.id?'selected':''}>只看${esc(c.name)}</option>`).join('')}</select><small>按小青账“不计入”标签排除账户。多个目标可以共享同一份资产。</small></label><div class="form-error" role="alert"></div><button class="primary full" type="submit">${g?'保存目标':'开始靠近目标'}</button>${g?'<button type="button" class="text-btn danger full" data-action="delete-goal-confirm" data-id="'+esc(id)+'">删除这个目标</button>':''}</form>`);
  }
  function goalDetail(id) {
    const g=state.goals.find(g=>g.id===id);if(!g)return;
    const m=C.goalMetrics(state,g);
    openSheet(g.name,goalCard(g,true)+`<div class="goal-detail-stats"><div><span>距离目标还差</span><strong>${hasAssets()?yuan(m.remaining):'—'}</strong></div><div><span>${m.overdue?'已经逾期':'距离截止日期'}</span><strong>${Math.abs(m.days)} 天</strong></div>${pageOption('goals','monthly')?`<div><span>平均每月还需</span><strong>${!hasAssets()?'—':m.monthly==null?'需重新规划':yuan(m.monthly)}</strong></div>`:''}${pageOption('goals','forecast')?`<div><span>预计达成日期</span><strong style="font-size:16px">${m.complete?'目标已达成':m.estimate||'数据积累中'}</strong></div>`:''}</div>${hint(!hasAssets()?'连接小青账或添加资产后，计算剩余金额和进度。':m.complete?'恭喜，这个目标已经达成。可以继续积累，也可以为下一程起个名字。':`${m.ahead>=0?'领先':'落后'}当前基准的线性计划 ${yuan(Math.abs(m.ahead))}。${pageOption('goals','forecast')?'<br>预计日期需要最近 30 天内至少跨越 7 天的快照和正向资产变化速度；它不是收益承诺。':''}`)}<button class="primary full" data-action="edit-goal" data-id="${esc(id)}">${icon('edit')}编辑目标</button>`);
  }
  function allocationForm() {
    openSheet('资产配置目标',`<form data-form="allocation"><label class="form-field"><span>目标方式</span><select name="mode" id="allocation-mode"><option value="percent" ${state.allocationMode==='percent'?'selected':''}>比例目标 · 随当前总资产变化</option><option value="amount" ${state.allocationMode==='amount'?'selected':''}>金额目标 · 固定金额</option></select></label>${C.categories(state).map(c=>`<div class="allocation-input-row"><label for="alloc-${c.id}"><i class="dot" style="background:${c.color}"></i>${esc(c.name)}</label><input id="alloc-${c.id}" name="${c.id}" type="number" min="0" step="0.01" value="${state.allocationTargets[c.id]}" required><span class="unit">${state.allocationMode==='percent'?'%':'元'}</span></div>`).join('')}<p class="footnote" id="allocation-help">${state.allocationMode==='percent'?'比例目标合计需为 100%。':'金额目标独立于总资产变化。'}</p><div class="form-error" role="alert"></div><div class="form-actions"><button class="primary" type="submit">保存配置目标</button></div></form>`);
  }
  function loginSheet() {
    openSheet(connected?'小青账账户':'连接小青账',`${hint('手机号 + 密码登录。密码只用于本次登录，不会保存。会话令牌由系统密钥库加密，资产只读同步。')}${!native?'<div class="warning-note">当前为浏览器预览，不能登录真实账户。请在安装好的安卓 App 中使用。</div>':''}<form data-form="login"><label class="form-field"><span>手机号</span><input name="phone" type="tel" inputmode="tel" autocomplete="username" maxlength="20" placeholder="小青账登录手机号" required></label><label class="form-field"><span>密码</span><input name="password" type="password" autocomplete="current-password" placeholder="输入小青账密码" required></label><div class="form-error" role="alert"></div><button class="primary full" type="submit" ${busy?'disabled':''}>${busy?'正在连接…':'登录并同步资产'}</button></form>`);
  }
  async function sync() {
    if (state.demo) {toast('示例模式不会同步真实账户，请先退出示例');return;}
    if (!connected) {navigate('xiaoqing');return;}
    if(busy)return;busy=true;render();
    try { const result=await call('sync');applySync(result); }
    catch(e){toast(e.message);}finally{busy=false;render();}
  }
  function applySync(result) {
    if(!result.ok){if(result.expired)connected=false;if(result.connected)connected=true;throw new Error(result.error||'同步未完成');}
    state.assets=state.assets.filter(a=>a.source==='manual').concat(result.accounts||[]);
    state.lastSync=new Date(result.syncedAt).toISOString();connected=true;
    initializeBaselines();C.recordSnapshot(state);save();toast(`同步完成，已读取 ${(result.accounts||[]).length} 个资产账户`);
  }
  function initializeBaselines(){for(const g of state.goals)if(g.baselinePending){g.baseline=C.goalValue(state,g);g.createdDate=C.today();g.baselinePending=false;}}
  function rebaseCategoryGoals(){for(const g of state.goals)if(g.scope&&g.scope!=='all'){g.baseline=C.goalValue(state,g);g.createdDate=C.today();g.baselinePending=!hasAssets();}}
  function manualAssetForm(id) {
    const a=state.assets.find(a=>a.code===id&&a.source==='manual');
    openSheet(a?'编辑手动账户':'添加手动账户',`<form data-form="manual" data-id="${esc(a?.code||'')}">${hint('手动账户独立于小青账同步。避免把已同步账户再次手动添加，否则会重复计算。')}<label class="form-field"><span>账户名称</span><input name="name" maxlength="40" value="${esc(a?.name||'')}" required></label><label class="form-field"><span>当前余额 · 人民币</span><input name="balance" type="number" inputmode="decimal" step="0.01" max="1000000000000" min="-1000000000000" value="${a?.balance??''}" required><small>负债填写负数，余额可随时手动更新。</small></label><label class="form-field"><span>资产类别</span><select name="category">${C.categories(state).map(c=>`<option value="${c.id}" ${a&&C.category(state,a)===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><label class="checkbox-label"><input type="checkbox" name="exclude" ${a?.reckonIn?'checked':''}>不计入目标</label><div class="form-error" role="alert"></div><button class="primary full" type="submit">保存账户</button>${a?`<button type="button" class="text-btn danger full" data-action="delete-manual-confirm" data-id="${esc(a.code)}">删除手动账户</button>`:''}</form>`);
  }
  function categoryList() {
    openSheet('管理资产类别',hint('股票、债券、现金之外，也可以添加黄金、基金等自己的类别。改名不会改变账户归属。')+
      C.categories(state).map(c=>`<button class="settings-row" data-action="category-edit" data-id="${esc(c.id)}"><h3><i class="dot" style="background:${c.color};margin-right:9px"></i>${esc(c.name)}</h3>${icon('edit')}</button>`).join('')+
      '<button class="secondary full" style="margin-top:20px" data-action="category-edit">＋ 新增类别</button>');
  }
  function categoryForm(id) {
    const c=C.categories(state).find(c=>c.id===id);
    openSheet(c?'编辑资产类别':'新的资产类别',`<form data-form="category" data-id="${esc(c?.id||'')}"><label class="form-field"><span>类别名称</span><input name="name" maxlength="12" value="${esc(c?.name||'')}" placeholder="例如：黄金" required></label><label class="form-field"><span>标记颜色</span><input name="color" type="color" value="${c?.color||'#b89356'}"></label><div class="form-error" role="alert"></div><button class="primary full" type="submit">保存类别</button>${c&&c.id!=='other'?'<button class="text-btn danger full" type="button" data-action="category-delete-confirm" data-id="'+esc(c.id)+'">删除类别</button>':''}</form>`);
  }
  function confirm(titleText, message, action, id) {
    openSheet(titleText,`<p class="footnote" style="font-size:13px;margin:0 0 24px">${message}</p><div class="form-actions"><button class="secondary" data-action="close">取消</button><button class="primary" data-action="${action}" data-id="${esc(id||'')}">确认</button></div>`);
  }
  function navigate(next) {closeSheet();page=next;render();window.scrollTo(0,0);}
  const handlers = {
    nav:el=>navigate(el.dataset.page), close:closeSheet, connect:()=>navigate('xiaoqing'),
    'check-update':checkUpdate,
    'open-update':async el=>{const result=await call('openUpdate',{url:el.dataset.url});if(!result.ok)toast(result.error||'无法打开更新页面');},
    'open-modules':()=>navigate('settings'), 'add-goal':()=>goalForm(), 'edit-goal':el=>goalForm(el.dataset.id),
    'goal-detail':el=>goalDetail(el.dataset.id), 'assets-allocation':()=>navigate('allocation'),
    'wealth-tab':el=>{wealthTab=el.dataset.tab;render();}, 'allocation-edit':allocationForm, login:loginSheet,sync,
    'manual-asset':el=>manualAssetForm(el.dataset.id),
    categories:categoryList,'category-edit':el=>categoryForm(el.dataset.id),
    'category-delete-confirm':el=>{
      if(state.goals.some(g=>g.scope===el.dataset.id)){toast('请先调整使用该类别的长期目标');return;}
      confirm('删除资产类别？','关联账户会归入“其他”，配置目标也会转入“其他”；不会删除资产。','category-delete',el.dataset.id);
    },
    'category-delete':el=>{
      const id=el.dataset.id;if(id==='other')return;
      state.categories=state.categories.filter(c=>c.id!==id);
      for(const code of Object.keys(state.categoryMap))if(state.categoryMap[code]===id)state.categoryMap[code]='other';
      state.allocationTargets.other=Number(state.allocationTargets.other||0)+Number(state.allocationTargets[id]||0);
      delete state.allocationTargets[id];rebaseCategoryGoals();C.recordSnapshot(state);save();categoryList();render();
    },
    'delete-goal-confirm':el=>confirm('删除目标？','只删除目标设置，不会影响资产或小青账数据。','delete-goal',el.dataset.id),
    'delete-goal':el=>{state.goals=state.goals.filter(g=>g.id!==el.dataset.id);save();closeSheet();render();toast('目标已删除');},
    'delete-manual-confirm':el=>confirm('删除手动账户？','该账户的余额将不再计入目标；不会修改小青账。','delete-manual',el.dataset.id),
    'delete-manual':el=>{state.assets=state.assets.filter(a=>a.code!==el.dataset.id);delete state.categoryMap[el.dataset.id];C.recordSnapshot(state);save();closeSheet();render();},
    'toggle-page-option':el=>{const moduleId=el.dataset.module, optionId=el.dataset.option;if(!C.PAGE_OPTIONS[moduleId]?.some(o=>o.id===optionId))return;state.pageOptions[moduleId][optionId]=!pageOption(moduleId,optionId);save();render();},
    'page-settings':el=>{moduleSettingsId=el.dataset.id;navigate('module-settings');},
    'open-accounts':()=>{wealthTab='accounts';navigate('wealth');},
    'open-trend':()=>{wealthTab='trend';navigate('wealth');},
    'add-task':()=>taskForm(), 'edit-task':el=>taskForm(el.dataset.id),
    'toggle-task':el=>{const t=state.tasks.find(t=>t.id===el.dataset.id);if(!t)return;t.done=!t.done;save();render();toast(t.done?'已完成':'已恢复');},
    'delete-task':el=>confirm('删除这条待办？','删除后无法恢复。','delete-task-now',el.dataset.id),
    'delete-task-now':el=>{state.tasks=state.tasks.filter(t=>t.id!==el.dataset.id);save();closeSheet();render();},
    rename:()=>openSheet('给这个空间起个名字',`<form data-form="rename"><label class="form-field"><span>应用内名称</span><input name="name" maxlength="12" value="${esc(state.name)}" required><small>修改界面里的名称，不影响桌面图标名称。</small></label><div class="form-error" role="alert"></div><button class="primary full" type="submit">保存名称</button></form>`),
    'logout-confirm':()=>confirm('断开小青账？','清除这台设备的登录令牌、同步资产和快照。保留目标、资产分类与待办。','logout'),
    logout:async()=>{const r=await call('logout');if(!r.ok){toast(r.error);return;}connected=false;state.assets=state.assets.filter(a=>a.source==='manual');state.history=[];state.lastSync=null;if(state.assets.length)C.recordSnapshot(state);save();closeSheet();render();toast('已断开连接');}
  };
  document.addEventListener('click',e=>{if(e.target.classList.contains('backdrop')){closeSheet();return;}const el=e.target.closest('[data-action]');if(!el||el.disabled)return;const handler=handlers[el.dataset.action];if(handler)Promise.resolve(handler(el)).catch(err=>toast(err.message||'操作未完成，请重试'));});
  document.addEventListener('change',e=>{
    if(e.target.dataset.categoryCode){state.categoryMap[e.target.dataset.categoryCode]=e.target.value;rebaseCategoryGoals();C.recordSnapshot(state);save();render();toast('账户分类已保存');}
    if(e.target.id==='allocation-mode'){overlay.querySelectorAll('.unit').forEach(el=>el.textContent=e.target.value==='percent'?'%':'元');overlay.querySelector('#allocation-help').textContent=e.target.value==='percent'?'比例目标合计需为 100%。':'金额目标独立于总资产变化。';}
  });
  document.addEventListener('submit',async e=>{
    const form=e.target;if(!form.dataset.form)return;e.preventDefault();const data=Object.fromEntries(new FormData(form)),type=form.dataset.form;
    if(type==='goal'){
      const error=C.validateGoal(data);if(error){formError(error);return;}
      const old=state.goals.find(g=>g.id===form.dataset.id), g=Object.assign({},old||{},data,{name:data.name.trim(),amount:Number(data.amount),id:old?.id||uid()});
      if(!old||old.scope!==g.scope){g.createdDate=C.today();g.baseline=C.goalValue(state,g);g.baselinePending=!hasAssets();}
      state.goals=state.goals.filter(x=>x.id!==g.id).concat(g);save();closeSheet();render();toast('目标已保存');
    }else if(type==='allocation'){
      const targets=Object.fromEntries(C.categories(state).map(c=>[c.id,Number(data[c.id])]));const error=C.validateAllocation(data.mode,targets,C.categories(state));if(error){formError(error);return;}
      state.allocationMode=data.mode;state.allocationTargets=targets;save();closeSheet();render();toast('配置目标已保存');
    }else if(type==='manual'){
      if(!data.name.trim()||!Number.isFinite(Number(data.balance))||Math.abs(Number(data.balance))>1e12){formError('请填写账户名称和有效余额');return;}
      const id=form.dataset.id||'manual-'+uid(),a={code:id,name:data.name.trim(),balance:C.round(Number(data.balance)),currency:'RMB',reckonIn:data.exclude==='on',source:'manual',type:'other',liabilities:Number(data.balance)<0};
      state.assets=state.assets.filter(x=>x.code!==id).concat(a);state.categoryMap[id]=data.category;initializeBaselines();C.recordSnapshot(state);save();closeSheet();render();toast('手动账户已保存');
    }else if(type==='task'){
      if(!data.text.trim()){formError('请填写待办内容');return;}
      if(data.deadline&&!Number.isFinite(C.dateDay(data.deadline))){formError('请选择有效日期');return;}
      const task=state.tasks.find(t=>t.id===form.dataset.id);
      if(task){task.text=data.text.trim();task.deadline=data.deadline;}else state.tasks.push({id:uid(),text:data.text.trim(),deadline:data.deadline,done:false});
      save();closeSheet();render();toast(task?'已保存':'已添加');
    }else if(type==='rename'){
      if(!data.name.trim()){formError('名称不能为空');return;}state.name=data.name.trim();save();closeSheet();render();
    }else if(type==='category'){
      if(!data.name.trim()||!/^#[0-9a-fA-F]{6}$/.test(data.color)){formError('请填写名称并选择颜色');return;}
      const id=form.dataset.id||'cat_'+uid();
      if(state.categories.some(c=>c.id!==id&&c.name===data.name.trim())){formError('已有同名类别');return;}
      const cat={id,name:data.name.trim(),color:data.color};
      const idx=state.categories.findIndex(c=>c.id===id);if(idx>=0)state.categories[idx]=cat;else state.categories.push(cat);
      if(state.allocationTargets[id]==null)state.allocationTargets[id]=0;
      save();categoryList();render();toast('资产类别已保存');
    }else if(type==='login'){
      if(state.demo){formError('请先退出示例模式，再连接真实账户');return;}
      if(busy)return;busy=true;const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='正在登录并读取资产…';
      try{const result=await call('login',{phone:data.phone,password:data.password});form.querySelector('[name="password"]').value='';data.password='';applySync(result);closeSheet();}
      catch(err){formError(err.message);}
      finally{busy=false;if(button.isConnected){button.disabled=false;button.textContent='登录并同步资产';}render();}
    }
  });
  window.hubBack=()=>{if(overlay.innerHTML){closeSheet();return true;}if(page==='xiaoqing'){navigate('connections');return true;}if(page==='connections'||page==='module-settings'){navigate('settings');return true;}if(page==='todo-library'){navigate('todos');return true;}if(page!=='home'){navigate('home');return true;}return false;};
  // Small explicit interface for browser QA, never exposes native credentials.
  window.shiji={get state(){return state;}, setState:s=>{state=C.migrate(s);render();},render,navigate,openGoal:goalForm};
  call('load').then(result=>{if(result.ok){state=C.migrate(result.state);connected=!!result.connected;}else toast(result.error);render();if(connected&&(!state.lastSync||Date.now()-new Date(state.lastSync).getTime()>900000))sync();}).catch(()=>{render();toast('读取本地数据失败，请重新打开 App');});
})();
