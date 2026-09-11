/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：消息通知
 * ApiEngineKey：platform-reminder-tick
 * 从可信吾码官方应用源安装、更新或重新安装“消息通知”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-reminder-tick
 * Version: v1.0.3
 * Function:
 * - 每分钟唤醒提醒收件箱，权威计划和回执由提醒运行时的数据库记录确定。
 */

var active = V8.FormEngine.GetTableData('mci_platform_reminder_batch', {
  _Where: [['State','=','Published'],['StartsAt','<=',new Date().toISOString()],['EndsAt','>',new Date().toISOString()]],
  _SelectFields: ['Id'], _PageSize: 1
});
if (Number(active.Code) !== 1) return { Code: 0, Msg: active.Msg || '提醒扫描失败。' };
if (!active.Data || !active.Data.length) return { Code: 1, Data: { Active: false } };
return V8.Method.RunPlatformApiRuntime({ RuntimeKey: 'PlatformReminders', Action: 'Signal' });
