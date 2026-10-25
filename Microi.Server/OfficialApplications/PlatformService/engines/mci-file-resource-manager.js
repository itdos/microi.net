/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 官方应用：系统日志/监控。Managed；ApiEngineKey: mci-file-resource-manager
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: mci-file-resource-manager
 * Version: v1.0.0
 * Function:
 * - 当前租户管理员维护热点公开资源目录，读取系统阈值和明确未接入的流量/副本状态。
 * - 只登记元数据；不读取文件正文、不复制、不签名、不启用分流，不接受调用方伪造Ready或可信计量。
 */

var tenant = String(V8.OsClient || ''), protocol = 'ManagedFileResource/1';
var resourceFields = ['Id', 'Tenant', 'ResourceKey', 'Name', 'Kind', 'AppId', 'SourceFileId', 'SourceTenant', 'SourceProvider', 'ObjectKey', 'ContentHash', 'Size', 'ContentType', 'SourceRevision', 'AuthorityState', 'Visibility', 'Enabled', 'RowVersion'];

// 错误只返回固定代码；数据库异常与请求正文不会进入响应。
function fail(code) { var error = Error(code); error.safeCode = code; throw error; }
function text(value) { return value == null ? '' : String(value).trim(); }
function ok(data) { return { Code: 1, Data: data }; }
function must(result) { if (!result || Number(result.Code) !== 1) fail('RESOURCE_STORE_UNAVAILABLE'); return result.Data; }
function digest(value) { return String(V8.EncryptHelper.Sha256Hex(String(value))).toLowerCase(); }

// 只规范化有界业务参数；身份和租户始终来自服务端上下文。
function parameters() {
    var encoded = JSON.stringify(V8.Param || {});
    if (encoded.length > 16384) fail('REQUEST_TOO_LARGE');
    var value = JSON.parse(encoded), allowed = ['Action', 'Resource', 'Id', 'Name', 'Enabled', 'ExpectedRowVersion', 'PageIndex', 'PageSize'];
    var transport = ['ApiEngineKey', 'ApiAddress', 'OsClient', '_InvokeType', '_Lang'];
    Object.keys(value).forEach(function (key) {
        if (allowed.indexOf(key) >= 0 || transport.indexOf(key) >= 0) return;
        if (key === 'TestParam1' && (value[key] == null || typeof value[key] === 'boolean' || typeof value[key] === 'number' && isFinite(value[key]) || typeof value[key] === 'string' && value[key].length <= 200)) return;
        fail('UNSUPPORTED_ARGUMENT');
    });
    if (value.OsClient != null && text(value.OsClient).toLowerCase() !== tenant.toLowerCase()) fail('TENANT_MISMATCH');
    return value;
}

// 目录仅接受原始对象键，不接受URL、查询参数、编码穿越或私有源码命名空间。
function objectKey(value) {
    var key = text(value);
    if (!key || key.length > 1000 || /[\\%?#:\x00-\x20\x7f]/.test(key) || key.charAt(0) === '/' || key.charAt(key.length - 1) === '/') fail('INVALID_PUBLIC_OBJECT_KEY');
    var parts = key.split('/');
    if (parts.some(function (part) { return !part || part === '.' || part === '..' || /^(?:\.git|\.env|private|private-source|privatesource|source|_origin)$/i.test(part); })) fail('INVALID_PUBLIC_OBJECT_KEY');
    if (!/\.(?:glb|gltf|bin|hdr|ktx2?|basis|js|mjs|css|wasm|json|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|mp4|webm|zip)$/i.test(key)) fail('UNSUPPORTED_PUBLIC_RESOURCE_TYPE');
    return key;
}
// 仅允许现有平台两种当前租户公有命名空间；管理员身份不是跨租户对象授权。
function tenantObjectKey(value) {
    var key = objectKey(value), owner = tenant.toLowerCase();
    if (key.indexOf(owner + '/') !== 0 && key.indexOf('microi/application-assets/v3/tenants/' + owner + '/') !== 0) fail('CURRENT_TENANT_PUBLIC_NAMESPACE_REQUIRED');
    return key;
}
function identifier(value) { var id = text(value); if (!/^[a-zA-Z0-9-]{1,36}$/.test(id)) fail('INVALID_RESOURCE_ID'); return id; }
function hash(value) { var result = text(value).toLowerCase(); if (!/^[a-f0-9]{64}$/.test(result)) fail('INVALID_CONTENT_HASH'); return result; }
function integer(value, min, max, fallback) { var n = value == null || value === '' ? fallback : Number(value); if (!isFinite(n) || Math.floor(n) !== n || n < min || n > max) fail('INVALID_NUMBER'); return n; }
function label(value) { var s = text(value); if (!s || s.length > 160 || /[\x00-\x1f\x7f]/.test(s)) fail('INVALID_RESOURCE_NAME'); return s; }

// 当前租户事实查询固定字段和范围；不读取正文或秘密字段。
function one(table, id, fields, tenantColumn) {
    var where = [['Id', '=', id]];
    if (tenantColumn) where.push(['Tenant', '=', tenant]);
    var result = V8.FormEngine.GetFormData(table, { _Where: where, _SelectFields: fields, _ReadPrimary: true }, V8.DbTrans);
    if (result && Number(result.Code) === 2) return null;
    var encoded = JSON.stringify(must(result));
    if (!encoded || encoded.length > 32768) fail('RESOURCE_STORE_UNAVAILABLE');
    return JSON.parse(encoded);
}
function resource(id) { var row = one('mci_file_resource', identifier(id), resourceFields, true); if (!row || String(row.Tenant) !== tenant) fail('RESOURCE_NOT_FOUND'); return row; }

// 公开前缀允许域名、可选端口和桶路径；永不接受签名参数或用户信息。
function publicBase(value) {
    var raw = text(value).replace(/\/+$/, '');
    if (!raw) return '';
    var match = /^https:\/\/([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::([0-9]{1,5}))?(\/[^?#]*)?$/i.exec(raw);
    if (!match || !match[1].includes('.') || match[1].includes('..') || match[2] && (Number(match[2]) < 1 || Number(match[2]) > 65535) || /[@%\\\x00-\x20\x7f]/.test(raw)) fail('INVALID_FILE_SERVER_BASE');
    if (match[3] && match[3].split('/').slice(1).some(function (part) { return !part || part === '.' || part === '..'; })) fail('INVALID_FILE_SERVER_BASE');
    return raw;
}

// GiB配置解析为整数bytes；最多六位小数，不接受指数、本地化数字或隐式零值。
function thresholdBytes(value) {
    if (value == null || text(value) === '') return null;
    var raw = text(value);
    if (!/^\d{1,7}(?:\.\d{1,6})?$/.test(raw)) fail('INVALID_TRAFFIC_THRESHOLD');
    var split = raw.split('.'), whole = Number(split[0]), fraction = Number((split[1] || '').padEnd(6, '0'));
    if (whole > 1000000) fail('INVALID_TRAFFIC_THRESHOLD');
    // 两项分别换算，避免大整数乘一百万越过精确整数范围。
    var bytes = whole * 1073741824 + Math.ceil(fraction * 1073741824 / 1000000);
    return bytes > 0 ? bytes : null;
}
function policy() {
    var config = V8.SysConfig || {}, blockers = [], base = '', threshold = null, hours = 24;
    try { base = publicBase(config.FileServerBak); } catch (_) { blockers.push('InvalidBackupBase'); }
    try { threshold = thresholdBytes(config.FileServerBakThresholdGiB); } catch (_) { blockers.push('InvalidThreshold'); }
    try { hours = integer(config.FileServerBakWindowHours, 1, 720, 24); } catch (_) { blockers.push('InvalidWindow'); }
    if (!base) blockers.push('BackupBaseMissing');
    if (threshold == null) blockers.push('ThresholdMissingOrDisabled');
    return { FileServerBak: base, ThresholdBytes: threshold, Unit: 'GiB', WindowHours: hours, Configured: blockers.length === 0, Blockers: blockers, RuntimeRoutingEnabled: false, TrustedCollectorsEnabled: false, ReplicaWorkersEnabled: false };
}

// 应用产物复用权威文件登记；平台静态资源仅登记声明，尚不能作为已验证来源。
function registration(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_RESOURCE');
    var allowed = ['Kind', 'Name', 'SourceFileId', 'ObjectKey', 'ContentHash', 'Size', 'ContentType'];
    Object.keys(input).forEach(function (key) { if (allowed.indexOf(key) < 0) fail('UNSUPPORTED_RESOURCE_ARGUMENT'); });
    var kind = text(input.Kind), row = { Tenant: tenant, SourceTenant: tenant, Name: label(input.Name), Kind: kind, Visibility: 'Public', Enabled: 1, RowVersion: 1, AppId: '', SourceFileId: '', ContentType: '' };
    var provider = text(V8.OsClientModel && V8.OsClientModel.HDFS) || 'Aliyun';
    if (['Aliyun', 'MinIO', 'S3'].indexOf(provider) < 0) fail('UNSUPPORTED_SOURCE_PROVIDER');
    row.SourceProvider = provider;
    if (kind === 'ApplicationPublicBuild') {
        if (input.ObjectKey != null || input.ContentHash != null || input.Size != null || input.ContentType != null) fail('APPLICATION_METADATA_MUST_BE_AUTHORITATIVE');
        var file = one('mci_ai_app_file', identifier(input.SourceFileId), ['Id', 'AppId', 'StorageScope', 'HdfsPath', 'ContentHash', 'Size', 'Version'], false);
        if (!file || ['PublicBuildStream', 'PublicBuildOnly'].indexOf(String(file.StorageScope)) < 0) fail('PUBLIC_BUILD_REQUIRED');
        row.SourceFileId = identifier(file.Id); row.AppId = identifier(file.AppId); row.ObjectKey = tenantObjectKey(file.HdfsPath);
        row.ContentHash = hash(file.ContentHash); row.Size = integer(file.Size, 1, 9007199254740991, -1);
        row.AuthorityState = 'MetadataBound'; row.ResourceKey = 'appfile:' + row.SourceFileId;
    } else if (kind === 'PlatformStatic') {
        if (input.SourceFileId != null) fail('UNSUPPORTED_RESOURCE_ARGUMENT');
        if (!publicBase((V8.SysConfig || {}).FileServer)) fail('PRIMARY_PUBLIC_BASE_MISSING');
        row.ObjectKey = tenantObjectKey(input.ObjectKey); row.ContentHash = hash(input.ContentHash); row.Size = integer(input.Size, 1, 9007199254740991, -1);
        row.ContentType = text(input.ContentType);
        if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:;\s*charset=[a-z0-9-]+)?$/i.test(row.ContentType) || row.ContentType.length > 128) fail('INVALID_CONTENT_TYPE');
        row.AuthorityState = 'Declared'; row.ResourceKey = 'static:' + digest(row.ObjectKey).slice(0, 48);
    } else fail('UNSUPPORTED_RESOURCE_KIND');
    row.SourceRevision = digest([row.SourceTenant, row.SourceProvider, row.ObjectKey, row.ContentHash, row.Size].join('\n'));
    row.Id = digest(tenant + '|resource|' + row.ResourceKey).slice(0, 32);
    return row;
}

// 相同资源/版本幂等登记；新版本必须显式刷新，不能悄悄复用旧副本状态。
function register(input) {
    var row = registration(input), old = one('mci_file_resource', row.Id, resourceFields, true);
    if (old) {
        if (old.Tenant !== tenant || old.ResourceKey !== row.ResourceKey || old.SourceRevision !== row.SourceRevision) fail('RESOURCE_VERSION_CONFLICT');
        return { Resource: old, Replayed: true, UseBackup: false };
    }
    must(V8.FormEngine.AddFormData('mci_file_resource', row, V8.DbTrans));
    var saved = resource(row.Id);
    if (saved.SourceRevision !== row.SourceRevision) fail('RESOURCE_READBACK_MISMATCH');
    return { Resource: saved, Replayed: false, UseBackup: false };
}

// 目录显示名/纳入开关采用固定SQL与参数化CAS，禁止修改证据或副本成功状态。
function update(params) {
    var old = resource(params.Id), version = integer(params.ExpectedRowVersion, 1, 2147483646, -1);
    var name = params.Name == null ? label(old.Name) : label(params.Name);
    var enabled = params.Enabled == null ? Number(old.Enabled) : params.Enabled === true || params.Enabled === 1 ? 1 : params.Enabled === false || params.Enabled === 0 ? 0 : -1;
    if (enabled < 0) fail('INVALID_ENABLED');
    var changed = V8.DbTrans.FromSql('UPDATE mci_file_resource SET Name=@name, Enabled=@enabled, RowVersion=RowVersion+1 WHERE Id=@id AND Tenant=@tenant AND RowVersion=@version AND (IsDeleted IS NULL OR IsDeleted=0)')
        .AddInParameter('@name', name).AddInParameter('@enabled', enabled).AddInParameter('@id', old.Id).AddInParameter('@tenant', tenant).AddInParameter('@version', version).ExecuteNonQuery();
    if (Number(changed) !== 1) fail('RESOURCE_CONFLICT');
    var saved = resource(old.Id);
    if (Number(saved.RowVersion) !== version + 1 || saved.Name !== name || Number(saved.Enabled) !== enabled) fail('RESOURCE_READBACK_MISMATCH');
    return { Resource: saved, UseBackup: false };
}

// 第一阶段只展示缺口；即使表中有人填Ready，也不能作为可信采集/复制回执。
function evaluate(row) {
    var settings = policy(), reasons = settings.Blockers.slice();
    if (Number(row.Enabled) !== 1) reasons.push('ResourceDisabled');
    if (row.Visibility !== 'Public') reasons.push('PublicResourceRequired');
    if (row.SourceTenant !== tenant) reasons.push('SourceTenantMismatch');
    reasons.push('TrustedTrafficCollectorNotConnected', 'VerifiedReplicaWorkerNotConnected', 'RuntimeResolverNotConnected');
    return { ResourceId: row.Id, SourceRevision: row.SourceRevision, Policy: settings, TrafficState: 'Unknown', WindowBytes: null, ThresholdMet: null, ReplicaState: 'Unverified', UseBackup: false, Blockers: reasons };
}

try {
    var auth = V8.Method.GetSystemObservability({ Action: 'Snapshot', IncludeHost: false, WindowMinutes: 1, Top: 1 });
    if (!auth || Number(auth.Code) !== 1) return { Code: 0, Msg: 'PLATFORM_ADMIN_REQUIRED' };
    if (!/^[a-zA-Z0-9_-]{1,50}$/.test(tenant)) fail('TENANT_REQUIRED');
    var p = parameters(), action = text(p.Action);
    if (action === 'Capabilities') return ok({ Protocol: protocol, Actions: ['Capabilities', 'Policy', 'List', 'Register', 'Update', 'Evaluate'], Scope: 'CurrentTenantPublicMetadataOnly', DependencyGroupsSupported: false, CrossTenantGovernanceSupported: false, RuntimeRoutingEnabled: false, TrustedCollectorsEnabled: false, ReplicaWorkersEnabled: false, NoFileBodiesRead: true, NoStorageWrites: true, PrivateRoutingSupported: false });
    if (action === 'Policy') return ok(policy());
    if (action === 'Register') return ok(register(p.Resource));
    if (action === 'Update') return ok(update(p));
    if (action === 'Evaluate') return ok(evaluate(resource(p.Id)));
    if (action === 'List') {
        var page = integer(p.PageIndex, 1, 100000, 1), size = integer(p.PageSize, 1, 100, 20);
        var result = V8.FormEngine.GetTableData('mci_file_resource', { _Where: [['Tenant', '=', tenant]], _SelectFields: resourceFields, _PageIndex: page, _PageSize: size, _OrderBy: 'CreateTime', _OrderByType: 'DESC', _ReadPrimary: true }, V8.DbTrans);
        var rows = must(result);
        return ok({ Rows: rows, TotalCount: result.DataCount == null ? null : result.DataCount, PageIndex: page, PageSize: size, TrafficState: 'Unknown', WindowBytes: null, UseBackup: false });
    }
    fail('UNSUPPORTED_ACTION');
} catch (error) { return { Code: 0, Msg: error.safeCode || 'RESOURCE_OPERATION_FAILED' }; }
