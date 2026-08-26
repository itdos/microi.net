/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：应用商城
 * ApiEngineKey：get-microi-store-legacy-route
 * 从可信吾码官方应用源安装、更新或重新安装“应用商城”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: get-microi-store-legacy-route
 * Version: v1.0.0
 * Function:
 * - 兼容旧版批量安装器访问 /apiengine/get-microi-store。
 * - 实际业务始终转发到 get-microi-store，唯一正式公开地址仍为
 *   /apiengine/get-microi-store-list。
 */

var result = V8.ApiEngine.Run('get-microi-store', V8.Param || {});
return result || { Code: 0, Msg: '应用商城列表接口无返回。' };
