# microi-client-frontend 详细参考 2

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=microi-client-frontend-008 sha256=4824b3271515717979847b142c1cad88e468c5904d93b23950c59cc90b90c5a4 -->
## 8. 运行时高频坑复盘

### 前端 V8.Http 与后端同构契约

`Microi.Client` 的前端 V8 运行时在 `src/utils/diy.common.js` 挂载 `V8.Http`，实现位于 `src/utils/v8-http.js`。修改 HTTP 能力时必须保持：

- 新接口使用与后端一致的 PascalCase 对象参数：`Get/GetResponse`、`Post/PostResponse`、`Patch/PatchResponse`。
- GET 使用 `GetParam`，POST 使用 `PostParam/PostParamString`，PATCH 使用 `PatchParam/PatchParamString`。
- 通用参数包括 `Url`、`ParamType`、`Timeout/TimeOut`、`Headers/Header`、`FilesByteBase64/FilesByteString/FilesByte`。
- 浏览器端必须 `await V8.Http.*`；字符串方法返回原始文本，Response 方法返回 `Content/Headers/RawBytes/StatusCode/ErrorMessage`。
- 表单事件、按钮 V8 等宿主前端新代码必须优先使用 `V8.Http`，不得再把旧 `V8.Post/Get` 作为新功能首选。
- 历史 `V8.Post/Get` 及其回调、Promise 写法必须继续保留，不能通过重命名或替换破坏旧 V8 代码。
- 相对地址或当前 `ApiBase` 才能自动携带登录头；外部绝对地址禁止自动附加吾码 Token。第三方浏览器请求需满足 CORS。
- 修改后至少运行 `npm run test:v8-http` 和 `npm run build`，并同步前后端代码编辑器提示与官方文档。

### FormEngine 前端封装以 `diy.common.js` 为准

前端 `DiyCommon.FormEngine` 不是后端 `FormEngine` 方法的一比一暴露，动表单引擎数据前必须先查 `Microi.Client/src/utils/diy.common.js` 的真实封装。当前前端方法为：

| 类型 | 方法 |
|------|------|
| 通用底层 | `CommonFormEngineFunc` |
| 单条/列表读取 | `GetFormData`、`GetFormDataAnonymous`、`GetTableData`、`GetTableTree` |
| 新增 | `AddFormData`、`AddFormDataBatch` |
| 修改 | `UptFormData`、`UptFormDataBatch`、`UptFormDataByWhere` |
| 删除 | `DelFormData`、`DelFormDataBatch`、`DelFormDataByWhere` |

这些方法支持 Promise，历史回调参数继续兼容。前端当前没有 `GetTableDataCount`、`GetTableDataTree`、`AddTableData`、`UptTableData`、`DelTableData`、`AddField`；不能因为后端 V8 存在同名或相近能力，就在浏览器端直接调用。

单条新增评论、日志、草稿等业务数据时使用：

```js
await DiyCommon.FormEngine.AddFormData("table_name", {
  Field: "value"
});
```

或：

```js
DiyCommon.FormEngine.AddFormData("table_name", { Field: "value" }, function (result) {});
```

前端 FormEngine 还必须使用统一的菜单上下文封装：

- 当前菜单绑定表会自动补真实 `_SysMenuId`。
- 跨表调用不能继承当前菜单 Id，否则会把无关菜单的数据范围错误套到目标表；未显式指定目标菜单时，由后端从当前用户的版本化授权缓存中推断其对目标表的菜单/表级权限。
- 传入 `_SysMenuId`、历史 `SysMenuId` 或 `ModuleEngineKey` 表示调用方选择了明确菜单，后端必须按该菜单严格校验，失败时不能回退。
- 平台表由服务端分级：管理员专用表全操作硬保护，只读委托表仅在真实菜单/Table `Read` 授权后查询，`mic_page/mic_print` 按角色 CRUD 权限管理；三类都拒绝匿名。前端角色页必须读取服务端授权策略并失败关闭，不维护第二份硬编码表名清单。`_InvokeType:'Client'` 只控制表单事件触发方式，不是授权绕过参数。
- `TableChild` 使用运行时生成的不透明 `_TableChildAuth`；后端会重新验证父菜单、父记录、字段关系、外键和数据范围。业务代码不得手工伪造。
- 导入、导出必须锚定真实菜单；通用 CRUD 的历史无菜单兼容不能扩展到批量数据传输。

前端作用域封装在注入菜单/子表上下文时必须克隆待修改对象，不得把内部 `_SysMenuId` / `_TableChildAuth` 写回调用者；字符串、对象、批量参数、回调和 Promise 语义都要保持兼容。授权快照由后端按租户/用户隔离，使用共享 Redis 版本号和带 TTL 的快照；外部授权检查读取共享版本，权限变更后旧快照不可达，Redis 故障则回源数据库。不能在每次 CRUD 里重新查询整套角色/菜单，也不能用进程内缓存作为多节点事实源。

### OpenAnyTable / 模板 HTML / ConfirmTips 安全边界

- `OpenAnyTable` 应传已授权的 `SysMenuId` / `ModuleEngineKey` 和 `SubmitEvent`，由目标模块按自身表、字段和权限初始化。不要先通过通用 FormEngine 读取 `sys_menu` 来发现任意模块，也不要只传物理 `TableName` 试图绕过菜单。
- 表格/表单 V8 模板结果通过 `v-safe-html` / DOMPurify 渲染；`onclick`、`onerror`、`javascript:` 等危险内容会被移除。交互请使用平台按钮、插槽或安全链接，不要把内联事件写进模板字符串。
- `V8.ConfirmTips` 内部使用 Element Plus 的 HTML 模式。只允许固定可信 HTML；数据库、URL、用户输入等动态值必须先进行 HTML/属性转义，路由参数还要 `encodeURIComponent`。它是回调式确认框，不能假定 `await V8.ConfirmTips()` 会直接返回用户选择。
- 所有用户可见反馈禁止使用浏览器原生 `alert/confirm/prompt`。平台页面使用 `DiyCommon.Tips`、`V8.ConfirmTips`、`ElMessage` 或 `ElMessageBox`；需要 Promise 语义时在调用层封装平台组件，不能退回原生对话框。错误 Toast 与确认层必须 append/teleport 到 body 并固定在当前视口正中央，不能随 `.el-dialog__body`、Tabs 或表格滚动而离开视线。
- 前端 `V8.Base64` 来自 `js-base64`，真实方法是 `encode`、`decode`、`isValid`，不要写成后端的 `StringToBase64/Base64ToString`。

### V8 文档与编辑器提示同步

修改前端 V8 能力、属性、事件名或参数契约时，至少同步核对：

- 运行时：`src/utils/diy.common.js`、`diy-table.vue`、`diy-form.vue`、`diy-form-full.vue` 及其 mixins。
- Monaco 提示：`src/views/form-engine/diy-components/v8-api-definitions.js`。

### DevComponent 聚合多个原字段

不属于通用表单控件、只服务某张平台配置表的复杂设计器，放在 `src/views/form-engine/diy-components/`，不要加入 `diy-field-component` 标准控件目录。选择一个现有物理字段作为 `DevComponent` 入口，在 `Config` 中写 `DevComponentName/DevComponentPath`；组件通过 `FormDiyTableModel` 读取同表其它字段，并同时发出 `ParentFormSet(fieldName, value)` 与 `CallbackFormValueChange` 更新它们。

`sys_menu` 的数据权限设计器固定使用 `SqlWhere` 作为入口，聚合 `SqlWhere / SqlJoin / JoinTables`：

- 组件路径为 `@/views/form-engine/diy-components/diy-data-permission-designer.vue`，名称为 `DiyDataPermissionDesigner`；旧 `SqlJoin/JoinTables` 字段只隐藏，不删除、不改物理列。
- 设计器只保留【可见范围 / 关联关系】两个 Tab：桌面端左侧展示图形配置，右侧固定展示实时 SQL；可见范围右侧的单个代码编辑器展示最终 `SqlWhere`，关联关系右侧的只读代码编辑器展示 `SqlJoin`，窄屏才回落为上下布局。禁止重新加入“原始值”Tab，以及“重新读取 / 应用到表单 / 从原始值反推 / 同步原始值”等手工同步按钮。
- 图形配置变化后应防抖并自动写回 `SqlWhere / SqlJoin / JoinTables`，用户只需保存模块。最终 `SqlWhere` 代码编辑器始终允许手动编辑，不设置“自动生成 / 高级手写”模式开关；只有左侧图形配置变化时才重新生成并覆盖右侧正文，直接手写时以编辑器正文为准。历史手写 SQL 原样进入编辑器，禁止自动拆解成多个 OR 或短暂生成 `1 = 0`。
- 自动生成的最终 `SqlWhere` 使用带固定前缀 `-- 【权限说明】` 的单行中文注释，就近解释外层括号、租户隔离、AND/OR 组合、超级管理员、普通用户范围、全量角色/岗位/部门、图形条件和闭合括号；不得再生成整段 `/* ... */` 说明。后端还要兼容剥离历史 `-- 【吾码权限说明】`。图形配置使用首行紧凑明文 JSON `-- MICROI_DATA_PERMISSION_CONFIG:{...}` 恢复，省略默认值且不重复保存 `SqlJoin/JoinTables`；旧 `-- MICROI_DATA_PERMISSION_V1:...` Base64 marker 只读兼容、不再生成，设计器不得展示 marker。后端执行前只剥离这些平台专用注释，用户手写注释必须保留。`SqlJoin` 继续保存 JOIN，`JoinTables` 继续保存关联表 JSON，后端协议不变。
- 有新旧 marker 的配置必须无损回显；没有 marker 的历史手写 SQL 只能原样保留或安全解析字段提示。标准表单对 `CodeEditor` 使用的 `_CodeEditorTransport` 必须由 FormEngine 控制器在进入业务逻辑前统一解码，数据库只保存明文；非法批次不得产生部分解码。
- 角色、岗位、部门属于查看者放行规则；本人、本人和下级、部门范围属于行范围。超级管理员默认放行，但启用 TenantId 隔离时也不能跨租户。所有表名、别名和字段名生成前做标识符白名单，固定值转义单引号。
- 官方 `microi_itdos` 与开发租户更新 `diy_field` 后都要刷新 `sys_menu` 表/字段缓存并回读 `Component/Visible/AppVisible/Config`；应用商城资源同步修改 `Microi.Upgrade/Resource/app.microi.module-engine.json`。
- 官方文档：`microi.doc/docs/doc/v8-engine/v8-client.md`。
- Skills：`v8-frontend-events`、`v8-table-event`、`v8-menu-buttons`、`v8-template-engine`、`v8-formengine-http` 和本 Skill。

`sys_menu.ViewSchema` 使用 `DiyModulePresentationDesigner` 作为配置入口，聚合 `EnableViewSchema / ViewSchemaVersion / ViewConfigVersion / ViewSchema`。设计器固定提供“模块标题与统计 / PC 复合列 / 移动端卡片 / 自定义表单 / 高级 JSON”五个 Tab；可视化编辑默认 List-PC 与 Card-Mobile 视图，以独立的“自定义表单”JSON 编辑 Detail/Edit，并由高级 JSON 保留完整协议、角色视图和未知字段；运行时的 EntityHero/MetricStrip 等仍是独立展示区块，不由 DevComponent 参与渲染。

固定高度的 `diy-form-full` 弹窗只能有一个纵向滚动容器：由弹窗直属 `.el-dialog__body` 承载滚动，Element Plus 的 overlay 和表单顶层 `.el-tabs__content` 必须禁用独立滚动。禁止同时保留 overlay、dialog body、tabs content 三层纵向滚动条；切换表单 Tab 时弹窗外框高度不得变化。

自动化静态检查至少覆盖方法名、事件名、示例参数和危险 HTML；真实页面还要验证表单/列表两种上下文、普通角色菜单范围、跨表历史 V8、TableChild、并发 Token 续签及移动端。

### Pinia persisted-state 覆盖 state 默认值

当主题色、语言、布局等状态同时支持“系统默认值”和“用户手动选择”时，不能只在 `state()` 中写 fallback。Pinia persisted-state hydrate 会在 store 初始化后把本地旧值覆盖回来，导致 `SysConfig.ThemeColor` 等系统默认永远不生效。

通用规则：

- 本地值只表示用户显式选择；系统默认值应在计算属性/运行时兜底中读取。
- 对历史默认值（如 `#409eff`）要在 persisted-state `afterHydrate` 中归一化为空，避免旧默认被误判为用户手动选择。
- 主题色相关组件、图标、导航、移动端个人中心都要使用同一条 fallback：用户手动值 > `SysConfig.ThemeColor` > 平台默认值。

### Element Plus 弹层 teleport 导致父弹层提前关闭

`el-date-picker`、`el-select` 等组件默认可能把面板 teleport 到 `body`。如果它们位于 `el-popover`、列头菜单、自定义 document-click 菜单里，选择日期/下拉项会被父级误判为外部点击，导致搜索弹窗立即关闭、筛选无法完成。

通用规则：

- 嵌套在父弹层内的日期/下拉控件优先设置 `:teleported="false"`。
- 自定义 document click 关闭逻辑必须忽略 `.el-popper`、`.el-picker__popper`、`.el-select__popper` 内部点击。
- 修改后要验证：打开更多搜索 -> 选择日期 -> 面板不提前关闭 -> 应用筛选成功。
  - `V8CodeShow: return false;` 是否隐藏。
  - `V8CodeShow: return true;` 是否显示。
  - `V8CodeShow: V8.Result = false;` 是否仍兼容。

### 复盘：模板渲染期间构造 V8 上下文导致递归更新

- 触发场景：列表行按钮通过 `V8.OpenDialog` 首次打开打印引擎等异步组件时，页面报 `Maximum recursive updates exceeded in component <DiyTableRowlist>`，严重时浏览器卡死。
- 根因：模板绑定直接调用 `GetDiyCustomDialogDataAppend()`；该方法内部执行 `SetV8DefaultValue()`，而后者会更新表格选择态、工作流和 V8 缓存等响应式数据，形成“渲染 -> 写状态 -> 再渲染”的闭环。
- 通用规则：模板渲染函数必须保持无副作用。弹窗所需 V8 上下文应在 `OpenDialog` 点击事件中一次性生成并保存，模板只绑定稳定的数据对象；禁止在模板表达式、render 函数、computed getter 中调用会写响应式状态的方法。
- 自动化检查：在真实列表点击一次和连续点击两次 `V8.OpenDialog` 行按钮，断言弹窗正常打开、页面仍可交互，控制台不出现 `Maximum recursive updates`、Vue errorHandler 或未处理 Promise 错误。

### Element Plus 弹窗默认交互

新增或改造 `Microi.Client` 的 `el-dialog` 时，默认必须上下左右居中并支持 PC 端标题栏拖动。除非有明确的移动端抽屉/全屏业务理由，否则不要让弹窗贴在左上角、底部或跟随内容自然流偏移。

落地规则：

- `el-dialog` 默认添加 `align-center` 和 `draggable`；复杂弹窗建议 `append-to-body`，避免被局部容器裁切。
- 弹窗宽度用响应式约束，如 `width="min(1280px, calc(100vw - 48px))"`，避免宽屏过窄、窄屏溢出。
- 标题栏应保持清晰的拖动热区，可给 `.el-dialog__header` 设置 `cursor: move`，但不能遮挡关闭按钮。
- 弹窗内部的表格、树、编辑区要设置稳定高度或最大高度，避免内容撑出视口导致默认居中失效。
- 修改后验收默认打开态和拖动后状态：弹窗仍在可视区域内，标题/按钮/输入框不被导航、遮罩或浏览器边缘遮挡。
- 对长内容弹窗还要分别滚到顶部、中部和底部触发一次错误反馈/二次确认，断言提示层仍以当前视口为基准居中；静态扫描同时禁止 `window.alert`、`window.confirm`、`window.prompt` 及对应全局别名。

### 内容 Loading 统一使用主题骨架

- `Microi.Client` 的异步内容区统一使用 `v-mci-loading:<variant>`，语义变体为 `table/cards/form/detail/page/stats/list/tree/compact`；菜单异步路由在守卫开始/结束时驱动页面骨架，全屏内容导入使用 `openMciLoading()`。
- 平台主题由 `theme-color.js` 同步生成 `--mci-skeleton-surface/card/header/base/highlight/accent/border`；骨架样式只能消费这些语义令牌，禁止在组件里写亮/暗两套硬编码颜色，禁止新增半透明 `.el-loading-mask`。
- `diy-table` 首屏/筛选重载使用表格或卡片骨架，移动追加使用底部 `compact` 骨架；`diy-form` 把骨架挂在根容器，不能依赖尚未加载完成的 Tabs。请求完成前禁止渲染空态。
- 头像、验证码、私有图片/文件缩略图使用圆形或媒体骨架；旧表单依赖的 `./static/img/loading.gif` 可继续作为内存中的状态哨兵，但渲染前必须拦截，禁止作为 `<img>`、`<el-image>` 或背景图 URL 发起网络请求。
- 保存/提交/登录验证等动作保留按钮 Loading，可信百分比保留真实进度；其余 spinner、转圈图标和“加载中”文案不得充当内容加载态。
- 修改后运行静态门禁，确认源码不存在内容型 `v-loading`、`ElLoading.service`、硬编码黑色 Loading mask 或加载期空态；再用真实浏览器验证菜单、首页、表格、表单详情在亮色、暗色、自定义主题和移动端下的骨架几何、对比度、`aria-busy`、reduced-motion 及请求失败收口。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-client-frontend-009 sha256=11a3c4fd1667c1309832387d79dd98ca14b64d8c60b5a54c0b8ac4237e22d0e4 -->
## 7.1 登录验证码与 Sys_Config

修改 `Microi.Client/src/views/login/index.vue` 或任何 PC 端登录扩展时，必须遵守平台登录验证码契约：

- 登录页加载系统配置后，用统一的 `isEnabledFlag(SysConfig.EnableCaptcha)` 判断是否开启验证码。`EnableCaptcha` 可能是 `1`、`true`、`'1'`、`'true'`，不能直接 `!!SysConfig.EnableCaptcha`。
- 开启时显示验证码输入框，调用 `GET /api/Captcha/GetCaptcha` 获取图片，读取响应头 `captchaid`，调用 `/api/SysUser/login` 时提交 `_CaptchaId/_CaptchaValue`。
- 登录失败时刷新验证码并清空输入；未开启时隐藏验证码并且不提交空验证码字段。
- PC 端和移动端都调用同一个后端登录契约，不能只在某一端支持验证码。
- 修改后要至少验证 `EnableCaptcha=1`、`EnableCaptcha='1'`、`EnableCaptcha=false` 三种情况。

文件同步、跨平台导入等需要登录另一套 Microi API 的前端工具，也必须复用同一验证码契约：

- 用户填写远程 `ApiBase` 和 `OsClient` 后，先请求远程 `/api/FormEngine/GetSysConfig`，按 `isEnabledFlag(EnableCaptcha)` 判断是否需要验证码，不能先盲目调用登录接口。
- 需要验证码时，自动请求远程 `/api/Captcha/GetCaptcha?OsClient=<OsClient>`，读取响应头 `captchaid` 并显示验证码图片；用户输入后，远程 `/api/SysUser/login` 必须同时提交 `_CaptchaId/_CaptchaValue`。
- 远程地址或租户变化时清空旧验证码和 Token；登录失败时刷新验证码。未开启验证码时不得显示验证码输入，也不得提交空验证码字段。
- 远程响应头必须通过 CORS 暴露 `captchaid` 和 `authorization`；前端还应兼容登录响应体中的 Token，避免只依赖响应头。

### PC/移动自适应 Token 续签

- PC 登录传 `_ClientType:'PC'`；`diyStore.IsPhoneView` 的移动自适应登录传 `_ClientType:'Mobile'`。完整协议以 `microi-frontend-sdk/SKILL.md` 为准。
- `DiyCommon.getToken()` 是 Microi.Client 请求发送时的 Token 单一事实源；不得先用 Pinia、组件 data 或其它副本判断“是否需要携带 X-Token”，否则持久化恢复或并发续签后会把有效 Token 漏掉。受保护请求收到新 `authorization/token` 后，必须先更新公共存储，再同步 Pinia；登录成功也要在生成动态路由前完成同样的同步。
- `TokenExpires` 表示“下次应检查续签的时间”，不能固定成所有终端 15 分钟；应从 JWT `exp` 和 `MicroiTokenIssuedAt` 按 10% 提前量计算，最少 5 分钟、最多 1 天。
- `App.vue` 除一分钟维护定时器外，还必须监听 `visibilitychange`、`focus`、`pageshow`。标签页从浏览器休眠恢复时先走 single-flight RefreshToken，再发业务请求。
- `Code=1001/1002` 或明确的 `NoLogin / Token签名验证失败` 时展示后端原始 `Msg`。确认失败响应对应的仍是当前 Token 后，必须清理 Token，并携带当前 Hash 用 `location.replace` 完整进入登录页，重建旧页签的动态路由与组件状态，禁止停留在空白页。
- 多 Tab 共享 Token 时，旧请求返回不得覆盖新 Token，也不得因旧 Token 的失效响应清除另一个 Tab 已写入的新 Token。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-client-frontend-010 sha256=d89bb60734da788a027790c666287db8b6cda862e8f5fb3806543b07b3cce94c -->
## Microi 前端 SDK 约束

当修改 `Microi.Client` 之外的 Vue3 前端、PC 官网、移动 H5 或定制微前端页面时，必须优先读取 `microi.skills/microi-frontend-sdk/SKILL.md` 并使用 `microi.skills/microi.v8.js`。`Microi.Client` 主后台已有平台请求与 Pinia 体系时，可以复用现有平台能力；但新增独立页面、外部站点、插件页、嵌入式页面不得再复制旧 Vue2/Vuex 版 `microi.v8.js`。

- 只保留 Vue3 写法，不新增 `Vue.prototype`、Vue2 条件编译或 Vuex 依赖。
- 业务请求、Token、上传、资源 URL 解析统一委托 SDK 或 Microi.Client 现有平台请求层。
- 后台仍使用 Element Plus；官网/产品站/文档站优先遵守 `microi.skills/ui-design/SKILL.md` 的 MCI-UI 策略。

<!-- /microi-progressive:chunk -->
