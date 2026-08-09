# MCI-DESIGN

```yaml
contract:
  version: 1
  project: Microi吾码 AI 平台治理中心
  mode: data-workspace
  intent: 安静、可信、可快速扫描并能安全执行平台治理动作的专业工作台

tokens:
  color:
    canvas: var(--mci-bg-base)
    surface: var(--mci-bg-card)
    surfaceElevated: var(--mci-bg-elevated)
    textPrimary: var(--mci-text-primary)
    textSecondary: var(--mci-text-secondary)
    primary: var(--mci-color-primary)
    success: var(--mci-color-success)
    warning: var(--mci-color-warning)
    danger: var(--mci-color-danger)
  typography:
    hero: { size: 28px, lineHeight: 1.25, weight: 760 }
    title: { size: 16px, lineHeight: 1.45, weight: 700 }
    body: { size: 14px, lineHeight: 1.65, weight: 400 }
    meta: { size: 12px, lineHeight: 1.5, weight: 560 }
  spacing:
    compact: 8px
    control: 12px
    card: 16px
    section: 24px
  shape:
    control: var(--mci-shape-input)
    card: var(--mci-shape-card)
    pill: var(--mci-radius-full)
  elevation:
    card: var(--mci-shadow-card)
    cardHover: var(--mci-shadow-card-hover)

components:
  primaryAction:
    states:
      default: { background: "{tokens.color.primary}" }
      hover: { lift: -1px }
      focus: { outline: "{tokens.color.primary}" }
      pressed: { scale: 0.98 }
      loading: { disabled: true }
      disabled: { opacity: 0.52 }
      success: { background: "{tokens.color.success}" }
      error: { background: "{tokens.color.danger}" }
  dataCard:
    background: "{tokens.color.surface}"
    radius: "{tokens.shape.card}"
    padding: "{tokens.spacing.card}"
    states:
      default: { elevation: "{tokens.elevation.card}" }
      hover: { elevation: "{tokens.elevation.cardHover}", lift: -2px }
      focus: { outline: "{tokens.color.primary}" }
      selected: { border: "{tokens.color.primary}" }
      loading: { skeleton: true }
      empty: { action: true }
      error: { action: retry }
      disabled: { opacity: 0.56 }
  dialog:
    states:
      default: { centered: true, draggable: true }
      loading: { confirmDisabled: true }
      error: { feedbackLayer: body }

omissions:
  - rule: backgroundVideo
    reason: 高频治理页不需要持续媒体，减少干扰和资源开销
  - rule: webglDecoration
    reason: 数据工作台优先稳定、可访问和低资源占用
```

## 1. 产品概览与目标用户

产品服务平台管理员、架构师、运维与交付工程师。成功结果是快速看清平台健康度，完成门户发布、身份同步、功能开关、发布门禁、服务登记和告警处置，并能解释每次动作的输入、影响、版本与恢复路径。

## 2. 视觉性格与情绪目标

主情绪是可信与专注，具体隐喻为“安静的专业工作台”。界面依靠对齐、细边框、低彩表面和少量品牌红建立层级，不用炫光装饰冒充科技感。

## 3. 颜色

继承 Microi.UI 的 `--mci-*` 语义变量。红色仅承担品牌主动作；绿、黄、红分别表示成功、风险与失败，状态颜色不得随机变化。亮暗主题均需保证正文 4.5:1 对比度。

## 4. 字体

中文使用系统无衬线字体，指标数字使用等宽数字特性。标题紧凑、正文舒展、元数据清晰，不用超大字号挤压第一屏业务内容。

## 5. 布局与间距

桌面最大宽度 1560px，12 列网格；第一屏保留 2—4 个高信号指标、异常与主动作。区块外部 24px，卡片内部 16px。移动端重排为单列，不缩放桌面表格。

## 6. 层级、材质与形状

层级来自底色、细边框、轻阴影和 1—2px hover lift。圆角服从 `data-mci-shape`；不使用大面积玻璃模糊、随机光球或厚重投影。

## 7. 组件与状态

按钮、卡片、输入、表格、弹窗覆盖默认、悬浮、焦点、按下、加载、空、错误、禁用、选中与成功状态。异步首屏使用几何一致的骨架屏。确认框必须说明动作、范围、当前版本和取消路径。

## 8. 页面模式与信息架构

总览采用数据工作台；门户与身份采用真实产品流程；发布、服务和可观测页使用“摘要 → 异常 → 明细 → 主动作”结构。导入页只生成计划，不把解析成功等同于写入成功。

## 9. 动效与媒体

入场 260—400ms，交互 140—220ms，只动画 `transform` 与 `opacity`。`prefers-reduced-motion` 时关闭交错和停留动效。

## 10. 响应式与安全区

桌面验收 1440/1920，移动验收 390。移动端触摸目标不小于 44px，固定操作区包含安全区，任何视口不得横向滚动。

## 11. 可访问性、性能与降级

语义标签、连续键盘顺序、可见焦点、错误关联和屏幕阅读标题为必需项。接口失败保留输入并提供重试；宿主桥接缺失时显示独立运行说明，不伪造成功。

## 12. 应当与禁止

应当：展示真实版本/哈希、让危险动作先预检、让每个状态有恢复路径。禁止：前端存密钥、原生 alert/confirm/prompt、彩虹图表、无结果的假按钮、用 localStorage 作为平台业务事实源。
