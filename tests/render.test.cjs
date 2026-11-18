const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../app/src/main/assets/core.js');

test('asset and todo pages have independent visibility settings',async()=>{
  const app={innerHTML:''}, overlay={innerHTML:''};
  global.window={HubCore:C,scrollTo(){}};
  global.document={body:{style:{}},getElementById(id){return id==='app'?app:overlay;},addEventListener(){}};
  global.localStorage={getItem(){return null;},setItem(){}};
  require('../app/src/main/assets/app.js');
  await new Promise(resolve=>setImmediate(resolve));
  const s=C.demo();
  window.shiji.setState(s);
  window.shiji.navigate('settings');
  assert.ok(app.innerHTML.includes('data-action="page-settings" data-id="wealth"'));
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
  assert.ok(app.innerHTML.includes('data-module="wealth" data-option="goals"'));
  window.shiji.navigate('wealth');
  assert.ok(app.innerHTML.includes('<h1>资产统计</h1>'));
  assert.ok(app.innerHTML.includes('data-action="wealth-tab"'));
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
  assert.ok(!app.innerHTML.includes('存钱目标'));
  assert.ok(!app.innerHTML.includes('资产配置'));
  assert.ok(!app.innerHTML.includes('资产趋势'));
  window.shiji.navigate('wealth');
  assert.ok(!app.innerHTML.includes('class="card wealth-summary"'));
  assert.ok(!app.innerHTML.includes('data-action="wealth-tab"'));
  assert.ok(app.innerHTML.includes('计入资产的变化'));
  window.shiji.navigate('allocation');
  assert.ok(!app.innerHTML.includes('class="allocation-bottom"'));
  assert.ok(!app.innerHTML.includes('class="progress"'));
  window.shiji.navigate('goals');
  assert.ok(!app.innerHTML.includes('data-id="g"'));
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
