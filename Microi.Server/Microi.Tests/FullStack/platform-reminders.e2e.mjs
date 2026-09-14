import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {verifyBusinessNotificationConfiguration} from './message-notification-config.e2e.mjs';
const {chromium}=createRequire(new URL('../../../Microi.Client/package.json',import.meta.url))('playwright');

// 此专项使用真实登录和真实接口，只发送给测试账号本人；失败也撤回本次创建的规则。
// 独立执行需 MICROI_TEST_ALLOW_WRITES=YES 及统一 FullStack 登录环境。
async function runtime(page,Action,params={}) {
 return page.evaluate(async({Action,params})=>{
  const sdk=window.__VUE_APP__.config.globalProperties.DiyCommon;
  const raw=await sdk.Http.Post({Url:'/apiengine/platform-reminder-runtime',ParamType:'json',PostParam:{Action,...params},Timeout:15});
  return typeof raw==='string'?JSON.parse(raw):raw;
 },{Action,params});
}
async function ready(page){await page.waitForFunction(()=>window.__VUE_APP__?.config.globalProperties.DiyCommon?.getToken()&&window.__MICROI_REMINDER_ENTRY_ID__);}
async function acknowledgeExistingReminders(page) {
 // 真实租户可能已有官方启动提醒。按真实用户操作确认测试账号当前队列，
 // 不能让它挡住新建测试提醒，也不能关闭功能、改优先级或跳过新提醒断言。
 const isAction=(response,action)=>response.url().includes('/apiengine/platform-reminder-runtime')
  && response.request().postData()?.includes(action);
 const inbox=page.waitForResponse(response=>isAction(response,'Inbox'));
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 const result=await(await inbox).json();assert.equal(result.Code,1,result.Msg);
 const visible=page.locator('.mci-platform-reminder:visible');
 if(result.Data?.length)await visible.first().waitFor({state:'visible',timeout:15000});
 const acknowledged=[];
 for(let i=0;i<10&&await visible.count();i++) {
  const title=await visible.first().locator('.el-dialog__title').innerText();
  assert.ok(!title.startsWith('平台提醒自动回归'),'发现其它尚未收尾的回归提醒，不能代为确认');
  const receipt=page.waitForResponse(response=>isAction(response,'Acknowledge'));
  await visible.first().getByRole('button',{name:'我知道了'}).click();
  const response=await(await receipt).json();assert.equal(response.Code,1,response.Msg);acknowledged.push(title);
  await page.locator('.mci-platform-reminder').evaluateAll(async elements=>{
   await Promise.all(elements.flatMap(element=>element.getAnimations({subtree:true})).map(animation=>animation.finished.catch(()=>{})));
  });
 }
 assert.equal(await visible.count(),0,'已有提醒队列必须先由测试账号确认');
 return acknowledged;
}
export async function verifyPlatformReminders(page,directory) {
 await fs.mkdir(directory,{recursive:true});await ready(page);
 const context=await runtime(page,'Capabilities');assert.equal(context.Code,1,context.Msg);assert.equal(context.Data.Administrator,true);
 const baselineAcknowledged=await acknowledgeExistingReminders(page);
 const created=[],checks=[];
 const dialog=title=>page.locator('.mci-platform-reminder:visible').filter({hasText:title});
 const withdraw=async saved=>{const result=await runtime(page,'Withdraw',{Id:saved.Id,ExpectedRevision:saved.Revision});assert.equal(result.Code,1,result.Msg);};
 async function publish(mode,extra={}) {
  const now=Date.now(),title='平台提醒自动回归 '+randomUUID().slice(0,8);
  const rule={Title:title,Content:'仅供当前测试账号验收，不发送给其它用户。',Icon:'bell',Severity:'info',ScopeType:'Users',TargetKeys:[context.Data.UserId],
   AllTargets:false,ReminderType:'Announcement',DisplayMode:mode,StartsAt:new Date(now-1000).toISOString(),EndsAt:new Date(now+180000).toISOString(),RepeatMode:'None',...extra};
  const saved=await runtime(page,'Save',{Rule:rule,RequestId:randomUUID()});assert.equal(saved.Code,1,saved.Msg);created.push(saved.Data);
  const request={Id:saved.Data.Id,ExpectedRevision:saved.Data.Revision,RequestId:randomUUID()};
  const first=await runtime(page,'Publish',request);assert.equal(first.Code,1,first.Msg);
  const again=await runtime(page,'Publish',request);assert.equal(again.Code,1,again.Msg);assert.equal(again.Data.Id,first.Data.Id);assert.equal(again.Data.AlreadyPublished,true);
  return {...saved.Data,title,batchId:first.Data.Id,rule};
 }
 let stopped=false;
 try {
  const once=await publish('Once');await dialog(once.title).waitFor({state:'visible',timeout:75000});
  // 等入场动画结束再量位置，不能把 Element Plus 的过渡位移当成布局偏差。
  await dialog(once.title).evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})));});
  await page.waitForTimeout(450);
  const box=await dialog(once.title).boundingBox(),viewport=page.viewportSize();
  assert.ok(Math.abs(box.x+box.width/2-viewport.width/2)<4,JSON.stringify({box,viewport}));assert.ok(Math.abs(box.y+box.height/2-viewport.height/2)<4,JSON.stringify({box,viewport}));
  await dialog(once.title).screenshot({path:path.join(directory,'reminder-dialog.png')});
  const header=await dialog(once.title).locator('.el-dialog__header').boundingBox();
  await page.mouse.move(header.x+100,header.y+15);await page.mouse.down();await page.mouse.move(header.x+155,header.y+55);await page.mouse.up();
  assert.ok((await dialog(once.title).boundingBox()).x>box.x+30);
  const ack=page.waitForResponse(r=>r.url().includes('/apiengine/platform-reminder-runtime')&&r.request().postData()?.includes('Acknowledge'));
  await dialog(once.title).getByRole('button',{name:'我知道了'}).click();assert.equal((await(await ack).json()).Code,1);
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);
  const entry=await page.evaluate(()=>window.__MICROI_REMINDER_ENTRY_ID__);
  const inbox=await runtime(page,'Inbox',{EntryId:entry});assert.equal(inbox.Code,1,inbox.Msg);assert.ok(!inbox.Data.some(x=>x.BatchId===once.batchId));
  await withdraw(once);checks.push('重复发布复用批次、居中拖动、关闭回执、刷新后仅一次');

  const every=await publish('EveryEntry');await dialog(every.title).waitFor({state:'visible',timeout:75000});
  const ackEvery=page.waitForResponse(r=>r.url().includes('/apiengine/platform-reminder-runtime')&&r.request().postData()?.includes('Acknowledge'));
  await dialog(every.title).getByRole('button',{name:'我知道了'}).click();assert.equal((await(await ackEvery).json()).Code,1);
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);
  assert.notEqual(await page.evaluate(()=>window.__MICROI_REMINDER_ENTRY_ID__),entry);
  await dialog(every.title).waitFor({state:'visible',timeout:75000});await withdraw(every);
  await dialog(every.title).waitFor({state:'hidden',timeout:75000});checks.push('每次刷新再次显示、撤回收回');

  await page.evaluate(async()=>{const socket=window.__VUE_APP__.config.globalProperties.$websocket;await socket?.stop();window.__MICROI_REALTIME_STATE__={state:'Disconnected'};window.dispatchEvent(new Event('online'));});stopped=true;
  const timing=Date.now(),timed=await publish('Once',{ReminderType:'Scheduled',StartsAt:new Date(timing+5000).toISOString(),EndsAt:new Date(timing+40000).toISOString()});
  await dialog(timed.title).waitFor({state:'visible',timeout:35000});
  assert.equal(await page.evaluate(()=>window.__VUE_APP__.config.globalProperties.$websocket?.state),'Disconnected');
  await dialog(timed.title).screenshot({path:path.join(directory,'reminder-polling.png')});
  await dialog(timed.title).waitFor({state:'hidden',timeout:45000});await withdraw(timed);checks.push('SignalR 断线时定时轮询触发、过期自动收回');
  const invalid=await runtime(page,'Save',{Rule:{...timed.rule,EndsAt:new Date(Date.now()+60000).toISOString(),ScopeType:'Editions',TargetKeys:['Unknown']}});
  assert.equal(invalid.Code,0);checks.push('非法产品版本拒绝');

  const restart=await publish('AfterServerRestart',{AccountScope:'SuperAdmins',LinkUrl:'https://microi.net/doc/edition-comparison.html',LinkText:'查看版本对比'});
  await dialog(restart.title).waitFor({state:'visible',timeout:75000});
  const popupPromise=page.context().waitForEvent('page');await dialog(restart.title).getByRole('link',{name:'查看版本对比'}).click();
  const popup=await popupPromise;await popup.waitForURL('https://microi.net/doc/edition-comparison.html');await popup.close();
  // 不关闭公告直接刷新；领取回执必须已经持久化，不能依赖关闭按钮或浏览器缓存去重。
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);
  const afterRestart=await runtime(page,'Inbox',{EntryId:await page.evaluate(()=>window.__MICROI_REMINDER_ENTRY_ID__)});
  assert.equal(afterRestart.Code,1,afterRestart.Msg);assert.ok(!afterRestart.Data.some(item=>item.BatchId===restart.batchId));
  assert.equal(await dialog(restart.title).count(),0);await withdraw(restart);checks.push('重启公告展示即领取、未关闭刷新不重复、版本链接新开页面');
 } finally {
  for(const row of created)await withdraw(row);
  await fs.writeFile(path.join(directory,'reminder-results.json'),JSON.stringify({checks,created,baselineAcknowledged,allWithdrawn:true},null,2));
  // 刷新页面会重建并连接 Hub；只恢复仍断开的连接，避免清理异常覆盖真实断言结果。
  if(stopped)await page.evaluate(async()=>{const socket=window.__VUE_APP__.config.globalProperties.$websocket;if(socket?.state==='Disconnected')await socket.start();window.dispatchEvent(new Event('online'));});
 }
 assert.equal(checks.length,5);return {passed:checks.length,failed:0,skipped:0,created};
}
if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
 const required=name=>{const value=process.env[name]?.trim();if(!value)throw Error('需要 '+name);return value;};
 assert.equal(required('MICROI_TEST_ALLOW_WRITES'),'YES');
 const apiBase=required('MICROI_TEST_API_BASE'),tenant=required('MICROI_TEST_OSCLIENT');
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
 try {
  const context=await browser.newContext({ignoreHTTPSErrors:new URL(apiBase).hostname==='localhost',viewport:{width:1440,height:1000}});
  const page=await context.newPage();page.setDefaultTimeout(30000);
  await page.goto(`${required('MICROI_TEST_FRONTEND_BASE')}/?OsClient=${encodeURIComponent(tenant)}&ApiBase=${encodeURIComponent(apiBase)}`,{waitUntil:'domcontentloaded'});
  await page.getByPlaceholder(/用户名|账号|帐号|username/i).first().fill(required('MICROI_TEST_ACCOUNT'));
  await page.getByPlaceholder(/密码|password/i).first().fill(required('MICROI_TEST_PASSWORD'));
  const box=page.locator('.privacy-policy-wrapper .el-checkbox').first();if(await box.count()&&!(await box.locator('input').isChecked()))await box.click();
  const login=page.waitForResponse(r=>r.url().includes('/api/SysUser/Login'));await page.getByRole('button',{name:/^登\s*录$/}).click();assert.equal((await(await login).json()).Code,1);
  const directory=path.resolve(process.argv[2]||'.tmp/platform-reminder-tests');
  const result=await verifyPlatformReminders(page,directory);const configuration=await verifyBusinessNotificationConfiguration(page,directory);console.log(JSON.stringify({reminders:result,businessConfiguration:configuration}));
 }finally{await browser.close();}
}
