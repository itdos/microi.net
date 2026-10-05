/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【官方应用托管接口，请勿承载个性化代码】
 * 所属官方应用：系统日志/监控；ApiEngineKey：platform-ops-event-ingest
 * Managed：安装、更新或重装应用会按官方包恢复本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-ops-event-ingest
 * Version: v1.0.0
 * Function:
 * - 校验当前平台管理员，将独立 Ops 事件持久化到当前租户 MongoDB 系统日志；成功才返回稳定回执。
 */

if (typeof V8.Method.IngestOpsEvent !== 'function') {
    return { Code: 0, Msg: '请先升级后端平台以支持 Ops 持久化日志回执；运维中心会保留待投递事件。' };
}
return V8.Method.IngestOpsEvent(V8.Param);


