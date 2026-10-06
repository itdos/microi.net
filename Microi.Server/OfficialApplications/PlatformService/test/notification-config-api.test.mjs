import test from 'node:test';
import assert from 'node:assert/strict';
import {createNotificationConfigClient} from '../src/notification-config-api.js';

test('统一通知配置使用 SDK 的 JSON 协议，动作不能被其它参数覆盖',async()=>{
 let request;const run=createNotificationConfigClient(()=>({Http:{Post:async p=>{request=p;return JSON.stringify({Code:1,Data:{Id:'one'}})}}}));
 assert.equal((await run('Validate',{Action:'Save',Rule:{Key:'test'}})).Data.Id,'one');
 assert.equal(request.Url,'/apiengine/platform-message-notification-config');assert.equal(request.ParamType,'json');assert.equal(request.PostParam.Action,'Validate');assert.equal(request.Timeout,20);
});
test('存量内置 SDK 继续使用 post 门面，保留超时与服务端错误语义',async()=>{
 const calls=[];const run=createNotificationConfigClient(()=>({post:async(...args)=>{calls.push(args);return {Code:0,Msg:'配置版本已变化'}}}));
 await assert.rejects(run('Save',{Id:'one'}),/配置版本已变化/);assert.equal(calls[0][2].timeout,20000);assert.equal(calls[0][1].Action,'Save');
});
test('异常响应不能显示为保存成功，合法空列表保持数组',async()=>{
 const bad=createNotificationConfigClient(()=>({Http:{Post:async()=>'<html>error</html>'}}));await assert.rejects(bad('Save'));
 const empty=createNotificationConfigClient(()=>({Http:{Post:async()=>({Code:1,Data:[]})}}));assert.deepEqual((await empty('List')).Data,[]);
});
