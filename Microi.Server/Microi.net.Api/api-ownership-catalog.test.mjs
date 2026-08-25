import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const controllerDirectory = path.join(directory, 'Controllers');
const catalog = JSON.parse(fs.readFileSync(path.join(directory, 'api-ownership-catalog.json'), 'utf8'));

function controllerClasses() {
  const classes = new Set();
  for (const file of fs.readdirSync(controllerDirectory).filter((name) => name.endsWith('.cs'))) {
    const source = fs.readFileSync(path.join(controllerDirectory, file), 'utf8');
    for (const match of source.matchAll(/\bclass\s+([A-Za-z0-9_]+Controller)\b/g)) classes.add(match[1]);
  }
  return [...classes].sort();
}

function supportFiles() {
  const roots = catalog.SupportDirectories.Scope;
  const files = [];
  const visit = (absolute, relative) => {
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const childRelative = path.posix.join(relative, entry.name);
      const childAbsolute = path.join(absolute, entry.name);
      if (entry.isDirectory()) visit(childAbsolute, childRelative);
      else if (entry.isFile() && entry.name.endsWith('.cs')) files.push(childRelative);
    }
  };
  for (const root of roots) visit(path.join(directory, root), root);
  return files.sort();
}

function csharpMethodBody(source, methodName) {
  const match = new RegExp(`public\\s+async\\s+Task<JsonResult>\\s+${methodName}\\s*\\(`).exec(source);
  assert.ok(match, `${methodName} method was not found`);
  const bodyStart = source.indexOf('{', match.index);
  assert.ok(bodyStart >= 0, `${methodName} body was not found`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index++) {
    if (source[index] === '{') depth++;
    if (source[index] === '}' && --depth === 0) return source.slice(bodyStart, index + 1);
  }
  assert.fail(`${methodName} body is not balanced`);
}

test('every native Controller has an explicit owner and disposition', () => {
  const discovered = controllerClasses();
  const declared = Object.keys(catalog.Controllers).sort();
  assert.deepEqual(declared, discovered);
  const validDispositions = new Set(Object.keys(catalog.Dispositions));
  for (const [name, entry] of Object.entries(catalog.Controllers)) {
    assert.ok(entry.OwnerId, `${name} has no owner`);
    assert.ok(['Application', 'HostKernel'].includes(entry.OwnerType), `${name} owner type is invalid`);
    assert.ok(validDispositions.has(entry.Disposition), `${name} disposition is invalid`);
  }
});

test('every support-directory C# file has an explicit audited API boundary', () => {
  assert.deepEqual(
    catalog.SupportDirectories.KeepApi.slice().sort(),
    supportFiles(),
  );
  for (const [source, migration] of Object.entries(catalog.MigratedSupportCode)) {
    assert.ok(['MovedCore', 'Deleted'].includes(migration.Disposition), `${source} disposition is invalid`);
    assert.equal(fs.existsSync(path.join(directory, source)), false, `${source} must not remain in API`);
    if (migration.Disposition === 'MovedCore') {
      assert.ok(migration.Target?.startsWith('Microi.Core/'), `${source} must identify its Core target`);
      assert.equal(
        fs.existsSync(path.resolve(directory, '..', migration.Target)),
        true,
        `${source} Core target is missing`,
      );
    }
  }
});

test('SSO native business actions stay deleted and the package owns orchestration', () => {
  const ssoFiles = fs.readdirSync(controllerDirectory)
    .filter((name) => name.startsWith('SsoController') && name.endsWith('.cs'))
    .map((name) => fs.readFileSync(path.join(controllerDirectory, name), 'utf8'))
    .join('\n');
  const userSource = fs.readFileSync(path.join(controllerDirectory, 'SysUserController.cs'), 'utf8');
  for (const action of ['Capabilities', 'LegacyCapabilities', 'CompleteLogin', 'RotateClientSecret']) {
    assert.doesNotMatch(ssoFiles, new RegExp(`public\\s+(?:async\\s+)?[^\\n]+\\s${action}\\s*\\(`));
  }
  assert.doesNotMatch(userSource, /\bSsoPengrui\s*\(/);
  assert.equal(catalog.ActionOverrides.SsoController.ManagedApiEngines.length, 11);
});

test('password login remains an application-independent bootstrap boundary', () => {
  const login = catalog.ActionOverrides['SysUserController.Login'];
  assert.equal(login.Disposition, 'BootstrapIdentity');
  assert.match(login.Reason, /尚未安装应用/);
});

test('five SysUser business actions are fixed Managed compatibility forwards', () => {
  const controllerSource = fs.readFileSync(path.join(controllerDirectory, 'SysUserController.cs'), 'utf8');
  const engineSource = fs.readFileSync(
    path.resolve(directory, '../Microi.Upgrade/Resource/platform-sys-user-admin.js'),
    'utf8',
  );
  const actions = ['AddSysUser', 'UptSysUser', 'DelSysUser', 'GetSysUser', 'RefreshLoginUser'];

  assert.match(controllerSource, /SysUserAdminApiEngineKey\s*=\s*"platform-sys-user-admin"/);
  for (const action of actions) {
    const entry = catalog.ActionOverrides[`SysUserController.${action}`];
    assert.ok(entry, `${action} has no action ownership entry`);
    assert.equal(entry.Target, 'app.microi.sys_user ApiEngine:platform-sys-user-admin');
    assert.equal(entry.TenantHook, 'ApiEngine:platform-user-custom-hook');
    assert.ok(entry.NativeBoundary.length > 0, `${action} has no trusted native boundary`);
    assert.match(entry.CompatibilityExitGate, /连续两个正式版本遥测为零/);

    const body = csharpMethodBody(controllerSource, action);
    assert.match(body, new RegExp(`RunSysUserAdminCompatibilityAsync\\(\\s*"${action}"`));
    assert.doesNotMatch(body, /_sysUserLogic|FormEngine|SysUserManagementSecurity/);
    assert.match(engineSource, new RegExp(`${action}: true`));
  }

  assert.match(engineSource, /^\/\* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1/);
  assert.match(engineSource, /V8\.Method\.ManageSysUserAdmin/);
  assert.match(engineSource, /V8\.ApiEngine\.Run\("platform-user-custom-hook"/);
  const hookBody = engineSource.slice(
    engineSource.indexOf('function runHook'),
    engineSource.indexOf('var action ='),
  );
  assert.match(hookBody, /Stage:[\s\S]*Action:[\s\S]*TargetUserId:[\s\S]*SourceApiEngineKey:/);
  assert.doesNotMatch(hookBody, /Pwd|Password|Token|Phone|Email|Avatar|RoleIds|DeptIds/);
});

test('legacy platform facades have fixed Managed targets and measurable exit gates', () => {
  const expectedTargets = {
    'OsController.GetOsClientByDomain': 'platform-os-client-by-domain',
    'FormEngineController.GetSysConfig': 'platform-sys-config',
    'FormEngineController.GetSysConfig_Compat': 'platform-sys-config',
    'FormEngineController.GetLangBundle': 'platform-lang-bundle',
    'FormEngineController.GetLoginWallpapers': 'platform-login-wallpapers',
    'SysUserController.GetCurrentUser': 'platform-current-user',
    'SysUserController.GetSysUserPublicInfo': 'platform-sys-user-public-info',
    'HDFSController.GetPrivateFileUrl': 'platform-private-file-url',
    'HDFSController.MallFileUrl': 'platform-private-file-url'
  };
  for (const [action, engineKey] of Object.entries(expectedTargets)) {
    const entry = catalog.ActionOverrides[action];
    assert.ok(entry, `${action} has no ownership override`);
    assert.match(entry.Target, new RegExp(`ApiEngine:${engineKey}$`));
    assert.match(entry.CompatibilityExitGate, /连续两个正式版本遥测为零/);
    assert.ok(entry.CompatibilityRoutes.length > 0);
  }
  assert.equal(catalog.ActionOverrides['HDFSController.GetPrivateFileUrl'].AccessKeyScope, 'file:read');
  assert.match(catalog.ActionOverrides['SysUserController.GetCurrentUser'].AccessKeyPolicy, /自省/);
});

test('second-stage business facades have one official owner and a tenant hook', () => {
  const expectedTargets = {
    'SysUserController.CreateTenant': 'app.microi.saas-engine ApiEngine:platform-create-tenant',
    'SysUserController.UpdateCurrentProfile': 'app.microi.sys_user ApiEngine:platform-user-update-profile',
    'SysUserController.UpdateMyDefaultIndexUrl': 'app.microi.sys_user ApiEngine:platform-user-update-preferences',
    'TenantSystemSettingsController.ListSaveDelete': 'app.microi.sys-config ApiEngine:platform-tenant-system-settings',
    'AiController.PlatformAccountCompatibilityActions': 'app.microi.ai-engine ApiEngine:platform-ai-account',
    'AiController.PlatformRuntimeCompatibilityActions': 'app.microi.ai-engine ApiEngine:platform-ai-runtime',
    'ExternalLoginController.BindingActions': 'app.microi.saas-engine ApiEngine:platform-external-login-binding',
    'WeChatController.BindSysUser': 'app.microi.saas-engine ApiEngine:platform-wechat-user-binding',
    'DiyChatController.SendSystemMessage': 'app.microi.message-notification ApiEngine:platform-chat-system-message',
    'DiyWebSocket.OrdinaryChatActions': 'app.microi.message-notification ApiEngine:platform-chat-runtime',
    'MarketplaceSourceController.SourceActions': 'app.microi.store ApiEngine:platform-marketplace-source'
  };

  for (const [action, target] of Object.entries(expectedTargets)) {
    const entry = catalog.ActionOverrides[action];
    assert.ok(entry, `${action} has no ownership override`);
    assert.equal(entry.Target, target);
    assert.match(entry.TenantHook, /^ApiEngine:platform-[a-z0-9-]+-hook$/);
    assert.ok(entry.NativeBoundary.length > 0, `${action} has no explicit native boundary`);
  }

  assert.equal(catalog.Controllers.TenantSystemSettingsController.OwnerId, 'app.microi.sys-config');
});

test('DiyWebSocket keeps only authenticated realtime/AI protocol boundaries', () => {
  const source = fs.readFileSync(path.join(
    directory,
    'Handler',
    'DiyWebSocket.cs',
  ), 'utf8');
  assert.match(source, /ChatRuntimeApiEngineKey = "platform-chat-runtime"/);
  assert.match(source, /UserAccessKeySecurity\.IsSession\(currentUser\)/);
  assert.match(source, /ManagedApiEngineCompatibility\.RunTrustedProtocolAsync\(/);
  assert.match(source, /ReceiveAIChunk/);
  assert.doesNotMatch(source, /TMongodbHelper|MicroiEngine\.FormEngine|GetChatHost|GetContactHost/);
});
