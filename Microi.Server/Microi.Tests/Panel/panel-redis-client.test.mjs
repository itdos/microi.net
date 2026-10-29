import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { redisThroughProxy } from './panel-redis-client.mjs';

// 这里仅验证验收客户端的 TCP/RESP 处理，不运行 Redis，不能计作真实数据库或主机代理验收。
function completeRequests(bytes, expected) {
  let offset = 0;
  for (let frame = 0; frame < expected; frame++) {
    let end = bytes.indexOf('\r\n', offset); if (end < 0) return false;
    const header = bytes.subarray(offset, end).toString(); assert.match(header, /^\*[1-9]\d*$/);
    offset = end + 2;
    for (let word = 0; word < Number(header.slice(1)); word++) {
      end = bytes.indexOf('\r\n', offset); if (end < 0) return false;
      const size = bytes.subarray(offset, end).toString(); assert.match(size, /^\$\d+$/);
      const length = Number(size.slice(1)); offset = end + 2;
      if (bytes.length < offset + length + 2) return false;
      assert.equal(bytes.subarray(offset + length, offset + length + 2).toString(), '\r\n');
      offset += length + 2;
    }
  }
  return true;
}

async function fixture(t, respond, expected = 2) {
  const sockets = new Set(), requests = []; let connections = 0;
  const server = createServer(socket => {
    const index = connections++; sockets.add(socket);
    socket.on('error', () => {}); socket.on('close', () => sockets.delete(socket));
    const chunks = []; let sent = false;
    socket.on('data', chunk => {
      chunks.push(chunk); const value = Buffer.concat(chunks); requests[index] = value;
      if (!sent && completeRequests(value, expected)) {
        sent = true;
        Promise.resolve(respond(socket, value)).catch(error => socket.destroy(error));
      }
    });
  });
  // 随机 loopback 端口及逐项 teardown 避免占用正式面板、Redis 或其它对话的固定端口。
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); });
  return { port: server.address().port, requests, get connections() { return connections; } };
}

test('fragmented AUTH and UTF8 bulk preserve byte lengths and embedded CRLF', async t => {
  const payload = Buffer.from('你\r\n好');
  const f = await fixture(t, async socket => {
    for (const part of [Buffer.from('+O'), Buffer.from('K\r'), Buffer.from('\n$8\r\n'), payload.subarray(0, 1), payload.subarray(1), Buffer.from('\r'), Buffer.from('\n')]) {
      socket.write(part); await new Promise(resolve => setTimeout(resolve, 3));
    }
  });
  assert.equal(await redisThroughProxy(f.port, '密钥', 'GET', '键'), '你\r\n好');
  assert(f.requests[0].includes(Buffer.from('$6\r\n密钥\r\n')));
  assert(f.requests[0].includes(Buffer.from('$3\r\n键\r\n'))); assert.equal(f.connections, 1);
});

test('unauthenticated probe classifies NOAUTH without leaking server text', async t => {
  const f = await fixture(t, s => s.end('-NOAUTH secret-sentinel authentication required\r\n'), 1);
  await assert.rejects(redisThroughProxy(f.port, null, 'GET', 'k'), { message: 'NOAUTH' });
  assert(!f.requests[0].includes(Buffer.from('AUTH'))); assert.equal(f.connections, 1);
});

test('AUTH failure is redacted and never retried', async t => {
  const secret = 'secret-sentinel';
  const f = await fixture(t, s => s.end('-WRONGPASS ' + secret + '\r\n-NOAUTH ' + secret + '\r\n'));
  await assert.rejects(redisThroughProxy(f.port, secret, 'GET', 'k'), error => error.message === 'Redis rejected the authenticated probe' && !error.stack.includes(secret));
  assert.equal(f.connections, 1);
});

test('closed partial bulk rejects instead of resolving partial data or retrying', async t => {
  const f = await fixture(t, s => s.end('+OK\r\n$9\r\npartial'));
  await assert.rejects(redisThroughProxy(f.port, 'secret', 'GET', 'k'), { message: 'Redis proxy closed before completing the command' });
  assert.equal(f.connections, 1);
});

test('reset before reply rejects without retrying SET', async t => {
  const f = await fixture(t, s => s.destroy());
  await assert.rejects(redisThroughProxy(f.port, 'secret', 'SET', 'k', 'v'), /Redis proxy (closed before completing the command|connection failed)/);
  assert.equal(f.connections, 1);
});

test('null bulk is returned as null', async t => {
  const f = await fixture(t, s => s.end('+OK\r\n$-1\r\n'));
  assert.equal(await redisThroughProxy(f.port, 'secret', 'GET', 'k'), null);
});

test('bulk terminator corruption and oversized replies fail safely', async t => {
  const bad = await fixture(t, s => s.end('+OK\r\n$1\r\nxXX'));
  await assert.rejects(redisThroughProxy(bad.port, 'secret', 'GET', 'k'), /Invalid Redis bulk terminator/);
  const large = await fixture(t, s => s.end('+OK\r\n$65537\r\n'));
  await assert.rejects(redisThroughProxy(large.port, 'secret', 'GET', 'k'), /Invalid Redis bulk length/);
});

test('AUTH requires simple-string OK instead of a bulk string with matching text', async t => {
  const f = await fixture(t, s => s.end('$2\r\nOK\r\n$1\r\nx\r\n'));
  await assert.rejects(redisThroughProxy(f.port, 'secret', 'GET', 'k'), /authentication|response/);
});

test('RESP bulk length rejects exponent syntax instead of accepting a malformed frame', async t => {
  const f = await fixture(t, s => s.end('+OK\r\n$1e0\r\nx\r\n'));
  await assert.rejects(redisThroughProxy(f.port, 'secret', 'GET', 'k'), /Invalid Redis bulk length/);
});
