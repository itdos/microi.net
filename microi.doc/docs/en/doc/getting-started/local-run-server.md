# 💻Source code running locally-backend

> **Run the Microi back-end service in the local environment.**

---

## 🎥Video tutorial

- To be re-recorded and uploaded
- Historical video tutorial: [https://net.itdos.net:999/sharing/ZBN5cLPKa](https://net.itdos.net:999/sharing/ZBN5cLPKa)

---

## 📦Download the source code and. NET environment

- Use Git to pull the latest code from an open source address:[Gitee repository](https://gitee.com/ITdos/microi.net)
- Download and install. NET 10 SDK:[.NET Download Page](https://dotnet.microsoft.com/zh-cn/download)

---

## 🛠️ Open solution with VS Code (Mac recommended)

1. Download and install [VS Code](https://code.visualstudio.com/)
2. Install the plug-ins:**C# Dev Kit**
3. Open`/Microi.Server`Directory, wait a few seconds and [Solution Explorer] will automatically appear, waiting for the NuGet library to be automatically restored.
4. **Must** be configured`/Microi.net.Api/appsettings.json`File
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
::: warning Notes
- After pulling the source code, please **give priority'Microi.net.dll'Update to latest version**
- If the compilation fails due to the failure of NuGet automatic restore or the failure of loading the project, you can try to restart VS Code to reload the project and wait for NuGet to restore it.
:::

5. Right-click`Microi.net.Api`Project → Debug → Start a new instance
6. Access Address:`https://localhost:7266`(port in`/Microi.net.Api/Properties/launchSettings.json`configuration)

---

## 🖥️ Open a solution with Visual Studio 2022 (Windows recommended)

1. Download and install [Visual Studio 2022](https://visualstudio.microsoft.com/zh-hans/)
2. Double-click to open`/Microi.net.sln`, wait a moment, right click`Microi.net.Api`Project → Regenerate
3. If restoring the NuGet package fails, close VS2022 and reopen it`Microi.net.sln`(Generally, it is a network problem. You can try hot spots on your mobile phone.)
4. **Must** be configured`/Microi.net.Api/appsettings.json`, ibid.

---

## ⚙Configuration required parameters

::: tip minimum requirements
To make the project run, at least two environments of **database Redis** are required, one of which is indispensable.
:::

---

## 📝Environment Configuration Notes

| Environment | Affect function |
| :-- | :-- |
| No MongoDB | Unable to use system log |
| No MinIO/Alibaba Cloud OSS | Unable to upload using file/image |
| No RabbitMQ | Unable to use message queue |
| No Elasticsearch | Unable to use search engine |

---

## 🐳Locally compile and publish to a Docker image

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. In`Microi.net.Api`Execute under the project directory:

```bash
dotnet clean && dotnet publish -c Release -o ./bin/Release/publish
```

3. Enter`./bin/Release/`Table of Contents, Execute`publish-demo.sh`Script (remember to modify the configuration inside first)