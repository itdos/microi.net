/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：mci-system-observability-action
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: mci-system-observability-action | Version: v1.0.0 */
var p = V8.Param || {};
var action = String(p.Action || "").substring(0, 50);
var beforeHook = V8.ApiEngine.Run("platform-runtime-custom-hook", {
    Stage: "BeforeSystemObservabilityAction",
    SourceApiEngineKey: "mci-system-observability-action",
    Action: action
});
if (!beforeHook || beforeHook.Code != 1) return beforeHook || { Code: 0, Msg: "系统治理个性化 Hook 未返回结果。" };

var result = V8.Method.ManageSystemObservability(p);
var afterHook = V8.ApiEngine.Run("platform-runtime-custom-hook", {
    Stage: "AfterSystemObservabilityAction",
    SourceApiEngineKey: "mci-system-observability-action",
    Action: action,
    ResultCode: result ? result.Code : 0
});
if (!afterHook || afterHook.Code != 1) return afterHook || { Code: 0, Msg: "系统治理个性化 Hook 未返回结果。" };
return result;
