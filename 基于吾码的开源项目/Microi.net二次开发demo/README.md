# 开源低代码平台-Microi吾码-老项目二次开发说明
>* 此项目为demo项目，用于说明老项目如何使用microi.net进行二次开发

## 1、创建一个空的.net core项目

## 2、从Nuget中引用Microi.net

## 3、在appsettings.json中添加AppSettings必要配置信息（数据库+redis）
```json
"AppSettings": {
    "OsClient": "iTdos",
    "OsClientType": "Product",
    "OsClientNetwork": "Internet",
    "OsClientDbConn": "Data Source=59.110.139.96;Database=microi_empty;User Id=microi_empty;Password=Cp55YZyb4AAEkrAS;Port=3307;Convert Zero Datetime=true;Allow Zero Datetime=true;Charset=utf8mb4;Max Pool Size=500;sslmode=None;",
    "IS4SigningCredential": "jwt#SecurityKey.Microi.net#jwt..",
    "OsClientRedisHost" : "59.110.139.96",
    "OsClientRedisPort" : "1222",
    "OsClientRedisPwd" : "redis#demo",
    "OsClientRedisDataBase":"5",
    "DebuggerFolder": "/bin/debug/net9.0/"
}
```

## 4、在Startup.cs中注册Microi.net
```csharp
//------- Microi.net初始化 START ---------
Console.WriteLine("Microi：开始初始化！" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
Stopwatch timer = new Stopwatch();//计时器
timer.Start();
services.AddMicroi();
//------- Microi.net初始化 END ---------

//在app.Run();之上执行
Console.WriteLine($"Microi：初始化成功！{DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")}。耗时：{timer.ElapsedMilliseconds}ms");
timer.Stop();
```

## 5、在HomeController中测试调用Microi.net相关功能
```csharp
private readonly FormEngine _formEngine = new FormEngine();
private readonly IV8Engine _v8Engine = new V8Engine();
private readonly ApiEngine _apiEngine = new ApiEngine();
public IActionResult Index()
{
    //测试FormEngine
    var getSysUserResult = _formEngine.GetFormData("sys_user", new {
        _Where = new List<DiyWhere>() {
            new DiyWhere(){
                Name = "Account",
                Value = "admin",
                Type = "="
            }
        },
        OsClient = "iTdos"
    });

    ViewBag.SysUserResult = JsonConvert.SerializeObject(getSysUserResult);
    //测试V8Engine
    var v8EngineResult = _v8Engine.Run(new V8EngineParam() 
    {
        V8Code = "return 1 + 1;",
        OsClient = "iTdos"
    });
    ViewBag.V8EngineResult = v8EngineResult.Result;

    //测试ApiEngine
    var apiEngineResult = _apiEngine.Run("microi-init", new {
        OsClient = "iTdos"
    });//下个版本可以不必传第二个参数
    ViewBag.ApiEngineResult = JsonConvert.SerializeObject(apiEngineResult);
    return View();
}
```

## 测试结果
>* 经博主测试，Microi.net功能已经全部可用。

## 注意事项：
>* 之所以此项目额外引用了Microi.model、Microi.Cache、StackExchange.Redis，是因为Microi.net还未更新到最新版
>* 当下个版本Microi.net发布后，此项目可不再额外手动引用Microi.model、Microi.Cache等