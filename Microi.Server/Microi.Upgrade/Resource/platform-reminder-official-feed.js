/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：消息通知
 * ApiEngineKey：platform-reminder-official-feed
 * 从可信吾码官方应用源安装、更新或重新安装“消息通知”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-reminder-official-feed
 * Version: v1.0.4
 * Function:
 * - 由吾码官方 License 身份限定的公开平台公告源，仅返回匹配产品版本的已发布投影；按接收协议过滤超级管理员范围和重启频率，不暴露租户目标、用户或回执。
 */

var context = V8.Method.RunPlatformApiRuntime({ RuntimeKey: 'PlatformReminders', Action: 'Context' });
if (!context || Number(context.Code) !== 1 || !context.Data.IsOfficialPlatform) return { Code: 0, Msg: '此服务不是官方提醒发布源。' };
var edition = String(V8.Param.Edition || '');
if (['OpenSource','Personal','Enterprise'].indexOf(edition) < 0) return { Code: 0, Msg: '产品版本无效。' };
var batches = V8.FormEngine.GetTableData('mci_platform_reminder_batch', {
  _Where: [['State','=','Published'],['ScopeType','=','Editions'],['EndsAt','>',new Date().toISOString()]],
  _SelectFields: ['Id','State','SnapshotJson'], _PageSize: 100, _OrderBy: 'Id'
});
if (Number(batches.Code) !== 1) return { Code: 1, Data: [], DataAppend: { UpgradeRequired: true } };
var output = [];
var receiverProtocol = Number(V8.Param.ReceiverProtocolVersion || 1);
if (!isFinite(receiverProtocol) || receiverProtocol < 1 || Math.floor(receiverProtocol) !== receiverProtocol) return {Code:0,Msg:'接收协议版本无效。'};
for (var i=0; batches.Data && i<batches.Data.length; i++) {
  var batch = batches.Data[i], rule = JSON.parse(batch.SnapshotJson), targets = rule.TargetKeys || [];
  if (['AllAccounts','SuperAdmins'].indexOf(rule.AccountScope || 'AllAccounts') < 0) continue;
  var minimumProtocol = Math.max(Number(rule.MinimumReceiverProtocol || 1), rule.AccountScope === 'SuperAdmins' || rule.DisplayMode === 'AfterServerRestart' ? 2 : 1);
  if (minimumProtocol <= receiverProtocol && rule.ScopeType === 'Editions' && targets.indexOf(edition) >= 0) output.push({ Id: batch.Id, State: 'Published', SnapshotJson: batch.SnapshotJson });
}
return { Code: 1, Data: output, DataAppend: { ProtocolVersion: 2 } };

