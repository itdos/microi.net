import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStoreApplicationBackgroundRequest } from './advanced-tools.js';
test('store application MCP request persists only identifiers and a stable background-task key', () => {
    const request = buildStoreApplicationBackgroundRequest({
        operation: 'install',
        storeId: '01KSTOREAPP000000000000001',
        requestId: 'saas-v6.9.4-20260801',
        appId: 'app.microi.saas',
        appName: 'SaaS引擎',
        storeApiBase: 'https://api.itdos.com/',
        storeOsClient: 'iTdos',
    });
    assert.equal(request.ApiEngineKey, 'import-microi-store-package');
    assert.equal(request.Param.StoreId, '01KSTOREAPP000000000000001');
    assert.equal(request.Param.StoreApiBase, 'https://api.itdos.com');
    assert.equal(request.Param.ResumeInstall, true);
    assert.equal(request.Options.IdempotencyKey, 'mcp:store:install:01KSTOREAPP000000000000001:saas-v6.9.4-20260801');
    assert.equal(request.Options.ConcurrencyKey, 'import-microi-store-package');
    const serialized = JSON.stringify(request);
    assert.doesNotMatch(serialized, /AppPakcet|"Package"|"Form"|"Row"/);
});
test('store application MCP request only allows the fixed official marketplace origin', () => {
    for (const storeApiBase of [
        'https://user:secret@api.example.com',
        'https://api.example.com/microi',
        'https://api.example.com?tenant=iTdos',
        'http://api.itdos.com',
        'https://api.itdos.com:8443',
        'https://127.0.0.1',
    ]) {
        assert.throws(() => buildStoreApplicationBackgroundRequest({
            operation: 'update',
            storeId: 'store-1',
            requestId: 'update-20260801',
            storeApiBase,
        }), /storeApiBase/);
    }
});
test('store application MCP request only allows the official marketplace tenant', () => {
    assert.throws(() => buildStoreApplicationBackgroundRequest({
        operation: 'install',
        storeId: 'store-1',
        requestId: 'install-20260801',
        storeOsClient: 'other-tenant',
    }), /storeOsClient/);
});
test('store application MCP request requires a caller-stable idempotency request Id', () => {
    assert.throws(() => buildStoreApplicationBackgroundRequest({
        operation: 'install',
        storeId: 'store-1',
        requestId: 'short',
    }), /requestId/);
});
//# sourceMappingURL=store-application-task.test.js.map