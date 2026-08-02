---
name: microi-microservice
description: Microi 前端微服务 MicroService 开发与交付指南。用于创建、读取、修改、构建、发布或修复 Vue3 微应用，维护 microi.routes.json，绑定 sys_menu，使用 V8.OpenAppDialog，或通过 MCP 管理 Web、UniApp、MicroService 应用源码和运行时。
---

# Microi 前端微服务

这里的 MicroService 是运行在吾码主站中的前端微应用，不是 .NET/Java 后端微服务。
它适合复杂租户页面、多页面应用、完整表格/上传/步骤交互和独立版本交付；业务事务、
权限和最终校验仍放接口引擎或可信后端。

完整数据模型、文件/路由协议和宿主通信见 `references/runtime-delivery.md`。

## 何时使用

| 需求 | 选择 |
|---|---|
| 简单确认 | `V8.ConfirmTips` |
| 标准单表新增/编辑/查看 | FormEngine / `V8.OpenAnyForm` |
| 主前端已注册组件 | `V8.OpenDialog` |
| 3 个以上字段、联动、上传、表格、Tab、步骤条、代码编辑 | MicroService + `V8.OpenAppDialog` |
| 独立菜单、多页面、AI 在线编辑、本地 Vite、独立发布 | MicroService |

## 默认发现顺序

开始写代码前：

1. `microi_list_applications` 盘点当前租户全部 Web、UniApp、MicroService 和文件清单。
2. `microi_get_application_context` 默认只读取元数据、文件哈希、运行时和页面；需要少量正文时显式开启内容读取。
3. 单个大文件按需使用 `microi_get_application_file`，不要为了查看清单把全量源码 Base64 拉入上下文。
4. 合适应用存在时在其中新增页面/路由，不创建“一页一个微服务”。
5. 没有合适应用时才脚手架/创建新 AppKey。

所有读写必须使用同一 MCP、ApiBase 和 OsClient。写操作先 dry-run，再按用户授权确认。

## 源码与产物分离

- `sys_microistore`：应用主数据。
- `mci_ai_app_file`：私有源码清单，内容在私有 HDFS。
- `mci_ai_app_version`：构建版本。
- `sys_microiservice`：已发布运行时。
- `sys_microiservice_page`：页面路由。
- 编译后的 HTML/JS/CSS/图片放公有 HDFS，源码不公开。

不能从 `sys_microiservice` 公有产物反推完整源码，也不把大 JS/CSS 长期塞数据库 JSON。

## 本地工程

新建和整体升级项目的通用前端架构遵守 `microi-ai-application`：默认使用 Vue 3 单文件组件、Composition API、Vite 和严格 TypeScript。本 Skill 继续负责 MicroService 特有的 Manifest、页面路由、宿主上下文、菜单绑定与发布协议。

项目至少有：

```text
.microi-micro-app.json
microi.routes.json
package.json
package-lock.json
tsconfig.json
vite.config.ts
index.html
src/
```

AppKey 稳定且只含安全字符。`microi.routes.json` 是页面事实源，删除/新增路由后由
发布流程同步 `sys_microiservice_page`，不要从 Vue 源码猜路由。

构建前遵守本地 OOM 保护；已有 dev server 可复用时不重复启动。独立 Vite 预览缺少
完整宿主 Token/OsClient/菜单/弹窗上下文，不能替代宿主验收。

## 发布

- 创建/更新元数据：`microi_create_microservice`。
- 同步私有源码：`microi_sync_microservice_source`。
- 真实编译目录优先 `microi_publish_application_directory_stream` 流式发布。
- 只有服务器不支持流式端点且产物很小时，才兼容 `microi_publish_microservice`。
- 正常发布支持最多 20,000 个文件、总计 20GB；逐文件从磁盘流入 HDFS，不生成整包 Buffer/Base64。几百 MB、1GB 级项目不得自动降级到旧 Base64 发布器。
- `StorageMode=db` 仅是显式的小型应急恢复模式，不是正常发布容量；当前最多 256 文件/5MB。超过该边界必须修复租户 HDFS/网关并恢复流式文件模式，不能调大数据库内联上限来承载大项目。
- 每次交付使用同一 `DeliveryBatchId`，并保存 `SourceManifestHash` 与 `RuntimeManifestHash`；源码同步、运行清单、页面切换和入口探测必须能关联到同一批次。
- 发布后用 `microi_get_application_context`、`microi_get_microservice` 回读。
- 回读成功还不等于页面可用：必须直接请求稳定入口、版本入口和清单内的 JS/CSS；入口 `502` 且运行时/清单存在时，优先检查 API 节点是否能通过租户 MinIO 内网端点读取公有桶对象。不要反复发布同一份产物掩盖存储读取故障。
- 服务器暂未部署修复且产物很小时，可把 `StorageMode=db` 与内联 `ContentBase64` 作为短期恢复手段；必须明确记录为临时方案。修复部署后重新流式发布到公有 HDFS，并恢复 `StorageMode=file`，禁止长期把大 JS/CSS 放在数据库 JSON。
- 子租户发布时，源码、版本资产、回读验签、页面与缓存全部绑定当前 Token 的 `OsClient`；禁止回退到主租户或宿主服务器默认租户。切换前必须由当前 API 节点通过该子租户 HDFS 配置读回每个版本文件并校验大小/SHA-256。

## 菜单与弹窗

菜单 `OpenType=MicroService` 时一次绑定 `MicroServiceId`、
`MicroServicePageId`、`MicroServiceRoutePath`、`MicroServiceKey`。
复杂弹窗用 `V8.OpenAppDialog`，业务参数放 `Data`，回调放顶层。

微服务内部禁止调用浏览器原生 `alert/confirm/prompt`。优先复用宿主 `Tips`/`V8.ConfirmTips`；需要由子应用自行承载时，使用 teleport 到 `body` 的品牌化可访问弹层，固定在当前视口正中央并高于宿主滚动内容。长列表只允许一次性加载后在前端内存搜索时，不得随着关键词重复请求服务器。

Token 只通过宿主上下文传递，不硬编码、不放 URL、不写日志。子应用回传成功/取消/
错误事件，宿主负责提示、关闭和刷新。

`sys_microiservice_page` 是友好路由的页面事实源，`sys_menu` 只负责导航和角色权限。
无需出现在导航中的按钮页/详情页应在页面元数据设置 `InternalOnly=true`，不创建伪隐藏菜单。

宿主必须提供 `--micro-app-available-width`、`--micro-app-available-height`、
`--micro-app-safe-area-bottom`，并用 `ResizeObserver`/`visualViewport` 同步 `host:resize`。
子应用根容器使用 `min-height: var(--micro-app-available-height, 100vh)`；`100vh` 只能作为脱离
吾码宿主独立预览时的回退值。不得直接写死 `min-height: 100vh`、`calc(100vh - 100px)` 等
只适配浏览器视口或某个主站布局的高度，否则嵌入 TagsView、弹窗或移动端时会被裁剪或产生双滚动。

加载/协议/运行时异常只由宿主兜底显示；子应用业务错误标记 `handled=true` 后宿主不得重复提示。
加载失败页至少显示 AppKey、PageKey、路由、版本、入口、HTTP 状态、发布状态、资产来源、挂载状态和安全原因码，并提供重试、返回与复制诊断。

## 验收

- 源码、构建文件、运行时、页面路由和菜单五层分别回读。
- 直接刷新友好路由与连续切换多个微应用不 404、白屏或实例名冲突。
- Dialog/Drawer 成功、取消、错误和关闭协议正确。
- 宿主 API 请求携带当前 Token/OsClient/菜单上下文，普通用户权限正确。
- 至少验证桌面和窄屏；上传、表格、滚动、弹窗底部操作不被截断。
- 长弹窗滚动到顶部/中部/底部后，错误提示和确认层仍位于当前视口中央；自动化监听到原生 JavaScript 对话框直接判失败。
- 本地构建、MCP 发布和真实浏览器验收分别说明，未执行的层不宣称通过。
