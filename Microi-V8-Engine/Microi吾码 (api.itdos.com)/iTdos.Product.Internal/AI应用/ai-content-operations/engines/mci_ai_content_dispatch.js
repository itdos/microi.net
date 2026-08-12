/*
 * V8 ApiEngine
 * ApiEngineKey: mci-ai-content-dispatch
 * Version: v1.0.1
 * Function:
 * - 请补充该 V8 代码的完整功能说明。
 */

/*
 * 仅由 StopHttp 的 Microi Job 调用。Quartz 负责集群触发，SlotKey 唯一索引
 * 才是跨节点、跨重启的业务幂等事实源。
 */
var jobName = String(V8.Param.JobName || '');
if (jobName !== 'MciAiContentMorning' && jobName !== 'MciAiContentAfternoon') {
  return { Code: 0, Msg: '拒绝非预期任务调用。' };
}

var config = {};
try {
  config = V8.Param.JobParam ? JSON.parse(String(V8.Param.JobParam)) : {};
} catch (e) {
  return { Code: 0, Msg: 'JobParam 不是有效 JSON。' };
}
var slot = String(config.Slot || (jobName === 'MciAiContentMorning' ? 'am' : 'pm')).toLowerCase();
if (slot !== 'am' && slot !== 'pm') return { Code: 0, Msg: '时段只允许 am 或 pm。' };
var planKey = String(config.PlanKey || 'microi-ai-content-default');

var planResult = V8.FormEngine.GetFormData('mci_ai_content_plan', {
  _Where: [['PlanKey', '=', planKey]]
});
var plan = planResult && planResult.Code === 1 ? planResult.Data : null;
if (!plan) {
  var addPlan = V8.FormEngine.AddFormData('mci_ai_content_plan', {
    PlanKey: planKey,
    Name: '默认 AI 内容计划',
    Enabled: 1,
    Timezone: 'Asia/Shanghai',
    MorningEnabled: 1,
    AfternoonEnabled: 1,
    ArticlePrompt: '写成真实开发者解决具体问题后的技术心得，结构清晰，有代码、证据和边界，避免软文。',
    VideoPrompt: '只制作有完整信息价值的办公室工作场景视频，品牌只可作为不显眼的背景文字。',
    TargetPolicyJson: JSON.stringify({ allLiveAccounts: true }),
    QualityPolicyJson: JSON.stringify({ douyinKuaishou: { videoPreferred: true, imageCardMin: 6, imageCardMax: 9, minScore: 80 } })
  });
  if (!addPlan || addPlan.Code !== 1) {
    planResult = V8.FormEngine.GetFormData('mci_ai_content_plan', { _Where: [['PlanKey', '=', planKey]] });
    plan = planResult && planResult.Code === 1 ? planResult.Data : null;
    if (!plan) return { Code: 0, Msg: '默认内容计划创建失败：' + ((addPlan && addPlan.Msg) || '未知错误') };
  } else {
    planResult = V8.FormEngine.GetFormData('mci_ai_content_plan', { _Where: [['PlanKey', '=', planKey]] });
    plan = planResult && planResult.Code === 1 ? planResult.Data : null;
  }
}
if (Number(plan.Enabled || 0) !== 1) return { Code: 1, Data: { Skipped: true, Reason: 'PlanDisabled' }, Msg: '内容计划已停用。' };
if ((slot === 'am' && Number(plan.MorningEnabled || 0) !== 1) || (slot === 'pm' && Number(plan.AfternoonEnabled || 0) !== 1)) {
  return { Code: 1, Data: { Skipped: true, Reason: 'SlotDisabled', Slot: slot }, Msg: '当前时段已停用。' };
}

var fireText = String(V8.Param.ScheduledFireTime || V8.Param.FireTime || '');
var shanghaiDate;
try {
  var utc = fireText ? new Date(fireText) : new Date();
  shanghaiDate = DateAdd(utc, 'h', 8, 'yyyy-MM-dd');
} catch (e) {
  shanghaiDate = DateAdd(new Date(), 'h', 8, 'yyyy-MM-dd');
}
var slotKey = shanghaiDate + '-' + slot;
var existing = V8.FormEngine.GetFormData('mci_ai_content_item', { _Where: [['SlotKey', '=', slotKey]] });
if (existing && existing.Code === 1 && existing.Data) {
  return { Code: 1, Data: { Replayed: true, SlotKey: slotKey, ContentId: existing.Data.Id, Status: existing.Data.Status } };
}

var add = V8.FormEngine.AddFormData('mci_ai_content_item', {
  SlotKey: slotKey,
  PlanId: plan.Id,
  ContentType: 'Mixed',
  Status: 'Queued',
  QualityStatus: 'Pending',
  SourceEvidenceJson: '[]',
  PublicUrlsJson: '[]'
});
if (!add || add.Code !== 1) {
  existing = V8.FormEngine.GetFormData('mci_ai_content_item', { _Where: [['SlotKey', '=', slotKey]] });
  if (existing && existing.Code === 1 && existing.Data) {
    return { Code: 1, Data: { Replayed: true, SlotKey: slotKey, ContentId: existing.Data.Id, Status: existing.Data.Status } };
  }
  return add || { Code: 0, Msg: '内容时段创建失败。' };
}
V8.FormEngine.UptFormData('mci_ai_content_plan', { Id: plan.Id, LastDispatchTime: DateNow('yyyy-MM-dd HH:mm:ss') });
var created = V8.FormEngine.GetFormData('mci_ai_content_item', { _Where: [['SlotKey', '=', slotKey]] });
return { Code: 1, Data: { Replayed: false, SlotKey: slotKey, ContentId: created && created.Data ? created.Data.Id : '' } };
