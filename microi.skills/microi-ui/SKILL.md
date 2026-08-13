---
name: microi-ui
description: 用于构建或编写 Microi.UI / MCI-UI 文档，覆盖 Vue 3 网站、响应式站点、uni-app 移动端、主题色板、形态模式、高品质移动端界面、骨架屏、安全区、动效和 Microi 品牌前端组件。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi.UI / MCI-UI

Microi.UI 是 Microi 产品共享前端设计系统。Vue 3 网站、响应式站点、H5 和 uni-app 移动端项目都应使用它。PC 后台页面仍可使用 Element Plus，但视觉变量、加载状态、空状态、动效和品牌色应与 `--mci-*` 变量保持一致。

当用户要求制作 Microi 移动端应用、H5、小程序、客户门户、员工端、会员中心、官网、产品站、活动页、仪表盘或报告页，且没有指定其它设计系统时，默认使用 Microi.UI。

这是自动规则。不要等用户明确说“遵循 `microi.skills/microi-ui/SKILL.md`”。只要仓库、需求、文件路径或项目上下文属于 Microi 生态，且工作涉及前端界面、网站界面、H5、uni-app、小程序、客户/员工/会员页面、报告、仪表盘或视觉打磨，就默认读取并应用本 skill。

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=microi-ui-000 sha256=5952d38dd1ffabb11b55b833bc26c432b723159c4ad688897e3bdbbb20a03b52 -->
## 核心承诺

Microi.UI 不只是组件集合，它是 AI 构建软件的视觉交付标准：

- 每个首屏都必须有明确视觉锚点。
- 每个页面都必须使用有品牌意识的色彩和组件层级。
- 每个重要操作都必须明显、美观且容易触达。
- 每个列表、详情、表单都应基于可复用场景模式构建，而不是复制一次性 CSS。
- 每个移动端页面都必须处理安全区、加载状态、按下反馈和底部操作。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-ui-001 sha256=33d0fbc900090983a0e5959e10f611a3ebb3b9b2c0dc1d13ce7569cfc4701211 -->
## 内置设计模式

当需求只说“主流、高级、好看”时，先为页面确定一种主模式，再开始选组件和写样式：

| 主模式 | 首要目标 | 推荐组合 |
| --- | --- | --- |
| 品牌叙事 | 用单一观点和章节节奏建立记忆 | `MciPage + MciSection + MciButton` |
| 真实产品流程 | 让登录、创建、支付、权限、设置等任务完整可恢复 | `MciFormField + MciButton + MciDataState` |
| 趋势构图 | 用编辑式留白、字号和不对称栅格建立视觉张力 | `MciSection + MciCard + 项目级 mci-*` |
| 沉浸互动 | 用产品对象、Canvas/WebGL 或空间层次辅助理解 | `MciPage + MciHeroPanel + 静态降级资源` |
| 动态首屏 | 用 0—1200ms 时间线组织标题、说明和主操作 | `MciHeroPanel + MciButton + reduced-motion` |
| 数据工作台 | 优先异常、趋势、明细和筛选回显 | `MciMetricCard + MciFilterBar + MciDataState` |

- 一页只能有一个主模式，辅助能力最多两项；禁止把六种风格堆成拼盘。
- 先完成默认、加载、空、错误、禁用、权限、成功状态，再增加装饰和动效。
- 涉及完整产品设计时，读取 [设计模式库](../ui-design/references/design-pattern-library.md)；涉及登录、订阅、支付、权限、搜索和设置时读取 [产品流程配方](../ui-design/references/product-flow-recipes.md)；涉及动效、Canvas/WebGL、图片或视频时读取 [动效与媒体规范](../ui-design/references/motion-and-media.md)。
- 整站或长期维护项目必须在项目根目录维护 `MCI-DESIGN.md`，按 [设计契约规范](../ui-design/references/mci-design-contract.md) 描述 token、组件状态、动效、响应式和降级策略；可复制 [契约模板](../ui-design/assets/templates/MCI-DESIGN.md)。
- 设计契约必须同时包含“精确值”和“设计理由”：机器块保存语义 token、`{路径}` 引用与组件状态，说明章节保存用户任务、主情绪、具体视觉隐喻、选择理由和明确禁区。实现前先读理由，不能只读取色值。
- 契约固定核心章节顺序，检查重复/近似章节、错误类型、缺失/循环引用、主色与对比度、孤立 token、透明表面底色、状态覆盖和有意省略；契约差异与页面差异必须一起评审。
- [原创模式案例](../ui-design/assets/pattern-showcase/index.html) 只用于理解结构、状态和视觉差异，业务项目应替换为自己的信息架构和合法资产。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-ui-002 sha256=37946ecc4b9c4cdca0be4279d6538070cbc9126d9d17305aaaddb0f0806d2fdc -->
## 源码结构

- `Microi.UI/src/theme/tokens.css`：设计变量、色板、圆角、阴影、动效、移动端场景变量。
- `Microi.UI/src/theme/index.css`：基础类、页面壳、移动端高品质基础能力、骨架屏、动效、底部导航、富内容卡片、面板、表单选项。
- `Microi.UI/src/theme/runtime.js`：`initMciDesign`、`applyMciDesign`、`getMciDesign`、`toggleMciTheme`、`setMciTheme`、`setMciPalette`、`setMciShape`、`setMciMotion`。
- `Microi.UI/src/web`：Vue 3 Web 组件。
- `Microi.UI/src/uniapp`：uni-app Vue 3 组件。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-ui-003 sha256=d23efbe5ef40f9352057534fac4aa7cd7808ae2fdb7857d05cb8b57e4a7a9c95 -->
## 默认要求

- 应用启动时调用 `initMciDesign()`，或提供等效的项目级主题服务。
- 支持 `theme: light | dark`、`palette: black | white | red | orange | yellow | green | cyan | blue | purple`、`shape: rounded | flat`、`motion: full | reduced`。
- Microi.UI 页面或嵌入式界面区域使用 `.mci-page` 或 `[data-mci-ui-root]` 包裹。
- 使用 `MciPage` 作为页面壳。移动端客户/员工/会员页面通常应使用 `premium`。
- 业务页面不要硬编码颜色、阴影、圆角、渐变或安全区间距。使用 `--mci-*` 变量或 `mci-*` 类。
- 只允许使用 `mci-` 前缀的公开共享类。不要引入外部 UI 库名称、复制来的类名，或 `.card`、`.list`、`button {}` 这类泛化全局选择器。
- 如果某个界面模式出现在两个及以上页面中，要抽取成 Microi.UI 组件或项目级 `mci-*` 封装。
- 动态页面首次加载必须显示骨架屏，不能只有 spinner，也不能过早显示空状态。
- 醒目按钮必须使用图标加文字，flex 居中，固定高度，具备加载态和按下反馈。
- `open-type="getPhoneNumber"` 这类小程序原生按钮必须样式化为 Microi 主按钮，并移除默认边框。
- API 请求头必须把 `OsClient` 作为单一运行期值传递，例如 `demo`，不得出现 `demo, demo` 这类重复值。
- `MciPage` 必须统一注入运行时安全区变量。微信小程序不能只使用 CSS `env()`；自定义导航页还必须读取胶囊矩形并为 `.mci-topbar` 预留右侧空间。
- 页面安全区验收以 `pages.json` 全路由为清单，至少覆盖 iPhone、Android 和微信开发者工具；首页、详情、表单、底部弹层及 fixed 操作栏必须全部通过。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-ui-004 sha256=7703ed0887bf7d160e212133227a577ccec3d1375530962127a9232d603d7193 -->
## 组件选择

- `MciPage`：页面壳、安全区、动效、高品质移动端背景。
- `MciHeroPanel`：带品牌感的首屏/状态面板。
- `MciBottomNav`：自定义底部导航，支持图标、角标、激活态和可选凸起中间项。
- `MciButton`：主按钮、朴素按钮、金色按钮、冷色按钮、幽灵按钮。
- `MciCard`：通用内容容器。
- `MciCell`：设置、菜单、列表行。
- `MciSection`：主要分区。
- `MciTabs`：分段导航和内容切换。
- `MciMetricCard` / `MciAssetCard`：数字、资产、汇总。
- `MciOrderCard`：订单、工单、任务、维修申请。
- `MciActionBar`：安全区底部操作。
- `MciAvatar`：会员、客户、员工身份。
- `MciProductCard`：商品/内容网格。
- `MciFormField`：表单和数据录入。
- `MciFilterBar`：列表搜索/筛选区域。
- `MciModal`：弹窗和确认。
- `MciUploader`：图片/文件上传。
- `MciTimeline`：服务记录、维修进度、审批记录。
- `MciSteps`：流程和状态阶段。
- `MciSkeleton`：加载占位。
- `MciDataState`：空、错、成功状态。
- `MciRichText`：报告、文章、说明。

### 后台数据卡片

- 卡片模式按“身份 → 标题/状态 → 关键字段 → 时间/标签 → 操作”组织；无真实图片时使用 40—44px 紧凑标记，不使用大面积装饰字母占位。
- 无显式列数时桌面默认四列，显式业务列数优先；平板降为两至三列，移动单列。标题最多两行，数据卡不做营销海报式大图和多重炫光。
- 操作区只突出一个主动作，一至两个次动作，其余进入“更多”；危险动作降权，移动触控高度不小于 44px。
- 可点击整卡必须有 hover/focus/pressed、键盘 Enter/Space、可见焦点与内部控件事件隔离；骨架屏和最终卡片结构等高。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-ui-005 sha256=f46f6672b60d4faad4a0fc501036bcb7b9d04545952ad8acb716668aac699454 -->
## 高品质移动端视觉标准

移动端应用必须像经过打磨的产品，而不是把后台表单硬塞进手机视口。

写页面局部 CSS 前，优先使用这些基础能力：

- `.mci-page--mobile-premium`
- `.mci-mobile-hero`
- `.mci-mobile-panel`
- `.mci-mobile-bubble-grid`
- `.mci-mobile-stat-grid`
- `.mci-mobile-titlebar`
- `.mci-mobile-chip-row`
- `.mci-mobile-bottom-nav`
- `.mci-mobile-rich-card`
- `.mci-mobile-meta-grid`
- `.mci-mobile-option-grid`
- `.mci-mobile-photo-grid`
- `.mci-mobile-sheet`
- `.mci-mobile-chart-card`
- `.mci-mobile-kpi-strip`
- `.mci-mobile-empty-result`

### 首屏规则

首屏必须展示以下任一视觉锚点：

- 带品牌感的首屏面板和 CTA
- 身份/会员头部
- 工作台状态卡
- 报告/状态总览
- 搜索加分类面板
- 图片主导的内容首屏
- KPI 仪表盘摘要

移动端页面不要只用平铺标题和普通列表开头。

### 层次规则

高品质移动端页面通常由以下层次组成：

1. 氛围背景或首屏
2. 悬浮快捷操作或统计面板
3. 带操作的标题栏
4. 富业务卡片
5. 底部导航或固定操作栏

避免单调堆叠相同白卡。

### 图标规则

底部导航、首页快捷操作、个人中心快捷项、九宫格操作、悬浮操作、空状态操作、设置/信息行、主题选项和主按钮必须使用可识别图标。`租`、`版`、`客`、`我` 这类单个汉字是占位，不是图标。

彩色圆形、胶囊或浮动快捷入口必须把“圆底色”和“图标色”作为一组主题 token 处理。红、绿、蓝、灰等深色底必须使用白色或高对比浅色图标；黄色、白色、浅灰底必须使用深色图标。主题覆盖不能只改背景不改 `color`，尤其要覆盖 `.mci-bubble:nth-child(n)`、`.entry:nth-child(n)` 这类更高优先级规则。

主题图标色覆盖必须有足够 CSS 优先级，并检查构建产物。若压缩器把同值 `color` 合并/移除，导致旧主题色胜出，可以对图标对比度兜底规则使用 `!important`，但不要把它扩散到普通布局样式。

### 动效规则

使用克制动效：页面入场、卡片错落出现、点击反馈、骨架屏流光、可选首屏闲置动效/高光。动效不能导致布局位移、文字裁切或操作干扰。尊重 `motion: reduced`。

<!-- /microi-progressive:chunk -->
## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-移动端场景蓝图.md](references/progressive-01-移动端场景蓝图.md)：移动端场景蓝图；网站/PC 站标准；后台菜单配套；AI 实施清单；禁止输出
<!-- microi-progressive:end -->
