# microi-client-frontend 详细参考 1

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=microi-client-frontend-005 sha256=c4aeb714b7eaa724eb7ac8667d474e0707e76c79dcf02c106e8c5b25a1e0ef17 -->
## 3. 动态按钮系统

按钮配置来自 `sys_menu`：

| 字段 | 渲染位置 |
|------|----------|
| `MoreBtns` | 列表行按钮/更多按钮 |
| `FormBtns` | 表单右上角、移动端 FAB |
| `BatchSelectMoreBtns` | 列表多选后批量按钮 |
| `PageBtns` | 列表页顶部按钮 |
| `PageTabs` | 列表页 Tab |
| `ExportMoreBtns` | 导出下拉扩展 |

`PageTabs.TargetSysMenuId` 是通用的跨模块页签协议。未配置时继续执行当前模块的页签 V8；配置其它 `sys_menu.Id` 时，`diy-table.vue` 使用动态路由替换当前地址，让目标模块按自身 `sys_menu / diy_table / diy_field` 完整重建，并移除旧的顶部访问标签。不得为应用商城或其它单一模块在 schema/data mixin 中增加专用数据源分支。

按钮显隐链路：

1. `DiyCommon.ForConvertSysMenu()` 把 JSON 字符串转成数组并补默认值。
2. `HandlerBtns()` / `HandlerBtnsAsync()` 遍历按钮。
3. `LimitMoreBtn()` / `LimitMoreBtnAsync()` 构建前端 V8 上下文。
4. 执行 `btn.V8CodeShow`，支持两种写法：

```js
return V8.Form.Status == '待审核';
```

```js
V8.Result = V8.Form.Status == '待审核';
```

5. 点击时 `RunMoreBtn()` 执行 `btn.V8Code`。

修改按钮逻辑时必须同时检查：

- `diy-form-full.vue`：表单 `FormBtns`。
- `mixins/diy-table-actions.mixin.js`：列表按钮、PageBtns、BatchSelectMoreBtns、PageTabs 等。
- `left-right/RightView.vue`、`left-right/RightForm.vue`：旧版左右布局兼容。
- `src/utils/v8-button-visibility.js`：统一的 `V8CodeShow` 执行与布尔结果解析。

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-client-frontend-006 sha256=f2cb2548a184ceb086733d032e16d9a6870cb037c661671eb8c8a6cf2e694e60 -->
## 5. 路由与打开方式

登录首页支持“用户 > 系统 > 首个可访问菜单”的三级优先级：

- 用户级首页保存到 `sys_user.DefaultIndexUrl`，系统级首页继续使用 `SysConfig.DefaultIndexUrl`；账号密码、Token 直达和 SSO 登录必须共用同一套跳转逻辑。
- “个人设置”只能展示当前用户实际有权访问的动态路由，保存接口必须从 Token 绑定当前用户和 `OsClient`，不能接受前端传入任意用户 Id。
- 路由保存前统一规范为站内绝对路由；拒绝外部 URL、协议相对 URL、反斜杠、登录页和控制字符。用户失权或菜单被删除后自动回退，不能造成登录循环或空白页。
- `Id/CreateTime/UpdateTime/UserId/UserName/IsDeleted` 等审计列必须复用真实或合成的 `diy_field` 元数据，像普通列一样打开列头高级搜索；不要为审计列另写一套不可搜索的展示分支。

`diy-form-full.vue` 支持三类形态：

| 打开方式 | 特征 |
|----------|------|
| Dialog | `ShowFieldForm=true`，内部 `DiyForm` 使用 `ref="fieldForm"` |
| Drawer | `ShowFieldFormDrawer=true`，`onDrawerOpened()` 中调用 `fieldForm.Init()` |
| Page | 路由 `/diy/form-page/:TableId/:TableRowId?`，`IsPageMode=true`，内部 `fieldFormPage` 通过 props 自动初始化 |

Page 模式要特别注意：

- `SysMenuId` 可能来自 query `SysMenuId`、query `Id`、或 route meta。
- `CallbackSetFormData` 到达后才能可靠评估 `FormBtns`，因为此时才有当前表单数据。
- keep-alive 会触发 `activated/deactivated`，不要只在 `mounted` 里写一次性逻辑。
- `diy-design.vue` 会复用同一个命名路由与 keep-alive 实例。必须以 `TableId + PageType` 作为表单实例 Key，并监听 `$route.fullPath`、在 `activated` 中同步路由上下文、清理旧表字段状态并重新加载；只依赖首次 `mounted` 会造成从列表跳转后白屏或显示上一张表。

### `/online-office` 匿名只读路由

- 路由 `meta.anonymous=true` 只表示无需登录即可进入页面，不代表页面内的文件自动公开。组件仍必须校验文件边界。
- 匿名公有存储场景只允许当前 `OsClient` 目录下的 `filePathName`；接口响应文件场景用 `fileUrl` 接收当前平台正式 `ApiBase`，或由同端口本地后端读取的 loopback `/apiengine/...`，并要求 URL 显式携带当前 `OsClient`。两种场景都拒绝私有文件、跨租户路径、路径穿越和任意第三方域名。
- `fileUrl` 路径没有文件扩展名时必须同时传 `fileName` 或 `fileType`。组件先调用 `/api/HDFS/PrepareOfficePreviewFromUrl`，由后端严格校验当前平台、当前 `OsClient` 和单层 `/apiengine/{key}`，再把响应文件透明缓存到当前租户公有对象存储；OnlyOffice 使用返回的公网静态地址。开发环境 loopback 只允许同端口本地后端读取，不能简单替换 origin，也不能把该接口扩展成通用 URL 代理。
- `canEdit` 不能直接作为授权结果。最终允许编辑必须同时满足有效登录态；匿名即使传 `canEdit=1` 也强制使用 OnlyOffice `mode:'view'` 和 `permissions.edit=false`。
- 私有文件调用 `/api/HDFS/GetPrivateFileUrl` 时传 `ForOfficePreview:true`，让远程 OnlyOffice 使用租户公网 `ApiBase` 的审计代理地址，避免 `localhost` 导致“下载失败”。
- `layout/index.vue` 仅在“路由要求隐藏外壳且当前无有效登录用户”时隐藏 Sidebar/Navbar/TagsView；登录用户打开同一路由仍保留正常系统布局。
- 不要把匿名路由简单加入全局白名单后跳过组件鉴权；过期 Token 要清理，公有文件校验失败必须停止创建 OnlyOffice 配置。

### 在线微服务弹窗（OpenAppDialog）

`V8.OpenAppDialog` 是 V8 定制页面的标准入口，宿主实现位于：

| 文件 | 职责 |
|------|------|
| `views/micro-app/dialog.vue` | 按 `AppKey` 解析稳定入口 `/micro-app/{OsClient}/{AppKey}/index.html?v={Version}`；版本只用于缓存失效，不得写进入口路径。 |
| `views/form-engine/mixins/diy-table-navigation.mixin.js` | 向列表、PageBtns、MoreBtns、BatchSelectMoreBtns 暴露 `OpenAppDialog`。 |
| `views/form-engine/mixins/diy-form-navigation.mixin.js` | 向表单 V8 暴露同一套 `OpenAppDialog` 参数。 |
| `views/form-engine/diy-table.vue`、`diy-form.vue` | 将方法挂到运行时 `V8` 对象并承载通用弹窗。 |

扩展或修复时必须保持表格与表单两条入口的参数一致：`AppKey`、`RoutePath/MicroRoute`、`Version`、`Title`、`TitleIcon`、`Width`、`OpenType`、`Data`、`OnSuccess`、`OnCancel`、`OnError`。

- `Data` 映射为子应用的 `dialogData`，必须是普通业务数据；函数回调保留在宿主，不放进 micro-app data。
- 宿主自动下发 `apiBase`、`osClient`、`token`、`appKey`、`version`、`microRoute`、`dialog:true` 和 `route`。
- 子应用发送 `app-dialog:success` 或 `app-dialog:cancel` 后自动关闭；`app-dialog:error` 只触发错误回调，不自动关闭。
- `OpenAppDialog` 用于发布后的在线微服务；`OpenDialog` 用于前端源码中预注册的 Vue 组件。
- Token 通过 micro-app data 下发，禁止拼进加载 URL，避免日志、历史记录和代理链路泄露。
- 新增参数或修改返回协议时，必须同步更新 `microi.doc/docs/doc/v8-engine/v8-client.md`、`v8-menu-buttons/SKILL.md` 和 `v8-frontend-events/SKILL.md`。

---

### 系统子菜单入口页（MenuChildrenGrid）

`Microi.Client/src/views/system/menu-children-grid.vue` 是左侧父级菜单的落地入口页。修改此类页面时必须同时读取 `microi.skills/ui-design/SKILL.md` 的“PC 后台菜单宫格 / 入口页规范”。

- 不要让宽屏通过纯 `auto-fill + 1fr` 一行挤出 10 个以上菜单；常规后台宽度推荐 6-8 个入口/行，并通过固定列宽、`max-width` 和 `justify-content:start` 控制密度。
- 菜单卡片必须宽高一致，图标、菜单名称、子菜单统计要按固定槽位对齐；有无子菜单统计都不能导致标题位置上下漂移。
- 子菜单统计应靠近菜单名称，间距约 4-6px；卡片内部必须保留足够 padding，不能让图标、标题或统计贴边。
- 改完必须截图验收桌面宽屏和移动宽度，重点检查每行数量、图标/标题/统计对齐、文字溢出和横向滚动。

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-client-frontend-007 sha256=fa5d43239311945bd4a004763c0a6fa5295113b24965a73849e0f09d7b73d393 -->
## 6. 修改前必查清单

### `diy-table` 嵌入分页条数

- 定制页或界面引擎嵌入 `diy-table.vue` 时，可通过 `PageSizeList` props 追加分页条数，例如首页使用 `[10]`。
- `PageSizeList` 必须与系统 `PageSizes`、菜单默认条数合并后转为正整数、去重并升序排列，不能覆盖系统已有候选值。
- `sys_menu.DefaultPageSize` 明确配置时优先采用菜单值；未配置时默认采用最终候选列表中的最小值，保证紧凑嵌入页能稳定使用 10 条而不被全局默认值改回 15 条。
- 界面引擎、工作台等移动端嵌入列表应传 `PropsEmbedded=true`：隐藏独立列表页的固定移动端返回栏和全局 FAB，同时让有权限的新增、PageBtns、批量操作继续在当前容器工具栏显示，避免按钮漂浮覆盖其它首页组件。

修改 `Microi.Client` 前，至少搜索：

```text
目标方法名 | 目标字段名 | V8CodeShow | SysMenuModel | CallbackSetFormData | HandlerBtns | RunMoreBtn
```

并确认：

- 方法是否在 mixin 中，而不是当前 SFC。
- PC/移动端是否有两套模板。
- Page/Dialog/Drawer 是否都需要同样修复。
- 旧版 `left-right` 是否仍需兼容。
- 是否同时影响列表页按钮和表单按钮。
- 是否需要更新 `microi.skills/v8-menu-buttons/SKILL.md` 或前端 V8 typings。

---

<!-- /microi-progressive:chunk -->
