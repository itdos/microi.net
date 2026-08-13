# ui-design 详细参考 7

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=ui-design-020 sha256=25aa81a39c664b1873ff5e7a3c5d0e8ad2b929824c90e16bd020f64c98a34b54 -->
## 速查：从头搭建一个移动端页面

```vue
<template>
  <div class="mci-mobile-page">
    <!-- 顶部导航 -->
    <header class="mci-navbar">
      <h1 class="mci-navbar__title">{{ title }}</h1>
    </header>

    <!-- 主内容 -->
    <main class="page-content">
      <section
        v-for="(item, i) in list"
        :key="item.id"
        class="mci-card mci-stagger-item"
        :style="{ '--mci-index': i }"
      >
        <span class="mci-tag mci-tag--hot">HOT</span>
        <h3>{{ item.name }}</h3>
        <p class="mci-text-gradient price">{{ item.price }}</p>
        <button class="mci-btn">立即查看</button>
      </section>
    </main>

    <!-- 底部 Tabbar -->
    <nav class="mci-tabbar">
      <a class="mci-tabbar__item mci-tabbar__item--active"><svg class="mci-tabbar__icon" aria-hidden="true"><use href="#icon-home" /></svg><span>首页</span></a>
      <a class="mci-tabbar__item"><svg class="mci-tabbar__icon" aria-hidden="true"><use href="#icon-message" /></svg><span>消息</span></a>
      <a class="mci-tabbar__item"><svg class="mci-tabbar__icon" aria-hidden="true"><use href="#icon-user" /></svg><span>我的</span></a>
    </nav>
  </div>
</template>

<style lang="scss" scoped>
.page-content {
  padding: var(--mci-space-4);
  padding-bottom: calc(var(--mci-touch-target) + var(--mci-safe-bottom) + var(--mci-space-8));
  display: flex;
  flex-direction: column;
  gap: var(--mci-space-4);
}
.price {
  font-size: var(--mci-text-2xl);
  font-weight: var(--mci-font-bold);
}
</style>
```


---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-021 sha256=8a8884b0b064e7805cd03d904541b12da4539e73172d31f00d32c1ecfaee32f6 -->
## 🚨 移动端低代码项目落地踩坑（必读，2026.5）

实战中频繁出现的 7 类问题，统一按以下规则处理。

### 1. 路由前缀不要硬编码租户名

- 错误：在 `manifest.json` 写死 `"router": { "base": "/fixed-tenant/" }`。
- 正确：默认使用 `"router": { "base": "/" }`；租户由运行配置、`OsClient` 和请求头/参数确定。
- 不要自行把租户名拼进 API 路径。平台接口使用 `/api/...`、`/apiengine/...` 等标准路由。

### 2. tabBar 使用本地静态 PNG 图标

- uni-app/微信小程序 tabBar 的 `iconPath`、`selectedIconPath` 使用项目内静态 PNG。
- 不使用 emoji、字体图标、远程 URL；SVG 仅在目标端明确支持并已做真实设备验证时使用。
- 普通态与选中态保持相同画布和轮廓，推荐 60×60 至 81×81 px，并验证深浅色背景可读性。

### 3. 字号样式不要通配所有 `text`

Scoped SCSS 中的 `.entry text { font-size: 40rpx; }` 会同时放大图标文字和子标签。图标、标题、说明必须使用独立 class：

```scss
.entry .entry-icon { font-size: 40rpx; }
.entry .entry-label { font-size: 22rpx; }
```

### 4. 个人中心/详情入口按信息层级选布局

- 高频资产、订单状态、服务入口适合 4～5 列网格。
- 设置、安全、协议等低频入口适合纵向列表。
- 单元格须有稳定触控区域、清晰标签和一致间距；不要为了追求密度牺牲可读性。

### 5. 每个可点击元素都要有反馈

```scss
.cell, .entry-item, .product-card, .zone-card {
  position: relative;
  transition: transform .2s ease, box-shadow .2s ease;
}
.cell:active, .entry-item:active {
  transform: scale(.94);
}
@keyframes fadein-up {
  from { opacity: 0; transform: translateY(16rpx); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fadein { animation: fadein-up .45s ease both; }
@media (prefers-reduced-motion: reduce) {
  .animate-fadein { animation: none; }
}
```

动效只表达状态，不承担业务完成事实；提交、支付、安装等动作仍以服务端返回和可恢复状态为准。

### 6. 品牌名和 Logo 的用户可见位置保持一致

同步检查 `manifest.json` 的 `name/h5.title`、`pages.json` 的导航标题、登录/注册/首页品牌区、空状态和分享标题。控制台中的技术标识可保留，但用户可见文案必须统一。

### 7. 接口地址由标准引擎工具维护

- `microi_create_engine`/`microi_upsert_engine` 会维护 `ApiEngineKey`、`ApiAddress` 和路由缓存。
- 写入超时先用标准 get/list 工具回读，不得立即重复创建。
- 禁止通过手工 SQL、直接修改 `sys_apiengine` 或自行拼 Redis Key 修补路由；这会绕过租户、审计、缓存失效和控制面权限。
- 长任务使用后台任务并持久化进度；普通接口写入后以远端回读为最终依据。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-022 sha256=4962a1ec7bc49ae1a2706c58fb6f929304ca254e3fd4d8b626fefbc17067bce2 -->
## 🔗 关联字段：保存真实 Id，界面展示可读标签

关联字段的数据库事实值通常是 `XxxId`。表单使用 `JoinForm`、`OpenTable` 或带数据源的 `Select` 显示名称，`SelectSaveField` 保存 `Id`，`SelectLabel` 展示名称。不要因为列表默认显示 Id，就强制所有业务表冗余一对可编辑的 `XxxId/XxxName` 字段。

### Select 数据源示例

```json
{
  "DataSource": "Sql",
  "Sql": "select Id, Name from mall_category where Name like '%$Keyword$%' limit 0,20",
  "SelectLabel": "Name",
  "SelectSaveField": "Id",
  "SelectSaveFormat": "Text",
  "EnableSearch": true,
  "DataSourceSqlRemote": true
}
```

- `$Keyword$` 是平台数据源占位符，不要把浏览器输入直接拼进任意 SQL。
- 关联表、字段和数据源必须来自当前租户，并受当前表单/菜单的授权与数据范围约束。
- 大表使用远程搜索和分页，不一次性把全表拉到浏览器。
- 列表展示名称优先配置 Join/模块关联字段或受控数据源，不把隐藏 Id 暴露给用户。

### 什么时候增加 `XxxName` 快照字段

只有在业务明确要求“保存当时名称”、离线展示、历史审计或高频报表需要时才增加 `XxxName`。它是快照/冗余字段，不是外键事实源，并遵守：

1. 后端 SubmitBefore/接口引擎在同一事务内根据 `XxxId` 校验并写入名称。
2. 前端 V8 可以即时回显，但不能作为唯一一致性保障。
3. 关联名称后续变化时，先明确历史快照是否应随之更新。
4. 批量回填必须参数化、可恢复、可幂等，并经过明确写入确认。

### MCP 建模流程

1. 先用 `microi_get_db_schema` 获取真实表和字段。
2. 使用 `microi_build_field_config` 生成 JoinForm/OpenTable/Select 配置。
3. 使用 `microi_add_field` 或 `microi_update_field` 写入字段。
4. 修改 KeyValue/Config 后回读 `microi_get_field_list`，并执行 `microi_refresh_schema_cache`。
5. 在真实菜单下验证普通角色能看到标签，但不能借数据源越权读取其它表或行。
---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-023 sha256=1c731f6915dae4de788e84af3f6a59cf5d116a4de1f9ca5541f13b55110521ca -->
## 表单布局规范（Column）

> 平台默认设计标准：所有 `diy_table` **应使用双列布局** (`Column = 2`)，更紧凑现代，符合主流后台 SaaS 视觉密度。

### 创建表时

```jsonc
microi_create_table {
  "name": "Crm_Customer",
  "description": "客户",
  "column": 2     // ✅ 默认就是 2，无需显式传，但推荐写明
}
```

### 修复存量表（一次性把所有 `Column=null` 改成 2）

```jsonc
microi_update_table {
  "name": "Crm_Customer",
  "column": 2
}
```

### 何时使用 Column=1（单列）

- 工作流审批表单（字段少且需要专注）
- 移动端优先表单（手机宽度不够双列）
- 含大量富文本/长文本字段的内容编辑表

### 何时使用 Column=3（三列）

- 字段≥18 的"基础档案"类大表（员工、商品 SKU、设备清单）
- 桌面分辨率≥1920px 的内部管理后台

> 修改 `Column` 后会自动清缓存（`microi_update_table` 后端走 `UptFormData('diy_table')` + 主动 `RefreshSchemaCache`），前端硬刷新（Ctrl+Shift+R）即可看到效果。

---

<!-- /microi-progressive:chunk -->
