/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：消息通知
 * ApiEngineKey：platform-chat-runtime
 * 从可信吾码官方应用源安装、更新或重新安装“消息通知”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: platform-chat-runtime | Version: v1.2.0 */

var param = V8.Param || {};
var RUNTIME_KEY = 'platform-chat-runtime';
var HOOK_KEY = 'platform-message-notification-custom-hook';
var ASSISTANT = { Id: 'AI', Name: 'AI助手', Account: 'AI', Avatar: '' };
var DB_NAME = 'diy_chat_' + String(V8.OsClient || '').toLowerCase();
// PLATFORM_CHAT_LOCAL_TIME_V1：官方 Managed 接口必须自包含时间能力。
// 客户全局前端/后端 V8 都属于租户扩展，缺失或被修改不能让聊天运行时失效。
function nowText(format) {
  var pattern = String(format || 'yyyy-MM-dd HH:mm:ss');
  try {
    if (typeof System !== 'undefined' && System.DateTime && System.DateTime.Now) {
      return String(System.DateTime.Now.ToString(pattern));
    }
  } catch (systemDateError) {}
  var now = new Date();
  if (pattern === 'yyyy') return String(now.getFullYear());
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

var LEGACY_MESSAGE_TABLE = 'chat_' + nowText('yyyy');
var MESSAGE_LOCATION_TABLE = 'chat_message_location';
var CONTACT_TABLE = 'chat_last_contact';

function fail(message, code) {
  return { Code: code || 0, Msg: message };
}

// CHAT_SIGNALR_TRUSTED_PROTOCOL_V1：Hub 保留 Client 权限语义，但必须消费宿主按
// 固定 ApiEngineKey + OsClient 建立的一次性上下文。接口引擎内部 Server 调用不受影响。
function requireTrustedHostProtocolForClientInvocation() {
  if (String(param._InvokeType || '').toLowerCase() !== 'client') return null;
  var result = V8.Method.RequireManagedProtocolContext();
  return result && Number(result.Code) === 1
    ? null
    : (result || fail('聊天 SignalR 可信协议上下文不存在。'));
}

function text(value, maxLength) {
  var result = String(value === null || typeof value === 'undefined' ? '' : value).trim();
  return result.length <= maxLength ? result : result.substring(0, maxLength);
}

function rawText(value, maxLength) {
  var result = String(value === null || typeof value === 'undefined' ? '' : value);
  return result.length <= maxLength ? result : result.substring(0, maxLength);
}

function boundedInt(value, fallback, minimum, maximum) {
  var parsed = Number(value);
  if (!isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}

function toArray(value) {
  var result = [];
  if (!value) return result;
  var length = Number(value.length);
  if (!isNaN(length) && length >= 0) {
    for (var index = 0; index < length; index++) result.push(value[index]);
    return result;
  }
  var count = Number(value.Count);
  if (!isNaN(count) && count >= 0) {
    for (var itemIndex = 0; itemIndex < count; itemIndex++) result.push(value[itemIndex]);
  }
  return result;
}

function displayName(name, account) {
  return text(name, 200) || text(account, 200) || '未命名用户';
}

function actorProfile() {
  return {
    Id: text(V8.CurrentUser && V8.CurrentUser.Id, 100),
    Name: displayName(V8.CurrentUser && V8.CurrentUser.Name, V8.CurrentUser && V8.CurrentUser.Account),
    Account: text(V8.CurrentUser && V8.CurrentUser.Account, 200),
    Avatar: text(V8.CurrentUser && V8.CurrentUser.Avatar, 1000)
  };
}

function isAdmin() {
  return V8.CurrentUser && (V8.CurrentUser._IsAdmin === true || Number(V8.CurrentUser.Level || 0) >= 9999);
}

function getUser(userId) {
  if (String(userId).toUpperCase() === ASSISTANT.Id) return { Code: 1, Data: ASSISTANT };
  var result = V8.FormEngine.GetFormData('sys_user', {
    Id: userId,
    _Where: [['State', '=', 1], ['IsDeleted', '=', 0]],
    _SelectFields: ['Id', 'Name', 'Account', 'Avatar']
  });
  if (!result || result.Code !== 1 || !result.Data) {
    return result && result.Code !== 1
      ? { Code: result.Code, Msg: result.Msg || '聊天用户不存在或已停用。' }
      : fail('聊天用户不存在或已停用。');
  }
  return {
    Code: 1,
    Data: {
      Id: text(result.Data.Id, 100),
      Name: displayName(result.Data.Name, result.Data.Account),
      Account: text(result.Data.Account, 200),
      Avatar: text(result.Data.Avatar, 1000)
    }
  };
}

function mongoParam(tableName) {
  return { OsClient: V8.OsClient, DbName: DB_NAME, TableName: tableName };
}

function query(tableName, where, pageIndex, pageSize, orderBy, orderByType) {
  var request = mongoParam(tableName);
  request._Where = where;
  request._PageIndex = pageIndex || 1;
  request._PageSize = pageSize || 20;
  request._OrderBy = orderBy || 'CreateTime';
  request._OrderByType = orderByType || 'DESC';
  return V8.MongoDb.GetTableData(request);
}

function unreadCount(userId, peerUserId) { return locationIndex.unread(userId, peerUserId); }

function hookPayload(stage, action, actorUserId, peerUserId, messageId, messageType) {
  return {
    Stage: stage,
    SourceApiEngineKey: RUNTIME_KEY,
    Action: action,
    ActorUserId: text(actorUserId, 100),
    PeerUserId: text(peerUserId, 100),
    MessageId: text(messageId, 100),
    MessageType: text(messageType, 100)
  };
}

function runHook(stage, action, actorUserId, peerUserId, messageId, messageType) {
  return V8.ApiEngine.Run(
    HOOK_KEY,
    hookPayload(stage, action, actorUserId, peerUserId, messageId, messageType),
    V8.DbTrans);
}

function messageIdFor(requestId) {
  return V8.EncryptHelper.Sha256Hex('chat-message|' + String(V8.OsClient) + '|' + requestId).substring(0, 24);
}

function contactIdFor(userId, contactUserId) {
  return V8.EncryptHelper.Sha256Hex('chat-contact|' + String(V8.OsClient) + '|' + userId + '|' + contactUserId).substring(0, 24);
}

function messageFingerprint(message) {
  return V8.EncryptHelper.Sha256Hex([
    String(V8.OsClient), message.RequestId, message.FromUserId, message.ToUserId,
    message.Type, message.Content, message.OtherInfo, message.IsRead === true ? '1' : '0'
  ].join('|'));
}

function samePersistedMessage(existing, expected) {
  return existing
    && text(existing.MessageId, 100) === expected.MessageId
    && text(existing.RequestId, 200) === expected.RequestId
    && text(existing.FromUserId, 100) === expected.FromUserId
    && text(existing.ToUserId, 100) === expected.ToUserId
    && text(existing.PayloadHash, 100) === expected.PayloadHash;
}

// Mongo Find 的权威不存在结果是 Code=1/Data=null；旧 Code=2 仅保留无正文兼容。
// 缺字段、错误码和异常均不是“不存在”，不得据此写入或生成新的消息身份。
function mongoMissing(result) {
  return !!result && (result.Code === 1 && result.Data === null
    || result.Code === 2 && (result.Data === null || typeof result.Data === 'undefined'));
}
function mongoFound(result) {
  return !!result && result.Code === 1 && !!result.Data && typeof result.Data === 'object';
}

function persistMessageRecord(message) { return locationIndex.persist(message); }

function updateContact(existingId, formData) {
  return V8.MongoDb.UptFormData({
    OsClient: V8.OsClient, DbName: DB_NAME, TableName: CONTACT_TABLE,
    Id: existingId, _FormData: formData
  });
}

function upsertContact(user, contact, message, updateTime) {
  var deterministicId = contactIdFor(user.Id, contact.Id);
  var exact = query(CONTACT_TABLE, [
    ['UserId', '=', user.Id], ['ContactUserId', '=', contact.Id]
  ], 1, 100, 'UpdateTime', 'DESC');
  if (!exact || exact.Code !== 1) return fail(exact && exact.Msg || '读取聊天联系人失败。');
  var rows = toArray(exact.Data);
  var current = rows.length > 0 ? rows[0] : null;
  var currentId = current ? text(current._id || current.Id, 100) : deterministicId;
  var unread = unreadCount(user.Id, contact.Id);
  if (!unread || unread.Code !== 1) return unread;
  var now = nowText('yyyy-MM-dd HH:mm:ss');
  var model = {
    UserId: user.Id,
    UserName: user.Name,
    UserAccount: user.Account,
    UserAvatar: user.Avatar,
    ContactUserId: contact.Id,
    ContactUserName: contact.Name,
    ContactUserAccount: contact.Account,
    ContactUserAvatar: contact.Avatar,
    LastMessage: message ? rawText(message.Content, 200000) : rawText(current && current.LastMessage, 200000),
    LastMessageType: message ? text(message.Type, 100) : text(current && current.LastMessageType, 100),
    OtherInfo: message ? rawText(message.OtherInfo, 20000) : rawText(current && current.OtherInfo, 20000),
    UnRead: unread.Data,
    UpdateTime: updateTime || !current ? now : current.UpdateTime
  };

  var saveResult;
  if (current) {
    saveResult = updateContact(currentId, model);
  } else {
    saveResult = V8.MongoDb.AddFormData({
      OsClient: V8.OsClient, DbName: DB_NAME, TableName: CONTACT_TABLE,
      Id: deterministicId, _FormData: model
    });
    if (!saveResult || saveResult.Code !== 1) {
      var raced = V8.MongoDb.GetFormData({
        OsClient: V8.OsClient, DbName: DB_NAME, TableName: CONTACT_TABLE, Id: deterministicId
      });
      saveResult = raced && raced.Code === 1 ? updateContact(deterministicId, model) : saveResult;
    }
  }
  if (!saveResult || saveResult.Code !== 1) return fail(saveResult && saveResult.Msg || '保存聊天联系人失败。');

  // 清理历史随机 _id 重复项；确定性主记录或当前复用记录永不删除。
  for (var index = 0; index < rows.length; index++) {
    var duplicateId = text(rows[index]._id || rows[index].Id, 100);
    if (duplicateId && duplicateId !== currentId) {
      V8.MongoDb.DelFormData({
        OsClient: V8.OsClient, DbName: DB_NAME, TableName: CONTACT_TABLE, Id: duplicateId
      });
    }
  }
  return { Code: 1 };
}

function contactDto(row, projection) {
  return {
    UserId: text(row.UserId, 100),
    UserName: displayName(row.UserName, row.UserAccount),
    UserAccount: text(row.UserAccount, 200),
    UserAvatar: text(row.UserAvatar, 1000),
    ContactUserId: text(row.ContactUserId, 100),
    ContactUserName: displayName(projection && projection.Name || row.ContactUserName,
      projection && projection.Account || row.ContactUserAccount),
    ContactUserAccount: text(projection && projection.Account || row.ContactUserAccount, 200),
    ContactUserAvatar: text(projection && projection.Avatar || row.ContactUserAvatar, 1000),
    ContactUserDeviceClientId: '',
    LastMessage: rawText(row.LastMessage, 200000),
    LastMessageType: text(row.LastMessageType, 100),
    OtherInfo: rawText(row.OtherInfo, 20000),
    UnRead: Number(row.UnRead || 0),
    UpdateTime: row.UpdateTime
  };
}

function listContacts(userId, pageIndex, pageSize) {
  var result = query(CONTACT_TABLE, [['UserId', '=', userId]], pageIndex, pageSize, 'UpdateTime', 'DESC');
  if (!result || result.Code !== 1) return fail(result && result.Msg || '读取聊天联系人失败。');
  var rows = toArray(result.Data);
  var ids = [];
  for (var index = 0; index < rows.length; index++) {
    var id = text(rows[index].ContactUserId, 100);
    if (id && id.toUpperCase() !== ASSISTANT.Id && ids.indexOf(id) < 0) ids.push(id);
  }
  var projections = {};
  if (ids.length > 0) {
    var usersResult = V8.FormEngine.GetTableData('sys_user', {
      Ids: ids,
      _SelectFields: ['Id', 'Name', 'Account', 'Avatar'],
      _PageIndex: 1,
      _PageSize: Math.min(ids.length, 100)
    });
    if (usersResult && usersResult.Code === 1) {
      var users = toArray(usersResult.Data);
      for (var userIndex = 0; userIndex < users.length; userIndex++) {
        projections[text(users[userIndex].Id, 100)] = users[userIndex];
      }
    }
  }
  projections[ASSISTANT.Id] = ASSISTANT;
  var data = [];
  for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    var peerId = text(rows[rowIndex].ContactUserId, 100);
    data.push(contactDto(rows[rowIndex], projections[peerId]));
  }
  return { Code: 1, Data: data, DataCount: Number(result.DataCount || data.length) };
}

function messageDto(row, fromProjection, toProjection) {
  return {
    MessageId: text(row.MessageId || row._id, 100),
    RequestId: text(row.RequestId, 200),
    FromUserId: text(row.FromUserId, 100),
    FromUserName: displayName(fromProjection && fromProjection.Name || row.FromUserName,
      fromProjection && fromProjection.Account || row.FromUserAccount),
    FromUserAccount: text(fromProjection && fromProjection.Account || row.FromUserAccount, 200),
    FromUserAvatar: text(fromProjection && fromProjection.Avatar || row.FromUserAvatar, 1000),
    ToUserId: text(row.ToUserId, 100),
    ToUserName: displayName(toProjection && toProjection.Name || row.ToUserName,
      toProjection && toProjection.Account || row.ToUserAccount),
    ToUserAccount: text(toProjection && toProjection.Account || row.ToUserAccount, 200),
    ToUserAvatar: text(toProjection && toProjection.Avatar || row.ToUserAvatar, 1000),
    Content: rawText(row.Content, 200000),
    OtherInfo: rawText(row.OtherInfo, 20000),
    CreateTime: row.CreateTime,
    Type: text(row.Type, 100),
    IsRead: row.IsRead === true
  };
}

function timestamp(value) {
  var parsed = Date.parse(String(value || ''));
  return isNaN(parsed) ? 0 : parsed;
}

function history(actor, peer, pageIndex, pageSize) {
  var cursor=String(param.Cursor||''), result;
  for(var page=0;page<(param.CursorMode===true||cursor?1:pageIndex);page++) {
    result=locationIndex.history(actor.Id,peer.Id,cursor,pageSize);
    if(!result||result.Code!==1)return result;
    if(!result.Data.HasMore)break;
    cursor=result.Data.NextCursor;
  }
  var selected=toArray(result.Data.Rows).reverse(),messages=[];
  for(var i=0;i<selected.length;i++)messages.push(messageDto(selected[i],selected[i].FromUserId===actor.Id?actor:peer,selected[i].ToUserId===actor.Id?actor:peer));
  return {Code:1,Data:messages,Rows:selected,DataCount:messages.length,HasMore:result.Data.HasMore,NextCursor:result.Data.NextCursor};
}

function addWarning(warnings, result, fallback) {
  if (!result || result.Code !== 1) warnings.push(text(result && result.Msg || fallback, 500));
}

function complete(action, actorUserId, peerUserId, messageId, messageType, data, append, warnings) {
  if(data && (data.ActorUnreadCount===null || data.TargetUnreadCount===null || data.UnreadCount===null)) append.UnreadCountPending=true;
  var after = runHook('AfterChatRuntime', action, actorUserId, peerUserId, messageId, messageType);
  if (!after || after.Code !== 1) {
    append.HookWarning = text(after && after.Msg || '消息通知个性化 Hook 未返回结果。', 500);
  }
  if (warnings.length > 0) append.ProjectionWarnings = warnings;
  return { Code: 1, Data: data, DataAppend: append };
}

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

var locationIndex=createLegacyLocationIndex(V8,{now:function(){return new Date().getTime();},messageIdFor:messageIdFor,fingerprint:messageFingerprint});

var trustedHostProtocolError = requireTrustedHostProtocolForClientInvocation();
if (trustedHostProtocolError) return trustedHostProtocolError;

if (!V8.CurrentUser || !V8.CurrentUser.Id || !V8.OsClient) {
  return fail('登录身份已过期，请重新登录。', 1001);
}

var action = text(param.Action, 100);
var actor = actorProfile();
var peerUserId = text(param.PeerUserId || param.ToUserId || param.ContactUserId, 100);
var requestId = text(param.RequestId, 200);
var content = rawText(param.Content, 200000);
var messageType = text(param.Type || 'text', 100) || 'text';
var messageId = requestId ? messageIdFor(requestId) : '';
if(action==='LegacyLocationStatus'||action==='LegacyLocationStart'||action==='LegacyLocationStep'||action==='LegacyLocationPrepare') {
  return fail('历史定位维护请使用专用 platform-chat-maintenance 管理入口；普通聊天入口不能绕过停写准入。');
}
var allowedActions = [
  'PersistMessage', 'PersistSystemMessage', 'PersistAssistantMessage',
  'GetHistoryAndMarkRead', 'GetUnreadCount', 'TouchContact', 'ListContacts', 'DeleteContact'
];

if (!action) return fail('聊天动作不能为空。');
if (allowedActions.indexOf(action) < 0) return fail('不支持的聊天动作。');
if ((action === 'PersistMessage' || action === 'PersistSystemMessage' || action === 'PersistAssistantMessage')
  && (!requestId || !messageId || !content.trim())) {
  return fail('RequestId、接收用户和消息内容不能为空。');
}
if (String(param.Content === null || typeof param.Content === 'undefined' ? '' : param.Content).length > 200000) {
  return fail('聊天消息内容不能超过 200000 个字符。');
}
if ((action === 'PersistMessage' || action === 'PersistSystemMessage'
    || action === 'GetHistoryAndMarkRead' || action === 'TouchContact' || action === 'DeleteContact')
  && !peerUserId) {
  return fail('聊天对象不能为空。');
}
if (action === 'PersistSystemMessage' && !isAdmin()) {
  return fail('只有平台超级管理员可以发送系统消息。');
}

// 先拒绝非法动作和越权系统消息，再读取迁移状态，避免无效请求触发任何存储 I/O。
// 未显式启动迁移的租户继续完整旧协议；旧幂等缺陷并未因此声称修复。
var storedMode=locationIndex.status();
if(!storedMode||storedMode.Code!==1)return storedMode;
if(storedMode.Data===null)return runLegacyCompatibility(V8,System);

// 迁移未完成时，连可能写数据的租户 Hook 也不能先执行。
var locationGate=locationIndex.gate();
if(!locationGate||locationGate.Code!==1)return locationGate;
var before = runHook('BeforeChatRuntime', action, actor.Id, peerUserId, messageId, messageType);
if (!before || before.Code !== 1) return before || fail('消息通知个性化 Hook 未返回结果。');

if (action === 'PersistMessage' || action === 'PersistSystemMessage' || action === 'PersistAssistantMessage') {
  var fromUser = actor;
  var toUserId = peerUserId;
  if (action === 'PersistSystemMessage') {
    fromUser = ASSISTANT;
    messageType = '系统消息';
  } else if (action === 'PersistAssistantMessage') {
    fromUser = ASSISTANT;
    toUserId = actor.Id;
  }
  if (!toUserId) return fail('接收用户不能为空。');
  var toResult = getUser(toUserId);
  if (!toResult || toResult.Code !== 1) return toResult;
  var toUser = toResult.Data;
  var message = {
    MessageId: messageId,
    RequestId: requestId,
    FromUserId: fromUser.Id,
    FromUserName: fromUser.Name,
    FromUserAccount: fromUser.Account,
    FromUserAvatar: fromUser.Avatar,
    ToUserId: toUser.Id,
    ToUserName: toUser.Name,
    ToUserAccount: toUser.Account,
    ToUserAvatar: toUser.Avatar,
    Content: content,
    OtherInfo: rawText(param.OtherInfo, 20000),
    Type: messageType,
    IsRead: param.IsRead === true,
    IsRecall: false,
    IsFromDeleted: false,
    IsToDeleted: false,
    PayloadHash: ''
  };
  message.PayloadHash = messageFingerprint(message);
  var persisted = persistMessageRecord(message);
  if (!persisted || persisted.Code !== 1) return persisted;
  var stored = persisted.Data || message;
  var warnings = [];
  addWarning(warnings, upsertContact(fromUser, toUser, stored, true), '更新发送者联系人失败。');
  addWarning(warnings, upsertContact(toUser, fromUser, stored, true), '更新接收者联系人失败。');
  var actorContacts = listContacts(actor.Id, 1, 20);
  addWarning(warnings, actorContacts, '刷新当前用户联系人失败。');
  var targetContacts = listContacts(toUser.Id, 1, 20);
  addWarning(warnings, targetContacts, '刷新接收用户联系人失败。');
  var actorUnread = unreadCount(actor.Id, '');
  addWarning(warnings, actorUnread, '刷新当前用户未读数失败。');
  var targetUnread = unreadCount(toUser.Id, '');
  addWarning(warnings, targetUnread, '刷新接收用户未读数失败。');
  return complete(action, actor.Id, toUser.Id, messageId, messageType, {
    Message: messageDto(stored, fromUser, toUser),
    ActorUserId: actor.Id,
    TargetUserId: toUser.Id,
    ActorContacts: actorContacts && actorContacts.Code === 1 ? actorContacts.Data : [],
    TargetContacts: targetContacts && targetContacts.Code === 1 ? targetContacts.Data : [],
    ActorUnreadCount: actorUnread && actorUnread.Code === 1 ? actorUnread.Data : null,
    TargetUnreadCount: targetUnread && targetUnread.Code === 1 ? targetUnread.Data : null
  }, {
    StorageCommitted: true,
    DeliveryPending: true,
    Duplicate: persisted.Duplicate === true
  }, warnings);
}

if (action === 'GetHistoryAndMarkRead') {
  if (!peerUserId) return fail('聊天对象不能为空。');
  var peerResult = getUser(peerUserId);
  if (!peerResult || peerResult.Code !== 1) return peerResult;
  var peer = peerResult.Data;
  var pageIndex = boundedInt(param.PageIndex || param._PageIndex, 1, 1, 100);
  var pageSize = boundedInt(param.PageSize || param._PageSize, 20, 1, 100);
  var historyResult = history(actor, peer, pageIndex, pageSize);
  if (!historyResult || historyResult.Code !== 1) return historyResult;
  // 只标记本页已展示的收件消息；不能把未加载的跨月历史提前标记为已读。
  for (var readIndex=0;readIndex<historyResult.Rows.length;readIndex++) {
    var readRow=historyResult.Rows[readIndex];
    if(String(readRow.FromUserId)!==peer.Id||String(readRow.ToUserId)!==actor.Id||readRow.IsRead===true)continue;
    var markRead=locationIndex.markRead(String(readRow._id),actor.Id);
    if(!markRead||markRead.Code!==1)return fail(markRead&&markRead.Msg||'更新聊天已读状态失败。');
  }
  var historyWarnings = [];
  addWarning(historyWarnings, upsertContact(actor, peer, null, false), '刷新聊天联系人失败。');
  var historyContacts = listContacts(actor.Id, 1, 20);
  addWarning(historyWarnings, historyContacts, '刷新聊天联系人列表失败。');
  var historyUnread = unreadCount(actor.Id, '');
  addWarning(historyWarnings, historyUnread, '刷新聊天未读数失败。');
  return complete(action, actor.Id, peer.Id, '', '', {
    Messages: historyResult.Data,
    DataCount: historyResult.DataCount,
    HasMore:historyResult.HasMore,
    NextCursor:historyResult.NextCursor,
    PeerUserId:peer.Id,
    ActorUserId: actor.Id,
    Contacts: historyContacts && historyContacts.Code === 1 ? historyContacts.Data : [],
    UnreadCount: historyUnread && historyUnread.Code === 1 ? historyUnread.Data : null
  }, { StorageCommitted: true, DeliveryPending: true }, historyWarnings);
}

if (action === 'GetUnreadCount') {
  var unreadResult = unreadCount(actor.Id, '');
  if (!unreadResult || unreadResult.Code !== 1) return unreadResult;
  return complete(action, actor.Id, '', '', '', {
    ActorUserId: actor.Id,
    UnreadCount: unreadResult.Data
  }, { StorageCommitted: false, DeliveryPending: true }, []);
}

if (action === 'TouchContact') {
  if (!peerUserId) return fail('聊天对象不能为空。');
  var touchPeerResult = getUser(peerUserId);
  if (!touchPeerResult || touchPeerResult.Code !== 1) return touchPeerResult;
  var touchResult = upsertContact(actor, touchPeerResult.Data, null, false);
  if (!touchResult || touchResult.Code !== 1) return touchResult;
  var touchContacts = listContacts(actor.Id, 1, 20);
  var touchWarnings = [];
  addWarning(touchWarnings, touchContacts, '刷新聊天联系人列表失败。');
  return complete(action, actor.Id, peerUserId, '', '', {
    ActorUserId: actor.Id,
    Contacts: touchContacts && touchContacts.Code === 1 ? touchContacts.Data : []
  }, { StorageCommitted: true, DeliveryPending: true }, touchWarnings);
}

if (action === 'ListContacts') {
  var contactPageIndex = boundedInt(param.PageIndex || param._PageIndex, 1, 1, 100);
  var contactPageSize = boundedInt(param.PageSize || param._PageSize, 20, 1, 100);
  var contactsResult = listContacts(actor.Id, contactPageIndex, contactPageSize);
  if (!contactsResult || contactsResult.Code !== 1) return contactsResult;
  return complete(action, actor.Id, '', '', '', {
    ActorUserId: actor.Id,
    Contacts: contactsResult.Data,
    DataCount: contactsResult.DataCount
  }, { StorageCommitted: false, DeliveryPending: true }, []);
}

if (action === 'DeleteContact') {
  if (!peerUserId) return fail('聊天对象不能为空。');
  var deleteResult = V8.MongoDb.DelFormDataByWhere({
    OsClient: V8.OsClient, DbName: DB_NAME, TableName: CONTACT_TABLE,
    _Where: [['UserId', '=', actor.Id], ['ContactUserId', '=', peerUserId]]
  });
  if (!deleteResult || deleteResult.Code !== 1) return fail(deleteResult && deleteResult.Msg || '删除聊天联系人失败。');
  var remainingContacts = listContacts(actor.Id, 1, 20);
  var deleteWarnings = [];
  addWarning(deleteWarnings, remainingContacts, '刷新聊天联系人列表失败。');
  return complete(action, actor.Id, peerUserId, '', '', {
    ActorUserId: actor.Id,
    Contacts: remainingContacts && remainingContacts.Code === 1 ? remainingContacts.Data : []
  }, { StorageCommitted: true, DeliveryPending: true }, deleteWarnings);
}

return fail('不支持的聊天动作。');

function runLegacyCompatibility(V8,System) {
/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：消息通知
 * ApiEngineKey：platform-chat-runtime
 * 从可信吾码官方应用源安装、更新或重新安装“消息通知”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: platform-chat-runtime | Version: v1.1.0 */

var param = V8.Param || {};
var RUNTIME_KEY = 'platform-chat-runtime';
var HOOK_KEY = 'platform-message-notification-custom-hook';
var ASSISTANT = { Id: 'AI', Name: 'AI助手', Account: 'AI', Avatar: '' };
var DB_NAME = 'diy_chat_' + String(V8.OsClient || '').toLowerCase();
// PLATFORM_CHAT_LOCAL_TIME_V1：官方 Managed 接口必须自包含时间能力。
// 客户全局前端/后端 V8 都属于租户扩展，缺失或被修改不能让聊天运行时失效。
function nowText(format) {
  var pattern = String(format || 'yyyy-MM-dd HH:mm:ss');
  try {
    if (typeof System !== 'undefined' && System.DateTime && System.DateTime.Now) {
      return String(System.DateTime.Now.ToString(pattern));
    }
  } catch (systemDateError) {}
  var now = new Date();
  if (pattern === 'yyyy') return String(now.getFullYear());
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

var LEGACY_MESSAGE_TABLE = 'chat_' + nowText('yyyy');
var MESSAGE_LOCATION_TABLE = 'chat_message_location';
var CONTACT_TABLE = 'chat_last_contact';

function fail(message, code) {
  return { Code: code || 0, Msg: message };
}

// CHAT_SIGNALR_TRUSTED_PROTOCOL_V1：Hub 保留 Client 权限语义，但必须消费宿主按
// 固定 ApiEngineKey + OsClient 建立的一次性上下文。接口引擎内部 Server 调用不受影响。
function requireTrustedHostProtocolForClientInvocation() {
  if (String(param._InvokeType || '').toLowerCase() !== 'client') return null;
  var result = V8.Method.RequireManagedProtocolContext();
  return result && Number(result.Code) === 1
    ? null
    : (result || fail('聊天 SignalR 可信协议上下文不存在。'));
}

function text(value, maxLength) {
  var result = String(value === null || typeof value === 'undefined' ? '' : value).trim();
  return result.length <= maxLength ? result : result.substring(0, maxLength);
}

function rawText(value, maxLength) {
  var result = String(value === null || typeof value === 'undefined' ? '' : value);
  return result.length <= maxLength ? result : result.substring(0, maxLength);
}

function boundedInt(value, fallback, minimum, maximum) {
  var parsed = Number(value);
  if (!isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}

function toArray(value) {
  var result = [];
  if (!value) return result;
  var length = Number(value.length);
  if (!isNaN(length) && length >= 0) {
    for (var index = 0; index < length; index++) result.push(value[index]);
    return result;
  }
  var count = Number(value.Count);
  if (!isNaN(count) && count >= 0) {
    for (var itemIndex = 0; itemIndex < count; itemIndex++) result.push(value[itemIndex]);
  }
  return result;
}

function displayName(name, account) {
  return text(name, 200) || text(account, 200) || '未命名用户';
}

function actorProfile() {
  return {
    Id: text(V8.CurrentUser && V8.CurrentUser.Id, 100),
    Name: displayName(V8.CurrentUser && V8.CurrentUser.Name, V8.CurrentUser && V8.CurrentUser.Account),
    Account: text(V8.CurrentUser && V8.CurrentUser.Account, 200),
    Avatar: text(V8.CurrentUser && V8.CurrentUser.Avatar, 1000)
  };
}

function isAdmin() {
  return V8.CurrentUser && (V8.CurrentUser._IsAdmin === true || Number(V8.CurrentUser.Level || 0) >= 9999);
}

function getUser(userId) {
  if (String(userId).toUpperCase() === ASSISTANT.Id) return { Code: 1, Data: ASSISTANT };
  var result = V8.FormEngine.GetFormData('sys_user', {
    Id: userId,
    _Where: [['State', '=', 1], ['IsDeleted', '=', 0]],
    _SelectFields: ['Id', 'Name', 'Account', 'Avatar']
  });
  if (!result || result.Code !== 1 || !result.Data) {
    return result && result.Code !== 1
      ? { Code: result.Code, Msg: result.Msg || '聊天用户不存在或已停用。' }
      : fail('聊天用户不存在或已停用。');
  }
  return {
    Code: 1,
    Data: {
      Id: text(result.Data.Id, 100),
      Name: displayName(result.Data.Name, result.Data.Account),
      Account: text(result.Data.Account, 200),
      Avatar: text(result.Data.Avatar, 1000)
    }
  };
}

function mongoParam(tableName) {
  return { OsClient: V8.OsClient, DbName: DB_NAME, TableName: tableName };
}

function query(tableName, where, pageIndex, pageSize, orderBy, orderByType) {
  var request = mongoParam(tableName);
  request._Where = where;
  request._PageIndex = pageIndex || 1;
  request._PageSize = pageSize || 20;
  request._OrderBy = orderBy || 'CreateTime';
  request._OrderByType = orderByType || 'DESC';
  return V8.MongoDb.GetTableData(request);
}

function unreadCount(userId, peerUserId) {
  var where = [['ToUserId', '=', userId], ['IsRead', '=', false]];
  if (peerUserId) where.push(['FromUserId', '=', peerUserId]);
  var result = V8.MongoDb.GetPartitionedTableData({ OsClient: V8.OsClient, DatabasePrefix: 'diy_chat', TablePrefix: 'chat', _Where: where, IndexFields: ['ToUserId', 'IsRead', 'FromUserId'], CountOnly: true, MaxPartitions: 128 });
  if (!result || result.Code !== 1) return { Code: result && result.Code || 0, Msg: result && result.Msg || '读取未读数失败。' };
  return { Code: 1, Data: Number(result.Data && result.Data.Count || 0) };
}

function hookPayload(stage, action, actorUserId, peerUserId, messageId, messageType) {
  return {
    Stage: stage,
    SourceApiEngineKey: RUNTIME_KEY,
    Action: action,
    ActorUserId: text(actorUserId, 100),
    PeerUserId: text(peerUserId, 100),
    MessageId: text(messageId, 100),
    MessageType: text(messageType, 100)
  };
}

function runHook(stage, action, actorUserId, peerUserId, messageId, messageType) {
  return V8.ApiEngine.Run(
    HOOK_KEY,
    hookPayload(stage, action, actorUserId, peerUserId, messageId, messageType),
    V8.DbTrans);
}

function messageIdFor(requestId) {
  return V8.EncryptHelper.Sha256Hex('chat-message|' + String(V8.OsClient) + '|' + requestId).substring(0, 24);
}

function contactIdFor(userId, contactUserId) {
  return V8.EncryptHelper.Sha256Hex('chat-contact|' + String(V8.OsClient) + '|' + userId + '|' + contactUserId).substring(0, 24);
}

function messageFingerprint(message) {
  return V8.EncryptHelper.Sha256Hex([
    String(V8.OsClient), message.RequestId, message.FromUserId, message.ToUserId,
    message.Type, message.Content, message.OtherInfo, message.IsRead === true ? '1' : '0'
  ].join('|'));
}

function samePersistedMessage(existing, expected) {
  return existing
    && text(existing.MessageId, 100) === expected.MessageId
    && text(existing.RequestId, 200) === expected.RequestId
    && text(existing.FromUserId, 100) === expected.FromUserId
    && text(existing.ToUserId, 100) === expected.ToUserId
    && text(existing.PayloadHash, 100) === expected.PayloadHash;
}

// Mongo Find 的权威不存在结果是 Code=1/Data=null；旧 Code=2 仅保留无正文兼容。
// 缺字段、错误码和异常均不是“不存在”，不得据此写入或生成新的消息身份。
function mongoMissing(result) {
  return !!result && (result.Code === 1 && result.Data === null
    || result.Code === 2 && (result.Data === null || typeof result.Data === 'undefined'));
}
function mongoFound(result) {
  return !!result && result.Code === 1 && !!result.Data && typeof result.Data === 'object';
}

function persistMessageRecord(message) {
  // 先保留固定 Id 的分区指针：跨月重试必须继续原月份，不重复创建正文。
  var pointerRequest = { OsClient: V8.OsClient, DbName: DB_NAME, TableName: MESSAGE_LOCATION_TABLE, Id: message.MessageId };
  var pointer = V8.MongoDb.GetFormData(pointerRequest);
  if (mongoMissing(pointer)) {
    var legacy = V8.MongoDb.GetFormData({OsClient:V8.OsClient,DbName:DB_NAME,TableName:LEGACY_MESSAGE_TABLE,Id:message.MessageId});
    if (mongoFound(legacy)) return samePersistedMessage(legacy.Data, message)
      ? {Code:1,Data:legacy.Data,Duplicate:true} : fail('RequestId 已被其它聊天消息占用。');
    if (!mongoMissing(legacy)) return fail(legacy && legacy.Msg || '读取历史消息失败。');
    var month = nowText('yyyy-MM-dd HH:mm:ss').substring(0,7).replace('-', '');
    pointerRequest._FormData = { Month: month, PayloadHash: message.PayloadHash };
    // 新增返回未知也只回读同一 Id；不在当前调用里重发写入。
    try { V8.MongoDb.AddFormData(pointerRequest); } catch (pointerWriteUnknown) {}
    pointer = V8.MongoDb.GetFormData(pointerRequest);
  }
  if (!mongoFound(pointer)) return fail(pointer && pointer.Msg || '消息分区保存未确认，请使用相同 RequestId 重试。');
  var location = pointer.Data;
  if (!/^[0-9]{4}(0[1-9]|1[0-2])$/.test(String(location.Month)) || location.PayloadHash !== message.PayloadHash)
    return fail('RequestId 已被其它聊天消息占用。');
  var request = { OsClient:V8.OsClient, DbName:DB_NAME+'_'+String(location.Month).substring(0,4), TableName:'chat_'+location.Month, Id:message.MessageId, OccurredAt:location.CreateTime };
  var existing = V8.MongoDb.GetFormData(request);
  if (mongoFound(existing)) return samePersistedMessage(existing.Data, message)
    ? {Code:1,Data:existing.Data,Duplicate:true} : fail('RequestId 已被其它聊天消息占用。');
  if (!mongoMissing(existing)) return fail(existing && existing.Msg || '读取消息失败。');
  request._FormData = message;
  var added;
  try { added = V8.MongoDb.AddFormData(request); } catch (messageWriteUnknown) {}
  // Mongo 正文不参加 SQL 事务，只有固定 Id 与原请求摘要读回匹配才能确认成功。
  var persisted = V8.MongoDb.GetFormData(request);
  if (mongoFound(persisted) && samePersistedMessage(persisted.Data, message))
    return {Code:1,Data:persisted.Data,Duplicate:!added || added.Code !== 1};
  return fail(added && added.Msg || '聊天消息持久化未确认，请使用相同 RequestId 重试。');
}

function updateContact(existingId, formData) {
  return V8.MongoDb.UptFormData({
    OsClient: V8.OsClient, DbName: DB_NAME, TableName: CONTACT_TABLE,
    Id: existingId, _FormData: formData
  });
}

function upsertContact(user, contact, message, updateTime) {
  var deterministicId = contactIdFor(user.Id, contact.Id);
  var exact = query(CONTACT_TABLE, [
    ['UserId', '=', user.Id], ['ContactUserId', '=', contact.Id]
  ], 1, 100, 'UpdateTime', 'DESC');
  if (!exact || exact.Code !== 1) return fail(exact && exact.Msg || '读取聊天联系人失败。');
  var rows = toArray(exact.Data);
  var current = rows.length > 0 ? rows[0] : null;
  var currentId = current ? text(current._id || current.Id, 100) : deterministicId;
  var unread = unreadCount(user.Id, contact.Id);
  if (!unread || unread.Code !== 1) return unread;
  var now = nowText('yyyy-MM-dd HH:mm:ss');
  var model = {
    UserId: user.Id,
    UserName: user.Name,
    UserAccount: user.Account,
    UserAvatar: user.Avatar,
    ContactUserId: contact.Id,
    ContactUserName: contact.Name,
    ContactUserAccount: contact.Account,
    ContactUserAvatar: contact.Avatar,
    LastMessage: message ? rawText(message.Content, 200000) : rawText(current && current.LastMessage, 200000),
    LastMessageType: message ? text(message.Type, 100) : text(current && current.LastMessageType, 100),
    OtherInfo: message ? rawText(message.OtherInfo, 20000) : rawText(current && current.OtherInfo, 20000),
    UnRead: unread.Data,
    UpdateTime: updateTime || !current ? now : current.UpdateTime
  };

  var saveResult;
  if (current) {
    saveResult = updateContact(currentId, model);
  } else {
    saveResult = V8.MongoDb.AddFormData({
      OsClient: V8.OsClient, DbName: DB_NAME, TableName: CONTACT_TABLE,
      Id: deterministicId, _FormData: model
    });
    if (!saveResult || saveResult.Code !== 1) {
      var raced = V8.MongoDb.GetFormData({
        OsClient: V8.OsClient, DbName: DB_NAME, TableName: CONTACT_TABLE, Id: deterministicId
      });
      saveResult = raced && raced.Code === 1 ? updateContact(deterministicId, model) : saveResult;
    }
  }
  if (!saveResult || saveResult.Code !== 1) return fail(saveResult && saveResult.Msg || '保存聊天联系人失败。');

  // 清理历史随机 _id 重复项；确定性主记录或当前复用记录永不删除。
  for (var index = 0; index < rows.length; index++) {
    var duplicateId = text(rows[index]._id || rows[index].Id, 100);
    if (duplicateId && duplicateId !== currentId) {
      V8.MongoDb.DelFormData({
        OsClient: V8.OsClient, DbName: DB_NAME, TableName: CONTACT_TABLE, Id: duplicateId
      });
    }
  }
  return { Code: 1 };
}

function contactDto(row, projection) {
  return {
    UserId: text(row.UserId, 100),
    UserName: displayName(row.UserName, row.UserAccount),
    UserAccount: text(row.UserAccount, 200),
    UserAvatar: text(row.UserAvatar, 1000),
    ContactUserId: text(row.ContactUserId, 100),
    ContactUserName: displayName(projection && projection.Name || row.ContactUserName,
      projection && projection.Account || row.ContactUserAccount),
    ContactUserAccount: text(projection && projection.Account || row.ContactUserAccount, 200),
    ContactUserAvatar: text(projection && projection.Avatar || row.ContactUserAvatar, 1000),
    ContactUserDeviceClientId: '',
    LastMessage: rawText(row.LastMessage, 200000),
    LastMessageType: text(row.LastMessageType, 100),
    OtherInfo: rawText(row.OtherInfo, 20000),
    UnRead: Number(row.UnRead || 0),
    UpdateTime: row.UpdateTime
  };
}

function listContacts(userId, pageIndex, pageSize) {
  var result = query(CONTACT_TABLE, [['UserId', '=', userId]], pageIndex, pageSize, 'UpdateTime', 'DESC');
  if (!result || result.Code !== 1) return fail(result && result.Msg || '读取聊天联系人失败。');
  var rows = toArray(result.Data);
  var ids = [];
  for (var index = 0; index < rows.length; index++) {
    var id = text(rows[index].ContactUserId, 100);
    if (id && id.toUpperCase() !== ASSISTANT.Id && ids.indexOf(id) < 0) ids.push(id);
  }
  var projections = {};
  if (ids.length > 0) {
    var usersResult = V8.FormEngine.GetTableData('sys_user', {
      Ids: ids,
      _SelectFields: ['Id', 'Name', 'Account', 'Avatar'],
      _PageIndex: 1,
      _PageSize: Math.min(ids.length, 100)
    });
    if (usersResult && usersResult.Code === 1) {
      var users = toArray(usersResult.Data);
      for (var userIndex = 0; userIndex < users.length; userIndex++) {
        projections[text(users[userIndex].Id, 100)] = users[userIndex];
      }
    }
  }
  projections[ASSISTANT.Id] = ASSISTANT;
  var data = [];
  for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    var peerId = text(rows[rowIndex].ContactUserId, 100);
    data.push(contactDto(rows[rowIndex], projections[peerId]));
  }
  return { Code: 1, Data: data, DataCount: Number(result.DataCount || data.length) };
}

function messageDto(row, fromProjection, toProjection) {
  return {
    MessageId: text(row.MessageId || row._id, 100),
    RequestId: text(row.RequestId, 200),
    FromUserId: text(row.FromUserId, 100),
    FromUserName: displayName(fromProjection && fromProjection.Name || row.FromUserName,
      fromProjection && fromProjection.Account || row.FromUserAccount),
    FromUserAccount: text(fromProjection && fromProjection.Account || row.FromUserAccount, 200),
    FromUserAvatar: text(fromProjection && fromProjection.Avatar || row.FromUserAvatar, 1000),
    ToUserId: text(row.ToUserId, 100),
    ToUserName: displayName(toProjection && toProjection.Name || row.ToUserName,
      toProjection && toProjection.Account || row.ToUserAccount),
    ToUserAccount: text(toProjection && toProjection.Account || row.ToUserAccount, 200),
    ToUserAvatar: text(toProjection && toProjection.Avatar || row.ToUserAvatar, 1000),
    Content: rawText(row.Content, 200000),
    OtherInfo: rawText(row.OtherInfo, 20000),
    CreateTime: row.CreateTime,
    Type: text(row.Type, 100),
    IsRead: row.IsRead === true
  };
}

function timestamp(value) {
  var parsed = Date.parse(String(value || ''));
  return isNaN(parsed) ? 0 : parsed;
}

function history(actor, peer, pageIndex, pageSize) {
  if (typeof V8.MongoDb.GetPartitionedTableData !== 'function') return fail('聊天历史分页需要升级平台 MongoDB 组件，请管理员更新后重试。');
  // 业务双方来自 DiyToken 和权威用户回查；存储游标绑定完整租户/过滤条件，不能跨对话复用。
  var request = { OsClient:V8.OsClient, DatabasePrefix:'diy_chat', TablePrefix:'chat', IndexFields:['FromUserId','ToUserId'], PageSize:pageSize, Cursor:String(param.Cursor||''),
    _WhereAny:[[['FromUserId','=',actor.Id],['ToUserId','=',peer.Id]],[['FromUserId','=',peer.Id],['ToUserId','=',actor.Id]]] };
  var result;
  // 旧客户端的页码保留有界兼容；新客户端固定游标读取，不反复下载全部已读正文。
  for (var page=0;page<(param.CursorMode===true||request.Cursor?1:pageIndex);page++) {
    result=V8.MongoDb.GetPartitionedTableData(request);
    if(!result||result.Code!==1||!result.Data)return result||fail('读取聊天记录失败。');
    if(!result.Data.HasMore)break;
    request.Cursor=String(result.Data.NextCursor||'');
  }
  var selected = toArray(result.Data.Rows).reverse();
  var messages = [];
  for (var index = 0; index < selected.length; index++) {
    var row = selected[index];
    messages.push(messageDto(
      row,
      text(row.FromUserId, 100) === actor.Id ? actor : peer,
      text(row.ToUserId, 100) === actor.Id ? actor : peer));
  }
  return {
    Code: 1,
    Data: messages,
    Rows:selected,
    DataCount:messages.length,
    HasMore:result.Data.HasMore===true,
    NextCursor:String(result.Data.NextCursor||'')
  };
}

function addWarning(warnings, result, fallback) {
  if (!result || result.Code !== 1) warnings.push(text(result && result.Msg || fallback, 500));
}

function complete(action, actorUserId, peerUserId, messageId, messageType, data, append, warnings) {
  var after = runHook('AfterChatRuntime', action, actorUserId, peerUserId, messageId, messageType);
  if (!after || after.Code !== 1) {
    append.HookWarning = text(after && after.Msg || '消息通知个性化 Hook 未返回结果。', 500);
  }
  if (warnings.length > 0) append.ProjectionWarnings = warnings;
  return { Code: 1, Data: data, DataAppend: append };
}

// 一次性宿主协议已由外层统一消费；这里只是受信的内部旧协议委托。

if (!V8.CurrentUser || !V8.CurrentUser.Id || !V8.OsClient) {
  return fail('登录身份已过期，请重新登录。', 1001);
}

var action = text(param.Action, 100);
var actor = actorProfile();
var peerUserId = text(param.PeerUserId || param.ToUserId || param.ContactUserId, 100);
var requestId = text(param.RequestId, 200);
var content = rawText(param.Content, 200000);
var messageType = text(param.Type || 'text', 100) || 'text';
var messageId = requestId ? messageIdFor(requestId) : '';
var allowedActions = [
  'PersistMessage', 'PersistSystemMessage', 'PersistAssistantMessage',
  'GetHistoryAndMarkRead', 'GetUnreadCount', 'TouchContact', 'ListContacts', 'DeleteContact'
];

if (!action) return fail('聊天动作不能为空。');
if (allowedActions.indexOf(action) < 0) return fail('不支持的聊天动作。');
if ((action === 'PersistMessage' || action === 'PersistSystemMessage' || action === 'PersistAssistantMessage')
  && (!requestId || !messageId || !content.trim())) {
  return fail('RequestId、接收用户和消息内容不能为空。');
}
if (String(param.Content === null || typeof param.Content === 'undefined' ? '' : param.Content).length > 200000) {
  return fail('聊天消息内容不能超过 200000 个字符。');
}
if ((action === 'PersistMessage' || action === 'PersistSystemMessage'
    || action === 'GetHistoryAndMarkRead' || action === 'TouchContact' || action === 'DeleteContact')
  && !peerUserId) {
  return fail('聊天对象不能为空。');
}
if (action === 'PersistSystemMessage' && !isAdmin()) {
  return fail('只有平台超级管理员可以发送系统消息。');
}

var before = runHook('BeforeChatRuntime', action, actor.Id, peerUserId, messageId, messageType);
if (!before || before.Code !== 1) return before || fail('消息通知个性化 Hook 未返回结果。');

if (action === 'PersistMessage' || action === 'PersistSystemMessage' || action === 'PersistAssistantMessage') {
  var fromUser = actor;
  var toUserId = peerUserId;
  if (action === 'PersistSystemMessage') {
    fromUser = ASSISTANT;
    messageType = '系统消息';
  } else if (action === 'PersistAssistantMessage') {
    fromUser = ASSISTANT;
    toUserId = actor.Id;
  }
  if (!toUserId) return fail('接收用户不能为空。');
  var toResult = getUser(toUserId);
  if (!toResult || toResult.Code !== 1) return toResult;
  var toUser = toResult.Data;
  var message = {
    MessageId: messageId,
    RequestId: requestId,
    FromUserId: fromUser.Id,
    FromUserName: fromUser.Name,
    FromUserAccount: fromUser.Account,
    FromUserAvatar: fromUser.Avatar,
    ToUserId: toUser.Id,
    ToUserName: toUser.Name,
    ToUserAccount: toUser.Account,
    ToUserAvatar: toUser.Avatar,
    Content: content,
    OtherInfo: rawText(param.OtherInfo, 20000),
    Type: messageType,
    IsRead: param.IsRead === true,
    IsRecall: false,
    IsFromDeleted: false,
    IsToDeleted: false,
    PayloadHash: ''
  };
  message.PayloadHash = messageFingerprint(message);
  var persisted = persistMessageRecord(message);
  if (!persisted || persisted.Code !== 1) return persisted;
  var stored = persisted.Data || message;
  var warnings = [];
  addWarning(warnings, upsertContact(fromUser, toUser, stored, true), '更新发送者联系人失败。');
  addWarning(warnings, upsertContact(toUser, fromUser, stored, true), '更新接收者联系人失败。');
  var actorContacts = listContacts(actor.Id, 1, 20);
  addWarning(warnings, actorContacts, '刷新当前用户联系人失败。');
  var targetContacts = listContacts(toUser.Id, 1, 20);
  addWarning(warnings, targetContacts, '刷新接收用户联系人失败。');
  var actorUnread = unreadCount(actor.Id, '');
  addWarning(warnings, actorUnread, '刷新当前用户未读数失败。');
  var targetUnread = unreadCount(toUser.Id, '');
  addWarning(warnings, targetUnread, '刷新接收用户未读数失败。');
  return complete(action, actor.Id, toUser.Id, messageId, messageType, {
    Message: messageDto(stored, fromUser, toUser),
    ActorUserId: actor.Id,
    TargetUserId: toUser.Id,
    ActorContacts: actorContacts && actorContacts.Code === 1 ? actorContacts.Data : [],
    TargetContacts: targetContacts && targetContacts.Code === 1 ? targetContacts.Data : [],
    ActorUnreadCount: actorUnread && actorUnread.Code === 1 ? actorUnread.Data : 0,
    TargetUnreadCount: targetUnread && targetUnread.Code === 1 ? targetUnread.Data : 0
  }, {
    StorageCommitted: true,
    DeliveryPending: true,
    Duplicate: persisted.Duplicate === true
  }, warnings);
}

if (action === 'GetHistoryAndMarkRead') {
  if (!peerUserId) return fail('聊天对象不能为空。');
  var peerResult = getUser(peerUserId);
  if (!peerResult || peerResult.Code !== 1) return peerResult;
  var peer = peerResult.Data;
  var pageIndex = boundedInt(param.PageIndex || param._PageIndex, 1, 1, 100);
  var pageSize = boundedInt(param.PageSize || param._PageSize, 20, 1, 100);
  var historyResult = history(actor, peer, pageIndex, pageSize);
  if (!historyResult || historyResult.Code !== 1) return historyResult;
  // 只标记本页已展示的收件消息；不能把未加载的跨月历史提前标记为已读。
  for (var readIndex=0;readIndex<historyResult.Rows.length;readIndex++) {
    var readRow=historyResult.Rows[readIndex];
    if(String(readRow.FromUserId)!==peer.Id||String(readRow.ToUserId)!==actor.Id||readRow.IsRead===true)continue;
    var markRead=V8.MongoDb.UptFormData({OsClient:V8.OsClient,DbName:readRow._PartitionDb,TableName:readRow._PartitionTable,Id:String(readRow._id),_FormData:{IsRead:true}});
    if(!markRead||markRead.Code!==1)return fail(markRead&&markRead.Msg||'更新聊天已读状态失败。');
  }
  var historyWarnings = [];
  addWarning(historyWarnings, upsertContact(actor, peer, null, false), '刷新聊天联系人失败。');
  var historyContacts = listContacts(actor.Id, 1, 20);
  addWarning(historyWarnings, historyContacts, '刷新聊天联系人列表失败。');
  var historyUnread = unreadCount(actor.Id, '');
  addWarning(historyWarnings, historyUnread, '刷新聊天未读数失败。');
  return complete(action, actor.Id, peer.Id, '', '', {
    Messages: historyResult.Data,
    DataCount: historyResult.DataCount,
    HasMore:historyResult.HasMore,
    NextCursor:historyResult.NextCursor,
    PeerUserId:peer.Id,
    ActorUserId: actor.Id,
    Contacts: historyContacts && historyContacts.Code === 1 ? historyContacts.Data : [],
    UnreadCount: historyUnread && historyUnread.Code === 1 ? historyUnread.Data : 0
  }, { StorageCommitted: true, DeliveryPending: true }, historyWarnings);
}

if (action === 'GetUnreadCount') {
  var unreadResult = unreadCount(actor.Id, '');
  if (!unreadResult || unreadResult.Code !== 1) return unreadResult;
  return complete(action, actor.Id, '', '', '', {
    ActorUserId: actor.Id,
    UnreadCount: unreadResult.Data
  }, { StorageCommitted: false, DeliveryPending: true }, []);
}

if (action === 'TouchContact') {
  if (!peerUserId) return fail('聊天对象不能为空。');
  var touchPeerResult = getUser(peerUserId);
  if (!touchPeerResult || touchPeerResult.Code !== 1) return touchPeerResult;
  var touchResult = upsertContact(actor, touchPeerResult.Data, null, false);
  if (!touchResult || touchResult.Code !== 1) return touchResult;
  var touchContacts = listContacts(actor.Id, 1, 20);
  var touchWarnings = [];
  addWarning(touchWarnings, touchContacts, '刷新聊天联系人列表失败。');
  return complete(action, actor.Id, peerUserId, '', '', {
    ActorUserId: actor.Id,
    Contacts: touchContacts && touchContacts.Code === 1 ? touchContacts.Data : []
  }, { StorageCommitted: true, DeliveryPending: true }, touchWarnings);
}

if (action === 'ListContacts') {
  var contactPageIndex = boundedInt(param.PageIndex || param._PageIndex, 1, 1, 100);
  var contactPageSize = boundedInt(param.PageSize || param._PageSize, 20, 1, 100);
  var contactsResult = listContacts(actor.Id, contactPageIndex, contactPageSize);
  if (!contactsResult || contactsResult.Code !== 1) return contactsResult;
  return complete(action, actor.Id, '', '', '', {
    ActorUserId: actor.Id,
    Contacts: contactsResult.Data,
    DataCount: contactsResult.DataCount
  }, { StorageCommitted: false, DeliveryPending: true }, []);
}

if (action === 'DeleteContact') {
  if (!peerUserId) return fail('聊天对象不能为空。');
  var deleteResult = V8.MongoDb.DelFormDataByWhere({
    OsClient: V8.OsClient, DbName: DB_NAME, TableName: CONTACT_TABLE,
    _Where: [['UserId', '=', actor.Id], ['ContactUserId', '=', peerUserId]]
  });
  if (!deleteResult || deleteResult.Code !== 1) return fail(deleteResult && deleteResult.Msg || '删除聊天联系人失败。');
  var remainingContacts = listContacts(actor.Id, 1, 20);
  var deleteWarnings = [];
  addWarning(deleteWarnings, remainingContacts, '刷新聊天联系人列表失败。');
  return complete(action, actor.Id, peerUserId, '', '', {
    ActorUserId: actor.Id,
    Contacts: remainingContacts && remainingContacts.Code === 1 ? remainingContacts.Data : []
  }, { StorageCommitted: true, DeliveryPending: true }, deleteWarnings);
}

return fail('不支持的聊天动作。');

}
