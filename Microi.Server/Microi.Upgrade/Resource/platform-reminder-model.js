// 平台提醒的纯业务规则；生成器将此文件原样嵌入 Managed 运行时，Node 回归执行同一份代码。
function createPlatformReminderModel() {
  // 参数只用于业务规则，身份、租户、官方授权必须来自宿主可信 Context。
  function text(value) { return String(value == null ? '' : value).trim(); }
  function list(value) {
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch (_) { value = []; } }
    var result = [], seen = Object.create(null);
    for (var i = 0; value && i < value.length; i++) {
      var key = text(value[i]);
      if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(key)) throw new Error('接收对象标识无效。');
      if (!seen[key.toLowerCase()]) { result.push(key); seen[key.toLowerCase()] = true; }
    }
    if (result.length > 200) throw new Error('单次最多选择 200 个接收对象；全体范围请使用全部选项。');
    return result;
  }
  function date(value, name, optional) {
    if (!text(value) && optional) return '';
    if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(text(value))) throw new Error(name + '必须包含时区。');
    var time = Date.parse(value);
    if (!isFinite(time)) throw new Error(name + '无效。');
    return new Date(time).toISOString();
  }
  function integer(value, minimum, maximum, name) {
    var number = Number(value);
    if (!isFinite(number) || Math.floor(number) !== number || number < minimum || number > maximum) throw new Error(name + '超出允许范围。');
    return number;
  }
  // 固定图标和纯文本内容避免提醒变成 HTML/脚本执行入口。
  function normalize(input, context, now) {
    if (!context.Administrator) throw new Error('只有当前租户的平台管理员可以维护提醒。');
    input = input || {};
    var scope = text(input.ScopeType || 'Users');
    if (['Users', 'Tenants', 'Editions'].indexOf(scope) < 0) throw new Error('接收范围无效。');
    if (scope === 'Tenants' && !context.IsMainTenant) throw new Error('只有主租户可以向子租户发送提醒。');
    if (scope === 'Editions' && !context.IsOfficialPlatform) throw new Error('只有官方服务可以向产品版本用户发送提醒。');
    var title = text(input.Title), content = text(input.Content);
    if (!title || title.length > 200) throw new Error('标题为必填项，最多 200 个字符。');
    if (!content || content.length > 8000) throw new Error('内容为必填项，最多 8000 个字符。');
    var icon = text(input.Icon || 'bell'), severity = text(input.Severity || 'info');
    if (['bell', 'clock', 'warning', 'maintenance', 'info', 'gift'].indexOf(icon) < 0) throw new Error('图标无效。');
    if (['info', 'success', 'warning', 'error'].indexOf(severity) < 0) throw new Error('提醒级别无效。');
    var link = text(input.LinkUrl);
    if (link && (link.length > 500 || /[\u0000-\u0020\\]/.test(link) || !/^(?:\/(?!\/)|#|https?:\/\/)/i.test(link))) throw new Error('链接只支持站内地址和 http/https。');
    var kind = text(input.ReminderType || 'Announcement');
    if (['Announcement', 'Trial', 'Scheduled'].indexOf(kind) < 0) throw new Error('提醒类型无效。');
    var mode = text(input.DisplayMode || 'Once');
    if (['Once', 'EveryEntry', 'AfterServerRestart'].indexOf(mode) < 0) throw new Error('显示方式无效。');
    var accountScope = text(input.AccountScope || 'AllAccounts');
    if (['AllAccounts', 'SuperAdmins'].indexOf(accountScope) < 0) throw new Error('接收帐号范围无效。');
    var minimumProtocol = accountScope === 'SuperAdmins' || mode === 'AfterServerRestart' ? 2 : 1;
    var receiverProtocol = Number(context.ProtocolVersion || 1);
    if (!isFinite(receiverProtocol) || minimumProtocol > receiverProtocol) throw new Error('此接收范围或显示方式需要先更新平台消息通知运行时。');
    var all = input.AllTargets === true || input.AllTargets === 1;
    var targets = list(input.TargetKeys || []);
    if (scope === 'Editions') {
      all = false;
      if (targets.some(function (key) { return ['OpenSource', 'Personal', 'Enterprise'].indexOf(key) < 0; })) throw new Error('产品版本无效。');
    }
    if (!all && !targets.length) throw new Error('请选择接收对象。');
    var start = date(input.StartsAt || new Date(now).toISOString(), '开始时间');
    var trial = '', advance = 0;
    if (kind === 'Trial') {
      if (scope !== 'Tenants' || all || targets.length !== 1) throw new Error('试用提醒必须绑定一个具体子租户。');
      trial = date(input.TrialExpiresAt, '试用到期时间');
      advance = integer(input.AdvanceMinutes || 0, 0, 525600, '提前分钟数');
      start = new Date(Date.parse(trial) - advance * 60000).toISOString();
    }
    var end = date(input.EndsAt, '结束时间', false);
    if (Date.parse(end) <= Date.parse(start) || Date.parse(end) <= now) throw new Error('结束时间必须晚于开始时间和当前时间。');
    var repeat = text(input.RepeatMode || 'None'), interval = 0;
    if (['None', 'Daily', 'Weekly', 'Interval'].indexOf(repeat) < 0) throw new Error('重复计划无效。');
    if (repeat !== 'None' && kind !== 'Scheduled') throw new Error('只有定时提醒可以配置重复计划。');
    if (mode === 'AfterServerRestart' && repeat !== 'None') throw new Error('重启后提醒已经按服务启动批次重复，不能同时配置周期计划。');
    if (repeat === 'Daily') interval = 1440;
    if (repeat === 'Weekly') interval = 10080;
    if (repeat === 'Interval') interval = integer(input.IntervalMinutes, 1, 525600, '间隔分钟数');
    return { Title: title, Content: content, Icon: icon, Severity: severity, LinkUrl: link,
      LinkText: text(input.LinkText || '查看详情').slice(0, 30), Priority: integer(input.Priority || 0, 0, 100, '优先级'),
      ReminderType: kind, DisplayMode: mode, ScopeType: scope, AccountScope: accountScope, MinimumReceiverProtocol: minimumProtocol,
      AllTargets: all, TargetKeys: all ? [] : targets,
      StartsAt: start, EndsAt: end, RepeatMode: repeat, IntervalMinutes: interval,
      TrialExpiresAt: trial, AdvanceMinutes: advance };
  }
  // 按计划时间确定 occurrence，不依赖某个节点是否执行过，也不补弹停机期间的全部历史周期。
  function occurrence(rule, now) {
    var start = Date.parse(rule.StartsAt), end = Date.parse(rule.EndsAt);
    if (!isFinite(start) || !isFinite(end) || now < start || now >= end) return null;
    var span = Number(rule.IntervalMinutes || 0) * 60000;
    var slot = span > 0 ? Math.floor((now - start) / span) : 0;
    return { Slot: slot, DueAt: new Date(start + slot * span).toISOString(),
      NextAt: span > 0 ? Math.min(end, start + (slot + 1) * span) : end };
  }
  function matches(rule, scope, key) {
    return rule.ScopeType === scope && (rule.AllTargets === true || list(rule.TargetKeys).some(function (item) { return item.toLowerCase() === text(key).toLowerCase(); }));
  }
  // 接收身份与启动批次只使用服务端可信上下文；未知范围/协议失败关闭。
  function acceptsAccount(rule, context) {
    var scope = rule.AccountScope || 'AllAccounts';
    var protocol = Number(rule.MinimumReceiverProtocol || 1);
    var receiverProtocol = Number(context.ProtocolVersion || 1);
    if (!isFinite(protocol) || !isFinite(receiverProtocol) || protocol < 1 || Math.floor(protocol) !== protocol || protocol > receiverProtocol) return false;
    if ((scope === 'SuperAdmins' || rule.DisplayMode === 'AfterServerRestart') && receiverProtocol < 2) return false;
    if (['AllAccounts', 'SuperAdmins'].indexOf(scope) < 0) return false;
    if (scope === 'SuperAdmins' && context.Administrator !== true) return false;
    if (['Once', 'EveryEntry', 'AfterServerRestart'].indexOf(rule.DisplayMode) < 0) return false;
    return rule.DisplayMode !== 'AfterServerRestart' || /^[A-Za-z0-9-]{16,80}$/.test(text(context.RestartEpoch));
  }
  function project(batch, source, now, context) {
    var rule = typeof batch.SnapshotJson === 'string' ? JSON.parse(batch.SnapshotJson) : batch.SnapshotJson;
    context = context || { ProtocolVersion: 1 };
    if (!acceptsAccount(rule, context)) return null;
    var due = occurrence(rule, now);
    if (batch.State !== 'Published' || !due) return null;
    var restart = rule.DisplayMode === 'AfterServerRestart' ? ':' + context.RestartEpoch : '';
    return { Id: source + ':' + batch.Id + ':' + due.Slot + restart, BatchId: batch.Id, Source: source,
      Slot: due.Slot, DueAt: due.DueAt, NextAt: due.NextAt, Title: rule.Title, Content: rule.Content,
      Icon: rule.Icon, Severity: rule.Severity, Priority: rule.Priority, DisplayMode: rule.DisplayMode,
      EndsAt: rule.EndsAt, LinkUrl: rule.LinkUrl, LinkText: rule.LinkText };
  }
  return { normalize: normalize, occurrence: occurrence, matches: matches, acceptsAccount: acceptsAccount, project: project, list: list };
}
