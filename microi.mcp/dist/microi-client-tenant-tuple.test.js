import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), { MicroiClient, resolveSseTenantConfig } = await import(pathToFileURL(path.join(root, 'src/microi-client.ts')).href);
async function fixture(run, handler) { const rows = [], tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'microi-tuple-protocol-')), file = path.join(tmp, 'asset.bin'); await fs.writeFile(file, 'file-fixture-012345'); const server = http.createServer(async (req, res) => { const parts = []; for await (const p of req)
    parts.push(Buffer.from(p)); const row = { url: req.url || '', headers: req.headers, body: Buffer.concat(parts) }; rows.push(row); const result = handler?.(row, rows.length) || {}; res.statusCode = result.status || 200; res.setHeader('Content-Type', 'application/json'); if (result.token || row.url.includes('/Login') || row.url.includes('/RefreshToken'))
    res.setHeader('authorization', result.token || 'fixture-new-token'); res.end(JSON.stringify({ Code: result.code ?? 1, Data: { Fixture: true }, Msg: '' })); }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const address = server.address(); assert.ok(address && typeof address === 'object'); try {
    await run({ base: 'http://127.0.0.1:' + address.port, rows, file });
}
finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(() => resolve()));
    await fs.rm(tmp, { recursive: true, force: true });
} }
const typed = (base) => new MicroiClient({ apiBaseUrl: base, username: 'fixture-user', password: 'fixture-password', osClient: 'fixture', osClientType: 'Product', osClientNetwork: 'Internal', token: 'fixture-old-token' });
const tuple = (row) => { assert.equal(row.headers.osclient, 'fixture'); assert.equal(row.headers.osclienttype, 'Product'); assert.equal(row.headers.osclientnetwork, 'Internal'); assert.ok(typeof row.headers.did === 'string'); };
test('真实 Login 表单和 headers 同时携带三参数，凭据不落证据', async () => fixture(async ({ base, rows }) => { const c = new MicroiClient({ apiBaseUrl: base, username: 'fixture-user', password: 'fixture-password', osClient: 'fixture', osClientType: 'Product', osClientNetwork: 'Internal' }); try {
    await c.login();
    assert.equal(rows.length, 1);
    tuple(rows[0]);
    const body = new URLSearchParams(rows[0].body.toString());
    assert.equal(body.get('OsClient'), 'fixture');
    assert.equal(body.get('OsClientType'), 'Product');
    assert.equal(body.get('OsClientNetwork'), 'Internal');
    assert.equal(body.get('_ClientType'), 'MCP');
}
finally {
    c.destroy();
} }));
test('真实 Refresh body/header 和替代token后请求保留本元组', async () => fixture(async ({ base, rows }) => { const c = typed(base); try {
    assert.equal(await c.refreshTokenNow(), true);
    await c.getStatus();
    assert.equal(rows.length, 2);
    rows.forEach(tuple);
    const body = JSON.parse(rows[0].body.toString());
    assert.equal(body.OsClientType, 'Product');
    assert.equal(body.OsClientNetwork, 'Internal');
    assert.equal(body.authorization, 'fixture-old-token');
    assert.equal(rows[1].headers.authorization, 'Bearer fixture-new-token');
}
finally {
    c.destroy();
} }));
test('JSON正文保持既有业务字段，坐标从冻结headers传输', async () => fixture(async ({ base, rows }) => { const c = typed(base), body = { OsClient: 'fixture', Action: 'Read', Param: { Id: 'owned-row' } }; try {
    await c.post('/fixture-json', body);
    tuple(rows[0]);
    assert.deepEqual(JSON.parse(rows[0].body.toString()), body);
}
finally {
    c.destroy();
} }));
test('GET真实请求同headers，不隐式追加Type/Network业务query', async () => fixture(async ({ base, rows }) => { const c = typed(base); try {
    await c.get('/fixture-get', { Id: 'owned-row' });
    tuple(rows[0]);
    assert.equal(rows[0].url, '/fixture-get?Id=owned-row');
}
finally {
    c.destroy();
} }));
test('原生JSON fallback底层同坐标且字节完全保留', async () => fixture(async ({ base, rows }) => { const c = typed(base), body = JSON.stringify({ OsClient: 'fixture', Action: 'Read' }); try {
    await c.requestJsonNative('POST', base + '/fixture-native-json', { Authorization: 'Bearer fixture-old-token', did: 'fixture-did' }, body, 1000);
    tuple(rows[0]);
    assert.equal(rows[0].body.toString(), body);
}
finally {
    c.destroy();
} }));
for (const native of [false, true])
    test('真实' + (native ? 'native' : 'fetch') + ' multipart流式字段及headers同三参数', async () => fixture(async ({ base, rows, file }) => { const c = typed(base); try {
        const fields = { OsClient: 'fixture', RequestId: 'fixed-request' };
        if (native)
            await c.requestMultipartFileNative('/fixture-multipart', fields, file, 'asset.bin', 1000);
        else
            await c.requestMultipartFile('/fixture-multipart', fields, file, 'asset.bin', 'initial', 1000, undefined, false);
        tuple(rows[0]);
        const body = rows[0].body.toString();
        for (const [k, v] of Object.entries({ OsClient: 'fixture', OsClientType: 'Product', OsClientNetwork: 'Internal' }))
            assert.ok(body.includes('name="' + k + '"\r\n\r\n' + v + '\r\n'));
        assert.ok(body.includes('file-fixture-012345'));
    }
    finally {
        c.destroy();
    } }));
test('真实binary分片同三参数，原scope/query/范围字节保持', async () => fixture(async ({ base, rows, file }) => { const c = typed(base); try {
    await c.requestBinaryFileRange('/fixture-binary', { SessionId: 'original-session', PartNumber: '1' }, file, 4, 7, 'initial', 1000);
    tuple(rows[0]);
    assert.deepEqual(rows[0].body, Buffer.from('file-fixture-012345').subarray(4, 11));
    assert.equal(rows[0].url, '/fixture-binary?SessionId=original-session&PartNumber=1');
}
finally {
    c.destroy();
} }));
test('401→真实续签→原业务重试使用相同坐标和原正文', async () => fixture(async ({ base, rows }) => { const c = typed(base), body = { OsClient: 'fixture', RequestId: 'same-original-request' }; try {
    assert.equal((await c.post('/fixture-recovery', body)).Code, 1);
    assert.equal(rows.length, 3);
    rows.forEach(tuple);
    assert.deepEqual(rows[0].body, rows[2].body);
    assert.ok(rows[1].url.includes('/RefreshToken'));
    assert.equal(rows[2].headers.authorization, 'Bearer fixture-new-token');
}
finally {
    c.destroy();
} }, (row, n) => n === 1 ? { status: 401, code: 1001 } : { token: row.url.includes('/RefreshToken') ? 'fixture-new-token' : undefined }));
test('省略Type/Network保留旧 Login/Refresh/JSON/multipart/binary wire', async () => fixture(async ({ base, rows, file }) => {
    // 公开应用资产和私有源码入口原本已含 OsClient；新增坐标不得改它的值、重复字段或文件字节。
    for (const osClient of ['fixture', undefined]) {
        const start = rows.length, c = new MicroiClient({ apiBaseUrl: base, username: 'fixture-user', password: 'fixture-password', osClient });
        try {
            await c.login();
            await c.refreshTokenNow();
            await c.post('/fixture-legacy-json', { A: 1 });
            const fields = { OsClient: osClient || '', RequestId: 'fixed-request' };
            await c.requestMultipartFile('/fixture-legacy-fetch', fields, file, 'asset.bin', 'initial', 1000, undefined, false);
            await c.requestMultipartFileNative('/fixture-legacy-native', fields, file, 'asset.bin', 1000);
            await c.requestBinaryFileRange('/fixture-legacy-binary', { Part: '1' }, file, 0, 2, 'initial', 1000);
            await c.uploadApplicationAssetStream({ FilePath: file, AppIdOrKey: 'fixture-app', VersionNo: '1.0.0', RelativePath: 'assets/fixture.bin', ExpectedSha256: 'a'.repeat(64), RequestId: 'fixed-request', TimeoutMs: 1000 });
            await c.stageMicroServiceSourceFile({ FilePath: file, AppIdOrKey: 'fixture-app', RelativePath: 'src/fixture.ts', ExpectedSha256: 'a'.repeat(64), ExpectedSize: Buffer.byteLength('file-fixture-012345'), DeliveryBatchId: 'fixed-batch', TimeoutMs: 1000 });
            const captured = rows.slice(start);
            assert.equal(captured.length, 8);
            for (const r of captured) {
                assert.equal(r.headers.osclient, osClient);
                assert.equal(r.headers.osclienttype, undefined);
                assert.equal(r.headers.osclientnetwork, undefined);
                assert.ok(!r.body.toString().includes('OsClientType'));
                assert.ok(!r.body.toString().includes('OsClientNetwork'));
            }
            assert.deepEqual(JSON.parse(captured[2].body.toString()), { A: 1 });
            assert.equal(new URLSearchParams(captured[0].body.toString()).get('OsClient'), osClient || null);
            assert.deepEqual(JSON.parse(captured[1].body.toString()), { authorization: 'fixture-new-token', ...(osClient ? { OsClient: osClient } : {}), _ClientType: 'MCP' });
            for (const n of [3, 4, 6, 7]) {
                const body = captured[n].body.toString();
                assert.equal((body.match(/name="OsClient"\r\n/g) || []).length, 1);
                assert.ok(body.includes('name="OsClient"\r\n\r\n' + (osClient || '') + '\r\n'));
                assert.ok(body.includes('file-fixture-012345'));
            }
        }
        finally {
            c.destroy();
        }
    }
}));
test('配置注入/非字符串/未绑定Type/Network在任何网络前拒绝', () => { for (const patch of [{ osClient: 'fixture\r\nX-Injected:yes' }, { osClientType: 'Product\n' }, { osClientNetwork: '网络' }, { osClientNetwork: 'a'.repeat(129) }, { osClientType: ['Product'] }, { osClient: undefined, osClientType: 'Product' }, { osClient: undefined, osClientNetwork: 'Internal' }]) {
    assert.throws(() => new MicroiClient({ apiBaseUrl: 'http://127.0.0.1:1', username: '', password: '', ...patch }), /租户坐标|Type\/Network/);
} });
test('顶层冲突/重复alias不发HTTP；嵌套业务TargetOsClient保留', async () => fixture(async ({ base, rows }) => { const c = typed(base); try {
    for (const body of [{ OsClient: 'other' }, { osclienttype: 'App' }, { OsClientNetwork: 'Internet' }, { OsClient: 'fixture', osclient: 'fixture' }, { OsClientNetwork: null }, { OsClientType: { value: 'Product' } }])
        await assert.rejects(c.post('/fixture-conflict', body), /冲突|重复/);
    assert.equal(rows.length, 0);
    await c.post('/fixture-control', { OsClient: 'fixture', TargetOsClient: 'other', Param: { OsClient: 'other' } });
    assert.equal(rows.length, 1);
    tuple(rows[0]);
}
finally {
    c.destroy();
} }));
test('query/path冲突、重复坐标及binary/multipart均在网络前拒绝', async () => fixture(async ({ base, rows, file }) => { const c = typed(base); try {
    await assert.rejects(c.get('/fixture?OsClient=other'), /冲突/);
    await assert.rejects(c.get('/fixture?OsClient=fixture&osclient=fixture'), /重复/);
    await assert.rejects(c.post('/apiengine/key--OsClient--other--', {}), /冲突/);
    await assert.rejects(c.requestBinaryFileRange('/fixture', { OsClientNetwork: 'Internet' }, file, 0, 1), /冲突/);
    await assert.rejects(c.requestMultipartFile('/fixture', { OsClientType: 'App' }, file, 'asset.bin'), /冲突/);
    await assert.rejects(c.requestMultipartFileNative('/fixture', { OsClientType: 'App' }, file, 'asset.bin', 1000), /冲突/);
    assert.equal(rows.length, 0);
}
finally {
    c.destroy();
} }));
test('外部config修改不能切换已构造client的tenant或refresh', async () => fixture(async ({ base, rows }) => { const config = { apiBaseUrl: base, username: '', password: '', osClient: 'fixture', osClientType: 'Product', osClientNetwork: 'Internal', token: 'fixture-old-token' }, c = new MicroiClient(config); try {
    config.osClient = 'other';
    config.osClientNetwork = 'Internet';
    await c.getStatus();
    await c.refreshTokenNow();
    rows.forEach(tuple);
}
finally {
    c.destroy();
} }));
test('SSE元组解析保持省略默认、显式当前会话并拒重复/冲突/注入', () => { assert.equal(typeof resolveSseTenantConfig, 'function'); const defaults = { apiBaseUrl: 'http://127.0.0.1:1', username: '', password: '', osClient: 'fixture', osClientType: 'Product', osClientNetwork: 'Internet' }; assert.deepEqual(resolveSseTenantConfig({}, defaults), { osClient: 'fixture', osClientType: 'Product', osClientNetwork: 'Internet' }); assert.deepEqual(resolveSseTenantConfig({ 'x-microi-osclientnetwork': 'Internal' }, defaults), { osClient: 'fixture', osClientType: 'Product', osClientNetwork: 'Internal' }); for (const headers of [{ 'x-microi-osclientnetwork': ['Internal', 'Internet'] }, { 'x-microi-osclientnetwork': 'Internal, Internet' }, { 'x-microi-osclientnetwork': 'Internal\r\nX:1' }, { 'x-microi-osclientnetwork': 'Internal', osclientnetwork: 'Internet' }, { 'x-microi-osclient': '' }])
    assert.throws(() => resolveSseTenantConfig(headers, defaults), /SSE|租户坐标|Type\/Network/); });
test('真实SSE ingress每会话显式Type/Network独立转发，不复用默认网络', async () => fixture(async ({ base, rows }) => { const portServer = http.createServer(); await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve)); const p = portServer.address(); assert.ok(p && typeof p === 'object'); const port = p.port; await new Promise(resolve => portServer.close(() => resolve())); const node = spawn(process.execPath, ['--max-old-space-size=128', '--import', path.join(root, 'node_modules/tsx/dist/loader.mjs'), path.join(root, 'src/index.ts')], { cwd: root, env: { ...process.env, MCP_TRANSPORT: 'sse', MCP_PORT: String(port), MICROI_API_URL: base, MICROI_USERNAME: 'fixture-user', MICROI_PASSWORD: 'fixture-password', MICROI_OS_CLIENT: 'fixture', MICROI_OS_CLIENT_TYPE: 'Product', MICROI_OS_CLIENT_NETWORK: 'Internet', MICROI_MCP_DID: 'MCP:tuple-SSE-fixture', MICROI_TOKEN: '', MICROI_TOKEN_FILE: '', MICROI_WORKSPACE_CREDENTIAL_FILE: '' }, stdio: ['ignore', 'ignore', 'pipe'] }); let diagnostics = ''; node.stderr.on('data', b => { diagnostics += b.toString(); }); const abort = new AbortController(); try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
        if (node.exitCode !== null)
            throw Error('OwnedSSEprocess exited before fixture readiness');
        try {
            const r = await fetch('http://127.0.0.1:' + port + '/health');
            if (r.status === 200) {
                ready = true;
                break;
            }
        }
        catch { }
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(ready, true, 'Bounded owned SSE process readiness');
    const response = await fetch('http://127.0.0.1:' + port + '/sse', { headers: { 'X-Microi-OsClient': 'fixture', 'X-Microi-OsClientType': 'Product', 'X-Microi-OsClientNetwork': 'Internal' }, signal: abort.signal });
    assert.equal(response.status, 200);
    const read = response.body.getReader();
    await read.read();
    assert.equal(rows.length, 1);
    tuple(rows[0]);
    const body = new URLSearchParams(rows[0].body.toString());
    assert.equal(body.get('OsClientNetwork'), 'Internal');
    await read.cancel();
}
finally {
    abort.abort();
    node.kill('SIGTERM');
    if (node.exitCode === null)
        await new Promise(resolve => node.once('exit', () => resolve()));
    assert.ok(!diagnostics.includes('fixture-password'));
} }));
//# sourceMappingURL=microi-client-tenant-tuple.test.js.map