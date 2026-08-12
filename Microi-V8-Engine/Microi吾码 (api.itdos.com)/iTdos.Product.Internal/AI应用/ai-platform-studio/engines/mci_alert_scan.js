/* 定时扫描启用的Job策略；窗口台账和数据库唯一键保证多节点触发幂等。 */
var jobName = String((V8.Param && V8.Param.JobName) || '');
if (jobName !== 'MciAiPlatformMinuteSweep') return { Code: 0, Msg: '拒绝非预期平台维护任务调用。' };
var policiesResult = V8.FormEngine.GetTableData('mci_observability_policy', { _Where: [['Enabled', '=', 1], ['AND', 'EvaluationMode', '=', 'Job']], _OrderBy: 'LastEvaluationTime', _OrderByType: 'ASC', _PageIndex: 1, _PageSize: 100 });
if (!policiesResult || policiesResult.Code !== 1) return policiesResult || { Code: 0, Msg: '读取定时告警策略失败。' };
var policies = policiesResult.Data || [], completed = 0, triggered = 0, recovered = 0, replayed = 0, failures = [];
for (var i = 0; i < policies.length; i++) {
  var policy = policies[i] || {}, result = V8.ApiEngine.Run('mci-alert-evaluate', { JobName: jobName, PolicyId: policy.Id });
  if (!result || result.Code !== 1) { failures.push({ PolicyId: policy.Id, PolicyKey: policy.PolicyKey, Message: String((result && result.Msg) || '评估失败').slice(0, 500) }); continue; }
  completed++;
  if (result.Msg && String(result.Msg).indexOf('幂等') >= 0) replayed++;
  if (result.Data && result.Data.Triggered === true) triggered++;
  if (result.Data && result.Data.Recovered === true) recovered++;
}
return { Code: 1, Data: { Scanned: policies.length, Completed: completed, Triggered: triggered, Recovered: recovered, Replayed: replayed, Failures: failures }, Msg: failures.length ? '定时告警扫描完成，部分策略失败。' : '定时告警扫描完成。' };
