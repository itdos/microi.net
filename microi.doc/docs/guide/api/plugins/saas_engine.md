# saas引擎

## 简介
**SaaS引擎** 作为平台的亮点之一，承载了所有租户的核心独立开发配置
平台默认就是 `SaaS` 模式，因此部署平台必须自定义指定一个 `OsClient` 值：如 `microi、iTdos、anderson`
每个租户一个独立数据库，并且在主库中为每个租户配置独立的 `Redis`、`MQ`、搜索引擎、阿里云、`MinIO`等
一套程序驱动 `N`个租户数据库，而不必每个租房再部署一套 `docker`程序

### OsClient介绍

`OsClient` 值即为 `SaaS` 引擎 `Key`，值自定义，建议全小写字母，如 microi、iTdos、anderson，在 `sys_osclients` 表中，`OsClient + OsClientType + OsClientNetwork` 三个字段同时唯一，如同时存在以下 `3` 条数据是支持的：

1. OsClient=“microi”，OsClientType=“Product”，OsClientNetwork="Internal，DbConn=“Data Source=192.168.1.11;Database=microi”，使用了内网IP+正式环境数据库。
2. OsClient=“microi”，OsClientType=“Dev”，OsClientNetwork=“Internal”，DbConn=“Data Source=192.168.1.11;-Database=microi_dev”，使用了内网IP+测试环境数据库。
3. OsClient=“microi”，OsClientType=“Dev”，OsClientNetwork=“Internet”，DbConn=“Data Source=59.110.139.95;Database=microi_dev”，使用了公网IP+测试环境数据库。

>程序必须指定以上3个参数，以确定读取该 `OsClient` 租户对应的环境+网络类型各项其它配置。

 
### OsClientType介绍
`OsClientType` 值为 `SaaS` 引擎环境类型，值自定义，如正式环境、测试环境、外帐环境等。

### OsClientNetwork介绍
`OsClientNetwork` 值为 `SaaS` 引擎网络类型，值自定义，如内网、外网等。

## 基础配置

支持数据库读写分离，支持指定存储介质。

![基础配置](/api_plugins/saas01.png)

## 阿里云配置
如果未使用 `MinIO`，即可使用阿里云的 `OSS+CDN` 。
![阿里云配置](/api_plugins/saas02.png)

## MinIO配置
如果未使用阿里云 `OSS`，则可以使用 `MinIO` 。
![MinIO配置](/api_plugins/saas03.png)

## Redis配置
支持哨兵模式
![Redis配置](/api_plugins/saas04.png)

## MQ消息队列配置
支持集群模式
![MQ消息队列配置](/api_plugins/saas05.png)

## 搜索引擎配置
目前仅支持 `ES` 搜索引擎，支持分词搜索，将来可能扩展其它搜索引擎。
![搜索引擎配置](/api_plugins/saas06.png)
