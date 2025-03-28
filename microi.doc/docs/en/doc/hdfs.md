# distributed storage
## Introduction
> * platform distributed storage currently supports ariyun OSS/CDN, MinIO, Amazon S3
> * Distributed storage configuration is based on SaaS engine, the advantage is that different SaaS tenants can use different configurations
> * Distributed storage configuration is driven by the form engine, and more configurable items can be freely expanded through the form engine
> * The source code is in the Microi.HDFS plug-in, which can also be extended to Tengxun Cloud, Huawei Cloud, etc.
>* 源码地址：[https://gitee.com/ITdos/microi.net/tree/master/Microi.HDFS](https://gitee.com/ITdos/microi.net/tree/master/Microi.HDFS)

## First, specify the storage method in [System Settings]-[Development Configuration]
> System settings are driven by the form engine, so you can freely expand more custom storage methods in the form design

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/5f7e4c8a6b824c51b1c50de50827abdd.png#pic_center)
## If it is Alibaba Cloud OSS CDN
> Configure relevant parameters in [SaaS Engine]-[Aliyun]

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/dd353af2971c4057b3d47c1f3ad9d81c.png#pic_center)
## If it's Minio
> Configure relevant parameters at [SaaS Engine]-[MinIO]
> See article for how to install MinIO:[https://microi.blog.csdn.net/article/details/143576299](https://microi.blog.csdn.net/article/details/143576299)

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/0bde20907de743f5b051036546837afa.png#pic_center)
## If it's Amazon S3
> First you need to be familiar with Amazon S3:[https://blog.csdn.net/qq973702/article/details/143648974](https://blog.csdn.net/qq973702/article/details/143648974)
> The platform uses MinIO SDK to drive Amazon S3. The configuration is slightly complicated and will be introduced later.