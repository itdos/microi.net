# Microi.net.Api 分层边界与迁移清单

## 目标边界

`Microi.net.Api` 是 ASP.NET Core 宿主和协议适配层，只负责：

- HTTP、WebSocket、SignalR 路由与请求/响应转换。
- 鉴权 Filter、Middleware、ModelBinder 和 Options 配置的宿主接入。
- 依赖注入、插件装配、应用启动与关闭。
- 将请求上下文转换为核心或插件可接收的参数，再返回 `DosResult`。

状态机、Redis 状态、数据库持久化、文件系统实现、业务权限、任务调度、聊天记录和 AI 编排应位于 `Microi.Core` 或对应插件中。API 项目不得成为其它项目的依赖。

## 本轮已迁移

| 原 API 实现 | 迁移位置 | API 保留职责 |
| --- | --- | --- |
| `Services/BackgroundTaskService.cs` | `Microi.Core/Runtime/BackgroundTaskService.cs` | Controller 提取当前身份，SignalR 发送由宿主注入 |
| `Services/OnlineTerminalService.cs` | `Microi.Core/Runtime/OnlineTerminalService.cs` | Hub/Filter 提供连接与请求上下文 |
| `Services/SecurityGuardService.cs` | `Microi.Core/Runtime/SecurityGuardService.cs` | Middleware 负责请求管线和拦截响应 |
| `Middleware/RequestPressureGuardMiddleware.cs` 的策略实现 | `Microi.Core/Runtime/RequestPressureGuardService.cs` | Middleware 读取 HTTP 参数和写忙碌响应 |

四项实现合计约 2500 行，包含任务执行、Redis 持久化、在线终端合并、Token 终端状态、安全窗口、封禁审计、租户/路由/V8 并发门控等逻辑。`Microi.net.Api/Services` 不再保存这些实现。

`Microi.Core/Runtime/RealtimePushRuntime.cs` 是核心到宿主的单向推送桥。核心只提交连接 Id、事件名和负载，`Program.cs` 注入 SignalR 发送实现，因此 `Microi.Core` 不反向引用 API 项目或 `DiyWebSocket`。

## 应保留在 API 的代码

| 类型 | 文件示例 | 原因 |
| --- | --- | --- |
| 请求绑定 | `FormDataOrJsonModelBinder.cs` | 直接实现 ASP.NET Core ModelBinder 协议 |
| 管线适配 | `SecurityGuardMiddleware.cs` | 负责调用 `_next`、写 HTTP 响应；防护状态已迁出 |
| 鉴权入口 | `DiyFilter.cs` | Filter 本体必须留在宿主，内部 Token 判定仍需继续下沉 |
| 运行配置 | `JwtBearerOptionsConfigurator.cs`、`CorsOptionsConfigurator.cs` | ASP.NET Options 装配 |
| 动态路由 | `DynamicApiEngine.cs` | 将 HTTP 路由映射到接口引擎 |
| WebSocket 入口 | `V8DebugWebSocket.cs` | 协议升级和连接生命周期；调试实现已在 `Microi.net` |
| Controller | `V8EngineController.cs` 等 | 路由稳定性与参数适配，前提是动作只委托核心/插件 |

## 后续优先迁移

### P0：高收益且边界明确

1. `HDFSController.cs` 的 OnlyOffice 文件版本、字段合并和分布式存储保存逻辑迁到 `Microi.HDFS`。Controller 只保留 Token、Body、FormFile 适配。
2. `DiyWebSocket.cs` 的聊天记录、联系人、未读数、MongoDB 与 AI 回复逻辑拆到 `Microi.MongoDB` / `Microi.AI` 服务。Hub 只保留连接生命周期和客户端事件转发。
3. `DiyFilter.cs` 的活动 Token 选择、终端过期判断、自动换新决策迁到 `Microi.Core/Token`。Filter 只读取 Header/Form/Endpoint 并写结果。

### P1：需要独立插件或兼容方案

1. `Handler/UEditor` 应迁为独立 `Microi.UEditor` 插件。它同时依赖上传、抓取、配置和 HTTP 协议，不应并入 `Microi.Core`。
2. `SysUserController.cs` 中登录、短信登录、刷新与租户创建的业务流程继续下沉到 `SysUserLogic`；验证码、开发环境免验证和 Cookie/Header 仍留在 API。
3. `HDFSController.cs`、`FormEngineController.cs`、`ApiEngineController.cs` 中重复的当前用户和 `OsClient` 参数装配可统一为 API 层身份解析器，但不得把 `HttpContext` 传入业务服务。

## 不采用的迁移方式

- 不让 `Microi.Core` 或插件引用 `Microi.net.Api`。
- 不为搬文件而让基础插件反向依赖可选插件。例如 `DiyWebSocket` 直接整体迁入 `Microi.net` 会迫使其依赖 `Microi.MongoDB`，应先拆服务接口。
- 不改变现有 `/api/...`、SignalR 事件名或 `DosResult` 结构来换取表面上的目录简洁。
- 不把可配置的租户业务改写为新的 C# Controller；优先接口引擎，缺少底层能力时扩展 V8/插件。

## 验收要求

- `Microi.net` 和 `Microi.net.Api` 分别可独立构建。
- 原有 Controller 路由、SignalR 事件、Redis Key 和返回结构保持兼容。
- API 项目不出现被核心或插件引用的反向依赖。
- 每批迁移必须完成真实登录、后台任务、在线终端或对应业务接口的运行验证。
