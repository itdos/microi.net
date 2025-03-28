# SaaS Engine
## Introduction
> * As one of the highlights of the platform, the SaaS engine hosts the core independent development configuration of all tenants.
> * the platform is SaaS mode by default, so the deployment platform must specify a OsClient value: such as microi, iTdos, anderson
> * Each tenant has an independent database, and each tenant is configured with independent Redis, MQ, search engine, Aliyun, MinIO, etc. in the main database
> * One set of programs drives N tenant databases, instead of deploying another set of docker programs for each rental house.

## OsClient
> * the OsClient value is the key of the SaaS engine. the value is custom. it is recommended to use all lowercase letters, such as microi, iTdos, and anderson.
> * In the sys_osclients table, the three fields OsClientNetwork the OsClient OsClientType are unique at the same time. For example, the following three data items are supported at the same time:
> * OsClient = "microi",OsClientType = "Product",OsClientNetwork = "Internal,DbConn =" Data Source = 192.168.1.11;Database = microi ", using the intranet IP formal environment database
> * OsClient = "microi",OsClientType = "Dev",OsClientNetwork = "Internal",DbConn = "Data Source = 192.168.1.11;Database = microi_dev", using intranet IP test environment database
> * OsClient = "microi",OsClientType = "Dev",OsClientNetwork = "Internet",DbConn = "Data Source = 59.110.139.95;Database = microi_dev", using public IP test environment database

## OsClientType
> * The OsClientType value is the SaaS engine environment type, and the value is customized, such as the official environment, test environment, and external account environment.

## OsClientNetwork
> * The OsClientNetwork value is the network type of the SaaS engine, and the value is customized, such as intranet and extranet.

## The program must specify the above 3 parameters
> * to determine to read other configurations of the environment network type corresponding to the OsClient tenant


## Basic configuration
> * Support database read and write separation, support specified storage media

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/de7982df51cc41afa7e0dbc2c5389c89.png#pic_center)

## Alibaba Cloud configuration
> * If MinIO is not used, Alibaba Cloud's OSS CDN can be used

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/0e4da43b35394de7867cfa5425697476.png#pic_center)

## MinIO Configuration
> * If you are not using Alibaba Cloud OSS, you can use MinIO

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/1efac36d0af04dd58b79723e2c850070.png#pic_center)

## Redis Configuration
> * Support Sentinel mode

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/d67c8649dc444e508238410c36b746ee.png#pic_center)

## MQ message queue configuration
> * Support cluster mode

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/c171c8510a2b452980c3f020048b9d53.png#pic_center)

## Search Engine Configuration
> * Currently, only ES search engine is supported, and word segmentation search is supported. Other search engines may be expanded in the future.

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/637ce005054d43c2b6177f3b00693fc3.png#pic_center)

