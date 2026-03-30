# 📂Distributed storage

> Platform distributed storage supports **Alibaba Cloud OSS/CDN**, **MinIO**, and **Amazon S3**. Based on the SaaS engine configuration, different tenants can use different storage solutions.

---

## 📖Introduction

| Features | Explanation |
|---|---|
| Support storage | Alibaba Cloud OSS/CDN, MinIO, Amazon S3 |
| Configuration-driven | Based on SaaS engine, different tenants can be configured independently |
| Scalable | Driven by the form engine, it can freely expand Tencent Cloud, Huawei Cloud, etc. |
| Source code location | [Microi.HDFS](https://gitee.com/ITdos/microi.net/tree/master/Microi.HDFS) |

---

## ⚙Step 1: Specify the storage method

Specify the storage method in **[System Settings] → [Development Configuration]**. The system settings are driven by the form engine, and you can freely expand more custom storage methods in the form design.

![存储方式配置](https://static.itdos.com/upload/img/csdn/5f7e4c8a6b824c51b1c50de50827abdd.png#pic_center)

---

## ☁Alibaba Cloud OSS CDN

Configure related parameters in **[SaaS Engine] → [Aliyun]**:

![阿里云OSS配置](https://static.itdos.com/upload/img/csdn/dd353af2971c4057b3d47c1f3ad9d81c.png#pic_center)

---

## 📦MinIO

Configure relevant parameters in **[SaaS Engine] → [MinIO]**:

>💡See [Docker deployment documentation] for how to install MinIO (https://microi.blog.csdn.net/article/details/143576299)

![MinIO配置](https://static.itdos.com/upload/img/csdn/0bde20907de743f5b051036546837afa.png#pic_center)

---

## 🌍Amazon S3

>📌First familiarize yourself with Amazon S3:[Getting Started with Amazon S3](https://blog.csdn.net/qq973702/article/details/143648974)

The platform uses the MinIO SDK to drive Amazon S3, and detailed configuration instructions will be added later.