# Quick to get started
This tutorial will get you up and running quickly with your back-end project.

## Preparations

- Use`Git`The tool pulls the latest code from an open source address [microi.net](https://gitee.com/ITdos/microi.net).
- Download and install`.NET 9 SDK`:[.NET 9 SDK](https://dotnet.microsoft.com/zh-cn/download)
- To make the project run, at least [database`Redis`] Two environments, one is indispensable

## Using Visual Studio Code to open a solution (recommend)

- Download and install`Vs Code`:[Vs Code](https://code.visualstudio.com)
- Open`Vs Code`, install the plugin:`C#、C# Dev Kit、.NET Install Tool`Three components
- Open on welcome page`Microi`I code the open source version of the root directory folder, wait a few seconds will automatically appear [Solution Explorer], wait`Vs Code`Automatic Restore`Nuget`Library
- Must be configured`/Microi.net.Api/appsettings.json`File

```csharp
  "AppSettings": {
    "OsClient": "iTdos",//【必须】自定义SaaS引擎Key，与数据库【sys_osclient】表的【OsClient】字段值对应
    "OsClientType": "Product",//【必须】自定义程序运行环境，如：Product（正式环境）、Dev（测试环境）等
    "OsClientNetwork": "Internet",//【必须】自定义网络类型，如：Internet（公网）、Internal（内网）等
    "OsClientDbConn": "",//【必须】数据库连接字符串，建议使用源码提供的MySql。SqlServer、Oracle也支持，后期整理后提供数据库demo
    "IS4SigningCredential": "",//【必须】可以直接使用源码中的默认签名
    //Tips：若【OsClient + OsClientType + OsClientNetwork】在【sys_osclient】表中能匹配到数据，且数据中有Redis相关配置，则可以省略以下Redis配置
    "OsClientRedisHost" : "",//Redis Host，如：119.31.116.88
    "OsClientRedisPort" : "",//Redis端口，如：6379
    "OsClientRedisPwd" : ""//Redis密码，如：123456
    //其余配置分布式存储（如阿里云OSS、MinIO）、MQ消息队列、ES搜索引擎等，均在平台【SaaS引擎】中动态配置
  },

```

- Right-click the [Microi.net.Api] project, debug --> start a new instance
- Access Address:`https://localhost:7266`(Ports are configured in/Microi.net.Api/Properties/launchSettings.json)
 
## Open the solution using Visual Studio 2022
- Download and install`vs2022`:[vs2022](https://visualstudio.microsoft.com/zh-hans)
- Double-click directly to open`/Microi.net.sln`File, wait a moment after opening, right-click`Microi.net.Api`Project Rebuild
- If restore`nuget`Package failed, please close`vs2022`and reopen`Microi.net.sln`The file continues to try, usually network problems, or try to use mobile phone hotspots.
- Must be configured`/Microi.net.Api/appsettings.json`Document, note ibid.

## Environment Configuration Considerations
- If not`MongoDB`environment, you cannot use the system log feature
- If not`MinIO`Alibaba Cloud`OSS`In a distributed storage environment such as the file/image upload function, the file/image upload function cannot be used.
- If not`RabbitMQ`environment, you cannot use the Message Queuing feature
- If not`ES`environment, you cannot use the search engine feature