import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = (await readFile(new URL('./import-package.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const packageModel = JSON.parse(await readFile(new URL('./app.microi.store.json', import.meta.url), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const extractHelper = name => {
  const match = source.match(new RegExp(`var ${name} = function \\([^]*?\\n    \\};`));
  assert.ok(match, `missing ${name}`);
  return match[0];
};
const buildStage = source.match(/var uploadedBuild = \[\];[\s\S]*?pruneApplicationAssets\(appId, expectedApplicationPaths\);/)[0];
const chunkHelpers = source.slice(source.indexOf('var applicationAssetChunkMaxFiles ='), source.indexOf('var installUser ='));
const helperNames = [
  'normalizeApplicationPath', 'applicationFileName', 'applicationFileDir', 'applicationFileType',
  'rewriteApplicationRuntimeContext', 'base64DecodedSize', 'applicationFileSha256Bytes',
  'applicationFileSha256Base64', 'uploadApplicationAsset', 'reuseApplicationAsset'
];

test('the released marketplace package contains the same asset recovery fixes as the standalone importer', () => {
  const importer = packageModel.SysApiEngines.find(engine => engine.ApiEngineKey === 'import-microi-store-package');
  assert.equal(importer.ApiV8Code.replace(/\r\n/g, '\n'), source);
  for (const marker of ['RUNTIME_CONTEXT_ASSET_RESUME_V1', 'APPLICATION_ASSET_DISTINCT_PROGRESS_V1', 'APPLICATION_ASSET_NO_PROGRESS_GUARD_V1', 'APPLICATION_ASSET_METADATA_READ_REQUIRED_V1', 'APPLICATION_ASSET_STABLE_APP_ID_V1', 'APPLICATION_ASSET_CURRENT_ROWS_V1', 'APPLICATION_ASSET_PRIMARY_WRITE_READBACK_V1']) {
    assert.ok(importer.ApiV8Code.includes(marker), marker);
  }
});

function asset(path, content) {
  const bytes = Buffer.from(content);
  return { Path: path, ContentBase64: bytes.toString('base64'), Size: bytes.length, Sha256: sha256(bytes) };
}

// 每片新建 VM，只有持久行/对象/检查点留到下一片，避免用同进程内存掩盖恢复问题。
function createInstaller({ files, moveAvailable = true, appType = 'MicroService', inline = false, apiBase = 'https://target.example/api', checkpoint = {}, resumeInstall = true, afterPersist = () => {} } = {}) {
  const rows = {};
  const objects = new Map();
  const uploads = [];
  let moves = 0;
  let slice = 0;
  let lastContext;
  const run = () => {
    const context = {
      appId: 'asset-resume-app', appKey: 'asset-resume', appName: 'Asset Resume', appType,
      inlineRuntimeBuild: inline, buildRoot: appType === 'MicroService' ? 'micro-app/asset-resume/v1.0.0' : 'ai-app-publish/asset-resume/v1.0.0',
      buildAssets: files, sourceFiles: [], totalBundleAssets: files.length, bundleIndex: 0,
      bundle: {}, app: {}, expectedApplicationPaths: {}, existingApplicationAssets: structuredClone(rows),
      resumeInstall, backgroundChunkingEnabled: true, backgroundCheckpoint: structuredClone(checkpoint),
      stats: { ApplicationBuildAssets: 0, ApplicationBuildAssetsReused: 0 },
      firstTextParam(values) { return values.find(value => value !== undefined && value !== null && String(value).trim()) || ''; },
      getUploadedHdfsPath(result) { return result.Data.FilePathName; },
      buildPersistentCheckpoint(phase, index, extra) { return { Phase: phase, Index: index, ...extra }; },
      upsertApplicationRow(table, where, row) {
        assert.equal(table, 'mci_ai_app_file');
        rows[row.FilePath.toLowerCase()] = { ...row, Id: `row-${row.FilePath}` };
        afterPersist(rows[row.FilePath.toLowerCase()]);
        return { Code: 1 };
      },
      reportProgress() {}, pruneApplicationAssets() {},
      V8: {
        Param: { ApplicationAssetChunkMaxFiles: 1 }, OsClient: 'target', SysConfig: { ApiBase: apiBase },
        Base64: { StringToBase64: text => Buffer.from(text).toString('base64') },
        Method: {
          Upload(options) {
            const [filename, base64] = Object.entries(options.FilesByteBase64)[0];
            const key = `target/tmp/${uploads.length}/${filename}`;
            objects.set(key, Buffer.from(base64, 'base64'));
            uploads.push({ path: `${options.Path}/${filename}`, key });
            return { Code: 1, Data: { FilePathName: key } };
          },
          ...(moveAvailable ? { MoveObject(options) {
            moves++;
            assert.ok(objects.has(options.FilePathName));
            objects.set(options.Path, objects.get(options.FilePathName));
            objects.delete(options.FilePathName);
            return { Code: 1 };
          } } : {})
        }
      },
      System: {
        Convert: { FromBase64String: value => Buffer.from(value, 'base64'), ToBase64String: value => Buffer.from(value).toString('base64') },
        Text: { Encoding: { UTF8: { GetString: value => Buffer.from(value).toString('utf8'), GetBytes: value => Buffer.from(value) } } }
      }
    };
    vm.runInNewContext(`${helperNames.map(extractHelper).join('\n')}\n${chunkHelpers}\nresult = (function () { ${buildStage}\n this.runtimeDbAssets = runtimeDbAssets; return { Complete: true }; }).call(this);`, context);
    slice++;
    lastContext = context;
    if (context.result.Data?.BackgroundTask) checkpoint = structuredClone(context.result.Data.BackgroundTask.Checkpoint);
    return context.result;
  };
  return { run, rows, objects, uploads, get moves() { return moves; }, get slice() { return slice; }, get context() { return lastContext; } };
}

for (const moveAvailable of [true, false]) {
  test(`37 runtime assets finish across fresh slices after tenant HTML rewriting (MoveObject=${moveAvailable})`, () => {
    const files = [asset('index.html', '<html><head></head><body>runtime</body></html>'), ...Array.from({ length: 36 }, (_, i) => asset(`assets/chunk-${i}.js`, `window.chunk${i}=true;`))];
    const installer = createInstaller({ files, moveAvailable });
    let result;
    for (let index = 0; index < 40; index++) {
      result = installer.run();
      if (result.Complete) break;
    }
    assert.equal(result.Complete, true, 'installation must leave ApplicationAssets instead of uploading index.html forever');
    assert.equal(installer.slice, 37);
    assert.equal(installer.uploads.length, 37, 'each distinct asset is uploaded exactly once');
    assert.equal(Object.keys(installer.rows).length, 37);
    for (const row of Object.values(installer.rows)) {
      const bytes = installer.objects.get(row.HdfsPath);
      assert.equal(row.ContentHash, sha256(bytes));
      assert.equal(row.Size, bytes.length);
    }
    const htmlRow = installer.rows['dist/index.html'];
    const html = installer.objects.get(htmlRow.HdfsPath).toString('utf8');
    assert.match(html, /https:\/\/target.example\/api/);
    assert.match(html, /"OsClient":"target"/);
    assert.notEqual(htmlRow.ContentHash, files[0].Sha256, 'runtime hash must describe the target bytes');
    if (!moveAvailable) assert.equal(htmlRow.StorageScope, 'PrivateSource+PublicBuildMoveFallback');
  });
}

test('legacy 1657-upload checkpoint reports distinct completed assets instead of 1658/37', () => {
  const files = Array.from({ length: 37 }, (_, index) => asset(`assets/chunk-${index}.js`, `chunk-${index}`));
  const installer = createInstaller({ files, checkpoint: { Phase: 'ApplicationAssets', AssetKind: 'Build', AssetIndex: 1, ApplicationAssetUploaded: 1657 } });
  const progress = installer.run().Data.BackgroundTask;
  assert.equal(progress.Current, 1);
  assert.equal(progress.Total, 37);
});

for (const appType of ['Web', 'UniApp', 'MicroService']) {
  test(`${appType} resumes Unicode HTML with an existing publisher context and keeps complete runtime bytes`, () => {
    const html = '<html><head><script data-microi-runtime-context="true">window.MICROI_OS_CLIENT="publisher";</script></head><body>吾码应用</body></html>';
    const files = [asset('index.htm', html), asset('app.js', 'window.ready=true;')];
    // 同时覆盖仅 Content 存储的离线文件。
    files[0].Content = html;
    delete files[0].ContentBase64;
    const installer = createInstaller({ files, appType, inline: appType === 'MicroService' });
    assert.equal(installer.run().Data.BackgroundTask.Current, 1);
    assert.equal(installer.run().Complete, true);
    assert.equal(installer.uploads.length, 2);
    const row = installer.rows['dist/index.htm'];
    const bytes = installer.objects.get(row.HdfsPath);
    assert.match(bytes.toString(), /吾码应用/);
    assert.doesNotMatch(bytes.toString(), /publisher/);
    assert.equal((bytes.toString().match(/data-microi-runtime-context=/g) || []).length, 1);
    if (appType === 'MicroService') {
      const inlineAsset = installer.context.runtimeDbAssets.find(item => item.Path === 'index.htm');
      assert.equal(inlineAsset.ContentBase64, bytes.toString('base64'));
      assert.equal(inlineAsset.Hash, sha256(bytes));
    }
  });
}

test('new tenant without ApiBase completes HDFS microservice install and exact replay across worker slices', () => {
  const files = [asset('index.html', '<html><head></head><body>workflow</body></html>'), asset('app.js', 'ready')];
  const installer = createInstaller({ files, apiBase: '' });
  assert.equal(installer.run().Data.BackgroundTask.Current, 1);
  assert.equal(installer.run().Complete, true);
  assert.equal(installer.run().Complete, true);
  assert.equal(installer.uploads.length, 2, 'runtime context rewriting must not break idempotent asset reuse');
  const htmlRow = installer.rows['dist/index.html'];
  const bytes = installer.objects.get(htmlRow.HdfsPath);
  assert.equal(htmlRow.ContentHash, sha256(bytes));
  assert.equal(htmlRow.Size, bytes.length);
  const window = { microApp: { getData: () => ({apiBase: 'https://runtime.example/v2', osClient: 'target'}) } };
  vm.runInNewContext(bytes.toString().match(/<script[^>]*>([\s\S]*?)<\/script>/)[1], {window, URL});
  assert.equal(window.MICROI_API_BASE, 'https://runtime.example/v2');
  assert.equal(window.MICROI_OS_CLIENT, 'target');
});

test('background sharding remains resumable when an old caller explicitly disables ResumeInstall', () => {
  const installer = createInstaller({ files: [asset('a.js', 'a'), asset('b.js', 'b')], resumeInstall: false });
  installer.run();
  assert.equal(installer.run().Complete, true);
  assert.equal(installer.uploads.length, 2);
});

for (const damagedField of ['ContentHash', 'Size']) {
  test(`a corrupted persisted ${damagedField} is repaired once and then reused`, () => {
    const files = [asset('index.html', '<html><head></head></html>'), asset('app.js', 'ready')];
    const installer = createInstaller({ files });
    installer.run();
    installer.rows['dist/index.html'][damagedField] = damagedField === 'Size' ? 999999 : 'wrong-hash';
    assert.equal(installer.run().Data.BackgroundTask.Current, 1);
    assert.equal(installer.run().Complete, true);
    assert.equal(installer.uploads.length, 3);
  });
}

test('lost file metadata stops repeated successful slices with a diagnostic error and a bounded upload count', () => {
  const installer = createInstaller({
    files: [asset('index.html', '<html><head></head></html>'), asset('app.js', 'ready')],
    afterPersist(row) { row.ContentHash = ''; }
  });
  installer.run();
  installer.run();
  installer.run();
  assert.throws(() => installer.run(), /APPLICATION_ASSET_NO_PROGRESS.*AssetIndex=1/);
  assert.equal(installer.uploads.length, 4);
});

test('continuation counts the already verified source files during the build phase', () => {
  const installer = createInstaller({ files: [asset('a.js', 'a'), asset('b.js', 'b')] });
  installer.run();
  const result = installer.context.buildApplicationAssetContinuation(0, 'Build', 1, 37, 35);
  assert.equal(result.Data.BackgroundTask.Current, 35);
  assert.equal(result.Data.BackgroundTask.Total, 37);
});

test('private source HTML retains its original bytes and uses the original digest on resume', () => {
  const file = asset('index.html', '<html><head></head><body>源码</body></html>');
  const installer = createInstaller({ files: [asset('app.js', 'ready')] });
  installer.run();
  const ctx = installer.context;
  const upload = ctx.uploadApplicationAsset('ai-app-source/source-id', file, true, false);
  const bytes = installer.objects.get(upload.HdfsPath);
  assert.equal(bytes.toString('base64'), file.ContentBase64);
  const reuse = ctx.reuseApplicationAsset({ 'index.html': { Id: 'source-file', HdfsPath: upload.HdfsPath, ContentHash: upload.Hash, Size: upload.Size } }, 'index.html', file);
  assert.equal(reuse.Hash, file.Sha256);
});

for (const response of [{ Code: 0, Msg: 'permission denied' }, { Code: 1, Data: {} }, null]) {
  test(`metadata query failure does not masquerade as an empty asset set (${JSON.stringify(response)})`, () => {
    const ctx = { resumeInstall: true, readCurrentApplicationAssetRows() { throw new Error(JSON.stringify(response)); } };
    vm.runInNewContext(extractHelper('loadExistingApplicationAssets'), ctx);
    assert.throws(() => ctx.loadExistingApplicationAssets('app-1'), /APPLICATION_ASSET_METADATA_READ_FAILED/);
  });
}

test('a package without an explicit application Id keeps one tenant-scoped identity across fresh slices', () => {
  const identitySource = source.match(/var appId = firstTextParam\(\[app.Id, bundle.AppId[\s\S]*?(?=\n        var appName)/)[0];
  const resolve = (tenant, appKey = 'demo', app = {}, bundle = {}) => {
    const ctx = { app, bundle, appKey, firstTextParam: values => values.find(Boolean) || '', V8: {
      OsClient: tenant, EncryptHelper: { MD5Encrypt: value => createHash('md5').update(value).digest('hex') },
      Method: { NewUlid() { throw new Error('sharded identity must not be random'); } }
    } };
    vm.runInNewContext(identitySource, ctx);
    return ctx.appId;
  };
  assert.equal(resolve('target'), resolve('target'));
  assert.equal(resolve('TARGET'), resolve('target'));
  assert.notEqual(resolve('target'), resolve('another'));
  assert.notEqual(resolve('target'), resolve('target', 'another-app'));
  assert.equal(resolve('target', 'demo', { Id: 'explicit-app' }), 'explicit-app');
  assert.equal(resolve('target', 'demo', {}, { AppId: 'explicit-bundle' }), 'explicit-bundle');
});

// 这里专门覆盖元数据读写边界，不能再像编译字节测试那样把 upsert 替换为总是成功的字典赋值。
function metadataHarness({ seed = [], loseWrite = false, pathHashColumn = true, dialect = 'mysql' } = {}) {
  const rows = structuredClone(seed);
  const sqlCalls = [];
  const active = row => !row.VersionId && !/^(PrivateSourceStaged|PrivateSourceArchived)$/i.test(row.StorageScope || '');
  const primary = { FromSql(sql) {
    const params = {};
    sqlCalls.push({ sql, params });
    return {
      AddInParameter(name, value) { params[name] = value; return this; },
      ToArray() {
        assert.match(sql, /WHERE [`"\[]?AppId[`"\]]?=@p0/);
        assert.match(sql, /VersionId/);
        assert.match(sql, /privatesourcestaged/);
        return structuredClone(rows.filter(row => row.AppId === params['@p0'] && active(row)
          && (!/AND COALESCE\([`"\[]IsDeleted/.test(sql) || !row.IsDeleted)
          && (params['@p1'] === undefined || row.FilePath.toLowerCase() === params['@p1'].toLowerCase()))
          .sort((a, b) => Number(a.IsDeleted || 0) - Number(b.IsDeleted || 0)
            || String(b.UpdateTime || '').localeCompare(String(a.UpdateTime || ''))
            || String(b.CreateTime || '').localeCompare(String(a.CreateTime || '')) || a.Id.localeCompare(b.Id)));
      },
      ExecuteNonQuery() {
        if (loseWrite) return 1;
        let row;
        if (/^UPDATE/.test(sql)) {
          row = rows.find(value => value.Id === params['@id'] && value.AppId === params['@appId'] && active(value));
          if (!row) return 0;
          for (const match of sql.matchAll(/[`"\[]([A-Za-z]+)[`"\]]=@(p\d+)/g)) row[match[1]] = params[`@${match[2]}`];
        } else {
          const names = sql.match(/\(([^)]+)\) VALUES/)[1].split(',').map(name => name.replace(/[`"\[\]]/g, ''));
          row = Object.fromEntries(names.map((name, index) => [name, params[`@p${index}`]]));
          assert.ok(!rows.some(value => value.Id === row.Id));
          rows.push(row);
        }
        return 1;
      }
    };
  } };
  const ctx = {
    resumeInstall: true, runtimeIsSqlServer: dialect === 'sqlserver', runtimeIsOracle: dialect === 'oracle',
    applicationAssetHasPathHash: null, installUser: { Id: 'admin', Name: '管理员' },
    DateNow: () => '2026-09-05 19:00:00',
    readTargetPhysicalColumns: () => pathHashColumn ? [{ COLUMN_NAME: 'FilePathHash' }] : [],
    getPhysicalValue: row => row.COLUMN_NAME,
    V8: { OsClient: 'target', DbTrans: primary, Db: { FromSql() { throw new Error('must use current primary transaction'); } },
      FormEngine: { GetTableData() { throw new Error('stale replica/field metadata'); }, AddFormData() { throw new Error('stale field list silently omits hash'); } },
      EncryptHelper: { MD5Encrypt: value => createHash('md5').update(value).digest('hex') },
      Base64: { StringToBase64: value => Buffer.from(value).toString('base64') }
    },
    System: { Convert: { FromBase64String: value => Buffer.from(value, 'base64') } }
  };
  const quote = source.match(/var quotePhysicalIdentifier = function \([^]*?\n\};/)[0];
  const firstText = source.match(/var firstTextParam = function \([^]*?\n\};/)[0];
  const nowText = source.match(/var nowText = function \([^]*?\n\};/)[0];
  vm.runInNewContext([quote, firstText, nowText, ...[
    'normalizeApplicationPath', 'applicationFileName', 'applicationFileType',
    'applicationFileSha256Bytes', 'applicationFileSha256Base64', 'applicationAssetCurrentPredicate',
    'readCurrentApplicationAssetRows', 'loadExistingApplicationAssets', 'persistApplicationAsset', 'reuseApplicationAsset'
  ].map(extractHelper)].join('\n'), ctx);
  return { ctx, rows, sqlCalls };
}

const metadataFile = asset('CHANGELOG.md', '系统日志/监控 v7.1.5：原始源码');
const metadataRow = { AppId: 'app-1', FilePath: metadataFile.Path, HdfsPath: 'target/private/CHANGELOG.md', ContentHash: metadataFile.Sha256, Size: metadataFile.Size, StorageScope: 'Private' };
const currentRow = { ...metadataRow, Id: 'current', ContentHash: 'old', CreateTime: '2026-09-04', VersionId: null, IsDeleted: 0 };

test('current files, staged copies and archived versions with the same path do not cross during resume or update', () => {
  const history = [
    { ...currentRow, Id: 'staged', VersionId: 'src-stage', StorageScope: 'PrivateSourceStaged', CreateTime: '2026-09-02' },
    { ...currentRow, Id: 'archived', VersionId: 'archive', StorageScope: 'PrivateSourceArchived', CreateTime: '2026-09-01' },
    { ...currentRow, Id: 'legacy-staged', VersionId: null, StorageScope: 'PrivateSourceStaged' }
  ];
  const harness = metadataHarness({ seed: [currentRow, ...history] });
  assert.equal(harness.ctx.loadExistingApplicationAssets('app-1')['changelog.md'].Id, 'current');
  assert.equal(harness.ctx.persistApplicationAsset({ ...metadataRow }).Data.Id, 'current');
  const reuse = harness.ctx.reuseApplicationAsset(harness.ctx.loadExistingApplicationAssets('app-1'), metadataFile.Path, metadataFile);
  assert.equal(reuse.Hash, metadataFile.Sha256);
  assert.deepEqual(harness.rows.slice(1), history, 'staged and historical versions remain byte-for-byte unchanged');
});

test('older duplicate current rows cannot overwrite the row that the writer updates', () => {
  const old = { ...currentRow, Id: 'older-duplicate', CreateTime: '2026-08-01' };
  const { ctx, rows } = metadataHarness({ seed: [old, currentRow] });
  ctx.persistApplicationAsset({ ...metadataRow });
  const map = ctx.loadExistingApplicationAssets('app-1');
  assert.equal(map['changelog.md'].Id, 'current');
  assert.equal(ctx.reuseApplicationAsset(map, metadataFile.Path, metadataFile).Hash, metadataFile.Sha256);
  assert.deepEqual(rows[0], old);
});

for (const pathHashColumn of [true, false]) {
  test(`writes complete file metadata on old targets and reads it from the same primary transaction (FilePathHash=${pathHashColumn})`, () => {
    const { ctx, rows } = metadataHarness({ pathHashColumn });
    const saved = ctx.persistApplicationAsset({ ...metadataRow });
    assert.equal(saved.Code, 1);
    assert.equal(rows[0].ContentHash, metadataFile.Sha256);
    assert.equal(rows[0].Size, metadataFile.Size);
    assert.equal(rows[0].VersionId, null);
    assert.equal(rows[0].FilePathHash, pathHashColumn ? sha256(Buffer.from(metadataFile.Path)) : undefined);
    ctx.persistApplicationAsset({ ...metadataRow });
    assert.equal(rows.length, 1);
  });
}

test('a soft-deleted current row is recovered without touching a deleted archived version', () => {
  const history = { ...currentRow, Id: 'deleted-archive', VersionId: 'archived-version', IsDeleted: 1 };
  const { ctx, rows } = metadataHarness({ seed: [{ ...currentRow, IsDeleted: 1 }, history] });
  assert.equal(Object.keys(ctx.loadExistingApplicationAssets('app-1')).length, 0);
  ctx.persistApplicationAsset({ ...metadataRow });
  assert.equal(rows[0].Id, currentRow.Id);
  assert.equal(rows[0].IsDeleted, 0);
  assert.deepEqual(rows[1], history);
});

test('successful write status without persisted bytes fails readback immediately', () => {
  const { ctx } = metadataHarness({ loseWrite: true });
  assert.throws(() => ctx.persistApplicationAsset({ ...metadataRow }), /APPLICATION_ASSET_METADATA_WRITE_VERIFY_FAILED.*FilePath=CHANGELOG.md/);
});

for (const dialect of ['mysql', 'sqlserver', 'oracle']) {
  test(`current-file recovery uses bounded parameterized ${dialect} SQL`, () => {
    const { ctx, sqlCalls } = metadataHarness({ dialect });
    ctx.readCurrentApplicationAssetRows("tenant-app'quoted", "src/'file.vue");
    const { sql, params } = sqlCalls[0];
    assert.equal(params['@p0'], "tenant-app'quoted");
    assert.equal(params['@p1'], "src/'file.vue");
    assert.ok(!sql.includes("tenant-app'quoted"));
    assert.match(sql, dialect === 'sqlserver' ? /TOP \(20001\)/ : dialect === 'oracle' ? /FETCH FIRST 20001 ROWS ONLY/ : /LIMIT 20001/);
  });
}
