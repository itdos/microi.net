# 开源低代码平台-Microi吾码-平台简介
>* 技术框架：.NET9 + Redis + MySql/SqlServer/Oracle + Vue2/3 + Element-UI/Element-Plus
>* 平台始于2014年（基于Avalon.js），2018年使用Vue重构，于2024年10月29日开源
>* Vue3试用地址（仅查询）：[https://microi.net](https://microi.net)
>* Vue2传统界面试用地址（可操作数据）：[https://demo.microi.net/](https://demo.microi.net/)
>* Gitee开源地址：[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
>* GitCode开源地址：[https://gitcode.com/microi-net/microi.net/overview](https://gitcode.com/microi-net/microi.net/overview)
>* 官方CSDN博客：[https://microi.blog.csdn.net](https://microi.blog.csdn.net/?type=blog)

# 预览图
<img src="https://static.itdos.com/upload/img/v4.x电脑端首页.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/v4.x接口引擎.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/v4.x流程引擎.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/v4.x表单引擎.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/microi-preview-6.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/microi-preview-7.jpg" width="30%" style="margin: 5px;width:30%;">
<img src="https://static.itdos.com/upload/img/microi-preview-10.jpg" width="30%" style="margin: 5px;width:30%;">
<img src="https://static.itdos.com/upload/img/microi-preview-9.jpg" width="30%" style="margin: 5px;width:30%;">

# 平台亮点
* **无限制**：不限制用户数、表单数、数据量、数据库数量等
* **跨平台**：基于.NET8，支持gRPC以实现跨开发语言通信
* **跨数据库**：支持MySql5.5+、SqlServer2016+、Oracle11g+，支持读写分离/分库分表，可扩展更多数据库类型
* **分布式**：支持分布式部署，支持Docker、K8S、Jenkins、Rancher、CICD
* **分布式缓存**：支持Redis哨兵
* **分布式存储**：[支持阿里云OSS、MinIO、亚马逊S3，可扩展更多存储介质](https://microi.blog.csdn.net/article/details/143763937)
* **集成消息队列（RabbitMQ）、搜索引擎（ES）、MongoDB**
* **界面引擎**：[界面自定义](https://microi.blog.csdn.net/article/details/143972924)
* **打印引擎**：[在线制作打印模板](https://microi.blog.csdn.net/article/details/143973593)
* **SaaS引擎**：三种SAAS模式，支持数据库级别隔离多租户、TenantId租户隔离、独立组织机构数据隔离
* **表单引擎**：[支持扩展组件、支持自定义vue组件嵌入表单、支持二次开发调用表单引擎，支持V8引擎事件，灵活实现复杂业务逻辑](https://microi.blog.csdn.net/article/details/143671179)
* **接口引擎**：[集成Google V8引擎，支持使用JavaScript在线编写后端接口，支持get、post请求，支持响应文件、读取文件等](https://microi.blog.csdn.net/article/details/143968454)
* **模块引擎**：[支持多表关联、查询列、不显示列、统计列、可搜索列、可排序列、动态V8按钮、复杂where条件、接口地址替换、支持多种嵌入模式：iframe、微服务、组件、内置界面模板等](https://microi.blog.csdn.net/article/details/143775484)
* **模板引擎**：表单/表格支持在线html模板渲染
* **数据库管理**：支持一键加载第三方数据库，在接口引擎中访问任意数据库
* **Office引擎**：本地设计office模板，根据模板进行导出、打印
* **工作流引擎v4**：[v1基于微软WWF、v2基于ccflow、v3基于微软最新WWF、v4完全自主研发，由表单引擎、接口引擎驱动](https://microi.blog.csdn.net/article/details/143742635)
* **细粒度权限控制**：细化到每张表、每个字段、每个菜单、每个V8按钮、每个接口的权限控制 
* **单点登录**：支持隐藏左侧、顶部。支持第三方系统单点登录低代码平台、低代码平台单点登录第三方系统。
* **微信公众平台**：多公众号配置（不同集团分公司用户绑定不同公众号发送模板消息）、多小程序配置、模板消息配置
* **移动端（uni-app）**：开放100%源代码，可打包小程序、h5、安卓app、ios
* **报表引擎**：支持虚拟表格、echarts报表，报表支持自定义增删改。
* **微服务**：支持前端微服务（目前vue2基于qiankun，vue3基于MicroApp）
* **任务调度**：自定义定时任务，可执行接口引擎、定制开发dll。
* **聊天系统**：支持在线聊天、消息通知
* **采集引擎**：全能采集引擎，可在接口引擎中采集网页、mvvm渲染前、mvvm渲染后、所有接口请求
* **飞书**：使用接口引擎打通飞书接口，支持消息通知等
* **多语言**：前后端均支持多语言管理，在线配置多语言

# 版本区别
* **开源版**：包含平台90%以上源代码【前后端框架源码、所有插件源码、移动端uniapp源码等】
* **个人版**：额外包含【Web操作系统源码、表单设计器源码、流程设计器源码、聊天系统源码】等，与企业版无任何功能差别
* **企业版**：提供更多的培训、咨询等售后服务，详见：[https://microi.net/microi-price](https://microi.net/microi-price)

# 成功案例
* 2018~2024基于Microi吾码平台已交付的软件100+套，已应用客户300+
* 房地产互联网平台（大量的前后端微服务定制）
* 大型电器ERP（300+表，100+模块）
* 多个服装ERP（100+表，1个人1个月完成）（纯低代码平台实现的服装ERP系统）
* 物联网智能家居（亿级数据量处理）、植物工厂智能硬件控制
* 多套集团、国企OA系统
* 停车场、潮汐检测、固定资产、CRM 等等平台
* 合作大学实训课程
* [100余个案例持续更新中](https://microi.blog.csdn.net/category_12828272.html)

# 源码目录说明
* **Dos.ORM**：数据库组件源码
* **Dos.Common**：常用开发类库源码
* **Microi.net.Api**：.NET8后端api接口系统框架源码
* **Microi.Cache**：后端分布式缓存插件源码
* **Microi.HDFS**：后端分布式存储插件源码
* **Microi.Job**：后端任务调度插件源码
* **Microi.MQ**：后端消息队列插件源码
* **Microi.Office**：后端office相关处理插件源码
* **Microi.ORM**：后端数据库差异化处理源码
* **Microi.SearchEngine**：后端搜索引擎源码
* **Microi.Spider**：后端采集引擎插件源码
* **Microi.V8Engine**：后端V8引擎扩展源码
* **Microi.SystemBase**：后端系统基础管理，将全面被FormEngine表单引擎替换
* **Microi.gRPC.Client**：后端gRPC客户端测试源码
* **Microi.gRPC.Java**：后端gRPC客户端java测试源码
* **Microi.gRPC.Server**：后端gRPC服务端源码
* **microi.vue2.pc**：前端PC传统界面框架源码，vue2 + element-ui + webpack + vuex + node14
* **microi.vue2.qiankun**：基于qiankun的PC前端vue2微服务框架源码
* **microi.vue2.uniapp**：基于uview的vue2移动端版本
* **microi.vue3.os**：前端PC操作系统框架源码（个人版），vue3 + element-plus + vite5 + pinia + node18
* **microi.vue3.os.build**：前端PC操作系统框架（非个人版）
* **microi.vue3.tuniao**：基于图鸟UI的vue3移动端版本源码

# Microi吾码 - 系列文档
>* **平台介绍**：[https://microi.blog.csdn.net/article/details/143414349](https://microi.blog.csdn.net/article/details/143414349)
>* **一键安装使用**：[https://microi.blog.csdn.net/article/details/143832680](https://microi.blog.csdn.net/article/details/143832680)
>* **快速开始使用**：[https://microi.blog.csdn.net/article/details/143607068](https://microi.blog.csdn.net/article/details/143607068)
>* **源码本地运行-后端**：[https://microi.blog.csdn.net/article/details/143567676](https://microi.blog.csdn.net/article/details/143567676)
>* **源码本地运行-前端**：[https://microi.blog.csdn.net/article/details/143581687](https://microi.blog.csdn.net/article/details/143581687)
>* **Docker部署**：[https://microi.blog.csdn.net/article/details/143576299](https://microi.blog.csdn.net/article/details/143576299)
>* **表单引擎**：[https://microi.blog.csdn.net/article/details/143671179](https://microi.blog.csdn.net/article/details/143671179)
>* **模块引擎**：[https://microi.blog.csdn.net/article/details/143775484](https://microi.blog.csdn.net/article/details/143775484)
>* **接口引擎**：[https://microi.blog.csdn.net/article/details/143968454](https://microi.blog.csdn.net/article/details/143968454)
>* **工作流引擎**：[https://microi.blog.csdn.net/article/details/143742635](https://microi.blog.csdn.net/article/details/143742635)
>* **界面引擎**：[https://microi.blog.csdn.net/article/details/143972924](https://microi.blog.csdn.net/article/details/143972924)
>* **打印引擎**：[https://microi.blog.csdn.net/article/details/143973593](https://microi.blog.csdn.net/article/details/143973593)
>* **V8函数列表-前端**：[https://microi.blog.csdn.net/article/details/143623205](https://microi.blog.csdn.net/article/details/143623205)
>* **V8函数列表-后端**：[https://microi.blog.csdn.net/article/details/143623433](https://microi.blog.csdn.net/article/details/143623433)
>* **V8.FormEngine用法**：[https://microi.blog.csdn.net/article/details/143623519](https://microi.blog.csdn.net/article/details/143623519)
>* **Where条件用法**：[https://microi.blog.csdn.net/article/details/143582519](https://microi.blog.csdn.net/article/details/143582519)
>* **DosResult说明**：[https://microi.blog.csdn.net/article/details/143870540](https://microi.blog.csdn.net/article/details/143870540)

>* **分布式存储配置**：[https://microi.blog.csdn.net/article/details/143763937](https://microi.blog.csdn.net/article/details/143763937)
>* **自定义导出Excel**：[https://microi.blog.csdn.net/article/details/143619083](https://microi.blog.csdn.net/article/details/143619083)
>* **表单引擎-定制组件**：[https://microi.blog.csdn.net/article/details/143939702](https://microi.blog.csdn.net/article/details/143939702)
>* **表单控件数据源绑定配置**：[https://microi.blog.csdn.net/article/details/143767223](https://microi.blog.csdn.net/article/details/143767223)
>* **复制表单和模块到其它数据库**：[https://microi.blog.csdn.net/article/details/143950112](https://microi.blog.csdn.net/article/details/143950112)
>* **论传统定制开发与低代码开发的优缺点**：[https://microi.blog.csdn.net/article/details/143866006](https://microi.blog.csdn.net/article/details/143866006)
>* **接口引擎实战-发送第三方短信**：[https://microi.blog.csdn.net/article/details/143990546](https://microi.blog.csdn.net/article/details/143990546)
>* **接口引擎实战-发送阿里云短信**：[https://microi.blog.csdn.net/article/details/143990603](https://microi.blog.csdn.net/article/details/143990603)
>* **开源版、个人版、企业版区别**：[https://microi.blog.csdn.net/article/details/143974752](https://microi.blog.csdn.net/article/details/143974752)
>* **成为合伙人**：[https://microi.blog.csdn.net/article/details/143974715](https://microi.blog.csdn.net/article/details/143974715)

>* **基于Microi的开源项目**：[https://microi.blog.csdn.net/category_12828230.html](https://microi.blog.csdn.net/category_12828230.html)
>* **成功案例**：[https://microi.blog.csdn.net/category_12828272.html](https://microi.blog.csdn.net/category_12828272.html)