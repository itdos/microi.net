/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【官方应用托管接口，请勿承载个性化代码】
 * 所属官方应用：系统日志/监控；ApiEngineKey：platform-ops-entry
 * Managed：安装、更新或重装应用会按官方包恢复本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-ops-entry
 * Version: v1.0.0
 * Function:
 * - 从当前租户 SaaS 配置读取独立运维入口；不返回运维账号、凭据或容器控制权限。
 */

if (!V8.CurrentUser || Number(V8.CurrentUser.Level || 0) < 9999) return { Code: 0, Msg: '只有平台管理员可以查看运维入口。' };
var model = V8.OsClientModel || {};
return { Code: 1, Data: { Url: String(model.MicroiOpsUrl || ''), OsClient: V8.OsClient } };
