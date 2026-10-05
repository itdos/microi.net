import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { runSourceZip, sourceFixture } from './ai-app-source-zip-harness.mjs';

const publisher = fs.readFileSync(new URL('./ai-app-publish-store.js', import.meta.url), 'utf8');
const importer = fs.readFileSync(new URL('./import-package.js', import.meta.url), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function assigned(name) {
  const start = importer.indexOf(`    var ${name} = function (`);
  assert.ok(start >= 0, name);
  const end = importer.indexOf('\n    };', start);
  assert.ok(end > start, name);
  return importer.slice(start, end + 7);
}
function declaration(name) {
  const start = importer.indexOf(`function ${name}(`);
  if (start < 0) return ''; // The old implementation must reach behavioral red assertions.
  const end = importer.indexOf('\n}', start);
  return importer.slice(start, end + 2);
}

function publish(appFlags = {}, params = {}) {
  const app = { Id: 'source-runtime', AppId: 'sample-runtime', AppKey: 'sample-runtime',
    Name: '私有运行工作台', ApplicationType: 'MicroService', AppVersion: 'v1.2.0',
    OwnerUserId: 'source-owner', CurrentVersion: 2, ...appFlags };
  const html = '<!doctype html><html><head></head><body>runtime</body></html>';
  const service = { Id: 'service', MsKey: app.AppKey, EntryPath: 'index.html', BuildVersion: 'v1.2.0',
    AssetsJson: JSON.stringify([{ Path: 'index.html', Size: Buffer.byteLength(html),
      ContentBase64: Buffer.from(html).toString('base64'), Sha256: sha(html), IsEntry: true }]) };
  const effects = [];
  const context = { DateNow: () => '2026-10-03 04:00:00', V8: { OsClient: 'iTdos',
    CurrentUser: { Id: 'source-owner', Level: 9999 },
    Param: { AppId: app.Id, Action: 'PackageOnly', IncludeSource: false,
      PackageModelOnly: true, AppVersion: 'v1.2.0', ...params },
    EncryptHelper: { Sha256Hex: sha },
    FormEngine: {
      GetFormData(table) {
        if (table === 'sys_microistore') return { Code: 1, Data: copy(app) };
        if (table === 'sys_microiservice') return { Code: 1, Data: copy(service) };
        if (table === 'sys_microistore_changelog') return { Code: 1, Data: {
          Id: 'log', OsClient: 'iTdos', StoreId: app.Id, Version: 'v1.2.0',
          Title: '运行发布', ChangeType: 'Fix', Content: '测试完整发行', ReleaseTime: '2026-10-03 04:00:00' } };
        throw Error('Unexpected publisher read ' + table);
      },
      GetTableData: () => ({ Code: 1, Data: [], DataCount: 0 }),
      AddFormData: (...args) => { effects.push(args); throw Error('PackageOnly cannot write'); },
      UptFormData: (...args) => { effects.push(args); throw Error('PackageOnly cannot write'); }
    },
    ApiEngine: { Run: (...args) => { effects.push(args); throw Error('Unexpected engine side effect'); } },
    Method: {}, Base64: { StringToBase64: text => Buffer.from(text).toString('base64') }
  } };
  const result = vm.runInNewContext('(function(){' + publisher + '\n})();', context);
  return { result: copy(result), effects, app };
}

function bundle(flags = {}) {
  return { ApplicationType: 'MicroService', IncludeSource: false, VersionNo: 'v1.2.0',
    Application: { Id: 'source-runtime', AppId: 'sample-runtime', AppKey: 'sample-runtime',
      Name: '运行容器', OwnerUserId: 'untrusted-source-owner', ...flags },
    AssetStoragePolicy: { Source: 'NotIncluded', Build: 'PublicHdfs' },
    MicroService: { Id: 'runtime-service', StorageMode: 'file' },
    BuildAssets: [{ Path: 'index.html', Content: '<html>runtime</html>' }],
    Routes: [{ PageKey: 'workbench', RoutePath: '/workbench' }] };
}

// Execute the complete canonical installApplicationBundle, real current-row lookup,
// literal-default resolution and upsert functions. Only platform I/O is simulated.
function install(incoming, old) {
  const rows = new Map(), writes = [], uploads = [], readQueries = [];
  if (old) rows.set('sys_microistore', [{ Id: 'target-runtime', AppKey: 'sample-runtime',
    OwnerUserId: 'actual-target-owner', PrivateSourcePath: '/target/private/source', ...copy(old) }]);
  let seq = 0;
  const get = (table, query) => {
    readQueries.push({ table, query: copy(query) });
    if (table === 'diy_table') return { Code: 1, Data: { Id: 'table-' + table, Name: table } };
    const candidates = rows.get(table) || [];
    const found = candidates.find(row => query.Id ? row.Id === query.Id :
      (query._Where || []).every(c => row[c.length === 4 ? c[1] : c[0]] === c.at(-1)));
    return found ? { Code: 1, Data: copy(found) } : { Code: 2 };
  };
  const write = (table, value, update) => {
    const row = copy(value), all = rows.get(table) || [];
    if (update) { const found = all.find(r => r.Id === row.Id); assert.ok(found); Object.assign(found, row); }
    else { row.Id ||= 'target-' + ++seq; all.push(row); rows.set(table, all); }
    writes.push({ table, value: row, update }); return { Code: 1, Data: row };
  };
  const context = { Package: { PackageInfo: { Version: 'v1.2.0', AppId: 'app.public.parent' } },
    installUser: { Id: 'install-admin', Name: '安装管理员' }, newResourceDefaultFields: {},
    stats: new Proxy({}, { get: (target, key) => target[key] || 0 }), debugLog: {},
    applicationMenuBindings: [], reportProgress() {}, firstTextParam: values =>
      values.find(v => v !== undefined && v !== null && String(v) !== '')?.toString() || '',
    nowText: () => '2026-10-03 04:00:00', loadExistingApplicationAssets: () => ({}),
    parsePackageAssets: value => value, normalizeApplicationArchiveFiles: files => files,
    normalizeApplicationPath: value => String(value).replace(/^\/+/, ''),
    normalizePublicApplicationObjectPath: value => String(value).replace(/^\/+/, ''),
    applicationFileDir: path => path.slice(0, path.lastIndexOf('/')),
    applicationFileName: path => path.split('/').at(-1), applicationFileType: path => path.split('.').at(-1),
    reuseApplicationAsset: () => null, shouldContinueApplicationAssets: () => false,
    markApplicationAssetUploaded() {}, pruneApplicationAssets() {}, normalizeRouteMeta: route => route,
    legacyRouteValues: () => [], buildPublicApplicationAssetUrl: (_, path) => 'https://target.test/' + path,
    uploadApplicationAsset(root, file, privateSource) {
      const bytes = Buffer.from(file.Content || '', 'utf8');
      uploads.push({ root, privateSource });
      return { Path: file.Path, HdfsPath: 'target/' + root + '/' + file.Path, Size: bytes.length, Hash: sha(bytes) };
    },
    persistApplicationAsset: row => write('mci_ai_app_file', row, false),
    V8: { OsClient: 'target', Param: {}, SysConfig: {}, Method: {},
      FormEngine: { GetFormData: get,
        GetTableData: (table, query) => {
          assert.equal(table, 'diy_field'); assert.deepEqual(copy(query._Where), [['TableId', '=', 'table-diy_table'], ['Component', '=', 'Switch']]);
          return { Code: 1, Data: [{ Name: 'IsPublic', Component: 'Switch', DefaultValue: '1' }] };
        }, AddFormData: (table, row) => write(table, row, false), UptFormData: (table, row) => write(table, row, true) }
    }
  };
  const functions = ['runWriteWithRetry', 'getApplicationRow', 'applyLiteralSwitchDefaults',
    'getNewResourceSwitchDefaults', 'upsertApplicationRow', 'resolveInstalledMicroServiceUrl', 'installApplicationBundle'];
  vm.runInNewContext(declaration('normalizeApplicationBundleFlag') + '\n' +
    declaration('readApplicationBundleFlags') + '\n' + functions.map(assigned).join('\n') +
    '\ninstallApplicationBundle(incoming,0);', { ...context, incoming: copy(incoming) });
  return { row: rows.get('sys_microistore')[0], writes, uploads, readQueries };
}

function validateFull(incoming, validateOnly = true, healthyPhysicalSchema = false, envelope = 'plural') {
  const effects = [], reads = [];
  const applications = envelope === 'plural' ? { ApplicationBundles: [incoming] } : { [envelope]: incoming };
  // 正向检查使用全部真实前置列；非法声明用旧库缺列场景证明连 DDL 都未发生。
  const prerequisiteColumns = [...importer.matchAll(/\['([A-Za-z][A-Za-z0-9_]*)',/g)].map(match => ({ ColumnName: match[1] }));
  const context = { V8: { OsClient: 'target', Param: { Package: {
    PackageInfo: { AppId: 'app.public.parent', Version: 'v1.2.0' }, ...applications
  }, ValidateOnly: validateOnly }, CurrentUser: { Id: 'install-admin', Level: 9999 },
  Method: { NewGuid: () => 'install-operation' },
  Db: { FromSql(sql) { reads.push(sql); return {
    AddInParameter() { return this; },
    ToArray: () => healthyPhysicalSchema ? prerequisiteColumns : Array.from({ length: 100 }, (_, i) => ({ ColumnName: 'unused' + i })),
    ExecuteNonQuery() { effects.push(sql); throw Error('Unexpected physical write'); }
  }; } },
  FormEngine: new Proxy({}, { get: (_, name) => (...args) => { effects.push([name, args]); throw Error('Unexpected FormEngine I/O'); } }),
  ApiEngine: { Run: (...args) => { effects.push(args); throw Error('Unexpected engine write'); } },
  Cache: { Set: (...args) => { effects.push(args); throw Error('Unexpected cache write'); } }
  } };
  const result = vm.runInNewContext('(function(){' + importer + '\n})();', context);
  return { result: copy(result), effects, reads };
}

for (const [publicFlag, approvalFlag] of [[0,0], [false,false], ['0','0'], [1,1], [true,true], ['1','1']]) {
  test(`full canonical package preflight accepts source flags ${JSON.stringify([publicFlag,approvalFlag])}`, () => {
    for (const envelope of ['plural', 'ApplicationBundle', 'AiApplication', 'FrontendApplication']) {
      const h = validateFull(bundle({ IsPublic: publicFlag, IsApprove: approvalFlag }), true, true, envelope);
      assert.equal(h.result.Code, 1, JSON.stringify(h.result));
      assert.equal(h.result.Data.ApplicationCount, 1); assert.equal(h.effects.length, 0);
      assert.equal(h.reads.length, 4, 'fixed physical schema reads only');
    }
  });
  test(`producer serializes authoritative flags ${JSON.stringify([publicFlag,approvalFlag])} and ignores requested identity overrides`, () => {
    const h = publish({ IsPublic: publicFlag, IsApprove: approvalFlag }, { IsPublic: !Number(publicFlag), IsApprove: !Number(approvalFlag) });
    assert.equal(h.result.Code, 1, JSON.stringify(h.result));
    const app = h.result.Data.Package.ApplicationBundle.Application;
    assert.equal(app.IsPublic, Number(publicFlag)); assert.equal(app.IsApprove, Number(approvalFlag));
    assert.equal(app.Id, h.app.Id); assert.equal(h.effects.length, 0);
  });
  test(`installer source declaration ${JSON.stringify([publicFlag,approvalFlag])} wins over a fresh default and existing opposite state`, () => {
    for (const old of [undefined, { IsPublic: Number(!Number(publicFlag)), IsApprove: Number(!Number(approvalFlag)) }]) {
      const h = install(bundle({ IsPublic: publicFlag, IsApprove: approvalFlag }), old);
      assert.equal(h.row.IsPublic, Number(publicFlag)); assert.equal(h.row.IsApprove, Number(approvalFlag));
      assert.equal(h.row.OwnerUserId, old ? 'actual-target-owner' : 'install-admin');
      assert.equal(h.row.Id, old ? 'target-runtime' : 'source-runtime');
      assert.equal(h.row.AppId, 'sample-runtime'); assert.equal(h.row.BuildStatus, 'Success');
    }
  });
}

test('publisher normalizes historical NULL public visibility without approving an unapproved source runtime', () => {
  for (const flags of [{}, { IsPublic: null, IsApprove: null }, { IsPublic: undefined, IsApprove: undefined }]) {
    const h = publish(flags);
    assert.equal(h.result.Code, 1, JSON.stringify(h.result));
    const app = h.result.Data.Package.ApplicationBundle.Application;
    assert.equal(app.IsPublic, 1, 'source historical NULL is publicly visible by existing discovery contract');
    assert.equal(app.IsApprove, 0, 'an unknown source approval is not build approval');
    assert.equal(h.effects.length, 0);
  }
});

test('full canonical preflight retains legacy bundles and the existing platform root bundle', () => {
  const store = JSON.parse(fs.readFileSync(new URL('./app.microi.store.json', import.meta.url)));
  for (const incoming of [bundle(), store.ApplicationBundles[0]]) {
    const h = validateFull(incoming, true, true);
    assert.equal(h.result.Code, 1, JSON.stringify(h.result));
    assert.equal(h.result.Data.ApplicationCount, 1); assert.equal(h.effects.length, 0);
  }
});

test('legacy new nested runtime explicitly remains private despite Switch default1; legacy target visibility including NULL is unchanged', () => {
  assert.equal(install(bundle()).row.IsPublic, 0);
  for (const value of [0, 1, false, true, null]) {
    const h = install(bundle(), { IsPublic: value });
    assert.equal(h.row.IsPublic, value); assert.equal(h.row.OwnerUserId, 'actual-target-owner');
    assert.equal(h.row.IsApprove, 1, 'legacy build approval behavior retained');
  }
});

for (const invalid of [null, '', 'false', 'true', '00', '01', ' 0', '1 ', 2, -1, 0.5, [], {}, [0]]) {
  for (const name of ['IsPublic', 'IsApprove']) test(`invalid declared ${name}=${JSON.stringify(invalid)} fails full canonical importer before every I/O`, () => {
    for (const validateOnly of [true, false]) {
      const h = validateFull(bundle({ [name]: invalid }), validateOnly);
      assert.equal(h.result.Code, 0); assert.match(h.result.Msg, new RegExp(name));
      assert.equal(h.effects.length, 0); assert.equal(h.reads.length, 0);
    }
    if (invalid !== null) {
      const h = publish({ [name]: invalid });
      assert.equal(h.result.Code, 0); assert.match(h.result.Msg, new RegExp(name)); assert.equal(h.effects.length, 0);
    }
  });
}

test('existing platform root bundle identity, runtime version and owner remain compatible', () => {
  const store = JSON.parse(fs.readFileSync(new URL('./app.microi.store.json', import.meta.url)));
  const real = store.ApplicationBundles[0];
  const incoming = bundle(); incoming.Application = copy(real.Application);
  incoming.Application.AppKey = 'sample-runtime'; incoming.MicroService.Id = real.MicroService.Id;
  const h = install(incoming, { IsPublic: 0 });
  assert.equal(h.row.IsPublic, 0); assert.equal(h.row.OwnerUserId, 'actual-target-owner');
  assert.equal(real.Application.AppKey, 'microi-platform-service');
  assert.equal(store.PackageInfo.AppId, 'app.microi.store');
});

test('source download current authorization remains independent of public/private package flags and client Level', async () => {
  for (const IsPublic of [0, 1, null]) {
    const f = sourceFixture(1); f.app.IsPublic = IsPublic; f.app.OwnerUserId = 'real-owner'; f.app.UserId = 'real-owner'; f.user.Id = 'real-owner';
    const owner = await runSourceZip(f, { userId: 'real-owner' }); assert.equal(owner.result.Code, 1);
    const ordinary = await runSourceZip(f, { userId: 'ordinary', currentUser: { Level: 9999 }, onUser: state => { state.user.Id = 'ordinary'; } });
    assert.equal(ordinary.result.Code, 0); assert.equal(ordinary.result.Reason, 'SOURCE_ZIP_FORBIDDEN');
    assert.equal(ordinary.state.writes + ordinary.state.reads.length + ordinary.state.zips.length, 0);
    const revoked = await runSourceZip(f, { userId: 'real-owner', onUser: state => { state.user.State = 0; } });
    assert.equal(revoked.result.Code, 0); assert.equal(revoked.result.Reason, 'SOURCE_ZIP_FORBIDDEN');
  }
});
