/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：消息通知
 * ApiEngineKey：wechat_send_tpl_msg
 * 从可信吾码官方应用源安装、更新或重新安装“消息通知”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: wechat_send_tpl_msg
 * Version: v1.0.0
 * Function:
 * - 消息通知应用的微信模板消息适配器；AppId/AppSecret 只在可信宿主读取。
 */

var customization = V8.ApiEngine.Run('platform-message-notification-custom-hook', {
  Stage: 'BeforeWeChatTemplateMessage',
  SourceApiEngineKey: 'wechat_send_tpl_msg',
  EventId: String((V8.Param && V8.Param.EventId) || ''),
  WxMpId: String((V8.Param && V8.Param.WxMpId) || ''),
  TemplateId: String((V8.Param && V8.Param.TemplateId) || '')
});
if (!customization || customization.Code !== 1) {
  return customization || { Code: 0, Msg: '消息通知个性化 Hook 未返回结果。' };
}

return V8.Method.SendWeChatTemplateMessage(V8.Param);
