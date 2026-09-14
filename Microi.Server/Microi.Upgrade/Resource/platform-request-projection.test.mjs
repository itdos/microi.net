import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('./platform-sys-menu.js',import.meta.url),'utf8');
function run(param,{user={Id:'trusted-user'},hook={Code:1}}={}){
 let captured,hookCalls=0;
 const V8={Param:param,CurrentUser:user,ApiEngine:{Run(){hookCalls++;return hook;}},Method:{ManageSystemDirectory(p){captured=p;return {Code:1};}}};
 return {result:vm.runInNewContext('(function(){'+code+'})()',{V8}),get captured(){return captured;},hookCalls};
}
test('menu drops the unused full identity before crossing the CLR boundary',()=>{
 const param={Action:'GetSysMenuStep',_SelectFields:['Id','Name'],_Where:[['Display','=',1]]};
 Object.defineProperty(param,'_CurrentUser',{enumerable:true,get(){throw Error('must not traverse identity');}});
 const r=run(param);assert.equal(r.result.Code,1);assert.equal(Object.hasOwn(r.captured.Param,'_CurrentUser'),false);
 assert.equal(Object.hasOwn(param,'_CurrentUser'),true);assert.notEqual(r.captured.Param,param);
 assert.equal(r.captured.Param._Where,param._Where);assert.equal(r.captured.Param._SelectFields,param._SelectFields);
});
test('menu projection preserves all business parameters, nulls and prototype-looking keys',()=>{
 const param=JSON.parse('{"Action":"UptSysMenu","Id":"menu","Name":"中文","MoreBtns":[{"Id":"b"}],"Empty":null,"__proto__":{"safe":1},"constructor":"value","_CurrentUser":{"Id":"untrusted"}}');
 const r=run(param);assert.equal(r.result.Code,1);const expected={...param};delete expected._CurrentUser;
 assert.deepEqual(JSON.parse(JSON.stringify(r.captured.Param)),expected);assert.equal(Object.getPrototypeOf(r.captured.Param),null);
 assert.equal(param._CurrentUser.Id,'untrusted');
});
test('menu projection keeps legacy read actions pinned and preserves customization veto',()=>{
 const r=run({Action:'DelSysMenu',_RequestPath:'/api/SysMenu/GetSysMenuStep',_CurrentUser:{Id:'ignored'}});
 assert.equal(r.captured.Action,'GetSysMenuStep');assert.equal(r.hookCalls,1);
 const denied=run({Action:'GetSysMenuStep'},{hook:{Code:0,Msg:'custom denied'}});
 assert.equal(denied.result.Code,0);assert.equal(denied.captured,undefined);
});
test('anonymous and unknown menu operations do not enter the trusted atom',()=>{
 for(const [param,options] of [[{Action:'GetSysMenuStep'},{user:null}],[{Action:'Unknown'},{}]]){
  const r=run(param,options);assert.notEqual(r.result.Code,1);assert.equal(r.captured,undefined);assert.equal(r.hookCalls,0);
 }
});

for(const [key,method] of [['platform-private-file-url','GetAuthorizedPrivateFileUrl'],['platform-background-task','ManageBackgroundTask']]){
 function execute(param,{user={Id:'trusted'},hook={Code:1},result={Code:1}}={}){
  let captured,hookCalls=0;
  const source=fs.readFileSync(new URL('./'+key+'.js',import.meta.url),'utf8');
  const V8={Param:param,CurrentUser:user,ApiEngine:{Run(){hookCalls++;return hook;}},Method:{[method](p){captured=p;return result;}}};
  return {result:vm.runInNewContext('(function(){'+source+'})()',{V8}),captured,hookCalls};
 }
 test(key+' excludes only internal identity before the trusted CLR atom',()=>{
  const param=JSON.parse('{"Action":"List","FilePathName":"private/a.pdf","Empty":null,"__proto__":{"safe":1},"constructor":"value","Nested":{"ok":true}}');
  Object.defineProperty(param,'_CurrentUser',{enumerable:true,get(){throw Error('identity must not be projected');}});
  const r=execute(param);assert.equal(r.result.Code,1);assert.equal(Object.hasOwn(r.captured,'_CurrentUser'),false);
  assert.notEqual(r.captured,param);assert.equal(Object.getPrototypeOf(r.captured),null);assert.equal(r.captured.Nested,param.Nested);
  assert.deepEqual(JSON.parse(JSON.stringify(r.captured)),{Action:'List',FilePathName:'private/a.pdf',Empty:null,['__proto__']:{safe:1},constructor:'value',Nested:{ok:true}});
  assert.equal(Object.hasOwn(param,'_CurrentUser'),true);
 });
 if(key==='platform-private-file-url'){
  test('private file preserves both legacy routes and current hook denials',()=>{
   for(const route of ['/api/hdfs/getprivatefileurl','/api/hdfs/mallfileurl']){
    const r=execute({ApiAddress:route,FilePathName:'a',_CurrentUser:{Id:'forged'}},{user:null});
    assert.equal(r.result.Code,1);assert.equal(r.captured.ApiAddress,route);assert.equal(Object.hasOwn(r.captured,'_CurrentUser'),false);assert.equal(r.hookCalls,0);
   }
   const rejected=execute({FilePathName:'a'},{hook:{Code:0,Msg:'denied'}});assert.equal(rejected.result.Code,0);assert.equal(rejected.captured,undefined);
   const anonymous=execute({FilePathName:'a'},{user:null});assert.equal(anonymous.result.Code,1001);assert.equal(anonymous.captured,undefined);
  });
  test('private file keeps failure and successful after hook behavior',()=>{
   assert.equal(execute({FilePathName:'a'},{result:{Code:0}}).hookCalls,1);
   assert.equal(execute({FilePathName:'a'}).hookCalls,2);
  });
 }else{
  test('background task keeps action whitelist and minimal durable submission result',()=>{
   const denied=execute({Action:'Unknown'});assert.equal(denied.result.Code,0);assert.equal(denied.captured,undefined);
   const payload={Code:1,Data:{Id:'task',Status:'Pending',Log:'sensitive log',Result:'detail',Msg:'ok'}};
   const r=execute({Action:'RunApiEngine',ApiEngineKey:'business',_CurrentUser:{Id:'forged'}},{result:payload});
   assert.equal(r.result.Code,1);assert.equal(r.captured.ApiEngineKey,'business');assert.equal(r.result.Data.Id,'task');
   assert.equal(r.result.Data.Log,undefined);assert.equal(r.result.Data.Result,undefined);assert.equal(r.result.Data.HasLog,true);
  });
 }
}
