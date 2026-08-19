# MCI-DESIGN

> 本文件是 Microi吾码官方网站的设计契约。首页或全站视觉结构变化时，必须同步评审本契约、主题源码与桌面/移动截图。

```yaml
contract:
  version: 1
  project: Microi吾码官方网站
  mode: brand-narrative
  intent: 像一张清晰的企业软件工程控制台，让访问者快速理解产品定位、开发路径与可信证据

tokens:
  color:
    canvas: var(--mci-ai-page-bg)
    surface: var(--mci-ai-surface)
    surfaceSolid: var(--mci-ai-surface-solid)
    surfaceSoft: var(--mci-ai-surface-soft)
    textPrimary: var(--mci-ai-text)
    textSecondary: var(--mci-ai-text-soft)
    textMuted: var(--mci-ai-text-muted)
    primary: var(--mci-ai-primary)
    primaryStrong: var(--mci-ai-primary-strong)
    cool: var(--mci-ai-cool)
    danger: var(--mci-color-danger, "#D92D20")
  typography:
    display: { size: "clamp(44px, 5.1vw, 62px)", lineHeight: 1.08, weight: 860 }
    h1Mobile: { size: "clamp(34px, 10.2vw, 46px)", lineHeight: 1.12, weight: 860 }
    h2: { size: "clamp(30px, 3.5vw, 44px)", lineHeight: 1.22, weight: 760 }
    body: { size: 15px, lineHeight: 1.75, weight: 400 }
    meta: { size: 12px, lineHeight: 1.6, weight: 650 }
  spacing:
    micro: 4px
    compact: 8px
    control: 12px
    card: 24px
    section: 72px
    pageDesktop: 24px
    pageMobile: 14px
  shape:
    control: var(--mci-radius-lg, 12px)
    card: 24px
    heroMap: 26px
    pill: var(--mci-radius-pill, 999px)
  elevation:
    card: var(--mci-ai-shadow-soft)
    map: var(--mci-ai-shadow)

components:
  heroAction:
    height: 48px
    states:
      default: { background: "{tokens.color.primary}" }
      hover: { lift: -2px }
      focus: { outline: "{tokens.color.primary}" }
      pressed: { scale: 0.98 }
      loading: { preserveWidth: true }
      disabled: { opacity: 0.38 }
  developmentMap:
    background: "{tokens.color.surface}"
    radius: "{tokens.shape.heroMap}"
    padding: "{tokens.spacing.card}"
    states:
      default: { elevation: "{tokens.elevation.map}" }
      hover: { elevation: "{tokens.elevation.map}" }
      focus: { outline: "{tokens.color.primary}" }
      selected: { border: "{tokens.color.primary}" }
      success: { accent: "{tokens.color.cool}" }
  aiChat:
    background: "{tokens.color.surfaceSolid}"
    radius: 20px
    states:
      default: { border: var(--mci-ai-line-strong) }
      focus: { outline: "{tokens.color.primary}" }
      loading: { preserveLayout: true }
      empty: { showPrompt: true }
      error: { showRecovery: true }
      disabled: { showLoginReason: true }

omissions:
  - rule: backgroundVideo
    reason: 定位与开发路径应在无媒体资源时仍立即可读，避免首屏依赖大文件
  - rule: webglHero
    reason: 架构关系用可访问 DOM 表达，低性能设备与搜索引擎获得相同信息
```

## 1. 产品概览与目标用户

- 首要用户：企业软件负责人、架构师、专业开发者、低代码开发者与技术决策者。
- 首要任务：在 3 秒内判断 Microi吾码是什么、为何适合中大型应用、如何开始。
- 用户进入后第一眼必须理解：吾码不只提供低代码工具，而是把低代码、V8、专业源码与 AI 组织成连续开发路径。
- 成功结果与衡量方式：首屏定位可复述，主操作可直接到达快速开始或源码架构；开发路径图无需阅读长文即可理解。
- 关键设备与使用环境：1440/1920 桌面为主，兼容 390px 手机、亮色/暗色和 200% 浏览器缩放。

## 2. 视觉性格与情绪目标

- 主情绪：可信。
- 具体视觉隐喻：夜间工程控制台——精确边界、清晰分层、少量红色动作信号与青色交付信号。
- 辅助气质：克制、敏捷。
- 选择理由：企业开发平台应让复杂能力看起来有秩序，而不是用功能文字墙证明强大。
- 明确不采用的视觉语言：随机光球、彩虹渐变、纯聊天工具首屏、营销卡片无限堆叠。

## 3. 颜色

- 页面底色与表面关系：画布使用低对比结构网格；地图、价值带和 AI 输入区使用逐级抬升的表面色。
- 主色只用于：主 CTA、定位强调、当前开发层和焦点状态。
- 成功 / 警告 / 危险 / 信息色语义：沿用 MCI-UI 语义 token，不把装饰色当状态色。
- 明亮与暗黑主题的对比策略：暗色使用更亮的红色强调，亮色使用更深的品牌红；正文不依赖透明渐变文字。
- 透明表面的叠加底色：只叠加在 `--mci-ai-page-bg` 或 `--mci-ai-surface-soft` 上；不支持透明时退回实体表面。

## 4. 字体

| 角色 | 字号 / 行高 / 字重 | 用途 | 禁止 |
| --- | --- | --- | --- |
| Display | `clamp(44px, 5.1vw, 62px)` / 1.08 / 860 | 首页定位 | 超过三行、渐变透明字 |
| H1 Mobile | `clamp(34px, 10.2vw, 46px)` / 1.12 / 860 | 手机首屏定位 | 小于 34px 导致失去视觉锚点 |
| H2 | `clamp(30px, 3.5vw, 44px)` / 1.22 / 760 | 区块论点 | 与正文同权 |
| Body | 15–19px / 1.75 / 400 | 价值说明 | 超过 70 字符的无分段长行 |
| Meta | 10–12px / 1.6 / 650–800 | 层级、编号、事实标签 | 承载关键业务结论 |

## 5. 布局与间距

- Desktop：12 列，最大宽度 1320px；AI Studio 先以居中单列建立入口，平台定位区再用 5/7 左右分栏。
- Tablet：8 列，1100px 以下转为单列，文案居中，开发路径图保持完整宽度。
- Mobile：4 列，左右安全间距 14px；开发模式从三列变为三段纵向层级。
- 内部紧凑间距：8–16px；相邻元数据保持同一视觉组。
- 区域与页面留白：AI Studio 与平台定位区保持约 64–80px 视觉间隔；价值带与 NuGet 证据区保持 56–80px 间隔，禁止一处过疏、一处相贴。

## 6. 层级、材质与形状

- 深度来自：色调层、细边框、结构网格与环境阴影；玻璃只用于导航等小面积区域。
- 24–26px 卡片圆角表达完整平台，8–12px 控件圆角表达精确工具感；AI Studio 品牌标识保留金色圆点、暖金描边和完整胶囊轮廓。
- 页面 / 卡片 / 浮层的层级关系：画布 < 连续价值带 < 开发路径图 / AI 输入区 < 导航。
- 低性能与不支持透明效果时的降级：实体表面、无扫光、无模糊；信息结构不变。

## 7. 组件与状态

| 组件 | Default | Hover / Focus / Pressed | Loading | Empty / Error | Disabled | Selected / Success |
| --- | --- | --- | --- | --- | --- | --- |
| 主按钮 | 品牌红、图标加文字 | 上浮 2px、3px 焦点环、按压 0.98 | 保持宽度 | - | 0.38 透明度 | - |
| 开发路径图 | 三层关系可读 | 可见边界与焦点 | 静态内容无需加载 | 无脚本仍完整显示 | - | V8 层用品牌色强调 |
| AI 输入区 | 实体抬升表面 | 快捷按钮与发送按钮三态完整 | 思考点动效 | 错误文案和重试路径 | 未登录显示原因与登录按钮 | 登录后恢复输入 |
| 应用 / NuGet 数据 | 复用现有组件契约 | 保留键盘焦点 | 贴合最终几何的骨架 | 明确重试，不循环请求 | - | 成功后展示可信数据 |

## 8. 页面模式与信息架构

1. 互动入口：Microi AI Studio 以原有金色胶囊品牌标识开场，先表达“复用成熟引擎、贯通低代码到源码、聚焦业务增量”，再承接需求输入。
2. 平台定位：一句定位、两项操作、平台事实与三层开发路径图，承接“不只是开源 AI 低代码”。
3. 核心任务：用三个连续价值块解释“少造轮子、不设天花板、可长期交付”。
4. 证据：NuGet 官方采用数据与公开应用。
5. 最终行动：快速开始、源码架构、应用体验。

- 主模式：品牌叙事。
- 辅助能力：动态首屏、真实产品流程。

## 9. 动效与媒体

- 0—120ms：结构网格、AI Studio 品牌标识和登录入口可读。
- 120—360ms：平台定位文案与按钮稳定呈现。
- 360—800ms：开发路径图进入；不阻塞 CTA 或 AI 入口。
- 循环动效存在理由：路径图低频扫光只提示“连续交付链”，8 秒一轮且可关闭。
- 图片比例与 `object-fit`：应用商城沿用固定预览比例；首屏不依赖图片。
- `prefers-reduced-motion` 与静态降级：关闭扫光、思考点和过渡，保留最终布局。

## 10. 响应式与安全区

| 宽度 | 栅格 | 导航 | 主操作 | 内容重排 |
| --- | --- | --- | --- | --- |
| 390 | 4 列 | VitePress 手机导航，44px 以上触控区 | 两个按钮纵向满宽 | 路径图三层纵向排列，价值带单列 |
| 768 | 8 列 | 紧凑导航 | 可并排或自然换行 | 首屏单列，地图保持横向三层 |
| 1440 | 12 列 | 浮动玻璃导航 | 左侧并排 | 5/7 首屏分栏，价值带三列 |

## 11. 可访问性、性能与降级

- 键盘顺序与可见焦点：AI 输入 / 登录 → 主 CTA → 次 CTA → 实测链接 → 后续数据与应用操作；焦点环不被裁切。
- 正文、状态与交互对比度：正文按实际表面满足 WCAG AA；大标题至少 3:1。
- 触控目标：移动端主要操作不小于 44px。
- 首屏资源预算：无首屏远程图、视频、Canvas 或 WebGL 阻塞。
- 网络失败、媒体失败与离线策略：首屏定位与路径图完全静态；远程数据组件使用现有缓存、骨架和手动重试。
- 骨架屏、空态、错误态与恢复路径：NuGet 与应用商城按组件契约处理；AI 未登录与打开失败均提供明确恢复路径。

## 12. 应当与禁止

### 应当

- 用“低代码 → V8 → 专业源码”的关系图代替功能目录。
- 把“开源 AI 低代码”保留为认知入口，把“开源 AI 应用开发平台 / 企业级开发框架”作为主定位。
- AI Studio 标题先讲结果与差异，再讲如何选择开发层，避免写成使用说明。
- 让每个按钮、数字和公开应用都能到达真实页面或数据源。

### 禁止

- 宣传低代码会替代专业开发，或把高代码与低代码描述成只能二选一。
- 在首屏堆几十项功能、多个同权 CTA 或无法复现的绝对效率承诺。
- 用抽象光球、持续模糊、背景视频或 3D 装饰遮挡产品关系。

## 有意省略

| 规则 | 省略理由 | 替代方案 |
| --- | --- | --- |
| 首屏产品截图 | 平台价值是多层开发关系，单一后台截图会缩窄认知 | 使用可访问的开发路径图，应用截图放入应用商城证据区 |
| 首屏动态远程数据 | 首屏定位必须离线可读 | NuGet 与应用列表放在后续证据区并保留骨架、缓存和重试 |

## 验收清单

- [ ] 机器块能解析，核心章节顺序正确，无重复或近似拼写章节。
- [ ] 所有 `{路径}` 引用存在且无循环；无未说明的孤立 token。
- [ ] 首屏在 3 秒内说清产品、对象和主操作。
- [ ] 默认、加载、空、错误、禁用、权限、成功状态可验证。
- [ ] 390 / 768 / 1440 无横向滚动、遮挡和错位。
- [ ] 明亮、暗黑主题均有足够对比度。
- [ ] 所有可点击元素有 hover、focus、pressed 和真实结果。
- [ ] 动效尊重 `prefers-reduced-motion`。
- [ ] 契约差异与实现差异同时评审，没有意外删除或语义漂移。
- [ ] 所有图片、字体、模型和代码资产来源合法且可离线构建。
