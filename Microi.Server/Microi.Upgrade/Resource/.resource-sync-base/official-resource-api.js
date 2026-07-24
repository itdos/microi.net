/*
 * V8 ApiEngine
 * ApiEngineKey: get-microi-upgrade-resource
 * Version: v1.1.9
 * Function:
 * - 匿名提供固定白名单中的 6 个吾码升级资源及内容哈希。
 * - 仅允许已登录的 9999 级管理员按远端 SHA 乐观锁批量发布合并后的资源。
 * - 资源直接读写 iTdos 官方数据库；不接受任意接口 Key、表名或查询条件。
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
  return "";
}

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
    _SelectFields: ["Id", "AppId", "AppName", "AppVersion", "AppType", "AppDetail", "AppPakcet", "UpdateTime"]
  });
  if (!storeResult || storeResult.Code !== 1 || !storeResult.Data) {
    return result(0, null, "读取应用商城数据失败：" + (storeResult && storeResult.Msg ? storeResult.Msg : ""));
  }
  var row = storeResult.Data;
  var packet = text(row.AppPakcet);
  if (!packet) {
    return result(0, null, "应用商城资源[" + text(row.AppName || row.AppId) + "]的数据包为空");
  }
  return result(1, {
    ResourceName: name,
    Content: packet,
    Sha256: sha256(packet),
    Source: "sys_microistore.AppPakcet",
    StoreId: row.Id,
    AppId: row.AppId || "",
    AppName: row.AppName || "",
    AppVersion: row.AppVersion || "",
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
    "app.microi.module-engine.json": "模块引擎"
  };
  if (!packageModel.PackageInfo
      || text(packageModel.PackageInfo.Name) !== expectedNames[name]
      || !text(packageModel.PackageInfo.Version)) {
    throw new Error("升级资源[" + name + "]包名或版本不正确");
  }
  return { Version: text(packageModel.PackageInfo.Version) };
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
    saveResult = V8.FormEngine.UptFormData("sys_microistore", {
      Id: current.Data.RowId,
      AppPakcet: content,
      AppVersion: validated.Version,
      AppUpdateTime: DateNow("yyyy-MM-dd HH:mm:ss")
    });
  }
  if (!saveResult || saveResult.Code !== 1) {
    throw new Error("发布升级资源[" + name + "]失败：" + (saveResult && saveResult.Msg ? saveResult.Msg : ""));
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
  return {
    ResourceName: name,
    Sha256: sha256(content),
    Version: validated.Version,
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
  // 多节点可能同时发布。固定顺序锁住全部 6 个白名单资源行，使
  // “校验 ExpectedRemoteSha256 + 写入”在同一数据库事务内保持原子。
  V8.Db.FromSql(
    "SELECT Id FROM sys_apiengine "
    + "WHERE ApiEngineKey IN ('ai_app_publish_store','get-microi-upgrade-resource','import-microi-store-package') "
    + "ORDER BY Id FOR UPDATE"
  ).ToArray();
  V8.Db.FromSql(
    "SELECT Id FROM sys_microistore "
    + "WHERE AppId IN ('app.microi.form-engine','app.microi.module-engine','app.microi.store') "
    + "ORDER BY Id FOR UPDATE"
  ).ToArray();
}

var action = text(PARAM.Action).trim().toLowerCase();
if (action === "publish" || action === "publishbatch") {
  var currentUser = V8.CurrentUser || {};
  if (Number(currentUser.Level || 0) < 9999) {
    return result(0, null, "仅平台超级管理员可以发布吾码升级资源");
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
