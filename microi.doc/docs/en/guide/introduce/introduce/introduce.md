<!-- 介绍 -->

IntroductionPlatform Profile🏅[Microi Code](https://gitee.com/ITdos/microi.net) is an open source low-code platform for developers, which aims to help developers and enterprises quickly build efficient and flexible applications by simplifying the development process and improving development efficiency. It integrates powerful interface engine, print engine and other functions, and provides three versions of open source version, personal version and enterprise version to meet the needs of different user groups.



- 技术框架：.NET9 + Redis + MySql/SqlServer/Oracle + Vue2/3 + Element-UI/Element-Plus
- 平台始于2014年（基于Avalon.js），2018年使用Vue重构，于2024年10月29日开源
- Vue3试用地址（仅查询）：https://microi.net
- Vue2传统界面试用地址（可操作数据）：https://demo.microi.net/
- Gitee开源地址：https://gitee.com/ITdos/microi.net
- GitCode开源地址：https://gitcode.com/microi-net/microi.net/overview
- 官方CSDN博客：https://microi.blog.csdn.net
- 技术CSDN博客：https://lisaisai.blog.csdn.net/?type=blog

---

::: tip Warm Tips🎯
At present, the front and back ends of the Vue2 version are completely open source, and the Vue3 version is under development and is expected to be released in October 2025.
:::

Featured plug-in (pluggable)🧩---

- 界面设计引擎：https://www.nbweixin.cn/autopage/
- 动态打印引擎：https://www.nbweixin.cn/autoprint/
- 在线Office：[https://www.nbweixin.cn/autopage/weboffice?path=https://www.nbweixin.cn/autopage/附录A-4 立项评审报告.doc](https://www.nbweixin.cn/autopage/weboffice?path=https://www.nbweixin.cn/autopage/%E9%99%84%E5%BD%95A-4%20%E7%AB%8B%E9%A1%B9%E8%AF%84%E5%AE%A1%E6%8A%A5%E5%91%8A.doc)


::: info Warm Tips
Online office office: just pass the document address to the weboffice
:::```html
<iframe src="https://www.nbweixin.cn/autopage/weboffice?path=你的文档地址" width="100%" height="1000px"></iframe>

```


- 吾码·吾聊（体验测试版）：http://118.31.116.82

! [My Code-My Chat](/chat.jpg){width = 150px;height = 150px;}

::: info Warm Tips
At present, only H5 terminal is supported, which can be embedded into any web page and supports mobile terminal and PC terminal.

- 打开浏览器输入http://118.31.116.82，F12切换移动端浏览模式。
- 使用微信扫码体验。


:::

- 更多特色功能：请自行探索体验...

System features💎Platform Highlights- **无限制** ：不限制用户数、表单数、数据量、数据库数量等
- **跨平台** ：基于 `.NET9`，支持 `gRPC` 以实现跨开发语言通信
- **跨数据库** ：支持 `MySql5.5+、SqlServer2016+、Oracle11g+`，支持读写分离/分库分表，可扩展更多数据库类型
- **分布式** ：支持分布式部署，支持 `Docker、K8S、Jenkins、Rancher、CICD`
- **分布式缓存** ：支持 `Redis` 哨兵
- **分布式存储** ：支持阿里云 `OSS`、`MinIO`、`亚马逊S3`，可扩展更多存储介质
- **搜索引擎**：集成消息队列（`RabbitMQ`）、搜索引擎（`ES`）、`MongoDB`
- **界面引擎** ：界面自定义,随心所欲设计精美页面
- **打印引擎** ：在线制作打印模板，强大无匹
- **SaaS引擎** ：三种 `SAAS` 模式，支持数据库级别隔离多租户、`TenantId` 租户隔离、独立组织机构数据隔离
- **表单引擎** ：支持扩展组件、支持自定义 `vue` 组件嵌入表单、支持二次开发调用表单引擎，支持 `V8` 引擎事件，灵活实现复杂业务逻辑
- **接口引擎** ：集成 `Google V8` 引擎，支持使用 `JavaScript` 在线编写后端接口，支持 `get`、`post`请求，支持响应文件、读取文件等
- **模块引擎** ：支持多表关联、查询列、不显示列、统计列、可搜索列、可排序列、动态V8按钮、复杂 `where` 条件、接口地址替换、支持多种嵌入模式：`iframe`、微服务、组件、内置界面模板等
- **模板引擎** ：表单/表格支持在线 `html` 模板渲染
- **数据库管理** ：支持一键加载第三方数据库，在接口引擎中访问任意数据库
- **Office引擎** ：本地设计 `office` 模板，根据模板进行导出、打印
- **工作流引擎v4** ：v1基于微软 `WWF`、v2基于 `ccflow` 、v3基于微软最新 `WWF` 、v4完全自主研发，由表单引擎、接口引擎驱动
- **细粒度权限控制** ：细化到每张表、每个字段、每个菜单、每个V8按钮、每个接口的权限控制
- **单点登录** ：支持隐藏左侧、顶部。支持第三方系统单点登录低代码平台、低代码平台单点登录第三方系统。
- **微信公众平台** ：多公众号配置（不同集团分公司用户绑定不同公众号发送模板消息）、多小程序配置、模板消息配置
- **移动端（uni-app）** ：开放 `100%` 源代码，可打包 `小程序`、`h5`、`安卓app`、`ios app`
- **报表引擎** ：支持虚拟表格、`echarts`报表，报表支持自定义增删改。
- **微服务** ：支持前端微服务（目前 `vue2` 基于 `qiankun`，`vue3` 基于 `MicroApp` ）
- **任务调度** ：自定义定时任务，可执行接口引擎、定制开发 `dll`。
- **聊天系统** ：支持在线聊天、消息通知
- **采集引擎** ：全能采集引擎，可在接口引擎中采集网页、`mvvm` 渲染前、 `mvvm` 渲染后、所有接口请求
- **飞书** ：使用接口引擎打通飞书接口，支持消息通知等
- **多语言** ：前后端均支持多语言管理，在线配置多语言
 

PC-side UI preview! [v4.x PC-side homepage. jpeg](https://static.itdos.com/upload/img/v4.x电脑端首页.jpeg)

! [v4.x Interface Engine.jpeg](https://static.itdos.com/upload/img/v4.x接口引擎.jpeg)

! [v4.x Process Engine.jpeg](https://static.itdos.com/upload/img/v4.x流程引擎.jpeg)

! [v4.x Form Engine.jpeg](https://static.itdos.com/upload/img/v4.x表单引擎.jpeg)

! [microi-preview-6.png](https://static.itdos.com/upload/img/microi-preview-6.png)

 
Mobile UI preview! [microi-preview-7.jpg](https://static.itdos.com/upload/img/microi-preview-7.jpg)

! [microi-preview-10.jpg](https://static.itdos.com/upload/img/microi-preview-10.jpg)

! [microi-preview-9.jpg](https://static.itdos.com/upload/img/microi-preview-9.jpg)



