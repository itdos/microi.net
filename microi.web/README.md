## Microi 吾码 - 低代码平台

- Vue3 在线试用地址：[https://microi.net](https://microi.net)
- Vue2 传统界面试用地址 1（仅查询）[https://os.itdos.com](https://os.itdos.com)
- Vue2 传统界面试用地址 2（可操作数据）[https://demo.microi.net/](https://demo.microi.net/)
- 平台始于 2014 年（基于 Avalon.js），2018 年使用 Vue2 重构，持续更新至今，曾融资过 1000 万，研发团队高峰时 30+人
- 平台于 2024 年 10 月 29 日开源，技术框架：.NET8 + Redis + MySql/SqlServer/Oracle + Vue2/3 + Element-UI/Element-Plus
- Gitee 开源地址：[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
- GitCode 开源地址：[https://gitcode.com/microi-net/microi.net/overview](https://gitcode.com/microi-net/microi.net/overview)
- 平台文档：[https://microi.net/diy-document-index](https://microi.net/diy-document-index)
- 平台 PPT：[在线查看](https://microi.net/iframe/https%3A%2F%2Fstatic.itdos.com%2Fitdos%2Ffile%2F20241021%2FMicroi%25E5%2590%25BE%25E7%25A0%2581-PPT-2023-12-28-1729502598.pdf)
- 更新日志：[https://microi.net/microi-upt-log-index](https://microi.net/microi-upt-log-index)
- 开源版：包含平台 90%源代码【前后端框架源码、所有插件源码、移动端 uniapp 源码等】，方便二次开发，几乎无任何限制（可以设计流程，但无法发起工作流程）
- 个人版：额外包含【Web 操作系统源码、流程设计器源码、聊天系统源码】，与企业版无任何功能差别
- 企业版：提供更多的培训、咨询等售后服务，详见：[https://microi.net/microi-price](https://microi.net/microi-price)

## 预览图

<img src="https://static.itdos.com/upload/img/v4.x电脑端首页.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/v4.x接口引擎.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/v4.x流程引擎.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/v4.x表单引擎.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/microi-preview-6.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/microi-preview-7.jpg" width="30%" style="margin: 5px;width:30%;">
<img src="https://static.itdos.com/upload/img/microi-preview-10.jpg" width="30%" style="margin: 5px;width:30%;">
<img src="https://static.itdos.com/upload/img/microi-preview-9.jpg" width="30%" style="margin: 5px;width:30%;">

## 平台亮点

- 无限制：不限制用户数、表单数、数据量、数据库数量等
- 跨平台：基于.NET8，支持 gRPC 以实现跨开发语言通信
- 跨数据库：支持 MySql5.5+、SqlServer2016+、Oracle11g+，支持读写分离/分库分表，可扩展更多数据库类型
- 分布式：支持分布式部署，支持 Docker、K8S、Jenkins、Rancher、CICD
- 分布式缓存：支持 Redis 哨兵
- 分布式存储：支持阿里云 OSS、MinIO、亚马逊 S3，可扩展更多存储介质。
- 集成消息队列（RabbitMQ）、搜索引擎（ES）、MongoDB
- 界面引擎：界面自定义。试用地址：[点击试用](https://microi.net/iframe/https%3A%2F%2Fpage-engine.microi.net)
- SaaS 引擎：三种 SAAS 模式，支持数据库级别隔离多租户、TenantId 租户隔离、独立组织机构数据隔离
- 表单引擎：支持扩展组件、支持自定义 vue 组件嵌入表单、支持二次开发调用表单引擎，支持 V8 引擎事件，灵活实现复杂业务逻辑
- 接口引擎：集成 Google V8 引擎，支持使用 JavaScript 在线编写后端接口，支持 get、post 请求，支持响应文件、读取文件等
- 模块引擎：支持多表关联、查询列、不显示列、统计列、可搜索列、可排序列、动态 V8 按钮、复杂 where 条件、接口地址替换、支持多种嵌入模式：iframe、微服务、组件、内置界面模板等
- 模板引擎：表单/表格支持在线 html 模板渲染
- 数据库管理：支持一键加载第三方数据库，在接口引擎中访问任意数据库
- Office 引擎：本地设计 office 模板，根据模板进行导出、打印
- 工作流引擎 v4：v1 基于微软 WWF、v2 基于 ccflow、v3 基于微软最新 WWF、v4 完全自主研发，由表单引擎、接口引擎驱动
- 细粒度权限控制：细化到每张表、每个字段、每个菜单、每个 V8 按钮、每个接口的权限控制
- 单点登陆：支持隐藏左侧、顶部。支持第三方系统单点登陆低代码平台、低代码平台单点登陆第三方系统。
- 微信公众平台：多公众号配置（不同集团分公司用户绑定不同公众号发送模板消息）、多小程序配置、模板消息配置
- 移动端（uni-app）：开放 100%源代码，可打包小程序、h5、安卓 app、ios
- 报表引擎：支持虚拟表格、echarts 报表，报表支持自定义增删改。
- 微服务：支持前端微服务（目前 vue2 基于 qiankun，vue3 基于 MicroApp）
- 任务调度：自定义定时任务，可执行接口引擎、定制开发 dll。
- 聊天系统：支持在线聊天、消息通知
- 采集引擎：全能采集引擎，可在接口引擎中采集网页、mvvm 渲染前、mvvm 渲染后、所有接口请求
- 飞书：使用接口引擎打通飞书接口，支持消息通知等
- 多语言：前后端均支持多语言管理，在线配置多语言

## 成功案例

- 2018~2024 基于 Microi 吾码平台已交付的软件 100+套，已应用客户 200+，正在整理 dmeo 试用列表
- 房地产互联网平台（仿贝壳）（大量的前端微服务定制）
- 大型电器 ERP（300+表，100+模块）
- 多个服装 ERP（100+表，1 个人 1 个月完成）（纯低代码平台实现的服装 ERP 系统）
- 物联网智能家居（亿级数据量处理）、植物工厂智能硬件控制
- 多套集团、国企 OA 系统
- 停车场、潮汐检测、固定资产、CRM 等等平台
- 合作大学实训课程
- 100 余个案例在线 demo 正在整理中

## 源码目录说明

- Dos.ORM：数据库组件源码
- Dos.ORM.MySql：数据库组件 mysql 插件源码
- Dos.ORM.NoSql：数据库组件 nosql 插件源码
- Dos.ORM.Oracle：数据库组件 oracle 插件源码
- Dos.Common：常用开发类库源码
- Microi.net.Api：.NET8 后端框架源码，提供 api 接口
- Microi.Cache：后端分布式缓存插件源码
- Microi.Captcha：后端验证码组件插件源码
- Microi.gRPC.Client：后端 gRPC 客户端测试源码
- Microi.gRPC.Java：后端 gRPC 客户端 java 测试源码
- Microi.gRPC.Server：后端 gRPC 服务端源码
- Microi.HDFS：后端分布式存储插件源码
- Microi.Job：后端任务调度插件源码
- Microi.Model：后端实体类源码
- Microi.MQ：后端消息队列插件源码
- Microi.net 前端扩展：PC 前端 vue2 框架源码需要用到的扩展
- Microi.Office：后端 office 相关处理插件源码
- Microi.ORM：后端数据库差异化处理源码
- Microi.SearchEngine：后端搜索引擎源码
- Microi.Spider：后端采集引擎插件源码
- Microi.WeChat：后端微信插件源码
- Microi.SystemBase：后端系统基础管理，将会被 FormEngine 表单引擎全面替换后而废弃
- lib：后端需要用到的 dll 引用
- microi.vue2.pc：前端 PC 传统界面框架源码，element-ui + webpack + vuex + node14
- microi.vue2.qiankun：基于 qiankun 的 PC 前端 vue2 微服务框架源码
- microi.vue2.uniapp：基于 uview 的 vue2 移动端版本（已停更）
- microi.vue3.os：前端 PC 操作系统框架源码（个人版），element-plus + vite5 + pinia + node18
- microi.vue3.os.build：前端 PC 操作系统框架（免费开源版）
- microi.vue3.tuniao：基于图鸟 UI 的 vue3 移动端版本源码
- microi.vue3.uni-ui：基于 uni-ui 的 vue3 移动端版本（暂未开源）
- npm 组件发布-dos.fontawesome：已将源码集成到 microi.vue2.pc，无需再使用
- npm 组件发布-microi.services：已将源码集成到 microi.vue2.qiankun，无需再使用
- 本地编程建议使用 vs code（后端.NET8 也是一样），需安装 C#、C# Dev Kit、.NET Install Tool 插件

# 感谢浏览

- 大型互联网应用、定制软件开发、智能硬件、跨行业通用软件产品
- “做一单生意，交一个朋友” ：）
