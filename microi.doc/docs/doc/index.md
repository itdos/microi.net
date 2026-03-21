# 🚀 开源 AI 低代码平台 - Microi吾码

> **低代码 + AI 开发模式，支持传统开发**
>
> .NET10 + Vue3 + Redis + 跨数据库 + Element-Plus · 平台始于 2014 年，2024 年 11 月正式开源

---

## 📖 平台简介

**Microi吾码** 是一款面向开发者的开源 AI 低代码平台，采用 **低代码 + AI** 双驱动开发模式，同时完美支持传统开发。平台始于 2014 年（基于 Avalon.js），2018 年使用 Vue 重构，历经多年打磨，于 **2024 年 11 月正式开源**。

强大的 [**API 接口引擎**](/doc/v8-engine/api-engine)，在线使用 JavaScript 编写后端 API 接口，支持在线 [**AI 编程**](/doc/v8-engine/ai-apiengine)，极致的性能与开发效率，无需编译发布，保存即生效。

| 资源 | 地址 |
|---|---|
| 🌐 官方文档 | [https://microi.net](https://microi.net) |
| 🦞 OpenClaw 吾码小龙虾 | [https://gitee.com/microi-net/microi.openclaw](https://gitee.com/microi-net/microi.openclaw) |
| 🖥️ 在线试用 | [https://web.microi.net](https://web.microi.net) |
| 📦 Gitee 源码 | [https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net) |
| 📦 GitCode 源码 | [https://gitcode.com/microi-net/microi.net/overview](https://gitcode.com/microi-net/microi.net/overview) |
| 📝 官方 CSDN 博客 | [https://microi.blog.csdn.net](https://microi.blog.csdn.net/?type=blog) |
| 📝 技术 CSDN 博客 | [https://lisaisai.blog.csdn.net](https://lisaisai.blog.csdn.net/?type=blog) |

---

## 📸 预览图

<img src="https://static.itdos.com/upload/img/csdn/ee76765ec943d4da0b6f6097c494d8bc.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/microi-apiengine-20260208.jpg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/9989ec6bfdcd6c0fead567bd79012bc4.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/V8引擎本地AI编程连接配置.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/V8引擎本地AI编程运行调试.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/13c2c7a5e0329f6821eddd3f12c8536f.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/表单引擎.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/界面引擎.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/数据大屏.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/打印引擎.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/AI数据分析.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/应用商城.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/ede3b036e9ebbf6de2772bcb3b062790.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<img src="https://static.itdos.com/upload/img/csdn/23ca5070e927a7a7cc3687221fe483dd.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<img src="https://static.itdos.com/upload/img/csdn/6cf3c31ba0e8da4a124cb1bf8c755b74.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<div style="clear:both;"></div>

---

## ✨ 平台亮点

### 🔗 核心引擎

| 引擎 | 说明 |
|---|---|
| 🔗 **[接口引擎](/doc/v8-engine/api-engine)** | 集成 Google V8 引擎，在线使用 JavaScript 编写后端接口，支持 Get/Post，支持返回 JSON、文件、HTML 等 |
| 📝 **[表单引擎](/doc/form-engine/form-engine-info)** | 支持扩展组件、自定义 Vue 组件嵌入表单、V8 引擎事件，灵活实现复杂业务逻辑 |
| 📦 **[模块引擎](/doc/system-engine/module-engine)** | 多表关联、查询列、统计列、动态 V8 按钮、复杂 Where 条件、多种嵌入模式 |
| 🔄 **[工作流引擎 v4](/doc/system-engine/wf-engine)** | 完全自主研发，由表单引擎 + 接口引擎驱动 |
| 🤖 **[AI 引擎](/doc/system-engine/ai-engine)** | 集成 DeepSeek 等 AI 模型，AI 代码检查、AI 在线/本地编程、自然语言转 SQL |
| 🎨 **[界面引擎](/doc/system-engine/page-engine)** | 可视化界面自定义设计，支持 ECharts 图表 |
| 🖨️ **[打印引擎](/doc/system-engine/print-engine)** | 在线制作打印模板，无需导出即可打印 |
| 📊 **[报表引擎](/doc/system-engine/report-engine)** | 虚拟表格、ECharts 报表，支持自定义增删改 |
| ☁️ **[SaaS 引擎](/doc/system-engine/saas-engine)** | 三种模式：数据库隔离多租户、TenantId 租户隔离、独立组织机构隔离 |

### 🏗️ 基础架构

| 能力 | 说明 |
|---|---|
| ♾️ **无限制** | 不限制用户数、表单数、数据量、数据库数量，前端 & 移动端 100% 开源，后端 99% 开源 |
| 🌐 **跨平台** | 基于 .NET10，[核心库采用 .Net Standard 开发](https://www.nuget.org/packages/Microi.net#versions-body-tab)，支持 gRPC 跨语言通信 |
| 🗄️ **跨数据库** | MySql 5.5+ / SqlServer 2016+ / Oracle 11g+，支持读写分离 / 分库分表 |
| ☁️ **分布式部署** | Docker / K8S / Jenkins / Rancher / CI/CD |
| 💾 **分布式缓存** | Redis 哨兵模式 |
| 📂 **[分布式存储](/doc/hdfs)** | 阿里云 OSS / MinIO / 亚马逊 S3，可扩展更多存储介质 |
| 📨 **[消息队列](/doc/system-engine/mq)** | RabbitMQ 集成 |
| 📡 **[IoT 物联网 MQTT](/doc/system-engine/mqtt-engine)** | 集成 MQTT 服务器，支持 485 / ZigBee / 蓝牙 / Modbus 网关 |
| 🔍 **[搜索引擎](/doc/system-engine/search-engine)** | ElasticSearch 分词搜索 |
| 🍃 **MongoDB** | 日志系统，亿级数据量毫秒级分页 |

### 🧩 更多能力

| 能力 | 说明 |
|---|---|
| 📄 **模板引擎** | 表单/表格支持在线 HTML 模板渲染 |
| 📂 **[数据库管理](/doc/system-engine/databases)** | 一键加载第三方数据库，接口引擎中访问任意数据库 |
| 📑 **[Office 引擎](/doc/office)** | 集成 OnlyOffice，本地设计模板，导出/打印 |
| 🔐 **细粒度权限** | 精确到每张表、每个字段、每个菜单、每个按钮、每个接口 |
| 🔑 **单点登录** | 支持第三方系统 ↔ 低代码平台双向单点登录 |
| 💬 **微信公众平台** | 多公众号 / 多小程序配置、模板消息 |
| 📱 **移动端 (UniApp)** | 100% 开源，支持小程序 / H5 / Android / iOS |
| 🧩 **微服务** | Vue2 基于 Qiankun，Vue3 基于 MicroApp |
| ⏱️ **[任务调度](/doc/system-engine/job)** | 定时执行接口引擎或定制 DLL |
| 💬 **聊天系统** | 自研在线聊天 + 腾讯 IM 集成 |
| 🕷️ **采集引擎** | 网页采集、MVVM 渲染前后、接口请求全覆盖 |
| 🌍 **[多语言](/doc/system-engine/translate-engine)** | 前后端多语言管理，在线配置 |
| 📊 **goView 数据大屏** | [集成 goView](https://lisaisai.blog.csdn.net/article/details/149858192?spm=1001.2014.3001.5502)，快速实现数据可视化 |
| 🧊 **WebGL 3D 渲染器** | 基于 Three.js，支持 .gltf / .obj / .glb / .fbx / .stl 格式 |
| 💬 **腾讯 IM** | 快速集成社交聊天、客服会话、直播弹幕 |

---

## 💰 开源版、个人版、企业版区别

| 版本 | 价格 | 说明 |
|---|---|---|
| **开源版** | 免费 | PC 传统界面 100% 源码、移动端 100% 源码、后端 99% 源码；可商用、随意修改、无限分发部署。**仅无法使用在线 AI 相关功能** |
| **个人版** | ￥999 | 额外包含 **WebOS 100% 完整源码**，功能、开源程度与企业版完全一致，**无任何限制、无限分发部署** |
| **企业版** | ￥10w（首付 ￥2.5w） | 提供更多培训、咨询等售后服务，**优先响应平台升级需求** |

---

## 🏆 成功案例

> 2018~2025 基于 Microi吾码平台已交付软件 **200+ 套**，已应用客户 **500+**

| 行业 | 案例 |
|---|---|
| 🏠 房地产 | 互联网平台（大量前后端微服务定制） |
| 🏭 制造业 | 大型 MES（500+ 表，500+ 接口引擎）、大型电器 ERP（300+ 表，100+ 模块） |
| 👔 服装业 | 多个服装 ERP（100+ 表，1 人 1 月完成），纯低代码实现 |
| 📡 IoT | 物联网智能家居（亿级数据量）、植物工厂智能硬件控制 |
| 🏢 政企 | 多套集团、国企 OA 系统 |
| 🎓 教育 | 合作大学实训课程 |
| 📦 其他 | 停车场、潮汐检测、固定资产、CRM 等 |

> 📌 [100 余个案例持续更新中](https://microi.blog.csdn.net/category_12828272.html)

---

## 📂 源码目录说明

```
Microi.net/
├── Microi.Server/     # 🔧 后端 99% 源码（.NET10，自 2014 年一路升级）
├── microi.web/        # 🖥️ PC 传统界面 100% 源码（Vue3 + Element-Plus + Vite + Pinia）
├── microi.uniapp/     # 📱 UniApp 移动端 100% 源码（小程序 / H5 / App）
└── microi.doc/        # 📝 官方文档（基于 VitePress）
```

---

## 📚 相关文档

| 资源 | 地址 |
|---|---|
| 📖 官方文档 | [https://microi.net](https://microi.net) |
| 📝 CSDN 平台文档 | [https://blog.csdn.net/qq973702/category_12826294.html](https://blog.csdn.net/qq973702/category_12826294.html) |
| 🏆 CSDN 成功案例 | [https://blog.csdn.net/qq973702/category_12828272.html](https://blog.csdn.net/qq973702/category_12828272.html) |
| 🔗 CSDN 基于吾码的开源项目 | [https://blog.csdn.net/qq973702/category_12828230.html](https://blog.csdn.net/qq973702/category_12828230.html) |
---

## 💬 加入交流群

欢迎加入官方 QQ 交流群，与开发团队和社区成员实时交流，获取最新资讯、答疑解惑、共同成长：

<p align="center">
  <a href="https://qun.qq.com/universal-share/share?ac=1&authKey=kV1duuyq6mvmOdBZHXuwrOAXxmYjdg4ga33HKNefIfjCv4dsPRpi7BbDeS8rPCCd&busi_data=eyJncm91cENvZGUiOiI1MTA1MDA1NSIsInRva2VuIjoiMk52UzB6aWNYdnhJb3pVODdDbmVFQWZLeFhCSEltbkcrcWczcVBSVEFKTjJONlVQcXZvbDQzakhrR01IUEFEZiIsInVpbiI6Ijk3MzcwMiJ9&data=gr7BMtLgNqPpYNpN7ChH4JwREChPjZHlxLGlGm81aCsONvAFCIM3K60QG2l1WZtJQEZghRjFYRlCDHPSUPzkDQ&svctype=4&tempid=h5_group_info" target="_blank">
    <img src="https://img.shields.io/badge/QQ%20交流群-51050055-12B7F5?style=for-the-badge&logo=tencentqq&logoColor=white" alt="点击加入 QQ 交流群" />
  </a>
</p>

<p align="center">
  <a href="https://qun.qq.com/universal-share/share?ac=1&authKey=kV1duuyq6mvmOdBZHXuwrOAXxmYjdg4ga33HKNefIfjCv4dsPRpi7BbDeS8rPCCd&busi_data=eyJncm91cENvZGUiOiI1MTA1MDA1NSIsInRva2VuIjoiMk52UzB6aWNYdnhJb3pVODdDbmVFQWZLeFhCSEltbkcrcWczcVBSVEFKTjJONlVQcXZvbDQzakhrR01IUEFEZiIsInVpbiI6Ijk3MzcwMiJ9&data=gr7BMtLgNqPpYNpN7ChH4JwREChPjZHlxLGlGm81aCsONvAFCIM3K60QG2l1WZtJQEZghRjFYRlCDHPSUPzkDQ&svctype=4&tempid=h5_group_info" target="_blank">
    <img src="https://static.itdos.com/openclaw/preview/qq-qun2.jpg" alt="扫码加入 QQ 交流群" style="max-width: 260px; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.18);" />
  </a>
</p>

<p align="center">📌 群号：<b>51050055</b> &nbsp;·&nbsp; 点击徽章或扫描二维码即可加入</p>
