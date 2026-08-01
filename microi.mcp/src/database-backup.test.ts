import assert from 'node:assert/strict';
import test from 'node:test';
import { MicroiClient } from './microi-client.js';

function createClient(): MicroiClient {
  return new MicroiClient({
    apiBaseUrl: 'https://microi.test',
    username: '',
    password: '',
    osClient: 'iTdos',
    token: 'test-token',
    requestTimeoutMs: 1_000,
    writeRequestTimeoutMs: 1_000,
  });
}

test('database backup tenant catalog is bound to the configured MCP tenant', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      assert.equal(String(input), 'https://microi.test/api/V8Engine/ListDatabaseBackupTenants');
      const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      assert.equal(body.OsClient, 'iTdos');
      return new Response(JSON.stringify({ Code: 1, Data: { Tenants: [] }, Msg: '' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    assert.equal((await createClient().listDatabaseBackupTenants()).Code, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('database backup execution sends confirmation and preserves selected tenant whitelist', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      assert.equal(String(input), 'https://microi.test/api/V8Engine/RunDatabaseBackup');
      const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      assert.equal(body.OsClient, 'iTdos');
      assert.equal(body.ConfirmExecution, 'DATABASE_BACKUP');
      assert.equal(body.RetainCount, 9);
      assert.deepEqual(body.TenantOsClients, ['iTdos', 'tenant-a']);
      assert.equal(body.IdempotencyKey, 'acceptance-20260801');
      return new Response(JSON.stringify({ Code: 1, Data: { TaskId: 'task-1' }, Msg: '' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const result = await createClient().runDatabaseBackup({
      tenantOsClients: ['iTdos', 'tenant-a'],
      retainCount: 9,
      idempotencyKey: 'acceptance-20260801',
    });
    assert.equal(result.Code, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('omitting tenantOsClients requests all server-eligible tenants without an empty array', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      assert.equal(Object.hasOwn(body, 'TenantOsClients'), false);
      return new Response(JSON.stringify({ Code: 1, Data: {}, Msg: '' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    assert.equal((await createClient().runDatabaseBackup({
      idempotencyKey: 'all-eligible-20260801',
    })).Code, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('database backup rejects a missing or unsafe idempotency key before any request', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  try {
    globalThis.fetch = (async () => {
      called = true;
      throw new Error('must not be called');
    }) as typeof fetch;
    await assert.rejects(
      () => createClient().runDatabaseBackup({ idempotencyKey: 'short' }),
      /idempotencyKey is required/,
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
