# 微服务（前端微应用）

吾码微服务是一套面向 Vue3 定制页面的开发、托管和交付体系。一个微服务可以包含多个页面，既能绑定后台菜单作为完整业务页面，也能通过 `V8.OpenAppDialog` 作为 Dialog 或 Drawer 弹出，还能由在线 AI、MCP 和 VS Code 共同维护。

> 本文中的 `MicroService` 指运行在吾码主站中的前端微应用，不等同于独立部署的 .NET、Java 后端服务。复杂业务事务、权限校验和数据写入仍建议放在接口引擎或后端服务中，微服务主要负责页面与交互。

## 什么时候应该使用微服务

| 需求 | 推荐方案 |
|---|---|
| 确认、删除、是否继续 | `V8.ConfirmTips` |
| 简单表单新增、修改、查看 | 表单引擎 / `V8.OpenAnyForm` |
| 已写在 `Microi.Client` 源码中的组件 | `V8.OpenDialog` |
| 3 个以上输入项、联动校验、分步操作、上传、表格、代码编辑器 | 微服务 + `V8.OpenAppDialog` |
| 独立菜单页面、同一应用包含多个业务页面 | 微服务 + 后台菜单绑定 |
| 需要 AI 生成、在线编辑、本地工程化构建、独立版本和商城交付 | 微服务 |

典型场景包括：

- 不同 SaaS 租户需要不同的 Vue3 定制页面，但不希望全部打进 `Microi.Client` 主包。
- 一个官方应用需要持续增加页面，并独立于吾码主前端发布。
- 页面需要在线 AI 生成和修改，同时允许开发者拉回本地继续工程化开发。
- 表格按钮需要打开一个有完整布局、校验和交互的复杂弹窗，而不是在 V8 代码中拼接 HTML。

## 整体架构

```text
在线 AI / MCP / VS Code
          │
          ├─ 应用主数据 ──> sys_microistore
          ├─ 私有源码 ──> mci_ai_app_file ──> 私有 HDFS
          │
          └─ 构建发布 ──> sys_microiservice + sys_microiservice_page
                                      │
                                      └─ 公有构建产物 ──> 公有 HDFS
                                                               │
                               后台菜单 / OpenAppDialog <──────┘
```

### 核心数据表

| 表 | 作用 |
|---|---|
| `sys_microistore` | 应用商城唯一主表，统一保存平台应用、Web、UniApp、MicroService 的名称、类型、分类、发布、预览和统计。 |
| `mci_ai_app_file` | 应用源码文件清单，文件内容存储在当前租户的私有 HDFS。 |
| `mci_ai_app_version` | 构建版本、状态、预览地址和变更说明。 |
| `sys_microiservice` | 微服务运行时主表，保存 `MsKey`、版本、入口、构建清单、文件列表和发布时间。 |
| `sys_microiservice_page` | 微服务页面/路由表，一个微服务可以包含多个页面。 |
| `sys_menu` | 后台菜单；`OpenType=MicroService` 时绑定微服务及其页面。 |

源码与构建产物必须分开：源码默认存入私有桶，只有有权限的当前租户可以读取；编译后的 HTML、JS、CSS、图片和字体存入公有桶，由浏览器加载。不要把大体积 JS/CSS 以内联 JSON 长期保存在数据库字段中。

## 在线使用：AI 应用工作台

适合快速创建页面、让 AI 迭代代码、在线修复小问题、预览和发布。

### 创建微服务

1. 登录吾码后台，进入 `AI 引擎` 的 `AI 应用`。
2. 点击 `新建微服务`。
3. 填写应用名称、应用 Key 和需求描述。
4. 建议开启 `生成骨架`，系统会生成可运行的基础源码。
5. 创建后自动进入开发工作台。

应用 Key 是运行时唯一标识，对应 `sys_microistore.AppKey` 和 `sys_microiservice.MsKey`。建议使用稳定的英文、数字、`-`、`_` 组合，例如 `microi-official`，不要因为页面名称变化而反复修改 AppKey。

一个范围较大的应用应使用一个稳定的微服务承载多个页面。例如“吾码官网微服务”可以包含 SaaS 租户管理、安装向导、运维工具等页面，不必为每一个弹窗新建一个微服务。

### 编辑、预览和发布

工作台提供以下能力：

| 操作 | 用途 |
|---|---|
| `源码树` | 查看应用全部目录和文件。 |
| `保存源码` | 在线保存当前文件到私有 HDFS。 |
| `运行/发布` | 生成在线预览，并同步微服务运行元数据。 |
| `预览视图` | 在工作台内查看最新运行效果。 |
| `版本记录` | 查看构建版本、状态、预览地址和创建时间。 |
| `下载源码ZIP` | 下载当前私有源码，供备份或本地继续开发。 |
| `下载编译ZIP` | 下载最新编译产物。 |
| `制作离线包` | 生成可在无外网环境安装的 `.microi-app.json` 应用包。 |
| `发布应用商城` | 将私有源码、最新构建产物和运行时信息发布到应用商城。 |

推荐在线流程：

```text
创建微服务 → AI 生成或人工编辑 → 保存源码 → 运行/发布
           → 预览验收 → 制作离线包或发布应用商城
```

在线编辑适合快速迭代；依赖较多、需要完整 Vite 插件、单元测试或长期多人协作时，建议使用 VS Code 本地工程。

## 本地使用：Microi VS Code 插件

适合完整 Vue/Vite 工程开发、依赖管理、本地调试、正式构建和批量源码维护。

### 准备工作

1. 安装 Microi 吾码 VS Code 插件。
2. 打开工作区并执行吾码初始化。
3. 配置目标服务器的 `ApiBaseUrl`、`OsClient`，并登录目标租户。
4. 在吾码资源管理器中选择对应服务器。

### 常用命令

可以在吾码资源树或 VS Code 命令面板中执行：

| 命令 | 作用 |
|---|---|
| `创建前端微服务` | 创建 Vue/Vite 工程、安装依赖，并注册微服务草稿。 |
| `拉取服务器前端微服务` | 从当前租户的在线 AI 应用私有 HDFS 拉取完整源码；只有运行产物、未保存源码的应用会明确拒绝拉取。 |
| `构建前端微服务` | 清理 `dist`，执行 `npm run build`，校验入口文件。 |
| `推送前端微服务到数据库` | 上传已有 `dist`，更新运行时、版本和页面路由。 |
| `构建并推送前端微服务` | 构建、上传产物、同步路由，并尝试把源码同步到在线 AI 应用。 |
| `同步微服务源码到在线 AI 应用` | 仅把本地源码同步到在线 AI 应用的私有 HDFS。 |

正式交付优先使用 `构建并推送前端微服务`。推送时系统会基于服务端当前版本自动生成下一个版本，首次通常是 `v1.0.0`，并更新 `BuildVersion`、`EntryPath`、构建清单、文件哈希、文件数量和发布时间。

插件创建项目后会自动安装依赖。需要独立启动本地开发服务器时，也可以进入项目目录执行：

```bash
npm install
npm run dev
```

本地独立运行用于页面开发；Token、OsClient、菜单信息和弹窗数据只有放入吾码宿主后才是完整的，因此不能用独立预览代替最终验收。

### 本地项目结构

```text
Microi-V8-Engine/
  示例服务器 (api.example.com)/
    Demo.Product.Internal/
      AI应用/
        microi-official/
          .microi-micro-app.json
          microi.routes.json
          package.json
          package-lock.json
          tsconfig.json
          vite.config.ts
          index.html
          src/
            main.ts
            App.vue
            components/
            pages/
            composables/
            domain/
            services/
            platform/
              microi.ts
```

目录隔离规则为 `Microi-V8-Engine/{系统名称} ({ApiBase域名})/{OsClient}.{OsClientType}.{OsClientNetwork}/AI应用/{appKey}`。因此不同服务器或租户即使存在相同 `appKey`，也不会覆盖同一份本地源码。

同一个租户可以创建多个微服务，例如：

```text
Microi-V8-Engine/示例服务器 (api.example.com)/Demo.Product.Internal/AI应用/demo-official
Microi-V8-Engine/示例服务器 (api.example.com)/Demo.Product.Internal/AI应用/platform-service
```

旧版直接平铺在 `Microi-MicroApp/` 下的项目仍会在资源树中以“旧目录”显示，但插件不会擅自移动；所有新建和拉取操作都写入 `Microi-V8-Engine/.../AI应用/{appKey}`。拉取先从 `sys_microistore` 读取应用主数据，再从 `mci_ai_app_file` 读取私有 HDFS 源码，不是读取 `sys_microiservice` 的公有编译产物。离线安装时若未包含源码，微服务仍可运行和预览，但必须回到原开发端或包含源码的服务器拉取。

### AI 应用默认前端架构

新建 Web、MicroService、H5，以及整体升级的存量 AI 应用，默认采用 Vue 3 单文件组件、Composition API、Vite 和 TypeScript。这里的 ESM 是浏览器模块标准，Vue 3 + Vite 本身仍以 ESM 组织源码，二者不是互斥选项。这个选择针对吾码生态：与 `Microi.Client`、Microi.UI 和团队既有 Vue 经验一致，方便升级、维护和二次开发；它不代表其它生态只能使用 Vue。

- 使用 `<script setup lang="ts">`、严格类型检查和提交到源码库的 lockfile；`vite.config.ts` 必须设置 `base: './'`，以兼容 HDFS、CDN 和嵌入式相对路径。
- 页面与组件放 `components/pages`，生命周期用例放 `composables`，纯业务规则放 `domain`，接口引擎、实时通信和音频适配放 `services`，Token、OsClient 与宿主桥接放 `platform`。
- 只有多个可分享页面时才引入 Vue Router；只有跨页面或跨组件共享复杂状态时才引入 Pinia。不要为了“看起来主流”无条件增加大型依赖。
- 页面不得散装拼接 `/apiengine`、Token 或文件地址，应通过统一的 Microi SDK/认证桥和薄服务层调用。生产配置不得写死 localhost、租户或密钥。
- 默认质量门为 `vue-tsc --noEmit`、单元测试、生产构建、产物敏感信息扫描，以及 PC/移动真实浏览器验收。仅用 Vue 挂载旧 HTML、但仍由命令式 DOM 控制页面，不算完成架构迁移。
- UniApp 继续使用 Vue 3 + TypeScript 的官方 Vite 工具链并遵守 UniApp 跨端规范；Canvas/WebGL 游戏的高频渲染循环保持独立，Vue 负责登录、大厅、房间、设置、HUD 和结算界面。
- 正式流式发布采用两阶段协议：先回读并冻结应用的 `CurrentVersion`、`AppVersion`，stage 上传并验签不可变版本资产，finalize 同时提交 `ExpectedCurrentVersion`、`ExpectedAppVersion` 做条件切换。任何一项缺失或远端状态已变化都必须重新盘点，不能用旧任务覆盖新版本。

原生 HTML/JavaScript 仅适用于用户明确要求、目标环境不能构建，或一次性且无状态的极小静态页；交付时必须记录例外原因与后续升级路径。

`.microi-micro-app.json` 是插件识别项目的依据：

```json
{
  "schemaVersion": 1,
  "runtime": "micro-app",
  "appKey": "microi-official",
  "name": "吾码官网微服务",
  "osClient": "iTdos",
  "apiBaseUrl": "http://localhost:1988",
  "entry": "index.html",
  "distDir": "dist",
  "routeManifest": "microi.routes.json",
  "version": "v1.0.0",
  "createdAt": "2026-07-11 10:00:00"
}
```

不要把同一个项目的 `appKey` 改成另一个已存在应用的 Key，否则会覆盖对应运行时记录。

### 路由清单

微服务必须维护 `microi.routes.json`。插件以该文件为事实源同步 `sys_microiservice_page`，不要从 Vue 源码中猜测路由。

```json
[
  {
    "path": "/",
    "name": "home",
    "title": "微服务首页",
    "sort": 0,
    "isHome": true
  },
  {
    "path": "/saas-tenant/create",
    "name": "saas-tenant-create",
    "title": "创建空数据库 SaaS 租户",
    "sort": 10
  },
  {
    "path": "/system-tools",
    "name": "system-tools",
    "title": "系统工具",
    "sort": 20,
    "LegacyMenuUrls": ["/legacy/system-tools"],
    "LegacyComponentPaths": ["/custom/pages/system-tools/index"]
  }
]
```

路径应稳定且以 `/` 开头。删除清单中的旧页面后再次推送，在线路由也会随清单同步。

页面从历史内置 Vue 组件迁移到前端微服务时，可在路由顶层或 `meta` 中声明 `LegacyMenuUrls`、`LegacyComponentPaths`。插件会统一写入 `sys_microiservice_page.RouteMetaJson`，菜单接口据此把旧菜单瞬时映射到微服务宿主，不会覆盖客户的 `sys_menu`。前端同时注册旧菜单 URL、`/micro-app/{MsKey}/{route}` 和 `/micro-app/{Id}/{route}`；因此菜单可以继续显示旧地址，新旧书签也能打开同一页面，路由迁移不要求一次性切断旧入口。

### 本地调试建议

- 独立运行时可使用本地模拟上下文，但最终必须在吾码宿主中验收。
- 不要把 Token、OsClient 或正式 API 地址硬编码进源码。
- 调用吾码接口时使用模板自带的 `src/microi.js` 或 `src/utils/microi.v8.js`。
- `vite.config.js` 的资源基础路径必须适配微应用托管，避免构建后静态资源请求到主站根目录。

## AI 对话与 MCP 使用

配置好目标租户的 Microi MCP 后，AI 可以读取当前所有 Web、UniApp、MicroService 应用及其文件，再决定扩展已有应用还是创建新应用。

### AI 应遵循的默认顺序

```text
1. microi_list_applications：先盘点现有应用和文件清单
2. microi_get_application_context：读取目标应用完整上下文
3. microi_get_application_file：按需补读单个大文件
4. 优先在合适的现有微服务中增加页面
5. 没有合适应用时才创建新的微服务
6. 先 dry-run 审核写入内容，再确认执行
7. 发布后检查运行时、路由和真实页面
```

这一步非常重要。若不先盘点应用，AI 容易重复创建范围过小的微服务，或在 V8 按钮中继续拼接大量 HTML。

### 应用发现工具

| MCP 工具 | 关键参数 | 说明 |
|---|---|---|
| `microi_list_applications` | `appType?`、`keyword?`、`includeFiles?` | 列出当前租户全部在线应用；`includeFiles` 默认 `true`。 |
| `microi_get_application_context` | `appIdOrKey`、`includeContents?`、`maxFileBytes?`、`maxTotalBytes?` | 获取应用、文件清单和源码；默认读取内容，默认单文件 2MB、总计 50MB。微服务还返回运行时和页面。 |
| `microi_get_application_file` | `appIdOrKey`、`filePath`、`maxFileBytes?` | 精确读取一个源码文件；默认上限 10MB，文本返回 UTF-8，二进制返回 Base64。 |
| `microi_get_microservice` | `msKey` | 查看已发布微服务的版本、入口、构建清单和页面。 |

### 创建与发布工具

| MCP 工具 | 关键参数 | 说明 |
|---|---|---|
| `microi_create_microservice` | `microService`、`confirmExecution?` | 创建或更新 `sys_microiservice` 元数据，不上传源码或构建文件。 |
| `microi_sync_microservice_source` | `microService`、`sourceFiles`、`replace?`、`confirmExecution?` | 把源码写入在线 AI 应用的私有 HDFS；`replace=true` 时清理清单外的旧源码元数据。 |
| `microi_publish_microservice` | `microService`、`assets`、`routes?`、`confirmExecution?` | 上传构建产物，更新运行时并同步 `sys_microiservice_page`。 |

三个写入工具在未传 `confirmExecution` 时只返回 dry-run，不会真正写入。AI 应先展示将要创建的 AppKey、文件数、路由和版本，确认无误后再传入任意非空确认文本执行。

`sourceFiles` 中每个文件需要 `Path` 或 `FilePath`，以及 `FileByteBase64` 或 `ContentBase64`；`assets` 中每个构建文件需要相对路径和 Base64 内容，并将入口文件标记为 `IsEntry=true` 或 `Entry=true`。

### 怎样向 AI 描述需求

高质量描述应明确以下内容：

- 目标 MCP 和 `OsClient`。
- 是扩展已有应用，还是没有合适应用时才允许新建。
- 应用范围、AppKey、页面名称和内部路由。
- 页面字段、布局、校验、权限和交互。
- 调用哪个接口引擎，参数和返回值是什么。
- 作为菜单打开、Dialog 打开还是 Drawer 打开。
- 成功、取消、失败时宿主应执行什么动作。
- 验收地址、测试账号和预期结果。

#### 示例一：先盘点再扩展现有微服务

```text
请使用 microi_demo，先调用 microi_list_applications 获取当前全部 Web、UniApp、
MicroService 应用和文件清单，再读取最适合承载“官方系统工具”的应用完整源码。
优先在已有“吾码官网微服务”中新增页面，不要创建只包含一个弹窗的新微服务。

新增路由 /saas-tenant/create，页面用于创建空数据库 SaaS 租户，包含 OsClient、
系统名称、admin 密码、OsClientType、OsClientNetwork、域名、归属手机号。
OsClientNetwork 默认读取当前环境值但允许手工修改。页面使用 Drawer，宽度 960px，
提交调用接口引擎 create-empty-saas-tenant，成功后 dispatch app-dialog:success。

先读取现有文件并给出修改清单和 dry-run，确认后再写入、发布并做真实浏览器验收。
```

#### 示例二：创建新的微服务

```text
请使用 microi_demo。先检查当前在线应用，确认没有适合的设备运维微服务后，
创建 AppKey 为 `demo-device-ops`、名称为“设备运维微服务”的 MicroService。
包含 /、/device/detail、/work-order/create 三个路由，使用 Vue3 + Element Plus，
通过宿主 token 和 osClient 调用吾码接口，不允许把 token 写进 URL。
先 dry-run，确认后同步源码、发布构建产物和路由，并返回菜单绑定方式。
```

#### 示例三：修复已有页面

```text
请先调用 microi_get_application_context 读取 microi-official 的全部源码，
定位 /saas-tenant/create 在窄屏下右侧内容看不全的问题。
只修改现有应用，不更换 AppKey；保持原有接口和回调协议。
修复后运行/发布，并验证 1366×768 与 1920×1080 两种尺寸。
```

#### 示例四：交付到应用商城

```text
请检查当前微服务源码、最新构建版本和路由是否完整，生成应用离线包，
并发布到 sys_microistore。ApplicationType 必须为 MicroService。
安装包必须同时包含私有源码、公有构建文件、sys_microiservice 运行时和页面路由。
在目标租户安装后，验证 HDFS 重传成功、菜单可打开、SDK 请求携带目标租户身份。
```

## 绑定为后台菜单

在 `sys_menu` 创建或编辑菜单：

1. 打开方式选择 `微服务（MicroService）`。
2. 选择目标微服务。
3. 选择该微服务中的页面。
4. 系统回填 `MicroServiceId`、`MicroServicePageId`、`MicroServiceRoutePath`、`Url` 和 `ComponentPath=/micro-app/host`。

菜单友好地址通常为：

```text
/micro-app/{MsKey}/{RoutePath}
```

浏览器中的主站路由为：

```text
/#/micro-app/{MsKey}/{RoutePath}
```

例如：

```text
http://localhost:1988/?OsClient=iTdos#/micro-app/microi-official/saas-tenant/create
```

同一微服务可以绑定多个菜单。宿主会为每个运行实例生成独立名称，避免切换页面时出现 `app name conflict`。

`sys_microiservice_page` 作为隐藏子表菜单时，应设置 `Display=0`、`AppDisplay=0`、`HasChild=0`。若错误开启“是否有子集”，上级微服务菜单可能被识别成只能展开的父菜单。

## 在 V8 中弹出复杂页面

页面按钮、行按钮或表单按钮可以调用 `V8.OpenAppDialog`：

```js
V8.OpenAppDialog({
    AppKey: 'microi-official',
    RoutePath: '/saas-tenant/create',
    Title: '创建空数据库 SaaS 租户',
    TitleIcon: 'fas fa-database',
    Width: 'min(960px, calc(100vw - 32px))',
    OpenType: 'Drawer',
    Data: {
        source: 'osclients'
    },
    OnSuccess: function (data) {
        V8.Tips('创建任务已提交', true);
        V8.RefreshTable({ _PageIndex: -1 });
    },
    OnCancel: function (data) {
        console.log('用户取消', data);
    },
    OnError: function (error) {
        V8.Tips(error.message || '应用加载失败', false);
    }
});
```

| 参数 | 必传 | 默认值 | 说明 |
|---|---|---|---|
| `AppKey` | 是 | - | 对应 `sys_microiservice.MsKey`，应用必须已发布。 |
| `RoutePath` | 否 | `/` | 微服务内部路由；`MicroRoute` 是兼容别名。 |
| `Version` | 否 | 当前版本 | 指定构建版本；不传则读取 `BuildVersion`。 |
| `Title` | 否 | `应用` | 标题。 |
| `TitleIcon` | 否 | `fas fa-window-maximize` | 标题图标 class。 |
| `Width` | 否 | `min(920px, calc(100vw - 32px))` | 支持 px、%、vw、`min(...)`。 |
| `OpenType` | 否 | `Dialog` | `Dialog` 或 `Drawer`。 |
| `Data` | 否 | `{}` | 传给子应用的可序列化业务数据。 |
| `OnSuccess` | 否 | - | 成功回调，执行后自动关闭。 |
| `OnCancel` | 否 | - | 取消回调，执行后自动关闭。 |
| `OnError` | 否 | - | 加载失败或子应用上报错误时执行，不自动关闭。 |

回调函数应放在顶层，不要放进 `Data`。完整 API 文档参见 [V8.OpenAppDialog](/doc/v8-engine/v8-client.html#v8-openappdialog)。

## 子应用接收宿主上下文

宿主通过 micro-app data 传入运行环境：

```js
const hostData = window.microApp?.getData?.() || {};

console.log(hostData.apiBase);
console.log(hostData.osClient);
console.log(hostData.token);
console.log(hostData.appKey);
console.log(hostData.version);
console.log(hostData.microRoute);
console.log(hostData.dialog);
console.log(hostData.dialogData);
```

| 字段 | 说明 |
|---|---|
| `apiBase` | 当前吾码后端地址。 |
| `osClient` | 当前租户。 |
| `token` | 当前登录 Token。 |
| `appKey` | 当前微服务 AppKey。 |
| `version` | 实际构建版本。 |
| `microRoute` | 当前内部路由。 |
| `dialog` | 由 `OpenAppDialog` 打开时为 `true`。 |
| `dialogData` | 宿主传入的 `Data`。 |
| `route` | 包含 `microRoute`、`microRoutePath` 的兼容对象。 |

使用模板自带 SDK 初始化上下文：

```js
import { configureMicroiV8 } from './microi';

const V8 = configureMicroiV8();

const result = await V8.ApiEngine.Run('get-device-detail', {
  Id: hostData.dialogData.Id
});
```

不要把 Token 拼接进 URL。SDK 会把运行时 Token 放入 `Authorization`，并携带当前 `osclient` 请求头。

## 子应用向弹窗返回结果

```js
// 成功：触发 OnSuccess 并关闭
window.microApp.dispatch({
  type: 'app-dialog:success',
  data: { taskId: '01H...', osClient: 'customer_a' }
});

// 取消：触发 OnCancel 并关闭
window.microApp.dispatch({
  type: 'app-dialog:cancel',
  data: { reason: 'user-cancel' }
});

// 失败：触发 OnError，弹窗保持打开
window.microApp.dispatch({
  type: 'app-dialog:error',
  data: { message: 'OsClient 已存在' }
});
```

同时兼容 `success`、`cancel`、`error` 简写类型。

## 构建产物访问与版本

当前版本入口可以使用：

```text
/micro-app/{OsClient}/{AppKey}/index.html
```

该地址会重定向到实际版本入口：

```text
/micro-app/{OsClient}/{AppKey}/{BuildVersion}/{EntryPath}
```

例如：

```text
/micro-app/iTdos/microi-official/v1.0.3/index.html
```

版本化地址有利于浏览器和 CDN 缓存。发布新版本后应让页面引用新的 `BuildVersion`，不要覆盖旧版本 URL 后期待浏览器自动失效。

## 应用商城、离线包与跨 HDFS 安装

在线 AI 工作台可以直接制作离线包或发布到 `sys_microistore`。应用商城中两个容易混淆的字段是：

| 字段 | 说明 |
|---|---|
| `ApplicationType` | 运行时应用类型：普通平台包兼容 `Regular / Platform`，独立应用使用 `Web / UniApp / MicroService`。新建普通离线包默认 `Regular`，既有商城平台应用和通知仍可能为 `Platform`。 |
| `Category` | 游戏、企业应用、办公、教育、行业应用、平台能力等业务分类。 |
| `PublisherType` | 官方应用或社区应用来源；仅作为搜索字段，不再拆分一级页签。 |

微服务应用包应包含：

- `sys_microistore` 应用信息。
- 私有源码文件及内容。
- 最新公有构建产物。
- `sys_microiservice` 运行时信息。
- `sys_microiservice_page` 页面路由。
- 包版本、来源租户和必要的基础元数据。

应用商城“配置应用包”中的“同时发布源码 ZIP”只控制私有源码是否随包交付；无论是否勾选，真正的离线包都必须内嵌最新已发布运行产物。因此未携带源码的应用仍应可以运行和预览，只是不能在目标服务器继续在线开发。平台自有的打包接口必须自带时间格式化回退，不得依赖客户“系统设置”的全局 `DateNow`，更不能为了补函数覆盖客户维护的全局 V8。

安装到另一个租户时，平台不会直接引用发布者的 HDFS 地址，而是把私有源码和公有构建文件重新上传到安装者自己的 HDFS，再写入目标租户的运行时和路由。因此发布者使用 MinIO、安装者使用阿里云 OSS 或其他已支持存储时，也可以完成迁移。

声明“同时发布源码”的包若实际没有源码，生成或安装必须失败；目标租户写入私有 HDFS 后还要回读 `mci_ai_app_file`，不能返回“安装成功”后才在工作台显示无源码。原开发服务器已有可运行原生组件菜单时，重复制作或验证安装包不得把它改写成微服务菜单；目标端需要迁移的菜单才绑定 `/micro-app/host`，并把 `Url` 写成包含稳定 `MsKey` 的 `/micro-app/{MsKey}/{route}`。微服务友好路由优先使用 `MsKey`，后端同时兼容历史服务 `Id` 路由；前端把旧菜单 URL、`MsKey` 路由和 `Id` 路由绑定到同一宿主组件，三种地址可并存。

若目标租户 HDFS 未配置、不可访问或上传失败，安装应终止并显示明确错误，不能只写数据库记录后留下无法打开的页面。

离线交付流程：

```text
AI 应用工作台“制作离线包”
  → 下载 .microi-app.json
  → 目标租户应用商城“安装离线包”
  → 后台任务重传 HDFS、安装运行时和页面
  → 绑定/检查菜单并验收
```

在线商城流程：

```text
AI 应用工作台“发布应用商城”
  → sys_microistore.ApplicationType=MicroService
  → 目标租户应用商城安装
  → 下载官方应用包并重传到目标 HDFS
```

## 上线验收清单

- 已确认 `sys_microistore.AppKey` 与 `sys_microiservice.MsKey` 一致。
- 源码在私有 HDFS，构建产物在公有 HDFS。
- `BuildVersion`、`EntryPath`、`AssetManifestJson` 和构建文件清单完整。
- `microi.routes.json` 与 `sys_microiservice_page` 一致。
- 菜单绑定了正确的 `MicroServiceId`、`MicroServicePageId` 和路由。
- 目标端需要迁移的 `LegacyMenuUrls/LegacyComponentPaths` 菜单已绑定 `/micro-app/host`，且旧菜单 URL、稳定 `MsKey` 路由和历史服务 `Id` 路由均能打开同一页面；原开发服务器仍可运行的原生组件菜单保持不变。
- 真实主站 URL 不携带 Token，页面仍能调用需要登录的接口。
- Dialog 的成功、取消、失败回调都已测试。
- 同一微服务的两个菜单连续切换不会出现 `app name conflict`。
- 目标分辨率下没有横向溢出、遮挡或右侧内容看不全。
- 应用商城安装后，使用的是目标租户自己的 HDFS 文件地址。
- 发布后的 active 文件清单与本地构建完全一致；旧 `dist/` 元数据已可逆归档，Private、非 `dist/` 及其它应用文件未受影响。

## 常见问题

### 页面空白

检查菜单动态路由是否带有 `MicroAppUrl`、`MicroServiceRoutePath` 等 meta，以及 `ComponentPath` 是否为 `/micro-app/host`。若宿主把菜单 Id 当成 AppKey，通常是菜单绑定字段不完整。

### 页面或静态资源 404

依次检查：

1. `sys_microiservice` 是否存在且启用。
2. `BuildVersion` 和 `EntryPath` 是否正确。
3. `AssetManifestJson` 是否包含请求文件。
4. 构建产物是否已上传到公有 HDFS。
5. Vite 构建的资源基础路径是否适配 `/micro-app/...`。

### SDK 提示登录身份已过期

确认子应用使用宿主传入的运行时 Token，并执行 `setToken(ctx.token)` 或模板的 `configureMicroiV8()`。不要只读取子应用自身 localStorage，也不要把 Token 放到 URL。

### `app name conflict`

不要在子应用中自行注册固定的宿主实例名。吾码宿主会按页面/弹窗实例生成唯一 name；若使用自定义宿主，也必须让 name 包含菜单或实例维度。

### 后台选择微服务页面没有数据

检查 `sys_microiservice_page` 是否已有当前微服务的路由数据；重新推送项目可以按 `microi.routes.json` 同步页面。

### MCP 查询不到应用

先确认 MCP 连接的服务器、`OsClient` 和登录账号是否正确。若提示 Token 失效，应重新登录或刷新 MCP 会话；不要把鉴权失败误判为应用不存在。

### 在线修改后本地还是旧代码

在线源码和本地目录是两个工作副本。在线修改后可下载源码 ZIP，再与本地 Git 工作区合并；本地修改后执行 `同步微服务源码到在线 AI 应用`。多人同时编辑前应先约定主工作副本，避免互相覆盖。

### 商城安装时 HDFS 失败

检查目标租户的 HDFS 类型、Endpoint、Bucket、访问密钥、私有/公有桶权限和网络连通性。安装过程必须能同时写入私有源码和公有构建产物。

### 本地商城源被安全策略拦截

服务端可能把访问 `localhost`、内网 IP 的远程商城源识别为 SSRF 风险。开发环境应通过受控配置明确允许可信地址，生产环境不要为了测试直接关闭全局 SSRF 防护。
