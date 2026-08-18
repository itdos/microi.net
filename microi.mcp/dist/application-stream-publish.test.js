import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { MicroiClient } from './microi-client.js';
import { buildConservativeApplicationAssetStreamV3ImmutablePath, buildApplicationAssetStreamV3RouteSnapshot, buildApplicationAssetRequestId, buildApplicationFinalizeRequestId, buildLocalApplicationAssetManifest, encodeApplicationAssetStreamV3RelativePath, isLegacyApplicationStreamJValueFailure, resolveApplicationAssetStreamV3Contract, resolveLegacyApplicationStreamFallbackPolicy, runApplicationAssetStreamUpload, runApplicationDirectoryStreamPublish, tryLegacyMicroServiceStreamPublishFallback, validateLocalApplicationAssetSize, } from './server.js';
const EMPTY_ROUTE_SNAPSHOT_JSON = '[]';
const EMPTY_ROUTE_SNAPSHOT_HASH = crypto.createHash('sha256').update(EMPTY_ROUTE_SNAPSHOT_JSON, 'utf8').digest('hex');
test('MCP route canonical JSON 与 Node/Core 固定 UTF-8 hash 向量一致并拒绝非 safe integer', () => {
    const snapshot = buildApplicationAssetStreamV3RouteSnapshot([
        { title: '中文"引号', meta: { z: 9007199254740991, a: -9007199254740991 }, path: '/a' },
        { order: 0 },
    ]);
    assert.equal(snapshot.routeSnapshotHash, '39ac0b5c44884edcb6497dbf6a0fa8a2e95a1f2a968e8eaa10e7557e0443d47e');
    assert.throws(() => buildApplicationAssetStreamV3RouteSnapshot([{ order: 0.5 }]), /safe integer/u);
    assert.throws(() => buildApplicationAssetStreamV3RouteSnapshot([{ order: 9007199254740992 }]), /safe integer/u);
});
test('protocol v3 preflight rejects lower-camel route objects before any immutable asset upload', () => {
    const base = {
        appIdOrKey: 'v3-route-shape',
        versionNo: 'v1.0.0',
        directory: '.',
        publishMode: 'stage',
        protocolVersion: 3,
        expectedGateEpoch: '1',
        requestId: 'v3-route-shape-request',
        requestFingerprint: 'a'.repeat(64),
        deliveryBatchId: 'v3-route-shape-batch',
        sourceManifestHash: 'b'.repeat(64),
        runtimeManifestHash: 'c'.repeat(64),
        expectedCurrentVersion: 0,
        expectedAppVersion: null,
        expectedPublishFence: '0',
        expectedPublishRowVersion: '0',
        expectedVersionRowVersion: null,
        expectedActivePublishVersionId: null,
        expectedCommittedPublishVersionId: null,
        allowLegacyFallback: false,
    };
    const lowerCamelRoutes = [{ routePath: '/marketplace', pageKey: 'marketplace', entryPath: 'index.html' }];
    const lowerCamelSnapshot = buildApplicationAssetStreamV3RouteSnapshot(lowerCamelRoutes);
    assert.throws(() => resolveApplicationAssetStreamV3Contract({
        ...base,
        routes: lowerCamelRoutes,
        routeSnapshotJson: lowerCamelSnapshot.routeSnapshotJson,
        routeSnapshotHash: lowerCamelSnapshot.routeSnapshotHash,
    }, base.runtimeManifestHash), /RoutePath.*PascalCase/u);
    const protocolRoutes = [{ RoutePath: '/marketplace', PageKey: 'marketplace', EntryPath: 'index.html' }];
    const protocolSnapshot = buildApplicationAssetStreamV3RouteSnapshot(protocolRoutes);
    assert.ok(resolveApplicationAssetStreamV3Contract({
        ...base,
        routes: protocolRoutes,
        routeSnapshotJson: protocolSnapshot.routeSnapshotJson,
        routeSnapshotHash: protocolSnapshot.routeSnapshotHash,
    }, base.runtimeManifestHash));
});
test('protocol v3 nullable baselines reject empty strings to preserve Oracle/MySQL/SQL Server CAS parity', () => {
    const base = {
        appIdOrKey: 'v3-nullable-baseline',
        versionNo: 'v1.0.0',
        directory: '.',
        publishMode: 'stage',
        protocolVersion: 3,
        expectedGateEpoch: '1',
        requestId: 'v3-nullable-baseline-request',
        requestFingerprint: 'a'.repeat(64),
        deliveryBatchId: 'v3-nullable-baseline-batch',
        sourceManifestHash: 'b'.repeat(64),
        runtimeManifestHash: 'c'.repeat(64),
        routes: [],
        routeSnapshotJson: EMPTY_ROUTE_SNAPSHOT_JSON,
        routeSnapshotHash: EMPTY_ROUTE_SNAPSHOT_HASH,
        expectedCurrentVersion: 0,
        expectedAppVersion: null,
        expectedPublishFence: '0',
        expectedPublishRowVersion: '0',
        expectedVersionRowVersion: null,
        expectedActivePublishVersionId: null,
        expectedCommittedPublishVersionId: null,
        allowLegacyFallback: false,
    };
    assert.ok(resolveApplicationAssetStreamV3Contract(base, base.runtimeManifestHash));
    assert.throws(() => resolveApplicationAssetStreamV3Contract({ ...base, expectedAppVersion: '' }, base.runtimeManifestHash), /非空字符串或 null/u);
    assert.throws(() => resolveApplicationAssetStreamV3Contract({ ...base, expectedActivePublishVersionId: ' ' }, base.runtimeManifestHash), /非空字符串或 null/u);
});
function createTempDirectory() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'microi-stream-publish-'));
}
function parseToolJson(result) {
    const textBlock = result.content.find(item => item.type === 'text');
    if (!textBlock || textBlock.type !== 'text')
        throw new Error('tool result has no text content');
    return JSON.parse(textBlock.text);
}
test('buildLocalApplicationAssetManifest hashes ordinary files and skips source maps plus only root build evidence', async () => {
    const root = createTempDirectory();
    try {
        fs.mkdirSync(path.join(root, 'assets'));
        fs.mkdirSync(path.join(root, 'reports'));
        fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><script src="assets/app.js"></script>');
        fs.writeFileSync(path.join(root, 'assets', 'app.js'), 'window.microiStreamTest = true;');
        fs.writeFileSync(path.join(root, 'assets', 'app.js.map'), '{}');
        fs.writeFileSync(path.join(root, 'empty.txt'), '');
        fs.writeFileSync(path.join(root, '.microi-build-evidence.json'), '{"sourceRoot":"D:/private","builtAt":"2026-08-02T00:00:00Z"}');
        fs.writeFileSync(path.join(root, 'business.microi-build-evidence.json'), '{"business":true}');
        fs.writeFileSync(path.join(root, 'reports', '.microi-build-evidence.json'), '{"nestedBusiness":true}');
        const manifest = await buildLocalApplicationAssetManifest(root);
        assert.equal(manifest.assets.length, 5);
        assert.deepEqual(manifest.skippedSourceMaps, ['assets/app.js.map']);
        assert.deepEqual(manifest.skippedInternalEvidenceFiles, ['.microi-build-evidence.json']);
        assert.equal(manifest.assets.some(asset => asset.relativePath === '.microi-build-evidence.json'), false);
        assert.equal(manifest.assets.some(asset => asset.relativePath === 'business.microi-build-evidence.json'), true);
        assert.equal(manifest.assets.some(asset => asset.relativePath === 'reports/.microi-build-evidence.json'), true);
        assert.equal(manifest.assets.some(asset => fs.readFileSync(asset.absolutePath, 'utf8').includes('D:/private')), false);
        assert.equal(manifest.assets.filter(asset => asset.isEntry).length, 1);
        const js = manifest.assets.find(asset => asset.relativePath === 'assets/app.js');
        assert.equal(js?.sha256, crypto.createHash('sha256').update('window.microiStreamTest = true;').digest('hex'));
        assert.equal(manifest.assets.find(asset => asset.relativePath === 'empty.txt')?.size, 0);
        const expectedManifestHash = crypto.createHash('sha256')
            .update(manifest.assets.map(asset => `${asset.relativePath}\t${asset.sha256}\t${asset.size}`).join('\n'))
            .digest('hex');
        assert.equal(manifest.manifestHash, expectedManifestHash);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('buildLocalApplicationAssetManifest uses .NET ordinal path order for cross-runtime manifest hashes', async () => {
    const root = createTempDirectory();
    try {
        fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head></head><body>ordinal</body></html>');
        fs.writeFileSync(path.join(root, 'app.js'), 'window.ordinal = true;');
        fs.writeFileSync(path.join(root, 'THIRD-PARTY-NOTICES.txt'), 'notices');
        const manifest = await buildLocalApplicationAssetManifest(root);
        assert.deepEqual(manifest.assets.map(asset => asset.relativePath), ['THIRD-PARTY-NOTICES.txt', 'app.js', 'index.html']);
        const canonical = manifest.assets
            .map(asset => `${asset.relativePath}\t${asset.sha256}\t${asset.size}`)
            .join('\n');
        assert.equal(manifest.manifestHash, crypto.createHash('sha256').update(canonical).digest('hex'));
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('buildLocalApplicationAssetManifest rejects secrets and runaway project directories before upload', async () => {
    const secretRoot = createTempDirectory();
    const projectRoot = createTempDirectory();
    try {
        fs.writeFileSync(path.join(secretRoot, 'index.html'), 'ok');
        fs.writeFileSync(path.join(secretRoot, '.env.production'), 'SECRET=1');
        await assert.rejects(() => buildLocalApplicationAssetManifest(secretRoot), /密钥或环境配置/u);
        fs.writeFileSync(path.join(projectRoot, 'index.html'), 'ok');
        fs.mkdirSync(path.join(projectRoot, 'node_modules'));
        await assert.rejects(() => buildLocalApplicationAssetManifest(projectRoot), /真实编译输出目录/u);
    }
    finally {
        fs.rmSync(secretRoot, { recursive: true, force: true });
        fs.rmSync(projectRoot, { recursive: true, force: true });
    }
});
test('application stream accepts 5 GiB logical assets and preserves optional caller safety cap', async () => {
    const fiveGiB = 5 * 1024 * 1024 * 1024;
    assert.doesNotThrow(() => validateLocalApplicationAssetSize('assets/installer.exe', fiveGiB, fiveGiB));
    assert.throws(() => validateLocalApplicationAssetSize('assets/final.bin', 1, fiveGiB + 1, fiveGiB), /调用方安全上限 5368709120 bytes.*上传前中止/u);
    const root = createTempDirectory();
    let uploadCalls = 0;
    try {
        fs.writeFileSync(path.join(root, 'index.html'), 'larger-than-custom-preflight-cap');
        const fakeClient = {
            uploadApplicationAssetStream: async () => {
                uploadCalls += 1;
                return { Code: 1, Data: {}, Msg: '' };
            },
        };
        const result = await runApplicationDirectoryStreamPublish(fakeClient, {
            appIdOrKey: 'preflight-limit-app',
            versionNo: 'v1.0.0',
            directory: root,
            publishMode: 'stage',
            maxTotalMegabytes: 0.000001,
            confirmExecution: 'preflight-limit-app',
        });
        assert.equal(result.isError, true);
        assert.match(result.content[0].type === 'text' ? result.content[0].text : '', /上传前中止/u);
        assert.equal(uploadCalls, 0);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('low-level asset tool preserves the complete v3 contract and selects resumable multipart transport', async () => {
    const root = createTempDirectory();
    const filePath = path.join(root, 'installer.exe');
    const raw = Buffer.from('microi-v3-resumable-installer', 'utf8');
    fs.writeFileSync(filePath, raw);
    const requestId = 'single-v3-release-request-id';
    const fingerprint = '3'.repeat(64);
    const sourceManifestHash = '4'.repeat(64);
    const runtimeManifestHash = '5'.repeat(64);
    const relativePath = 'downloads/Microi-Setup-v1.0.0.exe';
    let uploadCalls = 0;
    try {
        const fakeClient = {
            uploadApplicationAssetStream: async (input) => {
                uploadCalls += 1;
                assert.equal(input.ProtocolVersion, 3);
                assert.equal(input.RequestId, requestId);
                assert.equal(input.RequestFingerprint, fingerprint);
                assert.equal(input.RuntimeManifestHash, runtimeManifestHash);
                assert.equal(input.ExpectedVersionRowVersion, null);
                return {
                    Code: 1,
                    Data: {
                        ProtocolVersion: 3,
                        PublishMode: 'stage',
                        GateEpoch: input.ExpectedGateEpoch,
                        RequestId: input.RequestId,
                        RequestFingerprint: input.RequestFingerprint,
                        RouteSnapshotJson: input.RouteSnapshotJson,
                        RouteSnapshotHash: input.RouteSnapshotHash,
                        VersionNo: 'v1.0.0',
                        Path: input.RelativePath,
                        Sha256: input.ExpectedSha256,
                        Size: raw.byteLength,
                        PublishState: 'Prepared',
                        PointerState: 'Uncommitted',
                        Pending: true,
                        FencingToken: '13',
                        ReleaseFilePath: `microi/application-assets/v3/tenants/iTdos/kinds/Web/apps/single-v3-app/releases/v1.0.0/requests/${fingerprint}/assets/downloads/Microi-Setup-v1.0.0.exe`,
                    },
                    Msg: '',
                };
            },
        };
        const input = {
            appIdOrKey: 'single-v3-app',
            versionNo: 'v1.0.0',
            relativePath,
            localFilePath: filePath,
            routes: [],
            routeSnapshotJson: EMPTY_ROUTE_SNAPSHOT_JSON,
            routeSnapshotHash: EMPTY_ROUTE_SNAPSHOT_HASH,
            sourceManifestHash,
            runtimeManifestHash,
            deliveryBatchId: 'single-v3-delivery',
            protocolVersion: 3,
            expectedGateEpoch: '7',
            requestId,
            requestFingerprint: fingerprint,
            expectedCurrentVersion: 4,
            expectedAppVersion: 'v0.9.0',
            expectedPublishFence: '12',
            expectedPublishRowVersion: '18',
            expectedVersionRowVersion: null,
            expectedActivePublishVersionId: 'version-active',
            expectedCommittedPublishVersionId: 'version-committed',
        };
        const preflight = parseToolJson(await runApplicationAssetStreamUpload(fakeClient, input));
        assert.equal(preflight.dryRun, true);
        assert.equal(preflight.protocolVersion, 3);
        assert.equal(preflight.resumable, true);
        assert.equal(uploadCalls, 0);
        const uploaded = parseToolJson(await runApplicationAssetStreamUpload(fakeClient, {
            ...input,
            confirmExecution: 'single-v3-app',
        }));
        assert.equal(uploaded.ProtocolVersion, 3);
        assert.equal(uploaded.requestFingerprint, fingerprint);
        assert.equal(uploaded.resumable, true);
        assert.equal(uploadCalls, 1);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('uploadApplicationAssetStream sends raw multipart bytes without Base64 materialization', async () => {
    const root = createTempDirectory();
    const filePath = path.join(root, 'asset.bin');
    const raw = Buffer.from('microi-raw-stream-body-2026', 'utf8');
    fs.writeFileSync(filePath, raw);
    const originalFetch = globalThis.fetch;
    let captured = Buffer.alloc(0);
    try {
        globalThis.fetch = (async (_input, init) => {
            const pieces = [];
            const body = init?.body;
            for await (const chunk of body)
                pieces.push(Buffer.from(chunk));
            captured = Buffer.concat(pieces);
            assert.equal(init?.headers && init.headers['Content-Length'], undefined);
            return new Response(JSON.stringify({ Code: 1, Data: { Streamed: true }, Msg: '' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });
        const client = new MicroiClient({
            apiBaseUrl: 'https://api.example.test',
            username: '',
            password: '',
            osClient: 'iTdos',
            token: 'unit-test-token',
        });
        const result = await client.uploadApplicationAssetStream({
            AppIdOrKey: 'stream-app',
            VersionNo: 'v1.0.0',
            RelativePath: 'assets/asset.bin',
            ExpectedSha256: crypto.createHash('sha256').update(raw).digest('hex'),
            RequestId: 'request-asset-stream-unit-test',
            FilePath: filePath,
        });
        assert.equal(result.Code, 1);
        assert.ok(captured.includes(raw));
        assert.equal(captured.includes(Buffer.from(raw.toString('base64'), 'utf8')), false);
        assert.match(captured.toString('utf8'), /name="RequestId"\r\n\r\nrequest-asset-stream-unit-test/u);
    }
    finally {
        globalThis.fetch = originalFetch;
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('uploadApplicationAssetStream falls back to native HTTP with the same raw multipart payload', async () => {
    const root = createTempDirectory();
    const filePath = path.join(root, 'asset.js');
    const raw = Buffer.from('window.microiNativeFallback = true;', 'utf8');
    fs.writeFileSync(filePath, raw);
    const originalFetch = globalThis.fetch;
    let captured = Buffer.alloc(0);
    const server = http.createServer((request, response) => {
        const chunks = [];
        assert.equal(request.headers['content-length'], undefined);
        assert.equal(request.headers['transfer-encoding'], 'chunked');
        request.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        request.on('end', () => {
            captured = Buffer.concat(chunks);
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ Code: 1, Data: { NativeFallback: true }, Msg: '' }));
        });
    });
    try {
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => resolve());
        });
        const address = server.address();
        assert.ok(address && typeof address === 'object');
        globalThis.fetch = (async () => {
            throw new TypeError('simulated undici stream reset');
        });
        const client = new MicroiClient({
            apiBaseUrl: `http://127.0.0.1:${address.port}`,
            username: '',
            password: '',
            osClient: 'iTdos',
            token: 'unit-test-token',
        });
        const result = await client.uploadApplicationAssetStream({
            AppIdOrKey: 'native-fallback-app',
            VersionNo: 'v1.0.0',
            RelativePath: 'assets/asset.js',
            ExpectedSha256: crypto.createHash('sha256').update(raw).digest('hex'),
            RequestId: 'request-native-fallback-unit-test',
            FilePath: filePath,
        });
        assert.equal(result.Code, 1);
        assert.ok(captured.includes(raw));
        assert.equal(captured.includes(Buffer.from(raw.toString('base64'), 'utf8')), false);
        assert.match(captured.toString('utf8'), /name="RequestId"\r\n\r\nrequest-native-fallback-unit-test/u);
        assert.match(captured.toString('utf8'), new RegExp(`filename="microi-asset-${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16)}\\.bin"`, 'u'));
        assert.doesNotMatch(captured.toString('utf8'), /filename="asset\.js"/u);
    }
    finally {
        globalThis.fetch = originalFetch;
        await new Promise(resolve => server.close(() => resolve()));
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('uploadApplicationAssetStream retries through gzip multipart after raw proxy resets', async () => {
    const root = createTempDirectory();
    const filePath = path.join(root, 'asset.js');
    const raw = Buffer.from('export default "microi gzip proxy fallback";'.repeat(2000), 'utf8');
    fs.writeFileSync(filePath, raw);
    const originalFetch = globalThis.fetch;
    let requestCount = 0;
    let captured = Buffer.alloc(0);
    const server = http.createServer((request, response) => {
        requestCount += 1;
        if (requestCount === 1) {
            request.socket.destroy();
            return;
        }
        const chunks = [];
        request.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        request.on('end', () => {
            captured = Buffer.concat(chunks);
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ Code: 1, Data: { GzipFallback: true }, Msg: '' }));
        });
    });
    try {
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => resolve());
        });
        const address = server.address();
        assert.ok(address && typeof address === 'object');
        globalThis.fetch = (async () => {
            throw new TypeError('simulated proxy reset');
        });
        const client = new MicroiClient({
            apiBaseUrl: `http://127.0.0.1:${address.port}`,
            username: '',
            password: '',
            osClient: 'iTdos',
            token: 'unit-test-token',
        });
        const result = await client.uploadApplicationAssetStream({
            AppIdOrKey: 'gzip-fallback-app',
            VersionNo: 'v1.0.0',
            RelativePath: 'assets/asset.js',
            ExpectedSha256: crypto.createHash('sha256').update(raw).digest('hex'),
            RequestId: 'request-gzip-fallback-unit-test',
            FilePath: filePath,
        });
        assert.equal(result.Code, 1);
        assert.equal(requestCount, 2);
        assert.match(captured.toString('latin1'), /name="ContentEncoding"\r\n\r\ngzip\r\n/u);
        assert.equal(captured.includes(raw), false);
        assert.notEqual(captured.indexOf(Buffer.from([0x1f, 0x8b, 0x08])), -1);
    }
    finally {
        globalThis.fetch = originalFetch;
        await new Promise(resolve => server.close(() => resolve()));
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('protocol v3 always resumes through durable multipart and sends only the missing raw range', async () => {
    const root = createTempDirectory();
    const filePath = path.join(root, 'resumable.bin');
    const chunkSize = 16 * 1024 * 1024;
    const first = Buffer.alloc(chunkSize, 0x31);
    const second = Buffer.alloc(2 * 1024 * 1024 + 17, 0x72);
    fs.writeFileSync(filePath, Buffer.concat([first, second]));
    const fullSha = crypto.createHash('sha256').update(first).update(second).digest('hex');
    const firstSha = crypto.createHash('sha256').update(first).digest('hex');
    const secondSha = crypto.createHash('sha256').update(second).digest('hex');
    const sessionId = `mciau-${'a'.repeat(30)}`;
    const remoteParts = [
        { Number: 1, Size: first.length, Sha256: firstSha, Path: 'parts/00001.part' },
    ];
    const binaryRequests = [];
    let initiateCalls = 0;
    let statusCalls = 0;
    let completeCalls = 0;
    const server = http.createServer((request, response) => {
        const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
        const json = (data, msg = '') => {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ Code: 1, Data: data, Msg: msg }));
        };
        if (requestUrl.pathname.endsWith('/InitiateApplicationAssetMultipart')) {
            initiateCalls += 1;
            request.resume();
            request.on('end', () => json({
                SessionId: sessionId,
                Status: 'Uploading',
                ChunkSize: chunkSize,
                TotalParts: 2,
                Parts: remoteParts,
            }));
            return;
        }
        if (requestUrl.pathname.endsWith('/GetApplicationAssetMultipartStatus')) {
            statusCalls += 1;
            request.resume();
            request.on('end', () => json({
                SessionId: sessionId,
                Status: 'Uploading',
                ChunkSize: chunkSize,
                TotalParts: 2,
                Parts: remoteParts,
            }));
            return;
        }
        if (requestUrl.pathname.endsWith('/UploadApplicationAssetMultipartPart')) {
            const chunks = [];
            request.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            request.on('end', () => {
                const raw = Buffer.concat(chunks);
                const partNumber = requestUrl.searchParams.get('partNumber') || '';
                const expectedPartSha = requestUrl.searchParams.get('expectedPartSha256') || '';
                binaryRequests.push({
                    partNumber,
                    length: raw.length,
                    sha256: crypto.createHash('sha256').update(raw).digest('hex'),
                });
                assert.equal(request.headers['content-type'], 'application/octet-stream');
                assert.equal(Number(request.headers['content-length']), second.length);
                assert.equal(expectedPartSha, secondSha);
                assert.equal(raw.equals(second), true);
                remoteParts.push({ Number: 2, Size: second.length, Sha256: secondSha, Path: 'parts/00002.part' });
                json({
                    SessionId: sessionId,
                    Status: 'Uploading',
                    ChunkSize: chunkSize,
                    TotalParts: 2,
                    Parts: remoteParts,
                });
            });
            return;
        }
        if (requestUrl.pathname.endsWith('/CompleteApplicationAssetMultipart')) {
            completeCalls += 1;
            request.resume();
            request.on('end', () => json({
                ProtocolVersion: 3,
                SessionId: sessionId,
                Status: 'Succeeded',
                ChunkSize: chunkSize,
                TotalParts: 2,
                Parts: remoteParts,
                Completed: true,
                PublishState: 'Prepared',
                PointerState: 'Uncommitted',
                Pending: true,
            }));
            return;
        }
        response.writeHead(404);
        response.end();
    });
    try {
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => resolve());
        });
        const address = server.address();
        assert.ok(address && typeof address === 'object');
        const client = new MicroiClient({
            apiBaseUrl: `http://127.0.0.1:${address.port}`,
            username: '',
            password: '',
            osClient: 'iTdos',
            token: 'unit-test-token',
        });
        const result = await client.uploadApplicationAssetStream({
            AppIdOrKey: 'resumable-app',
            VersionNo: 'v1.4.0',
            RelativePath: 'downloads/resumable.bin',
            ExpectedSha256: fullSha,
            RequestId: 'resumable-request-20260813',
            FilePath: filePath,
            ProtocolVersion: 3,
            ExpectedGateEpoch: '1',
            RequestFingerprint: 'b'.repeat(64),
            DeliveryBatchId: 'resumable-batch-20260813',
            SourceManifestHash: 'c'.repeat(64),
            RuntimeManifestHash: 'd'.repeat(64),
            RouteSnapshotJson: EMPTY_ROUTE_SNAPSHOT_JSON,
            RouteSnapshotHash: EMPTY_ROUTE_SNAPSHOT_HASH,
            ExpectedCurrentVersion: 0,
            ExpectedAppVersion: null,
            ExpectedPublishFence: '0',
            ExpectedPublishRowVersion: '0',
            ExpectedVersionRowVersion: null,
            ExpectedActivePublishVersionId: null,
            ExpectedCommittedPublishVersionId: null,
        });
        assert.equal(result.Code, 1);
        assert.equal(result.Data.ResumedParts, 1);
        assert.equal(result.Data.UploadedInThisRun, 1);
        assert.equal(initiateCalls, 1);
        assert.equal(statusCalls, 1);
        assert.equal(completeCalls, 1);
        assert.deepEqual(binaryRequests, [{
                partNumber: '2',
                length: second.length,
                sha256: secondSha,
            }]);
    }
    finally {
        await new Promise(resolve => server.close(() => resolve()));
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('publishMicroService falls back to native HTTP with the exact JSON body', async () => {
    const originalFetch = globalThis.fetch;
    let capturedPath = '';
    let capturedBody = '';
    const server = http.createServer((request, response) => {
        const chunks = [];
        capturedPath = request.url || '';
        request.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        request.on('end', () => {
            capturedBody = Buffer.concat(chunks).toString('utf8');
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ Code: 1, Data: { NativeJsonFallback: true }, Msg: '' }));
        });
    });
    try {
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => resolve());
        });
        const address = server.address();
        assert.ok(address && typeof address === 'object');
        globalThis.fetch = (async () => {
            throw new TypeError('simulated undici JSON reset');
        });
        const client = new MicroiClient({
            apiBaseUrl: `http://127.0.0.1:${address.port}`,
            username: '',
            password: '',
            osClient: 'iTdos',
            token: 'unit-test-token',
        });
        const result = await client.publishMicroService({
            AppId: 'existing-app',
            AppVersion: 'v1.0.1',
            FileList: [{ RelativePath: 'index.html', ContentBase64: 'PGh0bWw+' }],
        });
        assert.equal(result.Code, 1);
        assert.match(capturedPath, /PublishMicroService/u);
        assert.deepEqual(JSON.parse(capturedBody), {
            OsClient: 'iTdos',
            AppId: 'existing-app',
            AppVersion: 'v1.0.1',
            FileList: [{ RelativePath: 'index.html', ContentBase64: 'PGh0bWw+' }],
        });
    }
    finally {
        globalThis.fetch = originalFetch;
        await new Promise(resolve => server.close(() => resolve()));
    }
});
test('protocol v3 resumable initiation forwards canonical bigint strings and explicit null baselines as PascalCase fields', async () => {
    const root = createTempDirectory();
    const filePath = path.join(root, 'index.html');
    fs.writeFileSync(filePath, '<!doctype html><body>v3 multipart</body>');
    const originalFetch = globalThis.fetch;
    const sessionId = `mciau-${'a'.repeat(30)}`;
    const chunkSize = 16 * 1024 * 1024;
    let captured = {};
    try {
        globalThis.fetch = (async (input, init) => {
            const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
            let data = {
                SessionId: sessionId,
                Status: 'Uploading',
                ChunkSize: chunkSize,
                TotalParts: 1,
                Parts: [],
            };
            if (url.pathname.endsWith('/InitiateApplicationAssetMultipart')) {
                captured = JSON.parse(String(init?.body || '{}'));
            }
            else if (url.pathname.endsWith('/GetApplicationAssetMultipartStatus')) {
                data = { ...data, Status: 'Succeeded', Completed: true, PublishState: 'Prepared' };
            }
            else if (url.pathname.endsWith('/UploadApplicationAssetMultipartPart')) {
                const pieces = [];
                for await (const chunk of init?.body) {
                    pieces.push(Buffer.from(chunk));
                }
                assert.equal(Buffer.concat(pieces).length, fs.statSync(filePath).size);
            }
            else if (url.pathname.endsWith('/CompleteApplicationAssetMultipart')) {
                data = { ...data, Status: 'Succeeded', Completed: true, PublishState: 'Prepared' };
            }
            return new Response(JSON.stringify({ Code: 1, Data: data, Msg: '' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });
        const client = new MicroiClient({
            apiBaseUrl: 'https://api.example.test',
            username: '',
            password: '',
            osClient: 'iTdos',
            token: 'unit-test-token',
        });
        await client.uploadApplicationAssetStream({
            AppIdOrKey: 'v3-contract-app',
            VersionNo: 'v1.0.0',
            RelativePath: 'index.html',
            ExpectedSha256: 'a'.repeat(64),
            RequestId: 'catalog-v3-shared-request-id',
            FilePath: filePath,
            ProtocolVersion: 3,
            ExpectedGateEpoch: '9007199254740993',
            RequestFingerprint: 'b'.repeat(64),
            DeliveryBatchId: 'catalog-v3-delivery-contract',
            SourceManifestHash: 'c'.repeat(64),
            RuntimeManifestHash: 'd'.repeat(64),
            RouteSnapshotJson: EMPTY_ROUTE_SNAPSHOT_JSON,
            RouteSnapshotHash: EMPTY_ROUTE_SNAPSHOT_HASH,
            ExpectedCurrentVersion: 8,
            ExpectedAppVersion: null,
            ExpectedPublishFence: '9007199254740995',
            ExpectedPublishRowVersion: '9007199254740997',
            ExpectedVersionRowVersion: null,
            ExpectedActivePublishVersionId: null,
            ExpectedCommittedPublishVersionId: 'version-old',
        });
        assert.equal(captured.ProtocolVersion, 3);
        assert.equal(captured.PublishMode, 'stage');
        assert.equal(captured.ExpectedGateEpoch, '9007199254740993');
        assert.equal(captured.RequestId, 'catalog-v3-shared-request-id');
        assert.equal(captured.RequestFingerprint, 'b'.repeat(64));
        assert.equal(captured.RouteSnapshotJson, EMPTY_ROUTE_SNAPSHOT_JSON);
        assert.equal(captured.RouteSnapshotHash, EMPTY_ROUTE_SNAPSHOT_HASH);
        assert.equal(captured.ExpectedPublishFence, '9007199254740995');
        assert.equal(captured.ExpectedPublishRowVersion, '9007199254740997');
        assert.equal(captured.ExpectedVersionRowVersion, null);
        assert.equal(captured.ExpectedActivePublishVersionId, null);
        assert.equal(captured.ExpectedAppVersion, null);
    }
    finally {
        globalThis.fetch = originalFetch;
        fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
});
test('protocol v3 paths are NFC and segment-encoded, with unsafe or oversized immutable paths rejected', () => {
    assert.equal(encodeApplicationAssetStreamV3RelativePath('assets/中文 文件.js'), 'assets/%E4%B8%AD%E6%96%87%20%E6%96%87%E4%BB%B6.js');
    for (const invalid of [
        'assets/pre%20encoded.js',
        'assets/query?.js',
        'assets/hash#.js',
        'assets\\backslash.js',
        'assets//empty.js',
        'assets/root/app.js',
        'assets/LATEST/app.js',
        `assets/${'e\u0301'}.js`,
        'assets/control\u0001.js',
    ]) {
        assert.throws(() => encodeApplicationAssetStreamV3RelativePath(invalid), /v3|路径|NFC|控制/u);
    }
    const longButIndividuallyValid = [
        'a'.repeat(240),
        'b'.repeat(240),
        'c'.repeat(240),
    ].join('/');
    assert.throws(() => buildConservativeApplicationAssetStreamV3ImmutablePath({
        appIdOrKey: 'a'.repeat(128),
        versionNo: `v${'1'.repeat(62)}`,
        requestFingerprint: 'f'.repeat(64),
        relativePath: longButIndividuallyValid,
    }), /完整 immutable path.*1000/u);
});
test('protocol v3 manifest path preflight fails before the first upload', async () => {
    const root = createTempDirectory();
    try {
        fs.mkdirSync(path.join(root, 'assets'));
        fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><body>v3 path preflight</body>');
        fs.writeFileSync(path.join(root, 'assets', 'pre%20encoded.js'), 'window.invalidV3Path = true;');
        const manifest = await buildLocalApplicationAssetManifest(root);
        let uploads = 0;
        let finalizes = 0;
        const fakeClient = {
            uploadApplicationAssetStream: async () => {
                uploads += 1;
                return { Code: 0, Data: null, Msg: 'must not upload' };
            },
            finalizeApplicationStreamPublish: async () => {
                finalizes += 1;
                return { Code: 0, Data: null, Msg: 'must not finalize' };
            },
        };
        const result = await runApplicationDirectoryStreamPublish(fakeClient, {
            appIdOrKey: 'v3-path-preflight',
            versionNo: 'v1.0.0',
            directory: root,
            publishMode: 'stage',
            protocolVersion: 3,
            expectedGateEpoch: '9',
            requestId: 'catalog-v3-path-preflight-request',
            requestFingerprint: '9'.repeat(64),
            deliveryBatchId: 'catalog-v3-path-preflight-delivery',
            sourceManifestHash: '8'.repeat(64),
            runtimeManifestHash: manifest.manifestHash,
            routes: [],
            routeSnapshotJson: EMPTY_ROUTE_SNAPSHOT_JSON,
            routeSnapshotHash: EMPTY_ROUTE_SNAPSHOT_HASH,
            expectedCurrentVersion: 0,
            expectedAppVersion: null,
            expectedPublishFence: '0',
            expectedPublishRowVersion: '0',
            expectedVersionRowVersion: null,
            expectedActivePublishVersionId: null,
            expectedCommittedPublishVersionId: null,
            allowLegacyFallback: false,
            confirmExecution: 'v3-path-preflight',
        });
        assert.equal(result.isError, true);
        assert.equal(uploads, 0);
        assert.equal(finalizes, 0);
        const textBlock = result.content.find(item => item.type === 'text');
        assert.ok(textBlock && textBlock.type === 'text');
        assert.match(textBlock.text, /禁止预编码/u);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('protocol v3 stage uses one release RequestId for every asset then obtains server ReleaseVerified', async () => {
    const root = createTempDirectory();
    try {
        fs.mkdirSync(path.join(root, 'assets'));
        fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><body>v3 stage</body>');
        fs.writeFileSync(path.join(root, 'assets', '中文 文件.js'), 'window.v3Stage = true;');
        const manifest = await buildLocalApplicationAssetManifest(root);
        const requestId = 'catalog-v3-shared-stage-finalize-id';
        const fingerprint = 'e'.repeat(64);
        const sourceHash = 'f'.repeat(64);
        const releasePrefix = `microi/application-assets/v3/tenants/iTdos/kinds/Web/apps/v3-stage-app/releases/v1.0.0/requests/${fingerprint}`;
        const uploadCalls = [];
        const finalizeCalls = [];
        const fakeClient = {
            uploadApplicationAssetStream: async (input) => {
                uploadCalls.push(input);
                return {
                    Code: 1,
                    Data: {
                        ProtocolVersion: 3,
                        PublishMode: 'stage',
                        GateEpoch: input.ExpectedGateEpoch,
                        AppKey: 'v3-stage-app',
                        VersionNo: 'v1.0.0',
                        RequestId: input.RequestId,
                        DeliveryBatchId: input.DeliveryBatchId,
                        RequestFingerprint: input.RequestFingerprint,
                        RouteSnapshotJson: input.RouteSnapshotJson,
                        RouteSnapshotHash: input.RouteSnapshotHash,
                        PublishState: 'Prepared',
                        PointerState: 'Uncommitted',
                        Pending: true,
                        FencingToken: '9007199254741001',
                        Path: input.RelativePath,
                        Sha256: input.ExpectedSha256,
                        Size: fs.statSync(input.FilePath).size,
                        ReleaseFilePath: `${releasePrefix}/assets/${input.RelativePath.split('/').map(segment => encodeURIComponent(segment)).join('/')}`,
                        Idempotent: false,
                    },
                    Msg: '',
                };
            },
            finalizeApplicationStreamPublish: async (input) => {
                finalizeCalls.push(input);
                return {
                    Code: 1,
                    Data: {
                        ProtocolVersion: 3,
                        PublishMode: 'stage',
                        GateEpoch: input.ExpectedGateEpoch,
                        V3Only: true,
                        AllowedModes: ['stage', 'finalize'],
                        AppId: 'v3-stage-record-id',
                        AppKey: 'v3-stage-app',
                        VersionId: 'version-v3-stage',
                        VersionNo: 'v1.0.0',
                        RequestId: input.RequestId,
                        DeliveryBatchId: input.DeliveryBatchId,
                        RequestFingerprint: input.RequestFingerprint,
                        RouteSnapshotJson: input.RouteSnapshotJson,
                        RouteSnapshotHash: input.RouteSnapshotHash,
                        PublishFence: input.ExpectedPublishFence,
                        PublishRowVersion: input.ExpectedPublishRowVersion,
                        VersionRowVersion: '1',
                        FencingToken: '9007199254741001',
                        PublishState: 'ReleaseVerified',
                        PhaseState: 'ReleaseVerified',
                        PointerState: 'Uncommitted',
                        Pending: false,
                        ProjectionPending: false,
                        RetryAfterMs: 0,
                        ReleasePrefix: releasePrefix,
                        ReleaseEntryPath: `${releasePrefix}/assets/index.html`,
                        StableResolverPath: '/micro-app/v3/tenants/iTdos/kinds/Web/apps/v3-stage-app/assets/index.html',
                        RuntimeManifestHash: input.RuntimeManifestHash,
                        SourceManifestHash: input.SourceManifestHash,
                    },
                    Msg: '',
                };
            },
        };
        const result = await runApplicationDirectoryStreamPublish(fakeClient, {
            appIdOrKey: 'v3-stage-record-id',
            versionNo: 'v1.0.0',
            directory: root,
            publishMode: 'stage',
            protocolVersion: 3,
            expectedGateEpoch: '9007199254740993',
            requestId,
            requestFingerprint: fingerprint,
            deliveryBatchId: 'catalog-v3-stage-delivery-id',
            sourceManifestHash: sourceHash,
            runtimeManifestHash: manifest.manifestHash,
            routes: [],
            routeSnapshotJson: EMPTY_ROUTE_SNAPSHOT_JSON,
            routeSnapshotHash: EMPTY_ROUTE_SNAPSHOT_HASH,
            expectedCurrentVersion: 6,
            expectedAppVersion: 'v0.9.0',
            expectedPublishFence: '9007199254740995',
            expectedPublishRowVersion: '9007199254740997',
            expectedVersionRowVersion: null,
            expectedActivePublishVersionId: null,
            expectedCommittedPublishVersionId: 'version-old',
            allowLegacyFallback: false,
            confirmExecution: 'v3-stage-record-id',
        });
        assert.equal(result.isError, undefined);
        assert.equal(uploadCalls.length, 2);
        assert.equal(new Set(uploadCalls.map(call => call.RequestId)).size, 1);
        assert.equal(uploadCalls[0].RequestId, requestId);
        assert.equal(uploadCalls[0].ExpectedGateEpoch, '9007199254740993');
        assert.equal(uploadCalls[0].ExpectedVersionRowVersion, null);
        assert.ok(uploadCalls.some(call => call.RelativePath === 'assets/中文 文件.js'));
        assert.equal(finalizeCalls.length, 1);
        assert.equal(finalizeCalls[0].PublishMode, 'stage');
        assert.equal(finalizeCalls[0].RequestId, requestId);
        assert.equal(finalizeCalls[0].ExpectedVersionRowVersion, null);
        const payload = parseToolJson(result);
        assert.equal(payload.PublishState, 'ReleaseVerified');
        assert.equal(payload.Pending, false);
        assert.equal(payload.requestId, requestId);
        assert.equal(payload.transport, 'v3-multipart-immutable-release-stage');
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('protocol v3 finalize returns Pending without probing and exact replay keeps one payload and RequestId', async () => {
    const root = createTempDirectory();
    try {
        fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><body>v3 finalize</body>');
        const manifest = await buildLocalApplicationAssetManifest(root);
        const requestId = 'catalog-v3-shared-pending-request-id';
        const fingerprint = '1'.repeat(64);
        const sourceHash = '2'.repeat(64);
        const releasePrefix = `microi/application-assets/v3/tenants/iTdos/kinds/Web/apps/v3-finalize-app/releases/v2.0.0/requests/${fingerprint}`;
        const finalizeCalls = [];
        let uploadCalls = 0;
        const fakeClient = {
            uploadApplicationAssetStream: async () => {
                uploadCalls += 1;
                return { Code: 0, Data: null, Msg: 'finalize must not upload' };
            },
            finalizeApplicationStreamPublish: async (input) => {
                finalizeCalls.push(structuredClone(input));
                const completed = finalizeCalls.length > 1;
                return {
                    Code: 1,
                    Data: {
                        ProtocolVersion: 3,
                        PublishMode: 'finalize',
                        GateEpoch: input.ExpectedGateEpoch,
                        V3Only: true,
                        AllowedModes: ['stage', 'finalize'],
                        AppKey: 'v3-finalize-app',
                        VersionId: 'version-v3-final',
                        VersionNo: 'v2.0.0',
                        RequestId: input.RequestId,
                        DeliveryBatchId: input.DeliveryBatchId,
                        RequestFingerprint: input.RequestFingerprint,
                        RouteSnapshotJson: input.RouteSnapshotJson,
                        RouteSnapshotHash: input.RouteSnapshotHash,
                        PublishFence: '9007199254741011',
                        PublishRowVersion: '9007199254741008',
                        VersionRowVersion: '4',
                        CommittedPublishVersionId: 'version-v3-final',
                        CommittedRuntimeManifestHash: input.RuntimeManifestHash,
                        PublishState: completed ? 'Completed' : 'ProjectionPending',
                        AppPublishState: completed ? 'Completed' : 'ProjectionPending',
                        PointerState: 'Committed',
                        Pending: !completed,
                        Completed: completed,
                        ProjectionPending: !completed,
                        RetryAfterMs: 0,
                        ReleasePrefix: releasePrefix,
                        ReleaseEntryPath: `${releasePrefix}/assets/index.html`,
                        StableResolverPath: '/micro-app/v3/tenants/iTdos/kinds/Web/apps/v3-finalize-app/assets/index.html',
                        RuntimeManifestHash: input.RuntimeManifestHash,
                        SourceManifestHash: input.SourceManifestHash,
                    },
                    Msg: '',
                };
            },
        };
        const input = {
            appIdOrKey: 'v3-finalize-app',
            versionNo: 'v2.0.0',
            directory: root,
            publishMode: 'finalize',
            protocolVersion: 3,
            expectedGateEpoch: '9007199254740993',
            requestId,
            requestFingerprint: fingerprint,
            deliveryBatchId: 'catalog-v3-finalize-delivery',
            sourceManifestHash: sourceHash,
            runtimeManifestHash: manifest.manifestHash,
            routes: [],
            routeSnapshotJson: EMPTY_ROUTE_SNAPSHOT_JSON,
            routeSnapshotHash: EMPTY_ROUTE_SNAPSHOT_HASH,
            expectedCurrentVersion: 10,
            expectedAppVersion: 'v1.9.0',
            expectedPublishFence: '9007199254741005',
            expectedPublishRowVersion: '9007199254741007',
            expectedVersionRowVersion: '3',
            expectedActivePublishVersionId: 'version-stage',
            expectedCommittedPublishVersionId: 'version-old',
            allowLegacyFallback: false,
            confirmExecution: 'v3-finalize-app',
        };
        const pending = parseToolJson(await runApplicationDirectoryStreamPublish(fakeClient, input));
        assert.equal(pending.PublishState, 'ProjectionPending');
        assert.equal(pending.Pending, true);
        const complete = parseToolJson(await runApplicationDirectoryStreamPublish(fakeClient, input));
        assert.equal(complete.PublishState, 'Completed');
        assert.equal(complete.Pending, false);
        assert.equal(uploadCalls, 0);
        assert.equal(finalizeCalls.length, 2);
        assert.deepEqual(finalizeCalls[0], finalizeCalls[1]);
        assert.equal(finalizeCalls[0].RequestId, requestId);
        assert.equal(finalizeCalls[0].PublishMode, 'finalize');
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('stage mode uploads every asset without finalizing and reuses deterministic request ids on retry', async () => {
    const root = createTempDirectory();
    try {
        fs.mkdirSync(path.join(root, 'assets'));
        fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head></head><body>stage</body></html>');
        fs.writeFileSync(path.join(root, 'assets', 'app.js'), 'window.stage = true;');
        const seen = new Set();
        const uploadCalls = [];
        let finalizeCalls = 0;
        const fakeClient = {
            uploadApplicationAssetStream: async (input) => {
                uploadCalls.push(input);
                const idempotent = seen.has(input.RequestId);
                seen.add(input.RequestId);
                return {
                    Code: 1,
                    Data: {
                        RequestId: input.RequestId,
                        VersionNo: 'v3.2.1',
                        Path: input.RelativePath,
                        Sha256: input.ExpectedSha256,
                        Size: fs.statSync(input.FilePath).size,
                        Idempotent: idempotent,
                        StablePromoted: false,
                    },
                    Msg: '',
                };
            },
            finalizeApplicationStreamPublish: async () => {
                finalizeCalls += 1;
                return { Code: 0, Data: null, Msg: 'must not finalize in stage mode' };
            },
        };
        const input = {
            appIdOrKey: 'two-phase-app',
            versionNo: 'v3.2.1',
            directory: root,
            publishMode: 'stage',
            confirmExecution: 'two-phase-app',
        };
        const first = await runApplicationDirectoryStreamPublish(fakeClient, input);
        assert.equal(first.isError, undefined);
        const firstPayload = parseToolJson(first);
        assert.equal(firstPayload.publishMode, 'stage');
        assert.equal(firstPayload.assetCount, 2);
        assert.equal(firstPayload.stagedCount, 2);
        assert.equal(firstPayload.uploadedCount, 2);
        assert.equal(firstPayload.StablePromoted, false);
        assert.ok(String(firstPayload.deliveryBatchId).length <= 50, 'default batch id must fit LastBuildTaskId');
        assert.equal(finalizeCalls, 0);
        const firstRequestIds = uploadCalls.map(call => call.RequestId);
        assert.equal(new Set(firstRequestIds).size, 2);
        const second = await runApplicationDirectoryStreamPublish(fakeClient, input);
        assert.equal(second.isError, undefined);
        const secondPayload = parseToolJson(second);
        assert.equal(secondPayload.idempotentCount, 2);
        assert.deepEqual(uploadCalls.slice(2).map(call => call.RequestId), firstRequestIds);
        assert.equal(firstPayload.requestId, secondPayload.requestId);
        assert.equal(firstPayload.runtimeManifestHash, secondPayload.runtimeManifestHash);
        assert.equal(finalizeCalls, 0);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('finalize mode performs no upload and retries with the same request id and manifest evidence', async () => {
    const root = createTempDirectory();
    try {
        fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head></head><body>finalize</body></html>');
        const finalizeCalls = [];
        let uploadCalls = 0;
        const fakeClient = {
            uploadApplicationAssetStream: async () => {
                uploadCalls += 1;
                return { Code: 0, Data: null, Msg: 'must not upload in finalize mode' };
            },
            finalizeApplicationStreamPublish: async (input) => {
                finalizeCalls.push(input);
                const assets = input.Assets;
                return {
                    Code: 1,
                    Data: {
                        AppKey: 'two-phase-app',
                        RequestId: input.RequestId,
                        VersionNo: 'v3.2.1',
                        EntryPath: input.EntryPath,
                        DeliveryBatchId: input.DeliveryBatchId,
                        RuntimeManifestHash: input.RuntimeManifestHash,
                        AssetCount: assets.length,
                        TotalSize: assets.reduce((sum, asset) => sum + Number(asset.Size), 0),
                        ExpectedCurrentVersion: input.ExpectedCurrentVersion,
                        ExpectedAppVersion: input.ExpectedAppVersion,
                        PublishStatus: 'Published',
                        VerificationStatus: 'Verified',
                        StablePromoted: true,
                    },
                    Msg: '',
                };
            },
            probeMicroAppEntry: async () => ({ ok: true, status: 200, url: 'https://example.test/index.html' }),
        };
        const input = {
            appIdOrKey: 'two-phase-app',
            versionNo: 'v3.2.1',
            directory: root,
            publishMode: 'finalize',
            expectedCurrentVersion: 7,
            expectedAppVersion: '',
            confirmExecution: 'two-phase-app',
        };
        const first = await runApplicationDirectoryStreamPublish(fakeClient, input);
        const second = await runApplicationDirectoryStreamPublish(fakeClient, input);
        assert.equal(first.isError, undefined);
        assert.equal(second.isError, undefined);
        assert.equal(uploadCalls, 0);
        assert.equal(finalizeCalls.length, 2);
        assert.equal(finalizeCalls[0].RequestId, finalizeCalls[1].RequestId);
        assert.equal(finalizeCalls[0].DeliveryBatchId, finalizeCalls[1].DeliveryBatchId);
        assert.equal(finalizeCalls[0].ExpectedCurrentVersion, 7);
        assert.equal(finalizeCalls[0].ExpectedAppVersion, '');
        const payload = parseToolJson(second);
        assert.equal(payload.publishMode, 'finalize');
        assert.equal(payload.stagedCount, 0);
        assert.equal(payload.uploadedCount, 0);
        assert.equal(payload.StablePromoted, true);
        assert.equal(payload.transport, 'manifest-finalize-only');
        assert.equal(payload.requestId, finalizeCalls[1].RequestId);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('real finalize fails before upload when either application generation precondition is missing', async () => {
    const root = createTempDirectory();
    try {
        fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><body>missing baseline</body>');
        let uploads = 0;
        let finalizes = 0;
        const fakeClient = {
            uploadApplicationAssetStream: async () => {
                uploads += 1;
                return { Code: 1, Data: {}, Msg: '' };
            },
            finalizeApplicationStreamPublish: async () => {
                finalizes += 1;
                return { Code: 1, Data: {}, Msg: '' };
            },
        };
        for (const partial of [
            {},
            { expectedCurrentVersion: 3 },
            { expectedAppVersion: 'v2.0.0' },
        ]) {
            const result = await runApplicationDirectoryStreamPublish(fakeClient, {
                appIdOrKey: 'missing-baseline-app',
                versionNo: 'v2.1.0',
                directory: root,
                publishMode: 'stage-and-finalize',
                confirmExecution: 'missing-baseline-app',
                ...partial,
            });
            assert.equal(result.isError, true);
            const payload = parseToolJson(result);
            assert.equal(payload.expectedStateRequired, true);
            assert.equal(payload.stablePromoted, false);
            assert.equal(payload.retrySafe, true);
        }
        assert.equal(uploads, 0);
        assert.equal(finalizes, 0);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('finalize version preconditions fail closed unless success evidence echoes both values exactly', async () => {
    const root = createTempDirectory();
    try {
        fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><body>precondition</body>');
        let finalizeInput;
        const fakeClient = {
            uploadApplicationAssetStream: async () => ({ Code: 0, Data: null, Msg: 'must not upload' }),
            finalizeApplicationStreamPublish: async (input) => {
                finalizeInput = input;
                const assets = input.Assets;
                return {
                    Code: 1,
                    Data: {
                        AppKey: 'precondition-app',
                        RequestId: input.RequestId,
                        VersionNo: 'v4.0.0',
                        EntryPath: input.EntryPath,
                        DeliveryBatchId: input.DeliveryBatchId,
                        RuntimeManifestHash: input.RuntimeManifestHash,
                        AssetCount: assets.length,
                        TotalSize: assets.reduce((sum, asset) => sum + Number(asset.Size), 0),
                        ExpectedCurrentVersion: 12,
                        ExpectedAppVersion: 'v3.9.9-wrong',
                        PublishStatus: 'Published',
                        VerificationStatus: 'Verified',
                        StablePromoted: true,
                    },
                    Msg: '',
                };
            },
            probeMicroAppEntry: async () => ({ ok: true, status: 200, url: 'https://example.test/index.html' }),
        };
        const result = await runApplicationDirectoryStreamPublish(fakeClient, {
            appIdOrKey: 'precondition-app',
            versionNo: 'v4.0.0',
            directory: root,
            publishMode: 'finalize',
            expectedCurrentVersion: 12,
            expectedAppVersion: 'v3.9.9',
            confirmExecution: 'precondition-app',
        });
        assert.equal(finalizeInput?.ExpectedCurrentVersion, 12);
        assert.equal(finalizeInput?.ExpectedAppVersion, 'v3.9.9');
        assert.equal(result.isError, true);
        const payload = parseToolJson(result);
        assert.equal(payload.evidenceMismatch, true);
        assert.equal(payload.retrySafe, false);
        assert.match(String(payload.error), /ExpectedAppVersion 不一致/u);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('finalize Code=0 is retry-safe only when the server explicitly says so', async () => {
    const root = createTempDirectory();
    try {
        fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><body>retry contract</body>');
        let explicitRetrySafe = false;
        const fakeClient = {
            uploadApplicationAssetStream: async () => ({ Code: 0, Data: null, Msg: 'must not upload' }),
            finalizeApplicationStreamPublish: async () => ({
                Code: 0,
                Data: explicitRetrySafe ? { RetrySafe: true } : null,
                Msg: 'expected version mismatch',
            }),
            probeMicroAppEntry: async () => ({ ok: false, status: 503, url: 'https://example.test/index.html' }),
        };
        const input = {
            appIdOrKey: 'retry-contract-app',
            versionNo: 'v1.0.0',
            directory: root,
            publishMode: 'finalize',
            expectedCurrentVersion: 4,
            expectedAppVersion: 'v0.9.0',
            confirmExecution: 'retry-contract-app',
        };
        const rejected = parseToolJson(await runApplicationDirectoryStreamPublish(fakeClient, input));
        assert.equal(rejected.retrySafe, false);
        explicitRetrySafe = true;
        const allowed = parseToolJson(await runApplicationDirectoryStreamPublish(fakeClient, input));
        assert.equal(allowed.retrySafe, true);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('default stage-and-finalize mode validates request evidence and exposes the unified response contract', async () => {
    const root = createTempDirectory();
    try {
        fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head></head><body>combined</body></html>');
        const uploadRequestIds = [];
        let finalizeInput;
        const fakeClient = {
            uploadApplicationAssetStream: async (input) => {
                uploadRequestIds.push(input.RequestId);
                return {
                    Code: 1,
                    Data: {
                        RequestId: input.RequestId,
                        VersionNo: 'v1.0.0',
                        Path: input.RelativePath,
                        Sha256: input.ExpectedSha256,
                        Size: fs.statSync(input.FilePath).size,
                        Idempotent: false,
                        StablePromoted: false,
                    },
                    Msg: '',
                };
            },
            finalizeApplicationStreamPublish: async (input) => {
                finalizeInput = input;
                const assets = input.Assets;
                return {
                    Code: 1,
                    Data: {
                        AppKey: 'combined-app',
                        RequestId: input.RequestId,
                        VersionNo: 'v1.0.0',
                        EntryPath: input.EntryPath,
                        DeliveryBatchId: input.DeliveryBatchId,
                        RuntimeManifestHash: input.RuntimeManifestHash,
                        AssetCount: assets.length,
                        TotalSize: assets.reduce((sum, asset) => sum + Number(asset.Size), 0),
                        ExpectedCurrentVersion: input.ExpectedCurrentVersion,
                        ExpectedAppVersion: input.ExpectedAppVersion,
                        PublishStatus: 'Published',
                        VerificationStatus: 'Verified',
                        StablePromoted: true,
                    },
                    Msg: '',
                };
            },
            probeMicroAppEntry: async () => ({ ok: true, status: 200, url: 'https://example.test/index.html' }),
        };
        const result = await runApplicationDirectoryStreamPublish(fakeClient, {
            appIdOrKey: 'combined-app',
            versionNo: 'v1.0.0',
            directory: root,
            expectedCurrentVersion: 2,
            expectedAppVersion: 'v0.9.0',
            confirmExecution: 'combined-app',
        });
        assert.equal(result.isError, undefined);
        assert.equal(uploadRequestIds.length, 1);
        assert.ok(finalizeInput);
        const payload = parseToolJson(result);
        assert.equal(payload.publishMode, 'stage-and-finalize');
        assert.equal(payload.assetCount, 1);
        assert.equal(payload.stagedCount, 1);
        assert.equal(payload.uploadedCount, 1);
        assert.equal(payload.StablePromoted, true);
        assert.equal(payload.transport, 'multipart-stream-to-hdfs');
        assert.equal(payload.jintFileBytes, 0);
        assert.equal(payload.requestId, finalizeInput?.RequestId);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('a transient failed asset upload is retried in-stage with the exact same request id', async () => {
    const root = createTempDirectory();
    try {
        fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head></head><body>retry</body></html>');
        const requestIds = [];
        let failOnce = true;
        const fakeClient = {
            uploadApplicationAssetStream: async (input) => {
                requestIds.push(input.RequestId);
                if (failOnce) {
                    failOnce = false;
                    throw new Error('simulated response loss');
                }
                return {
                    Code: 1,
                    Data: {
                        RequestId: input.RequestId,
                        VersionNo: 'v1.0.0',
                        Path: input.RelativePath,
                        Sha256: input.ExpectedSha256,
                        Size: fs.statSync(input.FilePath).size,
                        Idempotent: true,
                        StablePromoted: false,
                    },
                    Msg: '',
                };
            },
        };
        const input = {
            appIdOrKey: 'retry-app',
            versionNo: 'v1.0.0',
            directory: root,
            publishMode: 'stage',
            confirmExecution: 'retry-app',
        };
        const recovered = await runApplicationDirectoryStreamPublish(fakeClient, input);
        assert.equal(recovered.isError, undefined);
        assert.equal(requestIds.length, 2);
        assert.equal(requestIds[0], requestIds[1]);
        assert.equal(parseToolJson(recovered).idempotentCount, 1);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('deterministic request ids bind batch, version, path/hash and manifest', () => {
    const assetBase = {
        deliveryBatchId: 'batch-1',
        appIdOrKey: 'request-app',
        versionNo: '1.2.3',
        relativePath: 'assets/app.js',
        sha256: 'a'.repeat(64),
    };
    const firstAssetId = buildApplicationAssetRequestId(assetBase);
    assert.equal(firstAssetId, buildApplicationAssetRequestId({ ...assetBase, versionNo: 'v1.2.3' }));
    assert.notEqual(firstAssetId, buildApplicationAssetRequestId({ ...assetBase, relativePath: 'assets/other.js' }));
    assert.notEqual(firstAssetId, buildApplicationAssetRequestId({ ...assetBase, sha256: 'b'.repeat(64) }));
    const firstFinalizeId = buildApplicationFinalizeRequestId({
        deliveryBatchId: 'batch-1',
        appIdOrKey: 'request-app',
        versionNo: 'v1.2.3',
        runtimeManifestHash: 'c'.repeat(64),
    });
    const legacyExpectedId = crypto.createHash('sha256').update([
        'microi-application-finalize-v1',
        'batch-1',
        'request-app',
        'v1.2.3',
        'c'.repeat(64),
    ].join('\n')).digest('hex');
    assert.equal(firstFinalizeId, legacyExpectedId, 'omitting both preconditions must preserve the v1 request id');
    assert.notEqual(firstFinalizeId, buildApplicationFinalizeRequestId({
        deliveryBatchId: 'batch-1',
        appIdOrKey: 'request-app',
        versionNo: 'v1.2.3',
        runtimeManifestHash: 'd'.repeat(64),
    }));
    const preconditionBase = {
        deliveryBatchId: 'batch-1',
        appIdOrKey: 'request-app',
        versionNo: 'v1.2.3',
        runtimeManifestHash: 'c'.repeat(64),
        expectedCurrentVersion: 9,
        expectedAppVersion: 'v1.2.2',
    };
    const preconditionId = buildApplicationFinalizeRequestId(preconditionBase);
    assert.equal(preconditionId, buildApplicationFinalizeRequestId(preconditionBase));
    assert.notEqual(preconditionId, firstFinalizeId);
    assert.notEqual(preconditionId, buildApplicationFinalizeRequestId({ ...preconditionBase, expectedCurrentVersion: 10 }));
    assert.notEqual(preconditionId, buildApplicationFinalizeRequestId({ ...preconditionBase, expectedAppVersion: 'v1.2.1' }));
    assert.notEqual(buildApplicationFinalizeRequestId({ ...preconditionBase, expectedAppVersion: undefined }), buildApplicationFinalizeRequestId({ ...preconditionBase, expectedAppVersion: '' }), 'omitted and explicit-empty AppVersion preconditions must use different idempotency identities');
});
test('evidence mismatch fails closed before finalize', async () => {
    const root = createTempDirectory();
    try {
        fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head></head><body>evidence</body></html>');
        let finalizeCalls = 0;
        const fakeClient = {
            uploadApplicationAssetStream: async (input) => ({
                Code: 1,
                Data: {
                    RequestId: `${input.RequestId}-wrong`,
                    VersionNo: 'v1.0.0',
                    Path: input.RelativePath,
                    Sha256: input.ExpectedSha256,
                    Size: fs.statSync(input.FilePath).size,
                    StablePromoted: false,
                },
                Msg: '',
            }),
            finalizeApplicationStreamPublish: async () => {
                finalizeCalls += 1;
                return { Code: 1, Data: {}, Msg: '' };
            },
        };
        const result = await runApplicationDirectoryStreamPublish(fakeClient, {
            appIdOrKey: 'evidence-app',
            versionNo: 'v1.0.0',
            directory: root,
            expectedCurrentVersion: 1,
            expectedAppVersion: '',
            confirmExecution: 'evidence-app',
        });
        assert.equal(result.isError, true);
        assert.equal(parseToolJson(result).evidenceMismatch, true);
        assert.equal(finalizeCalls, 0);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('legacy stream detector only matches the pre-write Newtonsoft JValue.Val defect', () => {
    assert.equal(isLegacyApplicationStreamJValueFailure({
        Code: 0,
        Data: null,
        Msg: "应用资产流式上传失败：'Newtonsoft.Json.Linq.JValue' does not contain a definition for 'Val'",
    }), true);
    assert.equal(isLegacyApplicationStreamJValueFailure({
        Code: 0,
        Data: null,
        Msg: 'HDFS 上传失败',
    }), false);
    assert.equal(isLegacyApplicationStreamJValueFailure({
        Code: 1,
        Data: null,
        Msg: "'Newtonsoft.Json.Linq.JValue' does not contain a definition for 'Val'",
    }), false);
});
test('legacy stream fallback policy is fail-closed when multipart streaming is required', () => {
    const defect = {
        Code: 0,
        Data: null,
        Msg: "应用资产流式上传失败：'Newtonsoft.Json.Linq.JValue' does not contain a definition for 'Val'",
    };
    assert.deepEqual(resolveLegacyApplicationStreamFallbackPolicy(defect, 0, false), {
        matched: true,
        attemptFallback: false,
        requireMultipartStream: true,
    });
    assert.deepEqual(resolveLegacyApplicationStreamFallbackPolicy(defect, 0, true), {
        matched: true,
        attemptFallback: true,
        requireMultipartStream: false,
    });
    assert.deepEqual(resolveLegacyApplicationStreamFallbackPolicy(defect, 1, false), {
        matched: false,
        attemptFallback: false,
        requireMultipartStream: false,
    });
    assert.deepEqual(resolveLegacyApplicationStreamFallbackPolicy({ ...defect, Msg: 'ordinary upload failure' }, 0, false), {
        matched: false,
        attemptFallback: false,
        requireMultipartStream: false,
    });
});
test('small existing MicroService can use bounded legacy CSharp publish compatibility', async () => {
    const root = createTempDirectory();
    let publishedPayload;
    try {
        fs.mkdirSync(path.join(root, 'assets'));
        fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head></head><body>ok</body></html>');
        fs.writeFileSync(path.join(root, 'assets', 'app.js'), 'window.compat = true;');
        const manifest = await buildLocalApplicationAssetManifest(root);
        const fakeClient = {
            getApplicationContext: async () => ({
                Code: 1,
                Data: {
                    Application: {
                        Id: 'app-row-id',
                        AppKey: 'microi-platform-service',
                        AppName: '平台服务',
                        ApplicationType: 'MicroService',
                        CurrentVersion: 3,
                        AppVersion: 'v1.1.9',
                    },
                },
                Msg: '',
            }),
            publishMicroService: async (payload) => {
                publishedPayload = payload;
                return {
                    Code: 1,
                    Data: { MsKey: 'microi-platform-service', RuntimeManifestHash: manifest.manifestHash },
                    Msg: '',
                };
            },
        };
        const fallback = await tryLegacyMicroServiceStreamPublishFallback(fakeClient, manifest, {
            appIdOrKey: 'app-row-id',
            versionNo: 'v1.2.0',
            routes: [{ PageKey: 'home', RoutePath: '/' }],
            deliveryBatchId: 'delivery-1',
            sourceManifestHash: 'a'.repeat(64),
            expectedCurrentVersion: 3,
            expectedAppVersion: 'v1.1.9',
        });
        assert.equal(fallback.attempted, true);
        assert.equal(fallback.response?.Code, 1);
        const microService = publishedPayload?.microService;
        assert.equal(microService.MsKey, 'microi-platform-service');
        assert.equal(microService.BuildVersion, 'v1.2.0');
        assert.equal(microService.StorageMode, 'file');
        const assets = publishedPayload?.assets;
        assert.equal(assets.length, 2);
        const entry = assets.find(asset => asset.Path === 'index.html');
        assert.equal(entry?.IsEntry, true);
        assert.match(Buffer.from(String(entry?.FileByteBase64), 'base64').toString('utf8'), /<!doctype html>/u);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('opt-in directory publish uses bounded MicroService compatibility after repeated stream resets', async () => {
    const root = createTempDirectory();
    let streamAttempts = 0;
    let legacyPublishes = 0;
    try {
        fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><body>compat fallback</body>');
        const fakeClient = {
            uploadApplicationAssetStream: async () => {
                streamAttempts += 1;
                throw new Error('read ECONNRESET');
            },
            getApplicationContext: async () => ({
                Code: 1,
                Data: {
                    Application: {
                        Id: 'compat-app-row',
                        AppKey: 'compat-app',
                        AppName: '兼容应用',
                        ApplicationType: 'MicroService',
                        CurrentVersion: 4,
                        AppVersion: 'v1.0.4',
                    },
                },
                Msg: '',
            }),
            publishMicroService: async () => {
                legacyPublishes += 1;
                return { Code: 1, Data: { MsKey: 'compat-app' }, Msg: '' };
            },
        };
        const result = await runApplicationDirectoryStreamPublish(fakeClient, {
            appIdOrKey: 'compat-app',
            versionNo: 'v1.0.5',
            directory: root,
            publishMode: 'stage-and-finalize',
            expectedCurrentVersion: 4,
            expectedAppVersion: 'v1.0.4',
            allowLegacyFallback: true,
            confirmExecution: 'compat-app',
        });
        assert.equal(result.isError, undefined);
        assert.equal(streamAttempts, 3);
        assert.equal(legacyPublishes, 1);
        const payload = parseToolJson(result);
        assert.equal(payload.compatibilityFallback, true);
        assert.equal(payload.transport, 'bounded-legacy-microservice-csharp');
        assert.equal(payload.streamFailure, 'read ECONNRESET');
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('legacy compatibility fails closed for Web applications', async () => {
    const root = createTempDirectory();
    let publishCalls = 0;
    try {
        fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head></head><body>web</body></html>');
        const manifest = await buildLocalApplicationAssetManifest(root);
        const fakeClient = {
            getApplicationContext: async () => ({
                Code: 1,
                Data: { Application: { AppKey: 'web-app', ApplicationType: 'Web' } },
                Msg: '',
            }),
            publishMicroService: async () => {
                publishCalls += 1;
                return { Code: 1, Data: {}, Msg: '' };
            },
        };
        const fallback = await tryLegacyMicroServiceStreamPublishFallback(fakeClient, manifest, {
            appIdOrKey: 'web-app',
            versionNo: 'v1.0.1',
            deliveryBatchId: 'delivery-web',
        });
        assert.equal(fallback.attempted, false);
        assert.match(fallback.reason, /只支持 MicroService/u);
        assert.equal(publishCalls, 0);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
//# sourceMappingURL=application-stream-publish.test.js.map