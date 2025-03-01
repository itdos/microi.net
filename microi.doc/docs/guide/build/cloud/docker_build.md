# docker 部署

## Docker 快速入门

**Docker** 部署需要一定的服务器 `linux` 操作系统基础,下面将罗列一些技术栈，如果想学习的可自行跳转学习。

* [Docker 极简教程 快速入门](https://lisaisai.blog.csdn.net/article/details/144204174)
* [Docker 常用命令大全（基础、镜像、容器、数据卷）](https://lisaisai.blog.csdn.net/article/details/144043003)
* [Docker 系列之 docker-compose 容器编排详解](https://lisaisai.blog.csdn.net/article/details/145356960)
* [Shell 语法入门系列文章](https://lisaisai.blog.csdn.net/article/details/145371231)
* [一文快速掌握 YAML 文件](https://lisaisai.blog.csdn.net/article/details/145328976)
* [VMware Workstation17 安装 CentOS7 教程](https://lisaisai.blog.csdn.net/article/details/144532043)

## 本地打包并上传 docker 镜像-后端

1. 首先需要一个容器镜像服务，可以使用阿里云免费的：https://cr.console.aliyun.com/cn-hangzhou/instances
2. 也可以自己在服务器上搭建一套 `harbor` 做为容器镜像服务
3. 编译打包到 `/Microi.net.Api/bin/Release/net8.0/`
4. 在 `/Microi.net.Api/bin/Release/`处创建 `Dockerfile`文件

```dockerfile
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

> 在 `/Microi.net.Api/bin/Release/` 处创建 `publish.sh`（ **windows** 为 `publish.bat`）文件

```bash
echo "请输入本次要发布的api版本号："
read version
docker login --username=镜像服务帐号 --password=镜像服务帐号密码 registry.cn-地域.aliyuncs.com
docker build -t microi-api .
docker tag microi-api registry.cn-地域.aliyuncs.com/命名空间/microi-api:latest
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-api:latest
docker tag microi-api registry.cn-地域.aliyuncs.com/命名空间/microi-api:$version
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-api:$version
```
> 在 `cmd` 处执行 `publish.sh` 或 `publish.bat` 。


## 本地打包并上传 docker 镜像-前端

1. 使用 `npm run build` 命令打包前端到 `/microi.vue2.pc/dist/itdos.os/dist/`
2. 在 `/microi.vue2.pc/dist/itdos.os/` 处创建 `Dockerfile` 文件

```dockerfile
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

>在 `/microi.vue2.pc/dist/itdos.os/` 处创建 `publish.sh`（ **windows** 为 `publish.bat`）文件

```bash
echo "请输入本次要发布的api版本号："
read version
docker login --username=镜像服务帐号 --password=镜像服务帐号密码 registry.cn-地域.aliyuncs.com
docker build -t microi-os .
docker tag microi-os registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest
docker tag microi-os registry.cn-地域.aliyuncs.com/命名空间/microi-os:$version
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-os:$version

```

>在 `/microi.vue2.pc/dist/itdos.os/` 处创建 `default.conf` 文件

```xml
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

>在 `cmd` 处执行 `publish.sh` 或 `publish.bat` 


## 服务器安装Docker环境

>可以通过 `linux` 命令安装 `docker` 环境，也可以通过宝塔、1Panel等面板工具安装 `docker`环境

```bash
curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
systemctl start docker
systemctl enable docker.service
```

## 服务器安装MySql数据库（也可以主从同步模式部署）

可以通过 `linux` 命令安装 `mysql`，也可以通过宝塔、1Panel等面板工具安装 `mysql`
以下为 `centos7.x` 命令

```bash
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

## 服务器安装Redis（也可以哨兵模式部署）

可以通过 `linux` 命令安装 `redis`，也可以通过宝塔、1Panel等面板工具安装 `redis`
以下为 `centos7.x` 命令

```bash
REDIS_PORT=16379
REDIS_PASSWORD=microi#redis.pwd
echo 'Microi：Redis 将在端口 '${REDIS_PORT}' 上安装，密码: '${REDIS_PASSWORD}
docker pull registry.cn-hangzhou.aliyuncs.com/microios/redis6.2:latest
docker run -itd --restart=always --log-opt max-size=10m --log-opt max-file=10 --privileged=true \
  --name microi-install-redis -p ${REDIS_PORT}:6379 \
  -e REDIS_PASSWORD=${REDIS_PASSWORD} \
  -d registry.cn-hangzhou.aliyuncs.com/microios/redis6.2:latest redis-server --requirepass ${REDIS_PASSWORD}

```

## 服务器安装MinIO存储（使用阿里云OSS等云存储不需要安装MinIO）（也可以分布式部署）

可以通过 `linux` 命令安装 `MinIO` ，也可以通过宝塔、1Panel等面板工具安装 `MinIO`

```bash
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

## 登陆到Docker容器镜像服务

```bash
docker login --username=帐号 --password=密码 registry.cn-地域.aliyuncs.com

```

## 部署后端api程序（也可以使用Docker编排）

```bash
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

## 部署前端vue程序（也可以使用Docker编排）

```bash
docker pull registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest
docker run --name microi-os -itd -p 1001:80 --privileged=true --restart=always \
    --log-opt max-size=10m --log-opt max-file=10 \
    -e "OsClient=SaaS引擎Key" -e "ApiBase后端接口地址前缀（如：https://192.168.0.1:1000）" \
    -v /etc/localtime:/etc/localtime -v /usr/share/fonts:/usr/share/fonts \
    registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest

```

## 部署程序自动更新

方式有很多种，大型企业建议使用 `K8S`，中小型企业可使用 `watchtower`，这里介绍 `watchtower`：

```bash
docker run -itd --name watchtower --privileged=true --restart=always \
    -v /root/.docker/config.json:/config.json -v /var/run/docker.sock:/var/run/docker.sock \
    containrrr/watchtower \
    --cleanup --include-stopped --interval 10 \
    microi-api microi-os

```

## Docker常用命令

```bash
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