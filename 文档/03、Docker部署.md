## 开源低代码平台-Microi吾码-简介
* 技术框架：.NET8 + Redis + MySql/SqlServer/Oracle + Vue2/3 + Element-UI/Element-Plus
* 平台始于2014年（基于Avalon.js），2018年使用Vue重构，于2024年10月29日开源
* 试用地址：[https://microi.net](https://microi.net)
* Gitee开源地址：[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
* GitCode开源地址：[https://gitcode.com/microi-net/microi.net/overview](https://gitcode.com/microi-net/microi.net/overview)

## Docker部署
* Docker部署需要一定的服务器linux操作系统基础

## 本地安装Docker Desktop
* 下载地址：[https://docs.docker.com/get-started/get-docker/](https://docs.docker.com/get-started/get-docker/)
* 注意如果本地开发环境是windows，需要windows专业版及以上，不支持windows家庭版

## 本地打包并上传docker镜像-后端
* 首先需要一个容器镜像服务，可以使用阿里云免费的：[https://cr.console.aliyun.com/cn-hangzhou/instances](https://cr.console.aliyun.com/cn-hangzhou/instances)
* 也可以自己在服务器上搭建一套【harbor】做为容器镜像服务
* 编译打包到【/Microi.net.Api/bin/Release/net8.0/】
* 在【/Microi.net.Api/bin/Release/】处创建【Dockerfile】文件
```cmd
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
* 在【/Microi.net.Api/bin/Release/】处创建【publish.sh（windows为publish.bat）】文件
```cmd
echo "请输入本次要发布的api版本号："
read version
docker login --username=镜像服务帐号 --password=镜像服务帐号密码 registry.cn-地域.aliyuncs.com
docker build -t microi-api .
docker tag microi-api registry.cn-地域.aliyuncs.com/命名空间/microi-api:latest
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-api:latest
docker tag microi-api registry.cn-地域.aliyuncs.com/命名空间/microi-api:$version
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-api:$version
```
* 在cmd处执行publish.sh或publish.bat

## 本地打包并上传docker镜像-前端
* 使用#npm run build命令打包前端到【/microi.vue2.pc/dist/itdos.os/dist/】
* 在【/microi.vue2.pc/dist/itdos.os/】处创建【Dockerfile】文件
```cmd
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
* 在【/microi.vue2.pc/dist/itdos.os/】处创建【publish.sh（windows为publish.bat）】文件
```cmd
echo "请输入本次要发布的api版本号："
read version
docker login --username=镜像服务帐号 --password=镜像服务帐号密码 registry.cn-地域.aliyuncs.com
docker build -t microi-os .
docker tag microi-os registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest
docker tag microi-os registry.cn-地域.aliyuncs.com/命名空间/microi-os:$version
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-os:$version
```
* 在【/microi.vue2.pc/dist/itdos.os/】处创建【default.conf】文件
```nginx
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
* 在cmd处执行publish.sh或publish.bat

## 服务器安装Docker环境
* 可以通过linux命令安装docker环境，也可以通过宝塔、1Panel等面板工具安装docker环境
```cmd
#curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
#systemctl start docker
#systemctl enable docker.service
```
## 服务器安装MySql数据库
* 可以通过linux命令安装mysql，也可以通过宝塔、1Panel等面板工具安装mysql
```cmd
#docker pull mysql:5.6 
#docker run -itd --name mysql56 \
--restart=always \
--log-opt max-size=10m \
--log-opt max-file=10 \
-v /home/mysql56/data:/var/lib/mysql \
-p 1006:3306 \
-e MYSQL_ROOT_PASSWORD=mysql.pwd \
-e TZ=Asia/Shanghai \
mysql:5.6 \
--lower-case-table-names=1 \
--character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
```

## 服务器安装Redis
* 可以通过linux命令安装redis，也可以通过宝塔、1Panel等面板工具安装redis
```cmd
#docker pull redis:6.2.7
#docker run -itd --name redis6 \
--restart=always \
--log-opt max-size=10m \
--log-opt max-file=10 \
-p 1009:6379 \
redis:6.2.7 \
--requirepass redis.pwd
```
## 服务器安装MongoDB数据库
* 可以通过linux命令安装mongodb，也可以通过宝塔、1Panel等面板工具安装mongodb
```cmd
#docker pull mongo:4.4.17
#docker run -itd --name mongo4 \
--restart=always \
--log-opt max-size=10m \
--log-opt max-file=10 \
-p 1007:27017 \
mongo:4.4.17 --auth
#docker exec -it mongo4 mongo root
#use admin
#db.createUser({user: 'root', pwd: 'mongo.pwd', roles: ['root']})
#测试连接，返回1表示正确
#db.auth('root', 'mongo.pwd')
```

## 服务器安装MinIO存储（使用阿里云OSS等云存储不需要安装MinIO）
* 可以通过linux命令安装MinIO，也可以通过宝塔、1Panel等面板工具安装MinIO
```cmd
#docker run -p 1010:9000 -p 1011:9001 --name minio \
--restart=always \
--log-opt max-size=10m --log-opt max-file=10 \
-e "MINIO_ROOT_USER=root" \
-e "MINIO_ROOT_PASSWORD=minio.pwd" \
-v /data/minio/data:/data \
-v /data/minio/config:/root/.minio \
-d minio/minio server /data --console-address ":1011"
说明：
1011为MinIO后台管理系统地址端口，1010为文件访问地址以及接口调用端口。
通过ip:1011登陆进去，创建2个Bucket，一个私有一个公有，可分别取名：microi-public（需界面中配置权限为public）、microi-private
```

## 登陆到docker容器镜像服务
```bash
#docker login --username=帐号 --password=密码 registry.cn-地域.aliyuncs.com
```

## 部署后端api程序（也可以使用Docker编排）
```cmd
#docker pull registry.cn-地域.aliyuncs.com/命名空间/microi-api:latest
#docker run --name microi-api -itd -p 1000:80 --privileged=true --restart=always \
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
```cmd
#docker pull registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest
#docker run --name microi-os -itd -p 1001:80 --privileged=true --restart=always \
    --log-opt max-size=10m --log-opt max-file=10 \
    -e "OsClient=SaaS引擎Key" -e "ApiBase后端接口地址前缀（如：https://192.168.0.1:1000）" \
    -v /etc/localtime:/etc/localtime -v /usr/share/fonts:/usr/share/fonts \
    registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest
```

## 使用编排部署
* 待补充

## 部署程序自动更新
* 方式有很多种，大型企业建议使用K8S，中小型企业可使用watchtower，这里介绍watchtower：
```cmd
#docker run -itd --name watchtower --privileged=true --restart=always \
    -v /root/.docker/config.json:/config.json -v /var/run/docker.sock:/var/run/docker.sock \
    containrrr/watchtower \
    --cleanup --include-stopped --interval 10 \
    microi-api microi-os
```
