# 源码本地运行-后端

## 下载源码与.NET环境
* 使用git工具从开源地址拉取最新代码：[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
* 下载并安装.NET 9 SDK：[https://dotnet.microsoft.com/zh-cn/download](https://dotnet.microsoft.com/zh-cn/download)

## 使用【Visual Studio Code】打开解决方案（Mac推荐）
* 下载并安装vs code：[https://code.visualstudio.com/](https://code.visualstudio.com/)
* 打开vs code，安装插件：C#、C# Dev Kit、.NET Install Tool三个组件
* 在欢迎页打开Microi吾码开源版【/Microi.Server】目录文件夹，稍等几秒后会自动出现【解决方案资源管理器】，等待vs code自动还原nuget库
* 必须配置【/Microi.net.Api/appsettings.json】文件
```json
  "AppSettings": {
    "OsClient": "iTdos",//【必须】自定义SaaS引擎Key，与数据库【sys_osclient】表的【OsClient】字段值对应
    "OsClientType": "Product",//【必须】自定义程序运行环境，如：Product（正式环境）、Dev（测试环境）等
    "OsClientNetwork": "Internet",//【必须】自定义网络类型，如：Internet（公网）、Internal（内网）等
    "OsClientDbType": "MySql",//默认MySql，可选SqlServer、Oracle
    "OsClientDbConn": "",//【必须】数据库连接字符串，建议使用源码提供的MySql。SqlServer、Oracle也支持，后期整理后提供数据库demo
    //Tips：若【OsClient + OsClientType + OsClientNetwork】在【sys_osclient】表中能匹配到数据，且数据中有Redis相关配置，则可以省略以下Redis配置
    "OsClientRedisHost" : "",//Redis Host，如：119.31.116.88
    "OsClientRedisPort" : "",//Redis端口，如：6379
    "OsClientRedisPwd" : "",//Redis密码，如：123456
    "OsClientRedisDataBase" : ""//Redis库，如：0、5
    //其余配置分布式存储（如阿里云OSS、MinIO）、MQ消息队列、ES搜索引擎等，均在平台【SaaS引擎】中动态配置
  },
```
* __<font color="red">拉取源码后，请优先将Microi.net.dll更新至最新版本</font>__
* __<font color="red">若nuget自动还原失败、加载项目失败导致编译失败，可尝试重启vs code重新加载项目等待nuget还原</font>__
* 右键【Microi.net.Api】项目，调试 --> 启动新实例
* 访问地址：`https://localhost:7266`（端口在/Microi.net.Api/Properties/launchSettings.json配置）

## 使用【Visual Studio 2022】打开解决方案（Windows推荐）
* 下载并安装vs2022：[https://visualstudio.microsoft.com/zh-hans/](https://visualstudio.microsoft.com/zh-hans/)
* 直接双击打开【/Microi.net.sln】文件，打开后稍等片刻右键【Microi.net.Api】项目重新生成
* 若还原nuget包失败，请关闭vs2022并重新打开Microi.net.sln文件继续尝试，一般都是网络问题，也可尝试使用手机热点
* 必须配置【/Microi.net.Api/appsettings.json】文件，说明同上

## 配置必须参数
* 要使项目跑起来，至少需要【数据库 + Redis】两个环境，缺一不可

## 环境配置注意事项
* 若没有MongoDB环境，则无法使用系统日志功能
* 若没有MinIO、阿里云OSS等分布式存储环境，则无法使用文件/图片上传功能
* 若没有RabbitMQ环境，则无法使用消息队列功能
* 若没有ES环境，则无法使用搜索引擎功能

