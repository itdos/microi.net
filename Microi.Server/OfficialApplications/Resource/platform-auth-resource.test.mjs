import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {readOfficialApiSource} from './official-api-source.mjs';

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
  for (const key of expected) {
    const engine = resource.SysApiEngines.find((item) => item.ApiEngineKey === key);
    const normalizeSource = value => String(value || '')
      .replace(/\r\n?/g, '\n')
      .trimEnd();
    const source = readOfficialApiSource(key);
    if (key === 'platform_auth_login_hook') {
      const notice = source.match(/\/\* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1[\s\S]*?\*\//);
      assert.ok(notice, '登录租户 Hook 必须包含官方归属提示');
      assert.equal(normalizeSource(engine.ApiV8Code), normalizeSource(`${notice[0]}\nreturn { Code : 1 };`));
    } else {
      assert.equal(normalizeSource(engine.ApiV8Code), normalizeSource(source), `${key} package code drifted`);
    }
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

test('password login remains available without automatically installing optional identity applications', () => {
  const upgrade = fs.readFileSync(path.join(directory, '../../Microi.Upgrade', '13-UpgradeAppStore.cs'), 'utf8');
  const sessionRuntime = fs.readFileSync(
    path.join(directory, '..', '..', 'Microi.net', 'Identity', 'SysUserSessionRuntime.cs'),
    'utf8'
  );
  const deletedController = path.join(
    directory, '..', '..', 'Microi.net.Api', 'Controllers', 'SysUserController.cs'
  );
  const upgradeVersion = upgrade.match(/public const string Version = "(\d+)\.(\d+)\.(\d+)\.(\d+)"/);
  assert.ok(upgradeVersion, 'UpgradeAppStore must keep a parseable four-part version gate');
  const versionParts = upgradeVersion.slice(1).map(Number);
  assert.ok(
    versionParts[0] > 6
      || (versionParts[0] === 6 && versionParts[1] > 4)
      || (versionParts[0] === 6 && versionParts[1] === 4 && versionParts[2] >= 11),
    `UpgradeAppStore version ${upgradeVersion[1]}.${upgradeVersion[2]}.${upgradeVersion[3]}.${upgradeVersion[4]} predates the identity package gate`,
  );
  assert.doesNotMatch(upgrade, /SaaSEnginePackageResourceName|SsoPackageResourceName/);
  assert.match(upgrade, /InstallUpgradePackage\(osClient, errors, BootstrapPackageResourceName/);
  assert.equal(fs.existsSync(deletedController), false);
  assert.match(sessionRuntime, /var result = await _sysUserLogic\.Login\(param\)/);
  const smsLogin = resource.SysApiEngines.find(item => item.ApiEngineKey === 'platform_auth_sms_login');
  assert.ok(smsLogin);
  assert.match(String(smsLogin.ApiRoutes || ''), /\/api\/SysUser\/SmsLogin/i);
});
