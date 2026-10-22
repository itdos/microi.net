import assert from 'node:assert/strict';
import test from 'node:test';
import { createRuntime } from './platform-chat-runtime-resource.test.mjs';

test('历史页不能在当年第一个月截止：兼容旧年度集合并按需返回跨年消息', () => {
  const runtime = createRuntime();
  runtime.collection('chat_2025').set('a'.repeat(24), { _id:'a'.repeat(24), MessageId:'a'.repeat(24), FromUserId:'user-2',ToUserId:'user-1',Content:'去年需求',CreateTime:'2025-12-31 23:59:00' });
  runtime.collection('chat_202601').set('b'.repeat(24), { _id:'b'.repeat(24), MessageId:'b'.repeat(24), FromUserId:'user-1',ToUserId:'user-2',Content:'一月答复',CreateTime:'2026-01-01 00:01:00' });
  const result = runtime.run({ Action:'GetHistoryAndMarkRead', PeerUserId:'user-2', PageSize:20, CursorMode:true });
  assert.equal(result.Code, 1);
  assert.deepEqual(result.Data.Messages.map(row => row.Content), ['去年需求','一月答复']);
});

test('游标跨空月和跨年、同时间多消息、旧年表与新月表重复均不丢失或重复', () => {
  const runtime=createRuntime();
  const records=[
    ['chat_2024','1','2024-12-31 23:00:00'],
    ['chat_202512','2','2025-12-31 23:00:00'],
    ['chat_202601','3','2026-01-31 23:00:00'],
    ['chat_202603','4','2026-03-01 00:00:00'],
    ['chat_202603','5','2026-03-01 00:00:00']
  ];
  for (const [table,id,time] of records) runtime.collection(table).set(id.repeat(24),{
    _id:id.repeat(24),MessageId:id.repeat(24),FromUserId:'user-2',ToUserId:'user-1',Content:id,CreateTime:time,IsRead:false
  });
  runtime.collection('chat_2026').set('3'.repeat(24),{...runtime.collection('chat_202601').get('3'.repeat(24))});
  let cursor='', more=true, contents=[];
  while(more){
    const page=runtime.run({Action:'GetHistoryAndMarkRead',PeerUserId:'user-2',PageSize:2,CursorMode:true,Cursor:cursor});
    assert.equal(page.Code,1);
    contents.unshift(...page.Data.Messages.map(row=>row.Content));
    assert.notEqual(page.Data.NextCursor,cursor);
    cursor=page.Data.NextCursor;more=page.Data.HasMore;
  }
  assert.deepEqual(contents,['1','2','3','4','5']);
  const reads=runtime.calls.filter(([name])=>name==='GetPartitionedTableData').map(([,request])=>request).filter(request=>!request.CountOnly);
  assert.equal(reads.length,3);
  assert.ok(reads.every(request=>request.PageSize===2));
});

test('新写年度库月度集合，月末后相同请求仍命中原始事实并保留发生时间', () => {
  let now='2026-12-31 23:59:59';
  const system={DateTime:{Now:{ToString:format=>format==='yyyy'?now.slice(0,4):now}}};
  const runtime=createRuntime({system});
  const request={Action:'PersistMessage',RequestId:'year-end',ToUserId:'user-2',Content:'不能重复'};
  const first=runtime.run(request);
  assert.equal(first.Code,1);
  const firstWrite=runtime.calls.find(([name,input])=>name==='AddFormData'&&input.TableName==='chat_202612');
  assert.equal(firstWrite[1].DbName,'diy_chat_tenant-a_2026');
  assert.ok(firstWrite[1].OccurredAt);
  now='2027-01-01 00:00:01';
  const retried=runtime.run(request);
  assert.equal(retried.Code,1);
  assert.equal(retried.DataAppend.Duplicate,true);
  assert.equal(runtime.messages.size,1);
  assert.equal(runtime.calls.some(([name,input])=>name==='AddFormData'&&input.TableName==='chat_202701'),false);
});

test('分页读取只标记本页来信，跨年未展示消息仍保留未读', () => {
  const runtime=createRuntime();
  for(const [id,table,time]of [['a','chat_2025','2025-12-31'],['b','chat_202601','2026-01-31']])
    runtime.collection(table).set(id.repeat(24),{_id:id.repeat(24),MessageId:id.repeat(24),FromUserId:'user-2',ToUserId:'user-1',Content:id,CreateTime:time,IsRead:false});
  const page=runtime.run({Action:'GetHistoryAndMarkRead',PeerUserId:'user-2',PageSize:1,CursorMode:true});
  assert.equal(page.Code,1);
  assert.equal(runtime.collection('chat_2025').get('a'.repeat(24)).IsRead,false);
  assert.equal(runtime.collection('chat_202601').get('b'.repeat(24)).IsRead,true);
  assert.equal(page.Data.UnreadCount,1);
});
