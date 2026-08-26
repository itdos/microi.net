import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const resourceDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(resourceDir, '..', '..', '..');
const clientRoot = path.join(workspaceRoot, 'Microi.Client', 'src');
const packageNames = [
  'app.microi.form-engine.json',
  'app.microi.module-engine.json',
  'app.microi.saas-engine.json',
  'app.microi.sso.json',
  'app.microi.store.json',
  'app.microi.sys_user.json',
  'app.microi.sys-config.json',
  'app.microi.message-notification.json',
  'app.microi.ai-engine.json',
];
const packages = packageNames.map(name => JSON.parse(
  fs.readFileSync(path.join(resourceDir, name), 'utf8'),
));
const engines = packages.flatMap(packageModel => packageModel.SysApiEngines || []);
const keys = new Set(engines.map(engine => String(engine.ApiEngineKey || '').toLowerCase()));
const addresses = new Set(engines.map(engine => String(engine.ApiAddress || '').toLowerCase()));

function sourceFiles(root) {
  const result = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (['.git', 'dist', 'node_modules'].includes(entry.name)) continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...sourceFiles(fullPath));
    else if (/\.(?:vue|[cm]?[jt]sx?)$/i.test(entry.name)) result.push(fullPath);
  }
  return result;
}

test('all relative ApiEngine routes used by the official PC client are delivered by the nine embedded packages', () => {
  const missing = [];
  for (const filePath of sourceFiles(clientRoot)) {
    // Absolute third-party/official-source examples are not served by the current
    // tenant and therefore must not be mistaken for local runtime dependencies.
    const source = fs.readFileSync(filePath, 'utf8')
      .replace(/https?:\/\/[^"'\`\s)]+/gi, '');
    for (const match of source.matchAll(/\/apiengine\/[A-Za-z0-9._-]+/g)) {
      const address = match[0].replace(/--OsClient--.*$/i, '').toLowerCase();
      if (!addresses.has(address)) {
        missing.push(`${path.relative(workspaceRoot, filePath)} -> ${match[0]}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test('all literal official-package ApiEngine dependencies are inside the same nine-package closure', () => {
  const missing = [];
  for (const packageModel of packages) {
    const appName = packageModel.PackageInfo?.Name || 'unknown';
    for (const engine of packageModel.SysApiEngines || []) {
      const code = String(engine.ApiV8Code || '');
      for (const match of code.matchAll(/V8\.ApiEngine\.Run\(\s*['"]([^'"]+)['"]/g)) {
        const dependency = match[1].split('@')[0].trim().toLowerCase();
        if (!keys.has(dependency)) {
          missing.push(`${appName}:${engine.ApiEngineKey} -> ${match[1]}`);
        }
      }
    }
  }
  assert.deepEqual(missing, []);
});

test('every ApiEngine target in the removed-controller ownership catalog is package-delivered', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(
    workspaceRoot,
    'Microi.Server',
    'Microi.net.Api',
    'api-ownership-catalog.json',
  ), 'utf8'));
  const missing = Object.entries(catalog)
    .filter(([, entry]) => String(entry?.Target || '').startsWith('ApiEngine:'))
    .map(([controller, entry]) => ({
      controller,
      key: String(entry.Target).substring('ApiEngine:'.length),
    }))
    .filter(item => !keys.has(item.key.toLowerCase()));
  assert.deepEqual(missing, []);
});

test('the incident routes and their customization hooks are immutable package contracts', () => {
  for (const key of [
    'platform-sys-config',
    'platform-sys-menu',
    'platform-current-user',
    'platform-service-health',
    'platform-private-file-url',
    'platform-sys-dept',
    'platform-online-terminal',
    'platform-cache-manager',
    'mci-module-presentation-stats',
    'mci-system-observability-query',
    'get-microi-store-legacy-route',
    'wechat_send_tpl_msg',
  ]) {
    assert.ok(keys.has(key), key);
  }
  assert.ok(addresses.has('/apiengine/get-microi-store'));
  for (const key of [
    'platform-online-terminal',
    'platform-cache-manager',
    'mci-system-observability-query',
  ]) {
    const engine = engines.find(item => item.ApiEngineKey === key);
    assert.match(String(engine.ApiV8Code), /platform-runtime-custom-hook/);
  }
  assert.match(
    String(engines.find(item => item.ApiEngineKey === 'platform-sys-menu').ApiV8Code),
    /platform-marketplace-source-hook/,
  );
  assert.match(
    String(engines.find(item => item.ApiEngineKey === 'wechat_send_tpl_msg').ApiV8Code),
    /platform-message-notification-custom-hook/,
  );
});
