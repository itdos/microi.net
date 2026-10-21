import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = process.env.MICROI_SANITIZER_TEST_SOURCE ? fs.readFileSync(process.env.MICROI_SANITIZER_TEST_SOURCE, 'utf8') : JSON.parse(fs.readFileSync(new URL('./app.microi.saas-engine.json', import.meta.url), 'utf8')).SysApiEngines.find(engine => engine.ApiEngineKey === 'admin_get_empty_database_sanitization_sql').ApiV8Code;
// 执行真实清理计划生成逻辑；数据库夹具只提供读取，任何写操作都会使测试失败。
function plan({ parent = '', failTables = false } = {}) {
  const menus = [
    {Id:'oa',Name:'OA办公系统',ParentId:parent},
    {Id:'oa-leave',Name:'请假申请',ParentId:'oa',DiyTableId:'leave-table'},
    {Id:'oa-child',Name:'报销明细',ParentId:'oa-leave',DiyTableName:'Diy_ExpenseLine'},
    {Id:'oa-shared',Name:'平台共享页',ParentId:'oa',DiyTableName:'mic_page'},
    {Id:'oa-platform',Name:'平台公共页',ParentId:'oa',DiyTableName:'Diy_CoreModule'},
    {Id:'oa-optional',Name:'可选通知应用',ParentId:'oa',DiyTableName:'Diy_Notice'},
    {Id:'ai',Name:'AI应用',ParentId:parent},
    {Id:'game',Name:'游戏',ParentId:'ai',DiyTableName:'game_score'},
    {Id:'system',Name:'系统管理',ParentId:''},
    {Id:'nested-oa',Name:'OA办公系统',ParentId:'system'},
    {Id:'assistant',Name:'AI助手',ParentId:'system'},
  ];
  const stores = [
    {Id:'core',AppKey:'app.microi.module-engine',ApplicationType:'Platform',PackageIsValid:1,SelectedTableNamesJson:'["Diy_CoreModule"]'},
    {Id:'notice',AppKey:'app.microi.notice',ApplicationType:'Platform',PackageIsValid:1,SelectedTableNamesJson:'["Diy_Notice"]'}
  ];
  const V8={FormEngine:{GetTableData(table) {
    if (table==='sys_menu') return {Code:1,Data:menus};
    if (table==='diy_table') return failTables ? {Code:0,Msg:'table read failed'} : {Code:1,Data:[{Id:'leave-table',Name:'Diy_Leave'}]};
    throw Error('Unexpected read '+table);
  }},Db:{FromSql(sql) {return {ToArray() {
    if(sql.includes('FROM sys_microistore'))return stores;
    if(sql.includes('FROM sys_apiengine'))return [];
    if(sql.includes('information_schema.tables'))return [{TableName:'test_demo'},{TableName:'diy_qa_child'},{TableName:'codex_file_probe'},{TableName:'sys_user'},{TableName:'Diy_Notice'},{TableName:'mci_aie_chat_message'}];
    throw Error('Unexpected SQL');
  }};}}};
  const code=source.slice(0,source.indexOf('var applicationTableValuesSql ='));
  return vm.runInNewContext('(function(){'+code+'\nreturn {Code:1, menus:Object.keys(aiApplicationMenuIdMap), tables:applicationTableNames};})()', {V8});
}

for (const parent of ['', null, '00000000-0000-0000-0000-000000000000']) {
  test(`empty database removes the complete OA/AI tree for root ${parent ?? 'null'}`,()=>{
    const result=plan({parent});
    assert.equal(result.Code,1);
    for(const id of ['oa','oa-leave','oa-child','oa-shared','oa-platform','oa-optional','ai','game'])assert.ok(result.menus.includes(id),id);
    for(const table of ['Diy_Leave','Diy_ExpenseLine','game_score','Diy_Notice'])assert.ok(result.tables.includes(table),table);
    for(const table of ['mic_page','Diy_CoreModule'])assert.ok(!result.tables.includes(table),`protected ${table}`);
    for(const id of ['system','nested-oa','assistant'])assert.ok(!result.menus.includes(id),`preserved ${id}`);
  });
}
test('empty database fails closed when a menu table cannot be resolved',()=>{
  assert.equal(plan({failTables:true}).Code,0);
});

test('empty database removes historical fixture tables while preserving platform schemas',()=>{
  const result=plan();
  for(const name of ['test_demo','diy_qa_child','codex_file_probe','Diy_Notice'])assert.ok(result.tables.includes(name));
  for(const name of ['sys_user','Diy_CoreModule','mci_aie_chat_message'])assert.ok(!result.tables.includes(name));
});

test('empty database clears new runtime tables by default without dropping their structures',()=>{
  const start=source.indexOf('var portableSeedTableMap = {}'),end=source.indexOf('var cleanupOperationalResidueSql =',start);
  assert.ok(start>0&&end>start,'seed allowlist must exist');
  const scope={applicationTableMap:{},operationalResidueTableNames:['mci_background_task'],allPhysicalTableMap:{mci_aie_chat_message:'mci_aie_chat_message',new_runtime_table:'new_runtime_table',diy_field:'diy_field',sys_menu:'sys_menu',mci_ai_app_file:'mci_ai_app_file',mci_background_task:'mci_background_task'}};
  vm.runInNewContext(source.slice(start,end),scope);
  assert.deepEqual([...scope.operationalResidueTableNames].sort(),['mci_aie_chat_message','mci_background_task','new_runtime_table']);
});
