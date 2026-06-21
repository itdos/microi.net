# 前端微服务

吾码 Vue3 前端微服务用于解决 SaaS 多租户定制页面的交付问题：同一套吾码前后端程序可以服务多个客户，每个客户又可以拥有独立的 Vue3 定制页面。微服务项目既可以独立运行，也可以编译后上传到吾码数据库记录和分布式文件系统中，由主平台按菜单动态加载。

## 适用场景

- 100 个客户有 100 套不同定制 Vue3 页面，不希望全部打进 `Microi.Client` 主包。
- 定制页面需要本地独立开发、独立调试、独立构建。
- 生产环境不想为每套定制页面单独发布 Docker 镜像。
- 后台菜单需要直接打开某个微服务的某个内部页面或路由。

## 核心表

| 表 | 作用 |
|---|---|
| `sys_microiservice` | 微服务主表，保存微服务名称、Key、运行时、当前版本、入口文件、构建清单、构建产物文件列表、大小、发布时间等。 |
| `sys_microiservice_page` | 微服务页面/路由子表，保存一个微服务包含哪些页面、路由、入口地址、排序和启用状态。 |
| `sys_menu` | 菜单表，`OpenType=MicroService` 时绑定某个微服务和某个页面。 |

`sys_microiservice` 表单中应通过 `TableChild` 显示 `sys_microiservice_page` 子表。子表菜单可以是隐藏菜单，不需要在左侧菜单显示。

隐藏子表菜单必须设置 `Display=0`、`AppDisplay=0`、`HasChild=0`。如果隐藏子表菜单开启“是否有子集”，左侧菜单会把上级 `微服务` 误判成只能展开的父菜单，导致点击上级业务菜单时打不开列表页。

## 构建产物存储

推荐模式是文件存储：

1. VS Code 插件执行构建，生成 `dist/`。
2. 插件把 `index.html`、JS、CSS、图片、字体等文件上传到吾码分布式文件系统。
3. `sys_microiservice.AssetsJson` 保存文件上传组件需要的文件列表。
4. `sys_microiservice.AssetManifestJson` 保存构建清单、版本、哈希、路由清单、文件列表和发布时间。
5. 主平台通过 `/micro-app/{OsClient}/{MsKey}/index.html` 加载入口文件。

不推荐把大体积 JS/CSS 直接以内联 JSON 存储到数据库字段中。小型示例可以这样做，但真实项目依赖多、页面多时，文件系统/CDN 更适合缓存、传输和排错。

## 本地项目结构

VS Code 插件会在工作区根目录创建：

```text
Microi-MicroApp/
  iTdos/
    .microi-micro-app.json
    microi.routes.json
    package.json
    vite.config.js
    src/
      microi.js
      utils/microi.v8.js
      pages/
```

同一个 `OsClient` 可以创建多个微服务目录，例如：

```text
Microi-MicroApp/iTdos
Microi-MicroApp/iTdos~2
Microi-MicroApp/iTdos~项目管理
```

## 路由清单

微服务项目必须维护 `microi.routes.json`，由插件推送时同步到 `sys_microiservice_page`：

```json
[
  { "path": "/", "name": "home", "title": "微服务首页", "sort": 0, "isHome": true },
  { "path": "/menu1", "name": "menu1", "title": "测试微服务菜单1", "sort": 10 },
  { "path": "/menu2", "name": "menu2", "title": "测试微服务菜单2", "sort": 20 }
]
```

不要从 Vue 源码里猜测路由。显式 route manifest 更稳定，适合多次推送时新增、更新和删除页面。

## 菜单绑定

在 `sys_menu` 中创建菜单时：

1. 打开方式选择 `微服务（MicroService）`。
2. 选择微服务。
3. 选择微服务页面。
4. 系统自动回填 `微服务路由`、`Url`、`ComponentPath=/micro-app/host`。

最终菜单 URL 通常类似：

```text
/micro-app/itdos/menu2
```

用户实际访问时，主平台路由是：

```text
/#/micro-app/{MsKey}/{RoutePath}
```

宿主组件会读取菜单 meta 中的微服务入口和 `MicroServiceRoutePath`，实际加载后端产物入口 `/micro-app/{OsClient}/{MsKey}/index.html`，再把内部路由通过 `data.microRoute` 和 `default-page` 传给子应用。

## 子应用调用吾码接口

微服务项目应使用 `src/utils/microi.v8.js`，并在启动或接收宿主 data 时同步上下文：

```js
export function configureMicroiV8() {
  const ctx = getMicroiContext();
  const next = { apiBase: ctx.apiBase, osClient: ctx.osClient, token: ctx.token };
  microiV8.configure(next);
  if (ctx.token) microiV8.setToken?.(ctx.token);
  return microiV8;
}
```

这样子应用中的 `V8.FormEngine.GetTableData`、`V8.ApiEngine.Run` 会自动携带 `Authorization` 和 `osclient`。

## 自动化验收

微服务交付必须做真实浏览器测试：

- 先建立主平台登录态。
- 访问不带 token 的真实菜单 URL，例如 `http://localhost:1988/#/micro-app/itdos/menu1`。
- 连续访问两个绑定同一微服务的菜单，确认不会出现 `app name conflict`。
- 点击子页面中需要登录态的 SDK 调用按钮，确认返回 `Code=1`。
- 检查控制台没有 `element head is missing`、`Failed to fetch`、`ERR_TOO_MANY_REDIRECTS`、`登录身份已过期`。

## 常见问题

### 页面空白

通常是菜单动态路由没有带上 `MicroAppUrl`、`MicroServiceRoutePath` 等 meta，宿主把菜单 Id 当成 appKey 拼接了入口地址。应检查 `sys_menu` 字段和前端动态路由生成逻辑。

### 页面 404

检查 `sys_microiservice` 当前版本、`AssetManifestJson`、文件上传列表和 `/micro-app/{OsClient}/{MsKey}/index.html` 是否能访问。

### SDK 提示登录身份已过期

检查子应用是否调用了 `setToken(ctx.token)`，以及 SDK 的 `getToken()` 是否优先读取运行时 token。

### 切换两个菜单时报 app name conflict

同一个微服务绑定多个菜单时，宿主 `<micro-app name>` 需要包含菜单 Id 或路由维度，不能只用 `MsKey`。

### 后台选择微服务页面没有数据

检查 `sys_microiservice_page` 是否有当前微服务的路由数据，`OpenType` 值变更事件和 `MicroServiceId` 值变更事件是否会加载页面列表。
