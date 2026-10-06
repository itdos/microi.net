/*
 * V8 ApiEngine
 * ApiEngineKey: official_marketplace_install_stat
 * Version: v1.1.0
 * Function:
 * - 每次安装、更新或重新安装按 OperationId 只累计一次。
 * - 新版平台使用共享数据库事件表与商城计数同事务提交；升级过渡期兼容共享 Redis 原子占位。
 */

function text(value, fallback) {
    return value === null || value === undefined ? (fallback || '') : String(value);
}
function trim(value) {
    return text(value).replace(/^\s+|\s+$/g, '');
}
function nowText() {
    return typeof DateNow == 'function'
        ? DateNow('yyyy-MM-dd HH:mm:ss')
        : System.DateTime.Now.ToString('yyyy-MM-dd HH:mm:ss');
}
function clipped(value, maxLength) {
    value = trim(value);
    return value.length > maxLength ? value.substring(0, maxLength) : value;
}
function resultData(store, operationId, counted, deduplicated, mode) {
    return {
        StoreId: text(store.Id),
        AppId: text(store.AppId),
        OperationId: operationId,
        InstallCount: parseInt(store.InstallCount || 0, 10) || 0,
        Counted: counted,
        Deduplicated: deduplicated,
        IdempotencyMode: mode
    };
}

var storeId = clipped(V8.Param.StoreId, 100);
var appId = clipped(V8.Param.AppId, 100);
var operationId = clipped(V8.Param.OperationId || V8.Param.InstallOperationId || V8.Param.InstallationKey, 100);
var targetOsClient = clipped(V8.Param.TargetOsClient, 100);
var appName = clipped(V8.Param.AppName, 200);
var appVersion = clipped(V8.Param.AppVersion, 50);
var installAction = clipped(V8.Param.InstallAction || 'Install', 50);
var installationKey = clipped(V8.Param.InstallationKey, 100);

if (!storeId && !appId) return { Code: 0, Msg: 'StoreId或AppId不能为空。' };
if (!operationId) return { Code: 0, Msg: 'OperationId不能为空，无法保证安装计数幂等。' };
if (!targetOsClient) return { Code: 0, Msg: 'TargetOsClient不能为空。' };
if (['Install', 'Update', 'Reinstall'].indexOf(installAction) < 0) {
    return { Code: 0, Msg: 'InstallAction仅支持Install、Update或Reinstall。' };
}

var storeResult = storeId
    ? V8.FormEngine.GetFormData('sys_microistore', { Id: storeId })
    : V8.FormEngine.GetFormData('sys_microistore', {
        _Where: [['AppId', '=', appId]],
        _PageSize: 1
    });
if (!storeResult || storeResult.Code != 1 || !storeResult.Data) {
    return { Code: 2, Msg: '未找到对应的应用商城记录。' };
}
var store = storeResult.Data;
var eventId = V8.EncryptHelper.MD5Encrypt(
    text(store.Id) + '|' + targetOsClient.toLowerCase() + '|' + operationId
);
var countedAt = nowText();

var eventTableResult = V8.FormEngine.GetFormData('diy_table', {
    _Where: [['Name', '=', 'mci_marketplace_install_event']],
    _SelectFields: ['Id', 'Name'],
    _PageSize: 1
});
if (eventTableResult && eventTableResult.Code == 1 && eventTableResult.Data) {
    var inserted = V8.Db.FromSql(
        'INSERT IGNORE INTO `mci_marketplace_install_event` '
        + '(`Id`,`OperationId`,`StoreId`,`AppId`,`AppName`,`AppVersion`,`InstallAction`,`TargetOsClient`,`CountedAt`,`Source`,`Remark`,`CreateTime`,`IsDeleted`) '
        + 'VALUES (@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,@p9,@p10,@p11,@p12)'
    )
        .AddInParameter('@p0', eventId)
        .AddInParameter('@p1', operationId)
        .AddInParameter('@p2', text(store.Id))
        .AddInParameter('@p3', text(store.AppId || appId))
        .AddInParameter('@p4', appName || text(store.AppName || store.Name))
        .AddInParameter('@p5', appVersion || text(store.AppVersion))
        .AddInParameter('@p6', installAction)
        .AddInParameter('@p7', targetOsClient)
        .AddInParameter('@p8', countedAt)
        .AddInParameter('@p9', 'official_marketplace_install_stat')
        .AddInParameter('@p10', installationKey)
        .AddInParameter('@p11', countedAt)
        .AddInParameter('@p12', 0)
        .ExecuteNonQuery();
    if (parseInt(inserted || 0, 10) == 0) {
        return { Code: 1, Data: resultData(store, operationId, false, true, 'DatabaseEvent'), Msg: '该安装操作已累计。' };
    }
    var updated = V8.Db.FromSql(
        'UPDATE `sys_microistore` SET `InstallCount`=COALESCE(`InstallCount`,0)+1 WHERE `Id`=@p0'
    )
        .AddInParameter('@p0', store.Id)
        .ExecuteNonQuery();
    if (parseInt(updated || 0, 10) != 1) {
        return { Code: 0, Msg: '更新应用商城安装次数失败。' };
    }
    store.InstallCount = (parseInt(store.InstallCount || 0, 10) || 0) + 1;
    return { Code: 1, Data: resultData(store, operationId, true, false, 'DatabaseEvent'), Msg: '安装次数已累计。' };
}

// 升级滚动发布期间，新接口引擎可能先于 Upgrade28 到达旧节点。此分支只用于
// 过渡兼容；所有节点完成新版升级后自动切换到上面的数据库事件表事务路径。
var compatibilityHash = 'Microi:iTdos:MarketplaceInstallEvent:CompatibilityV1';
var pendingValue = 'pending|' + System.DateTime.UtcNow.Ticks + '|' + eventId;
var claimed = false;
try {
    claimed = V8.Cache.HashSet(compatibilityHash, eventId, pendingValue, 'NotExists') === true;
} catch (atomicClaimError) {
    var oldValue = V8.Cache.HashGet(compatibilityHash, eventId);
    if (!oldValue) {
        V8.Cache.HashSet(compatibilityHash, eventId, pendingValue);
        claimed = true;
    }
}
if (!claimed) {
    var existingValue = text(V8.Cache.HashGet(compatibilityHash, eventId));
    if (existingValue.indexOf('counted|') == 0) {
        return { Code: 1, Data: resultData(store, operationId, false, true, 'RedisCompatibility'), Msg: '该安装操作已累计。' };
    }
    return { Code: 0, Msg: '相同安装操作正在累计，请稍后由后台任务自动重试。' };
}

var compatibilityUpdated = V8.Db.FromSql(
    'UPDATE `sys_microistore` SET `InstallCount`=COALESCE(`InstallCount`,0)+1 WHERE `Id`=@p0'
)
    .AddInParameter('@p0', store.Id)
    .ExecuteNonQuery();
if (parseInt(compatibilityUpdated || 0, 10) != 1) {
    V8.Cache.HashDelete(compatibilityHash, eventId);
    return { Code: 0, Msg: '更新应用商城安装次数失败。' };
}
V8.Cache.HashSet(compatibilityHash, eventId, 'counted|' + countedAt);
store.InstallCount = (parseInt(store.InstallCount || 0, 10) || 0) + 1;
return {
    Code: 1,
    Data: resultData(store, operationId, true, false, 'RedisCompatibility'),
    Msg: '安装次数已累计；平台升级完成后将自动使用数据库事件表幂等模式。'
};
