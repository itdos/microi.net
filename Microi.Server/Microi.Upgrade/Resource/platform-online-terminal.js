// Microi官方接口引擎：platform-online-terminal
// Version: v1.0.0
// SignalR/令牌终端运行时由 V8 最小原子能力提供；接口引擎保留可商城升级的动作编排。

var action = String((V8.Param && V8.Param.Action) || '').trim();
if (action !== 'Mine' && action !== 'List' && action !== 'Kick') {
  return { Code: 0, Msg: '不支持的在线终端动作。' };
}
return V8.Method.ManageOnlineTerminal(V8.Param);
