const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../app/src/main/assets/core.js');

test('opening a recently synced app reads local state without requesting a sync',async()=>{
  const actions=[];
  const app={innerHTML:''},overlay={innerHTML:''};
  const state=C.empty();state.lastSync=new Date().toISOString();
  global.window={HubCore:C,scrollTo(){},NativeHub:{call(id,action){actions.push(action);setImmediate(()=>window.onNativeResult(id,{ok:true,connected:true,state}));}}};
  global.document={body:{style:{}},getElementById(id){return id==='app'?app:overlay;},addEventListener(){}};
  delete require.cache[require.resolve('../app/src/main/assets/app.js')];
  require('../app/src/main/assets/app.js');
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.deepEqual(actions,['load']);
});

test('opening after twelve hours requests one automatic sync',async()=>{
  const actions=[];
  const app={innerHTML:''},overlay={innerHTML:''};
  const state=C.empty();state.lastSync=new Date(Date.now()-13*60*60*1000).toISOString();
  global.window={HubCore:C,scrollTo(){},NativeHub:{call(id,action){actions.push(action);const result=action==='load'?{ok:true,connected:true,state}:action==='sync'?{ok:true,accounts:[],syncedAt:Date.now()}:{ok:true};setImmediate(()=>window.onNativeResult(id,result));}}};
  global.document={body:{style:{}},getElementById(id){return id==='app'?app:overlay;},addEventListener(){}};
  delete require.cache[require.resolve('../app/src/main/assets/app.js')];
  require('../app/src/main/assets/app.js');
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(actions.filter(action=>action==='sync').length,1);
  assert.equal(actions[0],'load');
});

test('asset content stays visible while todo settings remain configurable',async()=>{
  const app={innerHTML:''}, overlay={innerHTML:''};
  global.window={HubCore:C,scrollTo(){}};
  global.document={body:{style:{}},getElementById(id){return id==='app'?app:overlay;},addEventListener(){}};
  global.localStorage={getItem(){return null;},setItem(){}};
  delete require.cache[require.resolve('../app/src/main/assets/app.js')];
  require('../app/src/main/assets/app.js');
  await new Promise(resolve=>setImmediate(resolve));
  const s=C.demo();
  window.shiji.setState(s);
  assert.ok(app.innerHTML.includes('class="card overview-trend"'));
  assert.ok(!app.innerHTML.includes('data-action="open-trend"'));
  window.shiji.navigate('settings');
  assert.ok(!app.innerHTML.includes('data-action="page-settings" data-id="wealth"'));
  assert.ok(app.innerHTML.includes('data-action="page-settings" data-id="todos"'));
  assert.ok(app.innerHTML.includes('data-page="connections"'));
  assert.ok(!app.innerHTML.includes('data-action="login"'));
  window.shiji.navigate('connections');
  assert.ok(app.innerHTML.includes('小青账'));
  assert.ok(app.innerHTML.includes('data-page="xiaoqing"'));
  window.shiji.navigate('xiaoqing');
  assert.ok(app.innerHTML.includes('<h1>小青账</h1>'));
  assert.ok(app.innerHTML.includes('data-action="login"'));
  assert.ok(!app.innerHTML.includes('常用功能'));
  window.shiji.navigate('module-settings');
  assert.ok(app.innerHTML.includes('data-module="todos" data-option="completed"'));
  assert.ok(!app.innerHTML.includes('data-module="wealth"'));
  window.shiji.navigate('wealth');
  assert.ok(app.innerHTML.includes('<h1>账户列表</h1>'));
  assert.ok(!app.innerHTML.includes('data-action="wealth-tab"'));
  assert.ok(!app.innerHTML.includes('<h1>资产配置</h1>'));
  window.shiji.navigate('allocation');
  assert.ok(app.innerHTML.includes('<h1>资产配置</h1>'));
  assert.ok(!app.innerHTML.includes('data-action="wealth-tab"'));
  assert.deepEqual((app.innerHTML.match(/class="nav-item/g)||[]).length,3);
  s.pageOptions.wealth.summary=false;s.pageOptions.wealth.accounts=false;s.pageOptions.wealth.goals=false;s.pageOptions.wealth.allocation=false;
  s.pageOptions.allocation.gap=false;s.pageOptions.allocation.progress=false;
  s.pageOptions.goals.monthly=false;
  s.pageOptions.todos.completed=false;
  s.tasks=[{id:'a',text:'未完成',deadline:'2030-01-01',done:false},{id:'b',text:'已完成',deadline:'2030-01-02',done:true}];
  s.goals=[{id:'g',name:'已达成',amount:1,scope:'all',deadline:'2030-01-01',createdDate:'2026-01-01',visible:false}];
  window.shiji.setState(s);
  window.shiji.navigate('home');
  assert.ok(app.innerHTML.includes('存钱目标'));
  assert.ok(app.innerHTML.includes('资产配置'));
  assert.ok(app.innerHTML.includes('资产趋势'));
  assert.ok(!app.innerHTML.includes('资产页面设置'));
  assert.ok(app.innerHTML.includes('data-action="open-accounts"'));
  window.shiji.navigate('wealth');
  assert.ok(!app.innerHTML.includes('class="card wealth-summary"'));
  assert.ok(!app.innerHTML.includes('data-action="wealth-tab"'));
  assert.ok(!app.innerHTML.includes('计入资产的变化'));
  window.shiji.navigate('allocation');
  assert.ok(app.innerHTML.includes('class="allocation-bottom"'));
  assert.ok(app.innerHTML.includes('class="progress"'));
  window.shiji.navigate('goals');
  assert.ok(app.innerHTML.includes('data-sort-id="g"'));
  assert.ok(app.innerHTML.includes('data-action="set-current-goal"'));
  assert.ok(app.innerHTML.includes('class="goal-list-item is-current"'));
  assert.ok(!app.innerHTML.includes('goal-home-switch'));
  assert.ok(!app.innerHTML.includes('data-action="move-item"'));
  window.shiji.navigate('todos');
  assert.ok(app.innerHTML.includes('未完成'));
  assert.ok(!app.innerHTML.includes('已完成'));
  assert.ok(app.innerHTML.includes('data-date="2030-01-01"'));
  assert.ok(!app.innerHTML.includes('体验示例'));
});

test('todos sort by due date and keep only undated active tasks in the library',async()=>{
  const app={innerHTML:''}, overlay={innerHTML:''};
  global.window={HubCore:C,scrollTo(){}};
  global.document={body:{style:{}},getElementById(id){return id==='app'?app:overlay;},addEventListener(){}};
  global.localStorage={getItem(){return null;},setItem(){}};
  delete require.cache[require.resolve('../app/src/main/assets/app.js')];
  require('../app/src/main/assets/app.js');
  await new Promise(resolve=>setImmediate(resolve));
  const s=C.empty();
  s.pageOptions.todos.completed=false;
  s.tasks=[
    {id:'late',text:'较晚事项',deadline:'2030-06-10',done:false},
    {id:'undated',text:'还没安排',deadline:'',done:false},
    {id:'early',text:'较早事项',deadline:'2030-02-03',done:false},
    {id:'done',text:'已经完成',deadline:'2030-01-01',done:true}
  ];
  window.shiji.setState(s);
  window.shiji.navigate('todos');
  assert.ok(app.innerHTML.indexOf('较早事项')<app.innerHTML.indexOf('较晚事项'));
  assert.ok(!app.innerHTML.includes('还没安排'));
  assert.ok(!app.innerHTML.includes('已经完成'));
  for(const label of ['添加待办','待办库','待办页面设置']) assert.ok(app.innerHTML.includes(`aria-label="${label}"`));
  assert.ok(app.innerHTML.includes('data-action="toggle-task" data-id="early"'));
  assert.ok(app.innerHTML.includes('class="urgency-badge"'));
  window.shiji.navigate('todo-library');
  assert.ok(app.innerHTML.includes('class="title-back" data-action="back"'));
  assert.ok(app.innerHTML.includes('还没安排'));
  assert.ok(!app.innerHTML.includes('较早事项'));
  assert.ok(!app.innerHTML.includes('较晚事项'));
  assert.ok(!app.innerHTML.includes('已经完成'));
  assert.ok(app.innerHTML.includes('data-action="edit-task" data-id="undated"'));
});
