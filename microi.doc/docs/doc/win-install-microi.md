# 🖥️ Windows 部署

> **在 Windows Server 环境下部署 Microi吾码低代码平台**

---

## 📦 环境安装

### 1️⃣ 安装 .NET 运行环境

下载并安装 **Hosting Bundle** 和 **ASP.NET Core Runtime 9.x x64** 这 2 个文件：

::: tip 下载地址
https://dotnet.microsoft.com/en-us/download/dotnet/9.0
:::
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380477367466977006970663.png#pic_center)

---

### 2️⃣ 下载 Web Deploy

- 下载地址：https://www.iis.net/downloads/microsoft/web-deploy
- 安装时选择【典型安装】即可
- 建议安装后检查 IIS 模块中是否已有 `AspNetCoreModuleV2` 模块
![安装 Web Deploy](https://static.itdos.com/upload/editor/image/202211/6380477378879752132167332.png#pic_center)

::: warning 服务检查
保证以下 2 个服务是【正在运行】状态，并且启动类型配置为【自动】（部分 Windows Server 2016 可跳过）。若遇到服务启动报错，建议重启服务器操作系统。
:::
![服务检查](https://static.itdos.com/upload/editor/image/202211/6380485239954922151314394.png#pic_center)

---

### 3️⃣ 安装 IIS

此步骤为基操，可百度搜索。

---

### 4️⃣ 安装 MySQL 数据库

| 项目 | 说明 |
| :-- | :-- |
| 支持版本 | MySQL 5.5 / 5.6 / 5.7 / 8.0 |
| 官方 5.7 下载 | https://dev.mysql.com/downloads/file/?id=514047 |
| 安装类型 | 选择 **Server only** |
安装步骤截图（不同时间下载的安装包可能界面略有差异）：

![安装步骤1](https://static.itdos.com/upload/editor/image/202211/6380369903514717805320923.png#pic_center)

点击右侧【Add】：

![安装步骤2](https://static.itdos.com/upload/editor/image/202211/6380369903553471386628081.png#pic_center)
![安装步骤3](https://static.itdos.com/upload/editor/image/202211/6380369903578114162396094.png#pic_center)
![安装步骤4](https://static.itdos.com/upload/editor/image/202211/6380369903608305376252952.png#pic_center)
![安装步骤5](https://static.itdos.com/upload/editor/image/202211/6380369903728321578376962.png#pic_center)
![安装步骤6](https://static.itdos.com/upload/editor/image/202211/6380369903727997722580803.png#pic_center)
![安装步骤7](https://static.itdos.com/upload/editor/image/202211/6380369903749410369636717.png#pic_center)
**安装后配置：**

a）在防火墙中放行 MySQL 端口

b）允许 MySQL 远程连接：

```bash
# 进入 MySQL 命令行
mysql -uroot -p密码 -P端口
# 执行以下命令
use mysql;
update user set host='%' where user ='root';
FLUSH PRIVILEGES;
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
```

c）使用 Navicat 连接 MySQL、创建数据库（编码使用 `utf8mb4` / `utf8mb4_general_ci`）、还原数据库

---

### 5️⃣ 安装 Redis 缓存

| 项目 | 说明 |
| :-- | :-- |
| GitHub 下载 | https://github.com/microsoftarchive/redis/releases |
| iTdos 镜像 | https://static.itdos.com/soft/redis-x64-3.0.504.msi |
安装步骤截图：

![安装 Redis 1](https://static.itdos.com/upload/editor/image/202211/6380377615195291607333151.png#pic_center)
![安装 Redis 2](https://static.itdos.com/upload/editor/image/202211/6380377615193259492630058.png#pic_center)

**安装后配置：**

编辑安装目录下的 `redis.windows-service.conf`：

- **允许远程连接**：约第 60 行 `#bind 127.0.0.1` 下方添加 `bind 0.0.0.0`
- **设置密码**：约第 387 行 `# requirepass foobared` 下方添加 `requirepass 你的密码`
- 重启 Redis 服务，防火墙开放端口，使用 Redis 连接工具测试

---

### 6️⃣ 安装 MongoDB 数据库

| 项目 | 说明 |
| :-- | :-- |
| 推荐版本 | 4.2.23（4.4.17 不支持 Win Server 2012 R2） |
| 官方下载 | https://www.mongodb.com/try/download/community |
| iTdos 镜像 | https://static.itdos.com/soft/mongodb-win32-x86_64-2012plus-4.2.23-signed.msi |
![安装 MongoDB 1](https://static.itdos.com/upload/editor/image/202211/6380377827464317905833519.png#pic_center)
![安装 MongoDB 2](https://static.itdos.com/upload/editor/image/202211/6380377818853432765738119.png#pic_center)

选择 **Custom**：

![安装 MongoDB 3](https://static.itdos.com/upload/editor/image/202211/6380377818884792517096417.png#pic_center)
![安装 MongoDB 4](https://static.itdos.com/upload/editor/image/202211/6380377818904712359053021.png#pic_center)

使用默认的 **Run service as Network Service user**：

![安装 MongoDB 5](https://static.itdos.com/upload/editor/image/202211/6380377818932506997802046.png#pic_center)

去掉 **Install MongoDB Compass** 的勾选。安装完成后访问 `localhost:27017` 出现以下界面表示安装成功：

![安装成功](https://static.itdos.com/upload/editor/image/202211/6380377916760887465029633.png#pic_center)
**设置账号密码：**

进入 MongoDB 安装目录的 `bin` 目录执行 cmd：

```bash
mongo
use admin
db.createUser({user: 'root', pwd: '你的密码', roles: ['root']})
db.auth('root', '你的密码')  # 返回 1 表示正确
```

---

### 7️⃣ 安装 MinIO 分布式存储

官网下载：https://min.io/download#/windows（就一个 exe 程序）
![下载 MinIO](https://static.itdos.com/upload/editor/image/202211/6380406928638277002335189.png#pic_center)

**部署步骤：**

1. 将 `minio.exe` 放到某个目录，如 `D:\Microi\Minio\minio.exe`
2. 下载 [WinSW-net461.exe](https://static.itdos.com/soft/WinSW-net461.exe)，放到同目录并重命名为 `minio-server.exe`
3. 下载 [minio-server.xml](https://static.itdos.com/soft/minio-server.xml) 配置文件，放到同目录
4. cmd 进入 `minio.exe` 所在目录，执行：

```bash
minio-server.exe install
minio-server.exe start
# 其它常用命令
minio-server.exe stop
sc delete minio-server.exe
```

::: tip MinIO 配置说明
- `Sys_OsClients` 中的 `MinIOEndPoint` 需配置为：`{IP}:9000`
- 系统设置 → 开发配置中的 `FileServer` 需配置为：`http://{IP}:9000/itdos-public`
:::

5. 访问 `localhost:9000`，默认账号均为 `minioadmin`
6. 创建 2 个 Bucket：`itdos-public`（配置权限为 public）、`itdos-private`

---

### 8️⃣ 安装 IIS 环境

![服务器管理](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383125155877365101931668_origin.png/20230925/iis.png#pic_center)

1. 打开服务器管理界面
2. 管理 → 添加角色和功能 → 服务器角色 → 勾选 **Web 服务器（IIS）**全部勾选（FTP 服务器模块除外）
3. 默认下一步直到安装成功

IIS 管理界面：

![打开 IIS](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383125179476379767066462_origin.png/20230925/打开iis.png#pic_center)
![管理界面](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383125180836250262781416_origin.png/20230925/IIS管理界面.png#pic_center)

---

## 🚀 程序部署

### 📥 下载并解压程序 2 件套

---

### ⚙️ 部署 microi-api 后端接口系统

1. 打开根目录下的 `appsettings.json`，修改 `OsClient`、`OsClientType`、`OsClientNetwork`、`OsClientDbConn` 四个参数
![配置文件](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383124995671143943939168_origin.png/20230925/auth.png#pic_center)

2. 在同级目录下运行 cmd 或 PowerShell：

```bash
dotnet Microi.net.Auth.dll --urls=http://0.0.0.0:1051
```

::: warning License 问题
若提示 License 问题，报错信息中会输出 HID，将 HID 提供给系统管理员获取商业授权证书，放到同级目录下覆盖后再次运行。
:::

3. 部署完成后访问：`localhost:1051`
4. 可将服务制作为 Windows 服务：

```bash
sc create microi-api binPath="C:\Microi\Microi.net.Auth\net10.0\Microi.net.Api.exe"
```

---

### 🌐 部署 microi-web 前端访问系统

1. 在 IIS 中直接创建网站，使用任意程序池，无需配置环境变量
2. 修改根目录 `/index.html` 中的 `OsClient`、`ApiBase` 变量值

::: warning 注意
图中仅为参考，请按真实的 client 名字和 api 地址填写。
:::
![在这里插入图片描述](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383124964739859058076187_origin.png/20230925/os-html.png#pic_center)
