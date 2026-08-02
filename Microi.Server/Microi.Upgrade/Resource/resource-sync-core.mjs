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
  'app.microi.store.json': '应用商城',
};

export function normalizeText(content) {
  return `${String(content ?? '').replace(/\r\n?/g, '\n').replace(/\n*$/g, '')}\n`;
}

export function canonicalizeResource(name, content) {
  const normalized = normalizeText(content);
  if (!name.endsWith('.json')) return normalized;
  return `${JSON.stringify(JSON.parse(normalized), null, 2)}\n`;
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
