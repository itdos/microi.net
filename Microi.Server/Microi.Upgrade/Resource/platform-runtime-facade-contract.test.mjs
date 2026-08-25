import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const resource = JSON.parse(fs.readFileSync(
  path.join(directory, 'app.microi.saas-engine.json'),
  'utf8',
));

const facadeDefinitions = [
  ['platform-os-client-by-domain', 'platform-os-client-by-domain.js', 1, 'V8.Method.ResolveOsClientByDomain'],
  ['platform-sys-config', 'platform-sys-config.js', 1, 'V8.Method.GetPublicSysConfig'],
  ['platform-lang-bundle', 'platform-lang-bundle.js', 1, 'V8.Method.GetLangBundle'],
  ['platform-current-user', 'platform-current-user.js', 0, 'V8.CurrentUser'],
  ['platform-private-file-url', 'platform-private-file-url.js', 0, 'V8.Method.GetAuthorizedPrivateFileUrl'],
  ['platform-sys-user-public-info', 'platform-sys-user-public-info.js', 0, "GetTableData('sys_user'"],
  ['platform-login-wallpapers', 'platform-login-wallpapers.js', 1, 'V8.Method.GetLoginWallpapers'],
];

function stripGeneratedNotice(value) {
  return String(value || '')
    .replace(/^\/\* OFFICIAL_(?:MANAGED|CREATE_IF_MISSING)_API_ENGINE_NOTICE_V1[\s\S]*?\*\/(?:\r?\n)*/, '')
    .replace(/\r\n?/g, '\n')
    .trimEnd();
}

test('SaaS package carries the client runtime facades and one tenant hook', () => {
  assert.equal(resource.PackageInfo.Version, 'v7.6.13');
  for (const [key, fileName, allowAnonymous, atom] of facadeDefinitions) {
    const engine = resource.SysApiEngines.find(item => item.ApiEngineKey === key);
    assert.ok(engine, `missing ${key}`);
    assert.equal(engine.ApiAddress, `/apiengine/${key}`);
    assert.equal(engine.AllowAnonymous, allowAnonymous);
    assert.equal(engine.StopHttp, 0);
    assert.deepEqual(resource.ResourcePolicies.ApiEngines[key], {
      Ownership: 'Platform',
      UpgradePolicy: 'Managed',
    });
    assert.match(engine.ApiV8Code, new RegExp(atom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    if (allowAnonymous) {
      assert.doesNotMatch(
        engine.ApiV8Code,
        /platform-runtime-custom-hook/,
        `${key} must not let anonymous callers execute tenant-owned code`,
      );
    } else {
      assert.match(engine.ApiV8Code, /platform-runtime-custom-hook/);
    }
    const canonical = fs.readFileSync(path.join(directory, fileName), 'utf8');
    assert.equal(stripGeneratedNotice(engine.ApiV8Code), stripGeneratedNotice(canonical));
  }

  const hook = resource.SysApiEngines.find(
    item => item.ApiEngineKey === 'platform-runtime-custom-hook',
  );
  assert.ok(hook);
  assert.equal(hook.StopHttp, 1);
  assert.equal(hook.AllowAnonymous, 0);
  assert.deepEqual(resource.ResourcePolicies.ApiEngines[hook.ApiEngineKey], {
    Ownership: 'Tenant',
    UpgradePolicy: 'CreateIfMissing',
  });
  assert.match(hook.ApiV8Code, /return \{ Code : 1 \};\s*$/);
});

test('public user directory is bounded and returns only the public projection', () => {
  const engine = resource.SysApiEngines.find(
    item => item.ApiEngineKey === 'platform-sys-user-public-info',
  );
  assert.match(engine.ApiV8Code, /_PageSize:\s*numberInRange\(param\._PageSize, 15, 1, 100\)/);
  assert.match(engine.ApiV8Code, /_PageIndex:\s*numberInRange\(param\._PageIndex, 1, 1, 1000\)/);
  assert.match(engine.ApiV8Code, /keyword\.length > 200/);
  assert.match(engine.ApiV8Code, /copyList\(param\.Ids, 100\)/);
  assert.match(engine.ApiV8Code, /Id:\s*text\(row\.Id\)/);
  assert.match(engine.ApiV8Code, /Name:\s*text\(row\.Name\)/);
  assert.match(engine.ApiV8Code, /Avatar:\s*text\(row\.Avatar\)/);
  assert.doesNotMatch(engine.ApiV8Code, /Password|Pwd|Phone|Email|DiyToken/);
});

test('trusted Core atoms are ApiEngineKey-bound and do not expose a generic tenant override', () => {
  const coreSource = fs.readFileSync(path.resolve(
    directory,
    '..', '..',
    'Microi.Core',
    'V8Engine', 'Runtime',
    'V8Method.PlatformRuntimeFacade.cs',
  ), 'utf8');
  for (const key of facadeDefinitions.map(item => item[0])) {
    if (key === 'platform-current-user') continue;
    if (key === 'platform-sys-user-public-info') continue;
    assert.match(coreSource, new RegExp(`"${key}"`));
  }
  assert.match(coreSource, /RequireTrustedApiEngine\(PlatformOsClientByDomainEngineKey\)/);
  assert.match(coreSource, /RequireTrustedApiEngine\(PlatformSysConfigEngineKey\)/);
  assert.match(coreSource, /RequireTrustedApiEngine\(PlatformLangBundleEngineKey\)/);
  assert.match(coreSource, /RequireTrustedApiEngine\(PlatformLoginWallpapersEngineKey\)/);
  assert.match(coreSource, /RequireTrustedApiEngine\(PlatformPrivateFileUrlEngineKey\)/);
  assert.match(coreSource, /CreatePublicSysConfigProjection/);
  assert.match(coreSource, /PrivateFileAccessAuthorization\.AuthorizeAsync/);
  assert.doesNotMatch(coreSource, /dynamicParam[^\n]*OsClient/);
});

test('login wallpaper facade uses only the bounded trusted projection atom', () => {
  const engine = resource.SysApiEngines.find(
    item => item.ApiEngineKey === 'platform-login-wallpapers',
  );
  assert.equal(engine.Version, 'v1.1.0');
  assert.match(engine.ApiV8Code, /return V8\.Method\.GetLoginWallpapers\(\);/);
  assert.doesNotMatch(engine.ApiV8Code, /GetTableDataAnonymous|GetTableData\(|V8\.Db|platform-runtime-custom-hook/);

  const coreSource = fs.readFileSync(path.resolve(
    directory,
    '..', '..',
    'Microi.Core',
    'V8Engine', 'Runtime',
    'V8Method.PlatformRuntimeFacade.cs',
  ), 'utf8');
  assert.match(coreSource, /\.Select\(id, name, category, imgUrl\)/);
  assert.match(coreSource, /isEnable == 1/);
  assert.match(coreSource, /isDeleted != 1/);
  assert.match(coreSource, /\.OrderBy\(createTime\.Desc\)/);
  assert.match(coreSource, /\.Top\(200\)/);
  assert.doesNotMatch(coreSource, /IsAnonymousRead\s*=/);
});
