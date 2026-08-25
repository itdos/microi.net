/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-external-login-binding
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: platform-external-login-binding | Version: v1.0.0 */
/* Security metadata: StopHttp=1, AllowAnonymous=0, Lock=1（阻止并发外部主体双绑） */

var param = V8.Param || {};
var action = String(param.Action || '').trim();
var bindingTable = 'mci_user_external_identity';

function text(value, maxLength) {
  var result = String(value === null || typeof value === 'undefined' ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
  return result.length <= maxLength ? result : result.substring(0, maxLength);
}

function fail(message, code) {
  return { Code: code || 0, Msg: message };
}

function activeWhere() {
  return [['State', '=', 1], ['IsDeleted', '=', 0]];
}

function requireTrustedProtocol() {
  var result = V8.Method.RequireManagedProtocolContext();
  return result && result.Code === 1
    ? null
    : (result || fail('外部身份协议上下文无效。'));
}

function requireCurrentUser() {
  return V8.CurrentUser && V8.CurrentUser.Id
    ? null
    : fail('登录身份已过期，请重新登录。', 1001);
}

function runRuntimeHook(stage, details) {
  details = details || {};
  var hookParam = {
    Stage: stage,
    SourceApiEngineKey: 'platform-external-login-binding',
    Action: text(details.Action, 40),
    UserId: text(details.UserId, 100),
    Provider: text(details.Provider, 40),
    BindingId: text(details.BindingId, 100)
  };
  return V8.ApiEngine.Run('platform-runtime-custom-hook', hookParam, V8.DbTrans);
}

function normalizeProvider(value) {
  var provider = text(value, 40);
  return provider === 'Gitee' || provider === 'GitHub' || provider === 'WeChat' ? provider : '';
}

function getBindingBySubject(provider, subject, includeDisabled) {
  var where = [
    ['ProviderKey', '=', provider],
    ['ProviderSubject', '=', subject]
  ];
  if (!includeDisabled) where = where.concat(activeWhere());
  return V8.FormEngine.GetFormData(bindingTable, {
    _Where: where,
    _SelectFields: [
      'Id', 'BoundUserId', 'ProviderKey', 'ProviderSubject', 'AccountName',
      'DisplayName', 'Email', 'Avatar', 'State', 'IsDeleted', 'BindTime', 'LastLoginTime'
    ]
  });
}

function getBindingByUserProvider(userId, provider) {
  return V8.FormEngine.GetFormData(bindingTable, {
    _Where: [
      ['BoundUserId', '=', userId],
      ['ProviderKey', '=', provider]
    ],
    _OrderBy: 'UpdateTime',
    _OrderByType: 'DESC',
    _SelectFields: [
      'Id', 'BoundUserId', 'ProviderKey', 'ProviderSubject', 'AccountName',
      'DisplayName', 'Email', 'Avatar', 'State', 'IsDeleted', 'BindTime', 'LastLoginTime'
    ]
  });
}

if (action === 'List') {
  var listAuth = requireCurrentUser();
  if (listAuth) return listAuth;
  var currentUserId = text(V8.CurrentUser.Id, 100);
  var beforeListHook = runRuntimeHook('BeforeExternalIdentityList', {
    Action: 'List',
    UserId: currentUserId
  });
  if (!beforeListHook || beforeListHook.Code !== 1) {
    return beforeListHook || fail('平台运行时个性化 Hook 未返回结果。');
  }
  var listResult = V8.FormEngine.GetTableData(bindingTable, {
    _Where: [['BoundUserId', '=', currentUserId]].concat(activeWhere()),
    _PageIndex: 1,
    _PageSize: 100,
    _OrderBy: 'BindTime',
    _OrderByType: 'DESC',
    _SelectFields: [
      'Id', 'ProviderKey', 'AccountName', 'DisplayName', 'Avatar',
      'BindTime', 'LastLoginTime'
    ]
  });
  if (!listResult || listResult.Code !== 1) return listResult || fail('外部身份绑定读取失败。');

  var bindings = [];
  var rows = listResult.Data || [];
  for (var rowIndex = 0; rowIndex < rows.length && rowIndex < 100; rowIndex++) {
    var row = rows[rowIndex] || {};
    bindings.push({
      Id: text(row.Id, 100),
      Provider: text(row.ProviderKey, 40),
      AccountName: text(row.AccountName, 200),
      DisplayName: text(row.DisplayName, 200),
      Avatar: text(row.Avatar, 1000),
      BindTime: text(row.BindTime, 40),
      LastLoginTime: text(row.LastLoginTime, 40)
    });
  }

  var providers = [];
  var requestedProviders = param.Providers || [];
  for (var providerIndex = 0; providerIndex < requestedProviders.length && providerIndex < 20; providerIndex++) {
    var providerItem = requestedProviders[providerIndex] || {};
    var providerKey = normalizeProvider(providerItem.Key);
    if (!providerKey) continue;
    providers.push({
      Key: providerKey,
      Name: text(providerItem.Name, 100),
      Description: text(providerItem.Description, 500),
      Icon: text(providerItem.Icon, 500),
      Enabled: providerItem.Enabled === true,
      Configured: providerItem.Configured === true
    });
  }
  var afterListHook = runRuntimeHook('AfterExternalIdentityList', {
    Action: 'List',
    UserId: currentUserId
  });
  if (!afterListHook || afterListHook.Code !== 1) {
    return afterListHook || fail('平台运行时个性化 Hook 未返回结果。');
  }
  return { Code: 1, Data: { Providers: providers, Bindings: bindings } };
}

if (action === 'Revoke') {
  var revokeAuth = requireCurrentUser();
  if (revokeAuth) return revokeAuth;
  var revokeId = text(param.Id, 100);
  if (!revokeId) return fail('外部身份绑定 Id 不能为空。');
  var ownerId = text(V8.CurrentUser.Id, 100);
  var ownedResult = V8.FormEngine.GetFormData(bindingTable, {
    Id: revokeId,
    _Where: [['BoundUserId', '=', ownerId]].concat(activeWhere()),
    _SelectFields: ['Id', 'ProviderKey']
  });
  if (!ownedResult) return fail('外部身份绑定读取失败。');
  if (ownedResult.Code !== 1) {
    if (ownedResult.Code !== 2) return ownedResult;
    return fail('外部身份绑定不存在。');
  }
  if (!ownedResult.Data) return fail('外部身份绑定读取失败。');
  var ownedProvider = text(ownedResult.Data.ProviderKey, 40);
  var beforeRevokeHook = runRuntimeHook('BeforeExternalIdentityRevoke', {
    Action: 'Revoke',
    UserId: ownerId,
    Provider: ownedProvider,
    BindingId: revokeId
  });
  if (!beforeRevokeHook || beforeRevokeHook.Code !== 1) {
    return beforeRevokeHook || fail('平台运行时个性化 Hook 未返回结果。');
  }
  var revokeResult = V8.FormEngine.UptFormData(bindingTable, {
    Id: revokeId,
    State: 0,
    IsDeleted: 1
  });
  if (!revokeResult || revokeResult.Code !== 1) return revokeResult || fail('外部身份解绑失败。');
  var afterRevokeHook = runRuntimeHook('AfterExternalIdentityRevoke', {
    Action: 'Revoke',
    UserId: ownerId,
    Provider: ownedProvider,
    BindingId: revokeId
  });
  if (!afterRevokeHook || afterRevokeHook.Code !== 1) {
    return afterRevokeHook || fail('平台运行时个性化 Hook 未返回结果。');
  }
  return {
    Code: 1,
    Data: { Id: revokeId, Provider: ownedProvider },
    Msg: '外部身份已解绑。'
  };
}

if (action === 'Bind') {
  var bindTrust = requireTrustedProtocol();
  if (bindTrust) return bindTrust;
  var bindUserId = text(param.TrustedUserId, 100);
  var bindProvider = normalizeProvider(param.ProviderKey);
  var bindSubject = text(param.ProviderSubject, 500);
  if (!bindUserId || !bindProvider || !bindSubject) return fail('外部身份绑定参数无效。');

  var bindUserResult = V8.FormEngine.GetFormData('sys_user', {
    Id: bindUserId,
    _Where: activeWhere(),
    _SelectFields: ['Id']
  });
  if (!bindUserResult) return fail('当前用户读取失败。');
  if (bindUserResult.Code !== 1) {
    if (bindUserResult.Code !== 2) return bindUserResult;
    return fail('当前用户不存在或已停用。');
  }
  if (!bindUserResult.Data) return fail('当前用户读取失败。');

  var subjectResult = getBindingBySubject(bindProvider, bindSubject, true);
  if (!subjectResult) return fail('外部身份绑定读取失败。');
  if (subjectResult.Code !== 1 && subjectResult.Code !== 2) return subjectResult;
  if (subjectResult.Code === 1 && !subjectResult.Data) return fail('外部身份绑定读取失败。');
  var subjectBinding = subjectResult.Code === 1 ? subjectResult.Data : null;
  if (subjectBinding && text(subjectBinding.BoundUserId, 100).toLowerCase() !== bindUserId.toLowerCase()) {
    return fail('该外部身份已绑定其它吾码账号。');
  }
  var userProviderResult = subjectBinding ? null : getBindingByUserProvider(bindUserId, bindProvider);
  if (!subjectBinding && !userProviderResult) return fail('外部身份绑定读取失败。');
  if (!subjectBinding && userProviderResult.Code !== 1 && userProviderResult.Code !== 2) {
    return userProviderResult;
  }
  if (!subjectBinding && userProviderResult.Code === 1 && !userProviderResult.Data) {
    return fail('当前用户外部身份绑定读取失败。');
  }
  var binding = subjectBinding || (userProviderResult && userProviderResult.Code === 1 ? userProviderResult.Data : null);
  var now = DateNow('yyyy-MM-dd HH:mm:ss');
  var form = {
    Id: binding && binding.Id ? text(binding.Id, 100) : V8.Method.NewGuid(),
    BoundUserId: bindUserId,
    ProviderKey: bindProvider,
    ProviderSubject: bindSubject,
    AccountName: text(param.AccountName, 200),
    DisplayName: text(param.DisplayName, 200),
    Email: text(param.Email, 300),
    Avatar: text(param.Avatar, 1000),
    State: 1,
    IsDeleted: 0,
    BindTime: binding && binding.BindTime ? text(binding.BindTime, 40) : now,
    LastVerifiedTime: now
  };
  var beforeBindHook = runRuntimeHook('BeforeExternalIdentityBind', {
    Action: 'Bind',
    UserId: bindUserId,
    Provider: bindProvider,
    BindingId: form.Id
  });
  if (!beforeBindHook || beforeBindHook.Code !== 1) {
    return beforeBindHook || fail('平台运行时个性化 Hook 未返回结果。');
  }
  var saveResult = binding
    ? V8.FormEngine.UptFormData(bindingTable, form)
    : V8.FormEngine.AddFormData(bindingTable, form);
  if (!saveResult || saveResult.Code !== 1) return saveResult || fail('外部身份绑定保存失败。');
  var afterBindHook = runRuntimeHook('AfterExternalIdentityBind', {
    Action: 'Bind',
    UserId: bindUserId,
    Provider: bindProvider,
    BindingId: form.Id
  });
  if (!afterBindHook || afterBindHook.Code !== 1) {
    return afterBindHook || fail('平台运行时个性化 Hook 未返回结果。');
  }
  return { Code: 1, Data: { Id: form.Id, Provider: bindProvider }, Msg: '外部身份绑定成功。' };
}

if (action === 'Resolve') {
  var resolveTrust = requireTrustedProtocol();
  if (resolveTrust) return resolveTrust;
  var resolveProvider = normalizeProvider(param.ProviderKey);
  var resolveSubject = text(param.ProviderSubject, 500);
  if (!resolveProvider || !resolveSubject) return fail('外部身份解析参数无效。');
  var beforeResolveHook = runRuntimeHook('BeforeExternalIdentityResolve', {
    Action: 'Resolve',
    Provider: resolveProvider
  });
  if (!beforeResolveHook || beforeResolveHook.Code !== 1) {
    return beforeResolveHook || fail('平台运行时个性化 Hook 未返回结果。');
  }
  var resolveResult = getBindingBySubject(resolveProvider, resolveSubject, false);
  if (!resolveResult) return fail('外部身份绑定读取失败。');
  if (resolveResult.Code !== 1) {
    if (resolveResult.Code !== 2) return resolveResult;
    return { Code: 2, Msg: '外部身份尚未绑定。' };
  }
  if (!resolveResult.Data) return fail('外部身份绑定读取失败。');
  var resolvedBindingId = text(resolveResult.Data.Id, 100);
  var afterResolveHook = runRuntimeHook('AfterExternalIdentityResolve', {
    Action: 'Resolve',
    Provider: resolveProvider,
    BindingId: resolvedBindingId
  });
  if (!afterResolveHook || afterResolveHook.Code !== 1) {
    return afterResolveHook || fail('平台运行时个性化 Hook 未返回结果。');
  }
  return {
    Code: 1,
    Data: {
      Id: resolvedBindingId,
      BoundUserId: text(resolveResult.Data.BoundUserId, 100)
    }
  };
}

if (action === 'Touch') {
  var touchTrust = requireTrustedProtocol();
  if (touchTrust) return touchTrust;
  var touchId = text(param.Id, 100);
  var touchProvider = normalizeProvider(param.ProviderKey);
  var touchSubject = text(param.ProviderSubject, 500);
  if (!touchId || !touchProvider || !touchSubject) return fail('外部身份更新参数无效。');
  var touchResult = V8.FormEngine.GetFormData(bindingTable, {
    Id: touchId,
    _Where: [
      ['ProviderKey', '=', touchProvider],
      ['ProviderSubject', '=', touchSubject]
    ].concat(activeWhere()),
    _SelectFields: ['Id']
  });
  if (!touchResult) return fail('外部身份绑定读取失败。');
  if (touchResult.Code !== 1) {
    if (touchResult.Code !== 2) return touchResult;
    return fail('外部身份绑定不存在。');
  }
  if (!touchResult.Data) return fail('外部身份绑定读取失败。');
  var beforeTouchHook = runRuntimeHook('BeforeExternalIdentityTouch', {
    Action: 'Touch',
    Provider: touchProvider,
    BindingId: touchId
  });
  if (!beforeTouchHook || beforeTouchHook.Code !== 1) {
    return beforeTouchHook || fail('平台运行时个性化 Hook 未返回结果。');
  }
  var touchUpdateResult = V8.FormEngine.UptFormData(bindingTable, {
    Id: touchId,
    LastLoginTime: DateNow('yyyy-MM-dd HH:mm:ss'),
    AccountName: text(param.AccountName, 200),
    DisplayName: text(param.DisplayName, 200),
    Avatar: text(param.Avatar, 1000)
  });
  if (!touchUpdateResult || touchUpdateResult.Code !== 1) {
    return touchUpdateResult || fail('外部身份登录信息更新失败。');
  }
  var afterTouchHook = runRuntimeHook('AfterExternalIdentityTouch', {
    Action: 'Touch',
    Provider: touchProvider,
    BindingId: touchId
  });
  if (!afterTouchHook || afterTouchHook.Code !== 1) {
    return afterTouchHook || fail('平台运行时个性化 Hook 未返回结果。');
  }
  return touchUpdateResult;
}

if (action === 'RecordUserLogin') {
  var loginTrust = requireTrustedProtocol();
  if (loginTrust) return loginTrust;
  var loginUserId = text(param.TrustedUserId, 100);
  if (!loginUserId) return fail('登录用户参数无效。');
  var loginUserResult = V8.FormEngine.GetFormData('sys_user', {
    Id: loginUserId,
    _Where: activeWhere(),
    _SelectFields: ['Id']
  });
  if (!loginUserResult) return fail('登录用户读取失败。');
  if (loginUserResult.Code !== 1) {
    if (loginUserResult.Code !== 2) return loginUserResult;
    return fail('登录用户不存在或已停用。');
  }
  if (!loginUserResult.Data) return fail('登录用户读取失败。');
  var beforeLoginHook = runRuntimeHook('BeforeExternalIdentityRecordLogin', {
    Action: 'RecordUserLogin',
    UserId: loginUserId
  });
  if (!beforeLoginHook || beforeLoginHook.Code !== 1) {
    return beforeLoginHook || fail('平台运行时个性化 Hook 未返回结果。');
  }
  var loginUpdateResult = V8.FormEngine.UptFormData('sys_user', {
    Id: loginUserId,
    LastLoginIP: text(param.LastLoginIP, 100),
    LastLoginTime: DateNow('yyyy-MM-dd HH:mm:ss')
  });
  if (!loginUpdateResult || loginUpdateResult.Code !== 1) {
    return loginUpdateResult || fail('登录信息更新失败。');
  }
  var afterLoginHook = runRuntimeHook('AfterExternalIdentityRecordLogin', {
    Action: 'RecordUserLogin',
    UserId: loginUserId
  });
  if (!afterLoginHook || afterLoginHook.Code !== 1) {
    return afterLoginHook || fail('平台运行时个性化 Hook 未返回结果。');
  }
  return loginUpdateResult;
}

return fail('不支持的外部身份动作。');
