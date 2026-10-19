/*
 * V8 ApiEngine
 * ApiEngineKey: get-client-ip
 * Version: v1.0.3
 * Function:
 * - 返回当前HTTP调用者公网IPv4；仅对当前实测两个精确直接代理采用XFF最右项，其它来源只用socket。未知代理失败关闭，不接受参数或X-Real-IP覆盖，无业务写入。
 */

var requestContext = V8.HttpContext;
var remoteAddress = requestContext && requestContext.Connection && requestContext.Connection.RemoteIpAddress;
if (!remoteAddress) return { Code: 0, Data: null, Msg: '无法确定当前请求客户端IP[NO_HTTP_PEER]' };
// IPv4 映射地址归一为 IPv4；其它地址保持宿主已解析的 IP 字面量。
if (remoteAddress.IsIPv4MappedToIPv6) remoteAddress = remoteAddress.MapToIPv4();
var clientIP = String(remoteAddress.ToString()).trim();
if (!clientIP) return { Code: 0, Data: null, Msg: '无法确定当前请求客户端IP[EMPTY_HTTP_PEER]' };
// 当前公网入口的直接代理已通过正常/伪造 XFF 的真实请求验证：代理追加调用者在最右。
// 精确 peer 发生变化时失败关闭并重新核验部署，不能扩大为信任全部私网。
var trustedProxyPeers = ['172.16.0.115', '172.30.9.234'];
if (trustedProxyPeers.indexOf(clientIP) >= 0) {
  var headers = V8.Header || {};
  var rawForwarded = String(headers['X-Forwarded-For'] || headers['x-forwarded-for'] || '');
  if (!rawForwarded || rawForwarded.length > 2048) return { Code: 0, Data: null, Msg: '无法确定当前请求客户端IP[INVALID_PROXY_CHAIN]' };
  var forwarded = rawForwarded.split(',');
  if (forwarded.length > 32) return { Code: 0, Data: null, Msg: '无法确定当前请求客户端IP[INVALID_PROXY_CHAIN]' };
  // 只检查最后一项，非法时不向左回退，防止选中调用者伪造的前缀。
  clientIP = forwarded[forwarded.length - 1].trim().replace(/^::ffff:/i, '');
}
// DNS 同步使用 A 记录，私网、文档网段及非规范 IPv4 均不能成为成功响应。
function isPublicIPv4(value) {
  if (!/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value)) return false;
  var octets = value.split('.').map(Number), a = octets[0], b = octets[1], c = octets[2];
  if (octets.some(function(x) { return x > 255; })) return false;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}
if (!isPublicIPv4(clientIP)) return { Code: 0, Data: null, Msg: '无法确定当前请求公网IPv4[INVALID_PUBLIC_IPV4]' };
return { Code: 1, Data: clientIP, Msg: '' };