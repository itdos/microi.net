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

export function normalizeText(content) {
  return `${String(content ?? '').replace(/\r\n?/g, '\n').replace(/\n*$/g, '')}\n`;
}

export function canonicalizeResource(name, content) {
  const normalized = normalizeText(content);
  if (!name.endsWith('.json')) return normalized;
  return `${JSON.stringify(JSON.parse(normalized), null, 2)}\n`;
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
    const merge = spawnSync(
      'git',
      ['merge-file', '-p', localPath, basePath, remotePath],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    if (merge.status === 0) return canonicalizeResource(name, merge.stdout);
    if (merge.status === 1) {
      throw new Error(`${name} 存在 JS 三方合并冲突，请先人工合并后重新发布：\n${merge.stdout}`);
    }
    throw new Error(`${name} 执行 git merge-file 失败：${merge.stderr || `退出码 ${merge.status}`}`);
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
