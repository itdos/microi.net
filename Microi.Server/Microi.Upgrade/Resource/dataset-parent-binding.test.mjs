import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./import-package.js',import.meta.url),'utf8');
const start=source.indexOf('    var resolveDataSetParentBinding = function');
const end=source.indexOf('\n    if (dataSets.length > 0)',start);
const helper=source.slice(start,end);
const binding={Field:'SysConfigId',TableName:'sys_config',MatchField:'IsEnable',MatchValue:1};
function run(data,result){
 const calls=[];
 const ctx={isSafeDataTableName:n=>/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(n||'')),V8:{FormEngine:{GetTableData:(...args)=>{calls.push(args);return result;}}}};
 vm.createContext(ctx);vm.runInContext(helper,ctx);
 return {value:ctx.resolveDataSetParentBinding(data),calls};
}
test('种子按目标当前唯一配置绑定，仅查询 Id，不读写系统设置值',()=>{
 const {value,calls}=run({ConflictPolicy:'InsertIfMissing',ParentBinding:binding},{Code:1,Data:[{Id:'target-config'}]});
 assert.equal(value.Id,'target-config');assert.equal(value.Field,'SysConfigId');
 assert.equal(JSON.stringify(calls[0]),JSON.stringify(['sys_config',{_Where:[['IsEnable','=',1]],_SelectFields:['Id'],_PageSize:2,_PageIndex:1}]));
});
test('歧义、查表失败和不安全绑定不得继续安装',()=>{
 for(const result of [{Code:1,Data:[]},{Code:1,Data:[{Id:'a'},{Id:'b'}]},{Code:0,Msg:'denied'}])
  assert.throws(()=>run({ConflictPolicy:'InsertIfMissing',ParentBinding:binding},result),/唯一父记录/);
 for(const b of [{...binding,TableName:'sys_config; DROP TABLE x'},{...binding,MatchValue:{sql:'evil'}}])
  assert.throws(()=>run({ConflictPolicy:'InsertIfMissing',ParentBinding:b},{Code:1,Data:[{Id:'a'}]}),/无效/);
 assert.throws(()=>run({ConflictPolicy:'UpsertById',ParentBinding:binding},{}),/无效/);
});
test('普通数据集不增加查询，外键在业务冲突检查之前绑定',()=>{
 assert.equal(run({},{}).calls.length,0);
 assert.ok(source.indexOf('if (resolvedParentBinding) sourceRow[resolvedParentBinding.Field]') < source.indexOf('var conflictFields = normalizeDataConflictFields(dataSet, sourceRow'));
});
