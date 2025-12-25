# Windows部署

## 环境安装

### 安装.NET运行环境
>* 下载并安装Hosting Bundle、ASP.NET Core Runtime 9.x x64版本这2个文件，如图
>* https://dotnet.microsoft.com/en-us/download/dotnet/9.0
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380477367466977006970663.png#pic_center)

### 下载Web Deploy
>* https://www.iis.net/downloads/microsoft/web-deploy
>* 建议安装完后检查下iis模块中是否有AspNetCoreModuleV2的模块
>* 安装时选择典型安装即可
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380477378879752132167332.png#pic_center)
>* 保证以下2个服务是[正在运行]中，并且启动类型配置为[自动]（有些windows server2016系统不需要检查这一步）
>* 注意：可能会遇到服务启动报错等其它问题，建议此时重启一下服务器操作系统。
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380485239954922151314394.png#pic_center)

### 安装IIS
>* 此步骤为基操，可百度。

### 安装MySql数据库
>* 支持MySql5.5、5.6、5.7、8.0
>* 官方5.7下载地址：https://dev.mysql.com/downloads/file/?id=514047
>* 点击页面中的【No thanks, just start my download.】文字链接进行下载

>* 安装开始时若提示Upgrage，点击【No】
>* 安装时提示Chooseing a Setup Type，选择【Server only】

>* 安装步骤截图（不同时间下载的安装包可能界面会不太一样，但大致相同）：
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380369903514717805320923.png#pic_center)
>* 点击右侧【Add】
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380369903553471386628081.png#pic_center)
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380369903578114162396094.png#pic_center)
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380369903608305376252952.png#pic_center)
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380369903728321578376962.png#pic_center)
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380369903727997722580803.png#pic_center)
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380369903749410369636717.png#pic_center)
>* a）安装完成后，需要将端口号在防火墙放行。
>* b）允许mysql远程连接：
```json
进入C:\Windows\System32\cmd.exe或C:\Program Files\MySQL\MySQL Server 5.7\bin安装目录，执行cmd命令：
#mysql -uroot -p密码 -P端口  （如：mysql -uroot -pmysql5.7.itdos -P3309）
#use mysql;
#update user set host='%' where user ='root';
#FLUSH PRIVILEGES;
#GRANT ALL PRIVILEGES ON *.* TO 'root'@'%'WITH GRANT OPTION;
以上均为mysql常用命令，此时需要在服务器防火墙开放mysql端口，如果是阿里云还需要配置安全组开放端口。
```
>* c）在本地使用Navicat连接mysql、创建数据库（注意数据库编码使用utf8mb4、utf8mb4_general_ci）、还原https://os.cyguzi.com上面的数据库（建议使用Navicat连接外网上的库，然后备份下来再还原，也可从宝塔中下载数据库备份）。Navicat破解版：https://static.itdos.com/soft/Navicat-Premium-15.zip

### 安装Redis缓存
>* 下载redis msi安装包：https://github.com/microsoftarchive/redis/releases
>* Github偶尔很慢，iTdos链接：https://static.itdos.com/soft/redis-x64-3.0.504.msi
>* 安装步骤比较简单：
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380377615195291607333151.png#pic_center)
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380377615193259492630058.png#pic_center)
>* 安装完成后可以看到服务中Redis服务正在运行。
>* 编辑安装目录此文件：D:\Program Files\Redis\redis.windows-service.conf
>* a）允许远程连接：大概第60行左右#bind 127.0.0.1 下面添加一行：bind 0.0.0.0
>* b）设置密码：大概第387行左右# requirepass foobared 下面添加一行：requirepass redis.itdos（redis.itdos为密码，可自定义）
>* c）重启Redis服务，防火墙需要开放端口，使用redis连接工具测试连接。

### 安装MongoDB数据库
>* 目前我们使用的是4.2.23，4.4.17不支持Windows Server2012 R2，6.x在centos下命令有变。
>* 下载msi安装包：https://www.mongodb.com/try/download/community
>* iTdos下载地址：https://static.itdos.com/soft/mongodb-win32-x86_64-2012plus-4.2.23-signed.msi
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380377827464317905833519.png#pic_center)
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380377818853432765738119.png#pic_center)
>* 选择Custom
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380377818884792517096417.png#pic_center)
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380377818904712359053021.png#pic_center)
>* 使用默认的Run service as Network Service user
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380377818932506997802046.png#pic_center)
>* 去掉 Install MongoDB Compass的勾。
>* 安装完成后访问：localhost:27017 出现以下界面表示安装成功，Windows服务中也会有MongoDB服务正在运行。
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380377916760887465029633.png#pic_center)
>* 设置帐号密码：
>* a）进入MongoDB安装目录：D:\Program Files\MongoDB\Server\4.2\bin   执行cmd
>* b）执行命令：
```json
#mongo
#use admin
#db.createUser({user: 'root', pwd: 'iTdos.mongo', roles: ['root']})
说明：创建root用户，密码iTdos.mongo（自定义）
#db.auth('root', 'iTdos.mongo')
说明：测试连接，返回1表示正确
```

### 安装MinIO分布式存储
>* 进入官网下载安装程序：https://min.io/download#/windows
>* 就一个exe程序
![在这里插入图片描述](https://static.itdos.com/upload/editor/image/202211/6380406928638277002335189.png#pic_center)
>* 运行方式：
>* a）将minio.exe放到某个目录，如D:\Microi\Minio\minio.exe。
>* b）下载WinSW-net461.exe：https://static.itdos.com/soft/WinSW-net461.exe   将它放到minio.exe同样的位置，且修改文件名为minio-server.exe
>* c）在minio.exe目录新建一个minio-server.xml文件，链接：https://static.itdos.com/soft/minio-server.xml
>* d）cmd进入minio.exe所在目录（注意并不是直接鼠标双击运行exe）
>* e）执行命令：
```json
#minio-server.exe install
#minio-server.exe start
其它常用命令：
#minio-server.exe stop
#sc delete minio-server.exe 
服务器需要对应端口。
注意：
Sys_OsClients中的【MinIOEndPoint】需要配置为：{服务器内网IP}:9000
系统设置--开发配置中的【FileServer】需要配置为：http://{服务器外网IP}:9000/itdos-public
```
>* f）访问 localhost:9000，默认帐号均为minioadmin
>* g）创建2个Bucket，一个私有，一个公有，可分别取名（名称自定义）：itdos-public（需界面中配置权限为public）、itdos-private

### 安装IIS环境
![在这里插入图片描述](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383125155877365101931668_origin.png/20230925/iis.png#pic_center)
>* 打开服务器管理界面
>* 管理 --添加角色和功能 -- 默认下一步到 服务器角色 ---勾选 Web服务器（IIS）全部勾选（FTP服务器模块除外）
>* 默认下一步 直到安装成功
>* 打开IIS 管理界面
![在这里插入图片描述](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383125179476379767066462_origin.png/20230925/打开iis.png#pic_center)
![在这里插入图片描述](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383125180836250262781416_origin.png/20230925/IIS管理界面.png#pic_center)



## 程序部署

### 下载并解压程序2件套

### 部署microi-api后端接口系统
>* 根目录打开appsettings.json文件，编辑修改[OsClient、OsClientType、OsClientNetwork、OsClientDbConn]四个参数，改成本地对应的
![在这里插入图片描述](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383124995671143943939168_origin.png/20230925/auth.png#pic_center)
>* 修改完成后，在同级目录下运行cmd或者powershell，执行命令 ```dotnet Microi.net.Auth.dll --urls=http://0.0.0.0:1051```,成功运行程序，若提示lisence问题，则提供对应的HID（注意HID会在报错信息中输出，可直接获取HID），反馈给系统管理员，来获取商业授权获取证书，获取后，放到同级目录下覆盖后，再次运行命令即可。
>* 部署完成后，访问是否正常（假设端口为1051）：localhost:1051
>* 最后可将改服务程序制作成windows server服务进行管理，命令参考如下：``` sc create microi-api binPath="C:\Microi\Microi.net.Auth\net10.0\Microi.net.Api.exe" ```

### 部署microi-web前端访问系统
>* 直接创建网站即可，使用任意程序池均可，不用配置环境变量，
>* 但需要修改根目录/index.html中的OsClient、ApiBase对应的变量值。这里图中只是参考，要按真实的client名字和api地址接口来填写
![在这里插入图片描述](https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6383124964739859058076187_origin.png/20230925/os-html.png#pic_center)
