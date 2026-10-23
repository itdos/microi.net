import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../../Microi.Core/V8Engine/Runtime/V8Method.SysUserSettingsFacade.cs',import.meta.url),'utf8');
const body=source.slice(source.indexOf('public DosResult ProvisionCurrentUserTenant('),source.indexOf('using var allocationScope = BeginTrustedHostAllocationScope();'));
test('tenant owner password inheritance stays inside the trusted host and avoids masked FormEngine projections',()=>{
  assert.ok(body.length>500);assert.doesNotMatch(body,/FormEngine\.GetFormDataAsync/);
  assert.match(body,/SELECT Id, Pwd, Phone, Name FROM sys_user/);
  assert.match(body,/WHERE Id = @ProvisioningOwnerId/);
  assert.match(body,/AddInParameter\("ProvisioningOwnerId", userId\)/);
  assert.doesNotMatch(body,/request\["(?:Pwd|Password|UserId)"\]/);
});
test('provisioning never places inherited password material in the V8-visible result or a log',()=>{
  assert.doesNotMatch(body,/currentUser\["Pwd"\]\s*=/);
  assert.doesNotMatch(body,/Console\.WriteLine[^\n]*encryptedPwd/);
  assert.doesNotMatch(body,/return[^\n]*encryptedPwd/);
});
