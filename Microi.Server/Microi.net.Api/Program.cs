using Microi.net;
using Microi.net.Api;

MicroiApiHostExtensions.InitializeMicroiProcess();

var builder = WebApplication.CreateBuilder(args);
var host = builder.PrepareMicroiApiHost();
if (host == null) return;

// 平台内核与可选插件。Program 只声明宿主需要哪些插件；各插件自行拥有注册、
// HostedService、升级和运行时初始化逻辑。
var services = builder.Services;
services.AddMicroi();
services.AddMicroiORM();
services.AddMicroiCache();
services.AddMicroiHttp();
services.AddMicroiMongoDB();
services.AddMicroiUpgrade();
services.AddMicroiWeChat(builder.Configuration);
services.AddMicroiOffice();
services.AddMicroiSpider();
services.AddMicroiOCR();
services.AddMicroiMQ();
services.AddMicroiSearchEngine();
services.AddMicroiAI();
services.AddMicroiMQTT();
services.AddMicroiHDFS();
services.AddMicroiCaptcha();
services.AddMicroiJob(host.DatabaseConnection);
services.AddMicroiApiTransport(builder, host.RedisConnection, host.ServerVersion);

Console.WriteLine("Microi：【成功】Microi所有初始化成功！");
await builder.RunMicroiApiAsync(host);
