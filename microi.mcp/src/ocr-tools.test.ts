import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { MicroiClient, OcrRecognizeRequest } from './microi-client.js';
import { createMcpServer, prepareMcpOcrInput } from './server.js';

const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function toolText(result: CallToolResult): string {
  return result.content
    .filter(item => item.type === 'text')
    .map(item => item.type === 'text' ? item.text : '')
    .join('\n');
}

test('microi_ocr_recognize requires consent and forwards only the safe tenant-bound contract', async () => {
  let recognizeInput: OcrRecognizeRequest | undefined;
  const audits: Array<{ action: string; target: string; content: string }> = [];
  const fakeClient = {
    writeAuditLog: async (action: string, target: string, content: string) => {
      audits.push({ action, target, content });
      return { Code: 1, Data: null, Msg: '' };
    },
    recognizeOcr: async (input: OcrRecognizeRequest) => {
      recognizeInput = input;
      return {
        Code: 1,
        Msg: '识别成功。',
        Data: {
          Provider: 'PaddleX',
          TraceId: 'trace-1',
          FileName: 'receipt.png',
          FileType: 'PNG',
          Text: '吾码 OCR',
          AverageConfidence: 0.98,
          PageCount: 1,
          ElapsedMilliseconds: 42,
          Pages: [{
            PageIndex: 0,
            Text: '吾码 OCR',
            AverageConfidence: 0.98,
            Regions: [{ Text: '吾码 OCR', Confidence: 0.98, Polygon: [[0, 0], [1, 0], [1, 1], [0, 1]] }],
          }],
        },
      };
    },
  } as unknown as MicroiClient;

  const server = createMcpServer(fakeClient, {
    osClient: 'tenant-a',
    apiBaseUrl: 'https://microi.test',
    label: '测试租户',
    codexMode: true,
  });
  const client = new Client({ name: 'microi-ocr-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const catalog = await client.callTool({
      name: 'microi_codex',
      arguments: { action: 'list_tools', params: { keyword: 'ocr' } },
    }) as CallToolResult;
    assert.match(toolText(catalog), /microi_ocr_recognize/u);

    const blocked = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_ocr_recognize',
        params: { fileByteBase64: ONE_PIXEL_PNG_BASE64, fileName: 'receipt.png' },
      },
    }) as CallToolResult;
    assert.equal(blocked.isError, true);
    assert.match(toolText(blocked), /confirmExecution="OCR"/u);
    assert.equal(recognizeInput, undefined);
    assert.equal(audits.length, 0);

    const response = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_ocr_recognize',
        params: {
          fileByteBase64: ONE_PIXEL_PNG_BASE64,
          fileName: 'receipt.png',
          useDocOrientationClassify: true,
          includePages: true,
          includeRegions: false,
          confirmExecution: 'OCR',
          OsClient: 'forged-tenant',
          Endpoint: 'https://evil.example/ocr',
          ApiKey: 'forged-secret',
          HeadersJson: '{"Authorization":"forged"}',
        },
      },
    }) as CallToolResult;

    assert.equal(response.isError, false);
    const forwarded = recognizeInput as OcrRecognizeRequest | undefined;
    assert.ok(forwarded);
    assert.deepEqual(Object.keys(forwarded).sort(), [
      'FileByteBase64',
      'FileName',
      'ReturnWordBox',
      'TextRecScoreThresh',
      'UseDocOrientationClassify',
      'UseDocUnwarping',
      'UseTextlineOrientation',
    ].sort());
    assert.equal(forwarded.FileName, 'receipt.png');
    assert.equal(forwarded.UseDocOrientationClassify, true);
    assert.equal((forwarded as unknown as Record<string, unknown>).OsClient, undefined);
    assert.equal((forwarded as unknown as Record<string, unknown>).Endpoint, undefined);
    assert.equal((forwarded as unknown as Record<string, unknown>).ApiKey, undefined);

    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, 'microi_ocr_recognize');
    assert.equal(audits[0].target, 'receipt.png');
    assert.doesNotMatch(audits[0].content, /evil|forged|iVBOR|吾码 OCR|tenant-a/u);
    assert.match(audits[0].content, /"byteLength":/u);
    assert.match(audits[0].content, /"sha256":"[a-f0-9]{64}"/u);

    const payload = JSON.parse(toolText(response)) as {
      Code: number;
      Data: { Text: string; Pages: Array<Record<string, unknown>> };
    };
    assert.equal(payload.Code, 1);
    assert.equal(payload.Data.Text, '吾码 OCR');
    assert.equal(payload.Data.Pages.length, 1);
    assert.equal(payload.Data.Pages[0].Regions, undefined);
  } finally {
    await client.close();
    await server.close();
  }
});

test('prepareMcpOcrInput rejects ambiguous, relative and unsupported inputs before HTTP', () => {
  assert.throws(
    () => prepareMcpOcrInput({}),
    /必须且只能提供一个/u,
  );
  assert.throws(
    () => prepareMcpOcrInput({
      filePath: 'relative.png',
      fileByteBase64: ONE_PIXEL_PNG_BASE64,
    }),
    /必须且只能提供一个/u,
  );
  assert.throws(
    () => prepareMcpOcrInput({ filePath: 'relative.png' }),
    /绝对路径/u,
  );
  assert.throws(
    () => prepareMcpOcrInput({
      fileByteBase64: ONE_PIXEL_PNG_BASE64,
      fileName: 'payload.exe',
    }),
    /仅支持 PDF/u,
  );
});
