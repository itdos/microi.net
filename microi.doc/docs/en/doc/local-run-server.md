# Source code running locally-backend

## Video Tutorial
> * To be re-recorded and uploaded
> * history video tutorial:[https://net.itdos.net:999/sharing/ZBN5cLPKa](https://net.itdos.net:999/sharing/ZBN5cLPKa)

## Download the source code and. NET environment
* Use git tool to pull the latest code from open source address:[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
* Download and install. NET 10 SDK:[https://dotnet.microsoft.com/zh-cn/download](https://dotnet.microsoft.com/zh-cn/download)

## Open the solution using Visual Studio Code (recommended for Mac)
* Download and install vs code:[https://code.visualstudio.com/](https://code.visualstudio.com/)
* Open vs code and install plugins: C#, C# Dev Kit,. NET Install Tool three components
* On the welcome page, open the open source version of Microi code [/Microi. Server] directory folder, wait a few seconds will automatically appear [solution explorer], wait for vs code to automatically restore nuget library
* The [/Microi.net.Api/appsettings.json] file must be configured
```json
  "AppSettings": {
    "OsClient": "iTdos",//【必须】自定义SaaS引擎Key，与数据库【sys_osclient】表的【OsClient】字段值对应
    "OsClientType": "Product",//【必须】自定义程序运行环境，如：Product（正式环境）、Dev（测试环境）等
    "OsClientNetwork": "Internet",//【必须】自定义网络类型，如：Internet（公网）、Internal（内网）等
    "OsClientDbType": "MySql",//默认MySql，可选SqlServer、Oracle
    //【必须】数据库连接字符串，建议使用源码提供的MySql。同时支持SqlServer、Oracle
    "OsClientDbConn": "Data Source=192.168.31.1;Database=microi_empty;User Id=roo;Password=password123456;Port=3306;Convert Zero Datetime=True;Allow Zero Datetime=True;Charset=utf8mb4;Max Pool Size=500;Min Pool Size=5;Connection Lifetime=300;Connection Timeout=30;Pooling=true;sslmode=None;",
    //SqlServer连接字符串示例：Server=192.168.31.1,1434;Database=microi_empty;User Id=sa;Password=password123456;
    //Oracle连接字符串示例：User Id=MICROI;Password=password123456;Data Source=192.168.31.1:1521/xe;
    //Tips：若【OsClient + OsClientType + OsClientNetwork】在【sys_osclient】表中能匹配到数据，且数据中有Redis相关配置，则可以省略以下Redis配置
    "OsClientRedisHost" : "",//Redis Host，如：119.31.116.88
    "OsClientRedisPort" : "",//Redis端口，如：6379
    "OsClientRedisPwd" : "",//Redis密码，如：123456
    "OsClientRedisDataBase" : ""//Redis库，如：0、5
    //其余配置分布式存储（如阿里云OSS、MinIO）、MQ消息队列、ES搜索引擎等，均在平台【SaaS引擎】中动态配置
  },
```
* __<font color = "red"> After pulling the source code, please update Microi.net.dll to the latest version first </font>__
* __<font color = "red"> If the automatic restoration of nuget fails or the project fails to be loaded, you can try to restart vs code to reload the project and wait for nuget to restore </font>__
* Right-click the [Microi.net.Api] project, debug --> start a new instance
* Access Address:`https://localhost:7266`(Ports are configured in/Microi.net.Api/Properties/launchSettings.json)

## Use Visual Studio 2022 to open the solution (Windows recommended)
* Download and install vs2022:[https://visualstudio.microsoft.com/zh-hans/](https://visualstudio.microsoft.com/zh-hans/)
* Double-click directly to open the [/Microi.net.sln] file, and wait a moment after opening it. Right-click the [Microi.net.Api] project to regenerate it.
* If the nuget package fails to be restored, please close vs2022 and reopen the Microi.net.sln file to continue trying. Generally, it is a network problem. You can also try to use the mobile phone hotspot.
* The [/Microi.net.Api/appsettings.json] file must be configured, as described above.

## Configure required parameters
* To make the project run, at least [database Redis] two environments are needed, one is indispensable.

## Environment Configuration Considerations
* Unable to use system log function without MongoDB environment
* If you do not have a distributed storage environment such as MinIO or Alibaba Cloud OSS, you cannot use the file/image upload function.
* Message Queuing cannot be used without a RabbitMQ environment
* Search engine functionality is not available without an ES environment

