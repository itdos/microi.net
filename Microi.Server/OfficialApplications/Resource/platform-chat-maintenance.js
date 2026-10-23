/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：消息通知
 * ApiEngineKey：platform-chat-maintenance
 * 从可信吾码官方应用源安装、更新或重新安装“消息通知”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: platform-chat-maintenance | Version: v1.0.0 */

// Managed: platform-chat-maintenance；仅单租户超级管理员，业务状态由本引擎编排。
var param=V8.Param||{};
function fail(message){return {Code:0,Msg:message};}
if(!V8.Method||typeof V8.Method.ManageManagedStorageMaintenance!=='function')return fail('服务器维护准入能力尚未部署。');
function control(operation,revision){return V8.Method.ManageManagedStorageMaintenance({Scope:'platform-chat-runtime',Operation:operation,OperationId:String(param.OperationId||''),Epoch:String(param.Epoch||''),ExpectedRevision:revision});}
var operation=String(param.Operation||'Status');
if(operation==='Begin'||operation==='Drain'||operation==='GateStatus')return control(operation==='GateStatus'?'Status':operation);
// 先由可信 C# 原子验证 Key、真实登录身份和租户，不能以 V8.Param 中的角色字段代替。
var gate=control('Status');if(!gate||gate.Code!==1)return gate;
/* 历史索引由 Managed 聊天引擎编排；通用分页、可信准入与存储边界由宿主提供。 */
function createLegacyLocationIndex(V8, options) {
  var tenant = String(V8.OsClient || '');
  var db = 'diy_chat_' + tenant.toLowerCase();
  var table = 'chat_message_location';
  var stateTable = 'chat_location_migration';
  var stateId = hash('chat-location-migration|v1|' + tenant).substring(0, 24);
  var leaseMs = 120000;
  function hash(value) { return V8.EncryptHelper.Sha256Hex(String(value)); }
  function now() { return options.now(); }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function array(value) {
    if (!value || typeof value !== 'object') stop('Unknown', '分页行数据未确认。');
    var length = typeof value.length === 'number' ? value.length : typeof value.Count === 'number' ? value.Count : -1;
    if (length < 0 || length > 100) stop('Unknown', '分页行数据超过上限或格式无效。');
    var result = []; for (var i = 0; i < length; i++) result.push(value[i]); return result;
  }
  function immutableEqual(left, right) {
    var fields = ['MessageId', 'RequestId', 'FromUserId', 'ToUserId', 'Type', 'Content', 'OtherInfo', 'PayloadHash'];
    for (var i = 0; i < fields.length; i++) if (left[fields[i]] !== right[fields[i]]) return false;
    return true;
  }
  function stop(reason, message) { var error = new Error(message); error.reason = reason; throw error; }
  function guard(fn) { return function () { try { return fn.apply(null, arguments); } catch (error) { return { Code: 0, Reason: error.reason || 'Unknown', Msg: error.message || '存储结果未知。' }; } }; }
  function request(name, id) { return { OsClient: tenant, DbName: db, TableName: name, Id: id }; }
  function read(req) {
    var result = V8.MongoDb.GetFormData(req);
    if (result && result.Code === 1 && result.Data === null || result && result.Code === 2 && result.Data == null) return null;
    if (!result || result.Code !== 1 || !result.Data || typeof result.Data !== 'object') stop('Unknown', '存储读取未确认。');
    return result.Data;
  }
  function addRead(req, body) {
    var write = copy(req); write._FormData = body;
    try { V8.MongoDb.AddFormData(write); } catch (unknown) { /* 只按同一身份回读，不重发写入。 */ }
    var actual = read(req);
    if (!actual) stop('Pending', '写入未确认，请使用同一操作标识恢复。');
    return actual;
  }
  function casRead(name, id, conditions, fields) {
    var req = request(name, id); delete req.Id;
    req._Where = [['_id', '=', id]].concat(conditions); req._FormData = fields;
    try { V8.MongoDb.UptFormDataByWhere(req); } catch (unknown) { /* ACK 未知只回读。 */ }
    return read(request(name, id));
  }
  function sameFields(actual, expected) {
    if (!actual) return false;
    for (var key in expected) if (JSON.stringify(actual[key]) !== JSON.stringify(expected[key])) return false;
    return true;
  }
  function state() { return read(request(stateTable, stateId)); }
  function ready() {
    var current = state();
    if (!current || current.Phase !== 'Completed') stop(current && current.Phase === 'Conflict' ? 'Conflict' : 'Pending', '历史定位尚未完成或存在冲突，请管理员完成审核后重试。');
    if (current.Schema !== 1 || current.ScanComplete !== true || current.Conflicts !== 0 || current.IndexesReady !== true || !current.DirectoryHash || !current.FenceEpoch) stop('Conflict', '迁移完成回执不完整，禁止切换新存储协议。');
    return current;
  }
  function requireFence(expected) {
    // 激活前必须从可信宿主证明旧写入者已排空，且该租户的写入准入保持关闭。
    // 不能以客户端确认、任意 FenceId、进程内锁或短租约冒充这一事实。
    if (!V8.Method || typeof V8.Method.RequireManagedStorageMaintenance !== 'function') stop('CapabilityMissing', '缺少可信单租户维护能力，请先升级所有服务节点。');
    var result = V8.Method.RequireManagedStorageMaintenance({ Scope: 'platform-chat-runtime', ExpectedEpoch: expected || '' });
    if (!result || result.Code !== 1 || !result.Data || String(result.Data.OsClient || '').toLowerCase() !== tenant.toLowerCase() || result.Data.Scope !== 'platform-chat-runtime' || result.Data.WritersDrained !== true || result.Data.WriteAdmissionClosed !== true || !result.Data.Epoch || expected && result.Data.Epoch !== expected) stop('FenceMissing', '单租户维护闸门未确认。');
    return result.Data.Epoch;
  }
  function iso(value) {
    // 历史本地时间没有时区信息时不能静默猜测 UTC；迁移必须先明确时间策略。
    var input;
    if (value && typeof value.toISOString === 'function') input = value.toISOString();
    else if (value && typeof value.ToString === 'function' && (String(value.Kind) === 'Utc' || String(value.Kind) === '1')) input = String(value.ToString('O'));
    else input = String(value || '');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(input)) stop('Conflict', '历史时间缺少明确时区，需单独审核。');
    var date = new Date(input);
    if (isNaN(date.getTime())) stop('Conflict', '历史时间无效。');
    return date.toISOString();
  }
  function location(physicalDb, physicalTable) {
    var dbYear = physicalDb === db ? '' : physicalDb.substring(db.length + 1);
    if (physicalDb !== db && (physicalDb !== db + '_' + dbYear || !/^\d{4}$/.test(dbYear))) stop('Conflict', '消息定位越出租户边界。');
    var match = /^chat_(\d{4})(?:(\d{2})|_(\d{2}))?$/.exec(physicalTable);
    if (!match || (match[2] || match[3]) && !/^(0[1-9]|1[0-2])$/.test(match[2] || match[3]) || dbYear && dbYear !== match[1]) stop('Conflict', '消息物理分区格式无效。');
    return { DbLayout: dbYear ? 'Year' : 'Base', Year: match[1], Month: match[2] || match[3] || '', TableStyle: match[3] ? 'SeparatedMonth' : match[2] ? 'CompactMonth' : 'Annual' };
  }
  function bodyRequest(meta) {
    if (!meta || !/^[0-9a-f]{24}$/.test(String(meta.MessageId))) stop('Conflict', '消息身份无效。');
    var month = String(meta.Month || '');
    var targetDb = meta.DbLayout === 'Base' ? db : meta.DbLayout === 'Year' ? db + '_' + meta.Year : '';
    var targetTable = meta.TableStyle === 'Annual' ? 'chat_' + meta.Year : meta.TableStyle === 'CompactMonth' ? 'chat_' + meta.Year + month : meta.TableStyle === 'SeparatedMonth' ? 'chat_' + meta.Year + '_' + month : '';
    location(targetDb, targetTable);
    if (meta.TableStyle !== 'Annual' && !/^(0[1-9]|1[0-2])$/.test(month)) stop('Conflict', '消息月份无效。');
    return { OsClient: tenant, DbName: targetDb, TableName: targetTable, Id: meta.MessageId };
  }
  function pointerKey(meta) { var req = bodyRequest(meta); return req.DbName + '/' + req.TableName + '/' + req.Id; }
  function conversation(a, b) { return hash('chat-conversation|' + tenant + '|' + [String(a), String(b)].sort().join('|')); }
  function validateBody(row) {
    if (!row || !row.RequestId || !row.FromUserId || !row.ToUserId || !row.PayloadHash || row.MessageId !== options.messageIdFor(row.RequestId) || String(row._id) !== row.MessageId) stop('Conflict', '历史消息缺少可验证身份，不能自动迁移。');
    // 旧 PayloadHash 包含最初 IsRead；已读是可变投影，分别验证原始的两种合法取值。
    var raw = copy(row); raw.IsRead = false;
    var unreadHash = options.fingerprint(raw); raw.IsRead = true;
    if (row.PayloadHash !== unreadHash && row.PayloadHash !== options.fingerprint(raw)) stop('Conflict', '历史消息正文摘要不符。');
  }
  function metadata(row, physicalDb, physicalTable, verified) {
    validateBody(row);
    var value = location(physicalDb, physicalTable);
    value.MessageId = row.MessageId; value.RequestId = row.RequestId;
    value.FromUserId = row.FromUserId; value.ToUserId = row.ToUserId;
    value.PayloadHash = row.PayloadHash; value.OriginalCreateTime = iso(row.CreateTime);
    value.ConversationKey = conversation(row.FromUserId, row.ToUserId);
    value.SortKey = value.OriginalCreateTime + '|' + row.MessageId;
    value.IsRead = row.IsRead === true; value.State = verified ? 'Verified' : 'Reserved';
    value.Schema = 1;
    return value;
  }
  function verifyHydrated(meta, row) {
    if (!meta || meta.Schema !== 1 || meta.State !== 'Verified') stop('Conflict', '消息定位尚未核验。');
    if (!row) stop('Conflict', '定位所指的历史正文不存在。');
    validateBody(row);
    if (row.MessageId !== meta.MessageId || row.RequestId !== meta.RequestId || row.PayloadHash !== meta.PayloadHash || row.FromUserId !== meta.FromUserId || row.ToUserId !== meta.ToUserId || iso(row.CreateTime) !== meta.OriginalCreateTime) stop('Conflict', '定位与原始正文不符。');
    row.IsRead = meta.IsRead === true;
    row._PartitionDb = bodyRequest(meta).DbName; row._PartitionTable = bodyRequest(meta).TableName;
    return row;
  }
  function hydrate(meta) { return verifyHydrated(meta, read(bodyRequest(meta))); }
  function hydratePage(metas) {
    // 每物理分区批量点查 _id，避免一页 100 条逐条跨进程往返；不按正文时间全表扫描。
    var groups = {}, rowsById = {}, output = [];
    for (var i = 0; i < metas.length; i++) {
      var req = bodyRequest(metas[i]), key = req.DbName + '/' + req.TableName;
      if (!groups[key]) groups[key] = { request: req, ids: [] };
      groups[key].ids.push(req.Id);
    }
    for (var groupKey in groups) {
      var group = groups[groupKey], request = group.request; delete request.Id;
      request._Where = [['_id', 'In', group.ids]]; request._PageIndex = 1; request._PageSize = group.ids.length;
      var result = V8.MongoDb.GetTableData(request);
      if (!result || result.Code !== 1) stop('Unknown', '原始消息批量点查未确认。');
      var rows = array(result.Data);
      for (var r = 0; r < rows.length; r++) {
        var id = String(rows[r]._id);
        if (group.ids.indexOf(id) < 0 || rowsById[id]) stop('Conflict', '原始消息点查出现重复或越界身份。');
        rowsById[id] = rows[r];
      }
    }
    for (var m = 0; m < metas.length; m++) output.push(verifyHydrated(metas[m], rowsById[metas[m].MessageId]));
    return output;
  }
  function physical(cursor, directoryHash, pageSize) {
    if (typeof V8.MongoDb.GetPartitionedTableData !== 'function') stop('CapabilityMissing', '需要通用物理游标组件。');
    var result = V8.MongoDb.GetPartitionedTableData({ OsClient: tenant, PhysicalRows: true, DatabasePrefix: 'diy_chat', TablePrefix: 'chat', Cursor: cursor || '', DirectoryHash: directoryHash || '', PageSize: pageSize, MaxPartitions: 8 });
    if (!result || result.Code !== 1 || !result.Data || result.Data.FullPhysicalScope !== true || !result.Data.DirectoryHash || typeof result.Data.HasMore !== 'boolean' || result.Data.HasMore && !result.Data.NextCursor) stop('CapabilityMissing', '物理分页结果未满足完整审计契约。');
    if (directoryHash && result.Data.DirectoryHash !== directoryHash) stop('Conflict', '迁移期间物理分区目录发生变化。');
    result.Data.Rows = array(result.Data.Rows);
    return result.Data;
  }
  function acquire(operationId, expectedRevision) {
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(operationId)) stop('Invalid', '迁移操作标识无效。');
    var old = state();
    if (!old) stop('Pending', '尚未明确启动迁移。');
    if (old.LastOperationId === operationId) return { CompletedOperation: true, State: old };
    if (old.Phase !== 'Running') stop(old.Phase === 'Conflict' ? 'Conflict' : 'Invalid', '迁移不在可执行状态。');
    if (old.Revision !== expectedRevision || old.LeaseUntil > now()) stop('Busy', '迁移版本或租约已变化。');
    var fields = { Revision: old.Revision + 1, LeaseToken: operationId, LeaseUntil: now() + leaseMs };
    var current = casRead(stateTable, stateId, [['Revision', '=', old.Revision], ['LeaseUntil', '=', old.LeaseUntil]], fields);
    if (!sameFields(current, fields)) stop('Busy', '迁移租约未确认。');
    return { State: current };
  }
  function stillOwned(current) {
    requireFence(current.FenceEpoch);
    var actual = state();
    if (!actual || actual.Revision !== current.Revision || actual.LeaseToken !== current.LeaseToken || actual.LeaseUntil <= now()) stop('LeaseLost', '迁移租约已失效。');
  }
  function indexOne(row) {
    var meta = metadata(row, row._PartitionDb, row._PartitionTable, true);
    var req = request(table, row.MessageId); var old = read(req);
    if (!old) old = addRead(req, meta);
    // 旧版只有 Month 的指针不能证明历史唯一性；用 CAS 升级，正文仍不搬动。
    if (old.Schema == null && old.Month && old.PayloadHash) {
      if (!/^\d{4}(0[1-9]|1[0-2])$/.test(String(old.Month))) stop('Conflict', '旧定位月份无效。');
      var oldRequest = { OsClient: tenant, DbName: db + '_' + String(old.Month).substring(0, 4), TableName: 'chat_' + old.Month, Id: row.MessageId };
      var oldBody = read(oldRequest);
      if (oldBody) {
        var oldMeta = metadata(oldBody, oldRequest.DbName, oldRequest.TableName, true);
        if (pointerKey(oldMeta) !== pointerKey(meta)) {
          oldMeta.State = 'Conflict'; oldMeta.ConflictLocation = pointerKey(meta); oldMeta.ConflictPayloadHash = meta.PayloadHash; meta = oldMeta;
        }
      }
      if (old.PayloadHash !== meta.PayloadHash) { meta.State = 'Conflict'; meta.ConflictPayloadHash = old.PayloadHash; }
      var upgraded = casRead(table, row.MessageId, [['Month', '=', old.Month], ['PayloadHash', '=', old.PayloadHash], ['Schema', '<>', 1]], meta);
      if (!upgraded || upgraded.Schema !== 1) stop('Pending', '旧定位升级尚未确认。');
      old = upgraded;
    }
    if (old.State === 'Conflict') return 1;
    var different = pointerKey(old) !== pointerKey(meta) || old.PayloadHash !== meta.PayloadHash || old.RequestId !== meta.RequestId;
    if (different) {
      var conflict = { State: 'Conflict', ConflictLocation: pointerKey(meta), ConflictPayloadHash: meta.PayloadHash };
      var marked = casRead(table, row.MessageId, [['State', '=', old.State], ['PayloadHash', '=', old.PayloadHash]], conflict);
      if (!marked || marked.State !== 'Conflict') stop('Pending', '冲突标记未确认。');
      return 1;
    }
    hydrate(old); return 0;
  }
  function start(param) {
    if (param.MaintenanceConfirmed !== true || !/^[a-zA-Z0-9_-]{8,100}$/.test(String(param.FenceId || ''))) stop('Invalid', '必须先隔离旧写入者并明确维护窗口。');
    var existing = state(); if (existing) return { Code: 1, Data: existing, Duplicate: true };
    var epoch = requireFence('');
    prepare();
    var sample = physical('', '', 1);
    var initial = { Phase: 'Running', Schema: 1, Revision: 0, LeaseToken: '', LeaseUntil: 0, Cursor: '', DirectoryHash: sample.DirectoryHash, Scanned: 0, Conflicts: 0, LastOperationId: '', FenceId: param.FenceId, FenceEpoch: epoch, ScanComplete: false, IndexesReady: true };
    var saved = addRead(request(stateTable, stateId), initial);
    if (!sameFields(saved, initial)) stop('Busy', '已有不同的迁移计划，请读取现有状态。');
    return { Code: 1, Data: saved };
  }
  function prepare() {
    var definitions = [
      { fields: ['ConversationKey', 'State'], values: ['', 'Verified'], count: false },
      { fields: ['ToUserId', 'State', 'IsRead'], values: ['', 'Verified', false], count: true },
      { fields: ['ToUserId', 'State', 'IsRead', 'FromUserId'], values: ['', 'Verified', false, ''], count: true }
    ];
    for (var i = 0; i < definitions.length; i++) {
      var definition = definitions[i], where = [];
      for (var f = 0; f < definition.fields.length; f++) where.push([definition.fields[f], '=', definition.values[f]]);
      var result = V8.MongoDb.GetPartitionedTableData({ OsClient: tenant, DatabasePrefix: 'diy_chat', CollectionPage: true, EnsureIndex: true, TableName: table, SortField: 'SortKey', IndexFields: definition.fields, _Where: where, PageSize: 1, CountOnly: definition.count });
      if (!result || result.Code !== 1 || !result.Data || result.Data.PageKind !== 'Collection' || result.Data.IndexReady !== true) stop('CapabilityMissing', '索引预建未确认，不启动迁移。');
    }
    return { Code: 1 };
  }
  function step(param) {
    var prior = state();
    // 已持久化的最终回执在维护闸门释放后仍可只读恢复，不再重新要求停写。
    if (prior && prior.LastOperationId === String(param.OperationId || '')) return { Code: 1, Data: prior, Duplicate: true };
    if (prior) requireFence(prior.FenceEpoch);
    var lease = acquire(String(param.OperationId || ''), Number(param.ExpectedRevision));
    if (lease.CompletedOperation) return { Code: 1, Data: lease.State, Duplicate: true };
    var current = lease.State;
    var page = physical(current.Cursor, current.DirectoryHash, Math.max(1, Math.min(100, Number(param.PageSize) || 50)));
    var conflicts = current.Conflicts;
    for (var i = 0; i < page.Rows.length; i++) {
      stillOwned(current);
      try { conflicts += indexOne(page.Rows[i]); }
      catch (rowError) {
        if (rowError.reason !== 'Conflict') throw rowError;
        stillOwned(current);
        var blocked = { Revision: current.Revision + 1, Phase: 'Conflict', LeaseToken: '', LeaseUntil: 0, LastOperationId: current.LeaseToken, LastError: String(rowError.message).substring(0, 300), BlockedPhysicalLocation: String(page.Rows[i]._PartitionDb) + '/' + String(page.Rows[i]._PartitionTable) + '/' + String(page.Rows[i]._id) };
        var recorded = casRead(stateTable, stateId, [['Revision', '=', current.Revision], ['LeaseToken', '=', current.LeaseToken]], blocked);
        if (!sameFields(recorded, blocked)) stop('Pending', '迁移冲突回执尚未确认。');
        return { Code: 1, Data: recorded };
      }
    }
    stillOwned(current);
    var next = { Revision: current.Revision + 1, Cursor: page.NextCursor || '', Scanned: current.Scanned + page.Rows.length, Conflicts: conflicts, LeaseToken: '', LeaseUntil: 0, LastOperationId: current.LeaseToken, ScanComplete: !page.HasMore, Phase: page.HasMore ? 'Running' : conflicts ? 'Conflict' : 'Completed' };
    var saved = casRead(stateTable, stateId, [['Revision', '=', current.Revision], ['LeaseToken', '=', current.LeaseToken]], next);
    if (!sameFields(saved, next)) stop('Pending', '迁移进度尚未确认，请回读相同操作标识。');
    return { Code: 1, Data: saved };
  }
  function persist(message) {
    ready();
    var req = request(table, message.MessageId); var meta = read(req);
    if (!meta) {
      var stamp = new Date(now()).toISOString(); var y = stamp.substring(0, 4); var m = stamp.substring(5, 7);
      var proposed = copy(message); proposed._id = message.MessageId; proposed.CreateTime = stamp;
      meta = addRead(req, metadata(proposed, db + '_' + y, 'chat_' + y + m, false));
    }
    if (meta.State === 'Conflict' || meta.Schema !== 1 || meta.RequestId !== message.RequestId || meta.PayloadHash !== message.PayloadHash || meta.FromUserId !== message.FromUserId || meta.ToUserId !== message.ToUserId) stop('Conflict', 'RequestId 已被其它正文占用或存在历史冲突。');
    if (meta.State === 'Verified') {
      var original = hydrate(meta);
      if (!immutableEqual(original, message)) stop('Conflict', '原始正文与重试载荷不符。');
      return { Code: 1, Data: original, Duplicate: true };
    }
    if (meta.State !== 'Reserved') stop('Conflict', '消息定位状态无效。');
    var target = bodyRequest(meta); var row = read(target); var duplicate = true;
    if (!row) {
      target.OccurredAt = meta.OriginalCreateTime; target._FormData = message;
      var inserted;
      try { inserted = V8.MongoDb.AddFormData(target); } catch (unknown) { /* 未知 ACK 保守标记为恢复。 */ }
      row = read(bodyRequest(meta));
      if (!row) stop('Pending', '正文写入尚未确认，请复用同一 RequestId。');
      duplicate = !inserted || inserted.Code !== 1;
    }
    validateBody(row);
    if (!immutableEqual(row, message)) stop('Conflict', '正文持久化结果与请求不符。');
    var verified = casRead(table, message.MessageId, [['State', '=', 'Reserved'], ['PayloadHash', '=', meta.PayloadHash]], { State: 'Verified' });
    if (!verified || verified.State !== 'Verified') stop('Pending', '消息目录提交未确认。');
    return { Code: 1, Data: hydrate(verified), Duplicate: duplicate };
  }
  function canonicalPage(where, fields, cursor, size, countOnly) {
    ready();
    var result = V8.MongoDb.GetPartitionedTableData({ OsClient: tenant, DatabasePrefix: 'diy_chat', CollectionPage: true, TableName: table, SortField: 'SortKey', IndexFields: fields, _Where: where, Cursor: cursor || '', PageSize: size || 20, CountOnly: countOnly === true });
    if (!result || result.Code !== 1 || !result.Data || result.Data.PageKind !== 'Collection') stop('CapabilityMissing', '需要已索引的通用单集合游标组件。');
    return result.Data;
  }
  function history(actor, peer, cursor, size) {
    var page = canonicalPage([['ConversationKey', '=', conversation(actor, peer)], ['State', '=', 'Verified']], ['ConversationKey', 'State'], cursor, size, false);
    if (typeof page.HasMore !== 'boolean' || page.HasMore && !page.NextCursor) stop('Unknown', '目录分页未确认。');
    page.Rows = array(page.Rows);
    var rows = hydratePage(page.Rows);
    return { Code: 1, Data: { Rows: rows, HasMore: page.HasMore, NextCursor: page.NextCursor || '' } };
  }
  function unread(user, peer) {
    var where = [['ToUserId', '=', user], ['State', '=', 'Verified'], ['IsRead', '=', false]];
    var fields = ['ToUserId', 'State', 'IsRead'];
    if (peer) { where.push(['FromUserId', '=', peer]); fields.push('FromUserId'); }
    var page = canonicalPage(where, fields, '', 1, true);
    if (typeof page.Count !== 'number' || !isFinite(page.Count) || page.Count < 0) stop('Unknown', '未读数未确认。');
    return { Code: 1, Data: page.Count };
  }
  function markRead(messageId, actor) {
    ready(); var meta = read(request(table, messageId));
    var row = hydrate(meta);
    if (row.ToUserId !== actor) stop('Forbidden', '不能修改其它用户的已读状态。');
    var target = bodyRequest(meta); target._FormData = { IsRead: true };
    try { V8.MongoDb.UptFormData(target); } catch (unknown) { /* 原文投影先写；读回后才提交目录事实。 */ }
    var body = read(bodyRequest(meta));
    if (!body || body.IsRead !== true) stop('Pending', '原文已读投影未确认。');
    var saved = casRead(table, messageId, [['State', '=', 'Verified'], ['PayloadHash', '=', meta.PayloadHash]], { IsRead: true });
    if (!saved || saved.IsRead !== true) stop('Pending', '目录已读状态未确认。');
    return { Code: 1 };
  }
  return { gate: guard(function () { ready(); return { Code: 1 }; }), prepare: guard(prepare), start: guard(start), step: guard(step), status: guard(function () { return { Code: 1, Data: state() }; }), persist: guard(persist), history: guard(history), unread: guard(unread), markRead: guard(markRead) };
}

function messageIdFor(requestId){return V8.EncryptHelper.Sha256Hex('chat-message|'+String(V8.OsClient)+'|'+requestId).substring(0,24);}
function messageFingerprint(m){return V8.EncryptHelper.Sha256Hex([String(V8.OsClient),m.RequestId,m.FromUserId,m.ToUserId,m.Type,m.Content,m.OtherInfo,m.IsRead===true?'1':'0'].join('|'));}
var index=createLegacyLocationIndex(V8,{now:function(){return new Date().getTime();},messageIdFor:messageIdFor,fingerprint:messageFingerprint});
if(operation==='Status'){var status=index.status();return status&&status.Code===1?{Code:1,Data:{Gate:gate.Data,Migration:status.Data}}:status;}
if(operation==='End'||operation==='AbortUnstarted'){
  var status=index.status();if(!status||status.Code!==1)return status;
  if(operation==='AbortUnstarted'&&status.Data!==null)return fail('已有迁移进度或未知写入，不允许退回旧协议；请恢复当前迁移。');
  if(operation==='End'&&(!status.Data||status.Data.Phase!=='Completed'||status.Data.FenceEpoch!==gate.Data.Epoch||status.Data.ScanComplete!==true||status.Data.Conflicts!==0||status.Data.IndexesReady!==true))return fail('索引尚未完整验收，不能解除维护。');
  return control('End',gate.Data.Revision);
}
if(operation==='Start')return index.start(param);
if(operation==='Step')return index.step(param);
return fail('未知历史定位维护操作。');
