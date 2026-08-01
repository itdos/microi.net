import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from '@modelcontextprotocol/sdk/client/stdio.js';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultServerEntry = path.join(moduleDirectory, 'dist', 'index.js');

const forwardedMicroiEnvironmentKeys = [
  'MICROI_API_URL',
  'MICROI_USERNAME',
  'MICROI_PASSWORD',
  'MICROI_OS_CLIENT',
  'MICROI_OS_CLIENT_TYPE',
  'MICROI_OS_CLIENT_NETWORK',
  'MICROI_RSA_PUBLIC_KEY',
  'MICROI_TOKEN',
  'MICROI_TOKEN_FILE',
  'MICROI_AUTH_RECOVERY_DIR',
  'MICROI_MCP_DID',
  'MICROI_LABEL_BASE64',
];

function parseArguments(rawArguments) {
  if (!rawArguments) return {};
  const parsed = JSON.parse(rawArguments);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Tool arguments must be a JSON object.');
  }
  return parsed;
}

function buildServerEnvironment(sourceEnvironment) {
  const result = {
    ...getDefaultEnvironment(),
    MCP_TRANSPORT: 'stdio',
    MICROI_CODEX_MODE: sourceEnvironment.MICROI_CODEX_MODE === '1' ? '1' : '0',
  };
  for (const key of forwardedMicroiEnvironmentKeys) {
    if (sourceEnvironment[key]) result[key] = sourceEnvironment[key];
  }
  return result;
}

function validateConfiguration(environment) {
  if (!environment.MICROI_API_URL) {
    throw new Error('Missing MICROI_API_URL.');
  }
  if (!environment.MICROI_OS_CLIENT) {
    throw new Error('Missing MICROI_OS_CLIENT.');
  }
  const hasToken = Boolean(environment.MICROI_TOKEN || environment.MICROI_TOKEN_FILE);
  const hasCredentials = Boolean(environment.MICROI_USERNAME && environment.MICROI_PASSWORD);
  if (!hasToken && !hasCredentials) {
    throw new Error('Set MICROI_TOKEN/MICROI_TOKEN_FILE or both MICROI_USERNAME and MICROI_PASSWORD.');
  }
}

function redactText(value, sourceEnvironment) {
  let result = String(value || '');
  for (const secret of [sourceEnvironment.MICROI_PASSWORD, sourceEnvironment.MICROI_TOKEN]) {
    if (secret) result = result.split(secret).join('[REDACTED]');
  }
  return result;
}

function runSelfTest() {
  const fixtureEnvironment = {
    MICROI_API_URL: 'https://example.invalid',
    MICROI_OS_CLIENT: 'fixture',
    MICROI_USERNAME: 'fixture-user',
    MICROI_PASSWORD: 'fixture-secret',
  };
  const childEnvironment = buildServerEnvironment(fixtureEnvironment);
  validateConfiguration(childEnvironment);
  assert.deepEqual(parseArguments('{"tableName":"sys_microistore","pageSize":3}'), {
    tableName: 'sys_microistore',
    pageSize: 3,
  });
  assert.equal(childEnvironment.MICROI_PASSWORD, 'fixture-secret');
  const safeSummary = JSON.stringify({
    apiUrl: childEnvironment.MICROI_API_URL,
    osClient: childEnvironment.MICROI_OS_CLIENT,
    auth: childEnvironment.MICROI_USERNAME && childEnvironment.MICROI_PASSWORD
      ? 'username/password'
      : 'token',
  });
  assert.equal(safeSummary.includes('fixture-secret'), false);
  assert.equal(redactText('failed fixture-secret', fixtureEnvironment), 'failed [REDACTED]');
  process.stdout.write(`${JSON.stringify({ ok: true, mode: 'offline-self-test' })}\n`);
}

async function main() {
  const toolName = process.argv[2];
  if (toolName === '--self-test') {
    runSelfTest();
    return;
  }
  if (!toolName || toolName.startsWith('-')) {
    throw new Error('Usage: node invoke-stdio-tool.mjs <tool-name> [tool-arguments-json]');
  }

  const serverEnvironment = buildServerEnvironment(process.env);
  validateConfiguration(serverEnvironment);
  const toolArguments = parseArguments(
    process.env.MICROI_MCP_TOOL_ARGS_JSON || process.argv[3] || '{}',
  );
  const serverEntry = process.env.MICROI_MCP_SERVER_ENTRY
    ? path.resolve(process.env.MICROI_MCP_SERVER_ENTRY)
    : defaultServerEntry;
  const timeoutMs = Math.max(
    1_000,
    Number.parseInt(process.env.MICROI_MCP_CALL_TIMEOUT_MS || '120000', 10) || 120_000,
  );

  let childStderr = '';
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    cwd: moduleDirectory,
    env: serverEnvironment,
    stderr: 'pipe',
  });
  transport.stderr?.on('data', chunk => {
    childStderr = `${childStderr}${String(chunk)}`.slice(-8_192);
  });

  const client = new Client({ name: 'microi-stdio-tool-invoker', version: '1.0.0' });
  try {
    await client.connect(transport);
    const tools = await client.listTools(undefined, { timeout: timeoutMs });
    if (!tools.tools.some(tool => tool.name === toolName)) {
      throw new Error(`MCP tool is not exposed in the selected mode: ${toolName}`);
    }
    const result = await client.callTool(
      { name: toolName, arguments: toolArguments },
      undefined,
      { timeout: timeoutMs, maxTotalTimeout: timeoutMs },
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.isError) process.exitCode = 2;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stderrSuffix = childStderr.trim()
      ? `\nMCP server stderr:\n${redactText(childStderr.trim(), process.env)}`
      : '';
    throw new Error(`${redactText(message, process.env)}${stderrSuffix}`);
  } finally {
    await client.close().catch(() => undefined);
  }
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
