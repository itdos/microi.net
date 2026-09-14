/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-mqtt
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-mqtt
 * Version: v1.0.2
 * Function:
 * - MQTT 设备消息接口，兼容既有协议并由可信原子校验管理权限。
 */

/* LEGACY_ROUTE_ACTIONS_V1:BEGIN */
// 宿主提供的实际路径固定旧动作；正文 Action 不能把读接口变成写接口。
var legacyRouteActions = {
  "/api/mqtt/getstatus/status": "Status",
  "/api/mqtt/sendcommand/send-command": "Publish"
};
var legacyRequestPath = String((V8.Param || {})._RequestPath || '').split('?')[0].replace(/--OsClient--[^/]*--$/i, '').toLowerCase();
if (Object.prototype.hasOwnProperty.call(legacyRouteActions, legacyRequestPath)) {
  V8.Param.Action = legacyRouteActions[legacyRequestPath];
}
/* LEGACY_ROUTE_ACTIONS_V1:END */
// Microi官方接口引擎：platform-mqtt
// Version: v1.0.0
// Broker/连接运行态由最小 V8 原子能力处理；租户、管理员和 Topic 命名空间均由后端固定。
var p = V8.Param || {};
var mqttLegacyPath = String(p._RequestPath || '').split('?')[0].replace(/--OsClient--[^/]*--$/i, '').toLowerCase();
var legacyCommand = mqttLegacyPath === '/api/mqtt/sendcommand/send-command';
if (legacyCommand) {
  p.Action = 'Publish'; p.Topic = 'M100/command'; p.Qos = 0; p.Retain = false;
  if (p._RawBody) { try { var command = JSON.parse(p._RawBody); if (typeof command === 'string') p.Payload = command; } catch (_) {} }
  if (typeof p.Payload !== 'string') return { Code: 0, Msg: 'command 必须是 JSON 字符串。' };
}
var mqttResult = V8.Method.ManageMqtt(p);
if (mqttResult && mqttResult.Code === 1) {
  if (legacyCommand) return 'Command sent';
  if (mqttLegacyPath === '/api/mqtt/getstatus/status') return mqttResult.Data;
}
return mqttResult;
