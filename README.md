# 开源低代码平台-Microi吾码

## 平台简介
>* 技术框架：.NET9 + Redis + MySql/SqlServer/Oracle + Vue2/3 + Element-UI/Element-Plus
>* 平台始于2014年（基于Avalon.js），2018年使用Vue重构，于2024年10月29日开源
>* 官网：[https://microi.net/](https://microi.net/)
>* WebOS试用地址（仅查询）：[https://webos.microi.net](https://webos.microi.net)
>* 传统界面试用地址（可操作数据）：[https://demo.microi.net/](https://demo.microi.net/)
>* Gitee开源地址：[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
>* GitCode开源地址：[https://gitcode.com/microi-net/microi.net/overview](https://gitcode.com/microi-net/microi.net/overview)
>* 官方CSDN博客：[https://microi.blog.csdn.net](https://microi.blog.csdn.net/?type=blog)
>* 技术CSDN博客：[https://lisaisai.blog.csdn.net/?type=blog](https://lisaisai.blog.csdn.net/?type=blog)

## 预览图
<img src="https://static.itdos.com/upload/img/csdn/ee76765ec943d4da0b6f6097c494d8bc.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/9989ec6bfdcd6c0fead567bd79012bc4.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/13c2c7a5e0329f6821eddd3f12c8536f.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/e7cc9aee7486409a40a4a0b72cf5d916.jpeg" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/e71c4d8a982989c0750dd7be3036bfd4.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/ede3b036e9ebbf6de2772bcb3b062790.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<img src="https://static.itdos.com/upload/img/csdn/23ca5070e927a7a7cc3687221fe483dd.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<img src="https://static.itdos.com/upload/img/csdn/6cf3c31ba0e8da4a124cb1bf8c755b74.jpeg" width="30%" style="margin: 5px;width:30%;float:left;">
<div style="clear:both;"></div>

## 平台亮点
* **无限制**：不限制用户数、表单数、数据量、数据库数量等，前端&移动端100%开源、后端90%以上开源
* **跨平台**：基于.NET8，支持gRPC以实现跨开发语言通信
* **跨数据库**：支持MySql5.5+、SqlServer2016+、Oracle11g+，支持读写分离/分库分表，可扩展更多数据库类型
* **分布式**：支持分布式部署，支持Docker、K8S、Jenkins、Rancher、CICD
* **分布式缓存**：支持Redis哨兵
* **分布式存储**：[支持阿里云OSS、MinIO、亚马逊S3，可扩展更多存储介质](https://microi.blog.csdn.net/article/details/143763937)
* **MQ消息队列（**：集成RabbitMQ
* **IoT物联网MQTT**：集成MQTT服务器，支持485、zigbee、蓝牙、Modbus的物联网设备MQTT网关，接口引擎在线编写业务逻辑代码，使IoT物联网开发效率提升10倍
* **搜索引擎（ES）**：集成ES搜索引擎，轻松实现大型互联网应用的分词搜索
* **MongoDB**：集成MongoDB，接口引擎可直接访问MongoDB，日志系统采用MongoDB，亿级数据量毫秒级分页
* **界面引擎**：[界面自定义](https://microi.blog.csdn.net/article/details/143972924)
* **打印引擎**：[在线制作打印模板](https://microi.blog.csdn.net/article/details/143973593)
* **SaaS引擎**：三种SAAS模式，支持数据库级别隔离多租户、TenantId租户隔离、独立组织机构数据隔离
* **表单引擎**：[支持扩展组件、支持自定义vue组件嵌入表单、支持二次开发调用表单引擎，支持V8引擎事件，灵活实现复杂业务逻辑](https://microi.blog.csdn.net/article/details/143671179)
* **接口引擎**：[集成Google V8引擎，支持使用JavaScript在线编写后端接口，支持get、post请求，支持响应文件、读取文件等](https://microi.blog.csdn.net/article/details/143968454)
* **模块引擎**：[支持多表关联、查询列、不显示列、统计列、可搜索列、可排序列、动态V8按钮、复杂where条件、接口地址替换、支持多种嵌入模式：iframe、微服务、组件、内置界面模板等](https://microi.blog.csdn.net/article/details/143775484)
* **模板引擎**：表单/表格支持在线html模板渲染
* **AI引擎**：集成AI模型（DeepSeek等），实现AI代码检查、生成接口引擎V8代码
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

## 版本区别
>* **开源版**：平台传统界面前端100%完整源码、平台后端90%以上源代码，可商用，随意修改
>* **个人版**：￥999；额外包含【vue3 WebOS操作系统界面100%完整源码】等，功能与企业版无任何差别；开发者license 1个，运行时license不限
>* **企业版**：￥10w（首付￥2.5w）；提供更多的培训、咨询等售后服务；优先响应平台升级需求；开发者license 10个，运行时license不限

## 成功案例
* 2018~2025基于Microi吾码平台已交付的软件200+套，已应用客户500+
* 房地产互联网平台（大量的前后端微服务定制）
* 大型电器ERP（300+表，100+模块）
* 多个服装ERP（100+表，1个人1个月完成）（纯低代码平台实现的服装ERP系统）
* 物联网智能家居（亿级数据量处理）、植物工厂智能硬件控制
* 多套集团、国企OA系统
* 停车场、潮汐检测、固定资产、CRM 等等平台
* 合作大学实训课程
* [100余个案例持续更新中](https://microi.blog.csdn.net/category_12828272.html)

## 源码目录说明
* **microi.doc**：官网源码（官方文档）
* **Microi.Server**：平台后端90%+源码（.net9）
* **microi.uniapp.uni-ui**：平台移动端100%完整源码（uniapp + uni-ui + vue3）
* **microi.web**：平台前端PC传统界面100%完整源码（vue2 + element-ui + webpack + vuex + node14）
* **microi.webos.build**：平台前端PC WebOS 编译后（可部署运行）
* **microi.webos**：【个人版】平台前端PC WebOS 100%完整源码（vue3 + element-plus + vite5 + pinia + node18）

## Microi吾码 - 相关文档
>* **官方文档**：[https://microi.net](https://microi.net)
>* **CSDN平台文档**：[https://blog.csdn.net/qq973702/category_12826294.html](https://blog.csdn.net/qq973702/category_12826294.html)
>* **CSDN成功案例**：[https://blog.csdn.net/qq973702/category_12828272.html](https://blog.csdn.net/qq973702/category_12828272.html)
>* **CSDN基于吾码的开源项目**：[https://blog.csdn.net/qq973702/category_12828230.html](https://blog.csdn.net/qq973702/category_12828230.html)
