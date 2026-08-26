/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-translate-runtime
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: platform-translate-runtime | Version: v1.0.0 */
var p = V8.Param || {};
var action = String(p.Action || "TranslateText").substring(0, 50);
var beforeHook = V8.ApiEngine.Run("platform-runtime-custom-hook", {
    Stage: "BeforeTranslateRuntime",
    SourceApiEngineKey: "platform-translate-runtime",
    Action: action
});
if (!beforeHook || beforeHook.Code != 1) return beforeHook || { Code: 0, Msg: "翻译个性化 Hook 未返回结果。" };

// 原文、文件 Base64、供应商地址和密钥绝不传入租户 Hook。
var result;
if (action == "TranslateText") result = V8.TranslateEngine.TranslateText(p);
else if (action == "Detect") result = V8.TranslateEngine.Detect(p);
else if (action == "Languages") result = V8.TranslateEngine.GetLanguages();
else if (action == "TranslateFile") result = V8.TranslateEngine.TranslateFile(p);
else if (action == "Suggest") result = V8.TranslateEngine.Suggest(p);
else if (action == "Health") result = V8.TranslateEngine.Health();
else return { Code: 0, Msg: "不支持的翻译动作。" };

var afterHook = V8.ApiEngine.Run("platform-runtime-custom-hook", {
    Stage: "AfterTranslateRuntime",
    SourceApiEngineKey: "platform-translate-runtime",
    Action: action,
    ResultCode: result ? result.Code : 0
});
if (!afterHook || afterHook.Code != 1) return afterHook || { Code: 0, Msg: "翻译个性化 Hook 未返回结果。" };
return result;
