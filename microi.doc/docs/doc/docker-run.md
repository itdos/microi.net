# 🐳 Docker 部署

> **通过 Docker 编排部署 Microi吾码低代码平台全套环境**

---

## 📌 说明

::: warning 前置条件
Docker 部署需要一定的服务器 Linux 操作系统基础。
:::

---

## 🎥 视频教程

- 待重新录制上传
- 历史视频教程：[https://net.itdos.net:999/sharing/ZBN5cLPKa](https://net.itdos.net:999/sharing/ZBN5cLPKa)

---

## 🚀 Docker 编排部署（推荐）

::: tip 生产环境建议
- 通过服务器面板**原生安装 MySQL**（低配服务器建议 v5.7.x，高配服务器建议 v8.0.x）
- Redis、MongoDB 根据实际情况自由决定编排部署还是服务器面板部署
:::

::: danger Ubuntu 24 注意
使用宝塔面板在 Ubuntu 24 上原生安装的 Redis、MongoDB，可能会遇到安装失败或修改端口/密码后无法启动服务，建议直接卸载改用 Docker 编排部署。
:::

请将编排中的镜像地址替换为您的实际地址（默认为开源版镜像）。如使用非公开镜像，需先登录：

```bash
# 请替换帐号、密码、地域
docker login --username=帐号 --password=密码 registry.cn-地域.aliyuncs.com
```
---

### 1️⃣ 安装 MySQL

::: tip 推荐
推荐使用服务器面板进行**原生安装 MySQL**。
:::

::: danger Ubuntu 24 + MySQL 8.0 注意
使用宝塔面板在 Ubuntu 24 上原生安装的 MySQL 8.0，可能遇到修改 3306 端口为其它端口后无法启动的问题，建议直接使用 3306 端口。
:::

**安装后操作：**

1. 使用面板的数据库性能配置进行优化
2. 在配置文件 `[mysqld]` 下添加 `lower_case_table_names = 1`
3. 尝试使用服务器面板的数据库管理进行还原数据库

::: warning 还原数据库失败？
若面板还原失败（如视图之间存在关联 SQL），可使用 Navicat 的**数据传输**功能（成功率 100%）。若遇到视图关联问题，请依次单个还原视图。
:::

4. 还原成功后，建议执行以下 SQL：
```sql
-- 若不能通过Navicat连接数据库，如果是docker部署的mysql，先进入mysql的docker容器
docker exec -it 容器Id/Name bash
-- 在服务器执行命令进入mysql
mysql -u root -p
use 您的数据库名称;
-- 1、修改【sys_config】表中的【SysTitle】字段为新系统名称
update sys_config set SysTitle='新系统名称';
-- 2、修改【sys_osclients】表中的【OsClient】字段为新系统key，修改【RedisHost、RedisPort、RedisPwd】字段为空
update sys_osclients set OsClient='新系统key',RedisHost='',RedisPort='',RedisPwd='';
-- 3、为了防止部分定时任务影响原有业务，建议执行sql停止所有定时任务
update diy_schedule_job set Status='暂停';
update microi_job_triggers set TRIGGER_STATE='PAUSED';
```

---

#### MySQL 5.7 编排

::: tip 配置建议
低配服务器建议 v5.7.x（如 4核8G/16G），高配服务器建议 v8.0.x（如 8核8G/16G）
:::
::: details 展开查看 Shell 命令（20 行）
```shell
version: '3.8'
services:
  microi-mysql5.7:
    image: registry.cn-hangzhou.aliyuncs.com/microios/mysql:5.7
    container_name: microi-mysql5.7
    restart: always
    tty: true
    stdin_open: true
    ports:
      - "1306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=password123456
      - MYSQL_TIME_ZONE=Asia/Shanghai
    volumes:
      - /microi/mysql5.7/data:/var/lib/mysql
      - /microi/mysql5.7/config/microi_mysql.cnf:/etc/mysql/conf.d/microi_mysql.cnf
    logging:
      options:
        max-size: 10m
        max-file: "10"
```
:::
MySQL 5.7 数据库配置文件 `microi_mysql.cnf`：
::: details 展开查看 Shell 命令（51 行）
```shell
[mysqld]
# 基础配置
lower_case_table_names = 1
character_set_server = utf8mb4
collation_server = utf8mb4_unicode_ci
max_allowed_packet = 512M
net_buffer_length = 16384
skip_name_resolve = ON  # 避免DNS解析延迟
sql_mode = ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION # 允许非常规的0000-00-00 00:00:00时间值

# 连接配置
max_connections = 1000
max_connect_errors = 100000  # 防止因错误连接被阻塞
thread_cache_size = 100
table_open_cache = 2000
table_open_cache_instances = 16  # 提升SSD并发访问能力

# 内存配置（8GB优化）
innodb_buffer_pool_size = 5G     # 保留足够内存给OS和其他缓存
innodb_log_buffer_size = 256M
key_buffer_size = 128M           # MyISAM使用少时降低
query_cache_type = 0             # 禁用查询缓存（高并发下易竞争）
query_cache_size = 0
tmp_table_size = 256M
max_heap_table_size = 256M

# InnoDB I/O优化（SSD关键配置）
innodb_io_capacity = 4000        # SSD的IOPS能力（根据SSD性能调整）
innodb_io_capacity_max = 8000    # 突发负载上限
innodb_flush_method = O_DIRECT   # 避免双缓冲，直接访问SSD
innodb_flush_neighbors = 0       # 关闭刷新邻近页（SSD无需寻道优化）
innodb_log_file_size = 2G        # 大日志减少checkpoint
innodb_log_files_in_group = 2    # 总日志大小4G（恢复与性能平衡）
innodb_buffer_pool_instances = 8 # 提升并发访问能力
innodb_read_io_threads = 8       # 增加I/O线程
innodb_write_io_threads = 8
innodb_purge_threads = 4         # 提升清理效率
innodb_adaptive_flushing = ON    # 自适应刷新

# 缓冲配置（每个连接独立，谨慎设置）
sort_buffer_size = 2M
read_buffer_size = 1M
read_rnd_buffer_size = 1M
join_buffer_size = 2M
thread_stack = 512K
binlog_cache_size = 2M

# SSD持久化优化
innodb_flush_log_at_trx_commit = 2  # 事务提交时延后刷盘（SSD安全）
sync_binlog = 1000                  # 批量同步binlog（降低SSD磨损）
innodb_doublewrite = 1              # 保持双写确保崩溃安全（SSD仍需）
```
:::

---

#### MySQL 8.0 编排

::: tip 配置建议
低配服务器建议 v5.7.x，高配服务器建议 v8.0.x
:::
::: details 展开查看 Shell 命令（20 行）
```shell
version: '3.8'
services:
  microi-mysql8.0:
    image: registry.cn-hangzhou.aliyuncs.com/microios/mysql:8.0
    container_name: microi-mysql8.0
    restart: always
    tty: true
    stdin_open: true
    ports:
      - "1307:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=password123456
      - MYSQL_TIME_ZONE=Asia/Shanghai
    volumes:
      - /microi/mysql8.0/data:/var/lib/mysql
      - /microi/mysql8.0/config/microi_mysql8.0.cnf:/etc/mysql/conf.d/microi_mysql8.0.cnf
    logging:
      options:
        max-size: 10m
        max-file: "10"
```
:::
MySQL 8.0 数据库配置文件 `microi_mysql8.0.cnf`：
::: details 展开查看 Shell 命令（61 行）
```shell
[mysqld]
# 基础配置
lower_case_table_names = 1
character_set_server = utf8mb4
collation_server = utf8mb4_unicode_ci
max_allowed_packet = 512M
net_buffer_length = 16384
skip_name_resolve = ON
# MySQL 8.0 SQL模式调整（移除已废弃的NO_AUTO_CREATE_USER）
sql_mode = ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION

# 连接配置
max_connections = 1000
max_connect_errors = 100000
thread_cache_size = 100
table_open_cache = 2000
table_open_cache_instances = 16

# 内存配置（8GB优化）
innodb_buffer_pool_size = 5G
innodb_log_buffer_size = 256M
key_buffer_size = 128M
# MySQL 8.0 已移除查询缓存
# query_cache_type = 0
# query_cache_size = 0
tmp_table_size = 256M
max_heap_table_size = 256M

# InnoDB I/O优化（SSD关键配置）
innodb_io_capacity = 4000
innodb_io_capacity_max = 8000
innodb_flush_method = O_DIRECT
innodb_flush_neighbors = 0
innodb_log_file_size = 2G
innodb_log_files_in_group = 2
innodb_buffer_pool_instances = 8
# MySQL 8.0 默认使用原生AI/O，以下线程参数可保留但实际可能被自动管理
innodb_read_io_threads = 8
innodb_write_io_threads = 8
innodb_purge_threads = 4
innodb_adaptive_flushing = ON

# 缓冲配置（保持与5.7一致）
sort_buffer_size = 2M
read_buffer_size = 1M
read_rnd_buffer_size = 1M
join_buffer_size = 2M
thread_stack = 512K
binlog_cache_size = 2M

# SSD持久化优化
innodb_flush_log_at_trx_commit = 2
sync_binlog = 1000
innodb_doublewrite = 1

# MySQL 8.0 新增推荐配置
default_authentication_plugin = mysql_native_password  # 兼容旧客户端
innodb_dedicated_server = ON  # 自动调整InnoDB内存参数（推荐8G服务器）
log_bin_trust_function_creators = ON  # 允许二进制日志记录存储函数
# 性能Schema优化（根据监控需求调整）
performance_schema = ON
```
:::


---

### 3️⃣ Redis 编排

::: warning 注意
编排中有两个地方包含 `password123456`，请修改为您的自定义密码。
:::
::: details 展开查看 Shell 命令（93 行）
```shell
version: '3.8'
services:
  microi-redis:
    image: registry.cn-hangzhou.aliyuncs.com/microios/redis:7.4.2
    container_name: microi-redis
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
      - /microi/redis/data:/data
    environment:  
      - REDIS_PASSWORD=password123456
    ports:
      - "1379:6379"
    command: 
      - redis-server
      - "--requirepass"
      - "password123456"
      - "--maxmemory"
      - "8gb"
      - "--maxmemory-policy"
      - "allkeys-lru"
      - "--timeout"
      - "300"
      - "--tcp-keepalive"
      - "300"
      - "--tcp-backlog"
      - "511"
      - "--maxclients"
      - "10000"
      - "--loglevel"
      - "notice"
      - "--databases"
      - "16"
      - "--save"
      - "900 1"
      - "--save"
      - "300 10"
      - "--save"
      - "60 10000"
      - "--stop-writes-on-bgsave-error"
      - "no"
      - "--rdbcompression"
      - "yes"
      - "--rdbchecksum"
      - "yes"
      - "--dbfilename"
      - "dump.rdb"
      - "--appendonly"
      - "yes"
      - "--appendfilename"
      - "appendonly.aof"
      - "--appendfsync"
      - "everysec"
      - "--no-appendfsync-on-rewrite"
      - "no"
      - "--auto-aof-rewrite-percentage"
      - "100"
      - "--auto-aof-rewrite-min-size"
      - "64mb"
      - "--aof-load-truncated"
      - "yes"
      - "--aof-use-rdb-preamble"
      - "yes"
      - "--lua-time-limit"
      - "5000"
      - "--lazyfree-lazy-eviction"
      - "no"
      - "--lazyfree-lazy-expire"
      - "no"
      - "--lazyfree-lazy-server-del"
      - "no"
      - "--replica-lazy-flush"
      - "no"
      - "--slowlog-log-slower-than"
      - "10000"
      - "--slowlog-max-len"
      - "128"
      - "--hz"
      - "10"
      - "--dynamic-hz"
      - "yes"
      - "--aof-rewrite-incremental-fsync"
      - "yes"
      - "--rdb-save-incremental-fsync"
      - "yes"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
    restart: always
    tty: true
    stdin_open: true
```
:::


---

### 4️⃣ MongoDB 编排

::: warning 注意
请修改默认密码 `password123456`。
:::
::: details 展开查看 Shell 命令（21 行）
```shell
version: '3.8'
services:
  microi-mongodb:
    image: registry.cn-hangzhou.aliyuncs.com/microios/mongo:latest
    container_name: microi-mongodb
    restart: always
    tty: true
    stdin_open: true
    ports:
      - "1017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=root
      - MONGO_INITDB_ROOT_PASSWORD=password123456
    volumes:
      - /microi/mongodb/data:/data/db
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
    logging:
      options:
        max-size: 10m
        max-file: "10"
```
:::

---

### 5️⃣ MinIO 编排

::: warning 注意修改默认密码 `password123456`
:::

| 端口 | 说明 |
| :--: | ---- |
| 1011 (9001) | MinIO 后台管理面板，安装后需添加 `public`（权限设为 public）和 `private` 两个 Bucket |
| 1010 (9000) | Endpoint 端口，用于 SaaS 引擎配置 EndPoint，如 `192.168.31.199:1010` |

::: danger MinIO 反向代理注意
必须设置 `proxy_set_header Host $http_host`，否则导致私有桶只能上传无法下载。阿里云 OSS、CDN、负载均衡默认配置不会有此问题。
:::
::: details 展开查看 Shell 命令（25 行）
```shell
version: '3.8'
services:
  microi-minio:
    image:  registry.cn-hangzhou.aliyuncs.com/microios/minio:2023-06-09
    container_name: microi-minio
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
      - /microi/minio/data:/data
      - /microi/minio/config:/root/.minio
    environment:  
      - MINIO_ROOT_USER=root
      - MINIO_ROOT_PASSWORD=password123456
    command: server /data --console-address ":9001"
    ports:
      - "1010:9000"
      - "1011:9001"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
    restart: always
    tty: true
    stdin_open: true
```
:::

---

### 6️⃣ 低代码平台程序编排（Api + Web + WebOS + Mobile + Watchtower）

::: tip 说明
- 请将所有参数修改为实际参数，以下镜像均为公开开源版镜像
- `microi-web` 编排的 `OsClient` 可不指定，默认为空（SaaS 模式）
:::
::: details 展开查看 Shell 命令（102 行）
```shell
version: '3.8'
services:
  microi-api:
    image: registry.cn-hangzhou.aliyuncs.com/microios/microi-api:latest
    container_name: microi-api
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
      - /microi/microi.net.license:/app/microi.net.license # 个人版/企业版license授权文件
    environment:  
      - OsClient=iTdos
      - OsClientType=Product
      - OsClientNetwork=Internal
      - OsClientDbConn=Data Source=172.27.221.211;Database=microi_demo;User Id=microi_demo;Password=password123456;Port=1306;Convert Zero Datetime=True;Allow Zero Datetime=True;Charset=utf8mb4;Max Pool Size=500;sslmode=None;
      - OsClientRedisHost=172.27.221.211
      - OsClientRedisPort=1379
      - OsClientRedisPwd=password123456
      - OsClientRedisDataBase=5
    ports:
      - "1000:80"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
    privileged: true
    restart: always
    tty: true
    stdin_open: true

  microi-web:
    image: registry.cn-hangzhou.aliyuncs.com/microios/microi-web:latest
    container_name: microi-web
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
    environment:
      - OsClient=
      - ApiBase=https://api.itdos.com
    ports:
      - "1001:80"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
    restart: always
    tty: true
    stdin_open: true

  microi-webos:
    image: registry.cn-hangzhou.aliyuncs.com/microios/microi-webos:latest
    container_name: microi-webos
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
    environment:
      - OsClient=
      - ApiBase=https://api.itdos.com
    ports:
      - "1002:80"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
    restart: always
    tty: true
    stdin_open: true

  microi-mobile:
    image: registry.cn-hangzhou.aliyuncs.com/microios/microi-mobile:latest
    container_name: microi-mobile
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
    environment:
      - OsClient=
      - ApiBase=https://api.itdos.com
    ports:
      - "1003:80"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
    restart: always
    tty: true
    stdin_open: true

  watchtower:
    image: registry.cn-hangzhou.aliyuncs.com/microios/watchtower:latest
    container_name: watchtower
    restart: always  
    privileged: true
    tty: true
    stdin_open: true
    volumes:  
      - /etc/localtime:/etc/localtime
      - /root/.docker/config.json:/config.json
      - /var/run/docker.sock:/var/run/docker.sock  
    command: --cleanup --include-stopped --interval 10 microi-api microi-web microi-webos microi-mobile
```
:::


---

## 💻 本地 Docker 环境

### 1️⃣ 本地安装 Docker Desktop

- 下载地址：[Docker Desktop](https://docs.docker.com/get-started/get-docker/)

::: warning Windows 用户注意
需要 **Windows 专业版**及以上，不支持 Windows 家庭版。
:::

---

### 2️⃣ 本地打包并上传 Docker 镜像 - 后端

- 容器镜像服务可使用阿里云免费服务：[阿里云容器镜像服务](https://cr.console.aliyun.com/cn-hangzhou/instances)
- 也可自行搭建 [Harbor](https://goharbor.io/) 容器镜像服务
- 编译打包到 `/Microi.net.Api/bin/Release/net8.0/`

在 `/Microi.net.Api/bin/Release/` 处创建 `Dockerfile`：
```powershell
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
MAINTAINER iTdos
LABEL description="iTdos"
COPY net8.0/ /app
WORKDIR /app
EXPOSE 80
RUN ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
RUN echo 'Asia/Shanghai' >/etc/timezone
CMD ["dotnet", "Microi.net.Api.dll", "--urls", "http://0.0.0.0:80"]
```
在同目录创建 `publish.sh`（Windows 为 `publish.bat`）：
```powershell
echo "请输入本次要发布的api版本号："
read version
docker login --username=镜像服务帐号 --password=镜像服务帐号密码 registry.cn-地域.aliyuncs.com
docker build -t microi-api .
docker tag microi-api registry.cn-地域.aliyuncs.com/命名空间/microi-api:latest
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-api:latest
docker tag microi-api registry.cn-地域.aliyuncs.com/命名空间/microi-api:$version
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-api:$version
```
在 cmd 中执行 `publish.sh` 或 `publish.bat`。

---

### 3️⃣ 本地打包并上传 Docker 镜像 - 前端

- 使用 `npm run build` 打包前端
- 在打包输出目录创建 `Dockerfile`：
```powershell
#Vue2
FROM registry.cn-hangzhou.aliyuncs.com/acs-sample/nginx
COPY dist/  /usr/share/nginx/html/
COPY default.conf /etc/nginx/conf.d/default.conf
CMD ["/bin/bash", "-c", "sed -i \"s@var OsClient = '';@var OsClient = '$OsClient';@;s@var ApiBase = '';@var ApiBase = '$ApiBase';@\" /usr/share/nginx/html/index.html; nginx -g \"daemon off;\""]

#Vue3
FROM registry.cn-hangzhou.aliyuncs.com/acs-sample/nginx
COPY dist/  /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf /etc/nginx/conf.d/default.conf
RUN chmod -R 755 /usr/share/nginx/html
CMD ["/bin/bash", "-c", "sed -i \"s@window.OsClient = '';@window.OsClient = '$OsClient';@;s@window.ApiBase = '';@window.ApiBase = '$ApiBase';@;s@window.ApiCustom = '';@window.ApiCustom = '$ApiCustom';@\" /usr/share/nginx/html/index.html && nginx -g \"daemon off;\""]
```
在同目录创建 `publish.sh`（Windows 为 `publish.bat`）：
```powershell
echo "请输入本次要发布的api版本号："
read version
docker login --username=镜像服务帐号 --password=镜像服务帐号密码 registry.cn-地域.aliyuncs.com
docker build -t microi-os .
docker tag microi-os registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest
docker tag microi-os registry.cn-地域.aliyuncs.com/命名空间/microi-os:$version
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-os:$version
```
在同目录创建 `default.conf`：
```json
server {
	listen	0.0.0.0:80;
	#server_name	127.0.0.1 localhost;
	root	/usr/share/nginx/html;
	index	index.html;
	location / {
		try_files $uri $uri/ /index.html;
		add_header Access-Control-Allow-Origin '*';
		# 允许所有内容类型
		if (-f $request_filename) {
			break;
		}
	}
	location = / {
		add_header Access-Control-Allow-Origin '*';
	}
}
```
在 cmd 中执行 `publish.sh` 或 `publish.bat`。

---

### 5️⃣ 登录 Docker 容器镜像服务
```powershell
docker login --username=帐号 --password=密码 registry.cn-地域.aliyuncs.com
```

---

## 🛠️ 服务器安装 Docker 环境

可通过 Linux 命令安装，也可通过宝塔、1Panel 等面板工具安装：
```powershell
curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
systemctl start docker
systemctl enable docker.service
```

---

## 📝 Docker 常用命令
::: details 展开查看 powershell 代码（42 行）
```powershell
批量清理docker日志文件（第一个符号#要一并执行）
#!/bin/bash
logfiles=$(find /var/lib/docker/containers/ -type f -name *-json.log)  
for logfile in $logfiles  
    do 
        cat /dev/null > $logfile  
    done

#docker restart 容器名称/容器Id  //重启docker
#docker stop 容器名称/容器Id  //停止docker
#docker rm -f 容器名称/容器Id  //强制删除docker
#docker inspect 容器名称/容器Id //查看容器信息
#docker exec -it 容器Id bash //进入容器
进入docker容器后使用vim：
#apt-get update
#apt-get install -y vim
#vim xxxx.json
按键i开始编辑，按键ESC后输入:wq保存并退出

cd /
# 查看空间占用
du -h --max-depth=1 | sort -h
# 看哪个目录占用空间大
du -s * | sort -rn
# 查找大文件（超过100M）
find / -size +100M -exec ls -lh {}
# 根据情况进行移动或者卸载，
# 软件包可以rpm –e卸载，
# 文件可以使用rm -rf dir删除；
# 常用命令
ls -lh
# 显示当前目录
pwd
# 显示当前目录所有文件的体积，以M为单位，正序排，不显示文件夹
find . -maxdepth 1 -type f -exec du -m {} \; | sort -n
# 清理docker悬空镜像
docker image prune -a -f
# 清理docker无用的卷
docker image prune -a -f
# 清理docker构建缓存
docker image prune -a -f

```
:::

---

## ⚙️ MySQL 注意事项

::: tip 核心要点
- 建议使用宝塔、1Panel 等服务器面板工具原生安装 MySQL
- 安装成功后，一定要根据服务器实际配置设置 MySQL 的性能配置
- **必须设置**：`lower_case_table_names = 1`
- 还原数据库前，若旧库不为空，请先删除并重新创建数据库
:::

::: danger Ubuntu 24 + MySQL 8.0
使用宝塔在 Ubuntu 24 上原生安装的 MySQL 8.0，可能遇到修改 3306 端口后无法启动的问题。
:::

::: warning 宝塔 MySQL 5.7 性能调整缺陷
宝塔的 MySQL 5.7 性能调整存在缺陷，例如优化方案选择 48-64GB 时，`table_open_cache=4096` 但 `table_definition_cache` 只有 400，可能出现 `1615 - Prepared statement needs to be re-prepared` 错误。

**解决方案：** 在配置文件中添加 `table_definition_cache = 2000`（可为 `table_open_cache` 值的一半或 75%）。临时方案：`SET GLOBAL table_definition_cache = 2000;`
:::

::: warning Navicat 数据传输报错
若报错 `Incorrect datetime value: '0000-00-00 00:00:00'`，先查询 `SELECT @@GLOBAL.sql_mode;`，然后删除 `NO_ZERO_DATE` 和 `NO_ZERO_IN_DATE`：
:::
```json
[mysqld]
sql_mode = ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION
```

::: warning 还原数据库报错
若报错 `Dumping data for table [SQL] Process terminated`，需增加配置：
:::
```json
[mysqld]
max_allowed_packet = 512M
net_buffer_length = 16384
```

**宝塔安装后 root 无法外网登录？** 在服务器执行以下命令开放（项目上线后为了安全性可关闭防火墙 MySQL 端口）：
```sql
mysql -u root -p
show databases;
use mysql;
select host,user from user;
update user set host='%' where user='root';
flush privileges;
```
**MySQL 问题排查常用 SQL：**
```sql
-- 查看当前连接数和使用情况
SHOW STATUS LIKE 'Threads_connected';
-- 查看连接详细
SHOW PROCESSLIST;
-- 查看连接来源
SELECT user, host, db, command, time, state, info 
FROM information_schema.processlist 
WHERE command != 'Sleep';
-- 查看连接历史峰值
SHOW STATUS LIKE 'Max_used_connections';
```

---

## 📦 Redis 注意事项
```cmd
//检查Redis运行状态
docker exec -it redis容器名称 redis-cli -a 'redis密码' info stats

//监控Redis性能
docker exec -it redis容器名称 redis-cli -a 'redis密码' monitor
//监控原生安装的redis
redis-cli -p 3306 -a 'redis密码' monitor

//检查连接数
docker exec -it redis容器名称 redis-cli -a 'redis密码' info clients
```

---

## 📂 MinIO 注意事项

::: danger 反向代理必须配置
MinIO 在做反向代理时，必须设置 `proxy_set_header Host $http_host`，否则会导致私有桶只能上传无法下载。阿里云 OSS、CDN、负载均衡默认配置不会有此问题。
:::