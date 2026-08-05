using System.Net;
using System.Net.Sockets;
using System.Text;
using Dos.ORM;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

[Collection("TenantContextGlobal")]
public sealed class TranslateGatewayTests
{
    [Fact]
    public void LibreBusinessSurface_IsTenantBoundAndNormalizesEverySupportedOperation()
    {
        using var server = new FakeLibreTranslateServer();
        const string tenant = "translate_gateway_full_surface";
        var originalMaster = OsClientDefault.OsClient;
        OsClientDefault.OsClient = "translate_gateway_master";
        var testDb = new DbSession(
            DatabaseType.MySql,
            "Server=127.0.0.1;Port=1;Database=translate_test;Uid=test;Pwd=test;");
        OsClientExtend.ClientList[tenant] = new OsClientSecret
        {
            OsClient = tenant,
            Db = testDb,
            DbRead = testDb,
            OsClientModel = new JObject
            {
                ["TranslateProvider"] = "LibreTranslate",
                ["TranslateUrl"] = server.BaseUrl,
                ["TranslateApiKey"] = "unit-test-key",
                ["TranslateTimeout"] = 10
            }
        };

        try
        {
            using (V8TenantContext.Enter(tenant, "translate-gateway-test"))
            {
                var engine = new TranslateEngine();
                var translated = engine.TranslateText(new MicroiTranslateTextParam
                {
                    SourceTexts = new List<string> { "你好", "世界" },
                    FromLang = "auto",
                    Lang = "en",
                    Format = "text",
                    Alternatives = 2,
                    OsClient = "forged-tenant"
                });
                Assert.True(translated.Code == 1, $"Translate failed with Code={translated.Code}: {translated.Msg}");
                Assert.Equal(new[] { "Hello", "World" }, translated.Data!.TranslatedTexts);
                Assert.Equal("zh", translated.Data.DetectedLanguage!.Language);
                Assert.Equal(new[] { "Hi" }, translated.Data.AlternativeGroups[0]);

                var v8 = new V8EngineParam { TranslateEngine = engine };
                var scriptEngine = new Jint.Engine();
                scriptEngine.SetValue("V8", v8);
                Assert.True(Convert.ToBoolean(scriptEngine.Evaluate(
                    "['Translate','TranslateText','Detect','GetLanguages','TranslateFile','Suggest','Health']" +
                    ".every(function(name){ return typeof V8.TranslateEngine[name] === 'function'; })")
                    .ToObject()));
                Assert.Equal("World", Convert.ToString(scriptEngine.Evaluate(
                    "V8.TranslateEngine.TranslateText({" +
                    "SourceTexts:['你好','世界'],FromLang:'auto',Lang:'en',Format:'text',Alternatives:2" +
                    "}).Data.TranslatedTexts[1]").ToObject()));

                var detected = engine.Detect(new MicroiTranslateDetectParam
                {
                    SourceText = "Bonjour",
                    OsClient = "forged-tenant"
                });
                Assert.Equal(1, detected.Code);
                Assert.Equal("fr", detected.Data![0].Language);
                Assert.Equal(98m, detected.Data[0].Confidence);

                var languages = engine.GetLanguages("forged-tenant");
                Assert.Equal(1, languages.Code);
                Assert.Contains(languages.Data!, item => item.Code == "zh-Hans" && item.Targets.Contains("en"));

                var file = engine.TranslateFile(new MicroiTranslateFileParam
                {
                    FileName = "note.txt",
                    FileByteBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes("你好")),
                    FromLang = "zh",
                    Lang = "en",
                    OsClient = "forged-tenant"
                });
                Assert.Equal(1, file.Code);
                Assert.Equal("translated.txt", file.Data!.FileName);
                Assert.Equal("translated file", Encoding.UTF8.GetString(Convert.FromBase64String(file.Data.FileByteBase64)));

                var suggestion = engine.Suggest(new MicroiTranslateSuggestParam
                {
                    SourceText = "Hello",
                    SuggestedText = "你好",
                    FromLang = "en",
                    Lang = "zh",
                    OsClient = "forged-tenant"
                });
                Assert.Equal(1, suggestion.Code);
                Assert.True(suggestion.Data!.Success);

                var health = engine.Health("forged-tenant");
                Assert.Equal(1, health.Code);
                Assert.True(health.Data!.Healthy);
                Assert.True(health.Data.SupportsFiles);
            }

            Assert.DoesNotContain(server.Requests, request => request.PathAndQuery.Contains("unit-test-key", StringComparison.Ordinal));
            Assert.All(server.Requests, request => Assert.DoesNotContain("forged-tenant", request.Body, StringComparison.Ordinal));
            Assert.Contains(server.Requests, request =>
                request.PathAndQuery == "/suggest"
                && request.Body.Contains("\"target\":\"zh-Hans\"", StringComparison.Ordinal));
        }
        finally
        {
            OsClientExtend.ClientList.TryRemove(tenant, out _);
            OsClientDefault.OsClient = originalMaster;
        }
    }

    [Fact]
    public void TranslationContracts_EnforceLimitsAndDoNotFallbackToMainTenantCredentials()
    {
        var engine = new TranslateEngine();
        var tooMany = engine.TranslateText(new MicroiTranslateTextParam
        {
            SourceTexts = Enumerable.Range(0, 51).Select(index => index.ToString()).ToList(),
            Lang = "en",
            OsClient = "translate_limits_unconfigured"
        });
        Assert.Equal(0, tooMany.Code);
        Assert.Contains("50", tooMany.Msg);

        var source = File.ReadAllText(Path.Combine(
            FindRepositoryRoot(), "Microi.Server", "Microi.net", "TranslateEngine", "TranslateEngine.cs"));
        Assert.DoesNotContain("GetConfigOsClient()", source, StringComparison.Ordinal);
        Assert.Contains("HashSensitive(config?.ApiKey)", source, StringComparison.Ordinal);
    }

    private static string FindRepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            if (Directory.Exists(Path.Combine(current.FullName, "Microi.Server"))) return current.FullName;
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("Repository root was not found.");
    }

    private sealed class FakeLibreTranslateServer : IDisposable
    {
        private readonly TcpListener _listener;
        private readonly CancellationTokenSource _stop = new();
        private readonly Task _loop;
        private readonly object _requestsLock = new();
        private readonly List<RequestSnapshot> _requests = new();

        public FakeLibreTranslateServer()
        {
            _listener = new TcpListener(IPAddress.Loopback, 0);
            _listener.Start();
            var port = ((IPEndPoint)_listener.LocalEndpoint).Port;
            BaseUrl = $"http://127.0.0.1:{port}";
            _loop = Task.Run(AcceptLoopAsync);
        }

        public string BaseUrl { get; }
        public IReadOnlyList<RequestSnapshot> Requests
        {
            get
            {
                lock (_requestsLock) return _requests.ToList();
            }
        }

        private async Task AcceptLoopAsync()
        {
            while (!_stop.IsCancellationRequested)
            {
                try
                {
                    var client = await _listener.AcceptTcpClientAsync();
                    _ = Task.Run(() => HandleAsync(client));
                }
                catch when (_stop.IsCancellationRequested)
                {
                    return;
                }
            }
        }

        private async Task HandleAsync(TcpClient client)
        {
            using (client)
            using (var stream = client.GetStream())
            {
                var headerBytes = new List<byte>();
                var marker = new byte[] { 13, 10, 13, 10 };
                while (headerBytes.Count < 64 * 1024)
                {
                    var value = stream.ReadByte();
                    if (value < 0) return;
                    headerBytes.Add((byte)value);
                    if (headerBytes.Count >= 4 && headerBytes.TakeLast(4).SequenceEqual(marker)) break;
                }
                var headerText = Encoding.ASCII.GetString(headerBytes.ToArray());
                var lines = headerText.Split(new[] { "\r\n" }, StringSplitOptions.None);
                var requestParts = lines[0].Split(' ');
                var pathAndQuery = requestParts.Length > 1 ? requestParts[1] : "/";
                var contentLength = lines
                    .Where(line => line.StartsWith("Content-Length:", StringComparison.OrdinalIgnoreCase))
                    .Select(line => int.TryParse(line.Split(':')[1].Trim(), out var value) ? value : 0)
                    .FirstOrDefault();
                var bodyBytes = new byte[contentLength];
                var offset = 0;
                while (offset < bodyBytes.Length)
                {
                    var read = await stream.ReadAsync(bodyBytes.AsMemory(offset, bodyBytes.Length - offset));
                    if (read == 0) break;
                    offset += read;
                }
                var body = Encoding.UTF8.GetString(bodyBytes, 0, offset);
                lock (_requestsLock) _requests.Add(new RequestSnapshot(pathAndQuery, body));

                var path = pathAndQuery.Split('?')[0];
                var contentType = "application/json";
                string responseBody;
                switch (path)
                {
                    case "/languages":
                        responseBody = "[{\"code\":\"zh-Hans\",\"name\":\"Chinese\",\"targets\":[\"en\"]},{\"code\":\"en\",\"name\":\"English\",\"targets\":[\"zh-Hans\"]},{\"code\":\"fr\",\"name\":\"French\",\"targets\":[\"en\"]}]";
                        break;
                    case "/translate":
                        responseBody = "{\"translatedText\":[\"Hello\",\"World\"],\"detectedLanguage\":[{\"language\":\"zh\",\"confidence\":99},{\"language\":\"zh\",\"confidence\":99}],\"alternatives\":[[\"Hi\"],[\"Earth\"]]}";
                        break;
                    case "/detect":
                        responseBody = "[{\"language\":\"fr\",\"confidence\":98}]";
                        break;
                    case "/translate_file":
                        responseBody = "{\"translatedFileUrl\":\"/files/translated.txt\"}";
                        break;
                    case "/files/translated.txt":
                        contentType = "text/plain";
                        responseBody = "translated file";
                        break;
                    case "/suggest":
                        responseBody = "{\"success\":true}";
                        break;
                    case "/health":
                        responseBody = "{\"status\":\"ok\"}";
                        break;
                    default:
                        await WriteResponseAsync(stream, 404, "application/json", "{\"error\":\"not found\"}");
                        return;
                }
                await WriteResponseAsync(stream, 200, contentType, responseBody);
            }
        }

        private static async Task WriteResponseAsync(NetworkStream stream, int status, string contentType, string body)
        {
            var bytes = Encoding.UTF8.GetBytes(body);
            var header = Encoding.ASCII.GetBytes(
                $"HTTP/1.1 {status} {(status == 200 ? "OK" : "Not Found")}\r\nContent-Type: {contentType}\r\nContent-Length: {bytes.Length}\r\nConnection: close\r\n\r\n");
            await stream.WriteAsync(header);
            await stream.WriteAsync(bytes);
        }

        public void Dispose()
        {
            _stop.Cancel();
            _listener.Stop();
            try { _loop.Wait(TimeSpan.FromSeconds(2)); } catch { }
            _stop.Dispose();
        }
    }

    public sealed record RequestSnapshot(string PathAndQuery, string Body);
}
