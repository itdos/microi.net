import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createReminderInbox} from '../src/utils/platform-reminder-inbox.js';
const now=Date.now();
const item={Id:'Official:one:0:restart-a',Title:'启动提示',Content:'欢迎',DisplayMode:'AfterServerRestart',EndsAt:new Date(now+86400000).toISOString()};
test('two browser documents compete for a single restart presentation',async()=>{
 const claims=new Map(),visible={};
 const request=async p=>{
  if(p.Action==='Inbox')return {Code:1,Data:claims.has(item.Id)?[]:[item],DataAppend:{ActiveIds:[item.Id]}};
  if(p.Action==='Presented'){if(!claims.has(p.Id))claims.set(p.Id,p.EntryId);return {Code:1,Data:{Claimed:claims.get(p.Id)===p.EntryId}};}
  return {Code:1};
 };
 const make=id=>createReminderInbox({entryId:id,request,onChange:rows=>visible[id]=rows,schedule:()=>0,cancel:()=>{}});
 const a=make('document-a'),b=make('document-b');await Promise.all([a.refresh(),b.refresh()]);
 assert.equal(visible['document-a'].length+visible['document-b'].length,1);
 const winner=visible['document-a'].length?a:b,key=visible['document-a'].length?'document-a':'document-b';
 await winner.refresh();assert.equal(visible[key].length,1,'an owned dialog stays open across inbox reconciliation');
 await winner.close(item.Id);assert.equal(visible[key].length,0);a.dispose();b.dispose();
});
test('uncertain presentation claim is recovered with the same document identity',async()=>{
 let claimed='',failed=false,visible=[];
 const controller=createReminderInbox({entryId:'stable-document',onChange:rows=>visible=rows,schedule:()=>0,cancel:()=>{},request:async p=>{
  if(p.Action==='Inbox')return {Code:1,Data:claimed?[]:[item],DataAppend:{ActiveIds:[item.Id]}};
  if(p.Action==='Presented'){claimed=p.EntryId;if(!failed){failed=true;throw new Error('response lost')}return {Code:1,Data:{Claimed:claimed===p.EntryId}};}
  return {Code:1};
 }});
 await controller.refresh();assert.equal(visible.length,0);await controller.refresh();assert.equal(visible.length,1);controller.dispose();
});
test('withdrawal removes even an owned, still-open restart notice',async()=>{
 let active=true,visible=[];
 const c=createReminderInbox({entryId:'document',onChange:r=>visible=r,schedule:()=>0,cancel:()=>{},request:async p=>p.Action==='Presented'?{Code:1,Data:{Claimed:true}}:{Code:1,Data:active?[item]:[],DataAppend:{ActiveIds:active?[item.Id]:[]}}});
 await c.refresh();assert.equal(visible.length,1);active=false;await c.refresh();assert.equal(visible.length,0);c.dispose();
});
