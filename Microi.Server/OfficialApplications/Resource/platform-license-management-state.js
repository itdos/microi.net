/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【重要】SaaS引擎托管接口；官方更新会恢复源码。个性化逻辑请放在独立租户接口。
 */
/* V8 ApiEngine | ApiEngineKey: platform-license-management-state | Version: v1.0.0 */
// /api/License/GetManagementState 与现代 Key 使用同一实现。这里只读，不执行授权写入。
if (!V8.CurrentUser || !V8.CurrentUser.Id) return { Code: 1001, Msg: '请先登录后查看授权信息。' };
if (typeof V8.Method.ReadLicenseAccessScope !== 'function')
  return { Code: 0, Msg: '当前后端尚不支持授权读取原子，请先更新后端程序。', DataAppend: { ErrorCode: 'LicenseReadAtomsUnavailable' } };
var scope = V8.Method.ReadLicenseAccessScope();
if (!scope || scope.Code !== 1) return scope;
var verification = V8.Method.ReadLicenseVerification();
if (!verification || verification.Code !== 1) return verification;
var ai = V8.Method.ReadAiLicenseVerification();
if (!ai || ai.Code !== 1) return ai;
var data = {};
function copy(source, names) {
  for (var i = 0; i < names.length; i++) if (source && source[names[i]] !== undefined) data[names[i]] = source[names[i]];
}
copy(verification.Data, ['IsLicensed', 'ProductType', 'ExpirationDate', 'IssuedDate', 'ValidationMessage']);
copy(ai.Data, ['OnlineAiLicensed', 'AiProductType', 'LicenseProviderAssemblyVersion', 'MicroiAiAssemblyVersion']);
copy(scope.Data, ['CurrentOsClient', 'MainOsClient', 'IsMainTenant']);
data.CanManageLicense = scope.Data.IsAdministrator === true && scope.Data.IsMainTenant === true;
data.CanReadServerNodes = scope.Data.CanReadServerNodes === true;
if (scope.Data.IsAdministrator === true && scope.Data.IsMainTenant === true) {
  var subject = V8.Method.ReadLicenseSubject();
  if (!subject || subject.Code !== 1) return subject;
  copy(verification.Data, ['HID', 'Company']);
  copy(subject.Data, ['Name', 'Account', 'AccountName', 'Phone', 'UpdateExpirationDate', 'LicenseVersion']);
}
return { Code: 1, Data: data, Msg: '获取授权状态成功' };
