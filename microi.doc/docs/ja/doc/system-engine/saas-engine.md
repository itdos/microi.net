# SaaS引擎
## 介绍
>* SaaS引擎作为平台的亮点之一，承载了所有租户的核心独立开发配置
>* 平台默认就是SaaS模式，因此部署平台必须自定义指定一个OsClient值：如microi、iTdos、anderson
>* 每个租户一个独立数据库，并且在主库中为每个租户配置独立的Redis、MQ、搜索引擎、阿里云、MinIO等
>* 一套程序驱动N个租户数据库，而不必每个租房再部署一套docker程序

## OsClient
>* OsClient值即为SaaS引擎Key，值自定义，建议全小写字母，如microi、iTdos、anderson
>* 在sys_osclients表中，OsClient + OsClientType + OsClientNetwork三个字段同时唯一，如同时存在以下3条数据是支持的：
>* OsClient="microi"，OsClientType="Product"，OsClientNetwork="Internal，DbConn="Data Source=192.168.1.11;Database=microi"，使用了内网IP+正式环境数据库
>* OsClient="microi"，OsClientType="Dev"，OsClientNetwork="Internal"，DbConn="Data Source=192.168.1.11;Database=microi_dev"，使用了内网IP+测试环境数据库
>* OsClient="microi"，OsClientType="Dev"，OsClientNetwork="Internet"，DbConn="Data Source=59.110.139.95;Database=microi_dev"，使用了公网IP+测试环境数据库

## OsClientType
>* OsClientType值为SaaS引擎环境类型，值自定义，如正式环境、测试环境、外帐环境等

## OsClientNetwork
>* OsClientNetwork值为SaaS引擎网络类型，值自定义，如内网、外网等

## 程序必须指定以上3个参数
>* 以确定读取该OsClient租户对应的环境+网络类型各项其它配置


## 基础配置
>* 支持数据库读写分离，支持指定存储介质

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/de7982df51cc41afa7e0dbc2c5389c89.png#pic_center)

## 阿里云配置
>* 如果未使用MinIO，即可使用阿里云的OSS+CDN

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/0e4da43b35394de7867cfa5425697476.png#pic_center)

## MinIO配置
>* 如果未使用阿里云OSS，则可以使用MinIO

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/1efac36d0af04dd58b79723e2c850070.png#pic_center)

## Redis配置
>* 支持哨兵模式

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/d67c8649dc444e508238410c36b746ee.png#pic_center)

## MQ消息队列配置
>* 支持集群模式

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/c171c8510a2b452980c3f020048b9d53.png#pic_center)

## 搜索引擎配置
>* 目前仅支持ES搜索引擎，支持分词搜索，将来可能扩展其它搜索引擎

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/637ce005054d43c2b6177f3b00693fc3.png#pic_center)

