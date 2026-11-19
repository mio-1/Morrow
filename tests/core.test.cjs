const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('../app/src/main/assets/core.js');
test('todo priority migrates safely and urgency varies smoothly with time and priority',()=>{
  const s=C.migrate({tasks:[{id:'old',text:'旧待办',deadline:'2026-11-20',done:false}]});
  assert.equal(s.tasks[0].priority,'medium');
  const urgency=(deadline,priority)=>C.taskUrgency({deadline,priority},'2026-11-18');
  assert.ok(urgency('2026-11-20','high').score>urgency('2026-11-20','medium').score);
  assert.ok(urgency('2026-11-20','medium').score>urgency('2026-11-20','low').score);
  assert.ok(urgency('2026-11-20','medium').score>urgency('2026-12-20','medium').score);
  assert.ok(urgency('2026-11-17','medium').score>urgency('2026-11-20','medium').score);
  assert.equal(urgency('2026-11-20','medium').label,'剩 2 天');
  assert.equal(urgency('2026-11-18','medium').label,'今天到期');
  assert.equal(urgency('2026-11-17','medium').label,'逾期 1 天');
  assert.equal(C.taskUrgency({deadline:''},'2026-11-18'),null);
});
test('assets: exclude only the user-confirmed marker; hidden status is independent; debts keep their sign',()=>{
  const s=C.empty();
  s.assets=[{code:'included',balance:100.10,currency:'RMB',reckonIn:false,status:'HIDE'},
    {code:'excluded-debt',balance:-300,currency:'RMB',reckonIn:true},
    {code:'excluded-asset',balance:30,currency:'RMB',reckonIn:true},
    {code:'included-debt',balance:-10.05,currency:'RMB',reckonIn:false},
    {code:'foreign',balance:999,currency:'USD',reckonIn:false}];
  assert.equal(C.totals(s).total,-209.95);assert.equal(C.totals(s).included,1);
  assert.equal(C.totals(s).excluded,1);assert.equal(C.totals(s).foreign,1);
  assert.equal(C.totals(s).grossAssets,100.10);
  assert.equal(C.totals(s).liabilities,310.05);
  assert.equal(C.totals(s).excludedTotal,30);
  assert.equal(C.included(s.assets[1]),false);
});
test('migration removes previously synced zero balances but preserves manual zero accounts',()=>{
  const s=C.migrate({assets:[
    {code:'synced-zero',source:'xiaoqing',balance:0},
    {code:'synced-string-zero',source:'xiaoqing',balance:'0.00'},
    {code:'manual-zero',source:'manual',balance:0},
    {code:'synced-nonzero',source:'xiaoqing',balance:1}
  ]});
  assert.deepEqual(s.assets.map(a=>a.code),['manual-zero','synced-nonzero']);
});
test('automatic sync is due after twelve hours and a failed attempt delays retries',()=>{
  const now=Date.parse('2026-11-19T12:00:00Z');
  const s=C.empty();s.lastSync='2026-11-19T00:00:00Z';
  assert.equal(C.autoSyncDue(s,now),false);
  assert.equal(C.autoSyncDue(s,now+1),true);
  s.lastSyncAttempt='2026-11-19T11:00:00Z';
  assert.equal(C.autoSyncDue(s,now+1),false);
  assert.equal(C.autoSyncDue(s,now+11*60*60*1000+1),true);
});
test('goals use total assets for progress, deadline, completion, and forecast',()=>{
  const s=C.demo();s.goals=[];s.history=[];
  const g={amount:100000,deadline:'2027-01-31',createdDate:'2027-01-01',baseline:80000,scope:'all'};
  const m=C.goalMetrics(s,g,'2027-01-16');
  assert.equal(m.current,86000);assert.equal(m.remaining,14000);assert.equal(m.days,15);assert.equal(m.percent,86);
  assert.equal(m.ahead,-4000);assert.equal(m.estimate,null);assert.equal(m.monthly,28408.33);
  assert.equal(C.goalMetrics(s,g,'2027-02-01').overdue,true);
  assert.equal(C.goalMetrics(s,{...g,amount:1000},'2027-01-16').complete,true);
  assert.equal(C.goalMetrics(s,{...g,scope:'stock'},'2027-01-16').current,86000);
});
test('allocation targets are fixed amounts; target shares use enabled target amounts',()=>{
  const s=C.demo();assert.equal(C.allocation(s)[0].desired,34400);
  assert.equal(C.allocation(s)[0].targetShare,40);
  s.allocationGoals.stock={target:40000};
  assert.equal(C.allocation(s)[0].gap,8000);
  assert.equal(C.allocation(s)[0].targetShare,40000/(40000+25800+25800)*100);
  s.categories.find(c=>c.id==='bond').statsEnabled=false;
  assert.equal(C.allocation(s).find(c=>c.id==='bond').targetShare,0);
  assert.equal(C.allocation(s).find(c=>c.id==='stock').targetShare,40000/(40000+25800)*100);
  assert.equal(C.allocation(s).find(c=>c.id==='bond').target,25800);
  assert.equal(C.totals(s).grossAssets,86000);
});
test('daily snapshots replace same day, preserve previous days, and require month boundary for monthly metric',()=>{
  const s=C.demo();s.history=[];
  C.recordSnapshot(s,'2027-01-01');s.assets[0].balance+=100;C.recordSnapshot(s,'2027-01-01');
  assert.equal(s.history.length,1);assert.equal(s.history[0].total,81100);
  s.assets[0].balance+=200;C.recordSnapshot(s,'2027-01-02');
  assert.equal(s.history.length,2);assert.equal(C.monthChange(s,'2027-01-02'),200);
  assert.equal(C.monthChange(s,'2026-12-16'),null);
});
test('calendar dates reject invalid dates; multiple goals stay independent and modules survive migration',()=>{
  assert.ok(Number.isNaN(C.dateDay('2027-02-31')));
  assert.ok(C.validateGoal({name:'',amount:100,deadline:'2027-01-01'}));
  assert.ok(C.validateGoal({name:'目标',amount:-1,deadline:'2027-01-01'}));
  const s=C.migrate({modules:[{id:'todos',enabled:true}]});
  assert.equal(s.modules[0].id,'todos');assert.equal(s.modules[0].enabled,true);assert.equal(s.modules[0].visible,true);assert.equal(s.modules.length,4);
  assert.equal(C.migrate({modules:[{id:'todos',enabled:false,visible:false}]}).modules[0].visible,false);
  assert.equal(C.MODULES.find(m=>m.id==='wealth').page,'wealth');
  assert.equal(C.MODULES.find(m=>m.id==='allocation').page,'allocation');
  assert.equal(C.migrate({menuShortcuts:['goals']}).menuShortcuts,undefined);
});
test('custom categories participate in totals and allocation targets',()=>{
  const s=C.empty();s.categories.push({id:'gold',name:'黄金',color:'#ba975c'});
  s.assets=[{code:'gold1',balance:12000,currency:'RMB',reckonIn:false}];s.categoryMap.gold1='gold';s.allocationGoals={gold:{target:20000}};
  assert.equal(C.totals(s).categories.gold,12000);
  assert.equal(C.allocation(s).find(c=>c.id==='gold').share,100);
  assert.equal(C.allocation(s).find(c=>c.id==='gold').targetShare,100);
});
test('forecasts use total asset history regardless of category changes',()=>{
  const s=C.demo();s.history=[];const g={amount:100000,deadline:'2027-12-31',createdDate:'2027-01-01',baseline:0,scope:'stock'};
  C.recordSnapshot(s,'2027-01-01');s.assets[0].balance+=1000;
  assert.ok(C.goalMetrics(s,g,'2027-01-11').estimate);
  s.categoryMap['demo-bond']='stock';
  assert.ok(C.goalMetrics(s,g,'2027-01-11').estimate);
  assert.equal(C.goalMetrics(s,g,'2027-03-01').estimate,null);
  assert.equal(C.monthChange(s,'2027-02-05'),null,'Old snapshot is not a month-start balance');
});
test('older category goals migrate to total asset progress',()=>{
  const s=C.demo();s.version=12;s.goals=[{id:'old',name:'股票目标',amount:100000,scope:'stock',deadline:'2028-01-01',createdDate:'2026-01-01',baseline:32000}];
  const migrated=C.migrate(s);
  assert.equal(migrated.goals[0].scope,'all');
  assert.equal(migrated.goals[0].baseline,86000);
  assert.equal(C.goalMetrics(migrated,migrated.goals[0]).current,86000);
});
test('forecast chooses the oldest eligible snapshot even when history is unsorted',()=>{
  const s=C.demo();
  s.history=[{date:'2027-01-11',total:75000,grossAssets:80000},{date:'2027-01-01',total:65000,grossAssets:70000}];
  const g={amount:100000,deadline:'2027-12-31',createdDate:'2027-01-01',baseline:0,scope:'all'};
  assert.equal(C.goalMetrics(s,g,'2027-01-21').dailyRate,800);
});
test('page content options migrate independently and preserve explicit off choices',()=>{
  const s=C.migrate({pageOptions:{wealth:{summary:false,unknown:false},todos:{completed:false,dates:false}}});
  assert.equal(s.pageOptions.wealth.summary,false);
  assert.equal(s.pageOptions.wealth.accounts,true);
  assert.equal(s.pageOptions.todos.completed,false);
  assert.equal(s.pageOptions.todos.dates,undefined);
  assert.equal(s.pageOptions.goals.forecast,true);
  assert.equal(s.pageOptions.wealth.unknown,undefined);
});
test('asset blocks retain a unique order and migration keeps one current goal',()=>{
  const s=C.migrate({wealthOrder:['allocation','allocation','goals'],goals:[{id:'a',visible:false},{id:'b'}]});
  assert.deepEqual(s.wealthOrder,['allocation','goals','summary']);
  assert.equal(s.goals[0].visible,false);
  assert.equal(s.goals[1].visible,true);
  const many=C.migrate({version:13,goals:[{id:'first',visible:true},{id:'second',visible:true}]});
  assert.deepEqual(many.goals.map(g=>g.visible),[true,false]);
});

test('asset categories migrate the old visibility switch to allocation statistics only',()=>{
  const s=C.migrate({categories:[{id:'stock',name:'股票',color:'#356bee',visible:false},{id:'other',name:'其他',color:'#8796ae'}]});
  assert.equal(s.categories[0].statsEnabled,false);
  assert.equal(s.categories[1].statsEnabled,true);
  assert.equal(C.totals(s).total,0);
  s.assets=[{code:'stock',balance:100,currency:'RMB',reckonIn:false},{code:'other',balance:50,currency:'RMB',reckonIn:false}];
  s.categoryMap={stock:'stock',other:'other'};
  assert.equal(C.totals(s).grossAssets,150);
  assert.equal(C.goalValue(s,{scope:'all'}),150);
  assert.equal(C.allocation(s).find(c=>c.id==='stock').share,0);
  assert.equal(C.allocation(s).find(c=>c.id==='other').share,100);
  s.categories[0].statsEnabled=true;
  assert.equal(C.migrate(s).categories[0].statsEnabled,true);
});
test('old percentage targets become fixed amounts using participating assets at upgrade',()=>{
  const s=C.demo();s.version=11;
  s.allocationGoals={stock:{mode:'percent',target:40},bond:{mode:'percent',target:30},cash:{mode:'percent',target:30}};
  s.categories.find(c=>c.id==='bond').statsEnabled=false;
  const upgraded=C.migrate(s);
  assert.equal(upgraded.allocationGoals.stock.target,24800);
  assert.equal(upgraded.allocationGoals.bond.target,18600);
  assert.equal(C.allocation(upgraded).find(c=>c.id==='stock').targetShare,40/70*100);
  assert.equal(upgraded.allocationMode,undefined);
  assert.equal(upgraded.allocationTargets,undefined);
});
