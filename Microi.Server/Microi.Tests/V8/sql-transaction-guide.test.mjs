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

// 平台工作流及表单事件协议不依赖独立 OA 产品源码。
test('工作项示例使用真实 ReceiverId/WorkState/Todo 且明确列，旧 TodoUserId/Status/Pending 被识别为错误',()=>{
 const skill=fs.readFileSync(path.join(repo,'microi.skills/v8-workflow/SKILL.md'),'utf8');
 const query=skill.slice(skill.indexOf('// 我的待办'),skill.indexOf('// 我发起的'));
 const matches=x=>/ReceiverId\s*=\s*@p0\s+AND\s+WorkState\s*=\s*@p1/.test(x)&&x.includes("'Todo'")&&!x.includes('SELECT *');
 assert.equal(matches("SELECT * FROM wf_work WHERE TodoUserId = @p0 AND Status = @p1; 'Pending'"),false);
 assert.equal(matches(query),true);
 const wfParam=fs.readFileSync(path.join(repo,'Microi.Server/Microi.Core/Param/WFParam.cs'),'utf8');
 assert.match(wfParam,/public string ReceiverId/);assert.match(wfParam,/public string WorkState/);
 const send=fs.readFileSync(path.join(repo,'Microi.Server/Microi.WorkFlow/WorkFlow.Send.cs'),'utf8');assert.ok(send.includes('currentWorkModel.WorkState != "Todo"'));
 const mine=skill.slice(skill.indexOf('// 我发起的'),skill.indexOf('// 流程历史'));assert.match(mine,/SenderId = @p0/);assert.doesNotMatch(mine,/CreateUserId|SELECT \*/);
 const deletion=fs.readFileSync(path.join(repo,'Microi.Server/Microi.net/FormEngine/FormEngineDel.cs'),'utf8');assert.match(deletion,/FormSubmitAction = "Delete"/);assert.match(deletion,/Form = deleteFormData/);assert.match(deletion,/OldForm = new \{ \}/);assert.match(skill,/Insert\/Update\/Delete/);assert.match(skill,/V8\.OldForm` 为空/);
});
