# windows virtual machine deployment

## Foreword

**. NET**started cross-platform dating back to November 2014, when Microsoft announced**. NET Core**project. **. NET Core**is a new cross-platform, open source**. NET**implementation, designed to support`Windows、macOS 和 Linux`Multiple operating systems.

::: tip cross-platform capability introduction

From 2014. The birth of NET Core to 2024. NET 9 ,. NET's cross-platform capabilities continue to evolve, gradually unifying the development framework and supporting multiple operating systems such as Windows, macOS, and Linux.

:::
 
::: details Version release key time point
1. November 2014: Microsoft announced. NET Core project, marking. NET officially towards cross platform.
2. June 2016:. NET Core 1.0, the first cross-platform. NET version.
3. November 2020:. NET 5 release, unified. NET Framework and. NET Core, become the future. NET basis.
4. November 2021:. NET 6 was released, further enhancing cross-platform capabilities and introducing more modern features.
5. November 2022:. NET 7 release, focusing on performance improvement and development efficiency optimization.
6. November 2023:. NET 8 released as the next LTSversion with enhanced cloud native, performance, and security support.
7. November 2024:. NET 9 release, will continue to promote cross-platform and modern application development.
:::



## Preparations

Microi code back-end development framework based on. NET 9.0 development, already supported`Linux`operating system, we recommend use`Linux + Docker`Local environment deployment. If it is`Windows`system, you need to create a virtual machine and install`Linux`operating system.

## Process steps

This tutorial has a detailed graphic tutorial in our technical exchange area, which can be consulted. I will briefly list the following overall steps here:

1. Registered account number: go to the official website (https://www.vmware.com) to register the broadcom (email) account number.
2. Download`VMware Workstation Pro`, it is recommended to go to the official website (https://www.vmware.com) to download, may load a little slowly, but do not need`VPN`.
3. Installation`VMware Workstation Pro`system selection`CentOS7`.
4. Installation`Docker`and configure alibaba cloud image acceleration.
5. Install pagoda panel`Linux`.

## Corresponding tutorial

1. [Windows VMware Workstation Pro Installation Tutorial](https://lisaisai.blog.csdn.net/article/details/144234355)
2. [VMware Workstation17 Installation CentOS7 Tutorial](https://lisaisai.blog.csdn.net/article/details/144532043)
3. [Linux virtual machine Docker configuration ariyun image acceleration](https://lisaisai.blog.csdn.net/article/details/144427304)
4. [Linux Virtual Machine Pagoda Panel Installation Tutorial](https://lisaisai.blog.csdn.net/article/details/144536912)
5. [Docker Minimal Tutorial Quick Start](https://lisaisai.blog.csdn.net/article/details/144204174)
6. [Docker Common Commands (Base, Mirror, Container, Data Volume)](https://lisaisai.blog.csdn.net/article/details/144043003)


::: Warm Tips for warning

Through the above tutorial, we have`Windows`The system local environment is deployed through the virtual machine.`Linux`system, and installed`Docker`and we can pass`[宝塔面板]`to visually manage our`Linux`virtual environment. The following steps are the same as the cloud deployment we mentioned above, the only thing to pay attention to is the configuration of the network address.

:::

## Replacing a Stable Image Source

You can create all containers at once by running a one-click deployment script, but the default image source is:
```bash
 registry.cn-hangzhou.aliyuncs.com/microios/microi-api:latest
```
This is following the main line. We need to use the mirror source of the stable version of the project, so we need to modify it.
Revised:
 ```bash
 registry.cn-beijing.aliyuncs.com/itdos/api.itdos.com:latest
 ```

We just need to pull down the mirror again, then delete the original front-end and back-end mirrors and containers, and keep the rest unchanged,`端口`Stay the same. The source code of the front and back scripts is listed below:

1. Delete the original container and image:

::: code-group

```bash [前端脚本]
#删除容器
docker rm -f microi-install-client
#删除镜像
docker rmi -f [IMAGE ID]
```

```bash [后端脚本]
#删除容器
docker rm -f microi-install-api
#删除镜像
docker rmi -f [IMAGE ID]
```

:::

2. Re-execute the front-end and back-end scripts:
::: code-group

```bash [前端脚本]

docker run -itd --name microi-install-client  -p 26934:80  \
 --privileged=true  --restart=always  --log-opt max-size=10m --log-opt max-file=10 \
 -e "OsClient=fengmei" \
 -e "ApiBase=https://microi_api.fmic.cn:4443" \
 -v /etc/localtime:/etc/localtime \
 -v /usr/share/fonts:/usr/share/fonts  \
 -d registry.cn-beijing.aliyuncs.com/itdos/os.itdos.com:latest


```

```bash [后端脚本]
docker run -itd --restart=always --log-opt max-size=10m --log-opt max-file=10 --privileged=true \
  --name microi-install-api -p 54411:80 \
  -e "OsClient=fengmei" \
  -e "OsClientType=Product" \
  -e "OsClientNetwork=Internal" \
  -e "OsClientDbConn=Data Source=172.19.10.157;Database=microi_demo;User Id=root;Password=5PjBrSjoA7gGM73;Port=55879;Convert Zero Datetime=True;Allow Zero Datetime=True;Charset=utf8mb4;Max Pool Size=500;sslmode=None;" \
  -e "OsClientRedisHost=172.19.10.157" \
  -e "OsClientRedisPort=52712" \
  -e "OsClientRedisPwd=zErUNmnCfOZ96Z1" \
  -e "AuthServer=http://172.19.10.157:54411" \
  -v /etc/localtime:/etc/localtime \
  -v /usr/share/fonts:/usr/share/fonts \
  -d registry.cn-beijing.aliyuncs.com/itdos/api.itdos.com:latest
```

:::


 
- **AuthServer**：To be configured as the back-end service address, the default is' 172.19.10.157:54411'
- **ApiBase**：To be configured as the back-end service address, the default is' https:// microi_ api.fmic.cn:4443 ' ( ' 172.19.10.157:54411 'external network mapping address)

::: warning special attention
In fact, both port parameters point to the [api] interface address of the back-end server, but if you want to configure external network access for localized deployment, then [ApiBase] should be configured as the external network address mapped by the back-end interface.
:::

3. Notes on other parameters

```js
1. OsClient：客户端标识，可以自定义，这里我们设置为 `fengmei`
2. OsClientType：客户端类型，这里设置为 `Product`
3. OsClientNetwork：客户端网络类型，这里设置为 `Internal`
4. OsClientDbConn：数据库连接字符串，这里设置为 `Data Source=172.19.10.157;Database=microi_demo;User Id=root;Password=5PjBrSjoA7gGM73;Port=55879;Convert Zero Datetime=True;Allow Zero Datetime=True;Charset=utf8mb4;Max Pool Size=500;sslmode=None;`
5. OsClientRedisHost：Redis 主机地址，这里设置为 `172.19.10.157`
6. OsClientRedisPort：Redis 端口，这里设置为 `52712`
7. OsClientRedisPwd：Redis 密码，这里设置为 `zErUNmnCfOZ96Z1`
8. AuthServer：授权服务器地址，这里设置为 `http://172.19.10.157:54411`
9. ApiBase：API 地址，这里设置为 `https://microi_api.xxx.cn:4443`
10. 端口：前端端口为 `26934`，后端端口为 `54411`
11. 镜像源：前端镜像源为 `registry.cn-beijing.aliyuncs.com/itdos/os.itdos.com:latest`，后端镜像源为 `registry.cn-beijing.aliyuncs.com/itdos/api.itdos.com:latest`

```
4. Other Precautions

- If the pull image requires authorization verification, execute the following command:

```bash
docker login --username=admin@itdos.com registry.cn-beijing.aliyuncs.com
--password：xxxx
```
> Note: This address or password may change.

- If the backend container starts to report an error, enter the container log to view:
```bash
docker logs -f microi-install-api
```
> Note: If the error is related to the database, please check whether the database name, port, user name and password are correct.

---

::: danger special reminder
The above script is only an example of a real deployment scenario and is temporary and dynamic. Each deployment script may have different parameters and port numbers.
:::