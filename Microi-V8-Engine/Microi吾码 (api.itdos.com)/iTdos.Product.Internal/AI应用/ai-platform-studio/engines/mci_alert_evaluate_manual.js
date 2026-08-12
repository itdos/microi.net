/* 超级管理员手工评估入口；真实评估器禁止HTTP调用，避免伪造JobName绕过身份校验。 */
var user = V8.CurrentUser || {};
if (!user.Id || Number(user.Level || 0) < 9999) return { Code: 0, Msg: '权限不足：只有超级管理员可以手工评估告警策略。' };
var policyId = String((V8.Param && V8.Param.PolicyId) || '').replace(/^\s+|\s+$/g, '');
var eventId = String((V8.Param && V8.Param.EventId) || '').replace(/^\s+|\s+$/g, '');
if (!policyId || !eventId) return { Code: 0, Msg: 'PolicyId和EventId不能为空。' };
if (eventId.length > 120) return { Code: 0, Msg: 'EventId长度不能超过120。' };
return V8.ApiEngine.Run('mci-alert-evaluate', {
  PolicyId: policyId,
  EventId: eventId,
  ObservedValue: V8.Param.ObservedValue,
  ServiceId: V8.Param.ServiceId,
  Title: V8.Param.Title,
  Context: V8.Param.Context
}, V8.DbTrans);
