# Docker部署

## 说明
>* Docker部署需要一定的服务器linux操作系统基础

## Docker编排部署（推荐）
>* 生产环境建议通过服务器面板原生安装mysql（低配服务器建议v5.7.x[如4核8G/16G]，高配服务器建议v8.0.x[如8核8G/16G]）
>* Redis、Mongodb、Minio根据实际情况自由决定编排部署还是使用服务器面板部署
>* 请将编排中的镜像地址替换为您的实际地址，这里的默认地址为开源版镜像


### 1、Mysql5.7编排（推荐使用服务器面板进行原生安装mysql）
>* 低配服务器建议v5.7.x[如4核8G/16G]，高配服务器建议v8.0.x[如8核8G/16G]
```shell
version: '3.8'
services:
  mysql5.7:
    image: registry.cn-hangzhou.aliyuncs.com/microios/mysql:5.7
    container_name: mysql5.7
    #restart: always
    tty: true
    stdin_open: true
    ports:
      - "1306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=password123456
      - MYSQL_TIME_ZONE=Asia/Shanghai
    volumes:
      - /volume2/ssd/docker/mysql/data:/var/lib/mysql
      - /volume2/ssd/docker/mysql/config/microi_mysql.cnf:/etc/mysql/conf.d/microi_mysql.cnf
    #deploy:
    #  resources:
    #    limits:
    #      memory: 8G
    logging:
      options:
        max-size: 10m
        max-file: "10"
```
>* MySql5.7数据库配置文件：microi_mysql.cnf
```shell
[mysqld]
# 基础配置
lower_case_table_names = 1
character_set_server = utf8mb4
collation_server = utf8mb4_unicode_ci
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

### 2、Mysql8.0编排（推荐使用服务器面板进行原生安装mysql）
>* 低配服务器建议v5.7.x[如4核8G/16G]，高配服务器建议v8.0.x[如8核8G/16G]
```shell
version: '3.8'
services:
  mysql8.0:
    image: registry.cn-hangzhou.aliyuncs.com/microios/mysql:8.0
    container_name: mysql8.0
    #restart: always
    tty: true
    stdin_open: true
    ports:
      - "1307:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=password123456
      - MYSQL_TIME_ZONE=Asia/Shanghai
    volumes:
      - /volume2/ssd/docker/mysql8.0/data:/var/lib/mysql
      - /volume2/ssd/docker/mysql8.0/config/microi_mysql8.0.cnf:/etc/mysql/conf.d/microi_mysql8.0.cnf
    #deploy:
    #  resources:
    #    limits:
    #      memory: 8G
    logging:
      options:
        max-size: 10m
        max-file: "10"
```
>* MySql8.0数据库配置文件：microi_mysql8.0.cnf
```shell
[mysqld]
# 基础配置
lower_case_table_names = 1
character_set_server = utf8mb4
collation_server = utf8mb4_unicode_ci
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


### 3、Redis编排
```shell
version: '3.8'
services:
  redis:
    image: registry.cn-hangzhou.aliyuncs.com/microios/redis:7.4.2
    container_name: redis
    volumes:
      - /etc/localtime:/etc/localtime
    environment:  
      - REDIS_PASSWORD=password123456
    ports:
      - "1379:6379"
    command: 
      - redis-server
      - "--requirepass"
      - "redis#nas.20250811"
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


### 4、MongoDB编排
```shell
version: '3.8'
services:
  mongodb:
    image: registry.cn-hangzhou.aliyuncs.com/microios/mongo:latest
    container_name: mongodb
    restart: always
    tty: true
    stdin_open: true
    ports:
      - "1017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=root
      - MONGO_INITDB_ROOT_PASSWORD=password123456
    volumes:
      - /volume1/docker/mongodb/data:/data/db
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
    logging:
      options:
        max-size: 10m
        max-file: "10"
```

### 5、Minio编排
```shell
version: '3.8'
services:
  minio:
    image:  registry.cn-hangzhou.aliyuncs.com/microios/minio:2023-06-09
    container_name: minio
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
      - /volume1/docker/minio/data:/data
      - /volume1/docker/minio/config:/root/.minio
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

### 6、低代码平台程序编排（Api + Web + WebOS + Mobile + Watchtower自动更新）
>* 请将所有参数修改为实际参数
>* microi-web编排的OsClient环境变量可不指定，默认为空（SaaS模式）
```shell
version: '3.8'
services:
  microi-api:
    image: registry.cn-hangzhou.aliyuncs.com/microios/microi-api:latest
    container_name: microi-api
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
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
    image: registry.cn-hangzhou.aliyuncs.com/microios/microi-client:latest
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
    image: registry.cn-hangzhou.aliyuncs.com/microios/microi-os:latest
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
    image: registry.cn-beijing.aliyuncs.com/itdos/os-mobile:latest
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

  microi-watchtower:
    image: registry.cn-hangzhou.aliyuncs.com/microios/watchtower:latest
    container_name: microi-watchtower
    restart: always  
    privileged: true
    tty: true
    stdin_open: true
    volumes:  
      - /etc/localtime:/etc/localtime  
      #- /root/.docker/config.json:/config.json # 群晖不支持
      - /var/run/docker.sock:/var/run/docker.sock  
    command: --cleanup --include-stopped --interval 10 microi-api microi-web microi-webos microi-mobile
```




## 常规[docker run]部署（推荐编排）

### 1、本地安装Docker Desktop
>* 下载地址：[https://docs.docker.com/get-started/get-docker/](https://docs.docker.com/get-started/get-docker/)
>* 注意如果本地开发环境是windows，需要windows专业版及以上，不支持windows家庭版

### 2、本地打包并上传docker镜像-后端
>* 首先需要一个容器镜像服务，可以使用阿里云免费的：[https://cr.console.aliyun.com/cn-hangzhou/instances](https://cr.console.aliyun.com/cn-hangzhou/instances)
>* 也可以自己在服务器上搭建一套【harbor】做为容器镜像服务
>* 编译打包到【/Microi.net.Api/bin/Release/net8.0/】
>* 在【/Microi.net.Api/bin/Release/】处创建【Dockerfile】文件
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
>* 在【/Microi.net.Api/bin/Release/】处创建【publish.sh（windows为publish.bat）】文件
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
>* 在cmd处执行publish.sh或publish.bat

### 3、本地打包并上传docker镜像-前端
>* 使用#npm run build命令打包前端到【/microi.vue2.pc/dist/itdos.os/dist/】
>* 在【/microi.vue2.pc/dist/itdos.os/】处创建【Dockerfile】文件
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
>* 在【/microi.vue2.pc/dist/itdos.os/】处创建【publish.sh（windows为publish.bat）】文件
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
>* 在【/microi.vue2.pc/dist/itdos.os/】处创建【default.conf】文件
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
> 在cmd处执行publish.sh或publish.bat

### 4、服务器安装Docker环境
>* 可以通过linux命令安装docker环境，也可以通过宝塔、1Panel等面板工具安装docker环境
```powershell
curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
systemctl start docker
systemctl enable docker.service
```

### 5、登陆到docker容器镜像服务
```powershell
docker login --username=帐号 --password=密码 registry.cn-地域.aliyuncs.com
```

### 6、服务器安装MySql数据库
>* 可以通过linux命令安装mysql，也可以主从同步模式部署
>* 也可以通过宝塔、1Panel等面板工具安装mysql
>* 以下为centos7.x命令
```powershell
MYSQL_PORT=13306
MYSQL_ROOT_PASSWORD="microi#mysql.pwd"
MYSQL_DATA_DIR="/microi/mysql/"
MYSQL_CONF_FILE="/tmp/my_microi.cnf"
echo '[mysqld]' > ${MYSQL_CONF_FILE}
echo 'lower_case_table_names = 1' >> ${MYSQL_CONF_FILE}
echo 'max_connections = 500' >> ${MYSQL_CONF_FILE}
echo 'key_buffer_size = 268435456' >> ${MYSQL_CONF_FILE}
echo 'query_cache_size = 268435456' >> ${MYSQL_CONF_FILE}
echo 'tmp_table_size = 268435456' >> ${MYSQL_CONF_FILE}
echo 'innodb_buffer_pool_size = 536870912' >> ${MYSQL_CONF_FILE}
echo 'innodb_log_buffer_size = 268435456' >> ${MYSQL_CONF_FILE}
echo 'sort_buffer_size = 1048576' >> ${MYSQL_CONF_FILE}
echo 'read_buffer_size = 2097152' >> ${MYSQL_CONF_FILE}
echo 'read_rnd_buffer_size = 1048576' >> ${MYSQL_CONF_FILE}
echo 'join_buffer_size = 2097152' >> ${MYSQL_CONF_FILE}
echo 'thread_stack = 393216' >> ${MYSQL_CONF_FILE}
echo 'binlog_cache_size = 196608' >> ${MYSQL_CONF_FILE}
echo 'thread_cache_size = 192' >> ${MYSQL_CONF_FILE}
echo 'table_open_cache = 1024' >> ${MYSQL_CONF_FILE}
echo 'character_set_server=utf8mb4' >> ${MYSQL_CONF_FILE}
echo 'collation_server=utf8mb4_unicode_ci' >> ${MYSQL_CONF_FILE}
echo 'Microi：MySQL 将在端口 '${MYSQL_PORT}' 上安装，root 密码: '${MYSQL_ROOT_PASSWORD}，数据目录: ${MYSQL_DATA_DIR}
docker run -itd --restart=always --log-opt max-size=10m --log-opt max-file=10 --privileged=true \
  --name microi-install-mysql56 -p ${MYSQL_PORT}:3306 \
  -v ${MYSQL_DATA_DIR}:/var/lib/mysql \
  -v ${MYSQL_CONF_FILE}:/etc/mysql/conf.d/my_microi.cnf \
  -e MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD} \
  -e MYSQL_TIME_ZONE=Asia/Shanghai \
  -d registry.cn-hangzhou.aliyuncs.com/microios/mysql5.6:latest
echo 'Microi：等待MySQL容器启动...'
sleep 5
echo 'Microi：检查MySQL是否可以连接...'
for i in {1..10}; do
  docker exec -i microi-install-mysql56 mysql -uroot -p${MYSQL_ROOT_PASSWORD} -e "SELECT 1" > /dev/null 2>&1 && break
  sleep 1
done
if [ $i -eq 60 ]; then
  echo 'Microi：MySQL服务启动失败，脚本退出。'
  exit 1
fi
echo 'Microi：允许root用户从任意主机连接'
docker exec -i microi-install-mysql56 mysql -uroot -p${MYSQL_ROOT_PASSWORD} -e "USE mysql; GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY '${MYSQL_ROOT_PASSWORD}' WITH GRANT OPTION;"
docker exec -i microi-install-mysql56 mysql -uroot -p${MYSQL_ROOT_PASSWORD} -e "FLUSH PRIVILEGES;"
```

### 7、服务器安装Redis（也可以哨兵模式部署）
>* 可以通过linux命令安装redis，也可以通过宝塔、1Panel等面板工具安装redis
>* 以下为centos7.x命令
```powershell
REDIS_PORT=16379
REDIS_PASSWORD=microi#redis.pwd
echo 'Microi：Redis 将在端口 '${REDIS_PORT}' 上安装，密码: '${REDIS_PASSWORD}
docker pull registry.cn-hangzhou.aliyuncs.com/microios/redis6.2:latest
docker run -itd --restart=always --log-opt max-size=10m --log-opt max-file=10 --privileged=true \
  --name microi-install-redis -p ${REDIS_PORT}:6379 \
  -e REDIS_PASSWORD=${REDIS_PASSWORD} \
  -d registry.cn-hangzhou.aliyuncs.com/microios/redis6.2:latest redis-server --requirepass ${REDIS_PASSWORD}
```

### 8、服务器安装MongoDB数据库（也可以分布式部署）
>* 可以通过linux命令安装mongodb，也可以通过宝塔、1Panel等面板工具安装mongodb
>* 以下为centos7.x命令
```powershell
MONGO_PORT=17017
MONGO_ROOT_PASSWORD=microi#mongodb.pwd
MONGO_DATA_DIR="/microi/mongodb/"
echo 'Microi：MongoDB 将在端口 '${MONGO_PORT}' 上安装，root 密码: '${MONGO_ROOT_PASSWORD}，数据目录: ${MONGO_DATA_DIR}
docker pull registry.cn-hangzhou.aliyuncs.com/microios/mongo:latest
docker run -itd --restart=always --log-opt max-size=10m --log-opt max-file=10 --privileged=true \
  --name microi-install-mongodb -p ${MONGO_PORT}:27017 \
  -v ${MONGO_DATA_DIR}:/data/db \
  -e MONGO_INITDB_ROOT_USERNAME=root \
  -e MONGO_INITDB_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD} \
  -d registry.cn-hangzhou.aliyuncs.com/microios/mongo:latest
```

### 9、服务器安装MinIO存储（使用阿里云OSS等云存储不需要安装MinIO）（也可以分布式部署）
>* 可以通过linux命令安装MinIO，也可以通过宝塔、1Panel等面板工具安装MinIO
```powershell
docker run -p 1010:9000 -p 1011:9001 --name minio \
--restart=always \
--log-opt max-size=10m --log-opt max-file=10 \
-e "MINIO_ROOT_USER=root" \
-e "MINIO_ROOT_PASSWORD=minio.pwd" \
-v /data/minio/data:/data \
-v /data/minio/config:/root/.minio \
-d minio/minio server /data --console-address ":1011"
//说明：
1011为MinIO后台管理系统地址端口，1010为文件访问地址以及接口调用端口。
通过ip:1011登陆进去，创建2个Bucket，一个私有一个公有，
可分别取名：microi-public（需界面中配置权限为public）、microi-private
```

### 10、部署后端api程序
```powershell
docker pull registry.cn-地域.aliyuncs.com/命名空间/microi-api:latest
docker run --name microi-api -itd -p 1000:80 --privileged=true --restart=always \
    --log-opt max-size=10m --log-opt max-file=10 \
    -e "OsClient=SaaS引擎Key" \
    -e "OsClientType=Product" -e "OsClientNetwork=Internal" \
    -e OsClientDbConn="数据库连接字符串" \
    -e "OsClientRedisHost=RedisIP" \
    -e "OsClientRedisPort=Redis端口" \ 
    -e "OsClientRedisPwd=Redis密码" \
    -e "AuthServer=https://身份认证系统地址(就是api本身,注意具体情况看是http还是https)" \
    -v /etc/localtime:/etc/localtime -v /usr/share/fonts:/usr/share/fonts \
    registry.cn-地域.aliyuncs.com/命名空间/microi-api:latest
```

### 11、部署前端web程序
```powershell
docker pull registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest
docker run --name microi-os -itd -p 1001:80 --privileged=true --restart=always \
    --log-opt max-size=10m --log-opt max-file=10 \
    -e "OsClient=SaaS引擎Key" -e "ApiBase后端接口地址前缀（如：https://192.168.0.1:1000）" \
    -v /etc/localtime:/etc/localtime -v /usr/share/fonts:/usr/share/fonts \
    registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest
```

### 12、部署程序自动更新
> 方式有很多种，大型企业建议使用K8S，中小型企业可使用watchtower，这里介绍watchtower：
```powershell
docker run -itd --name watchtower --privileged=true --restart=always \
    -v /root/.docker/config.json:/config.json -v /var/run/docker.sock:/var/run/docker.sock \
    containrrr/watchtower \
    --cleanup --include-stopped --interval 10 \
    microi-api microi-os
```

## Docker常用命令
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
```

## MySql的一些注意事项
>* 建议使用宝塔、1panel等服务器面板工具进行原生安装mysql（低配服务器建议v5.7.x[如4核8G/16G]，高配服务器建议v8.0.x[如8核8G/16G]）
>* mysql安装成功之后，一定要根据服务器实际配置去设置mysql的性能配置
>* mysql必须设置lower_case_table_names=1
>* 宝塔的mysql5.7的性能调整存在一定的缺陷，比如说优化方案选择48-64GB，table_open_cache的值为4096，而table_definition_cache却只有400，可能会出现【1615 - Prepared statement needs to be re-prepared】此问题，需要在配置文件中添加table_definition_cache = 2000（可以是table_open_cache值的一半或75%），临时方案sql执行：SET GLOBAL table_definition_cache = 2000;
>* 使用navicat进行数据传输时可能报错【 Incorrect datetime value: '0000-00-00 00:00:00' for column 'CreateTime' at row 】，先数据库查询【SELECT @@GLOBAL.sql_mode;】，然后删除【 NO_ZERO_DATE 和 NO_ZERO_IN_DATE 】，最终配置：
```json
[mysqld]
sql_mode = ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION
```
>* 宝塔安装mysql后默认root无法通过外网登录，可以在服务器执行以下命令开放（项目正式上线后为了安全性可以防火墙不开放mysql端口即可）
```sql
mysql -u root -p
show databases;
use mysql;
select host,user from user;
update user set host='%' where user='root';
flush privileges;
```
>* Mysql问题排查常用sql
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

## Redis的一些注意事项
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