# windows虚拟机部署

## 前言

**.NET** 开始跨平台的时间可以追溯到 2014 年 11 月，当时微软宣布了 **.NET Core** 项目。**.NET Core** 是一个全新的跨平台、开源的 **.NET** 实现，旨在支持 `Windows、macOS 和 Linux` 等多个操作系统。

::: tip 跨平台能力介绍

从 2014 年 .NET Core 的诞生到 2024 年的 .NET 9，.NET 的跨平台能力不断演进，逐步统一了开发框架，并支持 Windows、macOS 和 Linux 等多个操作系统。

:::
 
::: details 版本发布关键时间点
1. 2014 年 11 月：微软宣布 .NET Core 项目，标志着 .NET 正式迈向跨平台。
2. 2016 年 6 月：.NET Core 1.0 正式发布，这是第一个跨平台的 .NET 版本。
3. 2020 年 11 月：.NET 5 发布，统一了 .NET Framework 和 .NET Core，成为未来 .NET 的基础。
4. 2021 年 11 月：.NET 6 发布，进一步增强了跨平台能力，并引入了更多现代化功能。
5. 2022 年 11 月：.NET 7 发布，专注于性能提升和开发效率优化。
6. 2023 年 11 月：.NET 8 发布，作为下一个 LTS 版本，增强了云原生、性能和安全性支持。
7. 2024 年 11 月：.NET 9 发布，将继续推动跨平台和现代化应用开发。
:::



## 准备工作

Microi吾码 后端开发框架基于 .NET 9.0 开发，已然支持 `Linux` 操作系统，我们推荐使用 `Linux + Docker` 进行本地环境部署。如果是 `Windows` 系统，需先创建虚拟机，并安装 `Linux` 操作系统。

## 流程步骤

该教程有专门在我们的技术交流区中有详细的图文教程，可以参考，我这里就简单罗列下整体步骤：

1. 注册账号：前往官网（https://www.vmware.com）注册 broadcom（邮箱）账号。
2. 下载 `VMware Workstation Pro`,建议前往官网（https://www.vmware.com）下载，可能加载稍微有点慢，但是不需要 `VPN`。
3. 安装 `VMware Workstation Pro` ，系统选择 `CentOS7` 。
4. 安装 `Docker` 并配置阿里云镜像加速。
5. 安装宝塔面板 `Linux`。

## 对应教程

1. [Windows VMware Workstation Pro安装教程](https://lisaisai.blog.csdn.net/article/details/144234355)
2. [VMware Workstation17 安装 CentOS7 教程](https://lisaisai.blog.csdn.net/article/details/144532043)
3. [Linux虚拟机 Docker 配置阿里云镜像加速](https://lisaisai.blog.csdn.net/article/details/144427304)
4. [Linux虚拟机宝塔面板安装教程](https://lisaisai.blog.csdn.net/article/details/144536912)
5. [Docker 极简教程 快速入门](https://lisaisai.blog.csdn.net/article/details/144204174)
6. [Docker 常用命令大全（基础、镜像、容器、数据卷）](https://lisaisai.blog.csdn.net/article/details/144043003)


::: warning 温馨提示

通过上面的教程，我们在 `Windows` 系统本地环境通过虚拟机部署了 `Linux` 系统，并安装好了 `Docker` ，我们可以通过 `[宝塔面板]` 来可视化管理我们的 `Linux` 虚拟环境。后面步骤和我们上面提到的云部署一样，唯一要注意的就是网络地址的配置。

:::

## 更换稳定版镜像源

通过一键部署脚本执行可以把所有的容器一次性创建完成，但是默认的镜像源是：
```bash
 registry.cn-hangzhou.aliyuncs.com/microios/microi-api:latest
```
 这个是跟着主线走的，我们需要用项目稳定版本的镜像源，所以需要修改一下。
 修改为： 
 ```bash
 registry.cn-beijing.aliyuncs.com/itdos/api.itdos.com:latest
 ```

我们只需要重新拉取下镜像即可，然后删除原有的前端和后端镜像和容器，其它保持不变，`端口` 保持不变。下面罗列出来前后端脚本的源码：

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

::: warning 特别注意
其实两个端口参数都是指向后端服务器 【api】 接口地址，但是本地化部署如果要配置外网访问，那么 【ApiBase】 要配置为后端接口映射的外网地址。
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
>注意：该地址或者密码可能会变更。

- 如果后端容器启动报错,进入容器日志查看：
```bash
docker logs -f microi-install-api
```
>注意：如果报错和数据库相关，请检查数据库名称是否正确，端口是否正确，用户名密码是否正确。

---

::: danger 特别提醒
以上脚本只是某一次真实部署场景的示例，是临时动态的。每次部署脚本的参数、端口号等可能都不一样。
:::