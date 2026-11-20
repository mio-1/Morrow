(function () {
  'use strict';
  const C = window.HubCore, app = document.getElementById('app'), overlay = document.getElementById('overlay');
  const native = !!window.NativeHub, pending = new Map();
  let state = C.empty(), page = 'home', navRoot='home', navHistory=[], goalFilter='all', connected = false, busy = false, toastTimer, nextId = 0, datePicker = null, sortState=null, swipeState=null, longPressState=null, colorDrag=null, suppressSwipeClick=false;
  let updateState={status:'idle',current:'0.1.10',latest:''}, downloadSession=null;
  const paths = {
    home:'M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
    flag:'M5 22V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0',
    star:'M12 2l3.1 6.3 7 .9-5.1 5 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5.1-5 7-.9z',
    pie:'M21 12a9 9 0 1 1-9-9v9zm-5-9a9 9 0 0 1 5 5h-5z',
    grid:'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',
    assets:'M4 20v-6h4v6m2 0V9h4v11m2 0V4h4v16M3 20h18',
    wallet:'M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h16v11H5a3 3 0 0 1-3-3V6m19 7h-5v4h5',
    check:'M5 12l4 4L20 5', list:'M8 6h13M8 12h13M8 18h13M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2', plus:'M12 5v14M5 12h14', close:'M6 6l12 12M18 6L6 18',
    arrow:'M9 5l7 7-7 7', sync:'M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5m-4 9a8 8 0 0 0 14 2l3-3m0 5v-5h-5',
    settings:'M12 3.5l1.2 1.9 2.2.4 1.7-1.3 2.1 2.1-1.3 1.7.4 2.2 1.9 1.2-1.9 1.2-.4 2.2 1.3 1.7-2.1 2.1-1.7-1.3-2.2.4-1.2 1.9-1.2-1.9-2.2-.4-1.7 1.3-2.1-2.1 1.3-1.7-.4-2.2-1.9-1.2 1.9-1.2.4-2.2-1.3-1.7 2.1-2.1 1.7 1.3 2.2-.4zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    trend:'M3 18l6-6 4 3 8-10m-6 0h6v6', calendar:'M4 5h16v16H4zM8 3v4m8-4v4M4 10h16',
    leaf:'M20 3C6 2 1 8 5 15c7 7 15-1 15-12zM5 21l10-12',
    trash:'M3 6h18M9 3h6m-10 3 1 15h12l1-15M10 10v7m4-7v7', archive:'M3 5h18v4H3zM5 9v11h14V9M10 13h4',
    lock:'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4', edit:'M14 5l5 5M3 21l5-1L21 7l-5-5L3 15z',
    clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 4v5l4 2'
  };
  function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.grid}"/></svg>`; }
  const BANKS = [
    ['icbc','工商银行',/工商银行|工行|ICBC/i],['ccb','建设银行',/建设银行|建行|CCB/i],
    ['abc','农业银行',/农业银行|农行|ABC/i],['boc','中国银行',/中国银行|中行|BOC/i],
    ['cmb','招商银行',/招商银行|招行|CMB(?!C)/i],['bcm','交通银行',/交通银行|交行|BOCOM/i],
    ['psbc','邮储银行',/邮政储蓄|邮储银行|邮储|PSBC/i],['citic','中信银行',/中信银行|CITIC/i],
    ['ceb','光大银行',/光大银行|CEB/i],['cmbc','民生银行',/民生银行|CMBC/i],
    ['cib','兴业银行',/兴业银行|CIB/i],['spdb','浦发银行',/浦发银行|上海浦东发展银行|SPDB/i],
    ['pab','平安银行',/平安银行/i],['cgb','广发银行',/广发银行|广发|CGB/i],
    ['hxb','华夏银行',/华夏银行/i],['czb','浙商银行',/浙商银行/i],['jsb','江苏银行',/江苏银行|BANK OF JIANGSU|JSBC?/i],
    ['bob','北京银行',/北京银行/i],['bos','上海银行',/上海银行/i]
  ];
  function bankFor(a) { const name=[a.bankName,a.sourceName,a.name].filter(Boolean).join(' ');return BANKS.find(([, ,pattern])=>pattern.test(name)); }
  function accountBadge(a) { const bank=bankFor(a);return bank?`<img src="bank-logos/${bank[0]}.png" alt="" loading="lazy">`:icon('wallet'); }
  function bankCardType(a) {
    const source=[a.type,a.sourceName,a.name].filter(Boolean).join(' ');
    if(/信用卡|贷记卡|credit[ _-]?card|\bcredit\b/i.test(source))return '信用卡';
    if(/借记卡|储蓄卡|debit[ _-]?card|\bdebit\b/i.test(source))return '借记卡';
    return '';
  }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function money(n, decimals = 0) { return Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); }
  function yuan(n) { return '¥' + money(n); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function hint(text) { return `<div class="hint-box">${text}</div>`; }
  function dateField(label, value, required=false) {
    return `<div class="form-field"><span>${label}</span><input type="hidden" name="deadline" value="${esc(value||'')}"><button type="button" class="date-field-button" data-action="pick-date" data-required="${required}" aria-label="选择${label}"><span>${value?esc(value):'选择日期'}</span>${icon('calendar')}</button></div>`;
  }
  function call(action, args = {}, options = {}) {
    if (!native) {
      if (action === 'load') return Promise.resolve({ ok:true, state:JSON.parse(localStorage.getItem('shiji-state') || '{}'), connected:false });
      if (action === 'save') { localStorage.setItem('shiji-state', JSON.stringify(args.state)); return Promise.resolve({ ok:true }); }
      return Promise.resolve({ ok:false, error:'浏览器仅供界面预览，请安装 APK 后登录同步。' });
    }
    return new Promise((resolve, reject) => {
      const id = String(++nextId), timer = setTimeout(() => { pending.delete(id); reject(new Error('操作超时，请稍后重试')); }, action==='downloadUpdate'?300000:55000);
      pending.set(id, { resolve, timer, progress:options.progress });
      if(options.onStart)options.onStart(id);
      window.NativeHub.call(id, action, JSON.stringify(args));
    });
  }
  window.onNativeResult = (id, result) => { const p = pending.get(id); if (p) { clearTimeout(p.timer); pending.delete(id); p.resolve(result); } };
  window.onNativeProgress = (id, loaded, total) => { const p=pending.get(id);if(p?.progress)p.progress(loaded,total); };
  let saveQueued=false, saveScheduled=false, saveInProgress=false;
  async function persist() {
    saveScheduled=false;
    if(saveInProgress)return;
    saveInProgress=true;
    while(saveQueued){
      saveQueued=false;
      const snapshot=JSON.parse(JSON.stringify(state));
      try {
        const result=await call('save',{state:snapshot});
        if(!result.ok)toast(result.error||'保存失败，请重试');
      } catch(e){toast('本地保存未完成，请重试');}
    }
    saveInProgress=false;
  }
  function save() {
    if(state.demo)return;
    saveQueued=true;
    if(!saveInProgress&&!saveScheduled){saveScheduled=true;queueMicrotask(persist);}
  }
  function toast(text) { const el = document.getElementById('toast'); el.textContent = text; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3600); }
  function emptyCard(title, text, action, label, type = 'flag') {
    return `<div class="card empty"><div class="empty-icon">${icon(type)}</div><h3>${title}</h3><p>${text}</p>${action ? `<button class="primary" data-action="${action}">${icon('plus')}${label}</button>` : ''}</div>`;
  }
  function pageOption(moduleId, optionId) { return moduleId==='todos' ? state.pageOptions?.todos?.[optionId] !== false : true; }
  function hasAssets() { return state.assets.length > 0 || !!state.lastSync; }
  function syncLabel() {
    if (!state.lastSync) return '尚未同步';
    const d = new Date(state.lastSync); return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  function render() {
    const tabInfo={home:{id:'home',label:'资产',icon:'assets'},todos:{id:'todos',label:'待办',icon:'list'}};
    const tabs=state.navPages.filter(row=>row.visible!==false).map(row=>tabInfo[row.id]).filter(Boolean).concat({id:'settings',label:'设置',icon:'settings'});
    if(['home','todos'].includes(page)&&!tabs.some(tab=>tab.id===page)){page=tabs[0].id;navRoot=page;navHistory=[];}
    const views = { home:homeView, goals:goalsView, wealth:wealthView, allocation:allocationPage, salary:salaryDetailView, settings:settingsView, 'menu-manager':menuManagerView, connections:connectionsView, xiaoqing:xiaoqingView, todos:todosView, 'todo-library':todoLibraryView };
    app.innerHTML = `<main class="shell">
      ${(views[page] || homeView)()}</main><nav class="bottom-nav" aria-label="主导航" style="grid-template-columns:repeat(${tabs.length},1fr)">${tabs.map(t => { const active=t.id===navRoot; return `<button class="nav-item ${active ? 'active' : ''}" data-action="nav" data-page="${t.id}" ${active ? 'aria-current="page"' : ''}>${icon(t.icon)}<span>${t.label}</span></button>`; }).join('')}</nav>`;
  }
  function title(eyebrow, name, subtitle, button, showBack=false) {
    const back=showBack&&navHistory.length;
    return `<div class="page-title ${back?'has-back navigation-title':''}">${back?`<button class="title-back" data-action="back" aria-label="返回上一级">${icon('arrow')}</button>`:''}<div class="page-heading">${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<h1>${name}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${button || ''}</div>`;
  }
  function homeView() {
    const blocks={
      summary:()=>wealthWidget()+
        homeTrend()+
        salaryWidget()+
        `<section class="section asset-link-section"><button class="settings-row asset-page-link" data-action="open-accounts"><span class="row-glyph">${icon('wallet')}</span><div><h3>账户列表</h3><p>${state.assets.length} 个账户 · 查看余额和分类</p></div>${icon('arrow')}</button></section>`,
      goals:goalsWidget,allocation:allocationWidget
    };
    return title('', '资产', '') +
      C.WEALTH_BLOCKS.map(({id})=>`<div class="wealth-block" data-block="${id}">${blocks[id]()}</div>`).join('');
  }
  function homeTrend() {
    const entries=state.history, change=C.monthChange(state), tone=change>0?'up':change<0?'down':'flat';
    let chart='<div class="overview-trend-empty">同步几天资产后，这里会出现趋势线</div>';
    if(entries.length>1){
      const values=entries.map(e=>e.total),low=Math.min(...values),high=Math.max(...values),span=high-low||1;
      const start=C.dateDay(entries[0].date),days=C.dateDay(entries[entries.length-1].date)-start||1;
      const points=entries.map(e=>({x:((C.dateDay(e.date)-start)/days*300).toFixed(1),y:(70-(e.total-low)/span*52).toFixed(1)}));
      const lines=points.slice(1).map((p,i)=>`<line x1="${points[i].x}" y1="${points[i].y}" x2="${p.x}" y2="${p.y}" stroke="${values[i+1]>values[i]?'#2a9b79':values[i+1]<values[i]?'#e46f72':'#8b9bb3'}" stroke-width="2.7" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`).join('');
      chart=`<svg class="overview-trend-chart" viewBox="0 0 300 88" preserveAspectRatio="none" role="img" aria-label="资产趋势，绿色表示增加，红色表示减少">${lines}</svg><div class="overview-trend-dates"><span>${esc(entries[0].date)}</span><span>${esc(entries[entries.length-1].date)}</span></div>`;
    }
    return `<div class="card overview-trend"><div class="overview-trend-top"><strong>资产趋势</strong><span>本月 <b class="${tone}">${change==null?'—':change>0?'+'+yuan(change):change<0?'−'+yuan(-change):yuan(0)}</b></span></div>${chart}</div>`;
  }
  function wealthWidget() {
    const t=C.totals(state), assets=hasAssets();
    return `<section><div class="hero"><div class="overview-hero-top"><div class="hero-label">总资产</div><div class="overview-sync"><button class="sync ${busy?'busy':''}" data-action="${connected?'sync':'connect'}" ${busy?'disabled':''}>${icon('sync')}${busy?'同步中':connected?'同步资产':'连接账户'}</button><small>${assets?syncLabel():'尚未同步'}</small></div></div><div class="asset-value">${assets?`<span class="currency-symbol">¥</span>${money(t.grossAssets,2)}`:'等待第一笔同步'}</div><div class="overview-metrics"><div><span>净资产</span><strong>${assets?yuan(t.total):'—'}</strong></div><div><span>总负债</span><strong>${assets?yuan(t.liabilities):'—'}</strong></div><div><span>未计入资产</span><strong>${assets?yuan(t.excludedTotal):'—'}</strong></div></div></div>${t.foreign?`<div class="warning-note">${t.foreign} 个外币账户暂未折算，未计入人民币目标，请在小青账核对。</div>`:''}</section>`;
  }
  function goalsWidget() {
    const current=state.goals.find(g=>g.visible!==false);
    return `<section class="section"><div class="section-head"><h2>存钱目标</h2><button class="subtle" data-action="nav" data-page="goals">全部目标${icon('arrow')}</button></div>${current ? goalCard(current,false,true) : emptyCard('设置第一个存钱目标','填写金额和截止日期，进度会随资产更新。','add-goal','新建目标')}</section>`;
  }
  function goalStatus(g) {const m=C.goalMetrics(state,g);return m.complete?'completed':m.overdue?'missed':'active';}
  function goalCard(g, tailored = false, currentMark = false) {
    const m = C.goalMetrics(state,g), tag = m.complete ? '已达成' : m.overdue ? '已逾期' : `剩余 ${m.days} 天`;
    return `<button class="card goal-card ${currentMark?'goal-card-current':''}" data-action="goal-detail" data-id="${esc(g.id)}"><div class="goal-top"><div class="goal-icon">${icon(currentMark?'star':'flag')}</div><div class="goal-title"><h3>${esc(g.name)}</h3><small>${esc(g.deadline)} 截止${currentMark?'<em class="goal-current-label"> · 当前目标</em>':''}</small></div><span class="chip ${m.complete ? 'green' : m.overdue ? 'warn' : 'gray'}">${tag}</span></div>
      <div class="goal-numbers"><strong>${hasAssets() ? yuan(m.current) : '—'}</strong><span>/ ${yuan(g.amount)}</span></div><div class="progress"><i style="width:${hasAssets() ? m.bar : 0}%"></i></div><div class="goal-foot"><b>${hasAssets() ? `${money(m.percent,1)}% 已完成` : '同步资产后计算进度'}</b>${!tailored||pageOption('goals','monthly') ? `<span>${!hasAssets()?'等待资产数据':m.complete ? '这一程，已经抵达' : m.monthly == null ? '需调整截止日期' : `每月还需 ${yuan(m.monthly)}`}</span>` : ''}</div></button>`;
  }
  function allocationWidget() {
    const rows = C.allocation(state), shown=rows.filter(r=>r.statsEnabled!==false), progressRows=shown.filter(r=>r.target>0); let acc = 0;
    const segments = shown.filter(r => r.current > 0).map(r => { const from=acc; acc += r.current; return {r,from}; });
    const positiveTotal = segments.reduce((n,s) => n+s.r.current,0);
    const gradient = positiveTotal ? segments.map(({r,from}) => `${r.color} ${from/positiveTotal*360}deg ${(from+r.current)/positiveTotal*360}deg`).join(',') : '#e8ede5 0deg 360deg';
    const unclassified = state.assets.filter(a => C.included(a) && !state.categoryMap[a.code]).length;
    return `<section class="section"><div class="section-head"><h2>资产配置</h2><button class="subtle" data-action="assets-allocation">查看详情${icon('arrow')}</button></div><div class="card"><div class="allocation-top"><div class="donut" style="--segments:${gradient}"><div class="donut-hole"><strong>${positiveTotal > 0 ? '100%' : '—'}</strong><span>资产配置</span></div></div><div class="allocation-legend">${shown.map(r => `<div class="legend-row"><span class="legend-name"><i class="dot" style="background:${r.color}"></i>${esc(r.name)}</span><b>${money(r.share,1)}%</b></div>`).join('')}</div></div>${progressRows.length?`<div class="allocation-progress-list">${progressRows.map(r=>`<div class="allocation-progress-row"><div class="allocation-progress-meta"><span>${esc(r.name)}</span><b>${money(r.current)} / ${money(r.target)}</b></div><div class="allocation-progress-track"><i style="background:${r.color};width:${r.progress}%"></i></div></div>`).join('')}</div>`:''}${unclassified?`<p class="allocation-note">${unclassified} 个账户尚在“其他”类别</p>`:''}</div></section>`;
  }
  function goalsView() {
    const filtered=goalFilter==='all'?state.goals:state.goals.filter(g=>goalStatus(g)===goalFilter);
    const tabs=[['all','全部'],['active','进行中'],['completed','已达成'],['missed','未达成']];
    return title('','存钱目标','',`<div class="page-actions"><button class="icon-btn" aria-label="新建目标" data-action="add-goal">${icon('plus')}</button></div>`,true) +
      `<div class="goal-filter-tabs" role="tablist" aria-label="目标状态">${tabs.map(([id,label])=>`<button role="tab" aria-selected="${goalFilter===id}" class="${goalFilter===id?'selected':''}" data-action="goal-filter" data-filter="${id}">${label}</button>`).join('')}</div>` +
      (filtered.length ? filtered.map(g=>`<div class="goal-list-item ${g.visible!==false?'is-current':''}" style="--swipe-width:152px" data-sort-type="goal" data-sort-id="${esc(g.id)}"><div class="goal-swipe-actions"><button class="goal-swipe-current" data-action="set-current-goal" data-id="${esc(g.id)}" aria-pressed="${g.visible!==false}" ${g.visible!==false?'disabled':''}>${icon('star')}<span>当前目标</span></button><button class="goal-swipe-delete" aria-label="删除${esc(g.name)}" data-action="delete-goal-confirm" data-id="${esc(g.id)}">${icon('trash')}<span>删除</span></button></div><div class="goal-swipe-content">${goalCard(g,true,g.visible!==false)}</div></div>`).join('') : state.goals.length ? emptyCard('这里还没有目标','','','') : emptyCard('未来的你，会感谢今天','设置目标金额和截止日期，进度会随资产同步更新。','add-goal','创建长期目标'));
  }
  function wealthView() {
    return title('','账户列表','','',true) + accountsView();
  }
  function salaryWidget() {
    const years=C.annualSalary(state),latest=years[years.length-1],width=Math.max(300,40+(years.length-1)*68);
    let chart='<div class="overview-trend-empty">暂无记录</div>';
    if(years.length){
      const max=Math.max(1,...years.map(row=>row.total));
      const points=years.map((row,i)=>({x:years.length===1?width/2:20+i*(width-40)/(years.length-1),y:70-row.total/max*52}));
      const line=points.map((point,i)=>`${i?'L':'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
      const area=`${line} L${points[points.length-1].x.toFixed(1)} 72 L${points[0].x.toFixed(1)} 72 Z`;
      chart=`<div class="salary-chart-scroll"><svg class="salary-chart" viewBox="0 0 ${width} 108" style="min-width:${width}px" preserveAspectRatio="none" role="img" aria-label="逐年工资总额折线图"><path d="M20 72H${width-20}" class="salary-chart-axis"/><path d="${area}" class="salary-chart-area"/><path d="${line}" class="salary-chart-line"/>${points.map((point,i)=>`<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.5" class="salary-chart-dot"/><text x="${point.x.toFixed(1)}" y="101" text-anchor="middle">${years[i].year}</text>`).join('')}</svg></div>`;
    }
    return `<button class="card salary-trend" data-action="open-salary" aria-label="查看年工资明细"><div class="salary-trend-head"><strong>年工资趋势</strong><span>${latest?`${latest.year} · ${yuan(latest.total)}`:''}${icon('arrow')}</span></div>${chart}</button>`;
  }
  function salaryDetailView() {
    const years=C.annualSalary(state).reverse();
    return title('','年工资','',`<button class="title-add" data-action="add-salary" aria-label="添加年度工资">＋</button>`,true)+
      (years.length?`<div class="salary-detail-list">${years.map(row=>`<button class="card salary-detail" data-action="edit-salary" data-year="${row.year}" aria-label="编辑 ${row.year} 年工资明细"><div class="salary-detail-head"><strong>${row.year}</strong><span>${yuan(row.total)}${icon('arrow')}</span></div><div class="salary-parts"><span>月工资 <b>${yuan(row.monthlySalary)}</b></span><span>年终奖 <b>${yuan(row.bonus)}</b></span><span>分红 <b>${yuan(row.dividend)}</b></span></div></button>`).join('')}</div>`:emptyCard('暂无工资记录','','',''));
  }
  function allocationPage() {
    return title('','资产配置','',`<button class="title-add" data-action="category-edit" aria-label="新增类别">＋</button>`,true) + allocationView();
  }
  function allocationView() {
    const rows = C.allocation(state);
    return rows.map(r => {
        const targetLabel=r.target<=0||r.statsEnabled===false?'目标金额':`目标金额 · ${money(r.targetShare,1)}%`;
        const gapText=!hasAssets()||r.target<=0?'':r.gap>=0?`还差 ${yuan(r.gap)}`:`高于目标 ${yuan(-r.gap)}`;
        const progressText=r.target<=0?'':`${money(r.current/r.target*100,1)}%`;
        const accounts=state.assets.filter(a=>C.category(state,a)===r.id);
        const accountMarkup=accounts.map(a=>`<span class="allocation-account-chip" title="${esc(a.name)}"><span class="allocation-account-logo">${accountBadge(a)}</span><span class="allocation-account-name">${esc(a.name)}</span></span>`).join('');
        return `<article class="allocation-item" data-sort-type="category" data-sort-id="${esc(r.id)}">${r.id==='other'?'':`<button class="allocation-swipe-delete" aria-label="删除${esc(r.name)}" data-action="category-delete-confirm" data-id="${esc(r.id)}">${icon('trash')}<span>删除</span></button>`}<div class="card allocation-row"><div class="allocation-row-top"><button class="allocation-row-title" data-action="category-edit" data-id="${esc(r.id)}" aria-label="编辑${esc(r.name)}"><i class="dot" style="background:${r.color}"></i><h3>${esc(r.name)}</h3>${icon('edit')}</button><div class="category-stats-control"><span class="${r.statsEnabled!==false?'active':''}">${r.statsEnabled!==false?'已统计':'未统计'}</span><button class="switch ${r.statsEnabled!==false?'on':''}" role="switch" aria-checked="${r.statsEnabled!==false}" aria-label="${r.name}${r.statsEnabled!==false?'已统计':'未统计'}" data-action="toggle-category-stats" data-id="${esc(r.id)}"><i></i></button></div></div><div class="allocation-value-row"><div class="allocation-amount"><small>当前金额${r.statsEnabled===false?' · 未统计':pageOption('allocation','share')?` · ${money(r.share,1)}%`:''}</small><strong>${yuan(r.current)}</strong></div><button class="allocation-amount allocation-target-edit" data-action="allocation-edit" data-id="${esc(r.id)}"><small>${targetLabel}${icon('arrow')}</small><strong>${r.target>0?yuan(r.desired):'设置目标'}</strong></button></div>${pageOption('allocation','progress')&&r.target>0?`<div class="progress"><i style="background:${r.color};width:${r.progress}%"></i></div>`:''}${pageOption('allocation','gap')&&r.target>0?`<div class="allocation-bottom"><span>${gapText}</span><b>${progressText}</b></div>`:''}<div class="allocation-accounts">${accountMarkup}<button class="allocation-account-add" data-action="category-accounts" data-id="${esc(r.id)}" aria-label="关联${esc(r.name)}账户">＋</button></div></div></article>`;
      }).join('');
  }
  function accountsView() {
    const sorted=state.assets.slice();
    if(state.accountSort!=='original')sorted.sort((a,b)=>(Number(b.balance)-Number(a.balance))*(state.accountSort==='amount-asc'?-1:1));
    const sortLabels={'amount-desc':'金额从高到低','amount-asc':'金额从低到高',original:'原始顺序'};
    return `<div class="section-head accounts-head"><h2>${state.assets.length} 个账户</h2><div class="section-actions"><button class="account-sort" data-action="account-sort" aria-label="账户排序，当前${sortLabels[state.accountSort]||sortLabels['amount-desc']}">${sortLabels[state.accountSort]||sortLabels['amount-desc']}${icon('arrow')}</button><button class="mini-button account-sync ${busy ? 'busy' : ''}" data-action="sync" ${busy?'disabled':''}>${busy?'同步中':'同步'}</button></div></div>` +
      (hasAssets() ? `<div class="card">${sorted.map(a => { const bank=bankFor(a), amount=C.cents(a.balance), kind=bankCardType(a), bankName=bank?.[1]||String(a.bankName||'').trim(), labels=[bankName,kind,a.currency!=='RMB'?'外币暂未折算':amount<0?'负债':a.reckonIn?'不计入':''].filter(Boolean), category=C.categories(state).find(c=>c.id===C.category(state,a));return `<div class="account ${a.reckonIn&&amount>0 ? 'excluded' : ''}"><div class="account-badge">${accountBadge(a)}</div><div class="account-main"><h3>${esc(a.name)}</h3>${labels.length?`<small>${labels.map(esc).join(' · ')}</small>`:''}</div><div class="account-value"><strong>${esc(a.currency === 'RMB' ? '¥' : a.currency+' ')}${money(a.balance,2)}</strong><button class="category-select" data-action="account-category" data-code="${esc(a.code)}" aria-label="${esc(a.name)}的资产类别，当前${esc(category?.name||'其他')}"><i class="dot" style="background:${category?.color||'#a9b4c6'}"></i><span>${esc(category?.name||'其他')}</span>${icon('arrow')}</button></div></div>`;}).join('')}</div>` : emptyCard('先把资产连接进来','登录小青账后读取资产。','connect','连接小青账','wallet'));
  }
  function taskRow(t, inLibrary=false) {
    const urgency=!t.done?C.taskUrgency(t):null, priority={low:'低',medium:'中',high:'高'}[t.priority]||'中';
    return `<div class="task-row ${t.done?'done':''}"><button class="task-check" data-action="toggle-task" data-id="${esc(t.id)}" aria-label="${t.done?'恢复':'完成'}${esc(t.text)}" aria-pressed="${!!t.done}">${t.done?icon('check'):''}</button><button class="task-content" data-action="edit-task" data-id="${esc(t.id)}"><span class="task-text">${esc(t.text)}</span>${inLibrary?`<small class="task-meta">${t.done?'已完成':`${priority}优先级 · 未安排日期`}</small>`:''}</button>${urgency?`<span class="urgency-badge" style="--urgency-hue:${urgency.hue}" aria-label="${priority}优先级，${urgency.label}">${priority} · ${urgency.label}</span>`:''}<button class="task-more" data-action="edit-task" data-id="${esc(t.id)}" aria-label="编辑${esc(t.text)}">${icon('arrow')}</button></div>`;
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
    const dated=state.tasks.filter(t=>!t.done&&Number.isFinite(C.dateDay(t.deadline))).slice().sort((a,b)=>C.dateDay(a.deadline)-C.dateDay(b.deadline)||({high:0,medium:1,low:2}[a.priority]??1)-({high:0,medium:1,low:2}[b.priority]??1));
    const dates=[...new Set(dated.map(t=>t.deadline))];
    const completed=state.tasks.filter(t=>t.done).slice().reverse();
    const actions=`<div class="todo-actions"><button class="icon-btn" aria-label="添加待办" data-action="add-task">${icon('plus')}</button><button class="icon-btn" aria-label="待办库" data-action="nav" data-page="todo-library">${icon('archive')}</button></div>`;
    return title('','待办','',actions)+
      (dated.length?dates.map(date=>`<section class="todo-group" data-date="${esc(date)}">${dateHeading(date)}<div class="todo-group-card">${dated.filter(t=>t.deadline===date).map(t=>taskRow(t)).join('')}</div></section>`).join(''):emptyCard('没有待完成的日程','给待办设置日期后，会按日期显示在这里。','add-task','添加待办','check'))+
      (completed.length?taskGroup('已完成',completed,'completed',true):'');
  }
  function todoLibraryView() {
    const undated=state.tasks.filter(t=>!t.done&&!Number.isFinite(C.dateDay(t.deadline))).slice().reverse();
    return title('','待办库','','',true)+
      (undated.length?taskGroup('未安排',undated,'undated',true):'')+
      (!undated.length?emptyCard('没有未安排的待办','','','','archive'):'');
  }
  function settingsView() {
    const u=updateState, label=u.status==='checking'?'正在检查更新…':u.status==='available'?`发现新版本 ${u.latest} · 点击下载`:u.status==='current'?'已是最新版本':u.status==='unpublished'?'暂无已发布版本':u.status==='error'?'检查失败 · 点击重试':'检查更新';
    return title('','设置','') +
      `<section class="settings-section"><h2>页面</h2><div class="settings-group"><button class="settings-row" data-action="nav" data-page="menu-manager"><span class="row-glyph">${icon('list')}</span><div><h3>菜单管理</h3></div>${icon('arrow')}</button></div></section>` +
      `<section class="settings-section"><h2>连接与数据</h2><div class="settings-group"><button class="settings-row" data-action="nav" data-page="connections"><span class="row-glyph">${icon('sync')}</span><div><h3>连接管理</h3><p>${connected?'已连接小青账 · 管理外部服务':'管理小青账与其他外部服务'}</p></div>${icon('arrow')}</button></div></section>` +
      `<section class="settings-section"><h2>应用</h2><button class="update-button ${u.status==='available'?'has-update':''}" data-action="update-action" ${u.status==='checking'||u.status==='downloading'?'disabled':''}><span class="update-button-icon">${icon('sync')}</span><span class="update-button-copy"><strong>${esc(label)}</strong><small>当前版本 v${esc(u.current)}</small></span></button></section>`;
  }
  function menuManagerView() {
    const info={home:{name:'资产',icon:'assets'},todos:{name:'待办',icon:'list'}};
    return title('','菜单管理','','',true)+
      `<div class="menu-pages">${state.navPages.map(row=>`<div class="menu-page-item" data-sort-type="menu" data-sort-id="${row.id}"><div class="menu-page-row"><div class="menu-page-title"><span class="row-glyph">${icon(info[row.id].icon)}</span><strong>${info[row.id].name}</strong></div><button class="switch ${row.visible?'on':''}" role="switch" aria-checked="${row.visible}" aria-label="${info[row.id].name}${row.visible?'已展示':'已隐藏'}" data-action="toggle-nav-page" data-id="${row.id}"><i></i></button></div></div>`).join('')}</div>`;
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
    updateState.status='checking';render();
    try {
      const result = await call('checkUpdate');
      if (!result.ok) { updateState.status='error';toast(result.error||'检查更新失败');render();return; }
      updateState.current=result.currentVersion||updateState.current;
      if (!result.published) { updateState.status='unpublished';render();return; }
      updateState.latest=result.latestVersion;
      const newer = Number.isInteger(result.latestCode) && Number.isInteger(result.currentCode)
        ? result.latestCode > result.currentCode : newerVersion(result.latestVersion, result.currentVersion);
      updateState.status=newer?'available':'current';render();
    } catch (error) { updateState.status='error';toast(error.message||'检查更新失败');render(); }
  }
  function updateProgress(loaded,total,complete=false) {
    const status=overlay.querySelector('.update-progress-label'),bar=overlay.querySelector('.update-progress-bar');
    if(!status||!bar)return;
    const percent=total>0?Math.max(0,Math.min(complete?100:99,Math.round(loaded/total*100))):null;
    status.textContent=percent===null?`已下载 ${(loaded/1048576).toFixed(1)} MB`:`${percent}%`;
    bar.style.width=complete?'100%':percent===null?'25%':`${percent}%`;
  }
  async function downloadUpdate() {
    updateState.status='downloading';render();
    openSheet('下载更新',`<div class="update-download"><div class="update-progress-label">正在准备下载…</div><div class="update-progress-track"><div class="update-progress-bar"></div></div><button class="secondary full" data-action="cancel-update">取消下载</button></div>`,'update-dialog');
    const session={id:null,cancelled:false};downloadSession=session;
    try {
      const result=await call('downloadUpdate',{}, {onStart:id=>{session.id=id;},progress:(loaded,total)=>{if(!session.cancelled)updateProgress(loaded,total);}});
      if(session.cancelled)return;
      if(!result.ok){toast(result.error||'下载失败，请重试');updateState.status='available';closeSheet();}
      else {
        updateProgress(1,1,true);
        await new Promise(resolve=>setTimeout(resolve,320));
        if(session.cancelled)return;
        const installed=await call('installUpdate');
        if(!installed.ok)toast(installed.error||'无法打开安装界面');
        updateState.status='available';closeSheet();
      }
    } catch(e) {if(!session.cancelled){toast(e.message||'下载失败，请重试');updateState.status='available';closeSheet();}}
    finally {if(downloadSession===session)downloadSession=null;render();}
  }
  function cancelUpdate() {
    if(!downloadSession)return;
    downloadSession.cancelled=true;
    if(downloadSession.id)call('cancelDownload',{downloadId:downloadSession.id}).catch(()=>{});
    downloadSession=null;updateState.status='available';closeSheet();render();
  }
  function connectionsView() {
    return title('','连接管理','集中管理与外部服务的数据连接。','',true) +
      `<section class="settings-section"><h2>已支持的服务</h2><div class="settings-group"><button class="settings-row" data-action="nav" data-page="xiaoqing"><div><h3>小青账</h3><p>${connected?`已连接 · 最近同步 ${syncLabel()}`:'未连接 · 读取资产账户'}</p></div>${icon('arrow')}</button></div><p class="settings-note">以后接入其他服务时，会在这里分别管理。</p></section>`;
  }
  function xiaoqingView() {
    return title('','小青账','只读同步资产账户。','',true) +
      `<section class="settings-section"><h2>连接状态</h2><div class="settings-group"><div class="settings-toggle-row"><div><h3>${connected?'已连接':'未连接'}</h3><p>${connected?`最近同步 ${syncLabel()}`:'连接后可将资产账户用于统计与目标进度'}</p></div><span class="chip ${connected?'green':'gray'}">${connected?'已连接':'未连接'}</span></div>${connected?`<button class="settings-row" data-action="sync"><div><h3>同步资产</h3><p>读取小青账最新账户余额</p></div>${icon('sync')}</button><button class="settings-row" data-action="login"><div><h3>重新登录</h3><p>更新连接凭证</p></div>${icon('arrow')}</button><button class="settings-row danger" data-action="logout-confirm"><div><h3>断开连接</h3><p>清除令牌与同步缓存，保留目标和待办</p></div>${icon('arrow')}</button>`:`<button class="settings-row" data-action="login"><div><h3>连接小青账</h3><p>使用手机号和密码登录</p></div>${icon('arrow')}</button>`}</div></section>`;
  }
  function dragHandle(type) { return `<button class="sort-handle" data-drag-handle="${type}" aria-label="拖动排序">☷</button>`; }
  function openSheet(titleText, body, dialogClass='') {
    datePicker=null;
    overlay.innerHTML = `<div class="backdrop ${esc(dialogClass)}"><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(titleText)}"><div class="handle"></div><div class="sheet-head"><h2>${esc(titleText)}</h2><button class="icon-btn" aria-label="关闭" data-action="close">${icon('close')}</button></div>${body}</section></div>`;
    document.body.style.overflow='hidden';
    setTimeout(()=>overlay.querySelector('input:not([type="date"]):not([type="checkbox"])')?.focus(),160);
  }
  function closeSheet() { datePicker=null;overlay.innerHTML=''; document.body.style.overflow=''; }
  function choiceRow(label, action, value, selected, color='') {
    return `<button class="choice-row ${selected?'selected':''}" data-action="${action}" data-value="${esc(value)}" aria-pressed="${selected}">${color?`<i class="dot" style="background:${color}"></i>`:''}<span>${esc(label)}</span><i class="choice-indicator">${selected?icon('check'):''}</i></button>`;
  }
  function accountSortSheet() {
    const options=[['amount-desc','金额从高到低'],['amount-asc','金额从低到高'],['original','原始顺序']];
    openSheet('账户排序',`<div class="choice-list">${options.map(([value,label])=>choiceRow(label,'select-account-sort',value,state.accountSort===value)).join('')}</div>`,'choice-dialog');
  }
  function accountCategorySheet(code) {
    const account=state.assets.find(a=>a.code===code);if(!account)return;
    openSheet('资产类别',`<div class="choice-list">${C.categories(state).map(c=>choiceRow(c.name,'select-account-category',c.id,C.category(state,account)===c.id,c.color)).join('')}</div>`,'choice-dialog');
    overlay.querySelectorAll('[data-action="select-account-category"]').forEach(button=>button.dataset.code=code);
  }
  function closeDatePicker() { overlay.querySelector('.date-picker-backdrop')?.remove();datePicker=null; }
  function openDatePicker(button) {
    const input=button.closest('form').elements.deadline, selected=input.value||C.today();
    datePicker={input,button,year:Number(selected.slice(0,4)),month:Number(selected.slice(5,7)),mode:'days',required:button.dataset.required==='true'};
    overlay.insertAdjacentHTML('beforeend','<div class="date-picker-backdrop"><section class="date-picker" role="dialog" aria-modal="true" aria-label="选择日期"></section></div>');
    renderDatePicker();
  }
  function renderDatePicker() {
    if(!datePicker)return;
    const p=datePicker, panel=overlay.querySelector('.date-picker');
    if(p.mode==='years') {
      panel.innerHTML=`<div class="date-picker-head"><strong>选择年份</strong><button class="date-picker-close" data-action="close-date-picker" aria-label="关闭">${icon('close')}</button></div><div class="date-years">${Array.from({length:201},(_,i)=>1900+i).map(y=>`<button class="${y===p.year?'selected':''}" data-action="select-year" data-year="${y}">${y}</button>`).join('')}</div>`;
      panel.querySelector('.date-years .selected')?.scrollIntoView({block:'center'});
      return;
    }
    const first=new Date(p.year,p.month-1,1).getDay(), offset=(first+6)%7, count=new Date(p.year,p.month,0).getDate();
    const chosen=p.input.value;
    const days=Array.from({length:offset},()=>'<span></span>').concat(Array.from({length:count},(_,i)=>{const d=i+1, value=`${p.year}-${String(p.month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;return `<button class="${value===chosen?'selected':''}" data-action="select-day" data-day="${d}" aria-label="${value}">${d}</button>`;})).join('');
    panel.innerHTML=`<div class="date-picker-head"><button class="date-year-button" data-action="show-years">${p.year} 年 ${icon('arrow')}</button><button class="date-picker-close" data-action="close-date-picker" aria-label="关闭">${icon('close')}</button></div><div class="date-month-head"><button data-action="date-month" data-step="-1" aria-label="上个月">${icon('arrow')}</button><strong>${p.month} 月</strong><button data-action="date-month" data-step="1" aria-label="下个月">${icon('arrow')}</button></div><div class="date-weekdays">${['一','二','三','四','五','六','日'].map(d=>`<span>${d}</span>`).join('')}</div><div class="date-days">${days}</div>${p.required?'':'<button class="date-clear" data-action="clear-date">清除日期</button>'}`;
  }
  function formError(text) { const el=overlay.querySelector('.form-error'); if(el)el.textContent=text; else toast(text); }
  function taskDateAfter(days) { const d=new Date();d.setDate(d.getDate()+days);return C.today(d); }
  function setTaskDeadline(value) {
    const form=overlay.querySelector('form[data-form="task"]');if(!form)return;
    form.elements.deadline.value=value;
    form.querySelector('.date-field-button span').textContent=value||'选择日期';
    form.querySelectorAll('[data-action="task-quick-date"]').forEach(button=>button.classList.toggle('selected',value===taskDateAfter(Number(button.dataset.days))));
  }
  function setTaskDestination(value) {
    const form=overlay.querySelector('form[data-form="task"]');if(!form)return;
    const library=value==='library';
    form.elements.destination.value=library?'library':'schedule';
    form.querySelector('.task-schedule').hidden=library;
    form.querySelectorAll('[data-action="task-destination"]').forEach(button=>{
      const selected=button.dataset.value===(library?'library':'schedule');
      button.classList.toggle('selected',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
    if(library)setTaskDeadline('');
  }
  function closeTaskOption() { overlay.querySelector('.task-option-backdrop')?.remove(); }
  function taskOption(kind) {
    closeTaskOption();
    const priority=overlay.querySelector('form[data-form="task"]')?.elements.priority.value||'medium';
    const body=kind==='priority'
      ? `<div class="choice-list">${[['low','低'],['medium','中'],['high','高']].map(([value,label])=>choiceRow(label,'select-task-priority',value,priority===value)).join('')}</div>`
      : `<div class="task-offset-editor"><div class="task-offset-number"><input data-task-offset-count type="text" inputmode="numeric" maxlength="4" value="1" aria-label="多少天或周后"><span>后完成</span></div><div class="task-offset-units"><button class="selected" data-action="task-offset-unit" data-unit="day" aria-pressed="true">天</button><button data-action="task-offset-unit" data-unit="week" aria-pressed="false">周</button></div><div class="task-offset-error" role="alert"></div><button class="primary full" data-action="apply-task-offset">确定</button></div>`;
    overlay.insertAdjacentHTML('beforeend',`<div class="task-option-backdrop"><section class="task-option-panel" role="dialog" aria-modal="true" aria-label="${kind==='priority'?'选择优先级':'选择完成时间'}"><div class="task-option-head"><h2>${kind==='priority'?'优先级':'完成时间'}</h2><button class="icon-btn" data-action="close-task-option" aria-label="关闭">${icon('close')}</button></div>${body}</section></div>`);
    if(kind==='offset')overlay.querySelector('[data-task-offset-count]')?.focus();
  }
  function taskForm(id) {
    const task=state.tasks.find(t=>t.id===id);
    const priority=task?.priority||'medium', priorityLabel={low:'低',medium:'中',high:'高'}[priority];
    const destination=task&&!Number.isFinite(C.dateDay(task.deadline))?'library':'schedule';
    openSheet(task?'编辑待办':'添加待办',`<form data-form="task" ${task?`data-id="${esc(task.id)}"`:''}><label class="form-field"><span>待办内容</span><input name="text" maxlength="140" value="${esc(task?.text||'')}" placeholder="要做的事" required></label><input type="hidden" name="destination" value="${destination}"><div class="task-destination" role="group" aria-label="待办位置"><button type="button" class="${destination==='schedule'?'selected':''}" data-action="task-destination" data-value="schedule" aria-pressed="${destination==='schedule'}">安排日期</button><button type="button" class="${destination==='library'?'selected':''}" data-action="task-destination" data-value="library" aria-pressed="${destination==='library'}">加入待办库</button></div><div class="task-schedule" ${destination==='library'?'hidden':''}>${dateField('待完成日期',task?.deadline)}<div class="task-quick-dates">${[[1,'明天'],[3,'3天后'],[7,'1周后'],[14,'2周后']].map(([days,label])=>`<button type="button" data-action="task-quick-date" data-days="${days}">${label}</button>`).join('')}<button type="button" data-action="task-offset">自定义</button></div></div><div class="form-field task-priority-field"><span>优先级</span><input type="hidden" name="priority" value="${priority}"><button type="button" class="task-priority-button" data-action="task-priority" aria-label="选择优先级，当前${priorityLabel}"><span>${priorityLabel}</span>${icon('arrow')}</button></div><div class="form-error" role="alert"></div><button class="primary full" type="submit">${task?'保存修改':'添加待办'}</button></form>${task?`<button class="task-delete-action" data-action="delete-task" data-id="${esc(task.id)}">删除待办</button>`:''}`,'task-dialog');
  }
  function goalForm(id) {
    const g=state.goals.find(g=>g.id===id), date=new Date();date.setFullYear(date.getFullYear()+1);
    openSheet(g?'编辑目标':'给未来起个名字',`<form data-form="goal" data-id="${esc(id||'')}"><label class="form-field"><span>目标名称</span><input name="name" maxlength="40" placeholder="例如：攒下第一笔底气" value="${esc(g?.name||'')}" required></label><label class="form-field"><span>目标金额 · 人民币</span><input name="amount" type="number" inputmode="decimal" min="0.01" max="1000000000000" step="0.01" placeholder="200000" value="${g?.amount||''}" required></label>${dateField('截止日期',g?.deadline||C.today(date),true)}<div class="form-error" role="alert"></div><button class="primary full" type="submit">${g?'保存目标':'开始靠近目标'}</button></form>`);
  }
  function goalDetail(id) {
    const g=state.goals.find(g=>g.id===id);if(!g)return;
    const m=C.goalMetrics(state,g);
    openSheet(g.name,goalCard(g,true)+`<div class="goal-detail-stats"><div><span>距离目标还差</span><strong>${hasAssets()?yuan(m.remaining):'—'}</strong></div><div><span>${m.overdue?'已经逾期':'距离截止日期'}</span><strong>${Math.abs(m.days)} 天</strong></div>${pageOption('goals','monthly')?`<div><span>平均每月还需</span><strong>${!hasAssets()?'—':m.monthly==null?'需重新规划':yuan(m.monthly)}</strong></div>`:''}${pageOption('goals','forecast')?`<div><span>预计达成日期</span><strong style="font-size:16px">${m.complete?'目标已达成':m.estimate||'数据积累中'}</strong></div>`:''}</div>${hint(!hasAssets()?'连接小青账或添加资产后，计算剩余金额和进度。':m.complete?'恭喜，这个目标已经达成。可以继续积累，也可以为下一程起个名字。':`${m.ahead>=0?'领先':'落后'}当前基准的线性计划 ${yuan(Math.abs(m.ahead))}。${pageOption('goals','forecast')?'<br>预计日期需要最近 30 天内至少跨越 7 天的快照和正向资产变化速度；它不是收益承诺。':''}`)}<button class="primary full" data-action="edit-goal" data-id="${esc(id)}">${icon('edit')}编辑目标</button>`);
  }
  function allocationForm(id) {
    const row=C.allocation(state).find(r=>r.id===id);if(!row)return;
    openSheet(`${row.name}目标`,`<form data-form="allocation" data-id="${esc(id)}"><label class="form-field"><span>目标金额 · 元</span><input name="target" type="number" inputmode="decimal" min="0" max="1000000000000" step="0.01" value="${row.target||''}" required></label><div class="form-error" role="alert"></div><button class="primary full" type="submit">保存目标</button>${row.target>0?`<button type="button" class="text-btn danger full" data-action="allocation-delete-confirm" data-id="${esc(id)}">删除目标</button>`:''}</form>`);
  }
  function salaryForm(year) {
    const row=state.salaryYears.find(item=>item.year===Number(year));
    const months=Array.from({length:12},(_,i)=>`<label class="salary-month-field"><span>${i+1} 月</span><input name="month${i+1}" type="number" inputmode="decimal" min="0" max="1000000000000" step="0.01" value="${row?.months[i]??''}" placeholder="—"></label>`).join('');
    openSheet(row?'编辑年度工资':'添加年度工资',`<form data-form="salary" data-original-year="${row?.year||''}"><label class="form-field"><span>年份</span><input name="year" type="number" inputmode="numeric" min="1900" max="2100" step="1" value="${row?.year||new Date().getFullYear()}" required></label><div class="salary-form-label">月工资 · 元</div><div class="salary-month-grid">${months}</div><div class="salary-extras"><label class="form-field"><span>年终奖 · 元</span><input name="bonus" type="number" inputmode="decimal" min="0" max="1000000000000" step="0.01" value="${row?.bonus||''}" placeholder="—"></label><label class="form-field"><span>分红 · 元</span><input name="dividend" type="number" inputmode="decimal" min="0" max="1000000000000" step="0.01" value="${row?.dividend||''}" placeholder="—"></label></div><div class="form-error" role="alert"></div><button class="primary full" type="submit">保存</button>${row?`<button class="text-btn danger full" type="button" data-action="delete-salary-confirm" data-year="${row.year}">删除</button>`:''}</form>`,'choice-dialog salary-dialog');
  }
  function loginSheet() {
    openSheet(connected?'小青账账户':'连接小青账',`${hint('手机号 + 密码登录。密码只用于本次登录，不会保存。会话令牌由系统密钥库加密，资产只读同步。')}${!native?'<div class="warning-note">当前为浏览器预览，不能登录真实账户。请在安装好的安卓 App 中使用。</div>':''}<form data-form="login"><label class="form-field"><span>手机号</span><input name="phone" type="tel" inputmode="tel" autocomplete="username" maxlength="20" placeholder="小青账登录手机号" required></label><label class="form-field"><span>密码</span><input name="password" type="password" autocomplete="current-password" placeholder="输入小青账密码" required></label><div class="form-error" role="alert"></div><button class="primary full" type="submit" ${busy?'disabled':''}>${busy?'正在连接…':'登录并同步资产'}</button></form>`);
  }
  async function sync() {
    if (state.demo) {toast('示例模式不会同步真实账户，请先退出示例');return;}
    if (!connected) {navigate('xiaoqing');return;}
    if(busy)return;busy=true;state.lastSyncAttempt=new Date().toISOString();save();render();
    try { const result=await call('sync');applySync(result); }
    catch(e){toast(e.message);}finally{busy=false;render();}
  }
  function applySync(result) {
    if(!result.ok){if(result.expired)connected=false;if(result.connected)connected=true;throw new Error(result.error||'同步未完成');}
    const accounts=(result.accounts||[]).filter(a=>Number(a.balance)!==0);
    state.assets=state.assets.filter(a=>a.source==='manual').concat(accounts);
    state.lastSync=new Date(result.syncedAt).toISOString();state.lastSyncAttempt=state.lastSync;connected=true;
    initializeBaselines();C.recordSnapshot(state);save();
  }
  function initializeBaselines(){for(const g of state.goals)if(g.baselinePending){g.baseline=C.goalValue(state,g);g.createdDate=C.today();g.baselinePending=false;}}
  function categoryForm(id) {
    const c=C.categories(state).find(c=>c.id===id);
    const accounts=categoryAccountFields(c);
    openSheet(c?'编辑资产类别':'新的资产类别',`<form data-form="category" data-id="${esc(c?.id||'')}"><label class="form-field"><span>类别名称</span><input name="name" maxlength="12" value="${esc(c?.name||'')}" placeholder="例如：黄金" required></label>${colorPicker(c?.color||'#b89356')}<div class="category-account-section"><h3>包含账户</h3><div class="category-account-list" tabindex="0">${accounts||'<p class="category-no-accounts">暂无账户</p>'}</div></div><div class="form-error" role="alert"></div><button class="primary full" type="submit">保存类别</button>${c&&c.id!=='other'?'<button class="text-btn danger full" type="button" data-action="category-delete-confirm" data-id="'+esc(c.id)+'">删除类别</button>':''}</form>`,'category-dialog category-editor-dialog');
  }
  function hexToHsv(hex) {
    const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),max=Math.max(...rgb),min=Math.min(...rgb),d=max-min;
    let hue=0;if(d){if(max===rgb[0])hue=((rgb[1]-rgb[2])/d)%6;else if(max===rgb[1])hue=(rgb[2]-rgb[0])/d+2;else hue=(rgb[0]-rgb[1])/d+4;hue=(hue*60+360)%360;}
    return {h:Math.round(hue),s:max?Math.round(d/max*100):0,v:Math.round(max*100)};
  }
  function hsvToHex(h,s,v) {
    s/=100;v/=100;const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
    const rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
    return '#'+rgb.map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');
  }
  function colorPicker(color) {
    const palette=['#356bee','#3192c7','#28a789','#70a66b','#a89b45','#d89b54','#d97768','#c46c9a','#9369bd','#5b79a8','#697b91','#b89356'], hsv=hexToHsv(color);
    return `<div class="color-picker"><div class="color-picker-heading"><span>类别颜色</span><button class="color-custom-toggle" type="button" data-action="toggle-color-custom">自定义</button></div><input type="hidden" name="color" value="${color}"><div class="color-swatches">${palette.map(value=>`<button type="button" class="color-swatch ${value===color?'selected':''}" style="--swatch:${value}" data-action="color-preset" data-color="${value}" aria-label="选择颜色 ${value}"></button>`).join('')}</div><div class="color-custom" hidden><div class="color-sv" data-color-sv data-s="${hsv.s}" data-v="${hsv.v}" style="--hue:${hsv.h}"><i style="left:${hsv.s}%;top:${100-hsv.v}%"></i></div><input class="color-hue" data-color-hue type="range" min="0" max="359" value="${hsv.h}" aria-label="色相"><div class="color-current"><i style="background:${color}"></i><span>${color.toUpperCase()}</span></div></div></div>`;
  }
  function setCategoryColor(form,color) {
    const picker=form.querySelector('.color-picker'),hsv=hexToHsv(color);
    form.elements.color.value=color;picker.querySelectorAll('.color-swatch').forEach(el=>el.classList.toggle('selected',el.dataset.color===color));
    const sv=picker.querySelector('.color-sv');sv.style.setProperty('--hue',hsv.h);sv.dataset.s=hsv.s;sv.dataset.v=hsv.v;
    sv.querySelector('i').style.left=hsv.s+'%';sv.querySelector('i').style.top=(100-hsv.v)+'%';
    picker.querySelector('.color-hue').value=hsv.h;picker.querySelector('.color-current i').style.background=color;picker.querySelector('.color-current span').textContent=color.toUpperCase();
  }
  function moveCategoryColor(e) {
    const drag=colorDrag;if(!drag||drag.pointerId!==e.pointerId)return;
    const rect=drag.sv.getBoundingClientRect(),s=Math.max(0,Math.min(100,(e.clientX-rect.left)/rect.width*100)),v=100-Math.max(0,Math.min(100,(e.clientY-rect.top)/rect.height*100));
    setCategoryColor(drag.form,hsvToHex(Number(drag.form.querySelector('.color-hue').value),s,v));e.preventDefault();
  }
  function categoryAccountFields(c) {
    return state.assets.map(a=>{const current=C.category(state,a),assigned=c&&current===c.id,locked=c?.id==='other'&&assigned;return `<label class="category-account"><input type="checkbox" name="account" value="${esc(a.code)}" ${assigned?'checked':''} ${locked?'disabled':''}><span><strong>${esc(a.name)}</strong><small>${a.reckonIn?'不计入 · ':''}${esc(C.categories(state).find(x=>x.id===current)?.name||'其他')}</small></span></label>`;}).join('');
  }
  function categoryAccountsForm(id) {
    const c=state.categories.find(c=>c.id===id);if(!c)return;
    openSheet(`关联${c.name}账户`,`<form data-form="category-accounts" data-id="${esc(id)}"><div class="category-account-section">${categoryAccountFields(c)||'<p class="category-no-accounts">暂无账户</p>'}</div><button class="primary full" type="submit">保存</button></form>`,'category-dialog');
  }
  function assignCategoryAccounts(id,selected) {
    let changed=false;
    for(const asset of state.assets){const current=C.category(state,asset);if(selected.has(asset.code)&&current!==id){state.categoryMap[asset.code]=id;changed=true;}else if(!selected.has(asset.code)&&current===id&&id!=='other'){state.categoryMap[asset.code]='other';changed=true;}}
    if(changed)C.recordSnapshot(state);
  }
  function confirm(titleText, message, action, id) {
    openSheet(titleText,`<p class="footnote" style="font-size:13px;margin:0 0 24px">${message}</p><div class="form-actions"><button class="secondary" data-action="close">取消</button><button class="primary" data-action="${action}" data-id="${esc(id||'')}">确认</button></div>`);
  }
  function navigate(next,root=false) {
    if(!next||next===page)return;
    closeSheet();
    if(root){navRoot=next;navHistory=[];}else navHistory.push(page);
    page=next;render();window.scrollTo(0,0);
  }
  function commitSort(type,ids) {
    const list=type==='category'?state.categories:type==='goal'?state.goals:type==='menu'?state.navPages:null;
    if(!list)return;
    const key=x=>typeof x==='string'?x:x.id, byId=new Map(list.map(x=>[key(x),x])), visible=new Set(ids);
    if(ids.some(id=>!byId.has(id)))return;
    const slots=list.map((x,i)=>visible.has(key(x))?i:-1).filter(i=>i>=0);
    if(slots.length!==ids.length)return;
    let changed=false;slots.forEach((slot,i)=>{if(key(list[slot])!==ids[i])changed=true;list[slot]=byId.get(ids[i]);});
    if(changed)save();render();
  }
  function beginSort(item,e) {
    const type=item.dataset.sortType, selector=type==='goal'?'.goal-list-item':type==='menu'?'.menu-page-item':'.allocation-item';
    const rect=item.getBoundingClientRect(), ghost=item.cloneNode(true);
    ghost.classList.add('sort-ghost');ghost.classList.remove('is-open','is-swiping');
    Object.assign(ghost.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
    document.body.appendChild(ghost);item.classList.add('sort-placeholder');
    sortState={item,ghost,type,selector,pointerId:e.pointerId,startY:e.clientY,offsetX:e.clientX-rect.left,offsetY:e.clientY-rect.top,parent:item.parentElement};
    suppressSwipeClick=true;
  }
  function moveSort(e) {
    const s=sortState;if(!s||e.pointerId!==s.pointerId)return;
    s.ghost.style.left=`${e.clientX-s.offsetX}px`;s.ghost.style.top=`${e.clientY-s.offsetY}px`;
    const siblings=[...s.parent.querySelectorAll(`:scope > ${s.selector}`)].filter(el=>el!==s.item);
    if(!siblings.length)return;
    const positions=new Map(siblings.map(el=>[el,el.getBoundingClientRect().top]));
    const hovered=siblings.find(el=>{const r=el.getBoundingClientRect();return e.clientY>=r.top&&e.clientY<=r.bottom;});
    if(hovered){if(e.clientY>=s.startY)hovered.after(s.item);else hovered.before(s.item);}
    else {const next=siblings.find(el=>e.clientY<el.getBoundingClientRect().top);if(next)next.before(s.item);else siblings[siblings.length-1].after(s.item);}
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)for(const el of siblings){const delta=positions.get(el)-el.getBoundingClientRect().top;if(Math.abs(delta)>1){el._sortAnimation?.cancel();el._sortAnimation=el.animate([{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}],{duration:180,easing:'cubic-bezier(.2,.8,.2,1)'});}}
    e.preventDefault();
  }
  function finishSort(cancel=false) {
    const s=sortState;if(!s)return;sortState=null;s.ghost.remove();s.item.classList.remove('sort-placeholder');
    const ids=[...s.parent.querySelectorAll(`:scope > ${s.selector}`)].map(el=>el.dataset.sortId);
    suppressSwipeClick=true;setTimeout(()=>{suppressSwipeClick=false;},250);
    if(cancel)render();else commitSort(s.type,ids);
  }
  function deleteCategory(id) {
    if(id==='other'||!state.categories.some(c=>c.id===id))return;
    state.categories=state.categories.filter(c=>c.id!==id);
    for(const code of Object.keys(state.categoryMap))if(state.categoryMap[code]===id)state.categoryMap[code]='other';
    delete state.allocationGoals[id];C.recordSnapshot(state);save();closeSheet();render();
    toast('资产类别已删除');
  }
  function goBack() {
    if(datePicker){closeDatePicker();return true;}
    if(overlay.innerHTML){if(downloadSession)cancelUpdate();else closeSheet();return true;}
    if(navHistory.length){page=navHistory.pop();render();window.scrollTo(0,0);return true;}
    if(page!==navRoot){page=navRoot;render();return true;}
    return false;
  }
  const handlers = {
    nav:el=>navigate(el.dataset.page,el.classList.contains('nav-item')), back:goBack, close:()=>downloadSession?cancelUpdate():closeSheet(), connect:()=>navigate('xiaoqing'),
    'toggle-nav-page':el=>{const row=state.navPages.find(item=>item.id===el.dataset.id);if(!row)return;row.visible=!row.visible;save();render();},
    'pick-date':openDatePicker,
    'close-date-picker':closeDatePicker,
    'show-years':()=>{datePicker.mode='years';renderDatePicker();},
    'select-year':el=>{datePicker.year=Number(el.dataset.year);datePicker.mode='days';renderDatePicker();},
    'date-month':el=>{const d=new Date(datePicker.year,datePicker.month-1+Number(el.dataset.step),1);datePicker.year=d.getFullYear();datePicker.month=d.getMonth()+1;renderDatePicker();},
    'select-day':el=>{const p=datePicker,value=`${p.year}-${String(p.month).padStart(2,'0')}-${String(el.dataset.day).padStart(2,'0')}`;if(p.button.closest('form').dataset.form==='task')setTaskDeadline(value);else{p.input.value=value;p.button.querySelector('span').textContent=value;}closeDatePicker();},
    'clear-date':()=>{if(datePicker.button.closest('form').dataset.form==='task')setTaskDeadline('');else{datePicker.input.value='';datePicker.button.querySelector('span').textContent='选择日期';}closeDatePicker();},
    'task-quick-date':el=>setTaskDeadline(taskDateAfter(Number(el.dataset.days))),
    'task-destination':el=>setTaskDestination(el.dataset.value),
    'task-offset':()=>taskOption('offset'),
    'task-priority':()=>taskOption('priority'),
    'close-task-option':closeTaskOption,
    'select-task-priority':el=>{const form=overlay.querySelector('form[data-form="task"]');if(!form||!['low','medium','high'].includes(el.dataset.value))return;form.elements.priority.value=el.dataset.value;const label={low:'低',medium:'中',high:'高'}[el.dataset.value];form.querySelector('.task-priority-button span').textContent=label;form.querySelector('.task-priority-button').setAttribute('aria-label',`选择优先级，当前${label}`);closeTaskOption();},
    'task-offset-unit':el=>{el.parentElement.querySelectorAll('button').forEach(button=>{const selected=button===el;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});},
    'apply-task-offset':()=>{const dialog=overlay.querySelector('.task-option-backdrop'),raw=dialog?.querySelector('[data-task-offset-count]')?.value.trim(),unit=dialog?.querySelector('.task-offset-units .selected')?.dataset.unit,count=Number(raw),days=count*(unit==='week'?7:1);if(!/^\d+$/.test(raw||'')||!Number.isInteger(count)||days<1||days>3650){dialog.querySelector('.task-offset-error').textContent='请输入 1 至 3650 天内的时间';return;}setTaskDeadline(taskDateAfter(days));closeTaskOption();},
    'update-action':()=>updateState.status==='available'?downloadUpdate():checkUpdate(),
    'cancel-update':cancelUpdate,
    'open-all-goals':()=>navigate('goals'), 'add-goal':()=>goalForm(), 'edit-goal':el=>goalForm(el.dataset.id),
    'goal-filter':el=>{goalFilter=el.dataset.filter;render();},
    'set-current-goal':el=>{if(!state.goals.some(g=>g.id===el.dataset.id))return;for(const g of state.goals)g.visible=g.id===el.dataset.id;save();render();},
    'goal-detail':el=>goalDetail(el.dataset.id), 'assets-allocation':()=>navigate('allocation'),
    'open-salary':()=>navigate('salary'), 'add-salary':()=>salaryForm(), 'edit-salary':el=>salaryForm(el.dataset.year),
    'delete-salary-confirm':el=>confirm('删除年度工资？','删除这一年的工资记录。','delete-salary',el.dataset.year),
    'delete-salary':el=>{state.salaryYears=state.salaryYears.filter(row=>row.year!==Number(el.dataset.id));save();closeSheet();render();},
    'allocation-edit':el=>allocationForm(el.dataset.id), login:loginSheet,sync,
    'account-sort':accountSortSheet,
    'select-account-sort':el=>{state.accountSort=el.dataset.value;save();closeSheet();render();},
    'account-category':el=>accountCategorySheet(el.dataset.code),
    'select-account-category':el=>{if(!state.assets.some(a=>a.code===el.dataset.code)||!C.categories(state).some(c=>c.id===el.dataset.value))return;state.categoryMap[el.dataset.code]=el.dataset.value;C.recordSnapshot(state);save();closeSheet();render();},
    'category-edit':el=>categoryForm(el.dataset.id), 'category-accounts':el=>categoryAccountsForm(el.dataset.id),
    'toggle-color-custom':el=>{const custom=el.closest('.color-picker').querySelector('.color-custom');custom.hidden=!custom.hidden;el.classList.toggle('active',!custom.hidden);},
    'color-preset':el=>setCategoryColor(el.closest('form'),el.dataset.color),
    'toggle-category-stats':el=>{const c=state.categories.find(x=>x.id===el.dataset.id);if(!c)return;c.statsEnabled=c.statsEnabled===false;save();render();},
    'allocation-delete-confirm':el=>confirm('删除类别目标？','只清除这个类别的目标，不影响账户或其他类别。','allocation-delete',el.dataset.id),
    'allocation-delete':el=>{delete state.allocationGoals[el.dataset.id];save();closeSheet();render();toast('类别目标已删除');},
    'category-delete-confirm':el=>confirm('删除资产类别？','关联账户会转入“其他”，该类别的配置目标会删除。','category-delete',el.dataset.id),
    'category-delete':el=>deleteCategory(el.dataset.id),
    'delete-goal-confirm':el=>confirm('删除目标？','只删除目标设置，不会影响资产或小青账数据。','delete-goal',el.dataset.id),
    'delete-goal':el=>{const wasCurrent=state.goals.some(g=>g.id===el.dataset.id&&g.visible!==false);state.goals=state.goals.filter(g=>g.id!==el.dataset.id);if(wasCurrent&&state.goals.length)for(const g of state.goals)g.visible=g===state.goals[0];save();closeSheet();render();toast('目标已删除');},
    'open-accounts':()=>navigate('wealth'),
    'add-task':()=>taskForm(), 'edit-task':el=>taskForm(el.dataset.id),
    'toggle-task':el=>{const t=state.tasks.find(t=>t.id===el.dataset.id);if(!t)return;t.done=!t.done;save();render();toast(t.done?'已完成':'已恢复');},
    'delete-task':el=>confirm('删除这条待办？','删除后无法恢复。','delete-task-now',el.dataset.id),
    'delete-task-now':el=>{state.tasks=state.tasks.filter(t=>t.id!==el.dataset.id);save();closeSheet();render();},
    rename:()=>openSheet('给这个空间起个名字',`<form data-form="rename"><label class="form-field"><span>应用内名称</span><input name="name" maxlength="12" value="${esc(state.name)}" required><small>修改界面里的名称，不影响桌面图标名称。</small></label><div class="form-error" role="alert"></div><button class="primary full" type="submit">保存名称</button></form>`),
    'logout-confirm':()=>confirm('断开小青账？','清除这台设备的登录令牌、同步资产和快照。保留目标、资产分类与待办。','logout'),
    logout:async()=>{const r=await call('logout');if(!r.ok){toast(r.error);return;}connected=false;state.assets=state.assets.filter(a=>a.source==='manual');state.history=[];state.lastSync=null;state.lastSyncAttempt=null;if(state.assets.length)C.recordSnapshot(state);save();closeSheet();render();toast('已断开连接');}
  };
  document.addEventListener('click',e=>{if(suppressSwipeClick&&e.isTrusted){e.preventDefault();suppressSwipeClick=false;return;}const open=e.target.closest('.allocation-item.is-open,.goal-list-item.is-open');if(open&&e.target.closest('.allocation-row,.goal-swipe-content')){open.classList.remove('is-open');return;}if(e.target.classList.contains('date-picker-backdrop')){closeDatePicker();return;}if(e.target.classList.contains('task-option-backdrop')){closeTaskOption();return;}if(e.target.classList.contains('backdrop')){if(downloadSession)cancelUpdate();else closeSheet();return;}const el=e.target.closest('[data-action]');if(!el||el.disabled)return;const handler=handlers[el.dataset.action];if(handler)Promise.resolve(handler(el)).catch(err=>toast(err.message||'操作未完成，请重试'));});
  document.addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-drag-handle]');if(!handle)return;const row=handle.closest('[data-sort-id]');if(!row)return;beginSort(row,e);handle.setPointerCapture?.(e.pointerId);e.preventDefault();});
  document.addEventListener('pointermove',moveSort);
  document.addEventListener('pointerup',e=>{if(sortState&&e.pointerId===sortState.pointerId)finishSort();});
  document.addEventListener('pointercancel',()=>finishSort(true));
  document.addEventListener('pointerdown',e=>{const item=e.target.closest('.allocation-item,.goal-list-item');if(!item||item.dataset.sortId==='other'||e.target.closest('[data-drag-handle],.allocation-swipe-delete,.goal-swipe-actions'))return;const width=parseFloat(getComputedStyle(item).getPropertyValue('--swipe-width'))||76;swipeState={item,width,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,offset:item.classList.contains('is-open')?-width:0,active:false};});
  document.addEventListener('pointermove',e=>{const s=swipeState;if(!s||e.pointerId!==s.pointerId)return;const dx=e.clientX-s.startX,dy=e.clientY-s.startY;if(!s.active){if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy))return;s.active=true;s.item.classList.add('is-swiping');document.querySelectorAll('.allocation-item.is-open,.goal-list-item.is-open').forEach(item=>{if(item!==s.item)item.classList.remove('is-open');});}s.item.querySelector('.allocation-row,.goal-swipe-content').style.transform=`translateX(${Math.max(-s.width,Math.min(0,s.offset+dx))}px)`;e.preventDefault();});
  document.addEventListener('pointerup',e=>{const s=swipeState;if(!s||e.pointerId!==s.pointerId)return;swipeState=null;if(!s.active)return;const dx=e.clientX-s.startX;s.item.querySelector('.allocation-row,.goal-swipe-content').style.transform='';s.item.classList.remove('is-swiping');s.item.classList.toggle('is-open',s.offset+dx<-Math.min(65,s.width/2));suppressSwipeClick=true;setTimeout(()=>{suppressSwipeClick=false;},250);});
  document.addEventListener('pointercancel',()=>{if(!swipeState)return;swipeState.item.querySelector('.allocation-row,.goal-swipe-content').style.transform='';swipeState.item.classList.remove('is-swiping');swipeState=null;});
  document.addEventListener('pointerdown',e=>{const title=e.target.closest('.allocation-row-title,.goal-list-item .goal-top,.menu-page-title');if(!title)return;const item=title.closest('.allocation-item,.goal-list-item,.menu-page-item');if(!item)return;const hold={item,title,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,timer:null};longPressState=hold;hold.timer=setTimeout(()=>{if(longPressState!==hold)return;swipeState=null;item.classList.remove('is-open','is-swiping');const content=item.querySelector('.allocation-row,.goal-swipe-content');if(content)content.style.transform='';beginSort(item,e);try{title.setPointerCapture(e.pointerId);}catch{}},380);});
  document.addEventListener('pointermove',e=>{const s=longPressState;if(!s||e.pointerId!==s.pointerId||sortState)return;if(Math.hypot(e.clientX-s.startX,e.clientY-s.startY)>8){clearTimeout(s.timer);longPressState=null;}});
  document.addEventListener('pointerup',e=>{const s=longPressState;if(!s||e.pointerId!==s.pointerId)return;clearTimeout(s.timer);longPressState=null;});
  document.addEventListener('pointercancel',()=>{if(longPressState)clearTimeout(longPressState.timer);longPressState=null;});
  document.addEventListener('pointerdown',e=>{const sv=e.target.closest('[data-color-sv]');if(!sv)return;colorDrag={sv,form:sv.closest('form'),pointerId:e.pointerId};sv.setPointerCapture?.(e.pointerId);moveCategoryColor(e);});
  document.addEventListener('pointermove',moveCategoryColor);
  document.addEventListener('pointerup',e=>{if(colorDrag?.pointerId===e.pointerId)colorDrag=null;});
  document.addEventListener('pointercancel',()=>{colorDrag=null;});
  document.addEventListener('input',e=>{if(e.target.matches('[data-color-hue]')){const form=e.target.closest('form'),sv=form.querySelector('.color-sv');setCategoryColor(form,hsvToHex(Number(e.target.value),Number(sv.dataset.s),Number(sv.dataset.v)));}});
  document.addEventListener('submit',async e=>{
    const form=e.target;if(!form.dataset.form)return;e.preventDefault();const data=Object.fromEntries(new FormData(form)),type=form.dataset.form;
    if(type==='goal'){
      const error=C.validateGoal(data);if(error){formError(error);return;}
      const old=state.goals.find(g=>g.id===form.dataset.id), g=Object.assign({},old||{},data,{name:data.name.trim(),amount:Number(data.amount),scope:'all',visible:old?old.visible!==false:!state.goals.length,id:old?.id||uid()});
      if(!old){g.createdDate=C.today();g.baseline=C.goalValue(state,g);g.baselinePending=!hasAssets();}
      if(old)state.goals[state.goals.findIndex(x=>x.id===g.id)]=g;else state.goals.push(g);save();closeSheet();render();toast('目标已保存');
    }else if(type==='salary'){
      const year=Number(data.year),months=Array.from({length:12},(_,i)=>data[`month${i+1}`]===''?null:Number(data[`month${i+1}`])),bonus=Number(data.bonus||0),dividend=Number(data.dividend||0);
      if(!/^\d{4}$/.test(data.year)||year<1900||year>2100||months.every(n=>n===null)&&!data.bonus&&!data.dividend||months.some(n=>n!==null&&(!Number.isFinite(n)||n<0||n>1e12))||[bonus,dividend].some(n=>!Number.isFinite(n)||n<0||n>1e12)) {formError('请填写有效的年份和金额');return;}
      if(state.salaryYears.some(row=>row.year===year&&row.year!==Number(form.dataset.originalYear))){formError('这一年已经有记录');return;}
      state.salaryYears=state.salaryYears.filter(row=>row.year!==Number(form.dataset.originalYear));
      state.salaryYears.push({year,months:months.map(n=>n===null?null:C.round(n)),bonus:C.round(bonus),dividend:C.round(dividend)});
      state.salaryYears.sort((a,b)=>a.year-b.year);save();closeSheet();render();
    }else if(type==='allocation'){
      const id=form.dataset.id,target=Number(data.target);
      if(!state.categories.some(c=>c.id===id)||data.target===''||!Number.isFinite(target)||target<0||target>1e12){formError('请输入有效目标金额');return;}
      state.allocationGoals[id]={target};save();closeSheet();render();toast('类别目标已保存');
    }else if(type==='task'){
      if(!data.text.trim()){formError('请填写待办内容');return;}
      const deadline=data.destination==='library'?'':data.deadline;
      if(data.destination!=='library'&&!Number.isFinite(C.dateDay(deadline))){formError('请选择完成日期或加入待办库');return;}
      const task=state.tasks.find(t=>t.id===form.dataset.id), priority=['low','medium','high'].includes(data.priority)?data.priority:'medium';
      if(task){task.text=data.text.trim();task.deadline=deadline;task.priority=priority;}else state.tasks.push({id:uid(),text:data.text.trim(),deadline,priority,done:false});
      save();closeSheet();render();toast(task?'已保存':'已添加');
    }else if(type==='rename'){
      if(!data.name.trim()){formError('名称不能为空');return;}state.name=data.name.trim();save();closeSheet();render();
    }else if(type==='category'){
      if(!data.name.trim()||!/^#[0-9a-fA-F]{6}$/.test(data.color)){formError('请填写名称并选择颜色');return;}
      const id=form.dataset.id||'cat_'+uid();
      if(state.categories.some(c=>c.id!==id&&c.name===data.name.trim())){formError('已有同名类别');return;}
      const cat={id,name:data.name.trim(),color:data.color,statsEnabled:state.categories.find(c=>c.id===id)?.statsEnabled!==false};
      const idx=state.categories.findIndex(c=>c.id===id);if(idx>=0)state.categories[idx]=cat;else state.categories.push(cat);
      assignCategoryAccounts(id,new Set(new FormData(form).getAll('account')));
      save();closeSheet();render();toast('资产类别已保存');
    }else if(type==='category-accounts'){
      if(!state.categories.some(c=>c.id===form.dataset.id))return;
      assignCategoryAccounts(form.dataset.id,new Set(new FormData(form).getAll('account')));
      save();closeSheet();render();toast('关联账户已保存');
    }else if(type==='login'){
      if(state.demo){formError('请先退出示例模式，再连接真实账户');return;}
      if(busy)return;busy=true;state.lastSyncAttempt=new Date().toISOString();save();const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='正在登录并读取资产…';
      try{const result=await call('login',{phone:data.phone,password:data.password});form.querySelector('[name="password"]').value='';data.password='';applySync(result);closeSheet();}
      catch(err){formError(err.message);}
      finally{busy=false;if(button.isConnected){button.disabled=false;button.textContent='登录并同步资产';}render();}
    }
  });
  window.hubBack=goBack;
  // Small explicit interface for browser QA, never exposes native credentials.
  window.shiji={get state(){return state;}, setState:s=>{state=C.migrate(s);render();},render,navigate,openGoal:goalForm};
  call('load').then(result=>{if(result.ok){const hadZeroAssets=Array.isArray(result.state?.assets)&&result.state.assets.some(a=>a?.source==='xiaoqing'&&Number(a.balance)===0),migrated=Number(result.state?.version||0)<C.SCHEMA;state=C.migrate(result.state);connected=!!result.connected;updateState.current=result.currentVersion||updateState.current;if(hadZeroAssets||migrated)save();}else toast(result.error);render();if(connected&&C.autoSyncDue(state))sync();}).catch(()=>{render();toast('读取本地数据失败，请重新打开 App');});
})();
