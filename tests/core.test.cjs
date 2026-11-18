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
    {code:'excluded',balance:-300,currency:'RMB',reckonIn:true},
    {code:'included-debt',balance:-10.05,currency:'RMB',reckonIn:false},
    {code:'foreign',balance:999,currency:'USD',reckonIn:false}];
  assert.equal(C.totals(s).total,90.05);assert.equal(C.totals(s).included,2);
  assert.equal(C.totals(s).excluded,1);assert.equal(C.totals(s).foreign,1);
});
test('goals: per-category scope, deadline, completion, overdue, no fabricated prediction',()=>{
  const s=C.demo();s.goals=[];s.history=[];
  const g={amount:100000,deadline:'2027-01-31',createdDate:'2027-01-01',baseline:80000,scope:'all'};
  const m=C.goalMetrics(s,g,'2027-01-16');
  assert.equal(m.current,86000);assert.equal(m.remaining,14000);assert.equal(m.days,15);assert.equal(m.percent,86);
  assert.equal(m.ahead,-4000);assert.equal(m.estimate,null);assert.equal(m.monthly,28408.33);
  assert.equal(C.goalMetrics(s,g,'2027-02-01').overdue,true);
  assert.equal(C.goalMetrics(s,{...g,amount:1000},'2027-01-16').complete,true);
  assert.equal(C.goalMetrics(s,{...g,scope:'stock'},'2027-01-16').current,32000);
});
test('allocation: percent is based on current assets; amount is fixed; percent must total 100',()=>{
  const s=C.demo();assert.equal(C.allocation(s)[0].desired,34400);
  s.allocationMode='amount';s.allocationTargets.stock=40000;
  assert.equal(C.allocation(s)[0].gap,8000);
  assert.ok(C.validateAllocation('percent',{stock:40,bond:30,cash:20,other:0}));
  assert.equal(C.validateAllocation('percent',{stock:40,bond:30,cash:30,other:0}),null);
});
test('daily snapshots replace same day, preserve previous days, and require month boundary for monthly metric',()=>{
  const s=C.demo();s.history=[];
  C.recordSnapshot(s,'2027-01-01');s.assets[0].balance+=100;C.recordSnapshot(s,'2027-01-01');
  assert.equal(s.history.length,1);assert.equal(s.history[0].total,86100);
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
  s.assets=[{code:'gold1',balance:12000,currency:'RMB',reckonIn:false}];s.categoryMap.gold1='gold';s.allocationTargets={stock:40,bond:30,cash:10,other:0,gold:20};
  assert.equal(C.totals(s).categories.gold,12000);
  assert.equal(C.allocation(s).find(c=>c.id==='gold').share,100);
  assert.equal(C.validateAllocation('percent',s.allocationTargets,s.categories),null);
});
test('forecasts need recent positive growth; recategorized history cannot invent category growth',()=>{
  const s=C.demo();s.history=[];const g={amount:100000,deadline:'2027-12-31',createdDate:'2027-01-01',baseline:0,scope:'stock'};
  C.recordSnapshot(s,'2027-01-01');s.assets[0].balance+=1000;
  assert.ok(C.goalMetrics(s,g,'2027-01-11').estimate);
  s.categoryMap['demo-bond']='stock';
  assert.equal(C.goalMetrics(s,g,'2027-01-11').estimate,null);
  assert.equal(C.goalMetrics(s,g,'2027-03-01').estimate,null);
  assert.equal(C.monthChange(s,'2027-02-05'),null,'Old snapshot is not a month-start balance');
});
test('forecast chooses the oldest eligible snapshot even when history is unsorted',()=>{
  const s=C.demo();
  s.history=[{date:'2027-01-11',total:80000},{date:'2027-01-01',total:70000}];
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
test('asset blocks retain a unique order and goals retain individual visibility',()=>{
  const s=C.migrate({wealthOrder:['allocation','allocation','goals'],goals:[{id:'a',visible:false},{id:'b'}]});
  assert.deepEqual(s.wealthOrder,['allocation','goals','summary']);
  assert.equal(s.goals[0].visible,false);
  assert.equal(s.goals[1].visible,true);
});
