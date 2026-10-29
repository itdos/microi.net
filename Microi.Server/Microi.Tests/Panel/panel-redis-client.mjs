import { createConnection } from 'node:net';

// 验收通过真实主机代理端口读写；凭据只进入 TCP 字节，不放入命令行或测试日志。
export function redisThroughProxy(port, password, ...command) {
  const requests = [...(password == null ? [] : [['AUTH', password]]), command];
  const encode = words => Buffer.concat([Buffer.from(`*${words.length}\r\n`), ...words.flatMap(word => {
    const bytes = Buffer.from(String(word)); return [Buffer.from(`$${bytes.length}\r\n`), bytes, Buffer.from('\r\n')];
  })]);
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0), count = 0, finished = false;
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = (error, value) => { if (finished) return; finished = true; socket.destroy(); error ? reject(error) : resolve(value); };
    socket.setTimeout(10000, () => finish(new Error('Redis proxy response timed out')));
    socket.once('error', () => finish(new Error('Redis proxy connection failed')));
    socket.once('close', () => { if (!finished) finish(new Error('Redis proxy closed before completing the command')); });
    socket.once('connect', () => socket.write(Buffer.concat(requests.map(encode))));
    socket.on('data', bytes => {
      buffer = Buffer.concat([buffer, bytes]);
      if (buffer.length > 65536) return finish(new Error('Redis probe response exceeds its limit'));
      while (buffer.length) {
        const end = buffer.indexOf('\r\n'); if (end < 0) return;
        const type = String.fromCharCode(buffer[0]), value = buffer.subarray(1, end).toString();
        let consumed = end + 2, parsed = value;
        if (type === '-') return finish(new Error(value.startsWith('NOAUTH ') ? 'NOAUTH' : 'Redis rejected the authenticated probe'));
        if (type === '$') {
          if (!/^-?\d+$/.test(value)) return finish(new Error('Invalid Redis bulk length'));
          const length = Number(value);
          if (!Number.isInteger(length) || length < -1 || length > 65536) return finish(new Error('Invalid Redis bulk length'));
          if (length >= 0) {
            if (buffer.length < consumed + length + 2) return;
            if (buffer.subarray(consumed + length, consumed + length + 2).toString() !== '\r\n') return finish(new Error('Invalid Redis bulk terminator'));
            parsed = buffer.subarray(consumed, consumed + length).toString(); consumed += length + 2;
          } else parsed = null;
        } else if (!['+', ':'].includes(type)) return finish(new Error('Unexpected Redis response type'));
        else if (type === ':' && !/^-?\d+$/.test(value)) return finish(new Error('Invalid Redis integer response'));
        buffer = buffer.subarray(consumed); count++;
        if (password != null && count === 1 && (type !== '+' || parsed !== 'OK')) return finish(new Error('Redis authentication was not confirmed'));
        if (count === requests.length) return finish(null, parsed);
      }
    });
  });
}
