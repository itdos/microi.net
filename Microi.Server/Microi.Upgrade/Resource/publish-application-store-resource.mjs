import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  publishResourcesViaConfiguredMcp,
  readResourcesViaConfiguredMcp,
  reconcilePublishedApiEnginesViaConfiguredMcp,
} from './mcp-resource-publisher.mjs';
import { validateOfficialPackageChangeLog } from './resource-sync-core.mjs';

const resourceNames = Object.freeze([
  'import-package.js',
  'ai-app-publish-store.js',
  'app.microi.store.json',
]);
const applicationResourceNames = Object.freeze([
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
const startDirectory = fileURLToPath(new URL('.', import.meta.url));
const localResources = new Map();

function resourceVersion(name, content) {
  if (name.endsWith('.json')) {
    const packageModel = JSON.parse(content);
    return String(packageModel?.PackageInfo?.Version || '');
  }
  return String(content || '').match(/\bVersion\s*:\s*(v?\d+\.\d+\.\d+)\b/i)?.[1] || '';
}

for (const name of resourceNames) {
  const content = await readFile(new URL(`./${name}`, import.meta.url), 'utf8');
  if (name.endsWith('.json')) validateOfficialPackageChangeLog(name, content);
  localResources.set(name, {
    content,
    sha256: createHash('sha256').update(content, 'utf8').digest('hex'),
    version: resourceVersion(name, content),
  });
}

const before = await readResourcesViaConfiguredMcp(resourceNames, { startDirectory });
const changes = [];
for (const name of resourceNames) {
  const current = before.resources.get(name);
  if (!current || !/^[a-f0-9]{64}$/i.test(String(current.Sha256 || ''))) {
    throw new Error(`microi_itdos 未返回可用于 CAS 的 ${name} 远端 SHA-256`);
  }
  const local = localResources.get(name);
  if (String(current.Sha256).toLowerCase() !== local.sha256) {
    changes.push({
      name,
      content: local.content,
      expectedRemoteSha256: String(current.Sha256).toLowerCase(),
    });
  }
}

if (changes.length) {
  await publishResourcesViaConfiguredMcp(changes, { startDirectory });
}

const after = await readResourcesViaConfiguredMcp(resourceNames, { startDirectory });
const results = [];
for (const name of resourceNames) {
  const local = localResources.get(name);
  const current = before.resources.get(name);
  const verified = after.resources.get(name);
  const verifiedVersion = resourceVersion(name, String(verified?.Content || ''));
  if (!verified
      || String(verified.Sha256 || '').toLowerCase() !== local.sha256
      || verifiedVersion !== local.version
      || (name.endsWith('.json') && String(verified.AppVersion || '') !== local.version)) {
    throw new Error(`${name} 官方资源发布后版本或 SHA-256 强回读不一致`);
  }
  results.push({
    ResourceName: name,
    Version: local.version,
    Sha256: local.sha256,
    PreviousSha256: String(current.Sha256).toLowerCase(),
    Updated: String(current.Sha256).toLowerCase() !== local.sha256,
  });
}

// The official projection endpoint intentionally validates the complete nine-package
// ApiEngine closure. Read the other eight packages from the already-published source;
// this scoped release only writes the application-store package and its two standalone
// control-plane replicas.
const projectionResources = await readResourcesViaConfiguredMcp(
  applicationResourceNames,
  { startDirectory },
);
const seenApiEngineKeys = new Set();
const snapshots = applicationResourceNames.map(name => {
  const resource = projectionResources.resources.get(name);
  const packageModel = JSON.parse(String(resource?.Content || ''));
  const engines = Array.isArray(packageModel.SysApiEngines) ? packageModel.SysApiEngines : [];
  const policies = packageModel?.ResourcePolicies?.ApiEngines || {};
  let managedCount = 0;
  let createIfMissingCount = 0;
  const apiEngineKeys = engines.map(engine => {
    const key = String(engine?.ApiEngineKey || '').trim();
    const normalized = key.toLowerCase();
    const policy = policies[key]?.UpgradePolicy;
    if (!normalized || seenApiEngineKeys.has(normalized)) {
      throw new Error(`官方接口投影存在跨包重复或空 Key：${key || '(空)'}`);
    }
    if (policy === 'Managed') managedCount += 1;
    else if (policy === 'CreateIfMissing') createIfMissingCount += 1;
    else throw new Error(`官方接口投影资源策略无效：${name} -> ${key}`);
    seenApiEngineKeys.add(normalized);
    return key;
  });
  return {
    name,
    sha256: String(resource?.Sha256 || '').toLowerCase(),
    managedCount,
    createIfMissingCount,
    apiEngineKeys,
  };
});
const projection = await reconcilePublishedApiEnginesViaConfiguredMcp(
  snapshots,
  { startDirectory },
);

process.stdout.write(`${JSON.stringify({ Resources: results, Projection: projection })}\n`);
