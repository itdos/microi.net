import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const pkg = JSON.parse(fs.readFileSync(new URL('./app.microi.saas-engine.json', import.meta.url), 'utf8'));
const source = pkg.SysApiEngines.find(e => e.ApiEngineKey === 'admin_get_empty_database_sanitization_sql').ApiV8Code;
const coreClassifierSource = source.slice(source.indexOf('var corePlatformApplicationKeys ='), source.indexOf('\nfunction collectPackageTableNames'));
const functionSource = source.slice(source.indexOf('function buildInstalledVersionBaselineSql('), source.indexOf('\nvar installedVersionBaseline;'));
const hash = text => createHash('sha256').update(text).digest('hex');

function fixture(override = {}) {
  const body = JSON.stringify({ PackageInfo: { Version: 'v8.2.1' } });
  const store = { Id: 'saas', AppId: 'app.microi.store', AppKey: 'app.microi.store', AppVersion: 'v8.2.1', PackageHdfsPath: '/package', PackageSize: Buffer.byteLength(body), PackageSha256: hash(body), ApplicationType: 'Platform', ...override };
  let reads = 0;
  const context = vm.createContext({
    text: value => String(value ?? '').trim(),
    System: { Text: { Encoding: { UTF8: { GetByteCount: value => Buffer.byteLength(value) } } } },
    V8: { OsClient: 'iTdos', Method: { GetPrivateFileText() { reads++; return { Code: 1, Data: body }; } }, EncryptHelper: { Sha256Hex: hash } }
  });
  vm.runInContext(coreClassifierSource + '\n' + functionSource, context);
  return { store, run: installed => context.buildInstalledVersionBaselineSql([store], installed), reads: () => reads };
}

test('empty database aligns existing installations to the verified catalog snapshot', () => {
  const f = fixture();
  const result = f.run([{ StoreId: 'saas', AppVersionInstall: 'v7.8.26' }]);
  assert.equal(result.Baselines[0].Version, 'v8.2.1');
  assert.equal(result.Baselines[0].PackageSha256, f.store.PackageSha256);
  assert.match(result.Sql, /v.AppVersionInstall=s.AppVersion/);
  assert.match(result.Sql, /WHERE s.AppVersion='v8.2.1' AND LOWER/);
  assert.equal(f.reads(), 1);
});

test('absent applications and business applications do not get invented install records', () => {
  const absent = fixture();
  assert.equal(absent.run([]).Sql, '');
  assert.equal(absent.reads(), 0);
  const business = fixture({ ApplicationType: 'Web' });
  assert.equal(business.run([{ StoreId: 'saas' }]).Sql, '');
  assert.equal(business.reads(), 0);
});

test('optional platform packages are not inherited by a new empty template', () => {
  for (const key of ['app.microi.saas-engine','app.microi.ai-engine','app.microi.sso',
    'app.microi.message-notification','microi-wechat-content-security','app.microi.future-feature']) {
    const optional = fixture({AppId:key,AppKey:key});
    assert.equal(optional.run([{StoreId:'saas'}]).Sql, '', key);
    assert.equal(optional.reads(), 0, 'excluded packages need no package download');
  }
});

test('content corruption and catalog/package version disagreement fail closed', () => {
  for (const override of [{ PackageSha256: '0'.repeat(64) }, { PackageSize: 1 }, { AppVersion: 'v9.0.0' }]) {
    const f = fixture(override);
    assert.throws(() => f.run([{ StoreId: 'saas' }]));
  }
});
