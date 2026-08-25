// Microi官方接口引擎：platform-client-log
// Version: v1.0.0
// 仅兼容普通客户端语义日志；安全审计、用户行为与请求流量必须由后端可信执行点生成。
var reserved = {
  '访问菜单':1, '点击V8按钮':1, '查看数据':1, '数据操作':1, '导入数据':1,
  '导出数据':1, '用户登录':1, '用户退出':1, '登录失效':1, '私有附件':1, '登录失败':1
};
var type = String(V8.Param.Type || '').trim();
if (reserved[type] || V8.Param.Category || V8.Param.Action) {
  return { Code:0, Msg:'平台用户行为日志只能由后端可信执行点生成。' };
}
var title = String(V8.Param.Title || '').trim();
if (!title || title.length > 500) return { Code:0, Msg:'日志标题不能为空且最多 500 个字符。' };
var content = String(V8.Param.Content || '');
if (content.length > 20000) content = content.substring(0, 20000) + '…';
return V8.Method.AddSysLog({
  OsClient: V8.OsClient,
  UserId: V8.CurrentUser && V8.CurrentUser.Id || '',
  UserName: V8.CurrentUser && (V8.CurrentUser.Name || V8.CurrentUser.Account) || '',
  Type: type || 'Client',
  Title: title,
  Content: content,
  Level: Number(V8.Param.Level || 1),
  Category: 'Legacy',
  Action: 'ClientLog',
  Source: 'ApiEngine'
});
