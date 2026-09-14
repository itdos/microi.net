/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-ocr-recognize
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-ocr-recognize
 * Version: v1.0.2
 * Function:
 * - OCR 识别的统一接口入口，复用当前租户的可信识别网关与权限。
 */

/* LEGACY_ROUTE_ACTIONS_V1:BEGIN */
// 宿主提供的实际路径固定旧动作；正文 Action 不能把读接口变成写接口。
var legacyRouteActions = {
  "/api/ocr/recognize": "Recognize"
};
var legacyRequestPath = String((V8.Param || {})._RequestPath || '').split('?')[0].replace(/--OsClient--[^/]*--$/i, '').toLowerCase();
if (Object.prototype.hasOwnProperty.call(legacyRouteActions, legacyRequestPath)) {
  V8.Param.Action = legacyRouteActions[legacyRequestPath];
}
/* LEGACY_ROUTE_ACTIONS_V1:END */
/* V8 ApiEngine | ApiEngineKey: platform-ocr-recognize | Version: v1.0.0 */
var beforeHook = V8.ApiEngine.Run("platform-runtime-custom-hook", {
    Stage: "BeforeOcrRecognize",
    SourceApiEngineKey: "platform-ocr-recognize",
    Action: "Recognize"
});
if (!beforeHook || beforeHook.Code != 1) return beforeHook || { Code: 0, Msg: "OCR 个性化 Hook 未返回结果。" };

// 文件 Base64、识别原文、供应商地址和密钥绝不传入租户 Hook。
var result = V8.OCR.Recognize(V8.Param || {});
var afterHook = V8.ApiEngine.Run("platform-runtime-custom-hook", {
    Stage: "AfterOcrRecognize",
    SourceApiEngineKey: "platform-ocr-recognize",
    Action: "Recognize",
    ResultCode: result ? result.Code : 0
});
if (!afterHook || afterHook.Code != 1) return afterHook || { Code: 0, Msg: "OCR 个性化 Hook 未返回结果。" };
return result;
