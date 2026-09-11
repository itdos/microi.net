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
