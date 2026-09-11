/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：消息通知
 * ApiEngineKey：platform-reminder-runtime
 * 从可信吾码官方应用源安装、更新或重新安装“消息通知”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-reminder-runtime
 * Version: v1.0.6
 * Function:
 * - 统一系统公告的草稿、校验、发布快照、计划和回执；支持可信帐号范围及每次后端重启后的首次登录展示，采用稳定请求与数据库唯一领取，事务失败不重复发布。
 */

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

var model = createPlatformReminderModel();
var p = V8.Param || {}, now = Date.now(), isoNow = new Date(now).toISOString();
var ruleFields = ['Id','Title','ReminderType','ScopeType','Revision','Status','RuleJson','PublishedBatchId','UpdateTime'];
var batchFields = ['Id','RuleId','Revision','Title','State','ScopeType','SnapshotJson','StartsAt','EndsAt','PublishRequestId','CreateTime'];

// 所有身份来自宿主当前会话；从不将请求中的用户/租户/官方标志传给可信原子。
function atom(action) {
  var result = V8.Method.RunPlatformApiRuntime({ RuntimeKey: 'PlatformReminders', Action: action });
  if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '提醒运行时不可用，请更新平台。');
  return result;
}
function query(table, where, fields, page, size) {
  var result = V8.FormEngine.GetTableData(table, { _Where: where || [], _SelectFields: fields,
    _PageIndex: page || 1, _PageSize: size || 100, _OrderBy: 'Id', _OrderByType: 'DESC' }, V8.DbTrans);
  if (Number(result.Code) !== 1) throw new Error(result.Msg || '读取提醒失败。');
  return result;
}
function row(table, id, fields) {
  var result = V8.FormEngine.GetFormData(table, { Id: id, _SelectFields: fields }, V8.DbTrans);
  if (Number(result.Code) === 2) return null;
  if (Number(result.Code) !== 1) throw new Error(result.Msg || '读取提醒失败。');
  return result.Data;
}
function check(result) { if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '保存提醒失败。'); return result.Data; }
function stable(value) { return V8.EncryptHelper.Sha256Hex(String(value)).substring(0, 32); }
function safeId(value) { var valueText = String(value || ''); if (!/^[a-f0-9]{32}$/.test(valueText)) throw new Error('提醒标识无效。'); return valueText; }
function parse(value) { return typeof value === 'string' ? JSON.parse(value) : value; }
function requireAdmin(context) { if (!context.Administrator) throw new Error('只有当前租户的平台管理员可以维护提醒。'); }
function receiptId(item, context) {
  var entry = item.DisplayMode === 'EveryEntry' ? String(p.EntryId || '') : 'once';
  if (entry !== 'once' && !/^[A-Za-z0-9-]{16,80}$/.test(entry)) throw new Error('页面会话标识无效。');
  return stable(String(V8.OsClient).toLowerCase() + '|' + context.UserId + '|' + item.Id + '|' + entry);
}
// 一次批量核对目标目录，禁止逐接收人/逐租户查询；全部范围使用一条通配映射，不扇出用户记录。
function validateTargets(rule) {
  if (rule.AllTargets || rule.ScopeType === 'Editions') return;
  var allowed = Object.create(null);
  if (rule.ScopeType === 'Tenants') {
    var tenants = atom('Tenants').Data;
    for (var i = 0; tenants && i < tenants.length; i++) allowed[String(tenants[i].Key).toLowerCase()] = true;
  } else {
    var users = query('sys_user', [['Id','In',rule.TargetKeys],['State','=',1]], ['Id'], 1, 200).Data;
    for (var j = 0; users && j < users.length; j++) allowed[String(users[j].Id).toLowerCase()] = true;
  }
  if (rule.TargetKeys.some(function (key) { return !allowed[key.toLowerCase()]; })) throw new Error('部分接收对象不存在、已停用或不属于当前运行环境。');
}
function collect(context) {
  var items = [], warnings = [], nextAt = now + 60000;
  var own = query('mci_platform_reminder_batch', [['State','=','Published'],['EndsAt','>',isoNow]], batchFields).Data || [];
  function append(rows, source, scope, key) {
    for (var i = 0; rows && i < rows.length; i++) {
      var batch = rows[i], snapshot = parse(batch.SnapshotJson);
      if (!model.matches(snapshot, scope, key) || !model.acceptsAccount(snapshot, context)) continue;
      var starts = Date.parse(snapshot.StartsAt);
      if (starts > now) nextAt = Math.min(nextAt, starts);
      var item = model.project(batch, source, now, context);
      if (item) { items.push(item); nextAt = Math.min(nextAt, item.NextAt); }
    }
  }
  append(own, 'Local', 'Users', context.UserId);
  try { append(atom('Inherited').Data, 'Parent', 'Tenants', V8.OsClient); } catch (_) { warnings.push('ParentUnavailable'); }
  try {
    var official = atom('Official');
    append(official.Data, 'Official', 'Editions', context.ProductEdition);
    if (official.DataAppend && official.DataAppend.OfficialUnavailable) warnings.push('OfficialUnavailable');
  } catch (_) { warnings.push('OfficialUnavailable'); }
  return { Items: items, Warnings: warnings, NextCheckAt: new Date(nextAt).toISOString() };
}
try {
  var context = atom('Context').Data;
  if (!context.UserId) return { Code: 1001, Msg: '请先登录。' };
  var action = String(p.Action || 'Inbox');
  if (action === 'Capabilities') return { Code: 1, Data: context };
  if (action === 'Inbox' || action === 'Acknowledge' || action === 'Presented') {
    var inbox = collect(context);
    if (action === 'Acknowledge' || action === 'Presented') {
      var selected = null;
      for (var n = 0; n < inbox.Items.length; n++) if (inbox.Items[n].Id === p.Id) selected = inbox.Items[n];
      if (!selected) return { Code: 1, Data: { NoLongerActive: true }, Msg: '提醒已结束或撤回。' };
      var presenting = action === 'Presented';
      if (presenting && selected.DisplayMode !== 'AfterServerRestart') throw new Error('仅后端重启提醒需要展示领取。');
      if (presenting && !/^[A-Za-z0-9-]{16,80}$/.test(String(p.EntryId || ''))) throw new Error('页面会话标识无效。');
      var ackId = receiptId(selected, context);
      var existingAck = row('mci_platform_reminder_receipt', ackId, ['Id','EntryId','ClosedAt','ShownAt']);
      if (!existingAck) {
        var savedAck = V8.FormEngine.AddFormData('mci_platform_reminder_receipt', { Id: ackId, BatchId: selected.BatchId,
          OccurrenceKey: selected.Id, ReceiverUserId: context.UserId, EntryId: selected.DisplayMode !== 'Once' ? p.EntryId : '',
          SourceType: selected.Source, ClosedAt: presenting ? '' : isoNow, ShownAt: presenting ? isoNow : '' }, V8.DbTrans);
        if (Number(savedAck.Code) !== 1) {
          // 唯一主键是最终领取事实。并发插入后，部分数据库的当前事务快照暂时看不到赢家；
          // 这种情况返回失败并回滚，由原 EntryId 重试恢复，绝不能推测自己领取成功。
          existingAck = row('mci_platform_reminder_receipt', ackId, ['Id','EntryId','ClosedAt','ShownAt']);
          if (!existingAck) check(savedAck);
        }
      } else if (!presenting && !existingAck.ClosedAt) {
        check(V8.FormEngine.UptFormData('mci_platform_reminder_receipt', {Id:ackId,ClosedAt:isoNow}, V8.DbTrans));
      }
      if (presenting) return { Code: 1, Data: { Id: ackId, Claimed: !existingAck || (existingAck.EntryId === p.EntryId && !existingAck.ClosedAt) } };
      return { Code: 1, Data: { Id: ackId, Closed: true } };
    }
    var ids = inbox.Items.map(function (item) { return receiptId(item, context); });
    var closed = Object.create(null);
    if (ids.length) {
      var receipts = query('mci_platform_reminder_receipt', [['Id','In',ids],['ReceiverUserId','=',context.UserId]], ['Id'], 1, 300).Data;
      for (var r = 0; receipts && r < receipts.length; r++) closed[String(receipts[r].Id)] = true;
    }
    var unread = inbox.Items.filter(function (item) { return !closed[receiptId(item, context)]; });
    unread.sort(function (a, b) { return Number(b.Priority) - Number(a.Priority) || a.DueAt.localeCompare(b.DueAt) || a.Id.localeCompare(b.Id); });
    return { Code: 1, Data: unread, DataCount: unread.length,
      DataAppend: { Warnings: inbox.Warnings, NextCheckAt: inbox.NextCheckAt, ProtocolVersion: 2,
        ActiveIds: inbox.Items.map(function(item) { return item.Id; }) } };
  }
  requireAdmin(context);
  if (action === 'Recipients') {
    if (p.ScopeType === 'Tenants') { if (!context.IsMainTenant) throw new Error('只有主租户可以选择子租户。'); return atom('Tenants'); }
    if (p.ScopeType === 'Editions') {
      if (!context.IsOfficialPlatform) throw new Error('只有官方服务可以选择产品版本。');
      return { Code: 1, Data: [{ Key: 'OpenSource', Name: '开源版' }, { Key: 'Personal', Name: '个人版' }, { Key: 'Enterprise', Name: '企业版' }] };
    }
    var conditions = [['State','=',1]];
    if (String(p.Keyword || '').trim()) conditions.push(['Name','Like',String(p.Keyword).slice(0,100)]);
    var options = query('sys_user', conditions, ['Id','Account','Name'], Number(p.PageIndex) || 1, 100);
    return { Code: 1, Data: (options.Data || []).map(function (user) { return { Key: user.Id, Name: user.Name || user.Account }; }), DataCount: options.DataCount };
  }
  if (action === 'List') {
    var where = [];
    if (p.ScopeType) where.push(['ScopeType','=',p.ScopeType]);
    if (p.TargetKey) {
      var targetKey = model.list([p.TargetKey])[0];
      where.push(['ScopeType','=','Tenants']);
      where.push(['AND','(','RuleJson','Like','"'+targetKey+'"']);
      where.push(['OR','RuleJson','Like','"AllTargets":true',')']);
    }
    if (p.Keyword) where.push(['Title','Like',String(p.Keyword).slice(0,100)]);
    var rules = query('mci_platform_reminder', where, ruleFields, Number(p.PageIndex) || 1, 100);
    return { Code: 1, Data: rules.Data || [], DataCount: rules.DataCount };
  }
  if (action === 'Get') {
    var foundRule = row('mci_platform_reminder', safeId(p.Id), ruleFields);
    return foundRule ? {Code:1,Data:foundRule} : {Code:2,Msg:'提醒规则不存在。'};
  }
  if (action === 'Validate') {
    var validatedRule = model.normalize(p.Rule, context, now); validateTargets(validatedRule);
    return {Code:1,Data:{Rule:validatedRule},Msg:'提醒配置已检查，没有保存或发布。'};
  }
  if (action === 'Save') {
    var rule = model.normalize(p.Rule, context, now); validateTargets(rule);
    if (p.RequestId && !/^[A-Za-z0-9-]{16,80}$/.test(String(p.RequestId))) throw new Error('保存请求标识无效。');
    var ruleId = p.Id ? safeId(p.Id) : p.RequestId ? stable(String(V8.OsClient).toLowerCase()+'|Draft|'+p.RequestId) : stable(V8.Method.NewGuid());
    var old = p.Id || p.RequestId ? row('mci_platform_reminder', ruleId, ruleFields) : null;
    if (p.Id && !old) throw new Error('提醒规则不存在。');
    if (!p.Id && old) {
      if (JSON.stringify(parse(old.RuleJson)) !== JSON.stringify(rule)) throw new Error('此请求已保存过不同内容，请先读取已创建的草稿再修改。');
      return {Code:1,Data:{Id:ruleId,Revision:Number(old.Revision),AlreadySaved:true},Msg:'草稿已保存。'};
    }
    if (!old) {
      check(V8.FormEngine.AddFormData('mci_platform_reminder', { Id: ruleId, Title: rule.Title, ReminderType: rule.ReminderType,
        ScopeType: rule.ScopeType, Revision: 1, Status: 'Draft', RuleJson: JSON.stringify(rule), PublishedBatchId: '' }, V8.DbTrans));
    } else {
      if (Number(p.ExpectedRevision) !== Number(old.Revision)) throw new Error('规则已被其他人修改，请刷新后重新编辑。');
      var affected = V8.DbTrans.FromSql('UPDATE mci_platform_reminder SET Title=@title,ReminderType=@kind,ScopeType=@scope,RuleJson=@json,Revision=Revision+1,Status=@status,UpdateTime=@time WHERE Id=@id AND Revision=@revision AND IsDeleted<>1')
        .AddInParameter('@title',rule.Title).AddInParameter('@kind',rule.ReminderType).AddInParameter('@scope',rule.ScopeType)
        .AddInParameter('@json',JSON.stringify(rule)).AddInParameter('@status','Draft').AddInParameter('@time',String(System.DateTime.Now.ToString('yyyy-MM-dd HH:mm:ss')))
        .AddInParameter('@id',ruleId).AddInParameter('@revision',Number(old.Revision)).ExecuteNonQuery();
      if (Number(affected) !== 1) throw new Error('规则保存冲突，请刷新后重试。');
    }
    return { Code: 1, Data: { Id: ruleId, Revision: old ? Number(old.Revision)+1 : 1 }, Msg: '草稿已保存，发布后才会提醒。' };
  }
  if (action === 'Publish' || action === 'Withdraw') {
    var id = safeId(p.Id), current = row('mci_platform_reminder', id, ruleFields);
    if (!current) throw new Error('提醒规则不存在。');
    if (Number(p.ExpectedRevision) !== Number(current.Revision)) throw new Error('规则版本已变化，请刷新后重试。');
    if (action === 'Withdraw') {
      if (current.Status === 'Withdrawn') return { Code: 1, Data: { Id: id, AlreadyWithdrawn: true } };
      var withdrawn = V8.DbTrans.FromSql('UPDATE mci_platform_reminder SET Status=@status,PublishedBatchId=@empty WHERE Id=@id AND Revision=@revision AND Status<>@status AND IsDeleted<>1')
        .AddInParameter('@status','Withdrawn').AddInParameter('@empty','').AddInParameter('@id',id)
        .AddInParameter('@revision',Number(current.Revision)).ExecuteNonQuery();
      if (Number(withdrawn) !== 1) throw new Error('撤回状态已变化，请刷新后回读结果。');
      check(V8.FormEngine.UptFormDataByWhere('mci_platform_reminder_batch', { _Where: [['RuleId','=',id],['State','=','Published']], State: 'Withdrawn' }, V8.DbTrans));
      atom('Signal'); return { Code: 1, Data: { Id: id }, Msg: '提醒已撤回。' };
    }
    var snapshot = model.normalize(parse(current.RuleJson), context, now); validateTargets(snapshot);
    var batchId = stable(id + '|' + current.Revision), previousBatch = row('mci_platform_reminder_batch', batchId, batchFields);
    if (previousBatch) {
      if (previousBatch.State !== 'Published') throw new Error('此版本已撤回。请先保存新版草稿，再次发布。');
      return { Code: 1, Data: { Id: batchId, AlreadyPublished: true }, Msg: '此版本已发布。' };
    }
    if (!/^[A-Za-z0-9-]{16,80}$/.test(String(p.RequestId || ''))) throw new Error('发布请求标识无效。');
    var active = query('mci_platform_reminder_batch', [['State','=','Published'],['EndsAt','>',isoNow]], ['Id'],1,101).Data || [];
    if (active.length >= 100) throw new Error('有效提醒最多 100 条，请先撤回不再需要的提醒。');
    var claimed = V8.DbTrans.FromSql('UPDATE mci_platform_reminder SET PublishedBatchId=@batch,Status=@status WHERE Id=@id AND Revision=@revision AND (PublishedBatchId IS NULL OR PublishedBatchId<>@batch) AND IsDeleted<>1')
      .AddInParameter('@batch',batchId).AddInParameter('@status','Published').AddInParameter('@id',id).AddInParameter('@revision',Number(current.Revision)).ExecuteNonQuery();
    if (Number(claimed) !== 1) throw new Error('发布状态已变化，请刷新后回读结果。');
    // 旧版本停止投递、新批次和接收范围在同一事务内提交，失败不能留下半次发布。
    check(V8.FormEngine.UptFormDataByWhere('mci_platform_reminder_batch', { _Where: [['RuleId','=',id],['State','=','Published']], State: 'Superseded' }, V8.DbTrans));
    check(V8.FormEngine.AddFormData('mci_platform_reminder_batch', { Id: batchId, RuleId: id, Revision: current.Revision,
      Title: snapshot.Title, State: 'Published', ScopeType: snapshot.ScopeType, SnapshotJson: JSON.stringify(snapshot),
      StartsAt: snapshot.StartsAt, EndsAt: snapshot.EndsAt, PublishRequestId: p.RequestId }, V8.DbTrans));
    var targetKeys = snapshot.AllTargets ? ['*'] : snapshot.TargetKeys;
    var targets = targetKeys.map(function (key) { return { FormEngineKey: 'mci_platform_reminder_target', Id: stable(batchId+'|'+key.toLowerCase()), BatchId: batchId, TargetKey: key, ScopeType: snapshot.ScopeType }; });
    check(V8.FormEngine.AddTableData(targets, V8.DbTrans));
    atom('Signal');
    return { Code: 1, Data: { Id: batchId, Revision: current.Revision }, Msg: '提醒已发布。' };
  }
  if (action === 'History') {
    return query('mci_platform_reminder_batch', [['RuleId','=',safeId(p.Id)]], batchFields, Number(p.PageIndex)||1, 50);
  }
  throw new Error('不支持的提醒动作。');
} catch (error) { return { Code: 0, Msg: String(error.message || error) }; }

