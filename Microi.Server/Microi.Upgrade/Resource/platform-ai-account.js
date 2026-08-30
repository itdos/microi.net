/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：AI助手
 * ApiEngineKey：platform-ai-account
 * 从可信吾码官方应用源安装、更新或重新安装“AI助手”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* PLATFORM_RUNTIME_DISPATCH_MARKER_V1 */
var aiAccountRoute = String(V8.Param.ApiAddress || '').replace(/\?.*$/, '').toLowerCase();
var aiAccountActions = {
  '/api/ai/relaytokensummary':'GetRelayTokenSummary',
  '/api/ai/subgetplans':'GetPlans',
  '/api/ai/subgetinfo':'GetSubscription',
  '/api/ai/getuseraiapikey':'EnsureUserAiApiKey',
  '/api/ai/resetuseraiapikey':'ResetUserAiApiKey',
  '/api/ai/getuseraiusage':'GetRelayTokenUsage',
  '/api/ai/subcreateorder':'CreateOrder',
  '/api/ai/subcreatealipay':'CreateAlipay',
  '/api/ai/subgetorders':'GetOrders',
  '/api/ai/subconsumequota':'ConsumeQuota',
  '/api/ai/subgetorderstatus':'GetOrderStatus',
  '/api/ai/subgetapikeylist':'GetApiKeyList',
  '/api/ai/subgetapikeybindusers':'GetApiKeyBindUsers',
  '/api/ai/subgetapikeycapacity':'GetApiKeyCapacity',
  '/api/ai/generateprofileavatar':'GenerateProfileAvatar',
  '/api/ai/createminimaxvideo':'CreateMiniMaxVideo',
  '/api/ai/getminimaxvideotask':'GetMiniMaxVideoTask',
  '/api/ai/getminimaxvideofile':'GetMiniMaxVideoFile',
  '/api/ai/persistminimaxvideofile':'PersistMiniMaxVideoFile',
  '/api/ai/proxygetquotastatus':'GetSubscription',
  '/api/ai/subgetmodels':'GetModels'
};
if(aiAccountActions[aiAccountRoute]){
  V8.Param.Action = aiAccountActions[aiAccountRoute];
  if(V8.Param.PageIndex === undefined && V8.Param.pageIndex !== undefined) V8.Param.PageIndex = V8.Param.pageIndex;
  if(V8.Param.PageSize === undefined && V8.Param.pageSize !== undefined) V8.Param.PageSize = V8.Param.pageSize;
  if(V8.Param.OrderId === undefined && V8.Param.orderId !== undefined) V8.Param.OrderId = V8.Param.orderId;
  if(V8.Param.ApiKeyId === undefined && V8.Param.apiKeyId !== undefined) V8.Param.ApiKeyId = V8.Param.apiKeyId;
}



// Microi官方接口引擎：platform-ai-account
// Version: v1.1.0
// 普通套餐、订阅和订单由 V8 编排；密钥、额度原子、供应商协议、任务句柄和媒体落盘进入受信插件原子。
// PAYMENT_COMPLETE_MANAGED_V1：支付协议由 C# 验签，订单/订阅/分配在本接口同一事务内完成。
var param = V8.Param || {};
var action = text(param.Action);
var currentUser = V8.CurrentUser || {};

var supportedActions = {
  GetPlans: true,
  GetSubscription: true,
  EnsureUserAiApiKey: true,
  ResetUserAiApiKey: true,
  GetRelayTokenSummary: true,
  GetRelayTokenUsage: true,
  CreateOrder: true,
  CreateAlipay: true,
  GetOrders: true,
  ConsumeQuota: true,
  GetOrderStatus: true,
  GetApiKeyList: true,
  GetApiKeyBindUsers: true,
  GetApiKeyCapacity: true,
  GenerateProfileAvatar: true,
  CreateMiniMaxVideo: true,
  GetMiniMaxVideoTask: true,
  GetMiniMaxVideoFile: true,
  PersistMiniMaxVideoFile: true,
  GetModels: true,
  CompletePayment: true
};
var anonymousActions = { GetPlans: true, GetModels: true };

if (!supportedActions[action]) return { Code: 0, Msg: '不支持的 AI 平台动作。' };
if (action === 'CompletePayment') {
  var protocolContext = V8.Method.RequireManagedProtocolContext();
  if (!protocolContext || Number(protocolContext.Code) !== 1) {
    return protocolContext || { Code: 0, Msg: '支付回调可信协议上下文不存在。' };
  }
  var paymentHook = runTenantHook(action, param, V8.DbTrans);
  if (!paymentHook || Number(paymentHook.Code) !== 1) {
    return paymentHook || { Code: 0, Msg: 'AI 平台个性化 Hook 未返回结果。' };
  }
  return completePayment(param);
}
if (!anonymousActions[action] && !text(currentUser.Id)) {
  return { Code: 1001, Msg: '登录身份已过期。' };
}

if (!anonymousActions[action]) {
  var authorizationResult = V8.Method.ManageAiPlatform({
    Action: 'AuthorizeAction',
    TargetAction: action
  });
  if (!authorizationResult || Number(authorizationResult.Code) !== 1) {
    return authorizationResult || { Code: 0, Msg: 'AI 平台动作授权失败。' };
  }
  var hookResult = runTenantHook(action, param);
  if (!hookResult || Number(hookResult.Code) !== 1) {
    return hookResult || { Code: 0, Msg: 'AI 平台个性化 Hook 未返回结果。' };
  }
}

if (action === 'GetPlans') return getPlans();
if (action === 'GetSubscription') return getSubscription(currentUser.Id);
if (action === 'CreateOrder') return createOrder(currentUser, param);
if (action === 'CreateAlipay') return createAlipay(currentUser.Id, param);
if (action === 'GetOrders') return getOrders(currentUser.Id, param);
if (action === 'GetOrderStatus') return getOrderStatus(currentUser.Id, param);
return V8.Method.ManageAiPlatform(copyRequest(param, action));

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function numberInRange(value, fallback, min, max) {
  var number = parseInt(value, 10);
  if (!isFinite(number)) number = fallback;
  return Math.max(min, Math.min(max, number));
}

function copyRequest(source, actionName) {
  var result = { Action: actionName };
  var blocked = {
    Action: true, OsClient: true, _OsClient: true, CurrentUser: true,
    _CurrentUser: true, UserId: true, UserName: true, ApiKey: true,
    Endpoint: true, ServerInternalCall: true
  };
  for (var name in source) {
    if (Object.prototype.hasOwnProperty.call(source, name) && !blocked[name]) {
      result[name] = source[name];
    }
  }
  return result;
}

function runTenantHook(actionName, source, transaction) {
  var safe = {
    SourceApiEngineKey: 'platform-ai-account',
    Stage: 'Before',
    Action: actionName
  };
  var safeFields = [
    'PlanId', 'Months', 'OrderId', 'Count',
    'RequestId', 'Model', 'Duration', 'Resolution', 'PageIndex', 'PageSize',
    'EventId', 'Provider'
  ];
  for (var i = 0; i < safeFields.length; i++) {
    var fieldName = safeFields[i];
    if (source[fieldName] !== undefined && source[fieldName] !== null) {
      safe[fieldName] = source[fieldName];
    }
  }
  return transaction
    ? V8.ApiEngine.Run('platform-ai-custom-hook', safe, transaction)
    : V8.ApiEngine.Run('platform-ai-custom-hook', safe);
}

function getPlans() {
  // 匿名接口不能要求 mic_sub_plan 开启通用匿名表读取；固定公开投影由
  // ApiEngineKey 绑定的 Microi.AI 原子返回，避免 generic FormEngine 越权面。
  return V8.Method.ManageAiPlatform({ Action: 'GetPlans' });
}

function getSubscription(userId) {
  var subResult = V8.FormEngine.GetFormData('mic_sub_user', {
    _Where: [['UserId', '=', userId], ['IsDeleted', '=', 0]],
    _SelectFields: [
      'Id', 'PlanId', 'PlanCode', 'PlanName', 'QuotaPer5h', 'StartTime',
      'EndTime', 'Status', 'PlatformApiKey', 'LastOrderId'
    ]
  });
  if (!subResult || Number(subResult.Code) !== 1 || !subResult.Data) {
    return { Code: 1, Data: emptySubscription() };
  }

  var sub = subResult.Data;
  var endTime = new Date(text(sub.EndTime).replace(' ', 'T'));
  if (!isFinite(endTime.getTime())) {
    return { Code: 0, Msg: '订阅结束时间格式无效，请联系管理员修复数据。' };
  }
  if (endTime.getTime() < new Date().getTime()) {
    var expired = V8.FormEngine.UptFormData('mic_sub_user', { Id: sub.Id, Status: 0 });
    if (!expired || Number(expired.Code) !== 1) {
      return expired || { Code: 0, Msg: '更新过期订阅状态失败。' };
    }
    var expiredProjection = emptySubscription();
    expiredProjection.PlanName = text(sub.PlanName) + '（已过期）';
    expiredProjection.EndTime = sub.EndTime;
    return { Code: 1, Data: expiredProjection };
  }

  var quotaLimit = numberInRange(sub.QuotaPer5h, 600, 0, 100000000);
  var quotaResult = V8.Method.ManageAiPlatform({
    Action: 'GetQuotaWindow',
    QuotaLimit: quotaLimit
  });
  if (!quotaResult || Number(quotaResult.Code) !== 1) {
    return quotaResult || { Code: 0, Msg: '读取订阅额度窗口失败。' };
  }
  var quota = quotaResult.Data || {};
  return {
    Code: 1,
    Data: {
      HasSubscription: Number(sub.Status) === 1,
      PlanId: text(sub.PlanId),
      PlanCode: text(sub.PlanCode),
      PlanName: text(sub.PlanName),
      QuotaPer5h: quotaLimit,
      UsedInWindow: Number(quota.UsedCount || 0),
      RemainingInWindow: Number(quota.Remaining || 0),
      WindowResetTime: quota.WindowResetTime || null,
      EndTime: sub.EndTime || null,
      Status: Number(sub.Status || 0),
      PlatformApiKey: text(sub.PlatformApiKey),
      ApiEndpoint: 'https://api.microi.net/v1'
    }
  };
}

function emptySubscription() {
  return {
    HasSubscription: false,
    PlanName: '未订阅',
    QuotaPer5h: 0,
    UsedInWindow: 0,
    RemainingInWindow: 0,
    WindowResetTime: null,
    EndTime: null
  };
}

function createOrder(user, source) {
  var planId = text(source.PlanId);
  var months = numberInRange(source.Months, 1, 1, 120);
  if (!planId) return { Code: 0, Msg: '请选择套餐！' };
  if (parseInt(source.Months, 10) > 120) return { Code: 0, Msg: '订阅月数不能超过120个月！' };

  var planResult = V8.FormEngine.GetFormData('mic_sub_plan', {
    Id: planId,
    _Where: [['IsEnabled', '=', 1], ['IsDeleted', '=', 0]],
    _SelectFields: ['Id', 'Name', 'Code', 'Price']
  });
  if (!planResult || Number(planResult.Code) !== 1 || !planResult.Data) {
    return { Code: 0, Msg: '套餐不存在或已停用！' };
  }
  var plan = planResult.Data;
  var price = Number(plan.Price);
  if (!isFinite(price) || price < 0) return { Code: 0, Msg: '套餐价格配置无效！' };
  var amount = Math.round(price * months * 100) / 100;
  var orderId = V8.Method.NewGuid();
  var orderNo = 'SUB' + DateNow('yyyyMMddHHmmss')
    + V8.Method.NewGuid().replace(/-/g, '').substring(0, 8).toUpperCase();
  var addResult = V8.FormEngine.AddFormData('mic_sub_order', {
    Id: orderId,
    OrderNo: orderNo,
    PlanId: planId,
    PlanName: text(plan.Name),
    PlanCode: text(plan.Code),
    Amount: amount,
    PayMethod: 'alipay',
    PayStatus: 0,
    SubscriptionMonths: months,
    UserId: text(user.Id),
    UserName: text(user.Name || user.Account)
  });
  if (!addResult || Number(addResult.Code) !== 1) {
    return addResult || { Code: 0, Msg: '创建订单失败。' };
  }
  return {
    Code: 1,
    Data: { OrderId: orderId, OrderNo: orderNo, Amount: amount, PlanName: text(plan.Name) }
  };
}

function getOrders(userId, source) {
  return V8.FormEngine.GetTableData('mic_sub_order', {
    _Where: [['UserId', '=', userId], ['IsDeleted', '=', 0]],
    _SelectFields: [
      'Id', 'OrderNo', 'PlanId', 'PlanName', 'PlanCode', 'Amount', 'PayMethod',
      'PayStatus', 'SubscriptionMonths', 'UserId', 'UserName', 'PayTime', 'TradeNo',
      'StartTime', 'EndTime', 'CreateTime', 'UpdateTime'
    ],
    _PageIndex: numberInRange(source.PageIndex, 1, 1, 100000),
    _PageSize: numberInRange(source.PageSize, 20, 1, 100),
    _OrderBy: 'CreateTime',
    _OrderByType: 'DESC'
  });
}

function createAlipay(userId, source) {
  var orderId = text(source.OrderId);
  if (!orderId) return { Code: 0, Msg: '订单Id不能为空！' };
  var ownedOrder = V8.FormEngine.GetFormData('mic_sub_order', {
    Id: orderId,
    _Where: [['UserId', '=', userId], ['IsDeleted', '=', 0]],
    _SelectFields: ['Id', 'PayStatus']
  });
  if (!ownedOrder || Number(ownedOrder.Code) !== 1 || !ownedOrder.Data) {
    return { Code: 0, Msg: '订单不存在！' };
  }
  if (Number(ownedOrder.Data.PayStatus) === 1) {
    return { Code: 0, Msg: '订单已支付！' };
  }
  return V8.Method.ManageAiPlatform({ Action: 'CreateAlipay', OrderId: orderId });
}

function getOrderStatus(userId, source) {
  var orderId = text(source.OrderId);
  if (!orderId) return { Code: 0, Msg: '订单Id不能为空！' };
  var result = V8.FormEngine.GetFormData('mic_sub_order', {
    Id: orderId,
    _Where: [['UserId', '=', userId], ['IsDeleted', '=', 0]],
    _SelectFields: ['PayStatus', 'PayTime', 'TradeNo']
  });
  if (!result || Number(result.Code) !== 1 || !result.Data) {
    return { Code: 0, Msg: '订单不存在！' };
  }
  return {
    Code: 1,
    Data: {
      PayStatus: Number(result.Data.PayStatus || 0),
      PayTime: result.Data.PayTime || null,
      TradeNo: text(result.Data.TradeNo)
    }
  };
}

function moneyToCents(value) {
  var normalized = text(value);
  if (!/^\d{1,10}(\.\d{1,8})?$/.test(normalized)) return null;
  var amount = Number(normalized);
  if (!isFinite(amount) || amount < 0 || amount > 9999999999.99) return null;
  return Math.round(amount * 100);
}

function addMonths(value, months) {
  var date = value instanceof Date ? new Date(value.getTime()) : new Date(text(value).replace(' ', 'T'));
  if (!isFinite(date.getTime())) date = new Date();
  date.setMonth(date.getMonth() + months);
  return DateFormat(date, 'yyyy-MM-dd HH:mm:ss');
}

function completePayment(source) {
  var provider = text(source.Provider);
  var eventId = text(source.EventId);
  var tradeStatus = text(source.TradeStatus).toUpperCase();
  var orderNo = text(source.OrderNo);
  var tradeNo = text(source.TradeNo);
  var callbackAmountCents = moneyToCents(source.TotalAmount);
  if (provider.toLowerCase() !== 'alipay'
      || !/^alipay:[0-9a-f]{64}$/.test(eventId)
      || !orderNo || orderNo.length > 128
      || !tradeNo || tradeNo.length > 128
      || callbackAmountCents === null) {
    return { Code: 0, Msg: '支付回调可信元数据无效。' };
  }
  if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
    return { Code: 1, Data: { EventId: eventId, Ignored: true } };
  }

  var orderResult = V8.FormEngine.GetFormData('mic_sub_order', {
    _Where: [['OrderNo', '=', orderNo], ['IsDeleted', '=', 0]],
    _SelectFields: [
      'Id', 'OrderNo', 'PlanId', 'PlanCode', 'PlanName', 'Amount', 'PayMethod',
      'PayStatus', 'SubscriptionMonths', 'UserId', 'UserName', 'TradeNo'
    ]
  }, V8.DbTrans);
  if (!orderResult || Number(orderResult.Code) !== 1 || !orderResult.Data) {
    return { Code: 0, Msg: '支付订单不存在。' };
  }
  var order = orderResult.Data;
  var orderAmountCents = moneyToCents(order.Amount);
  if (orderAmountCents === null || orderAmountCents !== callbackAmountCents) {
    return { Code: 0, Msg: '支付金额与订单不一致。' };
  }
  var payMethod = text(order.PayMethod).toLowerCase();
  if (payMethod && payMethod !== 'alipay') {
    return { Code: 0, Msg: '支付方式与订单不一致。' };
  }

  if (Number(order.PayStatus) === 1) {
    var recordedTradeNo = text(order.TradeNo);
    if (recordedTradeNo && recordedTradeNo !== tradeNo) {
      return { Code: 0, Msg: '订单已由另一笔支付完成。' };
    }
    return {
      Code: 1,
      Data: { EventId: eventId, OrderId: text(order.Id), IdempotentReplay: true }
    };
  }

  var duplicateTrade = V8.FormEngine.GetFormData('mic_sub_order', {
    _Where: [
      ['TradeNo', '=', tradeNo], ['PayStatus', '=', 1],
      ['Id', '<>', text(order.Id)], ['IsDeleted', '=', 0]
    ],
    _SelectFields: ['Id']
  }, V8.DbTrans);
  if (duplicateTrade && Number(duplicateTrade.Code) === 1 && duplicateTrade.Data) {
    return { Code: 0, Msg: '支付交易号已用于其它订单。' };
  }

  var months = numberInRange(order.SubscriptionMonths, 1, 1, 120);
  if (parseInt(order.SubscriptionMonths, 10) > 120) {
    return { Code: 0, Msg: '订单订阅月数无效。' };
  }
  var userId = text(order.UserId);
  var planId = text(order.PlanId);
  if (!userId || !planId) return { Code: 0, Msg: '订单用户或套餐无效。' };

  var nowText = DateNow('yyyy-MM-dd HH:mm:ss');
  var orderEndTime = addMonths(nowText, months);
  var claim = V8.FormEngine.UptFormDataByWhere('mic_sub_order', {
    _Where: [
      ['Id', '=', text(order.Id)], ['PayStatus', '=', 0], ['IsDeleted', '=', 0]
    ],
    PayStatus: 1,
    PayTime: nowText,
    TradeNo: tradeNo,
    StartTime: nowText,
    EndTime: orderEndTime
  }, V8.DbTrans);
  if (!claim || Number(claim.Code) !== 1) {
    return claim || { Code: 0, Msg: '支付订单原子确认失败。' };
  }
  if (Number(claim.DataCount || 0) !== 1) {
    var concurrentOrder = V8.FormEngine.GetFormData('mic_sub_order', {
      Id: text(order.Id),
      _SelectFields: ['Id', 'PayStatus', 'TradeNo']
    }, V8.DbTrans);
    if (concurrentOrder && Number(concurrentOrder.Code) === 1
        && Number(concurrentOrder.Data && concurrentOrder.Data.PayStatus) === 1
        && (!text(concurrentOrder.Data.TradeNo) || text(concurrentOrder.Data.TradeNo) === tradeNo)) {
      return {
        Code: 1,
        Data: { EventId: eventId, OrderId: text(order.Id), IdempotentReplay: true }
      };
    }
    return { Code: 0, Msg: '支付订单状态已变化，请等待支付宝重试。' };
  }

  var planResult = V8.FormEngine.GetFormData('mic_sub_plan', {
    Id: planId,
    _Where: [['IsDeleted', '=', 0]],
    _SelectFields: ['Id', 'QuotaPer5h']
  }, V8.DbTrans);
  var quotaPer5h = 600;
  if (planResult && Number(planResult.Code) === 1 && planResult.Data) {
    quotaPer5h = numberInRange(planResult.Data.QuotaPer5h, 600, 0, 100000000);
  }

  var subscriptionResult = V8.FormEngine.GetFormData('mic_sub_user', {
    _Where: [['UserId', '=', userId], ['IsDeleted', '=', 0]],
    _SelectFields: ['Id', 'EndTime', 'PlatformApiKey']
  }, V8.DbTrans);
  var subscriptionWrite;
  if (subscriptionResult && Number(subscriptionResult.Code) === 1 && subscriptionResult.Data) {
    var currentEnd = new Date(text(subscriptionResult.Data.EndTime).replace(' ', 'T'));
    var renewalBase = isFinite(currentEnd.getTime()) && currentEnd.getTime() > new Date().getTime()
      ? currentEnd
      : new Date();
    subscriptionWrite = V8.FormEngine.UptFormData('mic_sub_user', {
      Id: subscriptionResult.Data.Id,
      PlanId: planId,
      PlanCode: text(order.PlanCode),
      PlanName: text(order.PlanName),
      QuotaPer5h: quotaPer5h,
      StartTime: nowText,
      EndTime: addMonths(renewalBase, months),
      Status: 1,
      LastOrderId: text(order.Id)
    }, V8.DbTrans);
  } else {
    subscriptionWrite = V8.FormEngine.AddFormData('mic_sub_user', {
      Id: V8.Method.NewGuid(),
      PlanId: planId,
      PlanCode: text(order.PlanCode),
      PlanName: text(order.PlanName),
      QuotaPer5h: quotaPer5h,
      PlatformApiKey: 'sk-microi-' + V8.Method.NewGuid().replace(/-/g, '').toLowerCase(),
      StartTime: nowText,
      EndTime: orderEndTime,
      Status: 1,
      LastOrderId: text(order.Id),
      UserId: userId,
      UserName: text(order.UserName)
    }, V8.DbTrans);
  }
  if (!subscriptionWrite || Number(subscriptionWrite.Code) !== 1) {
    return subscriptionWrite || { Code: 0, Msg: '写入用户订阅失败。' };
  }

  var allocation = assignDefaultProviderApiKey(
    userId,
    text(order.UserName),
    V8.DbTrans);
  if (!allocation || Number(allocation.Code) !== 1) {
    return allocation || { Code: 0, Msg: '分配供应商 API Key 失败。' };
  }
  return {
    Code: 1,
    Data: {
      EventId: eventId,
      OrderId: text(order.Id),
      IdempotentReplay: false,
      ApiKeyAssigned: !!(allocation.Data && allocation.Data.Assigned)
    }
  };
}

function assignDefaultProviderApiKey(userId, userName, transaction) {
  var providerResult = V8.FormEngine.GetTableData('mic_sub_provider', {
    _Where: [['IsEnabled', '=', 1], ['IsDeleted', '=', 0]],
    _SelectFields: ['Id'],
    _OrderBy: 'SortOrder',
    _OrderByType: 'ASC',
    _PageIndex: 1,
    _PageSize: 1
  }, transaction);
  var providers = providerResult && providerResult.Data;
  if (!providers || !providers.length) return { Code: 1, Data: { Assigned: false } };
  var providerId = text(providers[0].Id);

  var bindsResult = V8.FormEngine.GetTableData('mic_sub_apikey_binduser', {
    _Where: [['BoundUserId', '=', userId], ['Status', '=', 1], ['IsDeleted', '=', 0]],
    _SelectFields: ['ApiKeyId'],
    _PageIndex: 1,
    _PageSize: 100
  }, transaction);
  var binds = bindsResult && bindsResult.Data ? bindsResult.Data : [];
  for (var i = 0; i < binds.length; i++) {
    var boundKey = V8.FormEngine.GetFormData('mic_sub_apikey', {
      Id: text(binds[i].ApiKeyId),
      _SelectFields: ['Id', 'ProviderId']
    }, transaction);
    if (boundKey && Number(boundKey.Code) === 1 && boundKey.Data
        && text(boundKey.Data.ProviderId) === providerId) {
      return { Code: 1, Data: { Assigned: false, ApiKeyId: text(boundKey.Data.Id) } };
    }
  }

  var keysResult = V8.FormEngine.GetTableData('mic_sub_apikey', {
    _Where: [['ProviderId', '=', providerId], ['Status', '<>', 0], ['IsDeleted', '=', 0]],
    _SelectFields: ['Id', 'CurrentUsers', 'MaxUsers'],
    _OrderBy: 'CurrentUsers',
    _OrderByType: 'ASC',
    _PageIndex: 1,
    _PageSize: 100
  }, transaction);
  var keys = keysResult && keysResult.Data ? keysResult.Data : [];
  for (var keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    var candidate = keys[keyIndex];
    var currentUsers = numberInRange(candidate.CurrentUsers, 0, 0, 100000000);
    var maxUsers = numberInRange(candidate.MaxUsers, 15, 1, 100000000);
    if (currentUsers >= maxUsers) continue;
    var nextCount = currentUsers + 1;
    var claimKey = V8.FormEngine.UptFormDataByWhere('mic_sub_apikey', {
      _Where: [
        ['Id', '=', text(candidate.Id)], ['CurrentUsers', '=', currentUsers],
        ['Status', '<>', 0], ['IsDeleted', '=', 0]
      ],
      CurrentUsers: nextCount,
      Status: nextCount >= maxUsers ? 2 : 1
    }, transaction);
    if (!claimKey || Number(claimKey.Code) !== 1 || Number(claimKey.DataCount || 0) !== 1) {
      continue;
    }
    var addBind = V8.FormEngine.AddFormData('mic_sub_apikey_binduser', {
      Id: V8.Method.NewGuid(),
      ApiKeyId: text(candidate.Id),
      BoundUserId: userId,
      BoundUserName: userName,
      BindTime: DateNow('yyyy-MM-dd HH:mm:ss'),
      Status: 1,
      UserId: userId,
      UserName: userName
    }, transaction);
    if (!addBind || Number(addBind.Code) !== 1) {
      return addBind || { Code: 0, Msg: '创建供应商 API Key 绑定失败。' };
    }
    return { Code: 1, Data: { Assigned: true, ApiKeyId: text(candidate.Id) } };
  }
  // 保持旧回调语义：没有可分配的供应商 Key 不影响已付款订阅生效。
  return { Code: 1, Data: { Assigned: false } };
}
