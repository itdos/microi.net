import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const execute = new Function('V8', fs.readFileSync(new URL('./platform-user-update-preferences.js', import.meta.url), 'utf8'));
function run(Param, CurrentUser = { Id: 'signed-user' }, behavior = {}) {
  let saved;
  const hooks = [];
  const result = execute({ Param, CurrentUser, OsClient: 'isolated',
    ApiEngine: { Run(key, body) { hooks.push({key,body}); return behavior.hook || {Code:1}; } },
    FormEngine: { UptFormData(table, model) { assert.equal(table,'sys_user'); saved=model; return behavior.save || {Code:1}; } },
    Method: { RefreshLoginUser(id, tenant) { assert.equal(id,CurrentUser.Id); assert.equal(tenant,'isolated'); return {Code:1,Data:{...CurrentUser,...saved}}; } },
  });
  return {result,saved,hooks};
}

test('appearance persists a strict whitelist for the authenticated user', () => {
  const {result,saved}=run({UiDensityScale:95,DisableGradient:true,DisableShadow:'0',DisableButtonIcon:1,LoginStyle:'split',Id:'other',OsClient:'other',Level:9999});
  assert.equal(result.Code,1);
  assert.deepEqual(saved,{Id:'signed-user',UiDensityScale:95,DisableGradient:1,DisableShadow:0,DisableButtonIcon:1,LoginStyle:'Split'});
});
test('reset removes overrides instead of freezing the current system values', () => {
  const user={Id:'signed-user',ThemeColor:'#123456',ThemeMode:'dark',CornerStyle:'square',NavigationLayout:'Top',MenuChildExpandMode:'Right',UiDensityScale:110,DisableGradient:1,DisableShadow:0,DisableButtonIcon:1,LoginStyle:'Console'};
  const reset={ThemeColor:'',ThemeMode:'',CornerStyle:'System',NavigationLayout:'System',MenuChildExpandMode:'System',UiDensityScale:null,DisableGradient:null,DisableShadow:null,DisableButtonIcon:null,LoginStyle:'System'};
  const {result,saved}=run(reset,user);
  assert.equal(result.Code,1);
  assert.deepEqual(saved,{Id:'signed-user',...reset});
});
test('appearance density rejects unsupported values without writing', () => {
  for(const value of [89,111,92,95.5,'95px',Infinity,{},true]) {
    const {result,saved}=run({UiDensityScale:value});
    assert.equal(result.Code,0,String(value));assert.equal(saved,undefined);
  }
  for(const value of [90,95,100,105,110,'95']) assert.equal(run({UiDensityScale:value}).result.Code,1);
});
test('appearance flags distinguish zero from inherit and reject arbitrary input', () => {
  for(const name of ['DisableGradient','DisableShadow','DisableButtonIcon']) {
    assert.equal(run({[name]:0},{Id:'signed-user',[name]:1}).saved[name],0);
    assert.equal(run({[name]:null},{Id:'signed-user',[name]:1}).saved[name],null);
    assert.equal(run({[name]:'yes'}).result.Code,0);
  }
});
test('appearance enums are validated and anonymous writes remain rejected', () => {
  assert.equal(run({LoginStyle:'<script>'}).result.Code,0);
  assert.equal(run({ThemeMode:'auto-script'}).result.Code,0);
  assert.equal(run({UiDensityScale:100},{}).result.Code,1001);
});
test('appearance unchanged values avoid a DB update and hooks contain no values', () => {
  const user={Id:'signed-user',UiDensityScale:95,DisableGradient:1,DisableShadow:0,DisableButtonIcon:1,LoginStyle:'Split'};
  assert.equal(run({...user},user).result.Changed,false);
  const changed=run({DisableShadow:1},user);
  assert.equal(changed.result.Code,1);
  assert.ok(changed.hooks.every(h=>h.body.ChangedFields.includes('DisableShadow')));
  assert.ok(changed.hooks.every(h=>!('DisableShadow' in h.body)));
});
test('appearance hook or persistence failures are not reported as saved', () => {
  const before=run({UiDensityScale:95},{Id:'signed-user'},{hook:{Code:0,Msg:'blocked'}});
  assert.equal(before.result.Code,0);assert.equal(before.saved,undefined);
  assert.equal(run({UiDensityScale:95},{Id:'signed-user'},{save:{Code:0,Msg:'database failure'}}).result.Code,0);
});
