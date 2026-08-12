# microi-system-delivery 详细参考 1

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=microi-system-delivery-005 sha256=e27ee98421974395b858927ab7b7fbebe27f314e54a8f616064b9c77c01ba808 -->
## 标准工作流

### 1. 需求蓝图阶段

- 读取全部需求文件、截图、历史说明、客户反馈和已交付文档。
- 用 `business-blueprint` 或同等文档固定：角色、菜单、状态机、关键表、接口引擎、按钮、任务调度、业务时间窗口、费率和权限边界。
- 用户新增或纠正规则后，立即同步到蓝图/方案文档，避免后续实现忘记业务口径。
- 生成系统前，用 MCP 读取现有 `diy_table`、`diy_field`、`sys_menu`、`sys_apiengine`，不要重复造表或编造字段。

### 2. MCP 建模阶段

- 开始任何 MCP 盘点前先调用 `microi_get_status` 验证当前连接、API Server
  与 `OsClient`，再读取结构；“配置文件里有 MCP”不能证明当前真实可用。
- 创建复杂系统优先使用 Manifest：表、字段、菜单、按钮、接口引擎、权限、页面、打印、工作流、任务统一规划。
- 先 dry-run：`microi_plan_system` / `microi_generate_system dryRun:true`。
- 用户确认后真实写入，并立即 `microi_validate_system`。
- 所有写操作前必须确认 MCP 绑定的 API Server、OsClient 和用户指定租户一致；多个 MCP 同时存在时，读写不能跨服务器混用。
- 对资金/资产类生产数据执行清理、重算、修复、补发、扣减前，必须留下可审计痕迹：中文备注 SQL、维护接口说明、执行时间、影响行数、回读验证结果。能用小范围条件时不要全表更新。
- 写入菜单时，业务按钮一次性配齐 `MoreBtns`、`FormBtns`、`PageBtns`、`BatchSelectMoreBtns`、`PageTabs`，按钮前端只负责交互，后端逻辑放接口引擎。
- 写入后台菜单时必须至少规划两级菜单树：先创建业务域父菜单，再把 CRUD、报表、日志、设置模块挂到对应父菜单。不要把客户、设备、工单、报告、日志、配置等所有模块直接创建为一级菜单。Manifest dry-run 和最终交付说明都必须列出菜单树。
- 新建前端 MicroService 时，必须先 `microi_list_applications` 盘点，再用 `microi_scaffold_vue_microservice` 在当前租户 `AI应用/{appKey}` 做预演和确认创建；构建后依次同步私有源码、发布公有产物、回读页面 Id。每个菜单通过 `microi_create_module` 一次绑定 `MicroServiceId/MicroServicePageId/MicroServiceRoutePath/MicroServiceKey`，写后用 `microi_get_module` 回读，不得把普通 URL 菜单的创建成功误报成微服务菜单已交付。
- 完整系统 Manifest 中的 MicroService 菜单使用 `microServiceKey + microServiceRoutePath` 作为跨租户可移植引用；`microi_generate_system` 必须在任何写入前回读并解析当前租户的服务/页面 Id。直接调用 `microi_create_module` 时仍须一次提供全部四个绑定字段。
- Windows 上脚手架从临时目录原子改名时，杀毒软件或索引器可能短暂返回 `EPERM/EACCES/EBUSY`；MCP 应做有上限的短重试并保持原子改名，重试仍失败才清理临时目录并报错，禁止改成逐文件覆盖目标目录。
- 编译产物优先调用 `microi_publish_application_directory_stream`。流式端点失败时必须检查 `uploadedCount/retrySafe`：只有 `uploadedCount=0` 且 `retrySafe=true`、并且产物较小时，才可临时回退 `microi_publish_microservice`；已上传部分文件时先按版本和哈希回读，禁止无判断重复发布。回退与远端版本缺口必须写进交付结论。
- `microi_get_application_context` 返回文件清单不等于源码可读；必须检查 `ContentsComplete/ContentErrorCount` 以及逐文件 `ContentReadError`。MinIO 服务端读取私有源码应走内网端点，不能因公网代理拒绝私有桶而把 `IncludedContents=true` 误判为完整上下文。
- 用户明确要求通过 MCP 修正当前后台菜单时，不能只更新 Skill 或文档后停下。必须回读 `sys_menu`，创建缺失的父级 `SecondMenu`，更新现有子菜单 `ParentId` / `Sort`，给管理员角色补父菜单权限，最后再次回读验证树结构。
- 表单布局默认遵守平台约定，例如 PC 双列；字段显示顺序要跟业务表单顺序一致。
- 平台通用功能除了改源码，还必须同步到官方主租户 `iTdos` 的应用商城母版并回读验证；项目专属视图、字段和业务动作只写目标租户，不能混入官方母版。

### 2.1 物理字段与跨端视图

- `diy_table.DiyConfig`、`diy_field.DiyConfig`、`sys_menu.DiyConfig` 均为废弃兼容字段。MCP、Manifest、应用包和手工更新都不得向其中写入新配置。
- 新配置必须先增加业务语义清晰的物理字段，再通过 `diy_field` 元数据暴露控件；不得把多个无关能力重新塞进一个通用 JSON 口袋字段。
- Detail/Edit/List/Card 统一视图属于模块场景，使用 `sys_menu.EnableViewSchema`、`ViewSchemaVersion`、`ViewConfigVersion`、`ViewSchema`。
- `ViewSchema` 可按 PC/Mobile/All 和 RoleIds 选择视图；禁用、缺失、损坏或客户端不支持时必须回退到现有模块/表单。
- EntityHero、MetricStrip、ActionGrid、ResponsiveSection 是独立视图区块，不是 `diy_field` 数据字段，也不能用 DevComponent 或虚拟字段模拟。
- 小程序仅执行白名单 ActionSchema 和声明式显隐/参数映射，不执行任意前端 V8。复杂业务动作调用接口引擎，重要校验进入后端表单事件。

绑定 `diyTableId` 创建 CRUD 菜单时，必须配置或允许 MCP/后端自动推断 `TableDiyFieldIds`、`SelectFields`、`SearchFieldIds`、`SortFieldIds`、`NotShowFields`、`StatisticsFields`、`MobileListFields`、`CardTitleTagFields`、`CardBottomTagFields`、`DefaultOrderBy`。列表列、搜索列、移动端卡片列不能为空白；`Id/XxxId/XxxIds`、系统字段、布局控件和富文本/上传/地图/子表等重字段默认不展示在列表。

搜索字段默认覆盖名称/标题/编号、状态/类型/分类、负责人/部门/客户、日期时间；金额、价格、数量、积分、余额、人数等数值字段默认进入 `StatisticsFields`。选择类、开关、部门、树、级联、地址等字段应尽量使用等值筛选。

每个可见业务模块还必须通过视觉交付门禁：逐字段设置合理列表宽度；每个模块都有紧凑
标题、业务副标题和 2~4 个真实动态指标；只给少量重要菜单设置行动型侧栏角标；为状态
PageTabs 和有决策价值的更多按钮设置批量统计角标；PC 至少一个合理宽度且去重普通列的
复合主列；移动端按图片/标题/副标题/顶部/状态/右侧金额/正文/Meta/底部规划动态区域。
自动生成只是最低兜底，AI 必须按业务表、状态机和数据口径精调。禁止用随机数、固定演示数
或无来源值装饰指标；当前页求和必须明确标注“本页”。`EnableViewSchema` 只控制
Detail/Edit 自定义表单，不能用它关闭 List/Card 展示设计。

字段较多的表单必须做视觉分组，但**优先用 `CollapseGroup` 折叠分组**，**只有大业务域（≥8 字段）才用 Tabs**。详细决策表、Config JSON 示例、字段数阈值和回读验收必须先读 `microi-form-layout/SKILL.md`，再按以下快速决策表执行：

| 字段总数 | 业务域拆分 | 推荐方案 |
|---------|----------|---------|
| ≤ 12 | — | **不分组**，全部平铺第一屏 |
| 13 ~ 30 | 不可拆 | `CollapseGroup` 把次要业务域收起 |
| 13 ~ 30 | 可拆且每个域 ≥ 8 | `diy_table.Tabs`（表级 Tab） |
| 13 ~ 30 | 域大小混合（大域 ≥ 8 + 小域 ≤ 7） | `diy_table.Tabs` + Tab 内嵌套 `CollapseGroup` |
| > 30 | 多域 | `diy_table.Tabs`（3~5 个 Tab，每个 Tab 6~12 字段），必要时嵌套 `CollapseGroup` |

**强制禁止**：

- ❌ **禁止**为 ≤7 字段的业务域单独建 Tab（必须改用 `CollapseGroup`，否则用户必须点击 Tab 才能看到 3~5 个字段，违反"首屏信息密度"原则）。
- ❌ **禁止**为 13~30 字段的表把所有字段平铺（必须用 Tab 或 CollapseGroup 分组）。
- ❌ **禁止**在用户没有要求时使用 `Component='Tabs'` 字段级控件（更优先用 `diy_table.Tabs` 表级 Tab）。
- ❌ **禁止**让 CollapseGroup 依赖空 `FormWidth`；CollapseGroup 默认必须显式保存 `FormWidth=24`，并默认设置 `Config.CollapseGroup.ShowFieldCount=true`。Tabs / Divider / Alert 按各自运行时规范处理。
- ❌ **禁止**只创建 Tab 不写字段的 `Tab` 归属（每个 Tab 必须有至少 1 个非空 `Tab` 的字段）。

典型反例：`yutaoliaojieguo` 表 13 字段有"MRP 运算"3 字段 Tab — 这是错误的，应该用 `CollapseGroup` 把 MRP 3 字段收起（默认展开），让用户第一屏看到基础信息 + MRP 字段而不是必须点击 Tab 切换。详见 `microi-form-layout/SKILL.md` 的"反例参考"章节。

表单控件选择必须参考 `Microi.Client/src/views/form-engine/diy-field-component/diy-component-list.json`，包括文本、数字、日期、选择、树、部门、地址、关联表单、弹窗选表、子表、上传、富文本、代码、地图、二维码、布局控件等；普通字段不手动设置 `FormWidth`，整行控件才设 `24`。CollapseGroup 必须显式设 `24`，并默认开启 `ShowFieldCount`。

### 3. 主子表与关联表单设计

先判定关系基数，再生成字段：

- “子表、明细、清单、条目、行项目、多个记录”默认是主表 1:N 子表，使用
  `TableChild`。创建独立子表，在子表放真实父级外键，建立 `(OsClient, ParentId)`
  回查索引，并创建 `Display=0`、`AppDisplay=0`、`HasChild=0` 的子表菜单。
- `JoinForm` 只用于主表保存一个目标 Id、并嵌入一条独立目标记录完整表单的 N:1/1:1
  场景；目标表不能是当前表。需要列表、多行增删改或可能有多条记录时禁止使用。
- `TableChild` 的 `TableChildTableId`、`TableChildSysMenuId`、`TableChildFkFieldName`
  必须引用回读后的真实资源。完整系统 Manifest 使用
  `relation:{cardinality:"1:N",targetTable,childForeignKey,childModule}`，生成器按“全部表与
  普通字段 → 隐藏子表菜单 → 关系字段”分阶段解析当前租户 Id；禁止猜 Id，禁止退化成
  `JoinForm`。
- 基数不清楚时必须在远端写入前询问用户。调用 `microi_plan_system` / `dryRun` 前先做
  关系语义审查。MCP 会硬性拒绝“1:N + JoinForm”、自关联 JoinForm、缺主/子外键、缺
  `Display=0/AppDisplay=0/HasChild=0` 隐藏子菜单或缺 `(OsClient, FK)` 回查索引；AI
  不得改用直接单字段工具绕过。
- 复用已有子表时，优先复用源 `TableChild` 已验证、当前用户有权限的子表菜单；只有不存在
  可复用菜单时才新建隐藏菜单。设计器显示但运行表单不显示时，必须先检查主表 `InFormV8`
  是否通过 `V8.FieldSet`/`hideField` 把目标 TableChild 设为不可见。

`JoinForm` 的可移植 Manifest 只写名称，不写租户 Id：

```json
{
  "name": "CustomerProfile",
  "label": "客户资料",
  "component": "JoinForm",
  "relation": {
    "cardinality": "N:1",
    "targetTable": "Biz_Customer",
    "joinFieldName": "CustomerId"
  }
}
```

`JoinForm` / `OpenTable` 等单记录关联仍需兼顾可读字段，不能只生成一个裸 `XxxId`。

推荐模式：

- `XxxId`：隐藏字段，保存真实 Id。
- `XxxName`：可见 Select/OpenTable/JoinForm，显示业务名称。
- 数据源：优先 SQL 或接口引擎，`SelectLabel` 为名称，`SelectSaveField` 按业务需要保存名称或 Id。
- 值变更事件：选择名称时同步写入隐藏 Id，或选择 Id 时同步名称，保持列表和详情可读。
- 下拉远程搜索无数据时必须结束 loading，显示空状态，不能一直“加载中”。

### 3.1 业务枚举字段一致性

业务枚举或专区、等级、状态、类型字段不能只改前端映射，也不能只改接口引擎逻辑。低代码后台的 `diy_field.Data` / `diy_field.Config` 是 PC 管理端录入数据的事实源之一，必须同步维护。

- 改枚举前先用 MCP 读取目标 `diy_field`，确认 `Component`、`DataSource`、`SelectSaveField` 和现有选项。
- KeyValue 组件必须让后台选项、接口引擎判断值、前端展示/筛选值保持同一套 Key。后台存了旧 Key 时，移动端会查不到或显示不出来。
- 修改字段属性优先使用 `microi_get_field_list` / `microi_update_field` / `microi_refresh_schema_cache`，MCP 缺能力时先补 MCP 或平台通用 API。
- 完成后必须回读 `diy_field.Data` / `diy_field.Config`，并用 Playwright 或接口测试覆盖后台录入值在前端列表、详情、筛选中的显示。

### 4. 示例数据与资源导入

- 每个核心表至少准备 5-10 条可重复测试数据，且能清理重建。
- 业务图片、头像、海报、二维码、商品图、公告图必须通过平台 HDFS/API 或数据库字段进入系统，不要用 `picsum.photos`、`qrserver.com`、`placeholder.com` 等第三方占位服务。
- 图片字段既要验数据库值，也要验前端真实加载。
- 需要二维码时优先用平台接口，例如 `/api/Os/CreateQRCodeImage` 或租户接口引擎生成 HDFS 图片。

### 5. V8 接口引擎与事件

- 接口引擎代码必须格式化、语义版本可追踪、可回读。
- 保存后必须走 HTTP 稳定路径 `/apiengine/{ApiEngineKey}` 并通过 `osclient` Header 传租户做 smoke test；只用内部 run 通过不够。普通 POST/PUT/PATCH/DELETE 禁止追加 `--OsClient--...--`；只有调用方无法设置 Header/Query 的第三方回调才使用 `--OsClient--{OsClient}--`，可使用 Query 时固定为 `?OsClient=`。
- 返回必须是标准 DosResult，除明确文件/HTML场景外，不允许返回字符串 `null`、空响应、非 JSON。
- 业务异常必须给用户可理解的 `Msg`，不能吞异常或只 `catch(e){}`。
- 定时任务、超时取消、VIP 过期、自动拒绝、库存释放等跨时间逻辑，必须建 Job 或可被 Job 调用的接口引擎。
- 交易、库存、积分、余额、审批状态流转必须做后端幂等和权限校验。

### 6. VS Code 插件同步纪律

VS Code 插件必须让用户清楚知道本地和远端是否一致。

- 每次准备推送接口引擎、表单/字段 V8、模块按钮或流程节点 V8 前，必须先运行当前服务器及对应引擎分类的同步状态检测。直接“推送当前文件”也必须自动预检；远端较新、双方冲突、没有同步基线或预检失败时一律停止覆盖。
- 同步状态接口若超时、限流、返回 `Code != 1` 或数据不完整，必须按“检查失败”停止拉取和推送；禁止将缺失的远端结果解释成“服务器无修改”。命令行可用 `npm run sync:status -- --os-client <tenant> --scope <api|form|module|workflow> --conflict-dir <dir>` 保存冲突双方供 AI 合并；确认本地修改与冲突均为 0 后，可用 `--pull --confirm <tenant>` 复用插件拉取链路，禁止绕开预检。
- 单文件推送预检只查询目标文件对应的接口、表、模块或流程节点，不得为推送一个文件扫描整个分类；全量同步状态使用低并发、短间隔批次，避免多人并行开发时触发服务器安全限流。
- AI 只修改少量 V8 文件时，收尾优先逐个执行 `sync:status -- --file <path>`；只有需要做服务器基线盘点或多人交接时才运行全量状态检查。
- 同步状态要显示本地修改数、远端较新数、服务器已删除数、冲突数，以及接口引擎、表单/字段 V8、模块按钮、流程节点的分类数量。
- 已成功推送到数据库的文件不能继续显示为已修改。
- Web 端改过远端代码时，插件要支持检测冲突、查看 diff、手动选择本地/远端/合并。
- Token 过期时优先自动 refresh token；不要频繁让用户重新登录。
- ApiEngine 本地文件推送到 `sys_apiengine.ApiV8Code` 必须是明文代码。历史 Base64 旧数据可以读取时兼容解码，但新保存不得写 Base64。
- ApiEngineKey、ApiAddress、Id 用于缓存或匹配时统一大小写策略，避免大小写导致重复或缓存 miss。
- 生成 MCP Server 后，插件应自动启动或提示一键启动，不要让用户每次手工右键启动。
- “查看同步状态”必须能从数量下钻到具体资源。若提示本地未推送，必须列出接口引擎/表单V8事件/字段V8事件/模块按钮/流程节点V8的 Key、名称、文件路径、本地修改时间和同步基准时间，不能只弹出总数。
- 插件判断本地修改时，若远端代码和本地代码内容一致，应自动对齐 `.microi-meta.json` 与文件 `mtime`；表单事件等 Key 匹配要大小写兼容，避免真实无差异却长期提示“本地未推送”。
- AI 交付前要使用插件口径或完全等价的插件状态复核；最终说明中必须写明本地未推送、远端差异、冲突是否为 0。
- 多人并行开发时按状态处理：`localModified` 才允许推送；`remoteModified` 先拉取；`remoteDeleted` 表示服务器已删除且本地未改，全量拉取必须先备份再清理；服务器已删除但本地也修改时按 `conflict` 处理；`conflict` 必须比较基线、本地和远端后人工合并。正文一致仅时间戳不同则自动校准 meta/mtime。处理后再次检测，不能以“已点击同步”代替结果回读。
- AI 使用 MCP、接口引擎 API 或手写脚本直接写远端 V8 后，必须立刻把远端当前生效代码回读到本地 V8 文件，并同步更新 `.microi-meta.json` 的 `updateTime/filePath` 与文件 `mtime`。只推远端、不校准本地时间戳，会被插件判定为“本地未推送”，属于未完成交付。
- 同步检查不能只看总数。若数量不为 0，必须按“正文一致仅 meta/mtime 不一致 / 远端较新需拉回 / 本地较新需推送 / 冲突需人工合并”分类列出具体文件，并在处理后再次复核到 0 或说明原因。
- 生产环境资金、积分、资产、订单相关 V8 代码不得为了清空同步状态而盲目覆盖远端。远端 `UpdateTime` 晚于本地基线且正文不同，默认先拉远端或做人工合并；只有确认本地是未推送修复时才推送。

### 7. MCP 能力优先级

遇到平台元数据批量修复、示例数据、接口格式化、表单布局、外键 Select、页面按钮、权限、任务调度、工作流、打印、数据源等需求，优先级如下：

1. 已有 MCP 工具直接完成。
2. MCP 缺工具但后端有 API：补 MCP 封装。
3. 后端也缺通用 API：补 `V8EngineController` 或对应平台控制器的通用能力，再补 MCP。
4. 只有租户私有业务逻辑才新建接口引擎。

交付包含 DIY 表时，验收固定审计物理列与 `diy_field` 元数据一致；发现 `Id/CreateTime/UpdateTime/UserId/UserName/IsDeleted` 被列为异常字段时，调用通用修复接口或 MCP `microi_repair_audit_fields` 幂等修复并回读。交付用户个性化首页时，同时验收 Token 绑定保存、站内路由规范化、权限失效回退，以及账号密码、Token 与 SSO 三种登录入口的一致性。

不要用租户接口引擎修平台设计器、全局上传限制、VS Code 插件同步、MCP 元数据写入等平台级问题。

<!-- /microi-progressive:chunk -->
