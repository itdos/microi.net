import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const run = new (Object.getPrototypeOf(async function(){}).constructor)('V8', fs.readFileSync(new URL('./platform-ai-runtime.js', import.meta.url),'utf8'));
function fixture(rows, param = {}) {
  const calls=[];
  const v8={CurrentUser:{Id:'owner'},Param:param,ApiEngine:{Run:()=>({Code:1})},FormEngine:{GetTableData(table,q){
    calls.push(q);assert.equal(table,'mic_ai_record');
    const list=rows.filter(r=>r.UserId===q._Where[0][2]&&r.Content.includes(q._Where[1][2]));
    return {Code:1,Data:list.slice((q._PageIndex-1)*50,q._PageIndex*50),DataCount:list.length};
  }}};
  return {v8,calls,run:()=>run(v8)};
}
const record=(id,overrides={})=>({Id:'row-'+id,UserId:'owner',CreateTime:'2026-10-19',Content:JSON.stringify({Id:id,Source:'ai-engine-workbench',ConversationId:'chat-'+id,Content:'标题',...overrides})});
test('摘要分页不传回答、思考和附件，身份不能被参数覆盖',async()=>{
  const rows=Array.from({length:55},(_,i)=>record(i,{Content:'标题\n'+'正文'.repeat(100000),Thinking:'private-thinking',Attachments:['private-path']}));
  rows.push({...record('foreign'),UserId:'other'});
  const f=fixture(rows,{Action:'ListConversationSummaries',UserId:'other',OsClient:'other'}),r=await f.run();
  assert.equal(r.Code,1);assert.equal(r.Data.Conversations.length,50);assert.equal(r.Data.NextPage,2);
  assert.ok(JSON.stringify(r).length<12000);assert.ok(!JSON.stringify(r).includes('private-'));
  f.v8.Param.PageIndex=2;const next=await f.run();assert.equal(next.Data.Conversations.length,5);assert.equal(next.Data.HasMore,false);
  assert.deepEqual(f.calls[0]._Where[0],['UserId','=','owner']);
});
test('正文按会话精确匹配，排除Like近似命中和其它用户',async()=>{
  const f=fixture([record('a'),record('abc'),{...record('a'),UserId:'other'}],{Action:'GetConversationRecords',ConversationId:'chat-a'});
  const r=await f.run();assert.equal(r.Data.Records.length,1);assert.equal(r.Data.Records[0].__rowId,'row-a');
  f.v8.Param.ConversationId='%';assert.equal((await f.run()).Code,0);
  f.v8.CurrentUser={};assert.equal((await f.run()).Code,1001);
});
test('历史坏JSON不使整页失败，数据库失败不能伪装空历史',async()=>{
  const f=fixture([{Id:'bad',UserId:'owner',Content:'ai-engine-workbench invalid'}],{Action:'ListConversationSummaries'});
  assert.equal((await f.run()).Data.Conversations.length,0);
  f.v8.FormEngine.GetTableData=()=>({Code:0,Msg:'unavailable'});assert.equal((await f.run()).Msg,'unavailable');
});
