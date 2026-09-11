import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname,'../../..');
const base=path.join(root,'Microi-V8-Engine/Microi吾码 (api.itdos.com)/iTdos.Product.Internal/接口引擎');
const sources={
 'send-sms-reg':fs.readFileSync(path.join(base,'系统/[官网]注册发送短信(send-sms-reg).js'),'utf8'),
 send_sms_reg:fs.readFileSync(path.join(base,'未分类/[系统]发送阿里云短信(send_sms_reg).js'),'utf8'),
};
function fixture(){
 const hashes=new Map(),values=new Map(),expires=new Map();let serial=0,clock=Date.now();
 const state={calls:0,ip:'192.0.2.8',providerOk:true,loseConsume:false,lastCode:null};
 const key=k=>{assert.ok(k.startsWith('Microi:lxwb:'),'tenant namespace');if(expires.get(k)<=clock){hashes.delete(k);values.delete(k);}return k;};
 const Cache={
  Get:k=>values.get(key(k)),Set:(k,v)=>{values.set(key(k),v);return true;},
  Remove:k=>{key(k);return hashes.delete(k)||values.delete(k);},
  HashGet:(k,f)=>hashes.get(key(k))?.get(f)||'',
  HashSet:(k,f,v)=>{key(k);if(!hashes.has(k))hashes.set(k,new Map());const added=!hashes.get(k).has(f);hashes.get(k).set(f,v);return added;},
  HashDelete:(k,f)=>{if(state.loseConsume&&f==='data')return false;return hashes.get(key(k))?.delete(f)||false;},
  HashIncrement:(k,f,n)=>{key(k);if(!hashes.has(k))hashes.set(k,new Map());const v=Number(hashes.get(k).get(f)||0)+n;hashes.get(k).set(f,String(v));return v;},
  Expire:(k,seconds)=>{key(k);expires.set(k,clock+seconds*1000);return true;},
 };
 const Method={NewGuid:()=> (++serial).toString(16).padStart(32,'0'),GetClientIP:()=>state.ip,AddSysLog:()=>{}};
 const SysConfig={ServerPrivateSettings:{'Sms.Aliyun.AccessKeyId':'fixture-id','Sms.Aliyun.AccessKeySecret':'fixture-secret'}};
 function run(name,Param){
  assert.ok(sources[name]);
  return vm.runInNewContext('(function(){'+sources[name]+'})()',{
   V8:{Param,OsClient:'lxwb',Cache,Method,SysConfig,OsClientModel:{},ApiEngine:{Run:run},Sms:{Send:p=>{
    state.calls++;state.lastCode=JSON.parse(p.TemplateParam).code;
    return {Code:state.providerOk?1:0,Data:{Body:{Code:state.providerOk?'OK':'isv.BUSINESS_LIMIT_CONTROL',Message:'provider fixture'}}};
   }}},Date:class extends Date{constructor(...a){super(...(a.length?a:[clock]));}static now(){return clock;}}
  });
 }
 const captcha=(id='a'.repeat(32))=>{Cache.HashSet('Microi:lxwb:Captcha:'+id,'data','TeSt');Cache.Expire('Microi:lxwb:Captcha:'+id,300);return 'lxwb:Captcha:'+id;};
 return {state,run,Cache,captcha,advance:ms=>clock+=ms};
}
test('all supported current-tenant captcha prefixes dispatch once without exposing code/proof',()=>{
 for(const prefix of ['','lxwb:','Microi:lxwb:']){
  const f=fixture();f.captcha();const r=f.run('send-sms-reg',{Phone:'13812345678',_CaptchaId:prefix+'Captcha:'+'a'.repeat(32),_CaptchaValue:'test'});
  assert.equal(r.Code,1);assert.equal(f.state.calls,1);assert.match(f.state.lastCode,/^[1-9]\d{5}$/);
  assert.equal(r.Data,null);assert.doesNotMatch(JSON.stringify(r),/fixture-secret|DispatchProof|SmsCaptcha/);
  const repeat=f.run('send-sms-reg',{Phone:'13812345678',_CaptchaId:prefix+'Captcha:'+'a'.repeat(32),_CaptchaValue:'test'});
  assert.notEqual(repeat.Code,1);assert.equal(f.state.calls,1);
 }
});
test('wrong proof, missing image and cross-tenant identifiers cannot reach provider',()=>{
 for(const p of [{},{_CaptchaValue:'WRONG'},{_CaptchaId:'Microi:itdos:Captcha:'+'a'.repeat(32),_CaptchaValue:'TEST'},{OsClient:'itdos',_CaptchaValue:'TEST'}]){
  const f=fixture(),id=f.captcha();const r=f.run('send-sms-reg',{Phone:'13812345678',_CaptchaId:id,...p});assert.notEqual(r.Code,1);assert.equal(f.state.calls,0);
 }
});
test('atomic HDEL loser cannot dispatch even after reading correct image value',()=>{
 const f=fixture();f.state.loseConsume=true;const r=f.run('send-sms-reg',{Phone:'13812345678',_CaptchaId:f.captcha(),_CaptchaValue:'test'});assert.notEqual(r.Code,1);assert.equal(f.state.calls,0);
});
test('old public underscore route enforces the same image verification and supports valid callers',()=>{
 const f=fixture();assert.notEqual(f.run('send_sms_reg',{Phone:'13812345678'}).Code,1);assert.equal(f.state.calls,0);
 assert.equal(f.run('send_sms_reg',{Phone:'13812345678',_CaptchaId:f.captcha(),_CaptchaValue:'TEST'}).Code,1);assert.equal(f.state.calls,1);
});
test('forged, mismatched or consumed dispatch proof is denied before supplier',()=>{
 const f=fixture();for(const proof of ['not-a-proof','f'.repeat(32)])assert.notEqual(f.run('send_sms_reg',{Phone:'13812345678',_DispatchProof:proof}).Code,1);
 const proof='b'.repeat(32);f.Cache.HashSet('Microi:lxwb:SmsDispatchProof:'+proof,'phone','13812345678');
 assert.notEqual(f.run('send_sms_reg',{Phone:'13912345678',_DispatchProof:proof}).Code,1);
 assert.equal(f.run('send_sms_reg',{Phone:'13812345678',_DispatchProof:proof}).Code,1);
 assert.notEqual(f.run('send_sms_reg',{Phone:'13812345678',_DispatchProof:proof}).Code,1);assert.equal(f.state.calls,1);
});
test('IP and phone each have an independent five-attempt window with expiry',()=>{
 for(const dimension of ['ip','phone']){
  const f=fixture();for(let i=0;i<6;i++){
   f.advance(31000);if(dimension==='phone')f.state.ip='192.0.2.'+(10+i);
   const r=f.run('send-sms-reg',{Phone:dimension==='phone'?'13812345678':'1381234567'+i,_CaptchaId:f.captcha(String(i).repeat(32)),_CaptchaValue:'TEST'});
   assert.equal(r.Code===1,i<5);
  }assert.equal(f.state.calls,5);
  f.advance(600001);const r=f.run('send-sms-reg',{Phone:'13812345678',_CaptchaId:f.captcha('c'.repeat(32)),_CaptchaValue:'TEST'});assert.equal(r.Code,1);
 }
});
test('eight wrong image attempts deny a subsequent correct image within the window',()=>{
 const f=fixture(),id=f.captcha();for(let i=0;i<8;i++)assert.notEqual(f.run('send-sms-reg',{Phone:'13812345678',_CaptchaId:id,_CaptchaValue:'wrong'}).Code,1);
 assert.notEqual(f.run('send-sms-reg',{Phone:'13812345678',_CaptchaId:id,_CaptchaValue:'TEST'}).Code,1);assert.equal(f.state.calls,0);
});
test('supplier failure consumes proof and captcha; never automatically retry or cache a login code',()=>{
 const f=fixture();f.state.providerOk=false;const id=f.captcha();assert.notEqual(f.run('send-sms-reg',{Phone:'13812345678',_CaptchaId:id,_CaptchaValue:'TEST'}).Code,1);
 assert.equal(f.state.calls,1);assert.equal(f.Cache.Get('Microi:lxwb:SmsCaptcha:13812345678'),undefined);
 f.run('send-sms-reg',{Phone:'13812345678',_CaptchaId:id,_CaptchaValue:'TEST'});assert.equal(f.state.calls,1);
});
test('official package includes both canonical senders with Managed policies and public route compatibility',()=>{
 const pkg=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'app.microi.saas-engine.json'),'utf8'));
 for(const key of Object.keys(sources)){
  const row=pkg.SysApiEngines.find(x=>x.ApiEngineKey===key);assert.ok(row);assert.equal(row.ApiV8Code.trim(),sources[key].trim());
  assert.equal(row.AllowAnonymous,1);assert.equal(row.StopHttp,0);assert.equal(pkg.ResourcePolicies.ApiEngines[key].UpgradePolicy,'Managed');
 }const gate=pkg.SysApiEngines.find(x=>x.ApiEngineKey==='send-sms-reg');assert.equal(gate.Lock,1);assert.equal(gate.LockKey,'');
});
