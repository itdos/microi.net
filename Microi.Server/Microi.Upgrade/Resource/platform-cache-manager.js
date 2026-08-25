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

return V8.Method.ManageCache(V8.Param);
