# 快速上手
本教程会让您快速将后端项目运行起来。

## 准备工作

- 使用 `Git` 工具从开源地址拉取最新代码 [microi.net](https://gitee.com/ITdos/microi.net)。
- 下载并安装 `.NET 9 SDK` ：[.NET 9 SDK](https://dotnet.microsoft.com/zh-cn/download)
- 要使项目跑起来，至少需要【数据库 + `Redis`】两个环境，缺一不可

## 使用【Visual Studio Code】打开解决方案（推荐）

- 下载并安装 `Vs Code`：[Vs Code](https://code.visualstudio.com)
- 打开 `Vs Code`，安装插件：`C#、C# Dev Kit、.NET Install Tool`三个组件
- 在欢迎页打开 `Microi` 吾码开源版根目录文件夹，稍等几秒后会自动出现【解决方案资源管理器】，等待 `Vs Code` 自动还原 `Nuget` 库
- 必须配置 `/Microi.net.Api/appsettings.json` 文件

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

- 右键【Microi.net.Api】项目，调试 --> 启动新实例
- 访问地址：`https://localhost:7266`（端口在/Microi.net.Api/Properties/launchSettings.json配置）
 
## 使用【Visual Studio 2022】打开解决方案
- 下载并安装 `vs2022` ：[vs2022](https://visualstudio.microsoft.com/zh-hans)
- 直接双击打开 `/Microi.net.sln` 文件，打开后稍等片刻右键 `Microi.net.Api` 项目重新生成
- 若还原 `nuget` 包失败，请关闭 `vs2022` 并重新打开 `Microi.net.sln` 文件继续尝试，一般都是网络问题，也可尝试使用手机热点
- 必须配置 `/Microi.net.Api/appsettings.json`文件，说明同上

## 环境配置注意事项
- 若没有 `MongoDB` 环境，则无法使用系统日志功能
- 若没有 `MinIO`、阿里云 `OSS` 等分布式存储环境，则无法使用文件/图片上传功能
- 若没有 `RabbitMQ` 环境，则无法使用消息队列功能
- 若没有 `ES` 环境，则无法使用搜索引擎功能