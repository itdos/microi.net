/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：应用商城
 * ApiEngineKey：get-microi-upgrade-resource
 * 从可信吾码官方应用源安装、更新或重新安装“应用商城”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: get-microi-upgrade-resource
 * Version: v1.3.1
 * Function:
 * - 匿名读取固定白名单中的吾码升级资源；超级管理员可通过 SHA 乐观锁原子发布升级资源，新版应用包写入 HDFS 并仅持久化可校验指针。
 */

var PARAM = V8.Param || {};
var resourceName = PARAM.Name || PARAM.ResourceName || PARAM.FileName || "";
resourceName = (resourceName || "").toString().trim();

function result(code, data, msg) {
  return { Code: code, Data: data || null, Msg: msg || "" };
}

function text(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return value.toString();
}

function sha256(value) {
  return text(V8.EncryptHelper.Sha256Hex(text(value))).toLowerCase();
}

function getEngineKey(name) {
  if (name === "import-package.js") return "import-microi-store-package";
  if (name === "ai-app-publish-store.js") return "ai_app_publish_store";
  if (name === "official-resource-api.js") return "get-microi-upgrade-resource";
  return "";
}

function getStoreAppId(name) {
  if (name === "app.microi.store.json") return "app.microi.store";
  if (name === "app.microi.form-engine.json") return "app.microi.form-engine";
  if (name === "app.microi.module-engine.json") return "app.microi.module-engine";
  if (name === "app.microi.saas-engine.json") return "app.microi.saas-engine";
  if (name === "app.microi.sso.json") return "app.microi.sso";
  if (name === "app.microi.sys_user.json") return "app.microi.sys_user";
  if (name === "app.microi.sys-config.json") return "app.microi.sys-config";
  if (name === "app.microi.message-notification.json") return "app.microi.message-notification";
  if (name === "app.microi.ai-engine.json") return "app.microi.ai-engine";
  return "";
}

var officialApplicationResourceNames = [
  "app.microi.form-engine.json",
  "app.microi.module-engine.json",
  "app.microi.saas-engine.json",
  "app.microi.sso.json",
  "app.microi.store.json",
  "app.microi.sys_user.json",
  "app.microi.sys-config.json",
  "app.microi.message-notification.json",
  "app.microi.ai-engine.json"
];

var standaloneControlPlaneResources = {
  "import-microi-store-package": "import-package.js",
  "ai_app_publish_store": "ai-app-publish-store.js",
  "get-microi-upgrade-resource": "official-resource-api.js"
};

function readRawResource(name) {
  var engineKey = getEngineKey(name);
  if (engineKey) {
    var apiResult = V8.FormEngine.GetFormData("sys_apiengine", {
      _Where: [["ApiEngineKey", "=", engineKey]],
      _SelectFields: ["Id", "Name", "ApiEngineKey", "ApiV8Code", "IsEnable", "UpdateTime"]
    });
    if (!apiResult || apiResult.Code !== 1 || !apiResult.Data) {
      return result(0, null, "未找到接口引擎 " + engineKey);
    }
    var apiCode = text(apiResult.Data.ApiV8Code);
    if (!apiCode) {
      return result(0, null, "接口引擎 " + engineKey + " 的 ApiV8Code 为空");
    }
    return result(1, {
      ResourceName: name,
      Content: apiCode,
      Sha256: sha256(apiCode),
      Source: "sys_apiengine.ApiV8Code",
      EngineKey: engineKey,
      RowId: apiResult.Data.Id,
      UpdateTime: apiResult.Data.UpdateTime || ""
    });
  }

  var appId = getStoreAppId(name);
  if (!appId) {
    return result(0, null, "不支持的升级资源：" + name);
  }
  var storeResult = V8.FormEngine.GetFormData("sys_microistore", {
    _Where: [["AppId", "=", appId]],
    _SelectFields: ["Id", "AppId", "AppName", "AppVersion", "AppType", "AppDetail", "IsPublic", "AppPakcet",
      "PackageId", "PackageStorageMode", "PackageHdfsPath", "PackageSha256", "PackageSize",
      "PackageContentType", "PackageFormatVersion", "PackageUploadedAt", "SelectTable",
      "SelectApiEngine", "UpdateTime"]
  });
  if (!storeResult || storeResult.Code !== 1 || !storeResult.Data) {
    return result(0, null, "读取应用商城数据失败：" + (storeResult && storeResult.Msg ? storeResult.Msg : ""));
  }
  var row = storeResult.Data;
  var packet = text(row.AppPakcet);
  if (!packet && row.PackageHdfsPath && row.PackageSha256 && Number(row.PackageSize || 0) > 0) {
    var stored = V8.Method.GetPrivateFileText({
      OsClient: V8.OsClient,
      FilePathName: row.PackageHdfsPath,
      Limit: text(row.PackageStorageMode).toLowerCase() === "hdfsprivate",
      MaxBytes: Math.min(Math.max(Number(row.PackageSize) + 1024, 1024 * 1024), 256 * 1024 * 1024)
    });
    if (!stored || stored.Code !== 1) {
      return result(0, null, "应用商城资源[" + text(row.AppName || row.AppId) + "]的 HDFS 包回读失败");
    }
    packet = text(stored.Data);
    var storedBytes = Number(System.Text.Encoding.UTF8.GetByteCount(packet));
    if (storedBytes !== Number(row.PackageSize) || sha256(packet) !== text(row.PackageSha256).toLowerCase()) {
      return result(0, null, "应用商城资源[" + text(row.AppName || row.AppId) + "]的 HDFS 包大小或哈希不一致");
    }
  }
  if (!packet) {
    return result(0, null, "应用商城资源[" + text(row.AppName || row.AppId) + "]的数据包为空");
  }
  return result(1, {
    ResourceName: name,
    Content: packet,
    Sha256: sha256(packet),
    Source: row.PackageHdfsPath ? "sys_microistore.PackageHdfsPath" : "sys_microistore.AppPakcet",
    StoreId: row.Id,
    AppId: row.AppId || "",
    AppName: row.AppName || "",
    AppVersion: row.AppVersion || "",
    SelectTable: row.SelectTable || "[]",
    SelectApiEngine: row.SelectApiEngine || "[]",
    RowId: row.Id,
    UpdateTime: row.UpdateTime || ""
  });
}

function parseVersionFromCode(content) {
  var match = text(content).match(/Version\s*:\s*(v?\d+\.\d+\.\d+)/i);
  return match ? (match[1].indexOf("v") === 0 ? match[1] : "v" + match[1]) : "";
}

function compareVersions(left, right) {
  var leftParts = text(left).replace(/^v/i, "").split(".");
  var rightParts = text(right).replace(/^v/i, "").split(".");
  for (var index = 0; index < 3; index++) {
    var leftValue = Number(leftParts[index] || 0);
    var rightValue = Number(rightParts[index] || 0);
    if (leftValue !== rightValue) return leftValue > rightValue ? 1 : -1;
  }
  return 0;
}

function asArray(value) {
  return value && typeof value.length === "number" ? value : [];
}

function exactPackageSelections(packageModel, packageName) {
  function uniqueRows(rows, fields, label) {
    var resultRows = [];
    var seen = {};
    rows = asArray(rows);
    for (var index = 0; index < rows.length; index++) {
      var source = rows[index] || {};
      var row = {};
      for (var fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
        var fieldName = fields[fieldIndex];
        row[fieldName] = text(source[fieldName]).trim();
        if (!row[fieldName]) {
          throw new Error("升级资源[" + packageName + "]" + label + "缺少 " + fieldName);
        }
      }
      var identity = text(row[fields[fields.length - 1]]).toLowerCase();
      if (seen[identity]) {
        throw new Error("升级资源[" + packageName + "]" + label + "存在重复选择标识：" + identity);
      }
      seen[identity] = true;
      resultRows.push(row);
    }
    return resultRows;
  }

  return {
    SelectApiEngine: uniqueRows(
      asArray(packageModel.SysApiEngines).map(function (source) {
        source = source || {};
        return {
          Id: source.Id,
          // 历史应用包使用 Name，新包也可直接提供 ApiName；商城选择元数据
          // 始终原子归一为稳定的 ApiName 合同。
          ApiName: source.ApiName || source.Name,
          ApiEngineKey: source.ApiEngineKey
        };
      }),
      ["Id", "ApiName", "ApiEngineKey"],
      "接口引擎"),
    SelectTable: uniqueRows(packageModel.DiyTables, ["Id", "Name"], "表单")
  };
}

function selectionJson(value) {
  return JSON.stringify(asArray(value));
}

function storedSelectionEquals(actual, expected) {
  var parsed = actual;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed || "[]");
    } catch (error) {
      return false;
    }
  }
  return selectionJson(parsed) === selectionJson(expected);
}

function stripLeadingBlockComments(value) {
  var body = text(value).trim();
  while (body.indexOf("/*") === 0) {
    var end = body.indexOf("*/");
    if (end < 0) break;
    body = body.substring(end + 2).trim();
  }
  return body;
}

function rowName(row, fieldName) {
  return text(row && row[fieldName]).toLowerCase();
}

function countRows(rows, fieldName, expected) {
  var count = 0;
  var normalized = text(expected).toLowerCase();
  rows = asArray(rows);
  for (var index = 0; index < rows.length; index++) {
    if (rowName(rows[index], fieldName) === normalized) count++;
  }
  return count;
}

function findEngine(packageModel, key) {
  var engines = asArray(packageModel.SysApiEngines);
  for (var index = 0; index < engines.length; index++) {
    if (text(engines[index].ApiEngineKey) === key) return engines[index];
  }
  return null;
}

function assertExactEngineKeys(packageModel, expectedKeys, packageName) {
  var engines = asArray(packageModel.SysApiEngines);
  if (engines.length !== expectedKeys.length) {
    throw new Error("升级资源[" + packageName + "]接口引擎数量不符合唯一所有权闭包");
  }
  for (var index = 0; index < expectedKeys.length; index++) {
    if (!findEngine(packageModel, expectedKeys[index])) {
      throw new Error("升级资源[" + packageName + "]缺少接口引擎 " + expectedKeys[index]);
    }
  }
}

function validateOfficialApiEnginePolicies(packageModel, packageName) {
  var engines = asArray(packageModel.SysApiEngines);
  var policies = packageModel.ResourcePolicies && packageModel.ResourcePolicies.ApiEngines;
  if (!policies || typeof policies !== "object") {
    throw new Error("升级资源[" + packageName + "]缺少 ResourcePolicies.ApiEngines");
  }
  var seen = {};
  for (var index = 0; index < engines.length; index++) {
    var engine = engines[index] || {};
    var key = text(engine.ApiEngineKey);
    var lowerKey = key.toLowerCase();
    if (!key || seen[lowerKey]) {
      throw new Error("升级资源[" + packageName + "]接口引擎 Key 为空或重复：" + key);
    }
    seen[lowerKey] = true;
    var policy = policies[key];
    var code = text(engine.ApiV8Code).trim();
    var apiAddress = text(engine.ApiAddress);
    // Official packages may deliberately retain a legacy custom route (for example
    // /api/FormEngine/copy-table) while the package-owned engine remains the single
    // implementation.  Require a safe site-relative route here; package-specific
    // gates below still pin the exact migrated engine keys and ownership policies.
    if (!policy || Number(engine.IsEnable) !== 1
        || apiAddress.indexOf("/") !== 0
        || apiAddress.indexOf("//") === 0
        || apiAddress.indexOf("\\") >= 0
        || apiAddress.indexOf("..") >= 0) {
      throw new Error("升级资源[" + packageName + "]接口引擎元数据或策略不完整：" + key);
    }
    if (text(policy.UpgradePolicy) === "CreateIfMissing") {
      if (Number(engine.StopHttp) !== 1
          || text(policy.Ownership) !== "Tenant"
          || code.indexOf("/* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1") !== 0
          || stripLeadingBlockComments(code) !== "return { Code : 1 };") {
        throw new Error("升级资源[" + packageName + "]租户 Hook 默认模板不安全：" + key);
      }
    } else if (text(policy.UpgradePolicy) !== "Managed"
        || (text(policy.Ownership) !== "Platform" && text(policy.Ownership) !== "Application")
        || code.indexOf("/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1") !== 0) {
      throw new Error("升级资源[" + packageName + "]Managed 接口缺少醒目恢复提示：" + key);
    }
  }
}

function validateTableClosure(packageModel, packageName, requiredNames, forbiddenNames) {
  var tables = asArray(packageModel.DiyTables);
  var fields = asArray(packageModel.DiyFields);
  var ddls = asArray(packageModel.DDLStatements);
  var columns = asArray(packageModel.PhysicalColumns);
  for (var index = 0; index < requiredNames.length; index++) {
    var name = requiredNames[index];
    if (countRows(tables, "Name", name) !== 1
        || countRows(ddls, "TableName", name) !== 1
        || countRows(fields, "TableName", name) < 1
        || countRows(columns, "TABLE_NAME", name) < 1) {
      throw new Error("升级资源[" + packageName + "]表资源闭包不完整：" + name);
    }
  }
  for (var forbiddenIndex = 0; forbiddenIndex < forbiddenNames.length; forbiddenIndex++) {
    var forbidden = forbiddenNames[forbiddenIndex];
    if (countRows(tables, "Name", forbidden)
        || countRows(ddls, "TableName", forbidden)
        || countRows(fields, "TableName", forbidden)
        || countRows(columns, "TABLE_NAME", forbidden)) {
      throw new Error("升级资源[" + packageName + "]重复声明其它应用拥有的表：" + forbidden);
    }
  }
}

function validateV8FirstPackage(name, packageModel) {
  validateOfficialApiEnginePolicies(packageModel, name);
  var info = packageModel.PackageInfo || {};
  if (Number(info.ApiEngineCount || 0) !== asArray(packageModel.SysApiEngines).length
      || Number(info.TableCount || 0) !== asArray(packageModel.DiyTables).length
      || Number(info.FieldCount || 0) !== asArray(packageModel.DiyFields).length
      || Number(info.DDLCount || 0) !== asArray(packageModel.DDLStatements).length
      || Number(info.PhysicalColumnCount || 0) !== asArray(packageModel.PhysicalColumns).length) {
    throw new Error("升级资源[" + name + "]PackageInfo 计数与实际资源不一致");
  }

  if (name === "app.microi.sys_user.json") {
    assertExactEngineKeys(packageModel, [
      "platform-user-update-preferences", "user-module-table-preference", "sys-user-security-action",
      "platform-user-update-profile", "platform-sys-user-admin", "platform-user-custom-hook"
    ], name);
    var sysUserAdmin = findEngine(packageModel, "platform-sys-user-admin");
    var sysUserAdminCode = text(sysUserAdmin && sysUserAdmin.ApiV8Code);
    var sysUserCapabilities = asArray(info.RequiredPlatformCapabilities);
    if (compareVersions(info.Version, "v6.3.2") < 0
        || !sysUserAdmin
        || compareVersions(sysUserAdmin.Version, "v1.0.2") < 0
        || sysUserAdminCode.indexOf("V8.Method.ManageSysUserAdmin") < 0
        || sysUserAdminCode.indexOf("platform-user-custom-hook") < 0
        || sysUserAdminCode.indexOf("authorization.DataAppend.ChangesPassword === true") < 0
        || sysUserCapabilities.indexOf("ApiEngine:platform-sys-user-admin@v1.0.2") < 0) {
      throw new Error("升级资源[" + name + "]缺少 v6.3.2 系统账号 Managed v1.0.2 改密安全契约");
    }
    if (countRows(packageModel.PhysicalColumns, "COLUMN_NAME", "AiApiKey") !== 1) {
      throw new Error("升级资源[" + name + "]缺少唯一 Sys_User.AiApiKey 物理列");
    }
    var aiKeyFields = asArray(packageModel.DiyFields);
    var validAiKeyField = false;
    for (var fieldIndex = 0; fieldIndex < aiKeyFields.length; fieldIndex++) {
      var field = aiKeyFields[fieldIndex] || {};
      if (rowName(field, "TableName") === "sys_user" && rowName(field, "Name") === "aiapikey"
          && Number(field.Visible) === 0 && Number(field.AppVisible) === 0 && Number(field.Readonly) === 1) {
        validAiKeyField = true;
      }
    }
    if (!validAiKeyField) throw new Error("升级资源[" + name + "]缺少隐藏只读 AiApiKey 字段元数据");
  }

  if (name === "app.microi.sys-config.json") {
    assertExactEngineKeys(packageModel, [
      "platform-tenant-system-settings", "platform-system-settings-custom-hook"
    ], name);
  }
  if (name === "app.microi.message-notification.json") {
    assertExactEngineKeys(packageModel, [
      "msg_event", "msg_internal_list", "msg_internal_mark_read",
      "platform-chat-system-message", "platform-chat-runtime",
      "platform-message-notification-custom-hook"
    ], name);
  }
  if (name === "app.microi.ai-engine.json") {
    assertExactEngineKeys(packageModel, [
      "mci_ai_data_assistant", "platform-ai-account", "platform-ai-runtime",
      "platform-ai-custom-hook"
    ], name);
    var aiAccount = findEngine(packageModel, "platform-ai-account");
    var aiRuntime = findEngine(packageModel, "platform-ai-runtime");
    var aiAccountCode = text(aiAccount && aiAccount.ApiV8Code);
    var aiRuntimeCode = text(aiRuntime && aiRuntime.ApiV8Code);
    if (compareVersions(info.Version, "v6.3.6") < 0
        || !aiAccount || compareVersions(aiAccount.Version, "v1.1.0") < 0
        || aiAccountCode.indexOf("PAYMENT_COMPLETE_MANAGED_V1") < 0
        || aiAccountCode.indexOf("RequireManagedProtocolContext") < 0
        || !aiRuntime || compareVersions(aiRuntime.Version, "v1.0.0") < 0
        || aiRuntimeCode.indexOf("AI_RUNTIME_MANAGED_NON_STREAM_V1") < 0
        || aiRuntimeCode.indexOf("V8.AI.Chat") < 0
        || aiRuntimeCode.indexOf("V8.AI.NL2SQL") < 0
        || aiRuntimeCode.indexOf("V8.AI.NL2V8") < 0
        || aiRuntimeCode.indexOf("platform-ai-custom-hook") < 0) {
      throw new Error("升级资源[" + name + "]缺少 v6.3.6 AI 支付或非流式 Managed 运行时契约");
    }
    var aiCapabilities = asArray(info.RequiredPlatformCapabilities);
    var requiredAiCapabilities = [
      "ApiEngine:platform-ai-account@v1.1.0",
      "ApiEngine:platform-ai-runtime@v1.0.0",
      "V8.Method.RequireManagedProtocolContext",
      "V8.AI.UpdateConversationTitle",
      "V8.AI.Chat",
      "V8.AI.RecognizeIntent",
      "V8.AI.NL2SQL",
      "V8.AI.NL2V8"
    ];
    for (var capabilityIndex = 0; capabilityIndex < requiredAiCapabilities.length; capabilityIndex++) {
      if (aiCapabilities.indexOf(requiredAiCapabilities[capabilityIndex]) < 0) {
        throw new Error("升级资源[" + name + "]缺少能力 " + requiredAiCapabilities[capabilityIndex]);
      }
    }
    validateTableClosure(packageModel, name, [
      "mic_sub_provider", "mic_sub_model", "mic_sub_plan", "mic_sub_order", "mic_sub_user",
      "mic_sub_usage", "mic_sub_alipay_config", "mic_sub_apikey", "mic_sub_apikey_binduser",
      "mci_ai_token_account", "mci_ai_token_log"
    ], ["mci_ai_app_version", "mci_ai_app_file", "sys_microistore", "sys_user"]);
    var promptPreviewCount = 0;
    var aiColumns = asArray(packageModel.PhysicalColumns);
    for (var columnIndex = 0; columnIndex < aiColumns.length; columnIndex++) {
      if (rowName(aiColumns[columnIndex], "TABLE_NAME") === "mci_ai_token_log"
          && rowName(aiColumns[columnIndex], "COLUMN_NAME") === "promptpreview") promptPreviewCount++;
    }
    if (promptPreviewCount !== 1) {
      throw new Error("升级资源[" + name + "]缺少唯一 mci_ai_token_log.PromptPreview");
    }
  }
  if (name === "app.microi.saas-engine.json") {
    var microiInit = findEngine(packageModel, "microi-init");
    var microiInitCode = text(microiInit && microiInit.ApiV8Code);
    if (compareVersions(info.Version, "v7.5.46") < 0
        || !microiInit
        || compareVersions(microiInit.Version, "v2.0.2") < 0
        || microiInitCode.indexOf("GetCurrentToken(rawToken, osClient)") < 0
        || microiInitCode.indexOf("RefreshLoginUser(") < 0
        || microiInitCode.indexOf("GetLegacyInitMenuTree(rawToken, osClient)") < 0
        || microiInitCode.indexOf("safeCurrentUserProjection") < 0
        || microiInitCode.indexOf("DataAppend: { OsClient: osClient }") < 0
        || microiInitCode.indexOf("GetFormData({") >= 0
        || microiInitCode.indexOf("GetTableDataTree") >= 0) {
      throw new Error("升级资源[" + name + "]缺少 v7.5.46 安全 microi-init v2.0.2 契约");
    }
    if (!findEngine(packageModel, "platform-create-tenant")
        || !findEngine(packageModel, "platform-external-login-binding")
        || !findEngine(packageModel, "platform-wechat-user-binding")
        || findEngine(packageModel, "platform-user-update-preferences")
        || findEngine(packageModel, "platform-sys-user-admin")
        || findEngine(packageModel, "platform-sys-menu")) {
      throw new Error("升级资源[" + name + "]平台接口所有权闭包不正确");
    }
  }
  if (name === "app.microi.store.json") {
    var officialResourceEngine = findEngine(packageModel, "get-microi-upgrade-resource");
    var officialResourceCode = text(officialResourceEngine && officialResourceEngine.ApiV8Code);
    var storeCapabilities = asArray(info.RequiredPlatformCapabilities);
    var deliveredCapabilities = asArray(info.Capabilities);
    var packageStorageEngine = findEngine(packageModel, "microi-store-package-storage");
    var packageStorageCode = text(packageStorageEngine && packageStorageEngine.ApiV8Code);
    if (compareVersions(info.Version, "v7.5.57") < 0
        || !officialResourceEngine
        || compareVersions(officialResourceEngine.Version, "v1.3.1") < 0
        || Number(officialResourceEngine.AllowAnonymous) !== 1
        || officialResourceCode.indexOf("V8.Method.AuthorizeOfficialResourcePublish") < 0
        || storeCapabilities.indexOf("V8.Method.AuthorizeOfficialResourcePublish") < 0
        || storeCapabilities.indexOf("ApiEngine:get-microi-upgrade-resource@v1.3.1") < 0
        || !packageStorageEngine
        || compareVersions(packageStorageEngine.Version, "v1.1.0") < 0
        || Number(packageStorageEngine.StopHttp) !== 1
        || packageStorageCode.indexOf("MARKETPLACE_PACKAGE_UPLOAD_BASE64_SINGLE_ATTEMPT_V1") < 0
        || deliveredCapabilities.indexOf("ApiEngine:microi-store-package-storage@v1.1.0") < 0
        || !findEngine(packageModel, "platform-marketplace-source")
        || !findEngine(packageModel, "platform-marketplace-source-hook")
        || findEngine(packageModel, "platform-user-update-preferences")
        || findEngine(packageModel, "platform-sys-user-admin")) {
      throw new Error("升级资源[" + name + "]缺少 v7.5.57 官方 live 接口投影、缓存自更新、物理表兼容、单次 HDFS 写入、发布授权或商城接口所有权闭包不正确");
    }
  }
}

function validatePublishResource(name, content) {
  if (!content || content.length < 20) {
    throw new Error("升级资源[" + name + "]内容为空或过短");
  }
  var engineKey = getEngineKey(name);
  if (engineKey) {
    if (content.indexOf("ApiEngineKey: " + engineKey) < 0 || !parseVersionFromCode(content)) {
      throw new Error("升级资源[" + name + "]接口标识或版本头不正确");
    }
    return { Version: parseVersionFromCode(content) };
  }

  var packageModel;
  try {
    packageModel = JSON.parse(content);
  } catch (ex) {
    throw new Error("升级资源[" + name + "]不是合法 JSON：" + ex.message);
  }
  var expectedNames = {
    "app.microi.store.json": "应用商城",
    "app.microi.form-engine.json": "表单引擎",
    "app.microi.module-engine.json": "模块引擎",
    "app.microi.saas-engine.json": "SaaS引擎",
    "app.microi.sso.json": "SSO 身份联邦",
    "app.microi.sys_user.json": "系统账号",
    "app.microi.sys-config.json": "系统设置",
    "app.microi.message-notification.json": "消息通知",
    "app.microi.ai-engine.json": "AI助手"
  };
  if (!packageModel.PackageInfo
      || text(packageModel.PackageInfo.Name) !== expectedNames[name]
      || !text(packageModel.PackageInfo.Version)) {
    throw new Error("升级资源[" + name + "]包名或版本不正确");
  }
  validateV8FirstPackage(name, packageModel);
  return {
    Version: text(packageModel.PackageInfo.Version),
    PackageModel: packageModel,
    ExactSelections: exactPackageSelections(packageModel, name)
  };
}

var liveApiEngineFields = [
  "ApiName", "ApiEngineKey", "ApiAddress", "IsEnable", "ApiV8Code", "ApiRole",
  "AllowAnonymous", "Files", "Category", "EnableLog", "StopHttp", "Timeout",
  "MaxStatements", "LimitMemory", "LimitRecursion", "Lock", "LockKey", "ResponseFile",
  "ResponseType", "TestParam", "ApiRemark", "V8Limit", "V8Unlimited", "Version",
  "ChangeHistory"
];

var liveApiEngineDefaults = {
  IsEnable: 1,
  ApiRole: "[]",
  AllowAnonymous: 0,
  Files: "[]",
  Category: "",
  EnableLog: 0,
  StopHttp: 0,
  Timeout: 600,
  MaxStatements: 100000000,
  LimitMemory: 2048,
  LimitRecursion: 5000,
  Lock: 0,
  LockKey: "",
  ResponseFile: 0,
  ResponseType: "",
  TestParam: "",
  ApiRemark: "",
  V8Limit: 0,
  V8Unlimited: 0,
  ChangeHistory: ""
};

var numericLiveApiEngineFields = {
  IsEnable: true,
  AllowAnonymous: true,
  EnableLog: true,
  StopHttp: true,
  Timeout: true,
  MaxStatements: true,
  LimitMemory: true,
  LimitRecursion: true,
  Lock: true,
  ResponseFile: true,
  V8Limit: true,
  V8Unlimited: true,
  IsDeleted: true
};

function comparableLiveApiEngineValue(name, value) {
  if (numericLiveApiEngineFields[name]) return Number(value || 0);
  if (value && typeof value === "object") return JSON.stringify(value);
  return text(value);
}

function buildLiveApiEngineModel(source, id) {
  var model = {
    Id: id,
    IsDeleted: 0
  };
  for (var fieldIndex = 0; fieldIndex < liveApiEngineFields.length; fieldIndex++) {
    var fieldName = liveApiEngineFields[fieldIndex];
    var fieldValue = source[fieldName];
    if (fieldName === "ApiName" && (fieldValue === undefined || fieldValue === null || text(fieldValue) === "")) {
      fieldValue = source.Name || source.ApiEngineKey;
    }
    if (fieldName === "Version" && (fieldValue === undefined || fieldValue === null || text(fieldValue) === "")) {
      fieldValue = parseVersionFromCode(source.ApiV8Code);
    }
    if ((fieldValue === undefined || fieldValue === null)
        && Object.prototype.hasOwnProperty.call(liveApiEngineDefaults, fieldName)) {
      fieldValue = liveApiEngineDefaults[fieldName];
    }
    if (fieldValue !== undefined && fieldValue !== null) model[fieldName] = fieldValue;
  }
  return model;
}

function liveManagedEngineEquals(current, expected) {
  if (!current || Number(current.IsDeleted || 0) !== 0) return false;
  if (text(current.Id) !== text(expected.Id)) return false;
  for (var fieldIndex = 0; fieldIndex < liveApiEngineFields.length; fieldIndex++) {
    var fieldName = liveApiEngineFields[fieldIndex];
    if (expected[fieldName] === undefined || expected[fieldName] === null) continue;
    if (comparableLiveApiEngineValue(fieldName, current[fieldName])
        !== comparableLiveApiEngineValue(fieldName, expected[fieldName])) {
      return false;
    }
  }
  return true;
}

function readLiveApiEngineRows(apiEngineKey, forUpdate) {
  // sys_apiengine 属于当前 V8 租户数据库，本表没有 OsClient 物理列；租户隔离
  // 由受权 iTdos 执行上下文选择数据库完成，不能虚构不存在的过滤字段。
  return V8.Db.FromSql(
    "SELECT * FROM sys_apiengine WHERE LOWER(ApiEngineKey)=LOWER(@p0)"
    + (forUpdate ? " FOR UPDATE" : "")
  ).AddInParameter("@p0", apiEngineKey)
    .ToArray() || [];
}

function readLiveApiEngineById(id) {
  if (!id) return null;
  return V8.Db.FromSql(
    "SELECT * FROM sys_apiengine WHERE Id=@p0"
  ).AddInParameter("@p0", id)
    .First();
}

function removeLiveApiEngineCacheValue(value) {
  if (value === undefined || value === null || text(value) === "") return;
  V8.Cache.Remove(
    "Microi:" + V8.OsClient + ":FormData:sys_apiengine:" + text(value).toLowerCase()
  );
}

function invalidateLiveApiEngineCache(previous, latest) {
  previous = previous || {};
  latest = latest || {};
  removeLiveApiEngineCacheValue(previous.Id);
  removeLiveApiEngineCacheValue(previous.ApiEngineKey);
  removeLiveApiEngineCacheValue(previous.ApiAddress);
  removeLiveApiEngineCacheValue(latest.Id);
  removeLiveApiEngineCacheValue(latest.ApiEngineKey);
  removeLiveApiEngineCacheValue(latest.ApiAddress);
}

function parseReconcileItems() {
  var items = PARAM.Resources;
  if (typeof items === "string") items = JSON.parse(items);
  if (!items || typeof items.length !== "number") {
    throw new Error("官方接口投影缺少 Resources 快照列表");
  }
  var byName = {};
  for (var itemIndex = 0; itemIndex < items.length; itemIndex++) {
    var item = items[itemIndex] || {};
    var name = text(item.Name || item.ResourceName).trim();
    var expectedSha = text(item.ExpectedSha256 || item.ExpectedRemoteSha256).toLowerCase();
    if (officialApplicationResourceNames.indexOf(name) < 0) {
      throw new Error("官方接口投影包含非固定应用资源：" + name);
    }
    if (!/^[a-f0-9]{64}$/.test(expectedSha)) {
      throw new Error("官方接口投影缺少有效资源 SHA-256：" + name);
    }
    if (byName[name]) throw new Error("官方接口投影资源名称重复：" + name);
    byName[name] = { Name: name, ExpectedSha256: expectedSha };
  }
  if (items.length !== officialApplicationResourceNames.length) {
    throw new Error("官方接口投影必须包含全部 " + officialApplicationResourceNames.length + " 个应用资源");
  }
  var normalized = [];
  for (var nameIndex = 0; nameIndex < officialApplicationResourceNames.length; nameIndex++) {
    var requiredName = officialApplicationResourceNames[nameIndex];
    if (!byName[requiredName]) throw new Error("官方接口投影缺少应用资源：" + requiredName);
    normalized.push(byName[requiredName]);
  }
  return normalized;
}

function preparePublishedApiEngineProjection() {
  var items = parseReconcileItems();
  lockPublishRows();
  var projections = [];
  var seenKeys = {};
  var packageHashes = {};
  for (var itemIndex = 0; itemIndex < items.length; itemIndex++) {
    var item = items[itemIndex];
    var current = readRawResource(item.Name);
    if (!current || current.Code !== 1 || !current.Data) {
      throw new Error(current && current.Msg ? current.Msg : "读取官方应用资源失败：" + item.Name);
    }
    var actualSha = text(current.Data.Sha256).toLowerCase();
    if (actualSha !== item.ExpectedSha256) {
      throw new Error(
        "官方应用资源[" + item.Name + "]在回读后发生变化，拒绝投影。Expected="
        + item.ExpectedSha256 + "，Actual=" + actualSha
      );
    }
    packageHashes[item.Name] = actualSha;
    var validated = validatePublishResource(item.Name, text(current.Data.Content));
    var packageModel = validated.PackageModel || {};
    var policies = packageModel.ResourcePolicies && packageModel.ResourcePolicies.ApiEngines;
    var engines = asArray(packageModel.SysApiEngines);
    for (var engineIndex = 0; engineIndex < engines.length; engineIndex++) {
      var engine = engines[engineIndex] || {};
      var key = text(engine.ApiEngineKey).trim();
      var lowerKey = key.toLowerCase();
      if (!key || seenKeys[lowerKey]) {
        throw new Error("官方应用资源存在跨包重复或空接口 Key：" + key);
      }
      seenKeys[lowerKey] = item.Name;
      var policy = policies && policies[key];
      if (!policy || (text(policy.UpgradePolicy) !== "Managed"
          && text(policy.UpgradePolicy) !== "CreateIfMissing")) {
        throw new Error("官方接口资源策略不完整：" + key);
      }
      projections.push({
        PackageName: item.Name,
        Engine: engine,
        Policy: text(policy.UpgradePolicy)
      });
    }
  }

  // 三个发布控制面接口同时拥有独立资源副本。投影前必须确认商城包内嵌源码
  // 与已发布 live 独立资源完全一致，避免包内旧副本覆盖刚发布的新控制面。
  for (var projectionIndex = 0; projectionIndex < projections.length; projectionIndex++) {
    var projection = projections[projectionIndex];
    var projectionKey = text(projection.Engine.ApiEngineKey);
    var standaloneName = standaloneControlPlaneResources[projectionKey];
    if (!standaloneName) continue;
    var standalone = readRawResource(standaloneName);
    if (!standalone || standalone.Code !== 1 || !standalone.Data
        || text(standalone.Data.Sha256).toLowerCase() !== sha256(projection.Engine.ApiV8Code)) {
      throw new Error("应用商城包内嵌控制面与独立资源不一致：" + projectionKey);
    }
  }
  return { Items: items, Projections: projections, PackageHashes: packageHashes };
}

function reconcilePublishedApiEngines() {
  var prepared = preparePublishedApiEngineProjection();
  var plans = [];
  var stats = {
    PackageCount: prepared.Items.length,
    ManagedCount: 0,
    CreateIfMissingCount: 0,
    ManagedCreated: 0,
    ManagedUpdated: 0,
    ManagedUnchanged: 0,
    TenantHookCreated: 0,
    TenantHookPreserved: 0
  };

  // 所有冲突在第一次写入前完成预检；接口最终返回 Code!=1 时整笔事务回滚。
  for (var projectionIndex = 0; projectionIndex < prepared.Projections.length; projectionIndex++) {
    var projection = prepared.Projections[projectionIndex];
    var engine = projection.Engine;
    var key = text(engine.ApiEngineKey);
    var rows = readLiveApiEngineRows(key, true);
    if (rows.length > 1) throw new Error("官方源存在重复接口 Key，拒绝自动合并：" + key);
    var existing = rows.length === 1 ? rows[0] : null;
    if (engine.Id && (!existing || (projection.Policy === "Managed"
        && text(existing.Id) !== text(engine.Id)))) {
      var idOwner = readLiveApiEngineById(engine.Id);
      if (idOwner && text(idOwner.ApiEngineKey).toLowerCase() !== key.toLowerCase()) {
        throw new Error(
          "官方接口稳定 Id 已被其它 Key 占用：" + engine.Id + " -> " + text(idOwner.ApiEngineKey)
        );
      }
    }
    plans.push({ Projection: projection, Existing: existing });
    if (projection.Policy === "Managed") stats.ManagedCount++;
    else stats.CreateIfMissingCount++;
  }

  for (var planIndex = 0; planIndex < plans.length; planIndex++) {
    var plan = plans[planIndex];
    var source = plan.Projection.Engine;
    var sourceKey = text(source.ApiEngineKey);
    if (plan.Projection.Policy === "CreateIfMissing" && plan.Existing) {
      stats.TenantHookPreserved++;
      continue;
    }

    var idAligned = false;
    if (plan.Projection.Policy === "Managed" && plan.Existing
        && text(plan.Existing.Id) !== text(source.Id)) {
      var previousId = text(plan.Existing.Id);
      var aligned = V8.Db.FromSql(
        "UPDATE sys_apiengine SET Id=@p0 WHERE Id=@p1 "
        + "AND LOWER(ApiEngineKey)=LOWER(@p2)"
      ).AddInParameter("@p0", source.Id)
        .AddInParameter("@p1", previousId)
        .AddInParameter("@p2", sourceKey)
        .ExecuteNonQuery();
      if (Number(aligned) !== 1) {
        throw new Error("官方 Managed 接口稳定 Id 对齐失败：" + sourceKey);
      }
      invalidateLiveApiEngineCache(plan.Existing, {
        Id: source.Id,
        ApiEngineKey: sourceKey,
        ApiAddress: source.ApiAddress
      });
      plan.Existing.Id = source.Id;
      idAligned = true;
    }

    var targetId = plan.Projection.Policy === "Managed"
      ? text(source.Id)
      : (plan.Existing ? text(plan.Existing.Id) : text(source.Id));
    if (!targetId) throw new Error("官方接口缺少稳定 Id：" + sourceKey);
    var model = buildLiveApiEngineModel(source, targetId);
    if (plan.Projection.Policy === "Managed" && plan.Existing && !idAligned
        && liveManagedEngineEquals(plan.Existing, model)) {
      stats.ManagedUnchanged++;
      continue;
    }

    var saveResult = plan.Existing
      ? V8.FormEngine.UptFormData("sys_apiengine", model)
      : V8.FormEngine.AddFormData("sys_apiengine", model);
    if (!saveResult || saveResult.Code !== 1) {
      throw new Error(
        "官方接口投影写入失败[" + sourceKey + "]："
        + text(saveResult && saveResult.Msg ? saveResult.Msg : "无错误消息")
      );
    }
    invalidateLiveApiEngineCache(plan.Existing, model);
    if (plan.Projection.Policy === "Managed") {
      if (plan.Existing) stats.ManagedUpdated++;
      else stats.ManagedCreated++;
    } else {
      stats.TenantHookCreated++;
    }
  }

  var projectionRows = [];
  for (var verifyIndex = 0; verifyIndex < prepared.Projections.length; verifyIndex++) {
    var expectedProjection = prepared.Projections[verifyIndex];
    var expectedEngine = expectedProjection.Engine;
    var expectedKey = text(expectedEngine.ApiEngineKey);
    var verifiedRows = readLiveApiEngineRows(expectedKey);
    if (verifiedRows.length !== 1) {
      throw new Error("官方接口投影回读数量不正确：" + expectedKey);
    }
    var verified = verifiedRows[0];
    if (expectedProjection.Policy === "Managed"
        && !liveManagedEngineEquals(verified, buildLiveApiEngineModel(expectedEngine, expectedEngine.Id))) {
      throw new Error("官方 Managed 接口投影后回读不一致：" + expectedKey);
    }
    projectionRows.push(
      expectedKey + "|" + expectedProjection.Policy + "|"
      + (expectedProjection.Policy === "Managed"
        ? sha256(expectedEngine.ApiV8Code) + "|" + text(expectedEngine.Version)
          + "|" + text(expectedEngine.ApiAddress) + "|" + text(expectedEngine.Id)
        : "present")
    );
  }
  projectionRows.sort();
  stats.VerifiedApiEngineCount = projectionRows.length;
  stats.ProjectionSha256 = sha256(projectionRows.join("\n"));
  stats.ApiEngineKeys = projectionRows.map(function (row) { return row.split("|")[0]; });
  stats.PackageHashes = prepared.PackageHashes;
  return stats;
}

function applyPublishResource(item, current) {
  var name = text(item.Name || item.ResourceName).trim();
  var content = text(item.Content);
  var validated = validatePublishResource(name, content);
  var engineKey = getEngineKey(name);
  var saveResult;
  if (engineKey) {
    saveResult = V8.FormEngine.UptFormData("sys_apiengine", {
      Id: current.Data.RowId,
      ApiV8Code: content,
      Version: validated.Version
    });
  } else {
    var exactSelections = validated.ExactSelections;
    var storageResult = V8.ApiEngine.Run("microi-store-package-storage", {
      Action: "Store",
      StoreId: current.Data.RowId,
      AppVersion: validated.Version,
      Package: content
    });
    if (!storageResult) {
      throw new Error("发布升级资源[" + name + "]的 HDFS 包失败：存储接口未返回结果");
    }
    if (storageResult.Code !== 1) {
      throw new Error("发布升级资源[" + name + "]的 HDFS 包失败：Code="
        + text(storageResult.Code) + "，Msg=" + text(storageResult.Msg || "无错误消息"));
    }
    if (!storageResult.Data) {
      throw new Error("发布升级资源[" + name + "]的 HDFS 包失败：存储接口 Code=1 但缺少 Data");
    }
    var pointer = storageResult.Data;
    saveResult = V8.FormEngine.UptFormData("sys_microistore", {
      Id: current.Data.RowId,
      AppPakcet: "",
      AppVersion: validated.Version,
      PackageId: pointer.PackageId,
      PackageStorageMode: pointer.PackageStorageMode,
      PackageHdfsPath: pointer.PackageHdfsPath,
      PackageSha256: pointer.PackageSha256,
      PackageSize: pointer.PackageSize,
      PackageContentType: pointer.PackageContentType,
      PackageFormatVersion: pointer.PackageFormatVersion,
      PackageUploadedAt: pointer.PackageUploadedAt,
      // OFFICIAL_RESOURCE_EXACT_SELECTION_V1：选择元数据与同一已验证包在同一行
      // 更新中提交，精确覆盖旧 Key/旧表，且不触碰 SelectMenu/SelectWF 等不确定选择。
      SelectApiEngine: selectionJson(exactSelections.SelectApiEngine),
      SelectTable: selectionJson(exactSelections.SelectTable),
      AppUpdateTime: DateNow("yyyy-MM-dd HH:mm:ss")
    });
  }
  if (!saveResult || saveResult.Code !== 1) {
    throw new Error("发布升级资源[" + name + "]失败：" + (saveResult && saveResult.Msg ? saveResult.Msg : ""));
  }
  if (engineKey) {
    // 控制面可发布自己的下一版源码；写库成功后必须清除动态路由缓存，
    // 否则下一次独立 RPC 仍可能执行旧的已编译 Jint 脚本。
    invalidateLiveApiEngineCache(
      { Id: current.Data.RowId, ApiEngineKey: engineKey },
      { Id: current.Data.RowId, ApiEngineKey: engineKey }
    );
  }
  var verified = readRawResource(name);
  if (!verified || verified.Code !== 1 || !verified.Data
      || text(verified.Data.Sha256).toLowerCase() !== sha256(content)) {
    throw new Error("发布升级资源[" + name + "]后回读内容哈希不一致");
  }
  if (!engineKey && text(verified.Data.AppVersion) !== validated.Version) {
    throw new Error(
      "发布升级资源[" + name + "]后商城版本 "
      + text(verified.Data.AppVersion) + " 与包内版本 " + validated.Version + " 不一致"
    );
  }
  if (!engineKey
      && (!storedSelectionEquals(
          verified.Data.SelectApiEngine,
          validated.ExactSelections.SelectApiEngine)
        || !storedSelectionEquals(
          verified.Data.SelectTable,
          validated.ExactSelections.SelectTable))) {
    throw new Error("发布升级资源[" + name + "]后 SelectApiEngine/SelectTable 回读不一致");
  }
  return {
    ResourceName: name,
    Sha256: sha256(content),
    Version: validated.Version,
    ApiEngineSelectionCount: engineKey ? 0 : validated.ExactSelections.SelectApiEngine.length,
    TableSelectionCount: engineKey ? 0 : validated.ExactSelections.SelectTable.length,
    Updated: current.Data.Sha256 !== sha256(content)
  };
}

function parsePublishItems() {
  var items = PARAM.Resources;
  if (typeof items === "string") {
    items = JSON.parse(items);
  }
  if (!items || typeof items.length !== "number") {
    var singleName = text(PARAM.Name || PARAM.ResourceName).trim();
    if (!singleName) return [];
    items = [{
      Name: singleName,
      Content: PARAM.Content,
      ExpectedRemoteSha256: PARAM.ExpectedRemoteSha256
    }];
  }
  var normalized = [];
  for (var i = 0; i < items.length; i++) {
    normalized.push(items[i]);
  }
  return normalized;
}

function lockPublishRows() {
  // 多节点可能同时发布。固定顺序锁住全部 12 个白名单资源行，使
  // “校验 ExpectedRemoteSha256 + 写入”在同一数据库事务内保持原子。
  V8.Db.FromSql(
    "SELECT Id FROM sys_apiengine "
    + "WHERE ApiEngineKey IN ('ai_app_publish_store','get-microi-upgrade-resource','import-microi-store-package') "
    + "ORDER BY Id FOR UPDATE"
  ).ToArray();
  V8.Db.FromSql(
    "SELECT Id FROM sys_microistore "
    + "WHERE AppId IN ('app.microi.ai-engine','app.microi.form-engine','app.microi.message-notification','app.microi.module-engine','app.microi.saas-engine','app.microi.sso','app.microi.store','app.microi.sys-config','app.microi.sys_user') "
    + "ORDER BY Id FOR UPDATE"
  ).ToArray();
}

var action = text(PARAM.Action).trim().toLowerCase();
// Canonical trusted action name: ReconcilePublishedApiEngines.
// Keep this exact marker so the release preflight can prove the second-phase
// live projection endpoint is present before publishing the control plane.
if (action === "reconcilepublishedapiengines") {
  // 首次发布新控制面时，当前 PublishBatch 仍由旧版已编译脚本执行。因此发布脚本
  // 必须在资源回读后发起独立第二次调用；该调用会命中新版源码并完成 live 投影。
  var reconcileAuthorization = V8.Method.AuthorizeOfficialResourcePublish();
  if (!reconcileAuthorization || reconcileAuthorization.Code !== 1) {
    return reconcileAuthorization || result(0, null, "官方接口投影授权未返回结果");
  }
  try {
    var reconcileResult = reconcilePublishedApiEngines();
    return result(1, reconcileResult, "官方应用接口已投影并完成 live 回读");
  } catch (reconcileError) {
    return result(0, null, reconcileError.message);
  }
}

if (action === "publish" || action === "publishbatch") {
  // 发布控制面不能只相信缓存投影里的 Level。可信原子同时固定调用接口和
  // iTdos 官方租户、拒绝访问密钥会话，并从主库复核管理员仍然有效。
  var publishAuthorization = V8.Method.AuthorizeOfficialResourcePublish();
  if (!publishAuthorization || publishAuthorization.Code !== 1) {
    return publishAuthorization || result(0, null, "官方升级资源发布授权未返回结果");
  }

  try {
    var publishItems = parsePublishItems();
    if (!publishItems.length) {
      return result(0, null, "缺少待发布资源 Resources");
    }
    lockPublishRows();

    var seen = {};
    var prepared = [];
    for (var p = 0; p < publishItems.length; p++) {
      var item = publishItems[p] || {};
      var itemName = text(item.Name || item.ResourceName).trim();
      if (!itemName || seen[itemName]) {
        throw new Error("资源名称为空或重复：" + itemName);
      }
      seen[itemName] = true;
      validatePublishResource(itemName, text(item.Content));
      var current = readRawResource(itemName);
      if (!current || current.Code !== 1 || !current.Data) {
        throw new Error(current && current.Msg ? current.Msg : "读取远端资源失败：" + itemName);
      }
      var expectedSha = text(item.ExpectedRemoteSha256).toLowerCase();
      if (!expectedSha || expectedSha !== text(current.Data.Sha256).toLowerCase()) {
        throw new Error(
          "远端资源[" + itemName + "]已变化，拒绝覆盖。Expected="
          + expectedSha + "，Actual=" + current.Data.Sha256
        );
      }
      var publishValidation = validatePublishResource(itemName, text(item.Content));
      if (!getEngineKey(itemName)
          && current.Data.Sha256 !== sha256(text(item.Content))
          && compareVersions(publishValidation.Version, current.Data.AppVersion) <= 0) {
        throw new Error(
          "升级资源[" + itemName + "]内容已变化，但包版本 "
          + publishValidation.Version + " 未高于官网 " + text(current.Data.AppVersion)
        );
      }
      prepared.push({ Item: item, Current: current });
    }

    var published = [];
    for (var a = 0; a < prepared.length; a++) {
      published.push(applyPublishResource(prepared[a].Item, prepared[a].Current));
    }
    return result(1, published, "升级资源发布成功");
  } catch (publishError) {
    return result(0, null, publishError.message);
  }
}

if (!resourceName) {
  return result(0, null, "缺少资源名称 Name");
}
return readRawResource(resourceName);
