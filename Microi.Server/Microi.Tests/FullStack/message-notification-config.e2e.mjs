import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

// 复用 Full 已登录的独立 Context，只维护当前隔离租户的一条停用测试配置，不调用发送接口。
export async function verifyBusinessNotificationConfiguration(page,directory){
 const key='mci_notify_'+randomUUID().replaceAll('-','').slice(0,24),title='消息配置验收 '+key.slice(-8);
 let id;const checks=[];
 const call=(url,params)=>page.evaluate(async({url,params})=>{const sdk=window.__VUE_APP__.config.globalProperties.DiyCommon;const raw=await sdk.Http.Post({Url:url,PostParam:params,ParamType:'json',Timeout:20});return typeof raw==='string'?JSON.parse(raw):raw;},{url,params});
 const config=(Action,params={})=>call('/apiengine/platform-message-notification-config',{Action,...params});
 try{
  await page.evaluate(()=>{window.location.hash='#/micro-app/microi-platform-service/platform-reminders'});
  const root=page.locator('.mci-reminders:visible');await root.getByRole('heading',{name:'消息通知',exact:true}).waitFor({timeout:60000});
  await root.getByRole('button',{name:'业务通知',exact:true}).click();
  await root.getByLabel('消息名称',{exact:false}).fill(title);await root.getByLabel('消息 Key',{exact:false}).fill(key);
  await root.locator('.mci-business__editor>header').getByLabel('启用',{exact:true}).uncheck();
  const saved=page.waitForResponse(r=>r.url().includes('/apiengine/platform-message-notification-config')&&r.request().postData()?.includes('"Save"'));
  await root.getByRole('button',{name:'保存配置',exact:true}).click();const savedResult=await(await saved).json();assert.equal(savedResult.Code,1,savedResult.Msg);id=savedResult.Data.Rule.Id;
  const read=await config('Get',{Id:id});assert.equal(read.Code,1,read.Msg);assert.equal(read.Data.Key,key);assert.equal(read.Data.IsEnable,false);assert.equal(read.Data.ConfigRevision,1);checks.push('微服务表单保存原 mic_msgset 并回读');
  const physical=await call('/api/FormEngine/GetFormData',{FormEngineKey:'mic_msgset',Id:id,_SelectFields:['Id','Key','Title','IsEnable','ConfigRevision']});assert.equal(physical.Code,1,physical.Msg);assert.equal(physical.Data.Key,key);
  const updatedTitle=title+' 已修改';await root.getByLabel('消息名称',{exact:false}).fill(updatedTitle);
  const edited=page.waitForResponse(r=>r.url().includes('/apiengine/platform-message-notification-config')&&r.request().postData()?.includes('"Save"'));
  await root.getByRole('button',{name:'保存配置',exact:true}).click();assert.equal((await(await edited).json()).Code,1);
  const conflict=await config('Save',{Id:id,ExpectedRevision:1,Rule:{...read.Data,Title:'不应覆盖'}});assert.equal(conflict.Code,0);
  const final=await config('Get',{Id:id});assert.equal(final.Data.Title,updatedTitle);assert.equal(final.Data.ConfigRevision,2);checks.push('并发版本冲突拒绝且保留新内容');
  const logs=await config('Logs',{ConfigId:id});assert.equal(logs.Code,1,logs.Msg);assert.equal(logs.DataCount,0);checks.push('配置保存没有发送消息或制造投递记录');
  await fs.mkdir(directory,{recursive:true});await root.screenshot({path:path.join(directory,'message-business-configuration.png')});
  await root.getByRole('button',{name:'投递记录',exact:true}).click();await root.locator('.mci-business__hint').waitFor();checks.push('统一入口可切换投递记录');
 }finally{
  // 即使保存回包丢失，也按本次唯一 Key 找回自己的记录后清理，不触碰既有配置。
  if(!id){const list=await config('List',{Keyword:key,PageSize:10});assert.equal(list.Code,1,list.Msg);id=(list.Data||[]).find(row=>row.Key===key)?.Id;}
  if(id){const deleted=await call('/api/FormEngine/DelFormData',{FormEngineKey:'mic_msgset',Id:id});assert.equal(deleted.Code,1,deleted.Msg);const list=await config('List',{Keyword:key,PageSize:10});assert.equal(list.Code,1);assert.ok(!list.Data.some(row=>row.Key===key));}
 }
 assert.equal(checks.length,4);await fs.writeFile(path.join(directory,'message-business-configuration-results.json'),JSON.stringify({checks,cleaned:true,externalMessagesSent:0},null,2));return {passed:checks.length,failed:0,skipped:0};
}
