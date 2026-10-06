/*
 * V8 Event
 * TableKey: sys_microistore
 * EventType: SubmitBeforeServerV8
 * Version: v1.1.4
 * Function:
 * - 保存应用商城数据前补齐稳定 AppId/AppKey 并规范版本号；新增默认 v1.0.0，更新仅在调用方显式提交版本字段时递增或采用新版本，元数据同步严格保留旧版本，删除不改版本。
 */

function isBlank(value) {
    return value === null || value === undefined || String(value).trim() === '';
}
function hasOwn(obj, key) {
    return obj && Object.prototype.hasOwnProperty.call(obj, key);
}
function getVersionField() {
    if (hasOwn(V8.Form, 'AppVersion') || hasOwn(V8.OldForm, 'AppVersion')) return 'AppVersion';
    if (hasOwn(V8.Form, 'Version') || hasOwn(V8.OldForm, 'Version')) return 'Version';
    if (hasOwn(V8.Form, 'BuildVersion') || hasOwn(V8.OldForm, 'BuildVersion')) return 'BuildVersion';
    return 'AppVersion';
}
function containsField(list, fieldName) {
    if (list === null || list === undefined || list === '') return false;
    if (typeof list === 'string') {
        var text = String(list).trim();
        if (!text) return false;
        try {
            var parsed = JSON.parse(text);
            if (parsed !== text) return containsField(parsed, fieldName);
        } catch (error) {
            list = text.split(',');
        }
    }
    var length = list && list.length !== undefined ? parseInt(list.length, 10) : 0;
    if (!length && list && list.Count !== undefined) length = parseInt(list.Count, 10) || 0;
    for (var i = 0; i < length; i++) {
        if (String(list[i] || '').toLowerCase() === String(fieldName || '').toLowerCase()) return true;
    }
    return false;
}
function isNotSaveField(fieldName) {
    var form = V8.Form || {};
    var param = V8.Param || {};
    return containsField(form._NotSaveField, fieldName)
        || containsField(form.NotSaveField, fieldName)
        || containsField(param._NotSaveField, fieldName)
        || containsField(param.NotSaveField, fieldName)
        || containsField(V8.NotSaveField, fieldName);
}
function normalizeVersion(value, fallback) {
    var text = String(isBlank(value) ? (fallback || 'v1.0.0') : value).trim();
    var match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/i.exec(text);
    if (!match) return normalizeVersion(fallback || 'v1.0.0', 'v1.0.0');
    return 'v' + parseInt(match[1] || '1', 10) + '.' + parseInt(match[2] || '0', 10) + '.' + parseInt(match[3] || '0', 10);
}
function bumpVersion(value) {
    var parts = normalizeVersion(value, 'v1.0.0').replace(/^v/i, '').split('.');
    var major = parseInt(parts[0], 10) || 1;
    var minor = parseInt(parts[1], 10) || 0;
    var patch = parseInt(parts[2], 10) || 0;
    patch++;
    if (patch > 9) {
        patch = 0;
        minor++;
    }
    if (minor > 9) {
        minor = 0;
        major++;
    }
    return 'v' + major + '.' + minor + '.' + patch;
}
function nowText() {
    var d = new Date();
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

var versionField = getVersionField();
var action = String(V8.FormSubmitAction || '');
var normalizedAction = action.toLowerCase();
var isAdd = normalizedAction === 'insert' || normalizedAction === 'add';
var isDelete = normalizedAction === 'delete' || normalizedAction === 'del';
if (isDelete) return { Code: 1 };
// MARKETPLACE_VISIBILITY_DEFAULT_V1：兼容旧包，新增应用默认公开；更新时不覆盖既有选择。
if (isAdd && !hasOwn(V8.Form, 'IsPublic')) {
    V8.Form.IsPublic = 1;
}
// MARKETPLACE_STABLE_APPLICATION_IDENTITY_V1：兼容历史记录只保存 AppId 或
// AppKey 的情况；任一侧存在时对称补齐，两侧都缺失则失败关闭，避免脏数据
// 再进入平台应用通知和安装链路。稀疏更新只在确有缺口时补字段。
var effectiveAppId = !isBlank(V8.Form.AppId) ? String(V8.Form.AppId).trim()
    : (!isBlank(V8.OldForm.AppId) ? String(V8.OldForm.AppId).trim() : '');
var effectiveAppKey = !isBlank(V8.Form.AppKey) ? String(V8.Form.AppKey).trim()
    : (!isBlank(V8.OldForm.AppKey) ? String(V8.OldForm.AppKey).trim() : '');
if (isBlank(effectiveAppId) && !isBlank(effectiveAppKey)) {
    effectiveAppId = effectiveAppKey;
    V8.Form.AppId = effectiveAppId;
}
if (isBlank(effectiveAppKey) && !isBlank(effectiveAppId)) {
    effectiveAppKey = effectiveAppId;
    V8.Form.AppKey = effectiveAppKey;
}
if (isBlank(effectiveAppId) || isBlank(effectiveAppKey)) {
    return { Code: 0, Msg: '应用商城记录必须提供稳定 AppId 或 AppKey。' };
}
var incomingVersion = V8.Form ? V8.Form[versionField] : '';
var oldVersion = V8.OldForm ? V8.OldForm[versionField] : '';
var versionWasSubmitted = hasOwn(V8.Form, versionField);
var versionIsNotSaved = isNotSaveField(versionField);
// MARKETPLACE_EXPLICIT_VERSION_V1：稀疏更新未携带版本字段时不得把空值解释成“自动升版”。
// _NotSaveField 对版本字段具有更高优先级；即使载荷中出现版本，也保持旧值。
if (!versionIsNotSaved && (isAdd || isBlank(oldVersion))) {
    V8.Form[versionField] = normalizeVersion(incomingVersion, 'v1.0.0');
} else if (!versionIsNotSaved && versionWasSubmitted) {
    var normalizedOld = normalizeVersion(oldVersion, 'v1.0.0');
    var normalizedIncoming = normalizeVersion(incomingVersion, normalizedOld);
    V8.Form[versionField] = (isBlank(incomingVersion) || normalizedIncoming === normalizedOld) ? bumpVersion(normalizedOld) : normalizedIncoming;
} else if (versionIsNotSaved && versionWasSubmitted && !isBlank(oldVersion)) {
    V8.Form[versionField] = oldVersion;
}

V8.Form.AppUpdateTime = nowText();
if (isBlank(V8.Form.AppPublishTime)) {
    V8.Form.AppPublishTime = V8.Form.CreateTime || nowText();
}
return { Code: 1 };
