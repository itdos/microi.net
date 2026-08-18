using System;
using System.Globalization;
using System.IO;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// V8 后端一次性 TCP 客户端。JavaScript 中通过 V8.Tcp 调用。
    /// 只暴露有界的连接、写入和可选读取，不暴露持久 Socket 对象。
    /// </summary>
    public sealed class V8Tcp
    {
        private const int DefaultConnectTimeoutSeconds = 10;
        private const int DefaultSendTimeoutSeconds = 10;
        private const int DefaultReceiveTimeoutSeconds = 3;
        private const int MaxTimeoutSeconds = 120;
        private const int MaxPayloadBytes = 4 * 1024 * 1024;
        private const int DefaultMaxReceiveBytes = 64 * 1024;
        private const int MaxReceiveBytesLimit = 1024 * 1024;

        static V8Tcp()
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        }

        /// <summary>连接、发送字节并关闭连接。</summary>
        public DosResult Send(object param)
        {
            return SendAsync(param).GetAwaiter().GetResult();
        }

        /// <summary>异步连接、发送字节并关闭连接。</summary>
        public Task<DosResult> SendAsync(object param)
        {
            return ExecuteAsync(param, false);
        }

        /// <summary>连接、发送字节、读取有界响应并关闭连接。</summary>
        public DosResult SendAndReceive(object param)
        {
            return SendAndReceiveAsync(param).GetAwaiter().GetResult();
        }

        /// <summary>异步连接、发送字节、读取有界响应并关闭连接。</summary>
        public Task<DosResult> SendAndReceiveAsync(object param)
        {
            return ExecuteAsync(param, true);
        }

        private static async Task<DosResult> ExecuteAsync(object param, bool receive)
        {
            try
            {
                var options = ParseOptions(param);
                using (var client = new TcpClient())
                {
                    client.NoDelay = options.NoDelay;
                    await ConnectAsync(client, options.Host, options.Port,
                        options.ConnectTimeoutSeconds).ConfigureAwait(false);

                    using (var stream = client.GetStream())
                    {
                        await WriteAsync(stream, options.Payload, options.SendTimeoutSeconds)
                            .ConfigureAwait(false);

                        var remoteEndPoint = client.Client.RemoteEndPoint?.ToString()
                            ?? options.Host + ":" + options.Port.ToString(CultureInfo.InvariantCulture);

                        if (!receive)
                        {
                            return new DosResult(1, new
                            {
                                BytesSent = options.Payload.Length,
                                RemoteEndPoint = remoteEndPoint
                            });
                        }

                        var received = await ReadAsync(stream, options.ReceiveTimeoutSeconds,
                            options.MaxReceiveBytes).ConfigureAwait(false);
                        return new DosResult(1, new
                        {
                            BytesSent = options.Payload.Length,
                            RemoteEndPoint = remoteEndPoint,
                            BytesReceived = received.Bytes.Length,
                            RawBytes = received.Bytes,
                            ByteBase64 = Convert.ToBase64String(received.Bytes),
                            Hex = ToHex(received.Bytes),
                            ReceiveEndReason = received.EndReason,
                            Truncated = received.EndReason == "MaxReceiveBytes"
                        });
                    }
                }
            }
            catch (TcpTimeoutException ex)
            {
                return Failed(ex.Message);
            }
            catch (SocketException ex)
            {
                return Failed("TCP 操作失败（" + ex.SocketErrorCode + "）：" + ex.Message);
            }
            catch (IOException ex) when (ex.InnerException is SocketException socketException)
            {
                return Failed("TCP 操作失败（" + socketException.SocketErrorCode + "）：" + socketException.Message);
            }
            catch (JsonException)
            {
                return Failed("TCP 参数不是有效的 JSON。");
            }
            catch (FormatException ex)
            {
                return Failed("TCP 参数错误：" + ex.Message);
            }
            catch (ArgumentException ex)
            {
                return Failed("TCP 参数错误：" + ex.Message);
            }
            catch (Exception ex)
            {
                return Failed("TCP 操作失败：" + ex.Message);
            }
        }

        private static async Task ConnectAsync(TcpClient client, string host, int port,
            int timeoutSeconds)
        {
            var connectTask = client.ConnectAsync(host, port);
            using (var timeoutCancellation = new CancellationTokenSource())
            {
                var timeoutTask = Task.Delay(TimeSpan.FromSeconds(timeoutSeconds),
                    timeoutCancellation.Token);
                if (await Task.WhenAny(connectTask, timeoutTask).ConfigureAwait(false) != connectTask)
                {
                    client.Close();
                    ObserveLateFault(connectTask);
                    throw new TcpTimeoutException("TCP 连接超时。");
                }

                timeoutCancellation.Cancel();
                await connectTask.ConfigureAwait(false);
            }
        }

        private static void ObserveLateFault(Task task)
        {
            _ = task.ContinueWith(completed =>
                {
                    var ignored = completed.Exception;
                },
                CancellationToken.None,
                TaskContinuationOptions.OnlyOnFaulted | TaskContinuationOptions.ExecuteSynchronously,
                TaskScheduler.Default);
        }

        private static async Task WriteAsync(NetworkStream stream, byte[] payload, int timeoutSeconds)
        {
            using (var cancellation = new CancellationTokenSource(
                       TimeSpan.FromSeconds(timeoutSeconds)))
            {
                try
                {
                    await stream.WriteAsync(payload, 0, payload.Length, cancellation.Token)
                        .ConfigureAwait(false);
                    await stream.FlushAsync(cancellation.Token).ConfigureAwait(false);
                }
                catch (OperationCanceledException) when (cancellation.IsCancellationRequested)
                {
                    throw new TcpTimeoutException("TCP 发送超时。");
                }
            }
        }

        private static async Task<TcpReadResult> ReadAsync(NetworkStream stream, int timeoutSeconds,
            int maxReceiveBytes)
        {
            using (var output = new MemoryStream())
            using (var cancellation = new CancellationTokenSource(
                       TimeSpan.FromSeconds(timeoutSeconds)))
            {
                var buffer = new byte[Math.Min(8192, maxReceiveBytes)];
                var endReason = "RemoteClosed";

                while (output.Length < maxReceiveBytes)
                {
                    var remaining = maxReceiveBytes - (int)output.Length;
                    int read;
                    try
                    {
                        read = await stream.ReadAsync(buffer, 0, Math.Min(buffer.Length, remaining),
                            cancellation.Token).ConfigureAwait(false);
                    }
                    catch (OperationCanceledException) when (cancellation.IsCancellationRequested)
                    {
                        if (output.Length == 0)
                            throw new TcpTimeoutException("TCP 接收超时，未收到响应字节。");
                        endReason = "Timeout";
                        break;
                    }

                    if (read == 0)
                    {
                        endReason = "RemoteClosed";
                        break;
                    }

                    output.Write(buffer, 0, read);
                    if (output.Length >= maxReceiveBytes)
                    {
                        endReason = "MaxReceiveBytes";
                        break;
                    }
                }

                return new TcpReadResult(output.ToArray(), endReason);
            }
        }

        private static TcpOptions ParseOptions(object param)
        {
            var json = ToJObject(param);
            var host = ReadRequiredString(json, "Host").Trim();
            ValidateHost(host);

            var port = ReadRequiredInt(json, "Port");
            if (port < 1 || port > 65535)
                throw new ArgumentException("Port 必须在 1 到 65535 之间。");

            var payload = ReadPayload(json);
            if (payload.Length == 0)
                throw new ArgumentException("发送内容不能为空。");
            if (payload.Length > MaxPayloadBytes)
                throw new ArgumentException("发送内容不能超过 4 MiB。");

            return new TcpOptions
            {
                Host = host,
                Port = port,
                Payload = payload,
                ConnectTimeoutSeconds = ReadBoundedInt(json, "ConnectTimeout",
                    DefaultConnectTimeoutSeconds, 1, MaxTimeoutSeconds),
                SendTimeoutSeconds = ReadBoundedInt(json, "SendTimeout",
                    DefaultSendTimeoutSeconds, 1, MaxTimeoutSeconds),
                ReceiveTimeoutSeconds = ReadBoundedInt(json, "ReceiveTimeout",
                    DefaultReceiveTimeoutSeconds, 1, MaxTimeoutSeconds),
                MaxReceiveBytes = ReadBoundedInt(json, "MaxReceiveBytes",
                    DefaultMaxReceiveBytes, 1, MaxReceiveBytesLimit),
                NoDelay = ReadBool(json, "NoDelay", true)
            };
        }

        private static byte[] ReadPayload(JObject json)
        {
            var bytesToken = FirstValue(json, "Bytes", "RawBytes", "ByteArray");
            var base64Token = FirstValue(json, "ByteBase64", "BytesBase64", "Base64");
            var hexToken = FirstValue(json, "Hex");
            var textToken = FirstValue(json, "Text");

            var sourceCount = (bytesToken == null ? 0 : 1)
                              + (base64Token == null ? 0 : 1)
                              + (hexToken == null ? 0 : 1)
                              + (textToken == null ? 0 : 1);
            if (sourceCount != 1)
                throw new ArgumentException(
                    "Bytes、ByteBase64、Hex、Text 必须且只能提供一种发送内容。");

            if (bytesToken != null) return ReadByteArray(bytesToken);
            if (base64Token != null)
            {
                var value = ReadTokenString(base64Token, "ByteBase64");
                try
                {
                    return Convert.FromBase64String(value);
                }
                catch (FormatException)
                {
                    throw new FormatException("ByteBase64 不是有效的 Base64。");
                }
            }

            if (hexToken != null) return ReadHex(ReadTokenString(hexToken, "Hex"));

            var text = ReadTokenString(textToken, "Text");
            var encodingName = ReadOptionalString(json, "Encoding") ?? "utf-8";
            return ResolveEncoding(encodingName).GetBytes(text);
        }

        private static byte[] ReadByteArray(JToken token)
        {
            if (token.Type == JTokenType.Bytes)
                return token.Value<byte[]>() ?? Array.Empty<byte>();
            if (!(token is JArray array))
                throw new ArgumentException("Bytes 必须是 0 到 255 的整数数组。");

            var bytes = new byte[array.Count];
            for (var i = 0; i < array.Count; i++)
            {
                var item = array[i];
                if (item == null || !TryReadIntegralInt64(item, out var value))
                    throw new ArgumentException("Bytes[" + i + "] 必须是整数。");
                if (value < byte.MinValue || value > byte.MaxValue)
                    throw new ArgumentException("Bytes[" + i + "] 必须在 0 到 255 之间。");
                bytes[i] = (byte)value;
            }
            return bytes;
        }

        private static byte[] ReadHex(string value)
        {
            var normalized = new StringBuilder(value.Length);
            for (var i = 0; i < value.Length; i++)
            {
                var character = value[i];
                if (character == '0' && i + 1 < value.Length
                                     && (value[i + 1] == 'x' || value[i + 1] == 'X'))
                {
                    i++;
                    continue;
                }
                if (char.IsWhiteSpace(character) || character == '-'
                                                      || character == ':' || character == ','
                                                      || character == '_')
                    continue;
                if (!Uri.IsHexDigit(character))
                    throw new FormatException("Hex 包含非十六进制字符。");
                normalized.Append(character);
            }

            if (normalized.Length % 2 != 0)
                throw new FormatException("Hex 的有效字符数必须为偶数。");

            var bytes = new byte[normalized.Length / 2];
            for (var i = 0; i < bytes.Length; i++)
                bytes[i] = byte.Parse(normalized.ToString(i * 2, 2),
                    NumberStyles.HexNumber, CultureInfo.InvariantCulture);
            return bytes;
        }

        private static Encoding ResolveEncoding(string name)
        {
            var normalized = (name ?? string.Empty).Trim().ToLowerInvariant()
                .Replace("_", "-");
            switch (normalized)
            {
                case "utf8":
                case "utf-8":
                    return new UTF8Encoding(false);
                case "ascii":
                case "us-ascii":
                    return Encoding.ASCII;
                case "gb18030":
                    return Encoding.GetEncoding(54936);
                case "gbk":
                case "gb2312":
                    return Encoding.GetEncoding(936);
                case "unicode":
                case "utf16":
                case "utf-16":
                case "utf-16le":
                    return Encoding.Unicode;
                case "utf16be":
                case "utf-16be":
                    return Encoding.BigEndianUnicode;
                case "utf32":
                case "utf-32":
                case "utf-32le":
                    return new UTF32Encoding(false, false);
                case "utf32be":
                case "utf-32be":
                    return new UTF32Encoding(true, false);
                default:
                    throw new ArgumentException(
                        "Encoding 仅支持 utf-8、ascii、gb18030、gbk/gb2312、utf-16le、utf-16be、utf-32le、utf-32be；其它编码请传预编码 Bytes/Base64/Hex。");
            }
        }

        private static void ValidateHost(string host)
        {
            if (host.Length == 0 || host.Length > 255)
                throw new ArgumentException("Host 不能为空且长度不能超过 255。");
            foreach (var character in host)
            {
                if (char.IsControl(character) || char.IsWhiteSpace(character))
                    throw new ArgumentException("Host 不能包含控制字符或空白字符。");
            }
            if (host.Contains("/") || host.Contains("\\") || host.Contains("@")
                || host.Contains("?") || host.Contains("#"))
                throw new ArgumentException("Host 只允许主机名或 IP 地址，不能传 URL。");
        }

        private static JObject ToJObject(object param)
        {
            if (param == null) return new JObject();
            if (param is JObject jObject) return (JObject)jObject.DeepClone();
            if (param is string text)
            {
                if (string.IsNullOrWhiteSpace(text)) return new JObject();
                return JObject.Parse(text);
            }
            try
            {
                return JObject.FromObject(param);
            }
            catch
            {
                return JObject.Parse(JsonConvert.SerializeObject(param));
            }
        }

        private static string ReadRequiredString(JObject json, string name)
        {
            var token = GetValue(json, name);
            if (token == null || token.Type == JTokenType.Null)
                throw new ArgumentException(name + " 不能为空。");
            return ReadTokenString(token, name);
        }

        private static string ReadTokenString(JToken token, string name)
        {
            if (token.Type != JTokenType.String)
                throw new ArgumentException(name + " 必须是字符串。");
            return token.Value<string>() ?? string.Empty;
        }

        private static string ReadOptionalString(JObject json, string name)
        {
            var token = GetValue(json, name);
            if (token == null || token.Type == JTokenType.Null) return null;
            return ReadTokenString(token, name);
        }

        private static int ReadRequiredInt(JObject json, string name)
        {
            var token = GetValue(json, name);
            if (token == null || token.Type == JTokenType.Null)
                throw new ArgumentException(name + " 不能为空。");
            if (!TryReadIntegralInt64(token, out var value))
                throw new ArgumentException(name + " 必须是整数。");
            if (value < int.MinValue || value > int.MaxValue)
                throw new ArgumentException(name + " 超出整数范围。");
            return (int)value;
        }

        private static int ReadBoundedInt(JObject json, string name, int defaultValue, int min, int max)
        {
            var token = GetValue(json, name);
            if (token == null || token.Type == JTokenType.Null) return defaultValue;
            if (!TryReadIntegralInt64(token, out var value))
                throw new ArgumentException(name + " 必须是整数。");
            if (value < min || value > max)
                throw new ArgumentException(name + " 必须在 " + min + " 到 " + max + " 之间。");
            return (int)value;
        }

        private static bool TryReadIntegralInt64(JToken token, out long value)
        {
            value = 0;
            if (token.Type == JTokenType.Integer)
            {
                value = token.Value<long>();
                return true;
            }
            if (token.Type != JTokenType.Float) return false;

            var number = token.Value<double>();
            if (double.IsNaN(number) || double.IsInfinity(number)
                                     || Math.Truncate(number) != number
                                     || number < long.MinValue || number > long.MaxValue)
                return false;
            value = (long)number;
            return true;
        }

        private static bool ReadBool(JObject json, string name, bool defaultValue)
        {
            var token = GetValue(json, name);
            if (token == null || token.Type == JTokenType.Null) return defaultValue;
            if (token.Type != JTokenType.Boolean)
                throw new ArgumentException(name + " 必须是布尔值。");
            return token.Value<bool>();
        }

        private static JToken FirstValue(JObject json, params string[] names)
        {
            foreach (var name in names)
            {
                var value = GetValue(json, name);
                if (value != null && value.Type != JTokenType.Null) return value;
            }
            return null;
        }

        private static JToken GetValue(JObject json, string name)
        {
            return json.GetValue(name, StringComparison.OrdinalIgnoreCase);
        }

        private static string ToHex(byte[] bytes)
        {
            var builder = new StringBuilder(bytes.Length * 2);
            foreach (var value in bytes)
                builder.Append(value.ToString("X2", CultureInfo.InvariantCulture));
            return builder.ToString();
        }

        private static DosResult Failed(string message)
        {
            return new DosResult(0, null, message);
        }

        private sealed class TcpOptions
        {
            public string Host { get; set; }
            public int Port { get; set; }
            public byte[] Payload { get; set; }
            public int ConnectTimeoutSeconds { get; set; }
            public int SendTimeoutSeconds { get; set; }
            public int ReceiveTimeoutSeconds { get; set; }
            public int MaxReceiveBytes { get; set; }
            public bool NoDelay { get; set; }
        }

        private sealed class TcpReadResult
        {
            public TcpReadResult(byte[] bytes, string endReason)
            {
                Bytes = bytes;
                EndReason = endReason;
            }

            public byte[] Bytes { get; }
            public string EndReason { get; }
        }

        private sealed class TcpTimeoutException : TimeoutException
        {
            public TcpTimeoutException(string message) : base(message)
            {
            }
        }
    }
}
