import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const serverDirectory = path.resolve(directory, '..');
const controllerDirectory = path.join(directory, 'Controllers');
const resourceDirectory = path.join(serverDirectory, 'Microi.Upgrade', 'Resource');
const catalog = JSON.parse(fs.readFileSync(path.join(directory, 'api-ownership-catalog.json'), 'utf8'));

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
  const files = [];
  const visit = (absolute, relative) => {
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const childRelative = path.posix.join(relative, entry.name);
      const childAbsolute = path.join(absolute, entry.name);
      if (entry.isDirectory()) visit(childAbsolute, childRelative);
      else if (entry.isFile() && entry.name.endsWith('.cs')) files.push(childRelative);
    }
  };
  for (const root of catalog.SupportDirectories.Scope) {
    const absolute = path.join(directory, root);
    if (fs.existsSync(absolute)) visit(absolute, root);
  }
  return files.sort();
}

function packages() {
  return fs.readdirSync(resourceDirectory)
    .filter((name) => /^app\.microi\..+\.json$/.test(name))
    .map((name) => ({
      name,
      value: JSON.parse(fs.readFileSync(path.join(resourceDirectory, name), 'utf8')),
    }));
}

function engineIndex() {
  const result = new Map();
  for (const pkg of packages()) {
    for (const engine of pkg.value.SysApiEngines || []) {
      result.set(String(engine.ApiEngineKey).toLowerCase(), { pkg, engine });
    }
  }
  return result;
}

function routeIndex() {
  const result = new Map();
  for (const { pkg, engine } of engineIndex().values()) {
    for (const route of [engine.ApiAddress, ...String(engine.ApiRoutes || '').split(';')]) {
      if (String(route || '').trim()) result.set(String(route).trim().toLowerCase(), { pkg, engine });
    }
  }
  return result;
}

test('every remaining Controller is declared and stays in Microi.net.Api', () => {
  const discovered = controllerClasses();
  const declared = [...Object.keys(catalog.Controllers), ...Object.keys(catalog.ProtocolGateways)].sort();
  assert.deepEqual(discovered, [
    'AiController', 'ApiEngineController', 'CaptchaController', 'DiagnosticsController',
    'FormEngineController', 'HDFSController', 'LicenseController', 'MessageController', 'MicroAppController',
    'V8EngineController',
  ]);
  assert.deepEqual(declared, discovered);
  assert.deepEqual(allServerControllerClasses(), discovered);
  for (const [name, entry] of Object.entries({ ...catalog.Controllers, ...catalog.ProtocolGateways })) {
    assert.ok(entry.OwnerId, `${name} has no owner`);
    assert.notEqual(entry.Disposition, 'ManagedBusinessFacade');
  }
});

test('SSO and WorkFlow are packable class libraries without Controller sources', () => {
  assert.equal(fs.existsSync(path.join(serverDirectory, 'Microi.AspNetCore')), false);
  for (const project of ['Microi.SSO', 'Microi.WorkFlow']) {
    const root = path.join(serverDirectory, project);
    const projectSource = fs.readFileSync(path.join(root, `${project}.csproj`), 'utf8');
    assert.match(projectSource, /<TargetFramework>netstandard2\.1<\/TargetFramework>/);
    assert.match(projectSource, /<IsPackable>true<\/IsPackable>/);
    const sources = [];
    const visit = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (entry.isDirectory() && !['bin', 'obj'].includes(entry.name)) visit(path.join(current, entry.name));
        else if (entry.isFile() && entry.name.endsWith('.cs')) sources.push(fs.readFileSync(path.join(current, entry.name), 'utf8'));
      }
    };
    visit(root);
    assert.doesNotMatch(sources.join('\n'), /\bclass\s+[A-Za-z0-9_]+Controller\b/);
    assert.doesNotMatch(sources.join('\n'), /\[(?:Route|HttpGet|HttpPost|HttpPut|HttpDelete)/);
  }
});

test('every migrated Controller remains physically deleted', () => {
  const controllerSource = fs.readdirSync(controllerDirectory)
    .filter((name) => name.endsWith('.cs'))
    .map((name) => fs.readFileSync(path.join(controllerDirectory, name), 'utf8'))
    .join('\n');
  for (const controllerName of Object.keys(catalog.MigratedControllers)) {
    assert.doesNotMatch(controllerSource, new RegExp(`\\bclass\\s+${controllerName}\\b`));
    assert.equal(fs.existsSync(path.join(controllerDirectory, `${controllerName}.cs`)), false);
  }
  assert.equal(fs.existsSync(path.join(controllerDirectory, 'LegacyMobileCompatibilityController.cs')), false);
});

test('API support directories match the audited host-only boundary', () => {
  assert.deepEqual(catalog.SupportDirectories.KeepApi.slice().sort(), supportFiles());
  assert.ok(catalog.SupportDirectories.KeepApi.includes('Hosting/IdentityVerificationRuntime.cs'));
  assert.equal(fs.existsSync(path.join(directory, 'Services')), false);
});

test('SSO routes are 24 Managed HTTP engines backed by Microi.SSO', () => {
  const ssoRoot = path.join(serverDirectory, 'Microi.SSO');
  const runtimeSource = fs.readdirSync(ssoRoot)
    .filter((name) => name.startsWith('SsoProtocolRuntime') && name.endsWith('.cs'))
    .map((name) => fs.readFileSync(path.join(ssoRoot, name), 'utf8'))
    .join('\n');
  assert.match(runtimeSource, /sealed\s+partial\s+class\s+SsoProtocolRuntime/);
  const ssoPackage = packages().find((item) => item.name === 'app.microi.sso.json').value;
  const protocolEngines = ssoPackage.SysApiEngines
    .filter((engine) => String(engine.ApiEngineKey).startsWith('sso_http_'));
  assert.equal(protocolEngines.length, 24);
  for (const engine of protocolEngines) {
    assert.equal(engine.ResponseType, 'HTTP');
    assert.equal(ssoPackage.ResourcePolicies.ApiEngines[engine.ApiEngineKey].UpgradePolicy, 'Managed');
    assert.match(engine.ApiV8Code, /V8\.Method\.RunSsoProtocol/);
  }
});

test('all removed Controller routes are delivered through ApiRoutes', () => {
  const routes = routeIndex();
  const required = [
    '/api/SysMenu/GetSysMenuModel', '/api/SysMenu/GetSysMenuStep',
    '/api/SysUserAccessKey/Create', '/api/SysUserAccessKey/List',
    '/api/ExternalLogin/Begin', '/api/ExternalLogin/Callback',
    '/api/TenantSystemSettings/Save', '/api/WeChatContentSecurity/Callback',
    '/api/WeChat/BindSysUser', '/api/WorkFlow/StartWork',
    '/api/SysUser/Login', '/api/SysUser/GetCurrentUser',
    '/api/IdentityVerification/BeginPasskeyAuthentication',
    '/api/DataSourceEngine/Run', '/api/DiyChat/SendSystemMessage',
    '/api/FormEngine/GetSysConfig', '/api/HDFS/GetPrivateFileUrl',
    '/api/Ai/NL2V8EngineSync', '/api/Os/CreateQRCodeImage',
  ];
  for (const route of required) assert.ok(routes.has(route.toLowerCase()), route);
  for (const { engine } of routes.values()) {
    if (!engine.ApiRoutes) continue;
    assert.equal(new Set(String(engine.ApiRoutes).split(';').map((route) => route.toLowerCase())).size,
      String(engine.ApiRoutes).split(';').length);
  }
});

test('retained Controller prefixes allow exact migrated ApiRoutes to win', () => {
  const source = fs.readFileSync(path.join(directory, 'Handler', 'DynamicApiEngine.cs'), 'utf8');
  assert.match(source, /MigratedControllerRoutePaths/);
  for (const route of [
    '/api/formengine/getsysconfig', '/api/hdfs/getprivatefileurl',
    '/api/os/createqrcodeimage', '/api/ai/nl2v8enginesync',
  ]) assert.match(source.toLowerCase(), new RegExp(route.replaceAll('/', '\\/')));
  for (const prefix of [
    '/api/workflow/', '/api/sysuser/', '/api/identityverification/',
    '/api/externallogin/', '/api/tenantsystemsettings/', '/api/marketplacesource/',
  ]) assert.doesNotMatch(source.toLowerCase(), new RegExp(`"${prefix.replaceAll('/', '\\/')}"`));
});
