import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const resource = JSON.parse(fs.readFileSync(
  path.join(directory, 'app.microi.saas-engine.json'),
  'utf8'
));
const expected = [
  'platform_auth_sms_login',
  'platform_auth_login_event',
  'platform_auth_login_hook',
  'send_sms_reg'
];
const versionAtLeast = (actual, minimum) => {
  const left = String(actual || '').replace(/^v/i, '').split('.').map(value => Number.parseInt(value, 10) || 0);
  const right = String(minimum || '').replace(/^v/i, '').split('.').map(value => Number.parseInt(value, 10) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] || 0) !== (right[index] || 0)) return (left[index] || 0) > (right[index] || 0);
  }
  return true;
};

test('SaaS bootstrap package carries platform authentication engines', () => {
  assert.ok(versionAtLeast(resource.PackageInfo.Version, 'v7.5.28'));
  assert.equal(resource.PackageInfo.ApiEngineCount, resource.SysApiEngines.length);
  const engines = resource.SysApiEngines.filter((item) => expected.includes(item.ApiEngineKey));
  assert.deepEqual(engines.map((item) => item.ApiEngineKey), expected);
  assert.equal(engines.find((item) => item.ApiEngineKey === 'platform_auth_sms_login').AllowAnonymous, 1);
  assert.equal(engines.find((item) => item.ApiEngineKey === 'platform_auth_sms_login').StopHttp, 0);
  assert.equal(engines.find((item) => item.ApiEngineKey === 'platform_auth_login_event').StopHttp, 1);
  assert.equal(engines.find((item) => item.ApiEngineKey === 'platform_auth_login_hook').StopHttp, 1);
  const sender = engines.find((item) => item.ApiEngineKey === 'send_sms_reg');
  assert.equal(sender.AllowAnonymous, 1);
  assert.equal(sender.StopHttp, 0);
  assert.equal(sender.IsEnable, 1);
  assert.equal(sender.ApiAddress, '/apiengine/send_sms_reg');
  assert.equal(sender.Timeout, 600);
  assert.equal(sender.V8Unlimited, 1);
  for (const capability of [
    'V8.Method.CreatePlatformSmsProof',
    'V8.Method.CreatePlatformSmsUser',
    'V8.Method.CompletePlatformSmsLogin'
  ]) assert.ok(resource.PackageInfo.RequiredPlatformCapabilities.includes(capability));
});

test('platform authentication package code matches canonical V8 sources', () => {
  const sourceDirectory = path.resolve(
    directory,
    '..', '..', '..',
    'Microi-V8-Engine',
    'Microi吾码 (api.itdos.com)',
    'iTdos.Product.Internal',
    '接口引擎',
    '系统',
    '身份与登录'
  );
  for (const key of expected) {
    const engine = resource.SysApiEngines.find((item) => item.ApiEngineKey === key);
    const engineSourceDirectory = key === 'send_sms_reg'
      ? path.resolve(sourceDirectory, '..', '..', '未分类')
      : sourceDirectory;
    const sourceFile = fs.readdirSync(engineSourceDirectory)
      .find((file) => file.endsWith(`(${key}).js`));
    assert.ok(sourceFile, `canonical source is missing for ${key}`);
    const normalizeSource = value => String(value || '')
      .replace(/\r\n?/g, '\n')
      .trimEnd();
    const source = fs.readFileSync(path.join(engineSourceDirectory, sourceFile), 'utf8');
    assert.equal(normalizeSource(engine.ApiV8Code), normalizeSource(source), `${key} package code drifted`);
  }
});

test('platform authentication generator updates engines in place with canonical limits and newlines', () => {
  const generator = fs.readFileSync(path.join(directory, 'configure-platform-auth-resource.mjs'), 'utf8');
  assert.match(generator, /findIndex\(item => item\.ApiEngineKey === spec\.key\)/);
  assert.doesNotMatch(generator, /filter\(\(engine\) => !managedKeys\.has/);
  assert.match(generator, /LimitRecursion:\s*5000/);
  assert.match(generator, /ensureMinimumPackageVersion\(pkg\.PackageInfo, 'v7\.5\.7'\)/);
  assert.doesNotMatch(generator, /Version:\s*'v7\.5\.7'/);
  assert.ok(!generator.includes(".replace(/\\n*$/g, '\\n')"));
});

test('Managed core and CreateIfMissing tenant hook policies are explicit', () => {
  assert.deepEqual(resource.ResourcePolicies.ApiEngines.platform_auth_sms_login, {
    Ownership: 'Platform', UpgradePolicy: 'Managed'
  });
  assert.deepEqual(resource.ResourcePolicies.ApiEngines.platform_auth_login_event, {
    Ownership: 'Platform', UpgradePolicy: 'Managed'
  });
  assert.deepEqual(resource.ResourcePolicies.ApiEngines.platform_auth_login_hook, {
    Ownership: 'Tenant', UpgradePolicy: 'CreateIfMissing'
  });
  assert.deepEqual(resource.ResourcePolicies.ApiEngines.send_sms_reg, {
    Ownership: 'Platform', UpgradePolicy: 'Managed'
  });
});

test('managed SMS sender uses private tenant settings without exposing or mixing credentials', () => {
  const sender = resource.SysApiEngines.find((item) => item.ApiEngineKey === 'send_sms_reg');
  assert.match(sender.ApiV8Code, /ServerPrivateSettings/);
  assert.match(sender.ApiV8Code, /Sms\.Aliyun\.AccessKeyId/);
  assert.match(sender.ApiV8Code, /Sms\.Aliyun\.AccessKeySecret/);
  assert.match(sender.ApiV8Code, /usingTenantSmsSettings = !!tenantAccessKeyId && !!tenantAccessKeySecret/);
  const dataAppend = sender.ApiV8Code.match(/result\.DataAppend\s*=\s*\{[\s\S]*?\};/)?.[0] || '';
  assert.ok(dataAppend);
  assert.doesNotMatch(dataAppend, /AccessKeyId|AccessKeySecret/);
});

test('backend upgrade auto-installs the identity package while password login stays bootstrap-native', () => {
  const upgrade = fs.readFileSync(path.join(directory, '..', '13-UpgradeAppStore.cs'), 'utf8');
  const sessionRuntime = fs.readFileSync(
    path.join(directory, '..', '..', 'Microi.net', 'Identity', 'SysUserSessionRuntime.cs'),
    'utf8'
  );
  const deletedController = path.join(
    directory, '..', '..', 'Microi.net.Api', 'Controllers', 'SysUserController.cs'
  );
  const upgradeVersion = upgrade.match(/public static string Version = "(\d+)\.(\d+)\.(\d+)\.(\d+)"/);
  assert.ok(upgradeVersion, 'UpgradeAppStore must keep a parseable four-part version gate');
  const versionParts = upgradeVersion.slice(1).map(Number);
  assert.ok(
    versionParts[0] > 6
      || (versionParts[0] === 6 && versionParts[1] > 4)
      || (versionParts[0] === 6 && versionParts[1] === 4 && versionParts[2] >= 11),
    `UpgradeAppStore version ${upgradeVersion[1]}.${upgradeVersion[2]}.${upgradeVersion[3]}.${upgradeVersion[4]} predates the identity package gate`,
  );
  assert.match(upgrade, /SaaSEnginePackageResourceName/);
  assert.match(upgrade, /InstallUpgradePackage\(osClient, msgs, SaaSEnginePackageResourceName/);
  assert.equal(fs.existsSync(deletedController), false);
  assert.match(sessionRuntime, /var result = await _sysUserLogic\.Login\(param\)/);
  const smsLogin = resource.SysApiEngines.find(item => item.ApiEngineKey === 'platform_auth_sms_login');
  assert.ok(smsLogin);
  assert.match(String(smsLogin.ApiRoutes || ''), /\/api\/SysUser\/SmsLogin/i);
});
