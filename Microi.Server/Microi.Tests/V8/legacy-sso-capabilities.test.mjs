import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const pkg=JSON.parse(fs.readFileSync(new URL('../../Microi.Upgrade/Resource/app.microi.sso.json',import.meta.url),'utf8'));
const code=pkg.SysApiEngines.find(x=>x.ApiEngineKey==='sso_legacy_capabilities').ApiV8Code;
function project(rows){
 const result=vm.runInNewContext(`(function(){${code}\n})()`,{V8:{FormEngine:{GetTableData:()=>({Code:1,Data:rows})}}});
 return JSON.parse(JSON.stringify(result));
}
test('legacy configured platform TokenLogin remains available without an external identity hop',()=>{
 const result=project([{Id:'native',IsEnable:1,ClientSsoApi:'/api/SysUser/TokenLogin',TokenName:'token',GetTokenType:'Url'}]);
 assert.equal(result.Code,1);
 assert.deepEqual(result.Data,[{Id:'native',IsEnable:true,ClientSsoApi:'/api/SysUser/TokenLogin',TokenName:'token',GetTokenType:'Url'}]);
});
test('native token login and external legacy provider keep separate validation paths',()=>{
 const result=project([
  {Id:'native',IsEnable:'true',ClientSsoApi:'/API/SYSUSER/TOKENLOGIN',TokenName:'platform_ticket'},
  {Id:'external',IsEnable:true,ClientSsoApi:'/api/SysUser/SsoPengrui',TokenName:'external_ticket',ServerSsoApi:'https://id.example/private'}
 ]);
 assert.equal(result.Data.length,2);
 assert.equal(result.Data[0].ClientSsoApi,'/api/SysUser/TokenLogin');
 assert.equal(result.Data[1].ClientSsoApi,'/apiengine/sso_legacy_token_login');
 assert.equal(JSON.stringify(result).includes('https://id.example'),false);
});
for(const route of ['https://evil.example/api/SysUser/TokenLogin','//evil.example/api/SysUser/TokenLogin','/api/SysUser/TokenLogin?next=evil','/api/SysUser/TokenLoginExtra'])
 test(`unsafe or lookalike compatibility endpoint is excluded: ${route}`,()=>{
  assert.deepEqual(project([{IsEnable:1,ClientSsoApi:route,TokenName:'token'}]).Data,[]);
 });
test('disabled, unconfigured and invalid-name legacy sessions do not become URL login bypasses',()=>{
 assert.deepEqual(project([
  {IsEnable:0,ClientSsoApi:'/api/SysUser/TokenLogin',TokenName:'token'},
  {IsEnable:1,ClientSsoApi:'/api/SysUser/TokenLogin',TokenName:'token|other'},
  {IsEnable:1,SsoKey:'oidc',ClientSsoApi:'/api/SysUser/TokenLogin',TokenName:'token'}
 ]).Data,[]);
 assert.deepEqual(project([]).Data,[]);
});
