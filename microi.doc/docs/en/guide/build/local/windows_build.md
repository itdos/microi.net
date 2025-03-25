windows virtual machine deploymentForeword* *. NET **started cross-platform dating back to November 2014, when Microsoft announced * *. NET Core **project. * *. NET Core **is a new cross-platform, open source * *. NET **implementation designed to support multiple operating systems such as 'Windows, macOS, and Linux.

::: tip cross-platform capability introduction

From 2014. The birth of NET Core to 2024. NET 9 ,. NET's cross-platform capabilities continue to evolve, gradually unifying the development framework and supporting multiple operating systems such as Windows, macOS, and Linux.

:::
 
::: Key time points for details version release1. 2014 年 11 月：微软宣布 .NET Core 项目，标志着 .NET 正式迈向跨平台。
2. 2016 年 6 月：.NET Core 1.0 正式发布，这是第一个跨平台的 .NET 版本。
3. 2020 年 11 月：.NET 5 发布，统一了 .NET Framework 和 .NET Core，成为未来 .NET 的基础。
4. 2021 年 11 月：.NET 6 发布，进一步增强了跨平台能力，并引入了更多现代化功能。
5. 2022 年 11 月：.NET 7 发布，专注于性能提升和开发效率优化。
6. 2023 年 11 月：.NET 8 发布，作为下一个 LTS 版本，增强了云原生、性能和安全性支持。
7. 2024 年 11 月：.NET 9 发布，将继续推动跨平台和现代化应用开发。
:::



PreparationsMicroi code back-end development framework based on. NET 9.0 development, already supports 'Linux' operating system, we recommend use 'Linux Docker' for local environment deployment. If it is a 'Windows' system, you must first create a virtual machine and install the 'Linux' operating system.

Process stepsThis tutorial has a detailed graphic tutorial in our technical exchange area, which can be consulted. I will briefly list the following overall steps here:

1. 注册账号：前往官网（https://www.vmware.com）注册 broadcom（邮箱）账号。
2. 下载 `VMware Workstation Pro`,建议前往官网（https://www.vmware.com）下载，可能加载稍微有点慢，但是不需要 `VPN`。
3. 安装 `VMware Workstation Pro` ，系统选择 `CentOS7` 。
4. 安装 `Docker` 并配置阿里云镜像加速。
5. 安装宝塔面板 `Linux`。

Corresponding tutorial1. [Windows VMware Workstation Pro安装教程](https://lisaisai.blog.csdn.net/article/details/144234355)
2. [VMware Workstation17 安装 CentOS7 教程](https://lisaisai.blog.csdn.net/article/details/144532043)
3. [Linux虚拟机 Docker 配置阿里云镜像加速](https://lisaisai.blog.csdn.net/article/details/144427304)
4. [Linux虚拟机宝塔面板安装教程](https://lisaisai.blog.csdn.net/article/details/144536912)
5. [Docker 极简教程 快速入门](https://lisaisai.blog.csdn.net/article/details/144204174)
6. [Docker 常用命令大全（基础、镜像、容器、数据卷）](https://lisaisai.blog.csdn.net/article/details/144043003)


::: Warm Tips for warning

Through the above tutorial, we deployed the' Linux' system through virtual machines in the local environment of' Windows' system, and installed the' Docker'. We can visually manage our 'Linux' virtual environment through the' [pagoda panel]. The following steps are the same as the cloud deployment we mentioned above, the only thing to pay attention to is the configuration of the network address.

:::

Replacing a Stable Image SourceYou can create all containers at once by running a one-click deployment script, but the default image source is:```bash
 registry.cn-hangzhou.aliyuncs.com/microios/microi-api:latest
```

This is following the main line. We need to use the mirror source of the stable version of the project, so we need to modify it.
Revised: ```bash
 registry.cn-beijing.aliyuncs.com/itdos/api.itdos.com:latest
 ```


We just need to pull down the mirror again, and then delete the original front-end and back-end mirrors and containers. The others remain unchanged, and the' port' remains unchanged. The source code of the front and back scripts is listed below:

1. 删除原有的容器和镜像：

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

2. 重新执行前后端脚本：
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


 
- **AuthServer**：要配置为后端服务地址，默认为 `172.19.10.157:54411`
- **ApiBase**：要配置为后端服务地址，默认为 `https://microi_api.fmic.cn:4443` （ `172.19.10.157:54411` 的外网映射地址） 

::: warning special attention
In fact, both port parameters point to the [api] interface address of the back-end server, but if you want to configure external network access for localized deployment, then [ApiBase] should be configured as the external network address mapped by the back-end interface.
:::

3. 其它参数注解

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

4. 其它注意事项

- 如果拉取镜像需要授权验证，请执行以下命令:

```bash
docker login --username=admin@itdos.com registry.cn-beijing.aliyuncs.com
--password：xxxx
```

Note: The address or password may change.

- 如果后端容器启动报错,进入容器日志查看：
```bash
docker logs -f microi-install-api
```

Note: If the error is related to the database, please check whether the database name, port, user name and password are correct.

---

::: danger special reminder
The above script is only an example of a real deployment scenario and is temporary and dynamic. Each deployment script may have different parameters and port numbers.
:::