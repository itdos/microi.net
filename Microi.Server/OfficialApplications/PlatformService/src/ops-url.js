export function normalizeOpsUrl(value) {
  if (!String(value || '').trim()) return '';
  const url = new URL(String(value).trim());
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) {
    throw new Error('运维地址必须使用 HTTPS；本机测试允许回环 HTTP。地址不能包含凭据或查询参数。');
  }
  return url.href;
}
