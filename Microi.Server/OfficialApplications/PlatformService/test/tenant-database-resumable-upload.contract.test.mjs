import assert from 'node:assert/strict';
import test from 'node:test';
import { createMicroiV8 } from '../src/utils/microi.v8.js';

function makeFile(content, name = 'database.zip') {
  const file = new Blob([content], { type: 'application/zip' });
  Object.defineProperty(file, 'name', { value: name });
  Object.defineProperty(file, 'lastModified', { value: 1_789_000_000_000 });
  return file;
}

test('database ZIP upload resumes verified parts and reports real progress', async () => {
  const originalXhr = globalThis.XMLHttpRequest;
  const uploadedParts = [];
  const progress = [];
  const sessionId = `mcitu-${'a'.repeat(32)}`;
  let completeCalls = 0;

  class FakeXmlHttpRequest {
    constructor() {
      this.upload = {};
      this.headers = {};
      this.status = 0;
      this.responseText = '';
    }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(key, value) { this.headers[key.toLowerCase()] = value; }
    getResponseHeader() { return ''; }
    send(blob) {
      void Promise.resolve().then(() => {
        const partNumber = Number(new URL(this.url).searchParams.get('partNumber'));
        uploadedParts.push({ partNumber, size: blob.size, type: this.headers['content-type'] });
        this.upload.onprogress?.({ lengthComputable: true, loaded: blob.size, total: blob.size });
        this.status = 200;
        this.responseText = JSON.stringify({
          Code: 1,
          Data: { SessionId: sessionId, TotalSize: 12, TotalParts: 3, ChunkSize: 4, Parts: [] }
        });
        this.onload?.();
      });
    }
    abort() { this.onabort?.(); }
  }

  globalThis.XMLHttpRequest = FakeXmlHttpRequest;
  try {
    const client = createMicroiV8({
      apiBase: 'https://api.example.test',
      osClient: 'iTdos',
      token: 'test-token',
      appendOsClientQuery: true,
      requestAdapter: async ({ url }) => {
        if (url.includes('InitiateTenantDatabaseUpload')) {
          return {
            statusCode: 200,
            data: {
              Code: 1,
              Data: {
                SessionId: sessionId,
                Status: 'Uploading',
                TotalSize: 12,
                TotalParts: 3,
                ChunkSize: 4,
                Parts: [{
                  Number: 1,
                  Size: 4,
                  Sha256: '88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589'
                }]
              }
            }
          };
        }
        if (url.includes('CompleteTenantDatabaseUpload')) {
          completeCalls += 1;
          return {
            statusCode: 200,
            data: { Code: 1, Data: { SessionId: sessionId, Status: 'Succeeded', Path: '/itdos/file/tenant-database/database.zip' } }
          };
        }
        throw new Error(`unexpected request: ${url}`);
      }
    });

    const result = await client.uploadTenantDatabaseZip(makeFile('abcdefghijkl'), {
      onProgress: value => progress.push(value)
    });

    assert.equal(result.Code, 1);
    assert.deepEqual(uploadedParts.map(item => item.partNumber), [2, 3]);
    assert.ok(uploadedParts.every(item => item.type === 'application/octet-stream'));
    assert.equal(completeCalls, 1);
    assert.equal(progress.at(-1).phase, 'completed');
    assert.equal(progress.at(-1).percent, 100);
    assert.ok(progress.some(item => item.phase === 'resuming'));
  } finally {
    globalThis.XMLHttpRequest = originalXhr;
  }
});
