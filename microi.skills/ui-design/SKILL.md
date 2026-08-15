---
name: ui-design
description: Microi UI 设计系统指南。用于设计 PC Vue、Element Plus、uni-app H5、仪表盘、表单、卡片、渐变、响应式布局、骨架屏、移动安全区和视觉打磨。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi吾码设计规范

你正在为 Microi 吾码平台创建界面。所有页面、组件、弹窗必须遵循本规范，打造高级、克制、具有科技感和品牌识别度的视觉体验。

> **适用平台**：PC 端（Vue 3 + Element Plus + SCSS）、移动端 H5/uni-app/原生 WebView（纯 CSS / 无第三方组件库）
> **核心理念**：高级但不浮夸，动效丰富但可维护，多端统一同时尊重平台差异
> **变量前缀**：所有 CSS 变量统一使用 `--mci-` 前缀（Microi Interface）

---

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=ui-design-000 sha256=4b6409ab265eb741b2f4b28b51b7de12cde79ff4a19c8a6e8acf80ac867444be -->
## 整体风格定义

- **风格关键词**：高级、通透、科技感、品牌化、轻量精致、视觉张力。
- **质感**：柔和多层阴影、清晰边界、结构化光影、细腻纹理、精致微动效。
- **氛围**：默认亮色多彩主题（colorful + gradient + soft shadow），暗黑主题作为可选切换；避免廉价装饰，优先用布局、层级、动效和真实内容建立高级感。
- **参考吸收**：可参考成熟移动端 UI 灵感库的组件完整度、色彩节奏、入场动效和模板化能力，但 Microi 视觉必须通过 `--mci-*` token 与 MCI-UI 组件形成自己的品牌系统，不照搬第三方外观，也不在吾码源码、文档或样式命名中保留外部 UI 品牌痕迹。

### Microi 设计模式选择（必须）

- 当需求只描述“高级、主流、好看”而没有明确视觉方向时，先从 Microi 内置模式中确定一种主结构：品牌叙事、真实产品流程、趋势构图、沉浸互动、动态首屏或数据工作台；再选择至多两种辅助能力。禁止把多套视觉语言堆成拼盘。
- 设计结果必须被拆成可执行规则：首屏目标、信息层级、栅格与最大宽度、字体层级、语义颜色、间距、圆角/阴影、组件状态、动效时间线、响应式重排、低性能降级和 `prefers-reduced-motion`。
- 先完成默认、加载、空、错误、成功、权限、禁用等真实业务状态，再增加装饰和动效；任何看起来可点击的元素都必须有真实结果。
- 所有异步内容加载统一使用贴合最终几何的主题骨架；菜单切换、首页、表格、表单/详情、弹窗和远程媒体都不得退回半透明黑色遮罩。具体实现、主题令牌与状态边界读取 [references/progressive-02-字体.md](references/progressive-02-字体.md)。
- 所有成品只使用 Microi 自有内容、`--mci-*` token、`mci-*` 组件/类名和项目合法资产。禁止复制第三方页面、源码、图片、字体、3D 模型、商标或原始设计 token。
- 设计前必须读取 [references/design-pattern-library.md](references/design-pattern-library.md)；涉及登录、订阅、支付、权限、搜索、设置等流程时再读 [references/product-flow-recipes.md](references/product-flow-recipes.md)；涉及滚动、3D、Canvas/WebGL 或动态 Hero 时再读 [references/motion-and-media.md](references/motion-and-media.md)；生成整站或交给 AI 延续设计时使用 [references/mci-design-contract.md](references/mci-design-contract.md)。
- 可运行原创案例位于 [assets/pattern-showcase/index.html](assets/pattern-showcase/index.html)，用于理解结构和状态，不作为需要逐像素复制的模板。

### 可执行设计契约（整站与长期项目强制）

- `MCI-DESIGN.md` 必须同时维护机器可读层和人类可读层：前者保存精确 token、引用和组件状态，后者保存目标用户、情绪、具体视觉隐喻、选择理由和禁区。只有 token 会失去取舍依据，只有形容词无法稳定实现。
- 设计意图按“用户任务 → 主情绪 → 具体视觉隐喻 → 应当/禁止 → token 与组件”收敛。具体隐喻必须能自然约束色彩、材质、密度、形状和动效；禁止只堆“高级、现代、极简、科技”等宽泛词。
- 核心章节固定为：产品与用户、视觉性格、颜色、字体、布局与间距、层级与形状、组件与状态、页面模式、动效与媒体、响应式、安全与降级、应当与禁止。扩展章节放在末尾，未知扩展要保留，核心章节不得重复或用近似拼写另起一套。
- token 使用语义命名并允许组件以 `{路径}` 复用；必须检查缺失/循环引用、错误类型、主色缺失、透明色叠加底、对比度、孤立 token、未覆盖状态和无理由省略。组件至少按适用场景定义 default/hover/focus/pressed/loading/empty/error/disabled/selected/success。
- 契约与实现必须一起评审差异；意外删除、重命名、大范围 token 漂移或只改契约不改页面都视为未完成。运行时变量或其它主题格式只能从已校验的机器块派生，禁止维护第二份手工 token。
- 契约格式必须锁定版本，升级时先检查语义差异再迁移；跨平台校验脚本提供稳定入口。完整结构、示例与验收见 [references/mci-design-contract.md](references/mci-design-contract.md)，新项目复制 [assets/templates/MCI-DESIGN.md](assets/templates/MCI-DESIGN.md)。

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-001 sha256=9593e1ab2bf4931cf4f0d96b87ce59c04a8d340dbf30c705f90375ec38d131fd -->
## 样式隔离与抗覆盖

- Microi.UI 页面或局部 UI 必须使用 `.mci-page`、`data-mci-ui-root` 或项目级 `.mci-*` 根容器包裹，避免被宿主项目、第三方组件库、Markdown 渲染器的全局 CSS 意外覆盖。
- 所有可复用组件必须使用 `mci-` 前缀和 BEM 风格类名；不要写全局 `button`、`input`、`img`、`table`、`div` 选择器。确实需要 reset 时必须限制在 `.mci-page` 或 `[data-mci-ui-root]` 内。
- 业务页面不得用高优先级全局选择器覆盖 MCI 组件，例如 `.card *`、`button {}`、`img {}`、`.page .mci-card {}`。需要定制时用组件 props、CSS 变量或项目级 wrapper。
- 第三方 UI 组件必须放在项目 wrapper 内，例如 `.mci-third-party-scope`，颜色、圆角、阴影、间距映射到 `--mci-*` token，而不是直接把第三方默认主题暴露到页面。
- Web 项目优先用 Vue `scoped` / CSS Modules / 明确命名空间；uni-app 项目优先用页面级 `mci-*` 根类和组件根类。新增全局样式前必须检查是否会影响其它项目页面。
- 文档站、官网、企业站这类 Markdown/VitePress 项目，应在主题层统一收口视觉，不要在每一篇文档里写互相竞争的散装 CSS。

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-002 sha256=4339d981ddbc6340663729c1bd89f6be9f9215fa1c6768260377b6feaf202505 -->
## 高端视觉标准

- 每个新页面必须有首屏视觉重心：核心数据、主任务、产品/品牌对象或可操作内容应在第一屏明确出现，不能只有说明文字或空白装饰。
- 页面进入必须有轻量入场动效，默认使用 `mci-page-enter` / `mci-fade-up`；列表、商品、指标卡使用 30-60ms 交错延迟，不能整页同时僵硬出现。
- 页面停留时允许微弱的停留动效：扫光、细线流动、图标轻浮动、状态光标闪烁等；振幅必须小，且只用 `transform` / `opacity` / `background-position`。
- 所有可点击元素必须有三态反馈：默认、hover/focus、active/pressed；PC 使用 hover lift，移动端使用按压缩放或背景反馈。
- 扁平风格也要有层次：减少圆角不等于没有阴影，必须保留细边框、柔和投影、hover 伪元素阴影和清晰分组。
- 背景装饰优先使用结构化方案：网格、细线、扫描高光、低透明纹理、内容相关图片或 3D 场景；不要使用离散光球、散点噪声、模糊色块堆叠作为主要视觉。
- 导航栏必须和首屏背景属于同一视觉语境：深色英雄区使用深色玻璃或透明暗底导航，浅色内容页才使用浅色导航；导航文字、Logo、搜索框和下拉入口必须截图检查对比度。
- 主按钮/胶囊按钮必须使用 `inline-flex` 或等价布局垂直居中，明确 `align-items:center`、`justify-content:center`、稳定高度和 `line-height:1`；不能只靠 padding 让文字“看起来差不多”。
- 按钮、标签、Tab、空态行动按钮、登录/授权入口等只要文字语义是居中呈现，就必须同时做到上下居中和左右居中；截图或视觉断言发现文字偏上、偏下、偏左、偏右都算未完成。
- 所有弹窗/对话框默认必须上下左右居中；PC 端应支持通过标题栏拖动，拖动后仍保持在可视区域内；移动端如改为底部抽屉或全屏弹层必须有明确业务理由。弹窗不得贴在左上角、底部或被遮罩/导航/输入框遮挡，截图验收必须覆盖默认居中态和至少一次拖动后的可用状态。
- 禁止在任何交付界面中直接调用浏览器原生 `window.alert`、`window.confirm`、`window.prompt` 或其无前缀别名。简单提示优先使用吾码平台 `Tips`/`DiyCommon.Tips`，确认操作使用 `V8.ConfirmTips`、Element Plus `ElMessageBox`，独立微服务则使用符合本规范的可访问确认弹层；原生浏览器对话框会阻塞线程、无法主题化，也无法满足吾码视觉与自动化标准。
- Toast、错误反馈、提交结果和二次确认必须脱离业务滚动容器：优先 teleport/append 到 `body`，使用 `position:fixed`、明确遮罩和高于宿主弹窗的层级，并在当前可视区域上下左右居中。用户把长弹窗滚到任意位置后仍必须立刻看到完整提示；禁止把反馈放在内容顶部、滚动层内部或仅靠 `top: 0` 伪装固定。
- 确认框必须说明“即将执行什么、作用范围、当前任务状态、确认与取消动作”。只有真实检测到正在执行/排队任务时才能写“已有任务”；没有检测到时应明确“提交后新建任务”，并把并发到来时的排队策略作为条件说明，不能用固定模板误导用户。
- 同一类 UI 在两个及以上页面出现时，必须优先封装为 `Mci*` 或项目级 `mci-*` 组件，通过 props/slots/events 配置标题、说明、图标、按钮、路由、状态和少量变体；不要复制两份卡片、空态、登录提示、按钮组、筛选栏或底部操作栏。
- 卡片背景必须服务页面氛围：暗色科技背景上的展示卡、价格卡、聊天卡不应突然变成大面积灰白卡；浅色卡片只在整体页面转为浅色内容区时使用，并且要有过渡带或区块背景承接。

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-003 sha256=62b9d5696d23ded43a0a7c82d520b69ee8182269579c7171808325877144abd3 -->
## PC 后台菜单宫格 / 入口页规范

适用于 `sys_menu` 子菜单入口、工作台快捷入口、后台功能入口页。此类页面是操作入口，不是营销卡片墙，重点是密度克制、对齐稳定、快速识别。

- 宽屏不能无上限铺满一整行。1366-1920 宽度下推荐 6-8 个入口/行；超宽屏也不要因为 `repeat(auto-fill, minmax(..., 1fr))` 自动挤出 10 个以上入口。应使用固定/上限列宽、`max-width`、`justify-content:start` 控制节奏。
- 同一宫格内所有入口卡片必须宽高一致，优先使用固定 `width/height` 或 `aspect-ratio + max-width`。禁止让卡片随标题长度、是否有统计信息而高度不一致。
- 卡片内部必须建立固定槽位：图标区、标题区、辅助信息区。每张卡的图标、标题首行、统计胶囊应在同一水平线上；有无辅助信息都要通过固定 body 高度或预留槽位保持对齐。
- 标题与子菜单统计/辅助胶囊的间距控制在 4-6px，不能贴底，也不能和标题隔得很远。统计胶囊应跟随标题成为一个信息组。
- PC 卡片内边距不小于 14-18px，图标背景到卡片边缘不小于 16px；移动端内边距不小于 12px。不能出现图标、文字、统计贴边的效果。
- 标题最多两行并截断或自然换行，长词必须 `overflow-wrap:anywhere`，不允许撑破卡片。图标按钮、标题、统计文本都要垂直和水平对齐。
- 修改后必须截图验收 1366/1440/1920 桌面宽度和 390 左右移动宽度，检查每行数量、行列对齐、卡片内边距、标题与统计间距、文字溢出和横向滚动。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-004 sha256=5d3aebaa07bf0df572b5eadfbc567fa58138a78816f0edf25fcff1a93d914ac7 -->
## PC 后台数据卡片模式规范

适用于 `diy-table` 卡片模式、任务/应用/客户/资产列表。它是高频数据操作容器，不是营销海报或入口宫格。

- 信息顺序固定为“真实图片或紧凑身份标记 → 标题与状态 → 2—4 个关键字段 → 时间/辅助标签 → 操作区”。标题与状态在首屏可扫读，次要字段不能抢占标题层级。
- 配置了图片但某行无图时，用 40—44px 首字或业务图标承接身份；禁止生成大面积渐变、发光字母、旋转方块等伪图片占据内容高度。真实图片按稳定比例使用 `cover/contain`。
- 无显式配置时桌面默认四列，以最小可读宽度优先；显式 `TableCardCol` 配置必须保留。中等宽度降为三列/两列，移动端单列，禁止为“同屏更多”把标题和四个操作挤进过窄卡片。
- 卡片依靠表面、细边框、轻阴影和 1—2px hover lift 建立层级；不要给每张卡加顶部霓虹线、径向光斑、彩虹渐变或重投影。选中态只改边框/焦点环，不能导致网格跳动。
- 操作区优先一个主动作、一至两个次动作，其余进入“更多”；危险动作不得与主动作同权。按钮使用 8—10px 软圆角而非满屏胶囊，移动端高度不小于 44px。
- 整卡可打开详情时提供可见 `focus-visible`、Enter/Space 触发；内部按钮和选择控件阻止冒泡。骨架屏要复刻图片（如有）、标题、字段和按钮的最终几何，不能先显示大图骨架再塌缩为空白。
- 视觉验收至少覆盖：无图/有图、长标题、多个按钮、选中态、加载/空态、亮/暗主题、1366/1440/1920 桌面与 390 移动。

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-005 sha256=99d3734279a75fe306ebf09943b0c550433d311c1df0b9cc63137aca835b9972 -->
## 形态模式（圆角 / 扁平）

Microi 项目必须支持用户或项目级形态偏好：`data-mci-shape="rounded"` 与 `data-mci-shape="flat"`。

```css
:root {
  --mci-shape-card: var(--mci-radius-xl);
  --mci-shape-panel: var(--mci-radius-lg);
  --mci-shape-button: var(--mci-radius-pill);
  --mci-shape-input: var(--mci-radius-md);
}

:root[data-mci-shape="rounded"] {
  --mci-shape-card: 20px;
  --mci-shape-panel: 16px;
  --mci-shape-button: 999px;
  --mci-shape-input: 12px;
}

:root[data-mci-shape="flat"] {
  --mci-shape-card: 6px;
  --mci-shape-panel: 4px;
  --mci-shape-button: 4px;
  --mci-shape-input: 4px;
}
```

- 圆角风格适合移动端商城、会员中心、消费类应用、品牌展示页。
- 扁平风格适合 B 端官网、数据看板、工具型 Web、强调效率的页面。
- 所有组件只引用 `--mci-shape-*`，不要在业务页面硬编码一堆 `border-radius`。
- 切换形态时只改变圆角 token，不改变布局尺寸，避免切换主题时页面跳动。

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-006 sha256=f8d9a7c96a2c2696f82b596bdf1a7d02bed72ff796036c05d771ca3954bf68ba -->
## 圆角

```css
:root {
  --mci-radius-sm: 8px;
  --mci-radius-md: 12px;
  --mci-radius-lg: 16px;
  --mci-radius-xl: 20px;
  --mci-radius-2xl: 24px;
  --mci-radius-full: 9999px;   /* 胶囊按钮 */
}
```

| 元素 | 圆角 |
|------|------|
| 小按钮/标签 | `--mci-radius-sm` (8px) |
| 常规按钮 | `--mci-radius-md` (12px) |
| 卡片 | `--mci-radius-xl` (20px) |
| 弹窗 | `--mci-radius-2xl` (24px) |
| 胶囊按钮/搜索框 | `--mci-radius-full` |

---

<!-- /microi-progressive:chunk -->
## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-颜色体系-css-variables-支持主题切换.md](references/progressive-01-颜色体系-css-variables-支持主题切换.md)：颜色体系（CSS Variables — 支持主题切换）；阴影体系（层次与质感）
- [references/progressive-02-字体.md](references/progressive-02-字体.md)：字体；间距与触摸目标；骨架屏 Loading 设计规范
- [references/progressive-03-动效规范-丰富但不卡.md](references/progressive-03-动效规范-丰富但不卡.md)：动效规范（丰富但不卡）；Vue 3 过渡动画
- [references/progressive-04-组件风格速查.md](references/progressive-04-组件风格速查.md)：组件风格速查
- [references/progressive-05-移动端专用规范.md](references/progressive-05-移动端专用规范.md)：移动端专用规范；装饰性背景（低性能消耗方案）；性能检查清单
- [references/progressive-06-主题切换实现.md](references/progressive-06-主题切换实现.md)：主题切换实现；命名规范
- [references/progressive-07-速查-从头搭建一个移动端页面.md](references/progressive-07-速查-从头搭建一个移动端页面.md)：速查：从头搭建一个移动端页面；🚨 移动端低代码项目落地踩坑（必读，2026.5）；🔗 关联字段：保存真实 Id，界面展示可读标签；表单布局规范（Column）
- [references/progressive-08-表单分组规范-tabs-vs-collapsegroup-强制.md](references/progressive-08-表单分组规范-tabs-vs-collapsegroup-强制.md)：表单分组规范：Tabs vs CollapseGroup（强制）；缓存刷新（解决"我改了字段但页面不变"问题）；接口引擎匿名访问；MCI-UI 与第三方组件库策略；MCI-UI 源码落地位置；VitePress 中文文档布局规范
<!-- microi-progressive:end -->
