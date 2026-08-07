import { spawn } from 'node:child_process';
import { access, readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, parse, resolve } from 'node:path';

const officialApiBaseUrl = 'https://api.itdos.com';
const officialOsClient = 'itdos';
const officialEngineKey = 'get-microi-upgrade-resource';
const officialResourceNames = new Set([
  'import-package.js',
  'ai-app-publish-store.js',
  'official-resource-api.js',
  'app.microi.form-engine.json',
  'app.microi.module-engine.json',
  'app.microi.saas-engine.json',
  'app.microi.store.json',
]);

function normalizeApiBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '').toLowerCase();
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
  const configuredEntryIndex = validated.args.findIndex(value => (
    basename(String(value || '')).toLowerCase() === 'mcp-server.js'
  ));
  if (configuredEntryIndex < 0) {
    throw new Error(`${configPath} 的 microi_itdos args 中缺少 mcp-server.js`);
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
    if (!servers?.microi_itdos) {
      if (explicit) throw new Error(`${path} 中缺少 microi_itdos`);
      continue;
    }
    const validated = validateItDosMcpServer(servers.microi_itdos, path);
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
      ? '已找到 MCP 配置，但其中没有 microi_itdos'
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
    if (!/^[a-f0-9]{64}$/i.test(String(item.expectedRemoteSha256 || ''))) {
      throw new Error(`MCP 发布资源缺少有效的官网 SHA-256：${item.name}`);
    }
  }
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
    errorOutput = (errorOutput + chunk.toString('utf8')).slice(-4000);
  });
  child.stdout.on('data', chunk => {
    outputBuffer += chunk.toString('utf8');
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
