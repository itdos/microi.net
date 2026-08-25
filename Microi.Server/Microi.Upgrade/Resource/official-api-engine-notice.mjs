import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resourceRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(resourceRoot, '..', '..', '..');
const managedNoticeStart = '/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1';
const tenantNoticeStart = '/* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1';

const packageFiles = Object.freeze([
  'app.microi.form-engine.json',
  'app.microi.module-engine.json',
  'app.microi.saas-engine.json',
  'app.microi.sso.json',
  'app.microi.store.json',
  'app.microi.sys_user.json',
  'app.microi.sys-config.json',
  'app.microi.message-notification.json',
  'app.microi.ai-engine.json',
]);

const storeSourceFiles = Object.freeze({
  'import-microi-store-package': 'import-package.js',
  'bulk-import-microi-store-packages': 'bulk-import-packages.js',
  'get-microi-store': 'get-microi-store-list.js',
  'get-microi-store-model': 'get-microi-store-model.js',
  'get-microi-store-versions': 'get-microi-store-versions.js',
  'platform-background-task': 'platform-background-task.js',
  'platform-sys-menu': 'platform-sys-menu.js',
  'platform-marketplace-source': 'platform-marketplace-source.js',
  'platform-marketplace-source-hook': 'platform-marketplace-source-hook.js',
  'ai_app_publish_store': 'ai-app-publish-store.js',
  'ai_app_create': 'ai-app-create.js',
  'ai_app_prepare_store_assets': 'ai-app-prepare-store-assets.js',
  'ai_app_build': 'ai-app-build.js',
});

function stripOfficialNotice(source) {
  return String(source || '')
    .replace(/^\/\* OFFICIAL_(?:MANAGED|CREATE_IF_MISSING)_API_ENGINE_NOTICE_V1[\s\S]*?\*\/(?:\r?\n)*/, '')
    .trimStart();
}

function normalizeSource(source) {
  return String(source || '').replace(/\r\n?/g, '\n').trimEnd();
}

function collectCanonicalSourceFiles(root) {
  const files = [];
  if (!fs.existsSync(root)) return files;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'bin' || entry.name === 'obj') continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...collectCanonicalSourceFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
  }
  return files;
}

let cachedCanonicalSourceIndex;
function getCanonicalSourceIndex() {
  if (cachedCanonicalSourceIndex) return cachedCanonicalSourceIndex;
  const files = [
    ...collectCanonicalSourceFiles(path.join(
      workspaceRoot,
      'Microi-V8-Engine',
      'Microi吾码 (api.itdos.com)',
      'iTdos.Product.Internal',
      '接口引擎',
    )),
    ...fs.readdirSync(resourceRoot, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
      .map(entry => path.join(resourceRoot, entry.name)),
  ];
  const index = new Map();
  for (const sourcePath of files) {
    const rawSource = fs.readFileSync(sourcePath, 'utf8');
    const match = rawSource.match(/(?:ApiEngineKey|Microi官方接口引擎)\s*[:：]\s*([^\s*]+)/m);
    const key = String(match?.[1] || '').trim();
    if (!key) continue;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push({ sourcePath, rawSource });
  }
  cachedCanonicalSourceIndex = index;
  return index;
}

function synchronizeCanonicalSources(engine, appName, policy) {
  const key = String(engine.ApiEngineKey || '').trim();
  const packageBody = normalizeSource(stripOfficialNotice(engine.ApiV8Code));
  for (const { sourcePath, rawSource } of getCanonicalSourceIndex().get(key) || []) {
    const sourceBody = normalizeSource(stripOfficialNotice(rawSource));
    const source = applyOfficialNotice(rawSource, { appName, key, policy });
    fs.writeFileSync(sourcePath, source, 'utf8');
    if (sourceBody === packageBody) engine.ApiV8Code = source;
  }
}

function applicationName(packageModel, fileName) {
  return String(packageModel?.PackageInfo?.Name || fileName).trim();
}

function managedNotice(appName, key, ownership) {
  const overwriteText = `从可信吾码官方应用源安装、更新或重新安装“${appName}”，都会以官方源码恢复此 Managed 接口。`;
  return `${managedNoticeStart}\n * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】\n * 所属官方应用：${appName}\n * ApiEngineKey：${key}\n * ${overwriteText}\n * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，\n * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。\n */`;
}

function tenantNotice(appName, key) {
  return `${tenantNoticeStart}\n * 【租户个性化接口：官方升级不会覆盖】\n * 所属官方应用：${appName}\n * ApiEngineKey：${key}\n * 此接口仅在首次安装时创建，之后归当前租户维护；官方更新或重新安装不得覆盖。\n */`;
}

export function applyOfficialNotice(source, { appName, key, policy }) {
  // 包内代码、独立维护源码和 Windows 工作树必须使用同一可复现文本。
  // 否则新增提示后会形成 LF 头 + CRLF 正文的混合字符串，导致包哈希、
  // BaseHash 与逐字副本门禁在不同平台漂移。
  const cleanSource = normalizeSource(stripOfficialNotice(source));
  const ownership = String(policy?.Ownership || '').trim() || 'Application';
  const upgradePolicy = String(policy?.UpgradePolicy || '').trim() || 'Managed';
  const notice = upgradePolicy === 'CreateIfMissing'
    ? tenantNotice(appName, key)
    : managedNotice(appName, key, ownership);
  return `${notice}\n\n${cleanSource}`.trimEnd() + '\n';
}

function readSyncBasePolicies(root, fileName) {
  const basePath = path.join(root, '.resource-sync-base', fileName);
  if (!fs.existsSync(basePath)) return {};
  const baseModel = JSON.parse(fs.readFileSync(basePath, 'utf8'));
  return baseModel.ResourcePolicies?.ApiEngines || {};
}

export function normalizeOfficialApiEnginePolicies(packageModel, fileName, basePolicies = {}) {
  packageModel.ResourcePolicies ||= { SchemaVersion: 1, ApiEngines: {} };
  packageModel.ResourcePolicies.SchemaVersion ||= 1;
  packageModel.ResourcePolicies.ApiEngines ||= {};
  const appName = applicationName(packageModel, fileName);
  for (const engine of packageModel.SysApiEngines || []) {
    const key = String(engine.ApiEngineKey || '').trim();
    if (!key) throw new Error(`${fileName} 存在没有 ApiEngineKey 的接口引擎。`);
    const existing = packageModel.ResourcePolicies.ApiEngines[key] || {};
    const upgradePolicy = String(existing.UpgradePolicy || 'Managed').trim();
    const ownership = String(existing.Ownership || '').trim()
      || (upgradePolicy === 'CreateIfMissing' ? 'Tenant' : 'Platform');
    const baseline = basePolicies[key] || {};
    const policy = {
      ...baseline,
      ...existing,
      Ownership: ownership,
      UpgradePolicy: upgradePolicy,
    };
    packageModel.ResourcePolicies.ApiEngines[key] = policy;
    engine.ApiV8Code = applyOfficialNotice(engine.ApiV8Code, {
      appName,
      key,
      policy,
    });
  }
  return packageModel;
}

export function updateOfficialApiEngineNotices(root = resourceRoot, requestedPackages = packageFiles) {
  const summaries = [];
  for (const fileName of requestedPackages) {
    const filePath = path.join(root, fileName);
    const packageModel = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    normalizeOfficialApiEnginePolicies(
      packageModel,
      fileName,
      readSyncBasePolicies(root, fileName),
    );

    const appName = applicationName(packageModel, fileName);
    for (const engine of packageModel.SysApiEngines || []) {
      synchronizeCanonicalSources(
        engine,
        appName,
        packageModel.ResourcePolicies.ApiEngines[engine.ApiEngineKey],
      );
    }

    if (fileName === 'app.microi.store.json') {
      for (const engine of packageModel.SysApiEngines || []) {
        const sourceFile = storeSourceFiles[engine.ApiEngineKey];
        if (!sourceFile) continue;
        const sourcePath = path.join(root, sourceFile);
        const policy = packageModel.ResourcePolicies.ApiEngines[engine.ApiEngineKey];
        const source = applyOfficialNotice(fs.readFileSync(sourcePath, 'utf8'), {
          appName,
          key: engine.ApiEngineKey,
          policy,
        });
        fs.writeFileSync(sourcePath, source, 'utf8');
        engine.ApiV8Code = source;
        const sourceVersion = source.match(/Version\s*:\s*(v?\d+\.\d+\.\d+)/i)?.[1];
        if (sourceVersion) engine.Version = sourceVersion.startsWith('v') ? sourceVersion : `v${sourceVersion}`;
      }
    }

    packageModel.PackageInfo ||= {};
    packageModel.PackageInfo.ApiEngineCount = (packageModel.SysApiEngines || []).length;
    fs.writeFileSync(filePath, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8');
    summaries.push({
      fileName,
      engines: (packageModel.SysApiEngines || []).length,
      policies: Object.keys(packageModel.ResourcePolicies.ApiEngines).length,
    });
  }
  return summaries;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const requestedPackages = process.argv
    .filter(argument => argument.startsWith('--package='))
    .map(argument => argument.substring('--package='.length));
  process.stdout.write(`${JSON.stringify(updateOfficialApiEngineNotices(
    resourceRoot,
    requestedPackages.length ? requestedPackages : packageFiles,
  ), null, 2)}\n`);
}
