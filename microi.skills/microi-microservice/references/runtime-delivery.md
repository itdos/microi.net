# MicroService 运行与交付参考

## 数据流

```text
在线 AI / MCP / VS Code
  ├─ 应用主数据 -> sys_microistore
  ├─ 私有源码 -> mci_ai_app_file -> 私有 HDFS
  └─ 构建发布 -> sys_microiservice + sys_microiservice_page
                                      └-> 公有构建产物
后台菜单 / 表单 DevComponent / V8.OpenAppDialog -> 微应用宿主
```

`ApplicationType=MicroService` 表示运行类型；官方/社区来源是独立字段，不能混用。

## 清单

`.microi-micro-app.json` 核心字段：

- `schemaVersion`
- `runtime`
- `appKey`
- `name`
- `osClient`
- `apiBaseUrl`
- `entry`
- `distDir`
- `routeManifest`
- `version`

不要将本地项目的 AppKey 改成另一个已存在应用 Key。

`microi.routes.json`：

```json
[
  {
    "path": "/",
    "name": "home",
    "title": "首页",
    "sort": 0,
    "isHome": true
  },
  {
    "path": "/order/edit",
    "name": "order-edit",
    "title": "订单编辑",
    "sort": 10
  }
]
```

路径必须稳定并以 `/` 开头。迁移历史内置页面时可维护
`LegacyMenuUrls/LegacyComponentPaths`，让新旧书签在过渡期共存；
`LegacyComponentPaths` 也作为表单 `DevComponentPath` 到微服务页面 RoutePath 的稳定别名。

## MCP 读取/写入

| 工具 | 作用 |
|---|---|
| `microi_list_applications` | 列出应用与文件 |
| `microi_get_application_context` | 默认读取元数据、哈希、运行时和页面；按需显式读取内容 |
| `microi_get_application_file` | 读取单文件 |
| `microi_get_microservice` | 回读已发布运行时 |
| `microi_create_microservice` | dry-run/创建运行元数据 |
| `microi_sync_microservice_source` | 同步私有源码；本地工程首选绝对路径 `directory` |
| `microi_publish_application_directory_stream` | 流式发布真实构建目录 |
| `microi_publish_microservice` | 小产物兼容发布 |

`replace=true` 会清理源码清单外的旧元数据，属于覆盖性写入；必须先展示文件差异并
获得明确确认。超时先回读，不重复发布。

本地源码目录由 MCP 进程直接扫描和读取，AI 只看路径、大小、哈希与清单；禁止生成
`.sync-seg-*`、`sync-source-files.json` 或手工 Base64 分段。单个源码超过模型读取上限时仍保持
一个真实文件。`sourceFiles` 只保留没有本地目录时的旧调用兼容。

真实构建目录一律使用逐文件 multipart 流：默认/硬上限为 20,000 文件、总计 20GB，
文件体不进入 JSON、Base64 或 Jint。`StorageMode=db` 的 256 文件/5MB 仅用于小型
应急恢复，不能作为大项目发布器。发布器必须持久化同一交付批次的
`DeliveryBatchId`、`SourceManifestHash`、`RuntimeManifestHash`。

## 菜单路由

友好路由：

```text
/micro-app/{MsKey}/{RoutePath}
```

菜单配置：

- `OpenType=MicroService`
- `MicroServiceId`
- `MicroServicePageId`
- `MicroServiceRoutePath`
- `MicroServiceKey`
- `ComponentPath=/micro-app/host`
- `ModuleEngineKey`（宿主权限上下文）

无需导航的内部页面直接在 `sys_microiservice_page.RouteMetaJson` 设置
`InternalOnly=true`；不再依赖伪造的隐藏 `sys_menu` 才能刷新友好路由。真正需要菜单
导航的页面再创建 `sys_menu`，错误设置 `HasChild` 会让菜单只展开不打开。

## OpenAppDialog

```javascript
V8.OpenAppDialog({
  AppKey: 'order-app',
  RoutePath: '/order/edit',
  Title: '编辑订单',
  Width: 'min(960px, calc(100vw - 32px))',
  OpenType: 'Drawer',
  Data: { Id: V8.Form.Id },
  ModuleEngineKey: 'authorized-module-key',
  OnSuccess: function (data) {
    V8.RefreshTable({ _PageIndex: -1 });
  },
  OnCancel: function () {},
  OnError: function (error) {
    V8.Tips(error.message || '应用加载失败', false);
  }
});
```

回调函数必须在顶层，不放 `Data`。`OpenAppDialog` 只加载已发布 MicroService；
`OpenDialog` 加载主前端注册组件。

## 表单引擎定制组件

需要把复杂区域固定嵌入表单时，字段使用 `Component=DevComponent`，并让
`Config.DevComponentPath` 匹配目标页面 `RouteMetaJson.LegacyComponentPaths`。主前端能找到
同路径 Vue 文件时仍加载本地组件；找不到时才查询启用的 `sys_microiservice_page` 并由
`micro-app/dev-component.vue` 加载该页面 `RoutePath`。新项目应使用不会与 `/src/views` 真实文件
冲突的虚拟路径。

组件宿主下发 `componentMode=true`、`componentData`、`microRoute`、当前 Token/OsClient 和
`permissionContext`。`componentData` 仅包含可序列化表单上下文，不传函数、Vue 实例、循环引用或
`ParentV8`。子应用使用：

```javascript
window.microApp.dispatch({ type: 'dev-component:resize', height: 520 });
window.microApp.dispatch({
  type: 'dev-component:event',
  event: 'update:modelValue',
  args: [{ status: 'passed' }]
});
```

高度限制为 80～1600px；表单联动还可上报 `CallbackFormValueChange`、`FormSet`、
`ParentFormSet`。验收覆盖 Add/Edit/View/只读、字段值回写、窄屏/暗色以及有权/无权账号。

## 子应用宿主数据

```javascript
const host = window.microApp?.getData?.() || {};
```

常见字段：`apiBase`、`osClient`、`token`、`menuId`、`moduleEngineKey`、`diyTableId`、
`permissionContext`、`appKey`、`version`、`microRoute`、`dialog`、`dialogData`、
`componentMode`、`componentData`。只在内存中使用 Token。

独立访问时没有宿主 Token：先配置清单中的 `apiBase/osClient`，读取 `V8.GetSysConfig(true)`，
没有有效本地 Token 才显示吾码帐号密码登录；按 `EnableCaptcha` 动态请求验证码并向 `V8.Login`
提交 `_CaptchaId/_CaptchaValue`。嵌入菜单、表单定制组件或弹层时复用宿主身份，不显示第二套登录。

`permissionContext={sysMenuId,moduleEngineKey,diyTableId}` 只帮助子应用选择正确的 FormEngine
模块上下文，不能授予权限。无权限时依次核对 Token/OsClient、模块 Key、宿主上下文和角色授权；
禁止去掉权限参数、改匿名接口或硬编码管理员 Token。

页面根容器使用 `min-height: var(--micro-app-available-height, 100vh)`，让后台菜单、弹窗和
移动端共享宿主实测高度；不要在嵌入模式直接固定 `100vh`。宿主高度变化时还会通过
`host:resize` 数据事件下发 `hostViewport`，画布、图表等需精确像素的组件据此重新布局。

菜单页采用单一纵向滚动所有者：自然增高的长页面由 `<micro-app>` 边界兜底滚动；需要内部
sticky/虚拟列表时，子应用以宿主可用高度约束自己的滚动容器并设置 `overflow-y:auto`，框架边界
因不再发生内容溢出而不显示滚动条。不要同时让宿主外层、微服务边界和自动高度根节点都承担滚动。

子应用通过模板 SDK 调用接口，不自行发明认证协议。关闭/结果使用宿主约定的
success、cancel、error/close 事件；业务写入成功后再报告 success。

## 版本与回滚

- 每个发布版本保存入口、文件清单、哈希和页面清单。
- 新旧版本资源路径可共存，运行时切换版本后再清理旧产物。
- 发布失败不能覆盖最后一个可运行版本。
- 回滚同时恢复运行版本和页面路由，不只改版本文本。
- 切换前由当前 Token 的 OsClient 解析子租户 HDFS，并逐文件读回校验大小、SHA-256、入口完整 HTML；主租户默认配置不能作为回退。
- 状态按 `Staged -> Verified -> Published` 推进，只有稳定入口 HTTP 200、HTML Content-Type 且含 `<head>/<body>` 才能报告成功。
- 商城/离线包需明确是否包含私有源码；只有公有构建文件的包可以运行但不能拉回源码继续开发。
