import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ReadBuffer, serializeMessage, STDIO_DEFAULT_MAX_BUFFER_SIZE } from '@modelcontextprotocol/sdk/shared/stdio.js';

const MiB = 1024 * 1024;
const maxWireBytes = 128 * MiB;

// 执行生产入口的真实构造表达式，替换的仅是测试输入/输出流，不复制大小策略。
// 不导入有登录副作用的 index.ts，也不把凭据或业务写入带入协议回归。
function productionTransport() {
  const input = new PassThrough(), output = new PassThrough();
  const source = fs.readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const expression = source.match(/const transport = new StdioServerTransport\([\s\S]*?\);/);
  assert.ok(expression, '生产 stdio 初始化表达式必须存在');
  class BoundTransport extends StdioServerTransport {
    constructor(stdin = input, stdout = output, options?: { maxBufferSize?: number }) { super(stdin, stdout, options); }
  }
  const transport = new Function('StdioServerTransport', 'process', expression[0] + '\nreturn transport;')(BoundTransport, { stdin: input, stdout: output }) as StdioServerTransport;
  return { input, output, transport };
}

test('SDK默认10MiB确实拒绝超过10MiB的旧协议载荷', () => {
  assert.equal(STDIO_DEFAULT_MAX_BUFFER_SIZE, 10 * MiB);
  const reader = new ReadBuffer();
  assert.throws(() => reader.append(Buffer.alloc(10 * MiB + 1)), /maximum size of 10485760 bytes/);
});

test('生产stdio使用固定128MiB有界缓冲，没有新增环境变量或无限buffer', () => {
  const h = productionTransport();
  assert.equal((h.transport as any)._readBuffer._maxBufferSize, maxWireBytes);
  h.input.destroy(); h.output.destroy();
});

test('真实生产Stdio接收34MiB原包大小的Base64请求，并继续读取后续消息', async () => {
  const h = productionTransport(), messages: any[] = [], errors: Error[] = [];
  h.transport.onmessage = message => messages.push(message);
  h.transport.onerror = error => errors.push(error);
  await h.transport.start();
  // 34MiB原始字节编码后的长度；构造合法JSON-RPC，真正经过SDK UTF8解帧/JSON校验。
  const base64Bytes = 4 * Math.ceil((34 * MiB) / 3);
  const packet = Buffer.from(serializeMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'microi_run_engine', arguments: { params: { PreparedPersistPackageByteBase64: 'A'.repeat(base64Bytes) } } } }));
  h.input.write(packet);
  h.input.write(Buffer.from(serializeMessage({ jsonrpc: '2.0', id: 2, method: 'ping' })));
  assert.deepEqual(errors, []);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].params.arguments.params.PreparedPersistPackageByteBase64.length, base64Bytes);
  assert.equal(messages[1].id, 2);
  await h.transport.close(); h.input.destroy(); h.output.destroy();
});

test('真实生产Stdio接收跨UTF8边界的碎片并一次解析多帧及CRLF', async () => {
  const h = productionTransport(), messages: any[] = [], errors: Error[] = [];
  h.transport.onmessage = message => messages.push(message);
  h.transport.onerror = error => errors.push(error);
  await h.transport.start();
  const packet = Buffer.from(serializeMessage({ jsonrpc: '2.0', id: 3, method: 'test', params: { text: 'A'.repeat(11 * MiB) + '审批资料' } }));
  const split = packet.indexOf(Buffer.from('审批')) + 1;
  h.input.write(packet.subarray(0, split));
  assert.equal(messages.length, 0);
  h.input.write(packet.subarray(split));
  h.input.write(Buffer.from(serializeMessage({ jsonrpc: '2.0', id: 4, method: 'ping' }).replace(/\n$/, '\r\n') + serializeMessage({ jsonrpc: '2.0', id: 5, method: 'ping' })));
  assert.deepEqual(errors, []);
  assert.equal(messages[0].params.text.slice(-4), '审批资料');
  assert.deepEqual(messages.map(message => message.id), [3, 4, 5]);
  await h.transport.close(); h.input.destroy(); h.output.destroy();
});

test('ReadBuffer接受精确128MiB未结束帧，超一字节立即拒绝并清空', () => {
  const reader = new ReadBuffer({ maxBufferSize: maxWireBytes });
  reader.append(Buffer.alloc(maxWireBytes, 65));
  assert.equal(reader.readMessage(), null);
  assert.throws(() => reader.append(Buffer.from('A')), /maximum size of 134217728 bytes/);
  reader.append(Buffer.from(serializeMessage({ jsonrpc: '2.0', id: 6, method: 'ping' })));
  assert.equal((reader.readMessage() as any).id, 6);
});

test('真实生产Stdio超128MiB拒绝并关闭，关闭后不能分片绕过或执行下一消息', async () => {
  const h = productionTransport(), messages: any[] = [], errors: Error[] = [];
  let closes = 0;
  h.transport.onmessage = message => messages.push(message);
  h.transport.onerror = error => errors.push(error);
  h.transport.onclose = () => { closes += 1; };
  await h.transport.start();
  h.input.write(Buffer.alloc(maxWireBytes, 65));
  h.input.write(Buffer.from('A'));
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /maximum size of 134217728 bytes/);
  assert.equal(closes, 1);
  h.input.write(Buffer.from(serializeMessage({ jsonrpc: '2.0', id: 7, method: 'ping' })));
  assert.deepEqual(messages, []);
  h.input.destroy(); h.output.destroy();
});

test('大响应须调用端同样使用有界缓冲；真实Stdio发送和ReadBuffer接收不改JSON-RPC正文', async () => {
  const h = productionTransport(), reader = new ReadBuffer({ maxBufferSize: maxWireBytes });
  const results: any[] = [];
  h.output.on('data', chunk => { reader.append(chunk); let message; while ((message = reader.readMessage()) !== null) results.push(message); });
  await h.transport.send({ jsonrpc: '2.0', id: 8, result: { content: [{ type: 'text', text: 'B'.repeat(11 * MiB) }] } });
  assert.equal(results.length, 1);
  assert.equal(results[0].result.content[0].text.length, 11 * MiB);
  assert.equal(results[0].id, 8);
  h.input.destroy(); h.output.destroy();
});
