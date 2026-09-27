# 企业 AI 开发系列教程

从系统架构师的视角理解企业软件，再让 WorkBuddy、Codex、DeepSeek Harness 基于成熟引擎完成开发。本系列围绕真实业务问题，解释每一种引擎的职责、关键配置与验收方法。

::: tip 阅读路线
先读第 01 篇建立整体架构视角，再读第 02 篇理解最常用的表单能力，接着认识模块引擎与接口引擎。后续计划用 30 多篇文章逐一介绍各类系统引擎。
:::


## 01 · 先从系统架构师的角度思考

![01 · 先从系统架构师的角度思考的AI概念封面](https://static.itdos.com/itdos/promotion/2026/09/26/enterprise-ai-series-01/20260926/01M3ENM49ZPNPPXBB78V1H4YD6-01-cover.jpg)

**企业使用WorkBuddy/Codex/DeepSeek Harness的正确姿势系列AI教程-01**

从采购业务出发，梳理 AI 客户端、MCP、Skills、应用引擎和基础设施的分工。八组架构问题帮助团队判断系统边界，再认识后续系列的引擎路线。

[阅读全文 · CSDN](https://blog.csdn.net/qq973702/article/details/166691728)

::: details 查看完整副标题
使用AI开发软件不是拿到需求文档后直接丢给AI从0开始开发，而应该先从系统架构师的角度去思考，你的软件是否是一个分布式、高性能、跨平台、跨数据库的系统架构，是否支持MCP、表单自定义、模块自定义、动态接口、打印引擎、报表引擎、工作流引擎、SaaS引擎、微服务、应用商城、AI数据分析、AI平台治理、分布式缓存、分布式存储、搜索引擎、任务调度、MQ消息队列、MQTT IoT物联网、消息通知、OCR、视觉引擎、Office在线编辑、多语言翻译、系统日志/监控、SSO、3D、小程序/APP/移动端等等，接下来会分享30+篇系列文章，逐一介绍每一种系统引擎的重要性
:::


## 02 · 表单引擎：从控件到业务闭环

![02 · 表单引擎：从控件到业务闭环的AI概念封面](https://static.itdos.com/itdos/promotion/2026/09/26/enterprise-ai-series-02/20260926/01M3ENN0X36TAK38MXF7JD5QQS-01-cover.jpg)

**企业使用WorkBuddy/Codex/DeepSeek Harness的正确姿势系列AI教程-02-表单引擎**

面向 ERP、MES、OA 中大量重复使用的表单，介绍当前 44 类控件、表单级属性、字段通用属性及控件个性化配置，串起数据、附件、关系、权限与事件。

[阅读全文 · CSDN](https://blog.csdn.net/qq973702/article/details/166691729)

::: details 查看完整副标题
企业应用软件最常用的功能之一是表单。一套大型ERP、MES、OA系统，可能包含上千张表单、数万个字段，以及被反复复用的控件和定制组件。真正的挑战，是让这些表单的数据、布局、校验、权限、附件、关联关系和业务事件长期保持一致。本篇从吾码当前44类控件出发，完整拆解表单属性与控件个性化配置，讲清如何让WorkBuddy、Codex、DeepSeek Harness基于成熟表单引擎开发企业软件。
:::


## 03 · 模块引擎：把业务表变成企业模块

![03 · 模块引擎的 AI 概念封面](https://static.itdos.com/itdos/promotion/2026/09/27/企业ai开发教程03-模块引擎/202609/企业ai开发教程03-模块引擎-690fbc12b6c9-03-cover.png)

**企业使用WorkBuddy/Codex/DeepSeek Harness的正确姿势系列AI教程-03-模块引擎**

一张采购申请表，面对采购员、主管、财务和移动端，需要不同的入口、查询范围、列表、操作与统计。本文拆解六种菜单打开方式、字段映射、跨端视图、PageTabs、按钮、指标角标与服务端授权。

[阅读全文 · CSDN](https://blog.csdn.net/qq973702/article/details/166735957)

::: details 查看完整副标题
AI 能很快写出一个列表页，企业真正需要的却是同一份业务数据在不同菜单、角色和终端下，都有正确的查询、列、按钮、统计、权限与操作路径。吾码模块引擎以 sys_menu 为配置中心，把数据表变成可交付、可治理的业务模块。本文完整拆解菜单打开方式、列表与搜索、动态按钮、跨端视图、指标角标、PageTabs、接口替换和验收方法，教你让 WorkBuddy、Codex、DeepSeek Harness 在现成引擎上做业务设计。
:::


## 04 · 接口引擎：把业务规则放进可信 API

![04 · 接口引擎的 AI 概念封面](https://static.itdos.com/itdos/promotion/2026/09/27/企业ai开发教程04-接口引擎/202609/企业ai开发教程04-接口引擎-4eaa87fab880-04-cover.png)

**企业使用WorkBuddy/Codex/DeepSeek Harness的正确姿势系列AI教程-04-接口引擎**

一个“审批通过”接口涉及身份、状态、并发、事务和通知。本文介绍接口引擎的路由与调用配置、V8 业务编排、文件与流响应、分布式锁、限流、幂等、后台任务和跨系统集成。

[阅读全文 · CSDN](https://blog.csdn.net/qq973702/article/details/166736011)

::: details 查看完整副标题
AI 能快速写一个 HTTP 接口，但企业系统需要稳定的租户身份、权限、事务、路由、限流、幂等、日志与集成边界。吾码接口引擎让 WorkBuddy、Codex、DeepSeek Harness 在可配置的 V8 运行环境中编排业务：既能调用表单、数据库、缓存、HTTP、MQ、文件和 AI 等能力，也能配置匿名、内部调用、分布式锁、流式响应与可靠后台任务。本文从一个采购审批接口出发，完整讲清能力、配置、代码模式和验收。
:::


## 配合官方文档学习

- [表单引擎概述](/doc/form-engine/form-engine-info)：认识表单定义与运行方式。
- [表单控件](/doc/form-engine/all-form-component)：按业务需要查找控件。
- [模块引擎](/doc/system-engine/module-engine)：了解菜单、列表、按钮、页签、权限与跨端视图。
- [接口引擎](/doc/v8-engine/api-engine)：了解动态路由、V8 编排、事务与响应配置。
- [前端 V8](/doc/v8-engine/v8-client)：了解界面交互与客户端事件。
- [后端 V8](/doc/v8-engine/v8-server)：了解服务端能力、数据操作与可信业务校验。

文章以写作时核对的源码、官方资料和元数据为依据。实际可用项仍取决于项目版本、配置、权限及部署依赖；概念配图不代表产品实机截图。
