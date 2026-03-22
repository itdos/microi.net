# 🖥Windows Deployment

> **Deploying Microi Low Code Platform in Windows Server Environment**

---

## 📦Environmental Installation

### 1️⃣Installation. NET runtime environment

Download and install the **Hosting Bundle** and **ASP. NET Core Runtime 9.x x64**These 2 files:

::: tip download address
https://dotnet.microsoft.com/en-us/download/dotnet/9.0
:::
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380477367466977006970663.png#pic_center)

---

### two️⃣Download Web Deploy

- Download address: https://www.iis.net/downloads/microsoft/web-deploy
- Select [Typical Installation] when installing
- It is recommended to check whether the IIS module has`AspNetCoreModuleV2`Module
![安装 Web Deploy](https://static.itdos.com/upload/editor/image/202211/6380477378879752132167332.png#pic_center)

::: warning Service Check
Ensure that the following two services are in the [Running] state and the startup type is configured as [Automatic] (some Windows Server 2016 can be skipped). If a service startup error is encountered, it is recommended to restart the server operating system.
:::
![服务检查](https://static.itdos.com/upload/editor/image/202211/6380485239954922151314394.png#pic_center)

---

### three️⃣Install IIS

This step is the basic operation, can be Baidu search.

---

### four️⃣Install MySQL database

| Project | Explanation |
| :-- | :-- |
| Supported versions | MySQL 5.5 / 5.6 / 5.7 / 8.0 |
| Official 5.7 Download | https://dev.mysql.com/downloads/file/?id=514047 |
| Installation Type | Select **Server only** |
Screenshot of the installation steps (the interface of the installation package downloaded at different times may be slightly different):

![安装步骤1](https://static.itdos.com/upload/editor/image/202211/6380369903514717805320923.png#pic_center)

Click [Add] on the right]:

![安装步骤2](https://static.itdos.com/upload/editor/image/202211/6380369903553471386628081.png#pic_center)
![安装步骤3](https://static.itdos.com/upload/editor/image/202211/6380369903578114162396094.png#pic_center)
![安装步骤4](https://static.itdos.com/upload/editor/image/202211/6380369903608305376252952.png#pic_center)
![安装步骤5](https://static.itdos.com/upload/editor/image/202211/6380369903728321578376962.png#pic_center)
![安装步骤6](https://static.itdos.com/upload/editor/image/202211/6380369903727997722580803.png#pic_center)
![安装步骤7](https://static.itdos.com/upload/editor/image/202211/6380369903749410369636717.png#pic_center)
**Post-installation configuration:**

a) Release the MySQL port in the firewall

B) Allow MySQL remote connection:

```bash
# 进入 MySQL 命令行
mysql -uroot -p密码 -P端口
# 执行以下命令
use mysql;
update user set host='%' where user ='root';
FLUSH PRIVILEGES;
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
```

C) use Navicat to connect to MySQL, create a database (code using`utf8mb4`/`utf8mb4_general_ci`), restore database

---

### 5️⃣Install Redis Cache

| Project | Explanation |
| :-- | :-- |
| GitHub Download | https://github.com/microsoftarchive/redis/releases |
| iTdos mirror | https://static.itdos.com/soft/redis-x64-3.0.504.msi |
Screenshot of installation steps:

![安装 Redis 1](https://static.itdos.com/upload/editor/image/202211/6380377615195291607333151.png#pic_center)
![安装 Redis 2](https://static.itdos.com/upload/editor/image/202211/6380377615193259492630058.png#pic_center)

**Post-Installation Configuration:**

Edit the installation directory`redis.windows-service.conf`:

- **Allow remote connections**：Add 'bind 0.0.0.0 'below line 60'#bind 127.0.0.1'
- **Set Password**：About line 387 '# requirepass foobared' add' requirepass your password'
- Restart the Redis service, open the firewall port, and use the Redis connection tool to test

---

### six️⃣Install the MongoDB database

| Project | Explanation |
| :-- | :-- |
| Recommended version | 4.2.23(4.4.17 Win Server 2012 R2 not supported) |
| Official Download | https://www.mongodb.com/try/download/community |
| iTdos image | https://static.itdos.com/soft/mongodb-win32-x86_64-2012plus-4.2.23-signed.msi |
![安装 MongoDB 1](https://static.itdos.com/upload/editor/image/202211/6380377827464317905833519.png#pic_center)
![安装 MongoDB 2](https://static.itdos.com/upload/editor/image/202211/6380377818853432765738119.png#pic_center)

Select **Custom**:

![安装 MongoDB 3](https://static.itdos.com/upload/editor/image/202211/6380377818884792517096417.png#pic_center)
![安装 MongoDB 4](https://static.itdos.com/upload/editor/image/202211/6380377818904712359053021.png#pic_center)

Use the default **Run service as Network Service user**:

![安装 MongoDB 5](https://static.itdos.com/upload/editor/image/202211/6380377818932506997802046.png#pic_center)

Remove the check box for **Install MongoDB Compass**. Access after installation`localhost:27017`The following interface appears to indicate a successful installation:

![安装成功](https://static.itdos.com/upload/editor/image/202211/6380377916760887465029633.png#pic_center)
**Set account password:**

Enter the MongoDB installation directory`bin`directory to execute cmd:

```bash
mongo
use admin
db.createUser({user: 'root', pwd: '你的密码', roles: ['root']})
db.auth('root', '你的密码')  # 返回 1 表示正确
```

---

### seven️⃣Install MinIO Distributed Storage

Official website Download: https://min.io/download#/windows (on an exe program)
![下载 MinIO](https://static.itdos.com/upload/editor/image/202211/6380406928638277002335189.png#pic_center)

**Deployment steps:**

1. To put`minio.exe`into a directory, such`D:\Microi\Minio\minio.exe`
2. Download [WinSW-net461.exe](https://static.itdos.com/soft/WinSW-net461.exe), put it in the same directory and rename it`minio-server.exe`
3. Download the [minio-server.xml](https://static.itdos.com/soft/minio-server.xml) configuration file and put it in the same directory.
4. cmd entry`minio.exe`Directory, execute:

```bash
minio-server.exe install
minio-server.exe start
# 其它常用命令
minio-server.exe stop
sc delete minio-server.exe
```

::: tip MinIO Configuration Description
- `Sys_OsClients`in it`MinIOEndPoint`Need to be configured:`{IP}:9000`
- System Settings → Development Configuration`FileServer`Needs to be configured as:`http://{IP}:9000/itdos-public`
:::

5. Visit`localhost:9000`, the default account number is`minioadmin`
Create two buckets:`itdos-public`(the configuration permission is public),`itdos-private`

---

### eight️⃣Install the IIS environment

![服务器管理](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383125155877365101931668_origin.png/20230925/iis.png#pic_center)

1. Open the server management interface
2. Manage → Add Roles and Functions → Server Roles → Check **Web Server (IIS)** Check All (except FTP Server Module)
3. Default next step until installation succeeds

IIS management interface:

![打开 IIS](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383125179476379767066462_origin.png/20230925/打开iis.png#pic_center)
![管理界面](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383125180836250262781416_origin.png/20230925/IIS管理界面.png#pic_center)

---

## 🚀Program deployment

### 📥Download and unzip the 2-piece program.

---

### ⚙️ Deploy microi-api backend interface system

1. Open the root directory`appsettings.json`, modify`OsClient`、`OsClientType`、`OsClientNetwork`、`OsClientDbConn`four parameters
![配置文件](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383124995671143943939168_origin.png/20230925/auth.png#pic_center)

2. Run cmd or PowerShell in the same directory:

```bash
dotnet Microi.net.Auth.dll --urls=http://0.0.0.0:1051
```

::: warning License Problem
If you are prompted to License the problem, the HID will be output in the error message, and the HID will be provided to the system administrator to obtain the commercial authorization certificate, which will be overwritten in the directory at the same level and then run again.
:::

3. Access after deployment:`localhost:1051`
4. The service system can be used as a Windows service:

```bash
sc create microi-api binPath="C:\Microi\Microi.net.Auth\net10.0\Microi.net.Api.exe"
```

---

### 🌐Deployment microi-web front-end access system

1. Create a website directly in IIS and use any program pool without configuring environment variables.
2. Modify the root directory`/index.html`in it`OsClient`、`ApiBase`Variable value

::: warning Attention
the figure is for reference only. please fill in the real client name and api address.
:::
![在这里插入图片描述](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383124964739859058076187_origin.png/20230925/os-html.png#pic_center)
