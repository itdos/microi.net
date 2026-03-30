# 📂 分布式存储

> 平台分布式存储支持 **阿里云 OSS/CDN**、**MinIO**、**亚马逊 S3**，基于 SaaS 引擎配置，不同租户可使用不同存储方案。

---

## 📖 介绍

| 特性 | 说明 |
|---|---|
| 支持存储 | 阿里云 OSS/CDN、MinIO、亚马逊 S3 |
| 配置驱动 | 基于 SaaS 引擎，不同租户可独立配置 |
| 可扩展 | 由表单引擎驱动，可自由扩展腾讯云、华为云等 |
| 源码位置 | [Microi.HDFS](https://gitee.com/ITdos/microi.net/tree/master/Microi.HDFS) |

---

## ⚙️ 步骤一：指定存储方式

在 **【系统设置】→【开发配置】** 中指定存储方式。系统设置由表单引擎驱动，可在表单设计中自由扩展更多自定义存储方式。

![存储方式配置](https://static.itdos.com/upload/img/csdn/5f7e4c8a6b824c51b1c50de50827abdd.png#pic_center)

---

## ☁️ 阿里云 OSS + CDN

在 **【SaaS 引擎】→【Aliyun】** 处配置相关参数：

![阿里云OSS配置](https://static.itdos.com/upload/img/csdn/dd353af2971c4057b3d47c1f3ad9d81c.png#pic_center)

---

## 📦 MinIO

在 **【SaaS 引擎】→【MinIO】** 处配置相关参数：

> 💡 安装 MinIO 方法见：[Docker 部署文档](https://microi.blog.csdn.net/article/details/143576299)

![MinIO配置](https://static.itdos.com/upload/img/csdn/0bde20907de743f5b051036546837afa.png#pic_center)

---

## 🌍 亚马逊 S3

> 📌 首先请熟悉亚马逊 S3：[亚马逊 S3 入门](https://blog.csdn.net/qq973702/article/details/143648974)

平台使用 MinIO SDK 驱动亚马逊 S3，后续将补充详细配置说明。