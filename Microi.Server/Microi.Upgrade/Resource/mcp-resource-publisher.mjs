import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, parse, resolve } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { validateOfficialPackageChangeLog } from './resource-sync-core.mjs';

const officialApiBaseUrl = 'https://api.itdos.com';
const officialOsClient = 'itdos';
const officialEngineKey = 'get-microi-upgrade-resource';
const officialApplicationResourceNames = Object.freeze([
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
const officialResourceNames = new Set([
  'import-package.js',
  'ai-app-publish-store.js',
  'official-resource-api.js',
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

function normalizeApiBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '').toLowerCase();
}

function isCompatibleItDosMcpName(value) {
  return /^microi_itdos(?:_[a-z0-9_]+)?$/i.test(String(value || '').trim());
}

function selectConfiguredItDosMcpServer(servers, source) {
  if (!servers || typeof servers !== 'object') return null;
  const namedCandidates = Object.entries(servers)
    .filter(([name]) => isCompatibleItDosMcpName(name));
  if (!namedCandidates.length) return null;

  const officialCandidates = namedCandidates.filter(([, server]) => {
    const env = server?.env && typeof server.env === 'object' ? server.env : {};
    return normalizeApiBaseUrl(env.MICROI_API_URL) === officialApiBaseUrl
      && String(env.MICROI_OS_CLIENT || '').trim().toLowerCase() === officialOsClient;
  });
  if (officialCandidates.length === 1) {
    const [name, server] = officialCandidates[0];
    return { name, server };
  }
  if (officialCandidates.length > 1) {
    const exact = officialCandidates.find(([name]) => name.toLowerCase() === 'microi_itdos');
    if (exact) {
      const [name, server] = exact;
      return { name, server };
    }
    throw new Error(
      `${source} 中存在多个绑定吾码官方 API 与 iTdos 租户的 MCP，无法唯一选择：${officialCandidates.map(([name]) => name).join(', ')}`,
    );
  }

  // Preserve the detailed fail-closed validation error when one compatible
  // name exists but its official API or tenant binding is incorrect.
  if (namedCandidates.length === 1) {
    const [name, server] = namedCandidates[0];
    return { name, server };
  }
  throw new Error(
    `${source} 中存在多个名称兼容但均未正确绑定官方 iTdos 的 MCP：${namedCandidates.map(([name]) => name).join(', ')}`,
  );
}

export function validateItDosMcpServer(server, source = 'MCP 配置') {
  if (!server || typeof server !== 'object') {
    throw new Error(`${source} 中缺少 microi_itdos`);
  }
  if (server.type && String(server.type).toLowerCase() !== 'stdio') {
    throw new Error(`${source} 的 microi_itdos 不是 stdio 类型`);
  }
  if (!String(server.command || '').trim() || !Array.isArray(server.args) || !server.args.length) {
    throw new Error(`${source} 的 microi_itdos 缺少 command 或 args`);
  }
  const env = server.env && typeof server.env === 'object' ? server.env : {};
  if (normalizeApiBaseUrl(env.MICROI_API_URL) !== officialApiBaseUrl) {
    throw new Error(`${source} 的 microi_itdos 未绑定吾码官方 API，拒绝发布`);
  }
  if (String(env.MICROI_OS_CLIENT || '').trim().toLowerCase() !== officialOsClient) {
    throw new Error(`${source} 的 microi_itdos 未绑定 iTdos 租户，拒绝发布`);
  }
  return server;
}

async function readJson(path) {
  try {
    return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw new Error(`无法读取 MCP 配置 ${path}：${error.message}`, { cause: error });
  }
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function resolveServerPath(value, configDirectory, configuredCwd = '') {
  const path = String(value || '').trim();
  if (!path) return '';
  if (isAbsolute(path)) return resolve(path);
  const cwd = String(configuredCwd || '').trim();
  const base = cwd
    ? (isAbsolute(cwd) ? cwd : resolve(configDirectory, cwd))
    : configDirectory;
  return resolve(base, path);
}

function extensionVersion(directoryName) {
  const match = String(directoryName || '').match(/^microi\.v8-engine-(\d+)\.(\d+)\.(\d+)(?:[-.].*)?$/i);
  return match ? match.slice(1).map(Number) : null;
}

function compareExtensionDirectories(left, right) {
  const leftVersion = extensionVersion(basename(left)) || [0, 0, 0];
  const rightVersion = extensionVersion(basename(right)) || [0, 0, 0];
  for (let index = 0; index < 3; index += 1) {
    if (leftVersion[index] !== rightVersion[index]) return rightVersion[index] - leftVersion[index];
  }
  return String(right).localeCompare(String(left));
}

async function newestMcpServerInExtensionRoot(extensionRoot) {
  if (!extensionRoot || !await pathExists(extensionRoot)) return '';
  let entries;
  try {
    entries = await readdir(extensionRoot, { withFileTypes: true });
  } catch {
    return '';
  }
  const candidates = entries
    .filter(entry => entry.isDirectory() && extensionVersion(entry.name))
    .map(entry => join(extensionRoot, entry.name))
    .sort(compareExtensionDirectories);
  for (const candidate of candidates) {
    const mcpServerPath = join(candidate, 'dist', 'mcp-server.js');
    if (await pathExists(mcpServerPath)) return mcpServerPath;
  }
  return '';
}

function workspaceMcpCandidates(configPath) {
  const candidates = [];
  let current = dirname(configPath);
  while (true) {
    candidates.push(resolve(current, 'Microi.VSCode', 'dist', 'mcp-server.js'));
    const parent = dirname(current);
    if (parent === current || current === parse(current).root) break;
    current = parent;
  }
  return candidates;
}

/**
 * Keep the official tenant/authentication settings from the generated config,
 * but do not couple publishing to a VS Code executable, extension version or
 * cwd that may disappear after an extension update. The release script already
 * runs under Node, so a verified mcp-server.js can be started with that same
 * runtime on every supported editor.
 */
export async function resolveItDosMcpLaunch(server, configPath) {
  const validated = validateItDosMcpServer(server, configPath);
  const configDirectory = dirname(configPath);
  const supportedEntrypoints = new Set(['mcp-server.js', 'microi-cli-mcp.js']);
  const configuredEntryIndex = validated.args.findIndex(value => (
    supportedEntrypoints.has(basename(String(value || '')).toLowerCase())
  ));
  if (configuredEntryIndex < 0) {
    throw new Error(`${configPath} 的 microi_itdos args 中缺少 mcp-server.js 或 microi-cli-mcp.js`);
  }

  const configuredEntry = resolveServerPath(
    validated.args[configuredEntryIndex],
    configDirectory,
    validated.cwd,
  );
  let selectedEntry = await pathExists(configuredEntry) ? configuredEntry : '';
  let launchSource = selectedEntry ? 'configured' : '';

  const configuredExtensionRoot = dirname(dirname(configuredEntry));
  const configuredExtensionVersion = extensionVersion(basename(configuredExtensionRoot));
  if (configuredExtensionVersion) {
    const siblingExtensionsRoot = dirname(configuredExtensionRoot);
    const newestSiblingEntry = await newestMcpServerInExtensionRoot(siblingExtensionsRoot);
    if (newestSiblingEntry) {
      const newestSiblingRoot = dirname(dirname(newestSiblingEntry));
      const newestSiblingVersion = extensionVersion(basename(newestSiblingRoot));
      const newerThanConfigured = newestSiblingVersion
        && compareExtensionDirectories(newestSiblingRoot, configuredExtensionRoot) < 0;
      if (!selectedEntry || newerThanConfigured) {
        selectedEntry = newestSiblingEntry;
        launchSource = 'newest-installed-extension';
      }
    }
  }

  if (!selectedEntry) {
    for (const candidate of workspaceMcpCandidates(configPath)) {
      if (await pathExists(candidate)) {
        selectedEntry = candidate;
        launchSource = 'workspace-bundle';
        break;
      }
    }
  }

  if (!selectedEntry) {
    const standardExtensionRoots = [
      resolve(homedir(), '.vscode', 'extensions'),
      resolve(homedir(), '.cursor', 'extensions'),
    ];
    for (const extensionRoot of standardExtensionRoots) {
      selectedEntry = await newestMcpServerInExtensionRoot(extensionRoot);
      if (selectedEntry) {
        launchSource = 'newest-user-extension';
        break;
      }
    }
  }

  if (!selectedEntry) {
    throw new Error(
      `${configPath} 配置的 MCP 插件入口已不存在，且未找到可用的 Microi VS Code 插件或工作区 MCP 服务`,
    );
  }

  const selectedExtensionRoot = dirname(dirname(selectedEntry));
  return {
    ...validated,
    command: process.execPath,
    args: [selectedEntry],
    cwd: selectedExtensionRoot,
    launchSource,
    configuredEntry,
  };
}

export async function findItDosMcpServer(startDirectory, explicitConfigPath = '') {
  const explicit = String(explicitConfigPath || '').trim();
  const candidates = [];
  if (explicit) {
    candidates.push(isAbsolute(explicit) ? explicit : resolve(process.cwd(), explicit));
  } else {
    let current = resolve(startDirectory || process.cwd());
    while (true) {
      candidates.push(
        resolve(current, '.mcp.json'),
        resolve(current, '.vscode', 'mcp.json'),
        resolve(current, '.cursor', 'mcp.json'),
      );
      const parent = dirname(current);
      if (parent === current || current === parse(current).root) break;
      current = parent;
    }
  }

  let foundConfig = false;
  const launchErrors = [];
  for (const path of candidates) {
    const config = await readJson(path);
    if (!config) continue;
    foundConfig = true;
    const servers = config.mcpServers || config.servers;
    const selected = selectConfiguredItDosMcpServer(servers, path);
    if (!selected) {
      if (explicit) throw new Error(`${path} 中缺少 microi_itdos 或兼容的 microi_itdos_<host>`);
      continue;
    }
    const validated = validateItDosMcpServer(selected.server, `${path} 的 ${selected.name}`);
    try {
      const server = await resolveItDosMcpLaunch(validated, path);
      return { path, server };
    } catch (error) {
      if (explicit) throw error;
      launchErrors.push(`${path}: ${error.message}`);
    }
  }
  throw new Error(
    launchErrors.length
      ? `已找到 microi_itdos，但无法解析可运行的 MCP：${launchErrors.join('；')}`
      : foundConfig
      ? '已找到 MCP 配置，但其中没有 microi_itdos 或兼容的 microi_itdos_<host>'
      : '未找到 .mcp.json、.vscode/mcp.json 或 .cursor/mcp.json',
  );
}

function collectText(toolResult) {
  return Array.isArray(toolResult?.content)
    ? toolResult.content.filter(item => item?.type === 'text').map(item => item.text).join('\n')
    : '';
}

function parseCodexExecutionResult(toolResult, operation) {
  const output = collectText(toolResult);
  if (toolResult?.isError) {
    throw new Error(`通过 microi_itdos MCP ${operation}失败：${output || '未知错误'}`);
  }
  const fencedJson = output.match(/```json\s*\n([\s\S]*?)\n```\s*$/);
  if (!fencedJson) {
    throw new Error(`通过 microi_itdos MCP ${operation}失败：返回格式不含完整 JSON`);
  }
  let envelope;
  try {
    envelope = JSON.parse(fencedJson[1]);
  } catch (error) {
    throw new Error(`通过 microi_itdos MCP ${operation}失败：返回 JSON 无法解析`, { cause: error });
  }
  const execution = envelope?.Result;
  if (!execution || Number(execution.Code) !== 1) {
    throw new Error(
      `通过 microi_itdos MCP ${operation}失败：${String(execution?.Msg || '未知错误').slice(0, 800)}`,
    );
  }
  return execution;
}

function validateReadResourceNames(resourceNames) {
  if (!Array.isArray(resourceNames) || !resourceNames.length) {
    throw new Error('没有需要读取的官网资源');
  }
  const seen = new Set();
  for (const name of resourceNames) {
    if (!officialResourceNames.has(name)) {
      throw new Error(`MCP 读取资源不在固定白名单：${name || '(空)'}`);
    }
    if (seen.has(name)) throw new Error(`MCP 读取资源名称重复：${name}`);
    seen.add(name);
  }
}

function validatePublishChanges(changes) {
  if (!Array.isArray(changes) || !changes.length) throw new Error('没有需要发布的官网资源');
  for (const item of changes) {
    if (!officialResourceNames.has(item?.name)) {
      throw new Error(`MCP 发布资源不在固定白名单：${item?.name || '(空)'}`);
    }
    if (typeof item.content !== 'string' || !item.content.trim()) {
      throw new Error(`MCP 发布资源内容为空：${item.name}`);
    }
    validateOfficialPackageChangeLog(item.name, item.content);
    if (!/^[a-f0-9]{64}$/i.test(String(item.expectedRemoteSha256 || ''))) {
      throw new Error(`MCP 发布资源缺少有效的官网 SHA-256：${item.name}`);
    }
  }
}

function validateReconcileSnapshots(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length !== officialApplicationResourceNames.length) {
    throw new Error(`官方接口投影必须包含全部 ${officialApplicationResourceNames.length} 个应用资源快照`);
  }
  const expectedNames = new Set(officialApplicationResourceNames);
  const seenNames = new Set();
  const apiEngineKeys = new Set();
  let managedCount = 0;
  let createIfMissingCount = 0;
  for (const snapshot of snapshots) {
    if (!expectedNames.has(snapshot?.name) || seenNames.has(snapshot?.name)) {
      throw new Error(`官方接口投影资源名称无效或重复：${snapshot?.name || '(空)'}`);
    }
    if (!/^[a-f0-9]{64}$/i.test(String(snapshot.sha256 || ''))) {
      throw new Error(`官方接口投影资源缺少有效 SHA-256：${snapshot.name}`);
    }
    if (!Array.isArray(snapshot.apiEngineKeys)) {
      throw new Error(`官方接口投影资源缺少 ApiEngineKey 清单：${snapshot.name}`);
    }
    seenNames.add(snapshot.name);
    managedCount += Number(snapshot.managedCount || 0);
    createIfMissingCount += Number(snapshot.createIfMissingCount || 0);
    for (const key of snapshot.apiEngineKeys) {
      const normalized = String(key || '').trim().toLowerCase();
      if (!normalized || apiEngineKeys.has(normalized)) {
        throw new Error(`官方接口投影存在跨包重复或空 Key：${key || '(空)'}`);
      }
      apiEngineKeys.add(normalized);
    }
  }
  return {
    packageCount: snapshots.length,
    managedCount,
    createIfMissingCount,
    apiEngineKeys: [...apiEngineKeys].sort(),
  };
}

function validateReconcileExecution(execution, expected) {
  const data = execution?.Data;
  if (!data || Number(data.PackageCount) !== expected.packageCount
      || Number(data.ManagedCount) !== expected.managedCount
      || Number(data.CreateIfMissingCount) !== expected.createIfMissingCount
      || Number(data.VerifiedApiEngineCount) !== expected.apiEngineKeys.length
      || !/^[a-f0-9]{64}$/i.test(String(data.ProjectionSha256 || ''))) {
    throw new Error('官方接口投影返回的包数、策略计数、回读数或摘要不正确');
  }
  const actualKeys = Array.isArray(data.ApiEngineKeys)
    ? data.ApiEngineKeys.map(key => String(key).toLowerCase()).sort()
    : [];
  if (JSON.stringify(actualKeys) !== JSON.stringify(expected.apiEngineKeys)) {
    throw new Error('官方接口投影回读的 ApiEngineKey 闭包与九个已发布应用包不一致');
  }
  return data;
}

const liveApiEngineFields = Object.freeze([
  'ApiName', 'ApiEngineKey', 'ApiAddress', 'IsEnable', 'ApiRole',
  'AllowAnonymous', 'Files', 'Category', 'EnableLog', 'StopHttp', 'Timeout',
  'MaxStatements', 'LimitMemory', 'LimitRecursion', 'Lock', 'LockKey', 'ResponseFile',
  'ResponseType', 'TestParam', 'ApiRemark', 'V8Limit', 'V8Unlimited', 'Version',
  'ChangeHistory',
]);
const liveApiEngineDefaults = Object.freeze({
  IsEnable: 1,
  ApiRole: '[]',
  AllowAnonymous: 0,
  Files: '[]',
  Category: '',
  EnableLog: 0,
  StopHttp: 0,
  Timeout: 600,
  MaxStatements: 100000000,
  LimitMemory: 2048,
  LimitRecursion: 5000,
  Lock: 0,
  LockKey: '',
  ResponseFile: 0,
  ResponseType: '',
  TestParam: '',
  ApiRemark: '',
  V8Limit: 0,
  V8Unlimited: 0,
  ChangeHistory: '',
});
const numericLiveApiEngineFields = new Set([
  'IsEnable', 'AllowAnonymous', 'EnableLog', 'StopHttp', 'Timeout',
  'MaxStatements', 'LimitMemory', 'LimitRecursion', 'Lock', 'ResponseFile',
  'V8Limit', 'V8Unlimited', 'IsDeleted',
]);

function parseRawJsonToolResult(toolResult, operation) {
  const output = collectText(toolResult).trim();
  if (toolResult?.isError) {
    throw new Error(`通过 microi_itdos MCP ${operation}失败：${output || '未知错误'}`);
  }
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`通过 microi_itdos MCP ${operation}失败：返回值不是完整 JSON`, { cause: error });
  }
}

async function callCodexTool(client, action, params, operation, timeoutMilliseconds = 60_000) {
  const result = await client.request('tools/call', {
    name: 'microi_codex',
    arguments: { action, params },
  }, timeoutMilliseconds);
  return { result, operation };
}

function normalizeComparableLiveValue(name, value) {
  if (numericLiveApiEngineFields.has(name)) return Number(value || 0);
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

function parseVersionFromSource(source) {
  return String(source || '').match(/\bVersion\s*:\s*(v?\d+\.\d+\.\d+)\b/i)?.[1] || '';
}

function buildExpectedLiveEngine(source) {
  const expected = { Id: String(source?.Id || ''), IsDeleted: 0 };
  for (const fieldName of liveApiEngineFields) {
    let value = source?.[fieldName];
    if (fieldName === 'ApiName' && String(value ?? '') === '') {
      value = source?.Name || source?.ApiEngineKey;
    }
    if (fieldName === 'Version' && String(value ?? '') === '') {
      value = parseVersionFromSource(source?.ApiV8Code);
    }
    if (value == null && Object.hasOwn(liveApiEngineDefaults, fieldName)) {
      value = liveApiEngineDefaults[fieldName];
    }
    if (value != null) expected[fieldName] = value;
  }
  return expected;
}

function collectExpectedProjectionEngines(snapshots) {
  const projections = [];
  for (const snapshot of snapshots) {
    if (!Array.isArray(snapshot.apiEngines)
        || snapshot.apiEngines.length !== snapshot.apiEngineKeys.length) {
      throw new Error(`官方接口投影快照缺少可用于超时回读的完整接口模型：${snapshot.name}`);
    }
    for (const item of snapshot.apiEngines) {
      const key = String(item?.engine?.ApiEngineKey || '').trim();
      if (!key || !['Managed', 'CreateIfMissing'].includes(item?.policy)) {
        throw new Error(`官方接口投影超时回读模型无效：${snapshot.name} -> ${key || '(空)'}`);
      }
      projections.push({ packageName: snapshot.name, key, ...item });
    }
  }
  return projections;
}

async function readLiveEngineMetadata(client, projections) {
  const fields = ['Id', 'IsDeleted', ...liveApiEngineFields];
  const rows = [];
  const batchSize = 10;
  for (let offset = 0; offset < projections.length; offset += batchSize) {
    const keys = projections.slice(offset, offset + batchSize).map(item => item.key);
    const operation = `回读官网 live 接口元数据 ${offset / batchSize + 1}`;
    const { result } = await callCodexTool(
      client,
      'microi_get_table_data',
      {
        tableName: 'sys_apiengine',
        query: {
          _Where: [['ApiEngineKey', 'In', keys]],
          _SelectFields: fields,
          _PageIndex: 1,
          _PageSize: batchSize + 1,
        },
      },
      operation,
    );
    const page = parseRawJsonToolResult(result, operation);
    if (!Array.isArray(page)) throw new Error(`${operation}失败：返回值不是数组`);
    rows.push(...page);
  }
  return rows;
}

function parseSourceSha256(toolResult, operation) {
  const output = collectText(toolResult);
  if (toolResult?.isError) {
    throw new Error(`通过 microi_itdos MCP ${operation}失败：${output || '未知错误'}`);
  }
  const match = output.match(/Full source SHA-256:\s*([a-f0-9]{64})/i);
  if (!match) throw new Error(`通过 microi_itdos MCP ${operation}失败：缺少完整源码 SHA-256`);
  return match[1].toLowerCase();
}

async function readManagedSourceHashes(client, projections) {
  const managed = projections.filter(item => item.policy === 'Managed');
  const hashes = new Map();
  let cursor = 0;
  const worker = async () => {
    while (cursor < managed.length) {
      const current = managed[cursor++];
      const operation = `回读官网 live 接口源码摘要 ${current.key}`;
      const { result } = await callCodexTool(
        client,
        'microi_get_engine_code',
        { apiEngineKey: current.key, charOffset: 0, maxChars: 1000 },
        operation,
      );
      hashes.set(current.key.toLowerCase(), parseSourceSha256(result, operation));
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, managed.length) }, worker));
  return hashes;
}

async function recoverReconcileAfterAmbiguousTimeout(client, snapshots, originalError) {
  if (!/(?:HTTP\s*524|Origin Time-out|timed?\s*out|timeout)/i.test(String(originalError?.message || ''))) {
    throw originalError;
  }
  const projections = collectExpectedProjectionEngines(snapshots);
  const [rows, sourceHashes] = await Promise.all([
    readLiveEngineMetadata(client, projections),
    readManagedSourceHashes(client, projections),
  ]);
  const byKey = new Map();
  for (const row of rows) {
    const key = String(row?.ApiEngineKey || '').toLowerCase();
    if (!key || byKey.has(key)) throw new Error(`官网 live 接口超时回读存在空 Key 或重复 Key：${key || '(空)'}`);
    byKey.set(key, row);
  }
  const projectionRows = [];
  for (const projection of projections) {
    const normalizedKey = projection.key.toLowerCase();
    const current = byKey.get(normalizedKey);
    if (!current) throw new Error(`官网 live 接口超时回读缺少：${projection.key}`, { cause: originalError });
    if (projection.policy === 'Managed') {
      const expected = buildExpectedLiveEngine(projection.engine);
      for (const fieldName of ['Id', 'IsDeleted', ...liveApiEngineFields]) {
        if (expected[fieldName] == null) continue;
        if (normalizeComparableLiveValue(fieldName, current[fieldName])
            !== normalizeComparableLiveValue(fieldName, expected[fieldName])) {
          throw new Error(`官网 Managed 接口超时回读不一致：${projection.key}.${fieldName}`, { cause: originalError });
        }
      }
      const expectedSourceHash = createHash('sha256')
        .update(String(projection.engine.ApiV8Code || ''), 'utf8').digest('hex');
      if (sourceHashes.get(normalizedKey) !== expectedSourceHash) {
        throw new Error(`官网 Managed 接口超时回读源码不一致：${projection.key}`, { cause: originalError });
      }
      projectionRows.push(
        `${projection.key}|Managed|${expectedSourceHash}|${String(expected.Version || '')}`
        + `|${String(expected.ApiAddress || '')}|${String(expected.Id || '')}`,
      );
    } else {
      projectionRows.push(`${projection.key}|CreateIfMissing|present`);
    }
  }
  projectionRows.sort();
  const expected = validateReconcileSnapshots(snapshots);
  return {
    PackageCount: expected.packageCount,
    ManagedCount: expected.managedCount,
    CreateIfMissingCount: expected.createIfMissingCount,
    ManagedCreated: 0,
    ManagedUpdated: 0,
    ManagedUnchanged: expected.managedCount,
    TenantHookCreated: 0,
    TenantHookPreserved: expected.createIfMissingCount,
    VerifiedApiEngineCount: projectionRows.length,
    ProjectionSha256: createHash('sha256').update(projectionRows.join('\n'), 'utf8').digest('hex'),
    ApiEngineKeys: projectionRows.map(row => row.split('|')[0]),
    PackageHashes: Object.fromEntries(snapshots.map(item => [item.name, item.sha256])),
    RecoveredAfterAmbiguousTimeout: true,
  };
}

function createLineJsonRpcClient(server, configPath) {
  const configDirectory = dirname(configPath);
  const cwd = server.cwd
    ? (isAbsolute(server.cwd) ? server.cwd : resolve(configDirectory, server.cwd))
    : configDirectory;
  const child = spawn(String(server.command), server.args.map(String), {
    cwd,
    env: {
      ...process.env,
      ...Object.fromEntries(Object.entries(server.env || {}).map(([key, value]) => [key, String(value)])),
      MICROI_CODEX_MODE: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let nextId = 1;
  let outputBuffer = '';
  let errorOutput = '';
  // stdio data events may split one UTF-8 code point across Buffer chunks.
  // Calling chunk.toString('utf8') independently replaces the split bytes with
  // U+FFFD, corrupting large JSON resources and invalidating their SHA-256.
  const outputDecoder = new StringDecoder('utf8');
  const errorDecoder = new StringDecoder('utf8');
  let stopped = false;
  const pending = new Map();

  const rejectPending = error => {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    pending.clear();
  };

  child.stderr.on('data', chunk => {
    errorOutput = (errorOutput + errorDecoder.write(chunk)).slice(-4000);
  });
  child.stdout.on('data', chunk => {
    outputBuffer += outputDecoder.write(chunk);
    let newlineIndex;
    while ((newlineIndex = outputBuffer.indexOf('\n')) >= 0) {
      const line = outputBuffer.slice(0, newlineIndex).trim();
      outputBuffer = outputBuffer.slice(newlineIndex + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        rejectPending(new Error('microi_itdos MCP 返回了无法解析的协议数据'));
        continue;
      }
      if (message.id == null || !pending.has(message.id)) continue;
      const request = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) {
        request.reject(new Error(`microi_itdos MCP 调用失败：${message.error.message || '未知错误'}`));
      } else {
        request.resolve(message.result);
      }
    }
  });
  child.on('error', error => rejectPending(new Error(`无法启动 microi_itdos MCP：${error.message}`)));
  child.on('exit', code => {
    outputBuffer += outputDecoder.end();
    errorOutput = (errorOutput + errorDecoder.end()).slice(-4000);
    if (!stopped && pending.size) {
      const detail = errorOutput.trim().split(/\r?\n/).slice(-2).join('；');
      rejectPending(new Error(`microi_itdos MCP 提前退出（${code ?? 'unknown'}）${detail ? `：${detail}` : ''}`));
    }
  });

  const send = message => {
    if (child.stdin.destroyed) throw new Error('microi_itdos MCP 输入流已关闭');
    child.stdin.write(`${JSON.stringify(message)}\n`);
  };
  const request = (method, params, timeoutMilliseconds) => new Promise((resolvePromise, rejectPromise) => {
    const id = nextId;
    nextId += 1;
    const timer = setTimeout(() => {
      pending.delete(id);
      rejectPromise(new Error(`microi_itdos MCP ${method} 超时`));
    }, timeoutMilliseconds);
    pending.set(id, { resolve: resolvePromise, reject: rejectPromise, timer });
    try {
      send({ jsonrpc: '2.0', id, method, params });
    } catch (error) {
      clearTimeout(timer);
      pending.delete(id);
      rejectPromise(error);
    }
  });
  const notify = (method, params = {}) => send({ jsonrpc: '2.0', method, params });
  const stop = async () => {
    stopped = true;
    rejectPending(new Error('microi_itdos MCP 已关闭'));
    try { child.stdin.end(); } catch { /* 已关闭 */ }
    if (child.exitCode !== null) return;
    const waitForExit = timeoutMilliseconds => Promise.race([
      new Promise(resolvePromise => child.once('exit', resolvePromise)),
      new Promise(resolvePromise => setTimeout(resolvePromise, timeoutMilliseconds, 'timeout')),
    ]);
    try { child.kill('SIGTERM'); } catch { /* 已退出 */ }
    await waitForExit(2_000);
    if (child.exitCode === null) {
      try { child.kill('SIGKILL'); } catch { /* 已退出 */ }
      await waitForExit(2_000);
    }
  };
  return { request, notify, stop };
}

async function withConfiguredItDosMcp(options, callback) {
  const { path, server } = await findItDosMcpServer(
    options.startDirectory || process.cwd(),
    options.configPath || process.env.MICROI_UPGRADE_RESOURCE_MCP_CONFIG,
  );
  const client = createLineJsonRpcClient(server, path);
  try {
    await client.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'microi-upgrade-resource-sync', version: '1.1.0' },
    }, 30_000);
    client.notify('notifications/initialized');
    const listed = await client.request('tools/list', {}, 30_000);
    if (!Array.isArray(listed?.tools) || !listed.tools.some(item => item?.name === 'microi_codex')) {
      throw new Error('microi_itdos MCP 未提供 microi_codex 单入口');
    }
    return await callback(client, path);
  } finally {
    await client.stop();
  }
}

async function callOfficialResourceEngine(client, params, operation, timeoutMilliseconds = 180_000) {
  const result = await client.request('tools/call', {
    name: 'microi_codex',
    arguments: {
      action: 'microi_run_engine',
      params: {
        apiEngineKey: officialEngineKey,
        params,
        confirmExecution: officialEngineKey,
      },
    },
  }, timeoutMilliseconds);
  return parseCodexExecutionResult(result, operation);
}

export async function readResourcesViaConfiguredMcp(resourceNames, options = {}) {
  validateReadResourceNames(resourceNames);
  return withConfiguredItDosMcp(options, async (client, configPath) => {
    const resources = new Map();
    for (const name of resourceNames) {
      const execution = await callOfficialResourceEngine(
        client,
        { Name: name },
        `读取官网升级资源 ${name}`,
      );
      const data = execution.Data;
      if (!data || data.ResourceName !== name || data.Content == null) {
        throw new Error(`通过 microi_itdos MCP 读取 ${name} 失败：资源名或内容不正确`);
      }
      resources.set(name, data);
    }
    return { configPath, resources };
  });
}

export async function publishResourcesViaConfiguredMcp(changes, options = {}) {
  validatePublishChanges(changes);
  return withConfiguredItDosMcp(options, async (client, configPath) => {
    await callOfficialResourceEngine(client, {
      Action: 'PublishBatch',
      Resources: changes.map(item => ({
        Name: item.name,
        Content: item.content,
        ExpectedRemoteSha256: item.expectedRemoteSha256,
      })),
    }, '发布官网升级资源');
    return { configPath, resourceCount: changes.length };
  });
}

export async function reconcilePublishedApiEnginesViaConfiguredMcp(snapshots, options = {}) {
  const expected = validateReconcileSnapshots(snapshots);
  return withConfiguredItDosMcp(options, async (client, configPath) => {
    let data;
    try {
      const execution = await callOfficialResourceEngine(client, {
        Action: 'ReconcilePublishedApiEngines',
        Resources: snapshots.map(item => ({
          Name: item.name,
          ExpectedSha256: item.sha256,
        })),
      }, '投影并回读官网 live 接口引擎');
      data = validateReconcileExecution(execution, expected);
    } catch (error) {
      data = await recoverReconcileAfterAmbiguousTimeout(client, snapshots, error);
    }
    return {
      configPath,
      ...data,
    };
  });
}
