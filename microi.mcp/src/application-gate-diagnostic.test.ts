import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { MicroiClient } from './microi-client.js';
import { withApplicationGateDiagnostic } from './application-gate-diagnostic.js';

const binding = { osClient: 'child', apiBaseUrl: 'http://127.0.0.1:61601' };
test('legacy gate error keeps the selected tenant and does not claim a missing registration', () => {
  const raw = { Code: 0, Data: null, Msg: '上传失败：sys_osclients 门禁行数量必须为1，Actual=0' };
  const result = withApplicationGateDiagnostic(raw, binding);
  assert.equal(result.Code, 0);
  assert.equal(result.DataAppend?.BoundOsClient, 'child');
  assert.equal(result.DataAppend?.RequiresMainTenantLogin, false);
  assert.equal(result.DataAppend?.RegistrationMissingProven, false);
  assert.match(result.Msg, /不要索要主租户账号/);
  assert.equal(raw.Msg.includes('不要'), false);
});
test('authentication, protocol drain and unrelated missing rows retain their original semantics', () => {
  for (const Msg of ['Token expired', 'Drain 拒绝发布', 'sys_osclients 查询为空', 'GateEpoch 不匹配']) {
    const raw = { Code: 0, Data: null, Msg };
    assert.equal(withApplicationGateDiagnostic(raw, binding), raw);
  }
});
test('old API status blocks both stream upload and compatibility publish before any write', async () => {
  const calls: string[] = [];
  const server = http.createServer((req, res) => {
    calls.push(`${req.method} ${req.url}`);
    assert.equal(req.headers.osclient, 'child');
    assert.equal(req.headers.osclienttype, 'Product');
    assert.equal(req.headers.osclientnetwork, 'Internal');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ Code: 1, Data: {
      OsClient: 'child', ApplicationAssetStreamGateReady: false,
      ApplicationAssetStreamGateReadError: 'sys_osclients 门禁行数量必须为1，Actual=0',
    }, Msg: '' }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    const client = new MicroiClient({ ...binding, apiBaseUrl: `http://127.0.0.1:${address.port}`,
      token: 'fixture-only', username: '', password: '', osClientType: 'Product', osClientNetwork: 'Internal' });
    const status = await client.getStatus();
    assert.equal(status.Code, 1);
    assert.equal(status.DataAppend?.ReasonCode, 'APPLICATION_STREAM_GATE_UNAVAILABLE');
    const upload = await client.uploadApplicationAssetStream({
      AppIdOrKey: 'app', VersionNo: 'v1', FilePath: 'must-not-open.bin',
      RelativePath: 'index.html', ExpectedSha256: 'a'.repeat(64), RequestId: 'fixture-id',
    });
    const publish = await client.publishMicroService({ AppIdOrKey: 'app' });
    for (const response of [upload, publish]) {
      assert.equal(response.Code, 0);
      assert.match(response.Msg, /保持用户指定/);
    }
    assert.equal(calls.length, 3);
    assert.ok(calls.every(call => call.startsWith('GET ') && call.includes('GetStatus')));
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
