using Microi.net;
using Microi.net.Api;

// 初始化进程级安全边界、统一日志和未处理异常监听。
MicroiApiHostExtensions.InitializeMicroiProcess();

var builder = WebApplication.CreateBuilder(args);
// 启动前读取并验证宿主、租户、数据库、Redis 与版本信息；失败时不继续构建半初始化应用。
var host = builder.PrepareMicroiApiHost();
if (host == null) return;

// Program 只声明宿主需要哪些插件；注册细节、HostedService、升级和运行时初始化由各插件自行拥有。
var services = builder.Services;
// 注册 Microi 平台内核、表单引擎、接口引擎、V8 引擎及通用运行时。
services.AddMicroi();
// 注册独立工作流引擎插件；实现与发布物由 Microi.WorkFlow 类库拥有。
services.AddMicroiWorkFlow();
// 注册独立 SSO 身份联邦插件；公开协议路由仍由官方接口引擎承接。
services.AddMicroiSSO();
// 注册 Dos.ORM 数据访问插件。
services.AddMicroiORM();
// 注册 Redis 分布式缓存插件。
services.AddMicroiCache();
// 注册服务端 HTTP 集成插件。
services.AddMicroiHttp();
// 注册 MongoDB 数据访问插件。
services.AddMicroiMongoDB();
// 注册服务器端自动升级插件；升级执行逻辑不进入 Program。
services.AddMicroiUpgrade();
// 注册微信公众号平台插件。
services.AddMicroiWeChat(builder.Configuration);
// 注册 Office 文档处理插件。
services.AddMicroiOffice();
// 注册采集引擎插件。
services.AddMicroiSpider();
// 注册 OCR 识别插件。
services.AddMicroiOCR();
// 注册通用视觉特征、ONNX 模型与实时帧流识别插件；业务编排仍由接口引擎负责。
services.AddMicroiVision();
// 注册 MQ 消息队列插件。
services.AddMicroiMQ();
// 注册全文搜索引擎插件。
services.AddMicroiSearchEngine();
// 注册 AI 引擎插件。
services.AddMicroiAI();
// 注册 MQTT 实时消息插件。
services.AddMicroiMQTT();
// 注册 HDFS 分布式文件存储插件。
services.AddMicroiHDFS();
// 注册验证码插件。
services.AddMicroiCaptcha();
// 注册分布式任务调度插件，并复用宿主已验证的数据库类型与连接。
services.AddMicroiJob(host.DatabaseConnection, host.DatabaseTypeName);
// 注册 API 宿主传输层、MVC、鉴权、实时通信、压缩与 Swagger。
services.AddMicroiApiTransport(builder, host.RedisConnection, host.ServerVersion);

Console.WriteLine("Microi：【成功】Microi所有初始化成功！");
await builder.RunMicroiApiAsync(host);
