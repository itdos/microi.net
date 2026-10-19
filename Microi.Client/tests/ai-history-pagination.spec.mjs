import test from 'node:test';
import assert from 'node:assert/strict';
import { readAiConversation } from '../src/utils/ai-conversation-history.js';
test('打开会话完整分页且去重、恢复时间顺序，不在列表下载正文',async()=>{
 const calls=[];const client={PostAsync:async(_,p)=>{calls.push(p);return {Code:1,Data:p.PageIndex===1?{Records:[{__rowId:'2',CreatedAt:'2026-10-19'}],HasMore:true,NextPage:2}:{Records:[{__rowId:'2',CreatedAt:'2026-10-19'},{__rowId:'1',CreatedAt:'2026-10-18'}],HasMore:false}}}};
 assert.deepEqual((await readAiConversation(client,'ai-engine-workbench','chat')).map(x=>x.__rowId),['1','2']);
 assert.equal(calls.length,2);assert.ok(calls.every(x=>x.ConversationId==='chat'&&x.Action==='GetConversationRecords'));
});
test('后端失败与无效游标不能静默截断历史或无限循环',async()=>{
 await assert.rejects(readAiConversation({PostAsync:async()=>({Code:0,Msg:'failure'})},'ai-engine-workbench','chat'),/failure/);
 await assert.rejects(readAiConversation({PostAsync:async()=>({Code:1,Data:{HasMore:true,NextPage:1}})},'ai-engine-workbench','chat'),/分页无效/);
});
