/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：系统设置
 * ApiEngineKey：platform-tenant-system-settings
 * 从可信吾码官方应用源安装、更新或重新安装“系统设置”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* PLATFORM_RUNTIME_DISPATCH_MARKER_V1 */
var tenantSettingsRoute = String(V8.Param.ApiAddress || '').replace(/\?.*$/, '');
var tenantSettingsAction = String(V8.Param.Action || '').trim();
if(!tenantSettingsAction && tenantSettingsRoute){
  var tenantSettingsSegments = tenantSettingsRoute.split('/');
  tenantSettingsAction = tenantSettingsSegments[tenantSettingsSegments.length - 1] || '';
}
if(['GetPublic','GetMapRuntime','Save','GetRevealChallenge','Reveal'].indexOf(tenantSettingsAction) >= 0){
  return V8.Method.RunPlatformApiRuntime({
    RuntimeKey:'TenantSystemSettings', Action:tenantSettingsAction, Param:V8.Param || {}
  });
}
V8.Param.Action = tenantSettingsAction;



/*
 * V8 ApiEngine | ApiEngineKey: platform-tenant-system-settings | Version: v1.0.0
 * 仅编排 List、Delete 和非 Secret Save。Secret/Sensitive Key 的写入、查看和二次认证
 * 继续使用可信 TenantSystemSettings Controller，明文绝不会进入此 V8 运行时。
 */

var param = V8.Param || {};
var action = String(param.Action || '').trim();
function text(value) {
  return String(value === null || typeof value === 'undefined' ? '' : value).trim();
}
function flag(value, fallback) {
  if (value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true') return true;
  if (value === false || value === 0 || value === '0' || String(value).toLowerCase() === 'false') return false;
  return fallback;
}
function fail(message) {
  return { Code: 0, Msg: message };
}
function normalizeText(value, maxLength) {
  var result = text(value).replace(/[\u0000-\u001F\u007F]/g, '');
  return result.length <= maxLength ? result : result.substring(0, maxLength);
}
function normalizeValueType(value) {
  var input = text(value).toLowerCase();
  if (input === 'bool') return 'Bool';
  if (input === 'int') return 'Int';
  if (input === 'decimal') return 'Decimal';
  if (input === 'json') return 'Json';
  return 'String';
}
function normalizeSort(value) {
  var parsed = Number(value);
  if (!isFinite(parsed)) return 0;
  return Math.max(-100000, Math.min(100000, Math.floor(parsed)));
}
function callHook(stage, data) {
  data = data || {};
  data.Stage = stage;
  data.SourceApiEngineKey = 'platform-tenant-system-settings';
  try {
    return V8.ApiEngine.Run('platform-system-settings-custom-hook', data);
  } catch (hookError) {
    return { Code: 0, Msg: '系统设置个性化 Hook 执行异常。' };
  }
}
function hookWarning(hookResult) {
  if (hookResult && hookResult.Code === 1) return '';
  return hookResult && hookResult.Msg
    ? String(hookResult.Msg)
    : '平台运行时个性化 Hook 未返回结果。';
}
function audit(operation, success, id, key) {
  try {
    V8.Method.AddSysLog({
      OsClient: String(V8.OsClient || ''),
      UserId: String(V8.CurrentUser && V8.CurrentUser.Id || ''),
      UserName: String(V8.CurrentUser && V8.CurrentUser.Name || ''),
      Category: 'Security',
      Action: operation,
      Source: 'TenantSystemSettingsApiEngine',
      TargetType: 'SystemSetting',
      TargetId: id || '',
      Success: !!success,
      OccurredAt: new Date(),
      Type: '安全审计',
      Title: operation,
      Content: JSON.stringify({ Success: !!success, SettingId: id || '', ConfigKey: key || '' }),
      Level: success ? 1 : 2
    });
  } catch (auditError) {
    // CRUD 主结果优先；审计存储故障不能把已完成的写入改成失败。
  }
}

if (action.toLowerCase() === 'list') {
  var listAuthorization = V8.Method.ValidateTenantSystemSettingsOperation({ Action: 'List' });
  if (!listAuthorization || listAuthorization.Code !== 1) {
    return listAuthorization || fail('租户系统设置访问校验失败。');
  }
  var beforeListHook = callHook('BeforeListTenantSystemSettings', {});
  if (!beforeListHook || beforeListHook.Code !== 1) {
    return beforeListHook || fail('平台运行时个性化 Hook 未返回结果。');
  }
  var securityProjection = V8.Method.GetTenantSystemSettingsSecurityProjection();
  if (!securityProjection || securityProjection.Code !== 1 || !securityProjection.Data) {
    return securityProjection || fail('租户系统设置安全投影读取失败。');
  }
  var migratedKeys = {};
  var migrated = securityProjection.Data.MigratedKeys || [];
  for (var migratedIndex = 0; migratedIndex < migrated.length; migratedIndex++) {
    migratedKeys[text(migrated[migratedIndex]).toLowerCase()] = true;
  }
  var secretState = securityProjection.Data.SecretStateById || {};
  var listResult = V8.FormEngine.GetTableData('mci_system_setting', {
    _Where: [['IsDeleted', '=', 0]],
    _SelectFields: [
      'Id', 'ConfigKey', 'ConfigValue', 'ValueType', 'Category', 'Description',
      'IsPublic', 'IsSecret', 'IsEnabled', 'Sort', 'ValueSource'
    ],
    _OrderBys: { Sort: 'asc', ConfigKey: 'asc' },
    _PageIndex: 1,
    _PageSize: 1000
  });
  if (!listResult || listResult.Code !== 1) return listResult || fail('租户系统设置读取失败。');
  var sourceRows = listResult.Data || [];
  var rows = [];
  for (var rowIndex = 0; rowIndex < sourceRows.length; rowIndex++) {
    var item = sourceRows[rowIndex] || {};
    var key = text(item.ConfigKey);
    if (!key || migratedKeys[key.toLowerCase()]) continue;
    var isSecret = flag(item.IsSecret, false);
    rows.push({
      Id: text(item.Id),
      ConfigKey: key,
      ConfigValue: isSecret ? '' : String(item.ConfigValue === null || typeof item.ConfigValue === 'undefined' ? '' : item.ConfigValue),
      ValueType: normalizeValueType(item.ValueType),
      Category: text(item.Category),
      Description: text(item.Description),
      IsPublic: flag(item.IsPublic, false),
      IsSecret: isSecret,
      IsEnabled: flag(item.IsEnabled, true),
      Sort: Number(item.Sort || 0),
      ValueSource: text(item.ValueSource),
      HasSecret: isSecret && flag(secretState[text(item.Id)], false)
    });
  }
  var afterListHook = callHook('AfterListTenantSystemSettings', { ResultCount: rows.length });
  if (!afterListHook || afterListHook.Code !== 1) {
    return afterListHook || fail('平台运行时个性化 Hook 未返回结果。');
  }
  return { Code: 1, Data: rows, DataCount: rows.length };
}

if (action.toLowerCase() === 'savenonsecret') {
  var saveAuthorization = V8.Method.ValidateTenantSystemSettingsOperation({
    Action: 'SaveNonSecret',
    ConfigKey: param.ConfigKey,
    IsSecret: param.IsSecret
  });
  if (!saveAuthorization || saveAuthorization.Code !== 1 || !saveAuthorization.Data) {
    return saveAuthorization || fail('租户系统设置保存校验失败。');
  }
  var configKey = text(saveAuthorization.Data.ConfigKey);
  var value = String(param.Value === null || typeof param.Value === 'undefined' ? '' : param.Value);
  if (value.length > 1024 * 1024) return fail('设置值不能超过 1MB。');
  var id = text(param.Id);
  if (id.length > 80) return fail('设置 Id 无效。');
  var requestedId = id;

  var findParam = id
    ? { Id: id, _SelectFields: ['Id', 'ConfigKey', 'IsSecret', 'IsDeleted'] }
    : {
        _Where: [['ConfigKey', '=', configKey], ['AND', 'IsDeleted', '=', 0]],
        _SelectFields: ['Id', 'ConfigKey', 'IsSecret', 'IsDeleted']
      };
  var existingResult = V8.FormEngine.GetFormData('mci_system_setting', findParam);
  if (!existingResult) return fail('租户系统设置查询失败。');
  if (existingResult.Code !== 1 && existingResult.Code !== 2) return existingResult;
  var existing = existingResult.Code === 1 ? existingResult.Data : null;
  if (requestedId && !existing) return fail('设置不存在，不能按失效 Id 新增。');
  if (existing && (flag(existing.IsSecret, false) || flag(existing.IsDeleted, false))) {
    return fail('已有 Secret 或已删除设置必须通过可信设置端点处理。');
  }
  if (existing) {
    if (text(existing.ConfigKey) !== configKey) {
      return fail('设置 Key 不能通过保存动作重命名，请新建设置后再删除旧项。');
    }
    var existingKeyAuthorization = V8.Method.ValidateTenantSystemSettingsOperation({
      Action: 'SaveNonSecret',
      ConfigKey: existing.ConfigKey,
      IsSecret: false
    });
    if (!existingKeyAuthorization || existingKeyAuthorization.Code !== 1) {
      return existingKeyAuthorization || fail('已有设置不允许修改。');
    }
    id = text(existing.Id);
  }
  if (!existing) id = V8.Method.NewGuid();

  var beforeSaveHook = callHook('BeforeSaveTenantSystemSetting', { SettingId: id, ConfigKey: configKey });
  if (!beforeSaveHook || beforeSaveHook.Code !== 1) {
    return beforeSaveHook || fail('平台运行时个性化 Hook 未返回结果。');
  }
  var form = {
    Id: id,
    ConfigKey: configKey,
    ConfigValue: value,
    SecretCipher: '',
    ValueType: normalizeValueType(param.ValueType),
    Category: normalizeText(param.Category, 100),
    Description: normalizeText(param.Description, 500),
    IsPublic: 0,
    IsSecret: 0,
    IsEnabled: flag(param.IsEnabled, true) ? 1 : 0,
    Sort: normalizeSort(param.Sort),
    ValueSource: 'Tenant'
  };
  var saveResult = existing
    ? V8.FormEngine.UptFormData('mci_system_setting', form)
    : V8.FormEngine.AddFormData('mci_system_setting', form);
  audit('SaveTenantSystemSetting', !!saveResult && saveResult.Code === 1, id, configKey);
  if (!saveResult || saveResult.Code !== 1) return saveResult || fail('租户系统设置保存失败。');
  var afterSaveHook = callHook('AfterSaveTenantSystemSetting', { SettingId: id, ConfigKey: configKey });
  var saveHookWarning = hookWarning(afterSaveHook);
  if (saveHookWarning) audit('AfterSaveTenantSystemSettingHookWarning', false, id, configKey);
  return {
    Code: 1,
    Data: { Id: id, ConfigKey: configKey, IsPublic: false, IsSecret: false, HasSecret: false },
    DataAppend: saveHookWarning ? { HookWarning: saveHookWarning } : null,
    Msg: saveHookWarning ? '系统设置已保存；个性化后置 Hook 未完成。' : '系统设置已保存。'
  };
}

if (action.toLowerCase() === 'delete') {
  var deleteId = text(param.Id);
  if (!deleteId || deleteId.length > 80) return fail('设置 Id 无效。');
  var deleteItemResult = V8.FormEngine.GetFormData('mci_system_setting', {
    Id: deleteId,
    _SelectFields: ['Id', 'ConfigKey', 'IsDeleted']
  });
  if (!deleteItemResult) return fail('租户系统设置查询失败。');
  if (deleteItemResult.Code !== 1 && deleteItemResult.Code !== 2) return deleteItemResult;
  if (deleteItemResult.Code === 2 || !deleteItemResult.Data
      || flag(deleteItemResult.Data.IsDeleted, false)) {
    return fail('设置不存在。');
  }
  var deleteKey = text(deleteItemResult.Data.ConfigKey);
  var deleteAuthorization = V8.Method.ValidateTenantSystemSettingsOperation({
    Action: 'Delete',
    ConfigKey: deleteKey
  });
  if (!deleteAuthorization || deleteAuthorization.Code !== 1) {
    return deleteAuthorization || fail('租户系统设置删除校验失败。');
  }
  var beforeDeleteHook = callHook('BeforeDeleteTenantSystemSetting', {
    SettingId: deleteId,
    ConfigKey: deleteKey
  });
  if (!beforeDeleteHook || beforeDeleteHook.Code !== 1) {
    return beforeDeleteHook || fail('平台运行时个性化 Hook 未返回结果。');
  }
  var deleteResult = V8.FormEngine.DelFormData('mci_system_setting', { Id: deleteId });
  audit('DeleteTenantSystemSetting', !!deleteResult && deleteResult.Code === 1, deleteId, deleteKey);
  if (!deleteResult || deleteResult.Code !== 1) return deleteResult || fail('租户系统设置删除失败。');
  var afterDeleteHook = callHook('AfterDeleteTenantSystemSetting', {
    SettingId: deleteId,
    ConfigKey: deleteKey
  });
  var deleteHookWarning = hookWarning(afterDeleteHook);
  if (deleteHookWarning) audit('AfterDeleteTenantSystemSettingHookWarning', false, deleteId, deleteKey);
  if (!deleteHookWarning) return deleteResult;
  return {
    Code: 1,
    Data: deleteResult.Data,
    DataCount: deleteResult.DataCount,
    DataAppend: { HookWarning: deleteHookWarning, OriginalDataAppend: deleteResult.DataAppend || null },
    Msg: '系统设置已删除；个性化后置 Hook 未完成。'
  };
}

return fail('不支持的租户系统设置操作。');
