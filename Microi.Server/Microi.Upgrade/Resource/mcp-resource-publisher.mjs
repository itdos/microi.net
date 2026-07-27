import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, parse, resolve } from 'node:path';

const officialApiBaseUrl = 'https://api.itdos.com';
const officialOsClient = 'itdos';
const officialEngineKey = 'get-microi-upgrade-resource';
const officialResourceNames = new Set([
  'import-package.js',
  'ai-app-publish-store.js',
  'official-resource-api.js',
  'app.microi.form-engine.json',
  'app.microi.module-engine.json',
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
  for (const path of candidates) {
    const config = await readJson(path);
    if (!config) continue;
    foundConfig = true;
    const servers = config.mcpServers || config.servers;
    if (!servers?.microi_itdos) {
      if (explicit) throw new Error(`${path} 中缺少 microi_itdos`);
      continue;
    }
    const server = validateItDosMcpServer(servers.microi_itdos, path);
    return { path, server };
  }
  throw new Error(
    foundConfig
      ? '已找到 MCP 配置，但其中没有 microi_itdos'
      : '未找到 .mcp.json、.vscode/mcp.json 或 .cursor/mcp.json',
  );
}

function collectText(toolResult) {
  return Array.isArray(toolResult?.content)
    ? toolResult.content.filter(item => item?.type === 'text').map(item => item.text).join('\n')
    : '';
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
  const stop = () => {
    stopped = true;
    rejectPending(new Error('microi_itdos MCP 已关闭'));
    try { child.stdin.end(); } catch { /* 已关闭 */ }
    try { child.kill('SIGTERM'); } catch { /* 已退出 */ }
  };
  return { request, notify, stop };
}

export async function publishResourcesViaConfiguredMcp(changes, options = {}) {
  validatePublishChanges(changes);
  const { path, server } = await findItDosMcpServer(
    options.startDirectory || process.cwd(),
    options.configPath || process.env.MICROI_UPGRADE_RESOURCE_MCP_CONFIG,
  );
  const client = createLineJsonRpcClient(server, path);
  try {
    await client.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'microi-upgrade-resource-sync', version: '1.0.0' },
    }, 30_000);
    client.notify('notifications/initialized');
    const result = await client.request('tools/call', {
      name: 'microi_codex',
      arguments: {
        action: 'microi_run_engine',
        params: {
          apiEngineKey: officialEngineKey,
          params: {
            Action: 'PublishBatch',
            Resources: changes.map(item => ({
              Name: item.name,
              Content: item.content,
              ExpectedRemoteSha256: item.expectedRemoteSha256,
            })),
          },
          confirmExecution: officialEngineKey,
        },
      },
    }, 180_000);
    const text = collectText(result);
    if (result?.isError || !/-\s*\*\*Code\*\*:\s*1(?:\s|$)/m.test(text)) {
      const message = (text.match(/-\s*\*\*Message\*\*:\s*(.+)/)?.[1] || text || '未知错误')
        .trim()
        .slice(0, 800);
      throw new Error(`通过 microi_itdos MCP 发布官网升级资源失败：${message}`);
    }
    return { configPath: path, resourceCount: changes.length };
  } finally {
    client.stop();
  }
}
