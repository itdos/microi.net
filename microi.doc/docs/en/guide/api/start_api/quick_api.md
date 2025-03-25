# Quick to get started
This tutorial will get you up and running quickly with your back-end project.

## Preparations

-Use the 'Git' tool to pull the latest code from an open source address [microi.net](https://gitee.com/ITdos/microi.net).
-Download and install '. NET 9 SDK' :[.NET 9 SDK](https://dotnet.microsoft.com/zh-cn/download)
-To make the project run, at least [database 'Redis'] two environments are needed, one is indispensable

## Using Visual Studio Code to open a solution (recommend)

-Download and install 'Vs Code':[Vs Code](https://code.visualstudio.com)
-Open 'Vs Code' and install plugins: 'C#, C# Dev Kit,. NET Install Tool' three components
-Open the' Microi' code open source version root directory folder on the welcome page, wait a few seconds and then [Solution Explorer] will automatically appear, waiting for the' Vs Code' to automatically restore the' Nuget' library
-The '/Microi.net.Api/appsettings.json' file must be configured

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

-right [Microi.net.Api] project, debug --> start a new instance
-Access address: 'https:// localhost:7266 '(port configured in/Microi.net.Api/Properties/launchSettings.json)
 
## Open the solution using Visual Studio 2022
-Download and install 'vs2022' :[vs2022](https://visualstudio.microsoft.com/zh-hans)
-Double-click directly to open'/Microi.net.sln' file, wait a moment after opening and right' Microi.net.Api' project to regenerate
-If restoring the' nuget' package fails, please close' vs2022' and reopen' Microi.net.sln' file to continue trying. Generally, it is a network problem, or you can try to use the hot spot of your mobile phone.
-The '/Microi.net.Api/appsettings.json' file must be configured, as described above

## Environment Configuration Considerations
-System log function is not available without 'MongoDB' environment
-If you do not have a distributed storage environment such as 'MinIO' or Alibaba Cloud 'OSS', you cannot use the file/image upload function.
-If there is no 'RabbitMQ' environment, the message queue function cannot be used
-If there is no 'ES' environment, the search engine function cannot be used