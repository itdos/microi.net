Docker deploymentDescriptionDocker deployment requires a certain server linux operating system foundation

Install Docker Desktop locally* Download address:[https://docs.docker.com/get-started/get-docker/](https://docs.docker.com/get-started/get-docker/)
* Note that if the local development environment is windows, you need to windows the professional version or above, and the windows home version is not supported.

locally package and upload docker images-backend* First, you need a container mirroring service. You can use Aliyun's free:[https://cr.console.aliyun.com/cn-hangzhou/instances](https://cr.console.aliyun.com/cn-hangzhou/instances)
* You can also build a set of [harbor] on the server as a container image service.
* Compile and package to [/Microi.net.Api/bin/Release/net8.0/]/]
* Create the Dockerfile file at [/Microi.net.Api/bin/Release/]```powershell
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

* Create the [publish.sh(windows publish.bat)] file at [/Microi.net.Api/bin/Release/]```powershell
echo "请输入本次要发布的api版本号："
read version
docker login --username=镜像服务帐号 --password=镜像服务帐号密码 registry.cn-地域.aliyuncs.com
docker build -t microi-api .
docker tag microi-api registry.cn-地域.aliyuncs.com/命名空间/microi-api:latest
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-api:latest
docker tag microi-api registry.cn-地域.aliyuncs.com/命名空间/microi-api:$version
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-api:$version
```

* Execute publish.sh or publish.bat at cmd

Local packaging and uploading docker images-front end* Use the# npm run build command to package the front end to [/microi.vue2.pc/dist/itdos. OS/dist/]/]
* Create the [Dockerfile] file at [/microi.vue2.pc/dist/itdos. OS/]```powershell
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

* Create the [publish.sh(windows publish.bat)] file at [/microi.vue2.pc/dist/itdos. OS/]```powershell
echo "请输入本次要发布的api版本号："
read version
docker login --username=镜像服务帐号 --password=镜像服务帐号密码 registry.cn-地域.aliyuncs.com
docker build -t microi-os .
docker tag microi-os registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest
docker tag microi-os registry.cn-地域.aliyuncs.com/命名空间/microi-os:$version
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-os:$version
```

* Create the [default.conf] file at [/microi.vue2.pc/dist/itdos. OS/]```json
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

Execute publish.sh or publish.bat at cmd

Server installation Docker environment* The docker environment can be installed through linux commands, or through panel tools such as pagoda and 1Panel.```powershell
curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
systemctl start docker
systemctl enable docker.service
```

Server installed MySql database (can also be deployed in master-slave synchronous mode)* mysql can be installed through linux commands, or through panel tools such as pagoda and 1Panel
* The following is the centos7.x command```powershell
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


Server installation for Redis (can also be deployed in Sentinel mode)* Redis can be installed through linux commands, or through panel tools such as pagoda and 1Panel.
* The following is the centos7.x command```powershell
REDIS_PORT=16379
REDIS_PASSWORD=microi#redis.pwd
echo 'Microi：Redis 将在端口 '${REDIS_PORT}' 上安装，密码: '${REDIS_PASSWORD}
docker pull registry.cn-hangzhou.aliyuncs.com/microios/redis6.2:latest
docker run -itd --restart=always --log-opt max-size=10m --log-opt max-file=10 --privileged=true \
  --name microi-install-redis -p ${REDIS_PORT}:6379 \
  -e REDIS_PASSWORD=${REDIS_PASSWORD} \
  -d registry.cn-hangzhou.aliyuncs.com/microios/redis6.2:latest redis-server --requirepass ${REDIS_PASSWORD}
```

Server installation MongoDB database (distributed deployment is also possible)* mongodb can be installed through linux commands, or mongodb can be installed through panel tools such as pagoda and 1Panel
* The following is the centos7.x command```powershell
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


MinIO storage is installed on the server (MinIO is not required when using cloud storage such as Alibaba Cloud OSS) (distributed deployment is also possible)* MinIO can be installed through linux commands, or through panel tools such as pagoda and 1Panel```powershell
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


Log in to Docker Container Image Service```powershell
docker login --username=帐号 --password=密码 registry.cn-地域.aliyuncs.com
```


Deploy the backend api program (you can also use Docker orchestration)```powershell
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


Deploy the front-end vue program (you can also use Docker orchestration)```powershell
docker pull registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest
docker run --name microi-os -itd -p 1001:80 --privileged=true --restart=always \
    --log-opt max-size=10m --log-opt max-file=10 \
    -e "OsClient=SaaS引擎Key" -e "ApiBase后端接口地址前缀（如：https://192.168.0.1:1000）" \
    -v /etc/localtime:/etc/localtime -v /usr/share/fonts:/usr/share/fonts \
    registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest
```


Deployment using orchestration* To be supplemented

Deploy program automatic updatesThere are many ways, large enterprises recommend using K8S, small and medium-sized enterprises can use watchtower, here are the watchtower:```powershell
docker run -itd --name watchtower --privileged=true --restart=always \
    -v /root/.docker/config.json:/config.json -v /var/run/docker.sock:/var/run/docker.sock \
    containrrr/watchtower \
    --cleanup --include-stopped --interval 10 \
    microi-api microi-os
```


Common Docker Commands```powershell
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

