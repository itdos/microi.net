# 💻 源码本地运行 - 后端

> **在本地环境中运行 Microi吾码后端服务**

---

## 🎥 视频教程

- 待重新录制上传
- 历史视频教程：[https://net.itdos.net:999/sharing/ZBN5cLPKa](https://net.itdos.net:999/sharing/ZBN5cLPKa)

---

## 📦 下载源码与 .NET 环境

- 使用 Git 从开源地址拉取最新代码：[Gitee 仓库](https://gitee.com/ITdos/microi.net)
- 下载并安装 .NET 10 SDK：[.NET 下载页](https://dotnet.microsoft.com/zh-cn/download)

---

## 🛠️ 使用 VS Code 打开解决方案（Mac 推荐）

1. 下载并安装 [VS Code](https://code.visualstudio.com/)
2. 安装插件：**C#**、**C# Dev Kit**、**.NET Install Tool**
3. 打开 `/Microi.Server` 目录，稍等几秒会自动出现【解决方案资源管理器】，等待自动还原 NuGet 库
4. **必须**配置 `/Microi.net.Api/appsettings.json` 文件
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
::: warning 注意事项
- 拉取源码后，请**优先将 `Microi.net.dll` 更新至最新版本**
- 若 NuGet 自动还原失败 / 加载项目失败导致编译失败，可尝试重启 VS Code 重新加载项目等待 NuGet 还原
:::

5. 右键 `Microi.net.Api` 项目 → 调试 → 启动新实例
6. 访问地址：`https://localhost:7266`（端口在 `/Microi.net.Api/Properties/launchSettings.json` 配置）

---

## 🖥️ 使用 Visual Studio 2022 打开解决方案（Windows 推荐）

1. 下载并安装 [Visual Studio 2022](https://visualstudio.microsoft.com/zh-hans/)
2. 双击打开 `/Microi.net.sln`，稍等片刻右键 `Microi.net.Api` 项目 → 重新生成
3. 若还原 NuGet 包失败，关闭 VS2022 并重新打开 `Microi.net.sln`（一般是网络问题，可尝试手机热点）
4. **必须**配置 `/Microi.net.Api/appsettings.json`，说明同上

---

## ⚙️ 配置必须参数

::: tip 最低要求
要使项目跑起来，至少需要 **数据库 + Redis** 两个环境，缺一不可。
:::

---

## 📝 环境配置注意事项

| 环境 | 影响功能 |
| :-- | :-- |
| 无 MongoDB | 无法使用系统日志 |
| 无 MinIO / 阿里云 OSS | 无法使用文件/图片上传 |
| 无 RabbitMQ | 无法使用消息队列 |
| 无 Elasticsearch | 无法使用搜索引擎 |

---

## 🐳 本地编译发布到 Docker 镜像

1. 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. 在 `Microi.net.Api` 项目目录下执行：

```bash
dotnet clean && dotnet publish -c Release -o ./bin/Release/publish
```

3. 进入 `./bin/Release/` 目录，执行 `publish-demo.sh` 脚本（记得先修改里面的配置）