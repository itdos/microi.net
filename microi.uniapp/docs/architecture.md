# Microi 原生动态小程序架构

## 目标

本仓库同时承担两件事：

1. 提供可供所有 Microi 项目安装、品牌化和扩展的标准原生小程序产品。
2. 保持集福鲤 `xjy` 已交付的小程序页面、售后闭环、视觉与性能不退化。

实现方式不是复制两套工程，而是“标准内核 + Profile + 租户插件”。标准
Profile 使用通用模块目录、动态列表、动态详情和动态表单；集福鲤 Profile
在这些能力之上保留商城、资讯、售后任务和专属业务页面。

## 四层结构

### 1. 平台层

`src/platform/`、`src/components/mci-*`、`src/pages/module/` 和
`src/pages/native-form/` 只表达通用能力：

- 鉴权请求、菜单授权上下文和数据权限。
- `sys_menu` 模块发现及 List/Card/Detail/Edit 视图协议。
- `diy_table/diy_field` 字段、控件、顺序、分组、数据源和校验。
- ActionSchema 白名单、缓存、显示兼容、上传、富文本和安全区。

平台层禁止出现租户表名、字段名、品牌文案、租户素材和定制路由。

### 2. 视图协议层

`sys_menu` 负责一个业务入口的列表、卡片、详情和编辑视图。同一菜单可用
物理字段保存版本化 `ViewSchema`：

- `EnableViewSchema`
- `ViewSchema`
- `ViewSchemaVersion`
- `ViewConfigVersion`

Schema 支持 `Detail/Edit/List/Card`、`PC/Mobile/All`、角色选择、Hero、
MetricStrip、ActionGrid、ResponsiveSection、字段布局和安全 ActionSchema。
没有 ViewSchema 时必须回退到 `sys_menu` 的移动字段配置及完整
`diy_field` 表单，不能白屏。

`diy_table/diy_field/sys_menu.DiyConfig` 已废弃。任何新配置都必须使用
DIY 元数据和明确的物理字段。

### 3. 租户插件层

每个租户至少有四个适配器：

```text
src/tenants/<tenant>/
|- business.js
|- runtime.js
|- form.js
`- native-table.js
```

- `business.js`：专属业务分组、卡片预设和角色展示。
- `runtime.js`：专属首页统计、扫码和页面跳转。
- `form.js`：字段联动、定位、提交前后扩展。
- `native-table.js`：复杂子表和关联表选择规则。

售后接单、扫码、定位、拍照、地图和打卡等适合原生化的流程可以增加租户
页面；这些页面仍应调用后端 ApiEngine 和表单服务端事件，不在客户端复制
事务逻辑。定制详情可组合硬编码 Hero/流程区和动态元数据分组，新增后台字段
会自动进入折叠区。

### 4. Profile 层

`profiles/<id>/profile.cjs` 管理 OsClient、API、文件服务、品牌、功能开关和
路由；同目录的 `pages.json`、`manifest.json` 决定真实编译范围。

`scripts/run-profile.cjs` 在构建子进程中生成 `src/generated/*` 桥接并在结束
后恢复。仓库默认生成物必须始终指向 `xjy`，以保证同事直接运行原命令得到
当前交付版。

## 动态更新链路

1. 登录后读取当前角色可见的 `sys_menu`。
2. 根据 `DiyTableId` 批量解析表名，并读取菜单的移动列、搜索列、统计列、
   卡片列和 ViewSchema。
3. `diy_table/diy_field` 生成原生字段定义、分组、关联控件和数据源。
4. 表单指纹由表更新时间、Tabs、字段 Id/更新时间/顺序/显隐/组件组成。
5. 元数据统一通过 `V8.FormEngine.GetDiyTableModel/GetDiyFieldList` 访问
   FormEngine 服务端缓存入口；页面和控件禁止使用普通 CRUD 直查受保护的
   `diy_table/diy_field`。
6. 客户端按 30 秒窗口复核缓存元数据并计算指纹；指纹未变复用本地定义，
   变化时写入新版本缓存。网络失败时使用最近的版本化缓存。
7. 列表、详情和编辑请求携带真实 `_SysMenuId`；后端仍是最终权限边界。

因此后台新增字段、修改顺序、显隐、组件或数据源后，不需要重新发布小程序。
只有新增原生能力、专属页面或客户端动作类型时才需要发版。

## 特殊记录适配器

`src/platform/form-record-adapter.js` 负责少数不能直接复用普通菜单 CRUD 的
安全域。默认 `form-engine` 适配器继续携带真实菜单上下文；`current-user`
适配器读取当前 Token 对应的本人资料，并只提交服务端允许的自助字段。

新增适配器时必须同时满足：

- 普通业务适配器的表单结构仍来自缓存元数据，不得复制一套硬编码控件。
- 系统能力适配器可以声明后端白名单允许的最小静态字段集，但不能借此查询
  受保护系统表或暴露角色、部门、状态等管理字段。
- 数据范围由后端 Token、角色和数据权限决定，不能信任客户端传入的用户 Id。
- 不得伪造 `_SysMenuId`，也不得把特殊适配器当作绕过 FormEngine 权限的通道。
- 平台通用适配器放 `src/platform/`；单租户业务行为优先放租户插件或 ApiEngine。

## 动态与定制的选择

优先级如下：

1. 普通 CRUD：直接使用标准动态模块页。
2. 只需改变视觉组合：配置 ViewSchema。
3. 需要后端业务动作：配置 ActionSchema 调用 ApiEngine。
4. 需要相机、扫码、定位或复杂流程：增加租户页面或租户扩展。
5. 平台普遍需要的能力：先升级版本化标准协议，再由所有租户复用。

禁止在平台组件里根据 OsClient 写条件分支，也禁止把任意 PC 前端 V8 下载到
小程序执行。

## 多人和 AI 协作

仓库根目录的 `AGENTS.md` 是权威约束，同时提供 Claude、Copilot 和 Cursor
入口文件。架构检查会阻止以下回归：

- 平台动态渲染器出现集福鲤表名、字段名或品牌文案。
- 标准 Profile 丢失动态模块路由，或错误包含租户业务分包。
- Profile 缺少租户扩展合同。
- 平台使用 `DiyConfig`、`eval`、`new Function` 或任意前端 V8。
- 默认生成桥接不再指向集福鲤。

同事开发时应从 `npm run tenant:create -- ...` 创建新租户，不复制修改 xjy。
提交前先运行架构与双 Profile 构建；多人同时修改生成文件时，以 Profile
源文件为准重新生成默认 xjy 桥接，不手工解决生成内容。

## 验收矩阵

平台层变更至少验证：

```bash
npm run check:architecture
npm run check:ui
npm run build:mp-weixin:standard
npm run build:mp-weixin
```

集福鲤详情、任务、商城或视觉变更还需：

```bash
npm run build:h5
npm run visual:xjy
```

自动化不能替代真机相机、定位、文件选择、支付和破坏性售后状态流转验收。
