/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-client-log
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-client-log
 * Version: v1.0.1
 * Function:
 * - 兼容旧 SysLog/AddSysLog 和平台客户端日志地址；只接收已登录用户的普通语义日志，身份由后端固定，禁止伪造安全审计和用户行为。
 */

// Microi官方接口引擎：platform-client-log
// Version: v1.0.0
// 仅兼容普通客户端语义日志；安全审计、用户行为与请求流量必须由后端可信执行点生成。
// ApiRoutes 同时保留 /api/SysLog/AddSysLog；认证和租户身份仍由宿主提供。
if (!V8.CurrentUser || !V8.CurrentUser.Id) return { Code:1001, Msg:'登录身份已过期，请重新登录。' };
function value(name) {
  var param = V8.Param || {};
  for (var key in param) if (String(key).toLowerCase() === name.toLowerCase()) return param[key];
  return '';
}
var reserved = {
  '访问菜单':1, '点击V8按钮':1, '查看数据':1, '数据操作':1, '导入数据':1,
  '导出数据':1, '用户登录':1, '用户退出':1, '登录失效':1, '私有附件':1, '登录失败':1
};
var type = String(value('Type') || '').trim();
if (reserved[type] || value('Category') || value('Action')) {
  return { Code:0, Msg:'平台用户行为日志只能由后端可信执行点生成。' };
}
var title = String(value('Title') || '').trim();
if (!title || title.length > 500) return { Code:0, Msg:'日志标题不能为空且最多 500 个字符。' };
var content = String(value('Content') || '');
if (content.length > 20000) content = content.substring(0, 20000) + '…';
return V8.Method.AddSysLog({
  OsClient: V8.OsClient,
  UserId: V8.CurrentUser && V8.CurrentUser.Id || '',
  UserName: V8.CurrentUser && (V8.CurrentUser.Name || V8.CurrentUser.Account) || '',
  Type: type || 'Client',
  Title: title,
  Content: content,
  Level: Number(value('Level') || 1),
  Category: 'Legacy',
  Action: 'ClientLog',
  Source: 'ApiEngine'
});
