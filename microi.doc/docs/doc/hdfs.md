# 分布式存储
## 介绍
>* 平台分布式存储目前支持阿里云OSS/CDN、MinIO、亚马逊S3
>* 分布式存储配置基于SaaS引擎，优势是不同的SaaS租户可以使用不同的配置
>* 分布式存储配置由表单引擎驱动，可通过表单引擎自由扩展更多可配置项
>* 源码均在Microi.HDFS插件中，也可扩展腾讯云、华为云等
>* 源码地址：[https://gitee.com/ITdos/microi.net/tree/master/Microi.HDFS](https://gitee.com/ITdos/microi.net/tree/master/Microi.HDFS)

## 首先在[系统设置]-[开发配置]中指定存储方式
>* 系统设置由表单引擎驱动，因此可在表单设计中自由扩展更多自定义存储方式

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/5f7e4c8a6b824c51b1c50de50827abdd.png#pic_center)
## 如果是阿里云OSS+CDN
>* 在【SaaS引擎】-【Aliyun】处配置相关参数

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/dd353af2971c4057b3d47c1f3ad9d81c.png#pic_center)
## 如果是MinIO
>* 在【SaaS引擎】-【MinIO】处配置相关参数
>* 安装MinIO方法见文章：[https://microi.blog.csdn.net/article/details/143576299](https://microi.blog.csdn.net/article/details/143576299)

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/0bde20907de743f5b051036546837afa.png#pic_center)
## 如果是亚马逊S3
>* 首先您需要熟悉亚马逊S3：[https://blog.csdn.net/qq973702/article/details/143648974](https://blog.csdn.net/qq973702/article/details/143648974)
>* 平台使用MinIO SDK驱动亚马逊S3，配置稍微有点复杂，晚点介绍