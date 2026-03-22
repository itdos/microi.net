# 🐳Docker deployment

> **Deploy the complete environment of Microi low-code platform through Docker arrangement.**

---

## 📌Explanation

::: warning Preconditions
Docker deployment requires a certain server Linux operating system foundation.
:::

---

## 🎥Video tutorial

- To be re-recorded and uploaded
- History Video Tutorial:[https://net.itdos.net:999/sharing/ZBN5cLPKa](https://net.itdos.net:999/sharing/ZBN5cLPKa)

---

## 🚀Docker Orchestration Deployment (Recommended)

::: tip Production Environment Recommendations
- Install MySQL natively on the server panel **(V5.7.x for low-profile servers and V8.0.x for high-profile servers)
- Redis and MongoDB are free to decide whether to arrange deployment or server panel deployment according to the actual situation.
:::

::: danger Ubuntu 24 Note
Redis and MongoDB natively installed on Ubuntu 24 using the pagoda panel may encounter installation failure or fail to start the service after modifying the port/password. It is recommended to directly uninstall and use Docker to arrange deployment instead.
:::

Replace the image address in the orchestration with your actual address (the default is the open source image). If you use a non-public mirror, you need to log in first:

```bash
# 请替换帐号、密码、地域
docker login --username=帐号 --password=密码 registry.cn-地域.aliyuncs.com
```
---

### 1️⃣Install MySQL

::: tip recommended
We recommend that you use the server panel for **Native installation of MySQL**.
:::

::: danger Ubuntu 24 MySQL 8.0 Note
The MySQL 8.0 installed natively on Ubuntu 24 using the pagoda panel may encounter the problem that it cannot start after modifying the 3306 port to another port. It is recommended to use the 3306 port directly.
:::

**Post-installation operation:**

1. Use the panel's database performance configuration to optimize.
2. In the configuration file.`[mysqld]`Add under`lower_case_table_names = 1`
3. Try to restore the database using the database management of the server panel.

::: warning restore database failed?
If the panel restore fails (for example, there is an associated SQL between views), you can use the Navicat **Data Transfer** function (success rate 100%). If you encounter view association problems, restore the views individually in turn.
:::

4. After the restore is successful, it is recommended to execute the following SQL:
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

#### MySQL 5.7 Orchestration

::: tip configuration recommendations
The low-profile server recommends v5.7.x (such as 4-core 8G/16G), and the high-profile server recommends v8.0.x (such as 8-core 8G/16G)
:::
::: details Expand View Shell Commands (20 lines)
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
MySQL 5.7 Database Configuration File`microi_mysql.cnf`:
::: details Expand View Shell Commands (Line 51)
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

#### MySQL 8.0 Orchestration

::: tip Configuration Recommendations
Low Provisioning Server Recommendation v5.7.x, High Provisioning Server Recommendation v8.0.x
:::
::: details Expand to view Shell commands (20 lines)
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
MySQL 8.0 Database Configuration File`microi_mysql8.0.cnf`:
::: details Expand View Shell Commands (line 61)
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

### three️⃣Redis orchestration

::: warning Attention
There are two places in the choreography that contain`password123456`, please modify to your custom password.
:::
::: details Expand View Shell Command (line 93)
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

### four️⃣MongoDB choreography

::: warning Attention
Please change the default password`password123456`。
:::
::: details Expand View Shell Commands (line 21)
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

### 5️⃣MinIO Orchestration

::: warning attention to modify the default password`password123456`
:::

| Port | Explanation |
| :--: | ---- |
| 1011 (9001) | MinIO background management panel, after installation, you need to add two buckets, 'public' (permission set to public) and 'private' |
| 1010 (9000) | Endpoint port for SaaS engine configuration EndPoint, such as '192.168.31.199:1010' |

::: danger MinIO Reverse Proxy Note
Must be set`proxy_set_header Host $http_host`otherwise, the private bucket can only be uploaded and cannot be downloaded. The default configurations of Alibaba Cloud OSS, CDN, and Server Load Balancer do not have this problem.
:::
::: details Expand View Shell Commands (25 lines)
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

### six️⃣Low-Code Platform Orchestration (Api Web WebOS Mobile Watchtower)

::: tip Description
- Please change all parameters to actual parameters. The following images are public and open source images.
- `microi-web`choreographed`OsClient`Not specified, default is empty (SaaS mode)
:::
::: details Expand View Shell Commands (line 102)
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

## 💻Local Docker environment

### 1️⃣Install Docker Desktop locally

- Download:[Docker Desktop](https://docs.docker.com/get-started/get-docker/)

::: warning Windows User Attention
**Windows Professional Edition** and above are required. Windows Home Edition is not supported.
:::

---

### two️⃣Local packaging and uploading Docker images-backend

- Container Mirroring Service can use Alibaba Cloud free service: [Alibaba Cloud Container Mirroring Service](https://cr.console.aliyun.com/cn-hangzhou/instances)
- You can also build your own [Harbor](https://goharbor.io/) container image service.
- Compile and package`/Microi.net.Api/bin/Release/net8.0/`

in`/Microi.net.Api/bin/Release/`Create`Dockerfile`:
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
Create in the same directory`publish.sh`(Windows`publish.bat`):
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
Execute in cmd`publish.sh`or`publish.bat`。

---

### three️⃣Local packaging and uploading Docker images-front end

- Use`npm run build`Packaging Front End
- Create in the packaging output directory`Dockerfile`:
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
Create in the same directory`publish.sh`(Windows is`publish.bat`):
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
Create in the same directory`default.conf`:
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
Execute in cmd`publish.sh`or`publish.bat`。

---

### 5️⃣Log in to the Docker Container Registry
```powershell
docker login --username=帐号 --password=密码 registry.cn-地域.aliyuncs.com
```

---

## 🛠Install the Docker environment on the server.

It can be installed through Linux commands or through panel tools such as Pagoda and 1Panel:
```powershell
curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
systemctl start docker
systemctl enable docker.service
```

---

## 📝Common Docker Commands
::: details Expand to view powershell code (42 lines)
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

## ⚙MySQL Considerations

::: tip core points
- It is recommended to use pagoda, 1Panel and other server panel tools to install MySQL natively.
- After the installation is successful, be sure to set MySQL performance configuration according to the actual configuration of the server
- **Must be set**：'lower_case_table_names = 1'
- Before restoring the database, if the old library is not empty, delete and re-create the database
:::

::: danger Ubuntu 24 MySQL 8.0
Using the MySQL 8.0 installed natively by Pagoda on Ubuntu 24, you may encounter the problem of not being able to start after modifying the 3306 port.
:::

::: warning Pagoda MySQL 5.7 performance tuning defects
Pagoda's MySQL 5.7 performance tuning is flawed, such as when the optimization option is 48-64GB,`table_open_cache=4096`But`table_definition_cache`Only 400 that may appear`1615 - Prepared statement needs to be re-prepared`Error.

**Solution:** Add in the configuration file`table_definition_cache = 2000`(can be`table_open_cache`half or 75% of the value). Temporary Plan:`SET GLOBAL table_definition_cache = 2000;`
:::

::: warning Navicat Data Transmission Error
If reporting an error`Incorrect datetime value: '0000-00-00 00:00:00'`, query first`SELECT @@GLOBAL.sql_mode;`and then delete`NO_ZERO_DATE`and`NO_ZERO_IN_DATE`:
:::
```json
[mysqld]
sql_mode = ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION
```

::: warning Restore Database Error
If an error occurs`Dumping data for table [SQL] Process terminated`, need to add configuration:
:::
```json
[mysqld]
max_allowed_packet = 512M
net_buffer_length = 16384
```

**Can't root log in to the external network after the pagoda is installed?** Run the following command on the server to open (the MySQL port of the firewall can be closed for security after the project goes online):
```sql
mysql -u root -p
show databases;
use mysql;
select host,user from user;
update user set host='%' where user='root';
flush privileges;
```
**Common SQL for MySQL troubleshooting:**
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

## 📦Redis Considerations
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

## 📂MinIO Considerations

::: dangerReverse proxy must be configured
MinIO must set`proxy_set_header Host $http_host`otherwise, the private bucket can only be uploaded and cannot be downloaded. This issue does not occur in the default configurations of Alibaba Cloud OSS, CDN, and Server Load Balancer.
:::