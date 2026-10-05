/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【官方应用托管接口，请勿承载个性化代码】
 * 所属官方应用：系统日志/监控；ApiEngineKey：platform-ops-readiness
 * Managed：安装、更新或重装应用会按官方包恢复本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-ops-readiness
 * Version: v1.0.0
 * Function:
 * - 为受控 Ops 探测当前租户数据库、Redis 与 V8 运行时是否可用，只返回 Ready/NotReady。
 */

try {
    var value = V8.Db.FromSql('SELECT 1').ToScalar();
    if (String(value) !== '1') return { Code: 0, Data: { Status: 'NotReady' } };
    V8.Cache.Get('Microi:' + V8.OsClient + ':Ops:ReadinessProbe');
    return { Code: 1, Data: { Status: 'Ready' } };
} catch (error) { return { Code: 0, Data: { Status: 'NotReady' } }; }


