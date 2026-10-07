import assert from 'node:assert/strict';
import https from 'node:https';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('真实 MCP localhost HTTPS 保持默认和显式 TLS 校验，仅信任已配置 CA', { timeout: 30000 }, async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'microi-localhost-tls-'));
  const key = path.join(tmp, 'key.pem'), cert = path.join(tmp, 'cert.pem'), other = path.join(tmp, 'other.pem');
  let requests = 0;
  // 证书只属于本次临时协议夹具，不使用真实租户凭据或用户证书私钥。
  for (const [name, certificate] of [['localhost', cert], ['other', other]])
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=' + name,
      '-addext', 'subjectAltName=DNS:' + name, '-keyout', name === 'localhost' ? key : path.join(tmp, 'other-key.pem'), '-out', certificate],
    { timeout: 10000, stdio: 'ignore' });
  const server = https.createServer({ key: await fs.readFile(key), cert: await fs.readFile(cert) }, (_req, res) => {
    requests++;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ Code: 1, Data: { TlsFixture: true } }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    for (const mode of ['default', 'trusted-ca', 'unrelated-ca', 'explicit-strict']) {
      const env: Record<string, string> = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
      delete env.NODE_EXTRA_CA_CERTS; delete env.NODE_TLS_REJECT_UNAUTHORIZED;
      Object.assign(env, { MICROI_API_URL: 'https://localhost:' + address.port, MICROI_TOKEN: 'tls-fixture-token',
        MICROI_TOKEN_FILE: '', MICROI_OS_CLIENT: 'tls-fixture', MICROI_OS_CLIENT_TYPE: '', MICROI_OS_CLIENT_NETWORK: '',
        MICROI_USERNAME: '', MICROI_PASSWORD: '', MICROI_WORKSPACE_CREDENTIAL_FILE: '', MCP_TRANSPORT: 'stdio' });
      if (mode === 'trusted-ca') env.NODE_EXTRA_CA_CERTS = cert;
      if (mode === 'unrelated-ca') env.NODE_EXTRA_CA_CERTS = other;
      if (mode === 'explicit-strict') env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
      const transport = new StdioClientTransport({ command: process.execPath, args: ['--max-old-space-size=128', '--import',
        pathToFileURL(path.join(root, 'node_modules/tsx/dist/loader.mjs')).href, path.join(root, 'src/index.ts')], cwd: root, env, stderr: 'pipe' });
      const client = new Client({ name: 'localhost-tls-regression', version: '1' });
      const previousRequests = requests;
      let diagnostics = '';
      transport.stderr?.on('data', chunk => { diagnostics += chunk.toString(); });
      try {
        await client.connect(transport);
        const result = await client.callTool({ name: 'microi_get_status', arguments: {} }, undefined, { timeout: 5000 });
        if (mode === 'trusted-ca') {
          assert.notEqual(result.isError, true, mode);
          assert.equal(requests, previousRequests + 1, mode);
          assert.match(JSON.stringify(result.content), /TlsFixture/);
        } else {
          assert.equal(result.isError, true, mode + ' 必须拒绝未受信证书');
          assert.equal(requests, previousRequests, mode + ' 不应到达业务 HTTP 处理器');
        }
        assert.doesNotMatch(diagnostics, /disabled TLS certificate verification|NODE_TLS_REJECT_UNAUTHORIZED.*0/);
      } finally {
        await client.close();
        await transport.close();
      }
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
