import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const serverDirectory = path.resolve(directory, '..');
const controllerDirectory = path.join(directory, 'Controllers');
const legacyControllerPath = path.join(controllerDirectory, 'LegacyMobileCompatibilityController.cs');
const catalog = JSON.parse(fs.readFileSync(path.join(directory, 'api-ownership-catalog.json'), 'utf8'));

function protocolSource(entry) {
  return path.join(serverDirectory, entry.Project, ...entry.Source.split('/'));
}

function controllerClasses(root = controllerDirectory) {
  const classes = new Set();
  for (const file of fs.readdirSync(root).filter((name) => name.endsWith('.cs'))) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of source.matchAll(/\bclass\s+([A-Za-z0-9_]+Controller)\b/g)) classes.add(match[1]);
  }
  return [...classes].sort();
}

function allServerControllerClasses() {
  const classes = new Set();
  const visit = (root) => {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (entry.isDirectory() && ['.git', 'bin', 'obj'].includes(entry.name)) continue;
      const absolute = path.join(root, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name.endsWith('.cs')) {
        const source = fs.readFileSync(absolute, 'utf8');
        for (const match of source.matchAll(/\bclass\s+([A-Za-z0-9_]+Controller)\b/g)) {
          classes.add(match[1]);
        }
      }
    }
  };
  visit(serverDirectory);
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
  for (const root of roots) {
    const absolute = path.join(directory, root);
    if (fs.existsSync(absolute)) visit(absolute, root);
  }
  return files.sort();
}

function csharpMethodBody(source, methodName) {
  const match = new RegExp(`public\\s+(?:async\\s+)?Task<JsonResult>\\s+${methodName}\\s*\\(`).exec(source);
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
  const declared = [...Object.keys(catalog.Controllers), ...Object.keys(catalog.ProtocolGateways)].sort();
  assert.deepEqual(declared, discovered);
  const validDispositions = new Set(Object.keys(catalog.Dispositions));
  for (const [name, entry] of Object.entries({ ...catalog.Controllers, ...catalog.ProtocolGateways })) {
    assert.ok(entry.OwnerId, `${name} has no owner`);
    assert.ok(['Application', 'HostKernel', 'Compatibility'].includes(entry.OwnerType), `${name} owner type is invalid`);
    assert.ok(validDispositions.has(entry.Disposition), `${name} disposition is invalid`);
    assert.notEqual(
      entry.Disposition,
      'ManagedBusinessFacade',
      `${name} 已整体迁入接口引擎时必须删除旧 Controller，不能继续留在 API 目录`,
    );
  }
});

test('all Controller sources stay in Microi.net.Api and class libraries keep their original target frameworks', () => {
  assert.equal(fs.existsSync(path.join(serverDirectory, 'Microi.AspNetCore')), false);
  assert.equal(fs.existsSync(path.join(serverDirectory, 'Microi.SSO')), false);
  assert.deepEqual(
    [...Object.keys(catalog.Controllers), ...Object.keys(catalog.ProtocolGateways)].sort(),
    allServerControllerClasses(),
    '所有 Controller 源码必须只存在于 Microi.net.Api/Controllers，并在归属清单中声明用途',
  );
  for (const [name, entry] of Object.entries(catalog.ProtocolGateways)) {
    assert.equal(entry.Project, 'Microi.net.Api', `${name} Controller source must remain in Microi.net.Api`);
    assert.match(entry.Source, /^Controllers\//, `${name} must live under the API Controllers directory`);
    assert.ok(entry.Source, `${name} has no source path`);
    const sourcePath = protocolSource(entry);
    assert.equal(fs.existsSync(sourcePath), true, `${name} source is missing: ${sourcePath}`);
    assert.match(
      fs.readFileSync(sourcePath, 'utf8'),
      new RegExp(`\\bclass\\s+${name}\\b`),
      `${name} source does not declare its gateway`,
    );
  }
  assert.equal(catalog.SupportDirectories.TargetProject, 'Microi.net.Api');
  const hostSource = fs.readFileSync(path.join(directory, 'Hosting', 'MicroiApiHostExtensions.cs'), 'utf8');
  assert.doesNotMatch(hostSource, /AddApplicationPart\(/);
  for (const project of ['Microi.net', 'Microi.AI', 'Microi.Captcha', 'Microi.WeChat']) {
    const projectFile = fs.readFileSync(path.join(serverDirectory, project, `${project}.csproj`), 'utf8');
    assert.doesNotMatch(projectFile, /netstandard2\.1\s*;\s*net10\.0/);
    assert.doesNotMatch(projectFile, /Hosting[\\/]AspNetCore/);
  }
  assert.doesNotMatch(
    fs.readFileSync(path.join(serverDirectory, 'Microi.net.sln'), 'utf8')
      + fs.readFileSync(path.join(directory, 'Microi.net.Api.csproj'), 'utf8'),
    /Microi\.AspNetCore/,
  );
});

test('every migrated or merged Controller remains physically deleted', () => {
  const controllerSources = fs.readdirSync(controllerDirectory)
    .filter((name) => name.endsWith('.cs'))
    .map((name) => fs.readFileSync(path.join(controllerDirectory, name), 'utf8'))
    .join('\n');
  for (const controllerName of Object.keys(catalog.MigratedControllers)) {
    assert.doesNotMatch(
      controllerSources,
      new RegExp(`\\bclass\\s+${controllerName}\\b`),
      `${controllerName} 已迁移或合并，不得重新出现在 Microi.net.Api/Controllers`,
    );
    assert.equal(
      fs.existsSync(path.join(controllerDirectory, `${controllerName}.cs`)),
      false,
      `${controllerName}.cs 已迁移或合并，旧文件必须物理删除`,
    );
  }
});

test('every support-directory C# file has an explicit audited API boundary', () => {
  assert.deepEqual(
    catalog.SupportDirectories.KeepApi.slice().sort(),
    supportFiles(),
  );
  for (const [source, migration] of Object.entries(catalog.MigratedSupportCode)) {
    assert.ok(
      ['MovedCore', 'MovedLibrary', 'MovedPlugin', 'MovedTransport', 'MovedUpgrade', 'Deleted']
        .includes(migration.Disposition),
      `${source} disposition is invalid`,
    );
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

test('SSO native business actions stay deleted while its thin protocol gateway remains in API', () => {
  const apiSsoFiles = fs.readdirSync(controllerDirectory)
    .filter((name) => name.startsWith('SsoController') && name.endsWith('.cs'));
  assert.deepEqual(apiSsoFiles, [], '旧 SsoController 已拆分，不能恢复其可迁移业务动作');

  const ssoFiles = fs.readdirSync(controllerDirectory)
    .filter((name) => name.startsWith('SsoProtocolGatewayController') && name.endsWith('.cs'))
    .map((name) => fs.readFileSync(path.join(controllerDirectory, name), 'utf8'))
    .join('\n');
  const userSource = fs.readFileSync(protocolSource(catalog.ProtocolGateways.SysUserController), 'utf8');
  assert.match(ssoFiles, /class\s+SsoProtocolGatewayController\s*:\s*Controller/);
  assert.match(ssoFiles, /\[Route\("api\/Sso\/\[action\]"\)\]/);
  assert.doesNotMatch(ssoFiles, /ServiceFilter\(typeof\(DiyFilter/);
  for (const action of ['Capabilities', 'LegacyCapabilities', 'CompleteLogin', 'RotateClientSecret']) {
    assert.doesNotMatch(ssoFiles, new RegExp(`public\\s+(?:async\\s+)?[^\\n]+\\s${action}\\s*\\(`));
  }
  assert.doesNotMatch(userSource, /\bSsoPengrui\s*\(/);
  assert.equal(catalog.ProtocolGateways.SsoProtocolGatewayController.Project, 'Microi.net.Api');
  assert.equal(catalog.ActionOverrides.SsoProtocolGatewayController.ManagedApiEngines.length, 11);
  assert.match(csharpMethodBody(ssoFiles, 'CompleteAuthorization'), /RequireUserTokenAsync\(\)/);
});

test('password login remains an application-independent bootstrap boundary', () => {
  const login = catalog.ActionOverrides['SysUserController.Login'];
  assert.equal(login.Disposition, 'BootstrapIdentity');
  assert.match(login.Reason, /尚未安装应用/);
});

test('five SysUser business actions are fixed Managed compatibility forwards', () => {
  const controllerSource = fs.readFileSync(
    legacyControllerPath,
    'utf8',
  );
  const engineSource = fs.readFileSync(
    path.resolve(directory, '../Microi.Upgrade/Resource/platform-sys-user-admin.js'),
    'utf8',
  );
  const actions = ['AddSysUser', 'UptSysUser', 'DelSysUser', 'GetSysUser', 'RefreshLoginUser'];

  assert.match(controllerSource, /SysUserAdminApiEngineKey\s*=\s*"platform-sys-user-admin"/);
  for (const action of actions) {
    const entry = catalog.ActionOverrides[`LegacyMobileCompatibilityController.${action}`];
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
    'LegacyMobileCompatibilityController.GetOsClientByDomain': 'platform-os-client-by-domain',
    'LegacyMobileCompatibilityController.GetSysConfig': 'platform-sys-config',
    'LegacyMobileCompatibilityController.GetLangBundle': 'platform-lang-bundle',
    'LegacyMobileCompatibilityController.GetLoginWallpapers': 'platform-login-wallpapers',
    'LegacyMobileCompatibilityController.GetCurrentUser': 'platform-current-user',
    'LegacyMobileCompatibilityController.GetSysUserPublicInfo': 'platform-sys-user-public-info',
    'LegacyMobileCompatibilityController.GetPrivateFileUrl': 'platform-private-file-url'
  };
  for (const [action, engineKey] of Object.entries(expectedTargets)) {
    const entry = catalog.ActionOverrides[action];
    assert.ok(entry, `${action} has no ownership override`);
    assert.match(entry.Target, new RegExp(`ApiEngine:${engineKey}$`));
    assert.match(entry.CompatibilityExitGate, /连续两个正式版本遥测为零/);
    assert.ok(entry.CompatibilityRoutes.length > 0);
  }
  assert.equal(
    catalog.ActionOverrides['LegacyMobileCompatibilityController.GetPrivateFileUrl'].AccessKeyScope,
    'file:read',
  );
  assert.match(
    catalog.ActionOverrides['LegacyMobileCompatibilityController.GetCurrentUser'].AccessKeyPolicy,
    /自省/,
  );
});

test('second-stage business facades have one official owner and a tenant hook', () => {
  const expectedTargets = {
    'LegacyMobileCompatibilityController.CreateTenant': 'app.microi.saas-engine ApiEngine:platform-create-tenant',
    'LegacyMobileCompatibilityController.UpdateCurrentProfile': 'app.microi.sys_user ApiEngine:platform-user-update-profile',
    'LegacyMobileCompatibilityController.UpdateMyDefaultIndexUrl': 'app.microi.sys_user ApiEngine:platform-user-update-preferences',
    'LegacyMobileCompatibilityController.TenantSystemSettingsCompatibilityActions': 'app.microi.sys-config ApiEngine:platform-tenant-system-settings',
    'LegacyMobileCompatibilityController.AiPlatformAccountCompatibilityActions': 'app.microi.ai-engine ApiEngine:platform-ai-account',
    'LegacyMobileCompatibilityController.AiPlatformRuntimeCompatibilityActions': 'app.microi.ai-engine ApiEngine:platform-ai-runtime',
    'ExternalLoginController.BindingActions': 'app.microi.saas-engine ApiEngine:platform-external-login-binding',
    'WeChatController.BindSysUser': 'app.microi.saas-engine ApiEngine:platform-wechat-user-binding',
    'LegacyMobileCompatibilityController.SendSystemMessage': 'app.microi.message-notification ApiEngine:platform-chat-system-message',
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

  assert.equal(catalog.ProtocolGateways.TenantSystemSettingsController.OwnerId, 'app.microi.sys-config');
});

test('migrated AI and tenant-setting JSON actions exist only in the unified compatibility Controller', () => {
  const legacySource = fs.readFileSync(legacyControllerPath, 'utf8');
  const aiSource = fs.readFileSync(protocolSource(catalog.ProtocolGateways.AiController), 'utf8');
  const tenantSource = fs.readFileSync(
    protocolSource(catalog.ProtocolGateways.TenantSystemSettingsController),
    'utf8',
  );
  const groupedKeys = [
    'LegacyMobileCompatibilityController.AiPlatformAccountCompatibilityActions',
    'LegacyMobileCompatibilityController.AiPlatformRuntimeCompatibilityActions',
    'LegacyMobileCompatibilityController.TenantSystemSettingsCompatibilityActions',
  ];

  for (const key of groupedKeys) {
    for (const route of catalog.ActionOverrides[key].CompatibilityRoutes) {
      assert.match(legacySource, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      const action = route.split('/').at(-1);
      const oldSource = route.startsWith('/api/Ai/') ? aiSource : tenantSource;
      assert.doesNotMatch(
        oldSource,
        new RegExp(`public\\s+(?:async\\s+)?[^\\n]+\\s${action}\\s*\\(`),
        `${route} 已迁入接口引擎，只能由统一兼容 Controller 保留旧地址`,
      );
    }
  }

  for (const nativeAction of ['ChatStream', 'NL2V8Engine', 'SubAlipayNotify', 'OpenAIChatCompletions']) {
    assert.match(aiSource, new RegExp(`public\\s+(?:async\\s+)?[^\\n]+\\s${nativeAction}\\s*\\(`));
  }
  for (const nativeAction of ['Save', 'Reveal', 'GetRevealChallenge', 'GetMapRuntime']) {
    assert.match(tenantSource, new RegExp(`public\\s+(?:async\\s+)?[^\\n]+\\s${nativeAction}\\s*\\(`));
  }
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
