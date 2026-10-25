import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../engines/mci-file-resource-manager.js', import.meta.url), 'utf8');
const execute = new Function('V8', source);
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const staticResource = () => ({ Kind: 'PlatformStatic', Name: '租户公开脚本', ObjectKey: 'tenant-a/microi-client/assets/index-abc123.js', ContentHash: 'a'.repeat(64), Size: 900000, ContentType: 'application/javascript; charset=utf-8' });

function harness({ tenant = 'tenant-a', admin = true, settings = {}, model = {}, casConflict = false } = {}) {
  const tables = new Map(), reads = [], writes = [];
  const table = name => { if (!tables.has(name)) tables.set(name, new Map()); return tables.get(name); };
  const matches = (row, query) => (query._Where || []).every(([key, op, value]) => op === '=' && String(row[key]) === String(value));
  const project = (row, fields) => fields ? Object.fromEntries(fields.filter(k => k in row).map(k => [k, row[k]])) : clone(row);
  const V8 = {
    OsClient: tenant, CurrentUser: { Id: 'admin-a' }, SysConfig: { FileServer: 'https://file.example.com', ...settings }, OsClientModel: { HDFS: 'Aliyun', ...model }, DbTrans: {},
    Method: { GetSystemObservability: () => ({ Code: admin ? 1 : 0 }) },
    EncryptHelper: { Sha256Hex: sha },
    FormEngine: {
      GetFormData(name, query) {
        reads.push({ name, query: clone(query) });
        const row = [...table(name).values()].find(r => matches(r, query));
        return row ? { Code: 1, Data: project(row, query._SelectFields) } : { Code: 2 };
      },
      GetTableData(name, query) {
        reads.push({ name, query: clone(query) });
        const rows = [...table(name).values()].filter(r => matches(r, query));
        return { Code: 1, DataCount: rows.length, Data: rows.slice((query._PageIndex - 1) * query._PageSize, query._PageIndex * query._PageSize).map(r => project(r, query._SelectFields)) };
      },
      AddFormData(name, row) {
        if (table(name).has(row.Id)) return { Code: 0 };
        writes.push({ name, row: clone(row) }); table(name).set(row.Id, clone(row)); return { Code: 1, Data: clone(row) };
      },
    },
    Db: { FromSql(sql) {
      assert.match(sql, /^UPDATE mci_file_resource SET Name=@name, Enabled=@enabled, RowVersion=RowVersion\+1 WHERE Id=@id AND Tenant=@tenant AND RowVersion=@version/);
      const args = {};
      const query = { AddInParameter(key, value) { args[key] = value; return query; }, ExecuteNonQuery() {
        const row = table('mci_file_resource').get(args['@id']);
        if (casConflict || !row || row.Tenant !== args['@tenant'] || row.RowVersion !== args['@version']) return 0;
        Object.assign(row, { Name: args['@name'], Enabled: args['@enabled'], RowVersion: row.RowVersion + 1 }); writes.push({ sql, args: clone(args) }); return 1;
      } }; return query;
    } },
    Http: new Proxy({}, { get() { throw Error('Network must not be used'); } }),
    ApiEngine: new Proxy({}, { get() { throw Error('No storage worker or helper may run'); } }),
  };
  V8.DbTrans = V8.Db;
  V8.Db = new Proxy({}, { get() { throw Error('Catalogue writes must share the request transaction'); } });
  return { V8, tables, reads, writes, put(name, row) { table(name).set(row.Id, clone(row)); }, run(params) { V8.Param = params; return execute(V8); } };
}

test('capabilities require the platform administrator before any catalogue read or write', () => {
  const h = harness({ admin: false });
  assert.equal(h.run({ Action: 'Register', Resource: staticResource() }).Msg, 'PLATFORM_ADMIN_REQUIRED');
  assert.equal(h.reads.length, 0); assert.equal(h.writes.length, 0);
});

test('the first phase cannot copy, sign, collect or route even with the tenant policy configured', () => {
  const h = harness({ settings: { FileServerBak: 'https://hub.example.com:1120/itdos', FileServerBakThresholdGiB: '1', FileServerBakWindowHours: 24 } });
  const p = h.run({ Action: 'Policy' }).Data;
  assert.equal(p.Configured, true); assert.equal(p.ThresholdBytes, 1073741824); assert.equal(p.WindowHours, 24);
  for (const key of ['RuntimeRoutingEnabled', 'TrustedCollectorsEnabled', 'ReplicaWorkersEnabled']) assert.equal(p[key], false);
  const c = h.run({ Action: 'Capabilities' }).Data; assert.equal(c.NoStorageWrites, true); assert.equal(c.PrivateRoutingSupported, false); assert.equal(c.DependencyGroupsSupported, false); assert.equal(c.CrossTenantGovernanceSupported, false);
  for (const Action of ['Copy', 'Sync', 'SetReady', 'IngestTraffic', 'Resolve']) assert.equal(h.run({ Action }).Code, 0);
  assert.equal(h.writes.length, 0);
});

test('missing and invalid thresholds never become zero usage or enable a policy', () => {
  for (const threshold of [undefined, null, '', '0', '-1', 'NaN', 'Infinity', '1e3', '1,5', '1.0000001', '1000001']) {
    const h = harness({ settings: { FileServerBak: 'https://hub.example.com:1120/itdos', FileServerBakThresholdGiB: threshold } });
    const policy = h.run({ Action: 'Policy' }).Data;
    assert.equal(policy.Configured, false); assert.equal(policy.ThresholdBytes, null); assert.equal(policy.WindowHours, 24);
  }
  const h = harness({ settings: { FileServerBakThresholdGiB: '1.000001' } });
  assert.equal(h.run({ Action: 'Policy' }).Data.ThresholdBytes, 1073741824 + 1074);
});

test('backup endpoints reject signed URL, userinfo, traversal, control characters and invalid ports', () => {
  for (const FileServerBak of ['http://hub.example.com/itdos', 'https://u:p@hub.example.com/x', 'https://hub.example.com/x?sig=abc', 'https://hub.example.com/a/../x', 'https://hub.example.com/%2e%2e/x', 'https://hub.example.com:65536/x', 'https://hub.example.com/x\nheader']) {
    const p = harness({ settings: { FileServerBak, FileServerBakThresholdGiB: 1 } }).run({ Action: 'Policy' }).Data;
    assert.equal(p.Configured, false); assert.equal(p.FileServerBak, ''); assert(p.Blockers.includes('InvalidBackupBase'));
  }
});

test('static registration is metadata only, deterministic and exact replay does not duplicate it', () => {
  const h = harness();
  const a = h.run({ Action: 'Register', Resource: staticResource() }); assert.equal(a.Code, 1);
  assert.equal(a.Data.Resource.AuthorityState, 'Declared'); assert.equal(a.Data.Resource.Visibility, 'Public');
  assert.equal(a.Data.UseBackup, false); assert.equal(h.writes.length, 1);
  const b = h.run({ Action: 'Register', Resource: staticResource() }); assert.equal(b.Data.Replayed, true); assert.equal(b.Data.Resource.Id, a.Data.Resource.Id); assert.equal(h.writes.length, 1);
  const changed = { ...staticResource(), ContentHash: 'b'.repeat(64) };
  assert.equal(h.run({ Action: 'Register', Resource: changed }).Msg, 'RESOURCE_VERSION_CONFLICT'); assert.equal(h.writes.length, 1);
});

test('arbitrary URL, encoded paths, source namespaces and private types cannot enter the public catalogue', () => {
  for (const ObjectKey of ['https://evil.example/a.js', '../secret.js', 'a/../b.js', '/a.js', 'a//b.js', 'a%2fb.js', 'a\\b.js', 'a.js?Signature=xxx', 'private/a.js', 'app/PrivateSource/a.js', 'app/source/a.js', 'app/_origin/a.js', 'app/.git/config.js', 'app/admin.cs']) {
    const h = harness(); assert.equal(h.run({ Action: 'Register', Resource: { ...staticResource(), ObjectKey } }).Code, 0, ObjectKey); assert.equal(h.writes.length, 0);
  }
  for (const patch of [{ Visibility: 'Private' }, { State: 'Ready' }, { AccessKey: 'not-a-real-secret' }, { Url: 'https://evil.example/a.js' }]) assert.equal(harness().run({ Action: 'Register', Resource: { ...staticResource(), ...patch } }).Msg, 'UNSUPPORTED_RESOURCE_ARGUMENT');
});

test('application registration binds active public metadata and rejects caller-supplied authority', () => {
  const h = harness(); h.put('mci_ai_app_file', { Id: 'file-1', AppId: 'app-1', StorageScope: 'PublicBuildStream', HdfsPath: 'tenant-a/micro-app/app/v1/assets/tree.glb', ContentHash: 'c'.repeat(64), Size: 1234, Version: 4 });
  const Resource = { Kind: 'ApplicationPublicBuild', Name: '树模型', SourceFileId: 'file-1' };
  const r = h.run({ Action: 'Register', Resource }); assert.equal(r.Code, 1); assert.equal(r.Data.Resource.Size, 1234); assert.equal(r.Data.Resource.AuthorityState, 'MetadataBound');
  assert.equal(h.run({ Action: 'Register', Resource: { ...Resource, ObjectKey: 'forged.glb' } }).Msg, 'APPLICATION_METADATA_MUST_BE_AUTHORITATIVE');
  for (const scope of ['PrivateSource', 'PublicBuildStreamArchived', '', null]) {
    h.put('mci_ai_app_file', { Id: 'file-2', AppId: 'app-1', StorageScope: scope, HdfsPath: 'private/a.js', ContentHash: 'd'.repeat(64), Size: 12 });
    assert.equal(h.run({ Action: 'Register', Resource: { ...Resource, SourceFileId: 'file-2' } }).Msg, 'PUBLIC_BUILD_REQUIRED');
  }
  assert(h.reads.every(x => Array.isArray(x.query._SelectFields) && x.query._ReadPrimary === true));
});

test('tenant and input identity are authoritative, including nested host-like JSON parameters', () => {
  const h = harness();
  assert.equal(h.run({ Action: 'List', OsClient: 'tenant-b' }).Msg, 'TENANT_MISMATCH');
  assert.equal(h.run({ Action: 'List', Tenant: 'tenant-b' }).Msg, 'UNSUPPORTED_ARGUMENT');
  assert.equal(h.run({ Action: 'List', _CurrentUser: { Level: 9999 } }).Msg, 'UNSUPPORTED_ARGUMENT');
  const wrapped = new Proxy({ Action: 'Register', Resource: staticResource(), ApiEngineKey: 'mci-file-resource-manager', TestParam1: null }, { set() { throw Error('host object is immutable'); } });
  assert.equal(h.run(wrapped).Code, 1);
  assert.equal(h.run({ Action: 'List', TestParam1: {} }).Msg, 'UNSUPPORTED_ARGUMENT');
});

test('current-tenant prefix and V3 namespace never grant access to another tenant or global shell assets', () => {
  const h = harness({ tenant: 'iTdos' });
  for (const ObjectKey of ['microi_demo/micro-app/app/model.glb', 'demo/micro-app/app/model.glb', 'microi-client/assets/main.js', 'itdos-other/app.js', 'microi/application-assets/v3/tenants/demo/apps/app/model.glb']) {
    assert.equal(h.run({ Action: 'Register', Resource: { ...staticResource(), ObjectKey } }).Msg, 'CURRENT_TENANT_PUBLIC_NAMESPACE_REQUIRED');
  }
  for (const ObjectKey of ['itdos/static/app.js', 'microi/application-assets/v3/tenants/itdos/kinds/microservice/apps/app/releases/v1/requests/abc/assets/app.js']) {
    const r = h.run({ Action: 'Register', Resource: { ...staticResource(), ObjectKey } });
    assert.equal(r.Code, 1); assert.equal(r.Data.Resource.SourceTenant, 'iTdos');
  }
  h.put('mci_ai_app_file', { Id: 'wrong-tenant-file', AppId: 'app-1', StorageScope: 'PublicBuildStream', HdfsPath: 'demo/micro-app/app/v1/assets/tree.glb', ContentHash: 'c'.repeat(64), Size: 1234 });
  assert.equal(h.run({ Action: 'Register', Resource: { Kind: 'ApplicationPublicBuild', Name: 'forged owner', SourceFileId: 'wrong-tenant-file' } }).Msg, 'CURRENT_TENANT_PUBLIC_NAMESPACE_REQUIRED');
  assert.equal(h.run({ Action: 'Register', Resource: { ...staticResource(), SourceTenant: 'demo' } }).Msg, 'UNSUPPORTED_RESOURCE_ARGUMENT');
  assert.equal(h.writes.length, 2);
});

test('host-like selected metadata is normalized before idempotent comparisons and readback', () => {
  const h = harness(), get = h.V8.FormEngine.GetFormData;
  h.V8.FormEngine.GetFormData = (name, query) => {
    const result = get(name, query);
    if (result.Data) result.Data = Object.fromEntries(Object.entries(result.Data).map(([key, value]) => [key, typeof value === 'string' ? Object(value) : value]));
    return result;
  };
  assert.equal(h.run({ Action: 'Register', Resource: staticResource() }).Code, 1);
  assert.equal(h.run({ Action: 'Register', Resource: staticResource() }).Data.Replayed, true);
});

test('list is paginated, explicitly selected and tenant scoped', () => {
  const h = harness(); h.put('mci_file_resource', { Id: 'other', Tenant: 'tenant-b', Name: 'other', Secret: 'hidden' });
  h.run({ Action: 'Register', Resource: staticResource() });
  const list = h.run({ Action: 'List', PageSize: 1 });
  assert.equal(list.Data.Rows.length, 1); assert.equal(list.Data.TotalCount, 1); assert.equal(list.Data.WindowBytes, null); assert.equal(list.Data.TrafficState, 'Unknown');
  assert.equal(h.run({ Action: 'List', PageSize: 101 }).Code, 0);
  assert.equal(h.run({ Action: 'Evaluate', Id: 'other' }).Msg, 'RESOURCE_NOT_FOUND');
});

test('metadata updates require exact row version and cannot update source or success evidence', () => {
  const h = harness(); const row = h.run({ Action: 'Register', Resource: staticResource() }).Data.Resource;
  assert.equal(h.run({ Action: 'Update', Id: row.Id, ExpectedRowVersion: 9, Name: 'new' }).Msg, 'RESOURCE_CONFLICT');
  const result = h.run({ Action: 'Update', Id: row.Id, ExpectedRowVersion: 1, Name: '已停用资源', Enabled: false });
  assert.equal(result.Code, 1); assert.equal(result.Data.Resource.RowVersion, 2); assert.equal(result.Data.Resource.Enabled, 0); assert.equal(result.Data.Resource.SourceRevision, row.SourceRevision);
  assert.equal(h.run({ Action: 'Update', Id: row.Id, ExpectedRowVersion: 2, State: 'Ready' }).Msg, 'UNSUPPORTED_ARGUMENT');
  assert.equal(h.run({ Action: 'Update', Id: row.Id, ExpectedRowVersion: 1, Enabled: true }).Msg, 'RESOURCE_CONFLICT');
});

test('manually seeded Ready and traffic zero never bypass the missing trusted collectors or resolver', () => {
  const h = harness({ settings: { FileServerBak: 'https://hub.example.com:1120/itdos', FileServerBakThresholdGiB: 1, FileServerBakWindowHours: 24 } });
  const row = h.run({ Action: 'Register', Resource: staticResource() }).Data.Resource;
  h.put('mci_file_replica', { Id: 'fake-ready', ResourceId: row.Id, State: 'Ready', VerifiedSha256: row.ContentHash });
  h.put('mci_file_traffic_window', { Id: 'fake-traffic', ResourceId: row.Id, Bytes: 99999999999, CoverageComplete: 1, EvidenceState: 'Verified' });
  const r = h.run({ Action: 'Evaluate', Id: row.Id }).Data;
  assert.equal(r.WindowBytes, null); assert.equal(r.ThresholdMet, null); assert.equal(r.TrafficState, 'Unknown'); assert.equal(r.ReplicaState, 'Unverified'); assert.equal(r.UseBackup, false);
  assert(r.Blockers.includes('RuntimeResolverNotConnected')); assert.equal(h.reads.some(x => /traffic_window|replica/.test(x.name)), false);
});

test('store exceptions are redacted and no raw endpoint or credential can escape', () => {
  const h = harness(); h.V8.FormEngine.GetTableData = () => { throw Error('password=fixture; signed=https://private.example/file?secret=x'); };
  assert.deepEqual(h.run({ Action: 'List' }), { Code: 0, Msg: 'RESOURCE_OPERATION_FAILED' });
});
