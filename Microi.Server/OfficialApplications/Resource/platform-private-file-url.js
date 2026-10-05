/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-private-file-url
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-private-file-url
 * Version: v1.0.2
 * Function:
 * - 为当前可信用户生成已授权的私有文件地址，兼容历史 HDFS 路由，并保留租户、文件、表、行、字段授权和前后个性化 Hook。
 */

/* PLATFORM_RUNTIME_DISPATCH_MARKER_V1 */
// 身份由可信原子独立获取；跨 CLR 边界前排除内部大身份，保留全部业务参数和兼容路由。
var privateFileParam = Object.create(null);
var privateFileKeys = Object.keys(V8.Param || {});
for (var privateFileIndex = 0; privateFileIndex < privateFileKeys.length; privateFileIndex++) {
  var privateFileKey = privateFileKeys[privateFileIndex];
  if (privateFileKey !== '_CurrentUser') privateFileParam[privateFileKey] = V8.Param[privateFileKey];
}
var privateFileRoute = String(V8.Param.ApiAddress || '').replace(/\?.*$/, '').toLowerCase();
if(privateFileRoute === '/api/hdfs/getprivatefileurl' || privateFileRoute === '/api/hdfs/mallfileurl'){
  // 历史移动会员 Token 只在后端固定缓存键中解析，原始 Token 永不进入 V8。
  return V8.Method.GetAuthorizedPrivateFileUrl(privateFileParam);
}

/* V8 ApiEngine | ApiEngineKey: platform-private-file-url | Version: v1.0.1 */

if (!V8.CurrentUser || !V8.CurrentUser.Id) return { Code: 1001, Msg: '登录身份已过期，请重新登录。' };
var beforeHook = V8.ApiEngine.Run('platform-runtime-custom-hook', {
  Stage: 'BeforeGetPrivateFileUrl',
  SourceApiEngineKey: 'platform-private-file-url',
  UserId: String(V8.CurrentUser.Id)
});
if (!beforeHook || beforeHook.Code !== 1) return beforeHook || { Code: 0, Msg: '平台运行时个性化 Hook 未返回结果。' };

var result = V8.Method.GetAuthorizedPrivateFileUrl(privateFileParam);
if (result && result.Code === 1) {
  var afterHook = V8.ApiEngine.Run('platform-runtime-custom-hook', {
    Stage: 'AfterGetPrivateFileUrl',
    SourceApiEngineKey: 'platform-private-file-url',
    UserId: String(V8.CurrentUser.Id)
  });
  if (!afterHook || afterHook.Code !== 1) return afterHook || { Code: 0, Msg: '平台运行时个性化 Hook 未返回结果。' };
}
return result;
