# ui-design 详细参考 8

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=ui-design-024 sha256=7af53d03d0828232aaf7ab54d6527f5e2cf292d8eb493d75d9ab42adc3030ba3 -->
## 表单分组规范：Tabs vs CollapseGroup（强制）

> **核心原则**：默认**不分组** → 小业务域用 **`CollapseGroup` 折叠分组** → 只有足够长或强任务隔离的业务域才用 **`Tabs` 分页**。禁止只按字段数判断：双列布局中 8 个短字段约占 4 行，仍不应独占 Tab；普通业务域通常达到 6 个有效表单行才考虑 Tab。

### 三种分组方式

| 方式 | 存储位置 | 控件 | 适用场景 |
|------|---------|------|---------|
| **A. 表级 Tab** | `diy_table.Tabs` + 字段 `Tab` | 表单顶部 Tab 条 | 大表单拆 2~5 个业务域，每域通常 ≥6 个有效表单行，或属于扫码/子表/代码编辑等强任务模式 |
| **B. 字段级 CollapseGroup** | `diy_field.Component='CollapseGroup'` + `Config.CollapseGroup` | 折叠面板标题 | 小业务域（≤5 个有效表单行），**所有分组同屏可见、可同时展开** |
| **C. 字段级 Tabs 控件** | `diy_field.Component='Tabs'` + `Config.FieldTabs` | 字段是 Tab 容器 | 嵌套 Tab 场景（不推荐优先用） |

### 表单规模与分组决策表

| 有效表单行与任务特征 | 推荐方案 |
|---------|---------|
| ≤ 6 行且无复杂控件 | **不分组**（直接平铺） |
| 7 ~ 12 行且无强任务隔离 | `CollapseGroup` 收起次要字段，或直接平铺 |
| > 12 行且至少两个业务域各 ≥ 6 行 | `diy_table.Tabs`（大域）或混合（Tab + 嵌套 CollapseGroup） |
| 扫码、报工、大型子表、代码编辑等强任务模式 | 可独立使用 `diy_table.Tabs`，不受普通行数阈值限制 |

### CollapseGroup Config 示例

```jsonc
// diy_field 必要字段
{
  "Component": "CollapseGroup",
  "Type": "varchar(50)",
  "Visible": 1,
  "AppVisible": 1,
  "Config": "{\"CollapseGroup\":{\"DefaultCollapsed\":false,\"ScopeMode\":\"UntilNextGroup\",\"Description\":\"MRP 运算状态、批次号与时间\",\"Icon\":\"fas fa-calculator\",\"Theme\":\"primary\",\"ShowFieldCount\":true}}"
}
```

### 必做与禁止

- ✅ 任何 Tab / CollapseGroup 必须有 `Description` 解释分组用途。
- ✅ CollapseGroup 必须设 `Icon`（如 `fas fa-calculator`、`fas fa-info-circle`），不默认空白。
- ✅ 修改 Tab/CollapseGroup 配置后必须 `microi_refresh_schema_cache`。
- ❌ **禁止**为 ≤5 个有效表单行的业务域单独建 Tab；8~10 个双列短字段通常也应使用 CollapseGroup。
- ❌ **禁止**仅凭 13~30 个原始字段决定平铺或分 Tab；总有效行超过 6 且存在明确业务域时，至少使用 CollapseGroup 分组。
- ❌ **禁止**给 Tabs/CollapseGroup/Divider/Alert 等布局控件设 `FormWidth=24`（天然占整行）。
- ❌ **禁止**只创建 Tab 不写字段的 `Tab` 归属。
- ❌ 布局优化不得顺带覆盖字段 `Config/V8Code/KeyupV8Code` 或表级 V8 事件；修改前后必须回读比较，发现 Tab 显隐 API 时先适配再迁移。

完整规范、Config JSON 模板、回读验收清单和反例参考见 `microi-form-layout/SKILL.md`。

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-025 sha256=e6e11a8153bc5d1a1c5e9f1868aaae9a101843961fcf94dba42681b0a6091ad7 -->
## 缓存刷新（解决"我改了字段但页面不变"问题）

平台对 `diy_field` 的字段列表有 Redis 缓存，键格式 `Microi:{OsClient}:FormData:diy_table_field_list:{TableId|TableName}`。

**何时缓存会失效**：
- ✅ 通过 `microi_add_field` / `microi_update_field` / `microi_update_table` 走原生 API → 自动清
- ✅ 通过低代码后台界面操作（diy_table 表单事件触发）→ 自动清
- ❌ 直接 `V8.FormEngine.UptFormData('diy_field', ...)` → **不会触发清缓存**（这是历史 bug）

**何时手动清**：
```jsonc
microi_refresh_schema_cache { "tables": ["mall_address", "mall_member"] }
```
该工具会清除每张表的 6 个 key 变种（`diy_table` / `Diy_Table` / `diy_table_field_list` × `id|name`）。

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-026 sha256=3d53780b3ae17dabba22a2567d0d6e2c51e4dbce504d6e341b737881a3c4e749 -->
## 接口引擎匿名访问

登录、注册、首页公共数据等接口必须 `AllowAnonymous=1`，否则未登录用户调用会拿到 `null`：

```jsonc
microi_set_engine_anonymous {
  "apiEngineKeys": ["mall_member_login", "mall_member_register", "mall_home_data"],
  "allowAnonymous": 1
}
```


<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-027 sha256=e6e15cc34871821da89f70cb2a5326942d9d90fe99ed5c5a315415ac57f1532c -->
## MCI-UI 与第三方组件库策略

Microi 的 UI 规范不应该只停留在 skills 文档。面向品牌长期建设时，应形成可复用的 MCI-UI 体系：设计变量、基础样式、组件约定、示例站点、移动端与 PC 网站组件库。

- **默认规则**：当用户没有主动指定 UI 风格、UI 库或品牌视觉时，AI 必须默认采用 Microi吾码UI（Microi.UI / MCI-UI）作为移动端、PC 官网、企业网站、产品站、活动页和响应式网站的设计基础。
- **自动识别**：只要项目属于 Microi 生态、吾码源码、吾码客户项目，或需求中出现“移动端项目、网站、企业站、商城、会员中心、资产页、官网、H5、uni-app、Vue3”等关键词，即使用户没有单独说明 UI 风格，也应自动套用本规范与 `Microi.UI/` 组件。
- **落地要求**：业务页面优先使用 `MciPage`、`MciSection`、`MciButton`、`MciCard`、`MciCell`、`MciTabs`、`MciSkeleton`、`MciDataState`、`MciThemePanel` 等组件或项目级 `mci-*` 封装；不要重新发明一套分散样式。
- **例外场景**：后台管理系统继续使用 Element Plus + Microi theme；强行业 UI 或客户指定视觉可以定制主题 token，但仍优先保留 `--mci-*` 变量、骨架屏、安全区和动效规范。
- UniApp 项目不强制业务页面直接依赖某一个第三方 UI 库。推荐把 `uni-ui` 作为官方跨端基础组件底座之一，但业务视觉必须通过 `MCI-UI Mobile` 或项目级 `mci-*` 组件封装承载，避免页面直接散落 `uni-ui/uView/FirstUI/TDesign` 风格。
- PC 后台管理系统继续使用 Element Plus，不替换选型；但主题变量、间距、骨架屏、空态、安全区、表单密度和品牌色必须服从 `--mci-*` 设计变量。
- PC 官网、产品站、文档站、营销页和响应式网站应优先使用 `MCI-UI Web` 的设计变量与轻量组件。只有当页面是强表单、强数据录入或后台化工具时，才引入 Element Plus、TDesign Vue、Naive UI、Arco Design Vue 等成熟组件库作为底座。
- MCI-UI 应分层建设：`@microi/theme` 负责 tokens；`@microi/v8` 负责前端 SDK；`@microi/ui-mobile` 面向 UniApp；`@microi/ui-web` 面向官网和响应式站点；`Microi.Client` 后台则用 Element Plus + MCI theme。
- `microi.doc` 作为 VitePress 官方文档站，应逐步成为 MCI-UI 的展示入口：组件演示、设计变量、移动端骨架屏、安全区、富文本、上传资源、主题切换都应该有可查看示例，而不是只写在 skill 中。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-028 sha256=eee54b657b766f1d1ef137fb1df07fc8eec0b5363502838475eda81f9d031512 -->
## MCI-UI 源码落地位置

MCI-UI 已在吾码源码根目录落地：`Microi.UI/`。

- 新的移动端 UniApp/H5 项目应优先使用 `Microi.UI/src/uniapp` 中的 `MciPage`、`MciNavbar`、`MciButton`、`MciCard`、`MciCell`、`MciSection`、`MciTabs`、`MciMetricCard`、`MciActionBar`、`MciAvatar`、`MciProductCard`、`MciSkeleton`、`MciDataState`、`MciRichText`，再按业务补项目组件。
- 新的 PC 官网、产品站、文档站、响应式网站应优先使用 `Microi.UI/src/web` 和 `Microi.UI/src/theme`，不要直接套后台 Element Plus 风格。
- `Microi.UI/src/theme/tokens.css` 是品牌 token 源头；新组件颜色、圆角、阴影、间距、安全区、骨架屏都必须走 `--mci-*` 变量。
- `Microi.UI/src/theme/runtime.js` 是主题运行时入口；项目应通过 `initMciDesign()`、`setMciPalette()`、`setMciShape()`、`setMciTheme()` 统一设置黑白红橙黄绿青蓝紫主色、圆角/扁平、亮暗主题和动效偏好。
- `MciPage` 默认带页面入场动效；业务页如果有特殊路由转场，可以关闭 `animated` 后使用项目级转场，但不能让动态页面无反馈地直接闪现。
- `MciButton`、`MciCard` 必须保留 hover/pressed/focus/sheen 等基础反馈；业务组件可以封装样式，但不能删掉交互状态。
- 第三方 UI 库只能作为底层能力或局部补充，不能绕过 MCI-UI 直接决定产品视觉。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-029 sha256=470bda7401f3a1d6713872d89370bb89785e693b9e94862a7df4808db0200065 -->
## VitePress 中文文档布局规范

`microi.doc` 不是纯文本仓库，而是 Microi 产品体验的一部分。创建或重构
`docs/doc`、`docs/case` 中文阅读页时：

- 页面首屏使用标题、简短价值说明和 2–4 个关键能力视觉分组，避免打开后先看到十几段连续正文。
- 正文阅读宽度控制在约 `86ch`，代码、表格、架构图和案例截图可使用全宽；标题间距必须明显大于段落间距。
- 卡片用于并列能力、选择和案例，表格用于精确对比，流程带用于阶段关系，截图用于真实结果；不要把相同信息在四种视觉里重复一遍。
- 使用 MCI 主题变量，不在 Markdown 中散落硬编码颜色；亮/暗主题均保证文字、边框、代码和状态对比度。
- 页面专属 CSS 独立存放并以 marker 限定范围；全站字体、段落、列表、`details`、图片与焦点样式归整站主题层。
- 桌面使用多列时，980px 以下要能降为单列；表格和代码可横向滚动，普通正文与图片不得产生页面级横向滚动。
- 图片必须有语义化 `alt` 与图注；纯装饰图标设置 `aria-hidden`。交互控件保留键盘焦点，动画遵守 `prefers-reduced-motion`。
- 完成后同时跑中文文档可读性门禁、VitePress 构建，并用真实浏览器查看桌面/移动、亮色/暗色。只看 Markdown 源码或构建日志不能算视觉验收。

全站文档视觉改造还必须遵守：

- 清单必须覆盖 `/doc` 和 `/case` 中文阅读路由；首页、应用广场、应用详情、用户中心、登录与联系页采用专用交互布局，应显式登记后按自己的组件契约验收，不能漏扫，也不能强套正文档卡片样式。英文生成页与受保护更新日志按项目规则排除。
- 为每个中文路由维护显式视觉类型，至少区分概览、指南、参考、规范和展示页；同一主题契约按类型调节信息密度，不能把 API 参考页机械改造成营销卡片。
- 所有自定义面板都先定义“表面 + 主文字 + 次文字 + 边框”的亮暗成对 token，再使用 token 组合背景。禁止浅色硬编码背景继续继承暗色全局文字，也禁止只改背景不改前景。
- Sass 位于 `html:lang(zh)` 嵌套作用域时，暗色根状态写 `&.dark`，编译结果必须是 `html:lang(zh).dark`；不得写成会生成 `html:lang(zh) .dark` 的后代选择器。单元测试应编译 SCSS 并阻止这一回归。
- 常规正文和次要文字对其实际面板底色至少满足 WCAG AA 4.5:1，大标题至少 3:1；渐变面板按最不利的实色底计算，不能只看 token 名称推断对比度。
- “全站扫描”必须输出逐页档案和问题结果；静态通过后仍要遍历全部中文路由做 H1、横向溢出和低对比冒烟，并对五类代表页执行桌面/移动、亮/暗截图矩阵。扫描数量、构建成功或单页截图均不能单独证明全站已经美化。
<!-- /microi-progressive:chunk -->
