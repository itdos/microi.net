/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【重要】SaaS引擎托管接口；官方更新会恢复源码。个性化逻辑请放在独立租户接口。
 */
/* V8 ApiEngine | ApiEngineKey: platform-license-server-nodes | Version: v1.0.0 */
if (!V8.CurrentUser || !V8.CurrentUser.Id) return { Code: 1001, Msg: '请先登录后查看授权信息。' };
if (typeof V8.Method.ReadLicenseAccessScope !== 'function')
  return { Code: 0, Msg: '当前后端尚不支持授权读取原子，请先更新后端程序。', DataAppend: { ErrorCode: 'LicenseReadAtomsUnavailable' } };
var scope = V8.Method.ReadLicenseAccessScope();
if (!scope || scope.Code !== 1) return scope;
// 普通账号可看版本，但不应因授权页兼容请求暴露主租户节点或出现全页 403。
if (!scope.Data.CanReadServerNodes)
  return { Code: 1, Data: [], DataCount: 0, DataAppend: { CanReadServerNodes: false } };
var result = V8.Method.ReadLicenseServerNodes();
if (!result || result.Code !== 1) return { Code: 0, Msg: '读取服务器节点失败，请检查后端日志。' };
return { Code: 1, Data: result.Data || [], DataCount: result.DataCount || 0,
  DataAppend: { CanReadServerNodes: true } };
