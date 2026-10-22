import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {buildBootstrapPackage} from './build-bootstrap-package.mjs';
const root=import.meta.dirname;
const source=key=>fs.readFileSync(`${root}/${key}.js`,'utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const runConfig=v8=>new AsyncFunction('V8',source('platform-sys-config'))(v8);

test('公开配置新原子链不调用旧门面，不透传原始附加数据，不改变业务配置', async()=>{
  const original={SysTitle:'Tenant A',Secret:'hidden'};let calls=0;
  const result=await runConfig({OsClient:'tenant-a',Param:{_Lang:'zh-CN'},FormEngine:{GetSysConfig:async(t,l)=>{
    assert.equal(t,'tenant-a');assert.equal(l,'zh-CN');return {Code:1,Data:original,DataAppend:{Password:'hidden'}};
  }},Method:{ProjectPublicSysConfig:r=>{calls++;assert.equal(r,original);return {Code:1,Data:{SysTitle:r.SysTitle}};},
    GetPlatformEdition:()=> '企业版',GetLoginEncryptionPublicKey:()=> 'public-key',
    GetPublicSysConfig:()=>{throw Error('不应进入旧门面');}}});
  assert.equal(calls,1);assert.deepEqual(result,{Code:1,Data:{SysTitle:'Tenant A',PlatformEdition:'企业版',LoginRsaPublicKey:'public-key'},Msg:'',DataAppend:null});
  assert.deepEqual(original,{SysTitle:'Tenant A',Secret:'hidden'});
});
test('失败分类不返回连接凭据，且不得在新原子失败后调用旧门面',async()=>{
  for(const msg of ['access denied for user Password=secret','unknown database password=secret','connection refused password=secret']){
    const result=await runConfig({Param:{},FormEngine:{GetSysConfig:async()=>({Code:0,Msg:msg})},Method:{
      ProjectPublicSysConfig:()=>{throw Error('不应投影');},GetPublicSysConfig:()=>{throw Error('不应回退');}}});
    assert.equal(result.Code,0);assert.equal(result.DataAppend.ErrorType,'TenantDatabaseConnection');assert.doesNotMatch(JSON.stringify(result),/secret|Password=/);
  }
});
test('仅宿主没有新原子时允许旧版安全投影，绝不公开 V8.SysConfig',async()=>{
  const result=await runConfig({SysConfig:{Password:'secret'},Method:{GetPublicSysConfig:()=>({Code:1,Data:{SysTitle:'legacy'},DataAppend:{Secret:'secret'}})}});
  assert.equal(result.Data.SysTitle,'legacy');assert.doesNotMatch(JSON.stringify(result),/secret/);
});
test('授权页普通账号可看公开状态，不能读取授权主体或主租户节点',()=>{
  const scope={Code:1,Data:{IsAdministrator:false,IsMainTenant:true,CurrentOsClient:'tenant-a',CanReadServerNodes:false}};
  const V8={CurrentUser:{Id:'user'},Method:{ReadLicenseAccessScope:()=>scope,
    ReadLicenseVerification:()=>({Code:1,Data:{IsLicensed:true,ProductType:'Enterprise',HID:'private',Company:'private'}}),
    ReadAiLicenseVerification:()=>({Code:1,Data:{OnlineAiLicensed:true}}),
    ReadLicenseSubject:()=>{throw Error('普通用户不能读主体');},ReadLicenseServerNodes:()=>{throw Error('普通用户不能读节点');}}};
  const state=new Function('V8',source('platform-license-management-state'))(V8);
  assert.equal(state.Code,1);assert.equal(state.Data.CanManageLicense,false);assert.equal(state.Data.IsLicensed,true);assert.doesNotMatch(JSON.stringify(state),/private/);
  const nodes=new Function('V8',source('platform-license-server-nodes'))(V8);assert.equal(nodes.Code,1);assert.deepEqual(nodes.Data,[]);
  scope.Data.IsAdministrator=true;scope.Data.IsMainTenant=false;
  const childState=new Function('V8',source('platform-license-management-state'))(V8);
  assert.equal(childState.Code,1);assert.equal(childState.Data.CanManageLicense,false);assert.doesNotMatch(JSON.stringify(childState),/private/);
  V8.CurrentUser=null;assert.equal(new Function('V8',source('platform-license-management-state'))(V8).Code,1001);
});

test('缺少授权原子的旧宿主返回明确兼容提示，失败不伪装成功',()=>{
  for(const key of ['platform-license-management-state','platform-license-server-nodes']) {
    const result=new Function('V8',source(key))({CurrentUser:{Id:'user'},Method:{}});
    assert.equal(result.Code,0);assert.equal(result.DataAppend.ErrorCode,'LicenseReadAtomsUnavailable');
  }
});
test('最小恢复投影包含公开配置与登录商城，不包括可选授权管理',()=>{
  const pkg=buildBootstrapPackage();const keys=pkg.SysApiEngines.map(e=>e.ApiEngineKey);
  for(const key of ['platform-sys-config','platform-sys-user-session','platform-sys-menu','import-microi-store-package']) assert.ok(keys.includes(key));
  for(const key of ['platform-license-management-state','platform-license-server-nodes','platform-ai-runtime']) assert.ok(!keys.includes(key));
  assert.match(pkg.SysApiEngines.find(e=>e.ApiEngineKey==='platform-sys-config').ApiV8Code,/PUBLIC_SYS_CONFIG_ORCHESTRATION_V2/);
  assert.deepEqual(pkg.ScheduleJobs,[]);assert.deepEqual(pkg.DataSets,[]);
});
