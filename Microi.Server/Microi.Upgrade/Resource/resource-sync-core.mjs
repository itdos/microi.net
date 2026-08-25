import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MISSING = Symbol('missing');
const identityFields = [
  'Id',
  'ApiEngineKey',
  'AppId',
  'Name',
  'Key',
  'Code',
  'TableId',
  'ModuleEngineKey',
  'DataSourceKey',
];

const readableResourceIdentities = {
  'import-package.js': 'import-microi-store-package',
  'ai-app-publish-store.js': 'ai_app_publish_store',
  'official-resource-api.js': 'ApiEngineKey: get-microi-upgrade-resource',
};

const readablePackageNames = {
  'app.microi.form-engine.json': '表单引擎',
  'app.microi.module-engine.json': '模块引擎',
  'app.microi.saas-engine.json': 'SaaS引擎',
  'app.microi.sso.json': 'SSO 身份联邦',
  'app.microi.store.json': '应用商城',
  'app.microi.sys_user.json': '系统账号',
  'app.microi.sys-config.json': '系统设置',
  'app.microi.message-notification.json': '消息通知',
  'app.microi.ai-engine.json': 'AI助手',
};

const exactCurrentHistoryPackageNames = new Set([
  'app.microi.form-engine.json',
  'app.microi.module-engine.json',
  'app.microi.saas-engine.json',
  'app.microi.sso.json',
]);

const platformServicePackageNames = new Set([
  'app.microi.saas-engine.json',
  'app.microi.store.json',
]);

export function normalizeText(content) {
  return `${String(content ?? '').replace(/\r\n?/g, '\n').replace(/\n*$/g, '')}\n`;
}

export function canonicalizeResource(name, content) {
  const normalized = normalizeText(content);
  if (!name.endsWith('.json')) return normalized;
  return `${JSON.stringify(JSON.parse(normalized), null, 2)}\n`;
}

function semanticVersionParts(value, label, allowEmpty = false) {
  const text = String(value || '').trim();
  if (!text && allowEmpty) return [0, 0, 0];
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/i.exec(text);
  if (!match) throw new Error(`${label}必须是 vX.Y.Z 语义版本，当前为 ${text || '(空)'}`);
  return match.slice(1).map(Number);
}

export function ensureMinimumPackageVersion(packageInfo, minimumVersion) {
  if (!packageInfo || typeof packageInfo !== 'object' || Array.isArray(packageInfo)) {
    throw new Error('PackageInfo 必须是对象');
  }
  const currentVersion = String(packageInfo.Version || '').trim();
  const currentParts = semanticVersionParts(currentVersion, 'PackageInfo.Version', true);
  const minimumParts = semanticVersionParts(minimumVersion, '最低包版本');
  for (let index = 0; index < minimumParts.length; index += 1) {
    if (currentParts[index] > minimumParts[index]) return currentVersion;
    if (currentParts[index] < minimumParts[index]) {
      packageInfo.Version = String(minimumVersion).trim();
      return packageInfo.Version;
    }
  }
  if (!currentVersion) packageInfo.Version = String(minimumVersion).trim();
  return packageInfo.Version;
}

function changeHistoryCoversVersion(changeHistory, version) {
  if (typeof changeHistory === 'string') {
    const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^0-9A-Za-z.])${escapedVersion}(?=$|[^0-9A-Za-z.])`).test(changeHistory);
  }
  if (Array.isArray(changeHistory)) {
    return changeHistory.some(item => changeHistoryCoversVersion(item, version));
  }
  if (changeHistory && typeof changeHistory === 'object') {
    return Object.values(changeHistory).some(item => changeHistoryCoversVersion(item, version));
  }
  return false;
}

function currentChangeHistoryRecords(changeHistory, version) {
  if (typeof changeHistory === 'string') {
    const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const linePattern = new RegExp(`^(\\d{4}-\\d{2}-\\d{2})\\s+${escapedVersion}(?:\\s+(.*))?$`);
    return changeHistory
      .split(/\r?\n/)
      .map(line => line.trim())
      .map(line => linePattern.exec(line))
      .filter(Boolean)
      .map(match => ({ Date: match[1], Content: String(match[2] || '').trim() }));
  }
  if (Array.isArray(changeHistory)) {
    return changeHistory
      .filter(item => item && typeof item === 'object' && String(item.Version || '').trim() === version)
      .map(item => ({
        Date: String(item.Date || '').trim(),
        Content: String(item.Description ?? item.Content ?? '').trim(),
      }));
  }
  if (changeHistory && typeof changeHistory === 'object'
      && String(changeHistory.Version || '').trim() === version) {
    return [{
      Date: String(changeHistory.Date || '').trim(),
      Content: String(changeHistory.Description ?? changeHistory.Content ?? '').trim(),
    }];
  }
  return [];
}

export function validateOfficialPackageChangeLog(name, content) {
  if (!Object.hasOwn(readablePackageNames, name)) return;

  let packageModel;
  try {
    packageModel = JSON.parse(String(content ?? ''));
  } catch (error) {
    throw new Error(`${name} 不是有效 JSON，无法校验 PackageInfo.ChangeLog`, { cause: error });
  }

  const packageInfo = packageModel?.PackageInfo;
  const packageVersion = packageInfo?.Version;
  const changeLog = packageInfo?.ChangeLog;
  if (!changeLog || typeof changeLog !== 'object' || Array.isArray(changeLog)) {
    throw new Error(`${name} 的 PackageInfo.ChangeLog 必须是对象`);
  }
  if (typeof packageVersion !== 'string' || !packageVersion.trim()
      || changeLog.Version !== packageVersion) {
    throw new Error(`${name} 的 PackageInfo.ChangeLog.Version 必须精确等于 PackageInfo.Version`);
  }
  for (const fieldName of ['Title', 'ChangeType', 'Content', 'ReleaseTime']) {
    if (typeof changeLog[fieldName] !== 'string' || !changeLog[fieldName].trim()) {
      throw new Error(`${name} 的 PackageInfo.ChangeLog.${fieldName} 不能为空`);
    }
  }
  if (!changeHistoryCoversVersion(packageInfo?.ChangeHistory, packageVersion)) {
    throw new Error(`${name} 的 PackageInfo.ChangeHistory 未覆盖当前版本 ${packageVersion}`);
  }
  if (exactCurrentHistoryPackageNames.has(name)) {
    const releaseTimeMatch = /^(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}:\d{2}$/.exec(changeLog.ReleaseTime.trim());
    if (!releaseTimeMatch) {
      throw new Error(`${name} 的 PackageInfo.ChangeLog.ReleaseTime 必须为 yyyy-MM-dd HH:mm:ss`);
    }
    const records = currentChangeHistoryRecords(packageInfo.ChangeHistory, packageVersion);
    const expectedDate = releaseTimeMatch[1];
    const expectedContent = changeLog.Content.trim();
    if (!records.some(record => record.Date === expectedDate && record.Content === expectedContent)) {
      throw new Error(
        `${name} 的 PackageInfo.ChangeHistory 当前版本日期或正文与 PackageInfo.ChangeLog 不一致`,
      );
    }
  }
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, stableJsonValue(value[key])]),
  );
}

function getRequiredPlatformServiceBundle(name, content) {
  if (!platformServicePackageNames.has(name)) {
    throw new Error(`不允许检查非平台内置微服务应用包：${name}`);
  }
  let packageModel;
  try {
    packageModel = JSON.parse(canonicalizeResource(name, content));
  } catch (error) {
    throw new Error(`${name} 不是有效 JSON，无法判断平台内置微服务是否变化`, { cause: error });
  }
  const bundles = Array.isArray(packageModel?.ApplicationBundles)
    ? packageModel.ApplicationBundles
    : [];
  const matches = bundles.filter(bundle => {
    const application = bundle?.Application || {};
    return String(application.AppKey || application.AppId || '').trim() === 'microi-platform-service';
  });
  if (matches.length !== 1) {
    throw new Error(`${name} 必须且只能包含一个 microi-platform-service 应用包，当前 ${matches.length} 个`);
  }
  return matches[0];
}

export function hasPlatformServiceBundleChanged(name, remoteContent, candidateContent) {
  const remoteBundle = getRequiredPlatformServiceBundle(name, remoteContent);
  const candidateBundle = getRequiredPlatformServiceBundle(name, candidateContent);
  return JSON.stringify(stableJsonValue(remoteBundle)) !== JSON.stringify(stableJsonValue(candidateBundle));
}

export function normalizeOfficialPackageExecutionLimits(name, content, recursionCeiling = 5000) {
  const canonical = canonicalizeResource(name, content);
  if (!name.endsWith('.json')) return canonical;

  const ceiling = Number(recursionCeiling);
  if (!Number.isFinite(ceiling) || ceiling <= 0) {
    throw new Error('官方应用包递归上限必须是正整数');
  }

  const packageModel = JSON.parse(canonical);
  let changed = false;
  for (const engine of Array.isArray(packageModel?.SysApiEngines) ? packageModel.SysApiEngines : []) {
    const persisted = Number(engine?.LimitRecursion);
    if (!Number.isFinite(persisted) || persisted <= ceiling) continue;
    engine.LimitRecursion = Math.trunc(ceiling);
    changed = true;
  }
  return changed ? canonicalizeResource(name, JSON.stringify(packageModel)) : canonical;
}

// Remote resources are one side of a three-way merge and are allowed to lag
// behind the local release candidate. This gate only proves that the response
// has the expected stable identity and can be parsed safely. The strict feature
// and minimum-version gate remains in refresh-resources.mjs and is applied to
// local input and the final merged candidate before any write or publication.
export function validateReadableOfficialResource(name, content) {
  const text = String(content ?? '');
  if (!text.trim()) throw new Error(`${name} 内容为空`);

  if (Object.hasOwn(readableResourceIdentities, name)) {
    const expectedIdentity = readableResourceIdentities[name];
    if (!text.includes(expectedIdentity)) {
      throw new Error(`${name} 缺少稳定资源标识 ${expectedIdentity}`);
    }
    return;
  }

  if (Object.hasOwn(readablePackageNames, name)) {
    let packageModel;
    try {
      packageModel = JSON.parse(text);
    } catch (error) {
      throw new Error(`${name} 不是有效 JSON：${error.message}`, { cause: error });
    }
    if (packageModel?.PackageInfo?.Name !== readablePackageNames[name]) {
      throw new Error(`${name} 的 PackageInfo.Name 不正确`);
    }
    return;
  }

  throw new Error(`不允许读取未列入固定白名单的官网升级资源：${name}`);
}

export function isTemporaryOfficialResourceFailure(error) {
  const messages = [];
  const codes = [];
  let current = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    messages.push(String(current.message || current));
    if (current.code) codes.push(String(current.code));
    current = current.cause;
  }
  const message = messages.join(' | ');
  const code = codes.join(' | ');
  return /服务器内部错误/i.test(message)
    || /\bHTTP (?:408|425|429|5\d\d)\b/i.test(message)
    || /\b(?:fetch failed|network|socket|timeout|timed out|aborted)\b/i.test(message)
    || /\b(?:ECONNRESET|ECONNREFUSED|ECONNABORTED|ENETUNREACH|EHOSTUNREACH|ETIMEDOUT|EAI_AGAIN)\b/i.test(`${message} ${code}`);
}

export function verifyOfflineReleaseSafety(resourceNames, localResources, baseResources) {
  const missingBases = [];
  const localChanges = [];
  for (const name of resourceNames) {
    if (!baseResources.has(name)) {
      missingBases.push(name);
    } else if (localResources.get(name) !== baseResources.get(name)) {
      localChanges.push(name);
    }
  }
  if (missingBases.length || localChanges.length) {
    const reasons = [];
    if (missingBases.length) reasons.push(`缺少共同基线：${missingBases.join('、')}`);
    if (localChanges.length) reasons.push(`本地已有未同步修改：${localChanges.join('、')}`);
    throw new Error(`官网升级资源暂时不可用，且不能安全使用离线基线（${reasons.join('；')}）`);
  }
}

function same(left, right) {
  if (left === MISSING || right === MISSING) return left === right;
  return JSON.stringify(left) === JSON.stringify(right);
}

function clone(value) {
  if (value === MISSING) return MISSING;
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function findIdentityField(...arrays) {
  const populated = arrays.filter(Array.isArray).filter(items => items.length > 0);
  if (!populated.length) return null;
  return identityFields.find(field => populated.every(items => {
    const keys = items.map(item => (
      isObject(item) && item[field] !== undefined && item[field] !== null
        ? String(item[field])
        : ''
    ));
    return keys.every(Boolean) && new Set(keys).size === keys.length;
  })) || null;
}

function mergeValue(base, local, remote, path, conflicts) {
  if (same(local, remote)) return clone(local);
  if (same(local, base)) return clone(remote);
  if (same(remote, base)) return clone(local);

  if (local === MISSING || remote === MISSING) {
    conflicts.push(`${path}: 一侧删除、另一侧修改`);
    return clone(local === MISSING ? remote : local);
  }

  if (isObject(base) && isObject(local) && isObject(remote)) {
    const merged = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
    for (const key of keys) {
      const value = mergeValue(
        Object.hasOwn(base, key) ? base[key] : MISSING,
        Object.hasOwn(local, key) ? local[key] : MISSING,
        Object.hasOwn(remote, key) ? remote[key] : MISSING,
        `${path}.${key}`,
        conflicts,
      );
      if (value !== MISSING) merged[key] = value;
    }
    return merged;
  }

  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    const identityField = findIdentityField(base, local, remote);
    if (!identityField) {
      conflicts.push(`${path}: 无稳定标识的数组被两端同时修改`);
      return clone(local);
    }

    const toMap = items => new Map(items.map(item => [String(item[identityField]), item]));
    const baseMap = toMap(base);
    const localMap = toMap(local);
    const remoteMap = toMap(remote);
    const order = [];
    for (const items of [base, local, remote]) {
      for (const item of items) {
        const key = String(item[identityField]);
        if (!order.includes(key)) order.push(key);
      }
    }

    const merged = [];
    for (const key of order) {
      const value = mergeValue(
        baseMap.has(key) ? baseMap.get(key) : MISSING,
        localMap.has(key) ? localMap.get(key) : MISSING,
        remoteMap.has(key) ? remoteMap.get(key) : MISSING,
        `${path}[${identityField}=${key}]`,
        conflicts,
      );
      if (value !== MISSING) merged.push(value);
    }
    return merged;
  }

  conflicts.push(`${path}: 两端修改为不同值`);
  return clone(local);
}

export function mergeJsonResource(name, baseContent, localContent, remoteContent) {
  const base = JSON.parse(canonicalizeResource(name, baseContent));
  const local = JSON.parse(canonicalizeResource(name, localContent));
  const remote = JSON.parse(canonicalizeResource(name, remoteContent));
  const conflicts = [];
  const merged = mergeValue(base, local, remote, '$', conflicts);
  if (conflicts.length) {
    throw new Error(`${name} 存在 ${conflicts.length} 个 JSON 冲突：\n- ${conflicts.slice(0, 20).join('\n- ')}`);
  }
  return `${JSON.stringify(merged, null, 2)}\n`;
}

export async function mergeJavascriptResource(name, baseContent, localContent, remoteContent) {
  const base = canonicalizeResource(name, baseContent);
  const local = canonicalizeResource(name, localContent);
  const remote = canonicalizeResource(name, remoteContent);
  if (local === remote) return local;
  if (local === base) return remote;
  if (remote === base) return local;

  const tempDirectory = await mkdtemp(join(tmpdir(), 'microi-resource-merge-'));
  const localPath = join(tempDirectory, 'local.js');
  const basePath = join(tempDirectory, 'base.js');
  const remotePath = join(tempDirectory, 'remote.js');
  try {
    await Promise.all([
      writeFile(localPath, local, 'utf8'),
      writeFile(basePath, base, 'utf8'),
      writeFile(remotePath, remote, 'utf8'),
    ]);
    let firstConflict = '';
    let lastToolError = '';
    // 不同 Git diff 算法对长 V8 文件中的相邻函数/语句有不同的锚点选择。
    // 任一算法得到无冲突结果即可接受；真正同一代码位置的不同实现会在所有
    // 算法下继续失败关闭。
    for (const algorithm of [null, 'histogram', 'patience', 'minimal']) {
      const args = ['merge-file', '-p'];
      if (algorithm) args.push('--diff-algorithm', algorithm);
      args.push(localPath, basePath, remotePath);
      const merge = spawnSync(
        'git',
        args,
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
      );
      if (merge.status === 0) return canonicalizeResource(name, merge.stdout);
      if (merge.status === 1) {
        firstConflict ||= merge.stdout;
        continue;
      }
      lastToolError = merge.stderr || `退出码 ${merge.status}`;
    }
    if (firstConflict) {
      throw new Error(`${name} 存在 JS 三方合并冲突，请先人工合并后重新发布：\n${firstConflict}`);
    }
    throw new Error(`${name} 执行 git merge-file 失败：${lastToolError || '未知错误'}`);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

export async function mergeResource(name, baseContent, localContent, remoteContent) {
  if (name.endsWith('.json')) {
    return mergeJsonResource(name, baseContent, localContent, remoteContent);
  }
  return mergeJavascriptResource(name, baseContent, localContent, remoteContent);
}
