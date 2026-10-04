/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：消息通知
 * ApiEngineKey：platform-chat-runtime
 * 从可信吾码官方应用源安装、更新或重新安装“消息通知”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: platform-chat-runtime | Version: v1.0.2 */

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

var MESSAGE_TABLE = 'chat_' + nowText('yyyy');
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
  var result = query(MESSAGE_TABLE, where, 1, 1, 'CreateTime', 'DESC');
  if (!result || result.Code !== 1) return { Code: result && result.Code || 0, Msg: result && result.Msg || '读取未读数失败。' };
  return { Code: 1, Data: Number(result.DataCount || 0) };
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

function persistMessageRecord(message) {
  var existingResult = V8.MongoDb.GetFormData({
    OsClient: V8.OsClient, DbName: DB_NAME, TableName: MESSAGE_TABLE, Id: message.MessageId
  });
  if (existingResult && existingResult.Code === 1 && existingResult.Data) {
    return samePersistedMessage(existingResult.Data, message)
      ? { Code: 1, Data: existingResult.Data, Duplicate: true }
      : fail('RequestId 已被其它聊天消息占用。');
  }

  var addResult = V8.MongoDb.AddFormData({
    OsClient: V8.OsClient,
    DbName: DB_NAME,
    TableName: MESSAGE_TABLE,
    Id: message.MessageId,
    _FormData: message
  });
  if (addResult && addResult.Code === 1) {
    return { Code: 1, Data: addResult.Data || message, Duplicate: false };
  }

  // 唯一 _id 并发碰撞时只复用完全一致的事实；其它错误保持失败关闭。
  var racedResult = V8.MongoDb.GetFormData({
    OsClient: V8.OsClient, DbName: DB_NAME, TableName: MESSAGE_TABLE, Id: message.MessageId
  });
  if (racedResult && racedResult.Code === 1 && samePersistedMessage(racedResult.Data, message)) {
    return { Code: 1, Data: racedResult.Data, Duplicate: true };
  }
  return fail(addResult && addResult.Msg || '聊天消息持久化失败。');
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
  var take = Math.min(1000, pageIndex * pageSize);
  var outgoing = query(MESSAGE_TABLE, [
    ['FromUserId', '=', actor.Id], ['ToUserId', '=', peer.Id]
  ], 1, take, 'CreateTime', 'DESC');
  if (!outgoing || outgoing.Code !== 1) return fail(outgoing && outgoing.Msg || '读取聊天记录失败。');
  var incoming = query(MESSAGE_TABLE, [
    ['FromUserId', '=', peer.Id], ['ToUserId', '=', actor.Id]
  ], 1, take, 'CreateTime', 'DESC');
  if (!incoming || incoming.Code !== 1) return fail(incoming && incoming.Msg || '读取聊天记录失败。');

  var combined = toArray(outgoing.Data).concat(toArray(incoming.Data));
  combined.sort(function (left, right) { return timestamp(right.CreateTime) - timestamp(left.CreateTime); });
  var start = (pageIndex - 1) * pageSize;
  var selected = combined.slice(start, start + pageSize);
  selected.sort(function (left, right) { return timestamp(left.CreateTime) - timestamp(right.CreateTime); });
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
    DataCount: Number(outgoing.DataCount || 0) + Number(incoming.DataCount || 0)
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
  var markRead = V8.MongoDb.UptFormDataByWhere({
    OsClient: V8.OsClient, DbName: DB_NAME, TableName: MESSAGE_TABLE,
    _Where: [['FromUserId', '=', peer.Id], ['ToUserId', '=', actor.Id], ['IsRead', '=', false]],
    _FormData: { IsRead: true }
  });
  if (!markRead || markRead.Code !== 1) return fail(markRead && markRead.Msg || '更新聊天已读状态失败。');
  var historyWarnings = [];
  addWarning(historyWarnings, upsertContact(actor, peer, null, false), '刷新聊天联系人失败。');
  var historyContacts = listContacts(actor.Id, 1, 20);
  addWarning(historyWarnings, historyContacts, '刷新聊天联系人列表失败。');
  var historyUnread = unreadCount(actor.Id, '');
  addWarning(historyWarnings, historyUnread, '刷新聊天未读数失败。');
  return complete(action, actor.Id, peer.Id, '', '', {
    Messages: historyResult.Data,
    DataCount: historyResult.DataCount,
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
