# workspace-conventions 详细参考 1

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=workspace-conventions-010 sha256=d4ee69df49b8cba8d6365f485bd44aab8f5fcccc4cc1c8394220af14ff68f83f -->
## 版本更新日志保护规则（强制）

- 日常功能开发、缺陷修复、测试、普通文档补充、Skill 完善和代码重构期间，不得修改 `microi.doc/docs/doc/about/update-log.md`。
- 只有用户明确提出“发布版本”“准备发版”“更新版本日志”或直接点名要求修改该文件时，才允许编辑更新日志；“完善文档”或“补充官网说明”不等于授权修改版本日志。
- 如果本轮误改了更新日志，必须先按上节完成多对话归属核验；只撤回有本对话精确写入证据的 hunk。必须保留用户、其它对话或其它任务的已提交和未提交内容，归属不明时不得修改并应询问用户。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-011 sha256=8e3904f45392b7c27746de274bbc4725a7eb0964f0aeab1d83918c0174336dc4 -->
## 配置文件说明中文优先规则

AI 新增或修改 Microi 配置文件时，凡是面向开发者、部署人员或用户阅读的自然语言描述，默认必须写中文。适用范围包括 `appsettings*.json`、`docker-compose*.yml`、`launchSettings.json`、`*.example`、安装脚本注释、部署说明和示例配置。

- `Description`、`Important`、`EnvironmentVariables` 的说明文字、JSON/YAML 注释、示例说明、字段说明默认使用中文。
- 字段名、环境变量名、枚举值、路由、类名、方法名、包名、协议名等标识符保持原始英文，不要为了中文化而破坏程序读取。
- 如果配置面向海外交付，才可以在中文说明后补充英文括注；不要整段只写英文。
- 修改配置说明后，必须确认 JSON/YAML 仍可解析，不能因为中文标点或注释方式导致配置文件失效。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-012 sha256=f54d1c6d9ce2a86496dbc89d49158fb5efa7501817be350493247bd6bde37f63 -->
## 后端 API 配置白名单与 SaaS 单一事实源（强制）

- `Microi.net.Api` 的 `AppSettings` 与同名容器环境变量只允许：`OsClient`、`OsClientType`、`OsClientNetwork`、`OsClientDbType`、`OsClientDbConn`、`OsClientRedisHost`、`OsClientRedisPort`、`OsClientRedisPwd`、`OsClientRedisDataBase`、`OsClientDbMongoConn`。
- 除上述十项外，不得新增 API 业务环境变量或 `AppSettings` 节点。影响整个部署/节点或决定租户基础设施路由的开关、超时、限额、安全策略和密钥进入主控 `sys_osclients`；允许每个子租户自行维护的 OAuth、业务集成和展示设置进入该租户数据库的 `mci_system_setting`。两者都必须提供幂等升级、默认值、缓存刷新、敏感字段脱敏和租户隔离。官方 License 信任链是固定例外：恢复重试次数/间隔使用代码常量，签发私钥固定只读挂载 `/app/microi_private.pem`。禁止新增 `MICROI_*`、`DOS_ORM_*`、额外 `AppSettings` 节点或通用动态环境变量读取。
- `ASPNETCORE_*`、`DOTNET_*` 是框架宿主配置；`PW_*`、MCP、构建、安装器和发布脚本变量只服务各自工具进程。它们不能成为生产 API 的业务配置入口。
- 修改后必须用源码测试扫描生产 `.cs`、API `appsettings.json` 及在线/离线 Compose，精确断言十项白名单。不能用注释约定代替自动化守卫。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-013 sha256=f71d409558e941597f9d66c10005885e228441df606e97011c798e41f91eff49 -->
## 身份、可逆业务秘密与敏感操作统一规范（强制）

- DiyToken 是吾码多租户、多终端、V8 和低代码权限体系的唯一会话入口。新增密码、SSO、OAuth、Passkey、人脸或其它登录方式时，验证成功后必须继续签发 DiyToken，并复用现有角色、部门、菜单、表权限、数据范围、终端吊销和 Token 轮换；禁止整体替换为 ASP.NET Identity 或并行建立第二套用户/权限 Token。
- 登录密码的新存储必须使用后端带盐、可调成本的专用密码哈希。存量 `PwdEncode=DES` 的管理员显示密码只是兼容能力，不得扩展给普通 V8、FormEngine、匿名或访问密钥会话。
- 业务明确要求再次显示原文的设备口令、第三方业务账号密码等字段，允许使用吾码可逆加密兼容机制。保存只在可信后端加密；列表/导出默认掩码；显示明文走独立授权动作，校验 DiyToken、租户和业务权限，返回 `no-store`，记录不含明文的审计，失焦/超时后清除。
- DES 是现有兼容格式，不得宣称能抵抗服务器所有者或代码执行者。新高价值秘密优先使用带版本的现代认证加密与集中密钥管理；基础设施密钥仍不得进入可编辑 V8。
- 登录后的敏感操作优先用 `V8.Identity.Verify` 申请 Passkey、Authenticator TOTP 或严格人脸一次性票据，接口引擎从权威数据重算 `ActionHash` 后调用 `V8.Method.ConsumeIdentityVerificationTicket` 原子消费。票据不能代替菜单/表/行权限、状态机、幂等、事务或审计。
- Windows Hello、Touch ID、Face ID 和 Android 设备验证优先采用 WebAuthn/Passkey；Microsoft/Google Authenticator 采用标准 TOTP，两者都不增加模型服务。只有服务端严格人脸与活体检测才接入独立 `Microi Face Gateway v1` 云服务或 Docker/集群。完整规范读取 `microi.skills/v8-security/SKILL.md` 与 `microi.doc/docs/doc/more/identity-verification.md`。
- 外部登录统一在登录页【登录方式】中展示；Gitee、微信、GitHub 等 Provider 只登录个人中心已绑定的吾码用户，最终签发 DiyToken。Provider 固定协议端点，租户自己的 ClientId/ClientSecret 放 `mci_system_setting`；Secret 不进入浏览器/前端 `V8.SysConfig`，但后端接口引擎和后端 V8 事件可从当前租户根级 `V8.SysConfig[ConfigKey]` 使用，禁止回传或记录原文。
- 一键安装恢复客户旧库时只允许定位精确主租户三元组；缺失则幂等创建，重复则停止，不能批量重写其它子租户。新主租户行不得持久化数据库、MongoDB 或 Redis 连接，安装器对 MinIO/OCR 等业务配置的后续更新也必须带同一三元组、活动状态条件并做唯一回读。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-014 sha256=d17f000dd9548f104277acca846c450066e6979a1e0bfec31879a7ba42deccfe -->
## 多语言优先约定

Microi 平台默认支持多语言。AI 修改 `Microi.Client`、`Microi.Server`、`Microi-V8-Engine`、MCP 建模数据、菜单按钮、接口引擎或表单 V8 事件时，凡是用户可见文字都必须先考虑多语言，不要把中文提示、按钮名、Tab 名、菜单名、字段名、Toast/Msg 等硬写死后结束任务。
- 前端框架固定文案优先使用 `$t('Msg.xxx')` 或项目现有 i18n 工具；中文简体、中文繁体、英语作为前端兜底包，其它语言应来自后端 `diy_lang` 缓存/接口返回，不要随意把十几种语言全写死到前端源码。
- 后端返回给前端的表名、字段名、菜单名、按钮名、Tab 名、错误提示等，优先从 `diy_lang` 缓存取值；没有词条时再返回原文，并异步补齐词条。
- V8 接口引擎、表单 V8 事件、菜单按钮 V8 若需要返回中文 `Msg`、通知、按钮提示或日志标题，应优先使用 `V8.TranslateEngine.GetLang(key)` / 约定多语言 Key，或至少为后端自动同步留下稳定 Key，不要只写一次性中文字符串。
- 通过 MCP 创建或维护 `diy_lang` 数据时必须保持树形结构：`系统`、`模块引擎`、`表单引擎`、`业务数据` 等分类。菜单名称归 `模块引擎`；表名、字段名、V8 按钮名、Tab 名归 `表单引擎`；固定框架文案归 `系统`；业务数据默认不写入 `diy_lang`，除非用户明确要求某类业务表进入词库。
- 不允许把所有多语言映射都创建到 `diy_lang` 根目录。新增词条前先查询是否已有同 Key/同分类数据；写入后需要刷新/回读多语言缓存。
- 完成多语言相关改动后，至少切换一次目标语言或调用对应接口验证；涉及页面的任务优先用 Playwright 截图确认关键区域没有残留明显中文。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-015 sha256=3db1eb06c79e7d3b5158a7fc4992af4848406d892c054699db3f9215849fcab4 -->
## 后台菜单层级默认规则

AI 通过 MCP、Manifest、V8 或平台 API 创建/修复 Microi 后台菜单时，默认必须规划为至少两级菜单树。真实系统不能把一批 CRUD、报表、日志、设置页直接平铺到根级菜单。

- 顶级菜单只放业务域、系统域或产品域父菜单，例如系统引擎、业务中心、运营管理、基础资料等。
- 具体表单 CRUD、报表、导出、日志、规则、配置、任务页必须挂在对应父级或二级分类下。
- 同一业务域下超过 3 个叶子模块时，优先再按基础资料、业务执行、配置中心、日志记录、数据产物等通用类别分组。
- 通过 MCP/Manifest 创建菜单时，必须显式包含父菜单和子菜单关系；叶子菜单必须写入正确 `ParentId`，并在交付说明中列出最终菜单树。
- 改造已生成菜单时，不能只停留在文档建议。必须回读 `sys_menu`，列出现有菜单、目标父级、`ParentId`/`Sort` 迁移关系，更新管理员角色权限，再次回读验证菜单树深度。
- 只有表单内嵌子表、隐藏路由、系统内部入口等不应出现在导航中的菜单可以例外隐藏；隐藏菜单必须明确设置 `Display=0`、`AppDisplay=0`，并避免误标为有子级的空父菜单。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-016 sha256=ea4975115c96e1968ae32b8f2271b79288f99a35cd8cdbf9de672481f3964521 -->
## 后台任务与安全防护约定

Microi 平台级长任务和安全防护属于系统能力，AI 修改框架、MCP 或 V8 示例时必须同步考虑：

- 应用安装、初始化多语言、批量导入、批量修复、跨系统同步等长任务优先接入后台任务中心，进度通过吾码标准 WebSocket/SignalR 推送，不要默认用前端轮询接口。
- 菜单按钮可使用 `RunBackground` / `BackgroundTask` / `IsBackgroundTask` 配合 `ApiEngineKey` 启动后台任务；接口引擎内必须用 `V8.Method.UpdateBackgroundTask` 上报进度。
- 后台任务按钮创建后，平台会向接口引擎参数注入 `_BackgroundTaskId`。V8 代码应读取 `_BackgroundTaskId` / `BackgroundTaskId` / `TaskId`，按真实阶段或处理条数上报 `Current`、`Total`、`Progress`、`Msg` / `Message`。不要写假进度、不要只在结束时写 100%，成功返回 `Code:1` 后由平台统一置为 100%。
- 后台任务运行态会写入 Redis 并推送通知中心；清除已完成应同时清理内存态和 Redis 态。新增类似能力时要验证刷新页面后任务仍可见、进度百分比正确、完成后可清除。
- 平台级安全、访问审计、后台任务、运行态监控等系统表统一使用 `mci_` 前缀；普通业务系统表不要使用 `mci_` 前缀，避免与平台能力混淆。
- 恶意攻击防护只能根据短时间高频、异常状态码爆发、扫描不存在路径、封禁后继续访问等行为判断，不能因为接口执行时间长或排队时间长就封禁用户。
- 攻击事件、IP 封禁/解封记录应异步写入 MySQL `mci_` 表并写系统日志；同一 IP、同一原因、同一时间窗必须去重合并，不要重复写大量相同失败原因。
- 手动封禁、手动解封、自动解封都要有审计记录。封禁响应要返回 DosResult 风格 JSON，便于前端明确提示。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-017 sha256=f3f2f378b99fc5621ea9a6dd1b924a8db171ca8e55588f6b48d3ac4084306e41 -->
## 业务逻辑优先接口引擎约定

AI 为 Microi 平台新增或修改任何业务逻辑、后台工具、数据维护能力、官网流程、在线 AI 能力、导入导出、初始化、修复任务、页面配套接口或租户 SaaS 流程时，默认优先使用接口引擎实现，不要直接新增 `Microi.net.Api` Controller 或把业务分支写死到 C# 后端。

- 能用 `V8.FormEngine`、`V8.Db`、`V8.Method`、`V8.Http`、`V8.Office`、`V8.ApiEngine` 完成的功能，必须优先建 `sys_apiengine` 接口引擎，并通过前端 `DiyCommon.ApiEngine.Run` 或菜单按钮调用。
- 需要持久化的数据结构必须优先通过 MCP / Manifest 创建标准低代码表、字段和菜单，让表能在表单引擎中可见、可维护、可授权；不要只在 C# 中 `CREATE TABLE` 物理表。
- 如果接口引擎缺少底层能力，优先扩展 V8 能力（例如 `V8.Method`、`V8.FormEngine`、HDFS 辅助方法），再让接口引擎调用新增能力；只有跨平台核心框架、协议层、鉴权管线、SignalR/WebSocket、ORM、任务调度内核等接口引擎无法表达的能力，才新增或修改 C# Controller/Service。
- 新增 C# Controller 前必须能说明为什么不能用接口引擎实现，并在交付说明中列出原因、影响范围和版本升级要求。
- 从 C# Controller 迁移到接口引擎时，前端不得继续调用旧 `/api/<Controller>/<Action>`；应统一改为 `DiyCommon.ApiEngine.Run('<ApiEngineKey>', params)`，并保留 DosResult 返回格式。
- 修改 `Microi.Server` 前必须先做四级归类并留下结论：① 现有表单引擎 CRUD/事件能完成；② 现有 V8 接口引擎能完成；③ 只缺一个可复用的底层原子能力，应先扩展 V8 再由接口引擎编排；④ 只有平台协议、可信鉴权、密钥隔离、存储/网络边界或运行时内核才允许直接写 C#。未完成归类不得直接新增 Controller/Service。
- 第三方回调必须优先采用“C# 最小协议网关 + 应用拥有的 `Managed` 核心接口引擎 + 租户拥有的 `CreateIfMissing` 扩展 Hook”。C# 只验签、解密、校验租户/AppId 和整理脱敏事件；状态、日志、数据写入、通知及业务编排放接口引擎。扩展 Hook 以稳定 `EventId` 幂等，不能因修改业务规则再次发布后端。
- 第三方平台不支持 QueryString 时使用 `/path--OsClient--{OsClient}--`；支持 Query 时参数名固定为 `?OsClient=`，不得发明 `?o=` 等缩写。路径与 Query 同时出现时必须一致。
- 第三方 HTTP 集成默认用 `V8.Http` 放在接口引擎；若平台密钥绝不能进入可编辑 V8，只在 C# 暴露最小、租户隔离、不可覆盖密钥的安全原子方法，业务字段选择、状态流转和页面动作仍由接口引擎/表单事件编排。
- 平台级强制安全校验不能为了“全部低代码化”放进租户可编辑脚本而被绕过；可以留在 C#，但必须是通用、失败关闭的安全边界，不得夹带某个项目的业务文案、字段组合或状态机。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-018 sha256=b5ed99d715e5fc5a62d5a9618397f0e40899b400f377dc3fedc41d18d6db73dd -->
## 应用商城优先于 Microi.Upgrade（强制）

能由应用包声明、差异安装和回读验收完成的升级，不得在 `Microi.Server/Microi.Upgrade/` 新增定制 .NET 升级类。表、字段、Tab、菜单、角色权限、接口引擎、表单事件、数据源、页面、打印、工作流、任务及可幂等安装的种子数据，默认都属于应用商城资源。

- 应用包中的接口引擎必须声明 `ResourcePolicies.ApiEngines`：官方核心使用 `Managed`，租户 Hook 使用 `CreateIfMissing`。`Managed` 以目标端安装记录的上游 SHA-256 为 Base，仅当 `Local == Base` 才升级；本地已改则整包冲突回滚。`CreateIfMissing` 首次创建后永不覆盖，且同一 Key 后续禁止改回 `Managed`；确需收回官方维护时必须发布新 Key 并显式迁移。安全核心禁止自动合并可执行代码，要求把客户差异迁移到 Hook 或人工确认。
- 吾码官方开发者若可调用绑定 `https://api.itdos.com`、`OsClient=iTdos` 的 `microi_itdos`，必须先在官方主租户通过 MCP 更新资源，重新制作并发布对应官方应用，发布后按字段/菜单/引擎/包版本回读；再用目标租户 MCP 安装/更新并轮询后台任务到 `Succeeded`。
- 当前用户没有 `microi_itdos` 权限时，通过其自己的 MCP/Manifest 幂等升级自己的数据库并回读；不得为了单个租户把定制迁移塞进通用后端。确需让更多用户复用时，应生成其有权维护的社区/私有应用包。
- 只有应用商城运行前就必须存在的物理兼容基础、跨版本核心协议迁移、存储格式变化，或安装器自身无法安全表达的不可逆平台迁移，才允许进入 `Microi.Upgrade`。每个例外必须写明“为什么应用包不能完成”、影响范围、回滚/前后兼容、分布式幂等和验收依据。
- 允许的 .NET 迁移只能按持久化版本/迁移账本执行待办步骤，使用共享租约且业务幂等；禁止把新迁移同时加入版本链和“每次启动无条件全租户对账”列表。启动成本必须与待执行迁移数相关，不能随历史升级文件总数对每个租户线性增长。
- 评审 `Microi.Upgrade` PR 时先做资源分类：若只是补字段、Tab 或低代码元数据，移出升级器并发布应用包；若保留 C#，必须提供双节点、重复启动、租约丢失、失败不推进版本以及旧新节点共存测试。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-019 sha256=333125c854376da9f58b988c0ff2e4e94592de5437107182da838878ceb6b447 -->
## 在线 AI 应用上下文默认发现规则（强制）

AI 开始处理定制页面、弹窗、Web、UniApp、微服务或应用商城任务时，不能只搜索本地目录。只要当前 MCP 已连接到目标 `OsClient`，必须先读取在线 AI 应用上下文：

1. 调用 `microi_list_applications` 获取当前租户全部 `Web / UniApp / MicroService` 应用和完整文件清单。
2. 找到候选应用后调用 `microi_get_application_context`，默认 `includeContents=true`，读取所有可读源码内容以及微服务运行页面。
3. 只需核对单个大文件或二进制文件时，再调用 `microi_get_application_file` 精确读取。
4. 已存在合适微服务时优先在原应用内新增页面/路由；不存在时才调用 `microi_create_microservice`、`microi_sync_microservice_source`、`microi_publish_microservice` 创建并发布。

三个读取工具的关键参数：

| 工具 | 参数 | 说明 |
|---|---|---|
| `microi_list_applications` | `appType` | 可选：`Web`、`UniApp`、`MicroService`；省略表示全部类型 |
|  | `keyword` | 可选：按名称、`AppKey`、类型、描述筛选 |
|  | `includeFiles` | 默认 `true`，返回每个应用完整文件清单 |
| `microi_get_application_context` | `appIdOrKey` | 必填，支持统一应用商城 `sys_microistore.Id` 或 `AppKey` |
|  | `includeContents` | 默认 `true`；读取私有 HDFS 源码内容 |
|  | `maxFileBytes` | 可选，默认单文件 2MB |
|  | `maxTotalBytes` | 可选，默认单应用 50MB |
| `microi_get_application_file` | `appIdOrKey`、`filePath` | 必填；`filePath` 必须来自文件清单 |

如果 MCP 返回登录过期，必须先修复或刷新目标 MCP 身份，再继续把 MCP 读取结果当作当前事实；不能因为读取失败就假设在线应用不存在并重复创建。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-020 sha256=4d3aef6042f7e43be7c2bf61430ce461bfb75bfb853b1ca000b0f5c5836eff7f -->
## VS Code 插件空目录生成规则

Microi.VSCode 面向普通用户时，用户本地可能只是一个空工作区。插件生成 AI 指令文件时不能假设用户已经有 `microi.skills/`、`Microi-V8-Engine/`、`AI-Project/` 或某个固定前端项目目录。

强制要求：
- 插件的“初始化AI配置”必须能在空目录生成 `microi.skills/`、`.github/copilot-instructions.md`、`AGENTS.md`、`CLAUDE.md`、`.cursorrules`、`.cursor/rules/microi-skills.mdc`、类型提示、`jsconfig.json` 和 MCP 配置。
- Cursor rule 的 `globs` 必须覆盖任意新建项目目录下的常见源码、配置和文档文件，例如 `**/*.{vue,js,ts,jsx,tsx,css,scss,json,md,mdc,cs,csproj,xml,yml,yaml}`，不能只覆盖 `Microi-V8-Engine/**/*.js`。
- 生成文案必须明确：普通用户不需要手动克隆 skills，也不需要每次对 AI 说“严格遵循 microi.skills”；只要插件初始化成功，AI 就应默认按 skills 工作。
- 插件升级时应继续保护用户本地修改过的 skill 文件，只覆盖插件曾生成且用户未改过的文件。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-021 sha256=d6da1a47b1f8ed4b1ea863b052c5e1fa7767e2809c39abe4813ea000d9a30db6 -->
## Microi 版本号规则

Microi 通用版本号采用 `主版本.次版本.修订版本` 三段数字格式，从 `1.0.0` 开始。每次发布时最后一位加 1；当某一位超过 `9` 时向前一位进位并将当前位归 `0`，例如 `1.0.9 -> 1.1.0`、`1.9.9 -> 2.0.0`、`9.9.9 -> 10.0.0`。

接口引擎代码头、表单/工作流 V8 事件代码头、前端微服务 `sys_microiservice.BuildVersion` 与 `sys_microiservice_page.BuildVersion` 这类业务发布版本统一使用带 `v` 前缀的格式：`v1.0.0 -> v1.0.1 -> v1.0.9 -> v1.1.0 -> v1.9.9 -> v2.0.0 -> v9.9.9 -> v10.0.0`。禁止使用时间戳、随机串或日期作为 BuildVersion；前端微服务上传到分布式存储的目录也必须使用同一个 BuildVersion 分段，便于回溯与 CDN 缓存隔离。

`Microi.VSCode` 发布时会通过 `bump-version.js` 自动自增插件版本，并把 `microi.skills/.microi-skills-version.json` 中的 skills 发布版本写成同一个插件版本号；skills 不再独立自增。`.microi-skills-version.json` 只用于记录 skills 包版本和提示用户当前来源，不能单独作为覆盖依据。

插件初始化或升级同步 `microi.skills/` 时，必须以 `.microi-skills-manifest.json` 的逐文件 hash 判断是否可覆盖：本地文件不存在则写入；本地文件与旧 manifest hash 一致说明用户未改，可自动升级；本地文件已被用户修改、或本地版本比插件捆绑版本更新时，必须保留用户版本并提示差异。不能因为插件版本号更高或更低，就粗暴覆盖本地 skills。创始人本地随时修改 skills 的工作区尤其要保护；普通用户未修改过的旧 skills 才应该被最新插件覆盖升级。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-022 sha256=709c669676154b9b469feefad4761544a8cb29fba2e050262b26390c1c4e327c -->
## C# dynamic 强类型落地规则

后端源码中从 `dynamic`、`JObject`、`ExpandoObject`、表单参数或 `DynamicHelper` 读取出来的值，如果后续要调用字符串方法、扩展方法或参与强类型判断，必须先显式落到强类型变量。不要用 `var` 承接 `DynamicHelper.GetDynamicStringValue(...)` 后再调用 `DosIsNullOrWhiteSpace()` 这类扩展方法，因为调用点可能仍按 dynamic 绑定，运行时会出现 `'string' does not contain a definition for ...`。

错误写法：

```csharp
var tableName = DynamicHelper.GetDynamicStringValue(diyTableModel, "Name", "");
if (tableName.DosIsNullOrWhiteSpace()) { return; }
```

推荐写法：

```csharp
string tableName = DynamicHelper.GetDynamicStringValue(diyTableModel, "Name", "");
if (string.IsNullOrWhiteSpace(tableName)) { return; }
```

如果方法内部只通过 `DynamicHelper` 读取对象字段，方法参数优先声明为 `object`，不要声明为 `dynamic`。这样可以减少 C# 运行时动态绑定进入普通字符串工具链的机会。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-023 sha256=91feb164525de8824674bd62eae72fc549d64ad253b0551d3504ecb7aba5bf51 -->
## 根目录保留文件说明

根目录只允许存在以下类型的文件和目录：

| 路径 | 说明 | 是否可删除 |
|------|------|-----------|
| `.github/` | GitHub Actions、Copilot 配置 | 否 |
| `.venv/` | Python 虚拟环境，AI 代理使用 | 否（必要） |
| `.vscode/` | VS Code 工作区配置 | 否 |
| `microi.skills/` | 通用技能文档库 | 否 |
| `Microi.Server/` | .NET 后端 | 否 |
| `Microi.Client/` | PC 前端 Vue3 | 否 |
| `microi-v8-engine/` | V8 接口引擎代码 | 否 |
| `AI-Project/` | 各租户/项目 | 否 |
| `switch-env.ps1` | 本地环境切换工具 | 否（有用） |
| `.tmp/` | AI 临时文件（gitignored） | 可删整个目录 |
| `.microi-e2e/` | Microi.VSCode 插件 E2E 产物 | 可定期清理 |
| `.microi-performance/` | 性能测试报告 | 可定期清理 |

<!-- /microi-progressive:chunk -->
