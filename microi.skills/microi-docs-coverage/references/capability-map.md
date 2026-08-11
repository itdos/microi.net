# 中文官网文档到 Skill 的责任映射

本表覆盖 `microi.doc/docs/doc/` 下除 `about/update-log.md` 之外的全部中文
Markdown。第一列是相对 `microi.doc/docs/doc/` 的路径；第二列 Skill 名必须与
`microi.skills/<name>/SKILL.md` 一致。

| 中文文档 | 责任 Skill | 覆盖重点 |
|---|---|---|
| `about/faq.md` | microi-system-delivery, microi-deployment | 常见问题、能力边界和故障路由 |
| `about/microi-training-syllabus.md` | microi-system-delivery, business-blueprint | 培训知识域和交付全景 |
| `about/partner.md` | microi-system-delivery | 信息型页面；产品与交付能力索引 |
| `about/template.md` | microi-system-delivery | 信息型页面；官方内容模板 |
| `form-engine/all-form-component.md` | microi-form-engine, microi-form-layout | 当前组件目录、物理类型和布局 |
| `form-engine/form-custom-control.md` | microi-form-engine, microi-client-frontend | 定制控件、前端扩展边界 |
| `form-engine/form-datasource.md` | microi-form-engine, microi-datasource-mapping | 选项数据源、联动和回显 |
| `form-engine/form-engine-info.md` | microi-form-engine, v8-crud-api | 表单模型和运行时能力 |
| `form-engine/form-field-info.md` | microi-form-engine, v8-table-event | 表单/字段属性与事件 |
| `form-engine/model-engine.md` | v8-template-engine | 表格/表单模板 |
| `getting-started/docker-run.md` | microi-deployment | Docker 部署与验收 |
| `getting-started/local-run.md` | microi-deployment | 源码本地运行 |
| `getting-started/source-code-architecture.md` | workspace-conventions, microi-system-delivery | 多仓源码边界、模块地图和修改路由 |
| `getting-started/start-use.md` | microi-system-delivery, module-engine | 快速使用和首个模块 |
| `getting-started/win-install-microi.md` | microi-deployment | Windows 部署 |
| `edition-comparison.md` | microi-system-delivery | 信息型页面；版本授权、续费边界和选型建议 |
| `index.md` | microi-system-delivery | 产品能力总览和知识路由 |
| `more/copy-module.md` | module-engine, app-store | 模块复制、迁移和依赖 |
| `more/db-dictionary.md` | microi-db-schema | 核心表和字段归属 |
| `more/dos-orm.md` | dos-orm, v8-sql-query | ORM 查询、参数和事务 |
| `more/dos-result.md` | v8-utilities, v8-crud-api | DosResult/DosResultList 返回协议 |
| `more/hdfs.md` | v8-file-upload | 分布式文件存储和 URL |
| `more/identity-verification.md` | v8-security, v8-utilities, microi-microservice, app-store, v8-saas-multi-tenant | DiyToken、登录方式气泡、Passkey、Authenticator TOTP、Gitee/微信/GitHub、动态租户设置、严格人脸、一次性步进票据、个人中心和自动升级包 |
| `more/office.md` | v8-export-import, microi-microservice | Office 导入导出与在线编辑集成 |
| `more/security.md` | v8-security | 平台安全和兼容基线 |
| `more/sys-config.md` | v8-utilities, microi-deployment | 系统/租户配置和敏感边界 |
| `system-engine/ai-engine.md` | ai-engine, v8-http-integration, microi-ai-application | 模型代理、License、V8.AI、MCP 对话、跨端调用和安全 |
| `system-engine/ai-platform-governance.md` | ai-platform-governance, app-store, business-blueprint, page-engine | 门户、身份、配置、发布、服务韧性、Trace/日志、资产协作与可恢复导入 |
| `system-engine/ai-workflow-suite.md` | business-blueprint, v8-workflow, microi-system-delivery | AI 工作流、蓝图、状态机、自动化流和流程挖掘 |
| `system-engine/app-store.md` | app-store | 应用包、安装、升级和回滚 |
| `system-engine/databases.md` | dos-orm, v8-sql-query, microi-deployment | 扩展数据库与迁移 |
| `system-engine/datasource-engine.md` | datasource-engine | 数据源定义、执行和供数 |
| `system-engine/file-manage.md` | v8-file-upload, microi-client-frontend | 文件柜、公私桶管理、在线预览、回收站、跨平台与 MinIO 同步 |
| `system-engine/job.md` | job-engine | 调度、后台任务和分布式恢复 |
| `system-engine/micro-app.md` | microi-microservice, microi-ai-application | 微服务/AI 前端应用的工程架构与交付 |
| `system-engine/multi-end-client.md` | microi-client-frontend, microi-mobile-app-quality, microi-uniapp-frontend | PC、WebOS、移动自适应、UniApp 与 App 边界 |
| `system-engine/microi-ui.md` | microi-ui | Microi.UI 组件和主题 |
| `system-engine/message-notification.md` | message-notification | 平台内部消息、SignalR 与多通道通知 |
| `system-engine/module-engine.md` | module-engine, v8-menu-buttons, v8-template-engine, microi-mobile-app-quality | 菜单统计、模块指标、复合列、移动卡片、按钮角标和页面入口 |
| `system-engine/mq.md` | v8-mq-mqtt | RabbitMQ 生产与消费 |
| `system-engine/mqtt-engine.md` | v8-mq-mqtt | MQTT 事件与 IoT |
| `system-engine/page-engine.md` | page-engine | 界面引擎 JSON |
| `system-engine/print-engine.md` | print-engine, v8-frontend-events | 服务端模板打印与蓝牙直连边界 |
| `system-engine/report-engine.md` | report-engine | 虚拟报表和导出 |
| `system-engine/saas-engine.md` | v8-saas-multi-tenant | 租户识别和 SaaS 配置 |
| `system-engine/search-engine.md` | search-engine | Elasticsearch 索引和查询 |
| `system-engine/spider-engine.md` | spider-engine | 浏览器采集和 Worker |
| `system-engine/translate-engine.md` | translate-engine | 多语言与翻译供应商 |
| `system-engine/unity-integration.md` | unity-integration, v8-api-config, microi-client-frontend | Unity UPM、WebGL 宿主、DiyToken 与 V8 通讯边界 |
| `system-engine/visualization-engine.md` | page-engine, microi-ui | 3D、CAD、goView 与数据大屏能力边界 |
| `system-engine/wf-engine.md` | v8-workflow | 工作流设计和事件 |
| `v8-engine/ai-apiengine.md` | ai-engine, v8-api-config | AI 辅助接口引擎开发 |
| `v8-engine/api-engine.md` | v8-api-config, v8-utilities | 接口上下文、配置和调用 |
| `v8-engine/apiengine-index.md` | v8-crud-api, v8-api-config | 接口引擎实战和规范 |
| `v8-engine/form-engine.md` | v8-crud-api, v8-formengine-http | FormEngine API 与 HTTP |
| `v8-engine/mcp-server.md` | microi-system-delivery, microi-codex-installer, v8-security | MCP 工具、确认、审计、文件、日志、备份与访问密钥 |
| `v8-engine/v8-client.md` | v8-utilities, v8-frontend-events, v8-http-integration, v8-security, ai-engine, print-engine | 全部前端 V8、平台 AI、强身份验证、扫码和蓝牙打印 |
| `v8-engine/v8-server.md` | v8-utilities, v8-api-config, v8-http-integration, v8-security, ai-engine | 全部后端 V8、强身份票据、平台 AI 和专项路由 |
| `v8-engine/vs-code-plugin.md` | v8-explorer-tree, microi-client-frontend, workspace-conventions | VS Code 插件、Microi CLI、AI/MCP 初始化、类型、资源树和共享工作区 |
| `v8-engine/where.md` | v8-crud-api, v8-sql-query | 参数化 `_Where` 条件 |

## 维护规则

- 中文文档新增、删除或移动时，同一变更必须更新本表。
- 一篇文档可以有多个责任 Skill，但第一个应是主要承载者。
- “责任 Skill”不是把全文复制过去，而是保证 AI 能发现能力、调用正确 API、
  遵守安全边界并找到详细参考。
- 方法签名发生冲突时回查当前源码；文档旧写法仅作为兼容说明。
