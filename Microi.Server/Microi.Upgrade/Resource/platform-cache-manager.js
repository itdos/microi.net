/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-cache-manager
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

// Microi官方接口引擎：platform-cache-manager
// Version: v1.0.0
// 缓存管理器的动作编排入口；租户、超级管理员、访问密钥、连接密钥和审计均由
// V8.Method.ManageCache 的可信宿主边界处理。

var action = String((V8.Param && V8.Param.Action) || '').trim();
var allowedActions = {
  Statistics: true,
  Invalidate: true,
  InvalidatePattern: true,
  Connections: true,
  SaveConnection: true,
  DeleteConnection: true,
  TestConnection: true,
  RedisStatistics: true,
  Keys: true,
  Key: true,
  DeleteKeys: true,
  ReplaceValue: true,
  RenameKey: true,
  SetTtl: true
};

if (!allowedActions[action]) {
  return { Code: 0, Msg: '不支持的缓存管理动作。' };
}

var customization = V8.ApiEngine.Run('platform-runtime-custom-hook', {
  Stage: 'BeforeCacheManagerAction',
  SourceApiEngineKey: 'platform-cache-manager',
  Action: action
});
if (!customization || customization.Code !== 1) {
  return customization || { Code: 0, Msg: '缓存管理个性化 Hook 未返回结果。' };
}

return V8.Method.ManageCache(V8.Param);
