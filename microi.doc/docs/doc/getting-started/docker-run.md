# 🐳 Docker 部署

> **通过 Docker 编排部署 Microi吾码低代码平台全套环境**

## 🚀 一键安装（零门槛部署）

针对不想本地编译代码、打包镜像、安装环境等繁琐操作的用户，提供**一键安装脚本**。

自动安装 **MySQL + Redis + MinIO + MongoDB + Ollama + Qdrant + Watchtower + 低代码平台程序（API + Web）**，基于 Docker Compose 编排部署，支持宝塔面板 Docker 编排模块可视化管理。

### 📦 CentOS 7/8/9 / Ubuntu 20/22/24 / Debian 10/11/12 一键安装
```cmd
url=https://static.itdos.com/install/install-microi.sh;if [ -f /usr/bin/curl ];then curl -sSO $url;else wget -O install-microi.sh $url;fi;bash install-microi.sh
```

### ⚠️ 注意事项

| 序号 | 说明 |
| :--: | ---- |
| 1 | 执行脚本时会提示选择【公网 IP `g` / 内网 IP `n`】和【Demo 示例数据库 / 空数据库】 |
| 2 | Docker 环境不存在时脚本会**自动安装** Docker 及 Docker Compose V2 插件 |
| 3 | MySQL 性能配置会**自动根据服务器内存**生成（支持 1G ~ 32G+ 多档位） |
| 4 | 端口从 **7000 开始顺序 +1 分配**（7000-7009），安装前会自动检测端口占用，若有冲突则从 7100 开始重试 |
| 5 | 安装前脚本会**先在防火墙中开放**所有端口，再部署服务（若使用云服务器，还需在云控制台安全组中开放） |
| 6 | 重复执行脚本前会提示先删除已安装容器/编排，**这将导致所有数据丢失** |
| 7 | 若脚本中文显示为乱码/问号，请先执行 `export LANG=en_US.UTF-8` 或 `export LANG=C.UTF-8` 后重新运行 |

### 📋 端口分配表（默认从 7000 开始）

| 端口 | 服务 | 容器内部端口 |
| :--: | ---- | :--: |
| 7000 | MySQL 5.7 | 3306 |
| 7001 | Redis 7.4 | 6379 |
| 7002 | MongoDB | 27017 |
| 7003 | MinIO API | 9000 |
| 7004 | MinIO Console | 9001 |
| 7005 | Ollama AI | 11434 |
| 7006 | Qdrant HTTP | 6333 |
| 7007 | Qdrant gRPC | 6334 |
| 7008 | API | 80 |
| 7009 | Web 前端 | 80 |

> 若 7000-7009 中有端口被占用，脚本会自动从 7100-7109 开始重新检测，以此类推（每次 +100）。

### 🗑️ 删除所有已安装容器/编排

::: danger 此操作将导致所有数据丢失
方式一（推荐）：进入各编排目录执行 `docker compose down`

方式二（强制删除所有容器）：
```bash
docker ps -a --format "{{.Names}}" | grep "^microi-install-" | xargs -r docker rm -f
```
:::

### 🔌 离线安装（无互联网环境）

适用于**无法访问互联网**的 Linux 服务器，需要在一台有网络的机器上提前制作离线安装包。

#### 前置要求
- 目标服务器已安装 **Docker** 和 **Docker Compose V2** 插件（离线 Docker 安装请参考 [Docker 官方文档](https://docs.docker.com/engine/install/binaries/)）
- 目标服务器已安装 `unzip`、`openssl` 命令
- 制作离线包的机器需要有互联网且已安装 Docker

#### 第一步：在有网络的机器上制作离线包

```bash
# 下载制作脚本和离线安装脚本
curl -sSO https://static.itdos.com/install/microi-offline-prepare.sh
curl -sSO https://static.itdos.com/install/install-microi-offline.sh
curl -sSO https://static.itdos.com/install/install-microi.sh

# 执行制作脚本（会拉取 Docker 镜像并打包，约需 10-30 分钟）
bash microi-offline-prepare.sh
```

执行完成后会在当前目录生成 `microi-offline.zip`（约 5-10GB，包含所有 Docker 镜像和数据库文件）。

#### 第二步：上传到目标服务器并安装

```bash
# 1. 将 microi-offline.zip 上传到目标服务器（使用 scp、sftp 等工具）
scp microi-offline.zip root@目标服务器IP:/root/

# 2. 在目标服务器上解压
unzip microi-offline.zip -d microi-offline

# 3. 进入目录并执行离线安装
cd microi-offline
bash install-microi-offline.sh
```

::: tip 说明
- 离线安装脚本与在线脚本功能**完全一致**（端口分配、MySQL 配置、防火墙开放等）
- 唯一区别是镜像从本地 tar 文件加载，数据库文件从本地解压，不需要联网
- 安装完成后 Watchtower 自动更新服务需要联网才能生效
:::

---

## 🔧 Docker 手动编排部署

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

### 6️⃣ 低代码平台程序编排（Api + Web + Watchtower）

::: tip 说明
- 请将所有参数修改为实际参数，以下镜像均为公开开源版镜像
- `microi-web` 编排的 `OsClient` 可不指定，默认为空（SaaS 模式）
:::
::: details 展开查看 Shell 命令（70 行）
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

  microi-client:
    image: registry.cn-hangzhou.aliyuncs.com/microios/microi-client:latest
    container_name: microi-client
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
    command: --cleanup --include-stopped --interval 10 microi-api microi-web
```
:::


---

### 7️⃣ Ollama 编排

>* Docker会自动创建所需的数据目录，无需手动创建
>* 通过docker编排部署
::: details 展开查看 Shell 命令（50 行）
```shell
version: '3.8'
services:
  # Ollama AI 服务（使用阿里云镜像加速）
  microi-ollama:
    image: registry.cn-hangzhou.aliyuncs.com/microios/ollama:latest  # 使用阿里云镜像，也可使用日期版本如 :20260129
    container_name: microi-ollama
    ports:
      - "1434:11434"  # 如需修改端口，直接改这里，如 "8080:11434"
    volumes:
      - /microi/ollama/data:/root/.ollama  # 持久化模型数据（统一存储在/microi目录下）
    restart: always  # 开机自动启动
    environment:
      - OLLAMA_HOST=0.0.0.0:11434
    healthcheck:
      test: ["CMD", "/bin/sh", "-c", "ollama list || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - microi-ollama-network

networks:
  microi-ollama-network:
    driver: bridge

# =====================================================
# Microi.net 专用 Ollama + DeepSeek 部署方案
# 使用阿里云镜像加速
# =====================================================
#
# 【验证部署】
#   curl http://localhost:1434/api/tags
#   docker exec microi-ollama ollama list
#
# 【测试AI对话】
#   curl http://localhost:1434/v1/chat/completions \
#     -H "Content-Type: application/json" \
#     -d '{
#       "model": "deepseek-r1:1.5b",
#       "messages": [{"role": "user", "content": "你好"}]
#     }'
#
# 【下载其他模型】
#   docker exec microi-ollama ollama pull deepseek-r1:7b # 下载7B模型
#   docker exec microi-ollama ollama pull deepseek-coder:1.3b # 下载Coder模型
#   docker exec microi-ollama ollama pull deepseek-coder:6.7b # 下载Coder 6.7B模型
#   docker logs -f microi-ollama # 查看下载进度
#   docker exec microi-ollama ollama list # 查看已安装模型
# =====================================================
```
:::

>* 拉取nomic-embed-text模型（384维，用于中英文文本）
```shell
docker exec microi-ollama ollama pull nomic-embed-text
```

>* 测试API
```
curl http://localhost:1434/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "nomic-embed-text", "input": "测试"}'
```

### 7️⃣ Qdrant 向量数据库编排
::: details 展开查看 Shell 命令（93 行）
```shell
version: '3.8'
services:
  # Qdrant向量数据库服务
  microi-qdrant:
    image: registry.cn-hangzhou.aliyuncs.com/microios/qdrant:latest
    container_name: microi-qdrant
    restart: unless-stopped
    
    # 端口映射
    ports:
      - "1333:6333"      # HTTP API端口
      - "1334:6334"      # gRPC端口（可选，高性能场景）
      
    # 数据卷挂载（持久化存储）
    volumes:
      - /microi/qdrant/storage:/qdrant/storage          # 主存储目录
      - /microi/qdrant/snapshots:/qdrant/snapshots      # 快照目录
      - /microi/qdrant/config:/qdrant/config            # 配置文件目录（可选）

    # 环境变量配置（所有优化配置）
    environment:
      # 安全配置（生产环境建议启用）
      - QDRANT__SERVICE__API_KEY=password123456         # API密钥（取消注释后启用）
      - QDRANT__SERVICE__ENABLE_TLS=false               # TLS加密（本地部署可关闭）

      # 核心配置
      - QDRANT__SERVICE__HTTP_PORT=6333
      - QDRANT__SERVICE__GRPC_PORT=6334
      
      # 性能优化配置
      - QDRANT__STORAGE__PERFORMANCE__MAX_SEARCH_THREADS=4          # 搜索线程数
      - QDRANT__STORAGE__PERFORMANCE__MAX_OPTIMIZATION_THREADS=2    # 优化线程数
      - QDRANT__STORAGE__PERFORMANCE__UPDATE_QUEUE_SIZE=100         # 更新队列大小
      
      # HNSW索引优化（提升搜索速度）
      - QDRANT__STORAGE__HNSW_INDEX__M=16                           # HNSW图的连接数（默认16）
      - QDRANT__STORAGE__HNSW_INDEX__EF_CONSTRUCT=100               # 构建时的搜索深度（默认100）
      
      # 内存优化
      - QDRANT__STORAGE__ON_DISK_PAYLOAD=true                       # 将Payload存储到磁盘（节省内存）
      - QDRANT__STORAGE__MMAP_THRESHOLD_KB=102400                   # 100MB以上使用mmap（减少内存占用）
      
      # 持久化与恢复
      - QDRANT__STORAGE__WAL__WAL_CAPACITY_MB=32                    # WAL日志容量（MB）
      - QDRANT__STORAGE__WAL__WAL_SEGMENTS_AHEAD=0                  # 提前创建WAL段数
      - QDRANT__STORAGE__SNAPSHOT_PATH=/qdrant/snapshots            # 快照路径
      
      # 日志配置
      - QDRANT__LOG_LEVEL=INFO                                      # 日志级别: TRACE, DEBUG, INFO, WARN, ERROR
      
      # 集群配置（单机部署可忽略）
      - QDRANT__CLUSTER__ENABLED=false                              # 是否启用集群模式
      
      # 资源限制（防止OOM）
      - QDRANT__STORAGE__OPTIMIZERS__MEMMAP_THRESHOLD_KB=102400     # mmap阈值
      - QDRANT__STORAGE__OPTIMIZERS__INDEXING_THRESHOLD_KB=20480    # 索引阈值（20MB）
        
    # 资源限制（根据服务器实际情况调整）
    #deploy:
    #  resources:
    #    limits:
    #      cpus: '4.0'              # 最大CPU核心数
    #      memory: 8G               # 最大内存
    
    # 健康检查（可选，如不需要可删除）
    # 作用：监控服务状态，自动重启失败的容器
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    
    # 网络配置
    networks:
      - microi-qdrant-network
    
    # 标签（便于管理）
    labels:
      - "com.microi.service=qdrant"
      - "com.microi.description=Qdrant Vector Database for AI"
      - "com.microi.version=1.0"

# 网络定义
networks:
  microi-qdrant-network:
    driver: bridge  # 简单桥接网络，无需固定IP

# http://localhost:1333/healthz # 健康检查接口
# 管理界面: http://localhost:1333/dashboard
# 检查向量数据是否已初始化：
# http://localhost:1333/collections/microi_schema
# 查看 points_count 是否>0
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