import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const skill=fs.readFileSync(path.join(repo,'microi.skills/v8-sql-query/SKILL.md'),'utf8');
test('事务示例两次SQL只进入当前事务，禁止普通会话写入',()=>{
  const section=skill.split('### 接口引擎事务（自动管理）')[1].split('### 扩展数据库事务')[0];
  const sample=section.match(/```(?:javascript|js)\s*\n([\s\S]*?)```/)?.[1];assert.ok(sample,'事务示例缺失');
  const writes=[],shared=[];const transaction={FromSql(sql){const call={sql,params:[]};writes.push(call);return {AddInParameter(k,v){call.params.push([k,v]);return this;},ExecuteNonQuery(){return 1;}};}};
  const context={V8:{Db:{FromSql(){throw Error('SQL未加入事务');}},DbTrans:transaction,FormEngine:{UptFormData(...args){shared.push(args);}},ApiEngine:{Run(...args){shared.push(args);}}},amount:10,fromId:'from',toId:'to'};
  assert.throws(()=>vm.runInNewContext(sample.replaceAll('V8.DbTrans.FromSql','V8.Db.FromSql'),context),/SQL未加入事务/);
  vm.runInNewContext(sample,context);
  assert.equal(writes.length,2);assert.deepEqual(writes.map(x=>x.params.length),[2,2]);assert.equal(shared.length,2);assert.ok(shared.every(x=>x[2]===transaction));
});
test('官方说明明确主库会话与当前事务边界',()=>{const doc=fs.readFileSync(path.join(repo,'microi.doc/docs/doc/v8-engine/v8-server.md'),'utf8');assert.ok(skill.includes('V8.Db.FromSql` 不会自动加入'));assert.ok(doc.includes('V8.Db.FromSql` 不会自动加入'));assert.ok(!skill.includes('V8.Db 自动开启事务'));});
