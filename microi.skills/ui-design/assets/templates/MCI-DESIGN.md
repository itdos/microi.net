# MCI-DESIGN

> 本文件同时保存精确 token 与设计理由。实现前先读完整文件；修改视觉结构时同步更新本文件、源码和验收截图。

```yaml
contract:
  version: 1
  project:
  mode: data-workspace
  intent:

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
    display: { size: 48px, lineHeight: 1.1, weight: 800 }
    h1: { size: 32px, lineHeight: 1.2, weight: 750 }
    h2: { size: 24px, lineHeight: 1.3, weight: 700 }
    body: { size: 16px, lineHeight: 1.7, weight: 400 }
    meta: { size: 13px, lineHeight: 1.5, weight: 500 }
  spacing:
    micro: 4px
    compact: 8px
    control: 12px
    card: 16px
    section: 24px
    page: 32px
  shape:
    input: var(--mci-shape-input)
    panel: var(--mci-shape-panel)
    card: var(--mci-shape-card)
    button: var(--mci-shape-button)
  elevation:
    card: var(--mci-shadow-card)
    cardHover: var(--mci-shadow-card-hover)
    float: var(--mci-shadow-float)

components:
  primaryButton:
    height: 44px
    states:
      default: { background: "{tokens.color.primary}" }
      hover: { lift: -1px }
      focus: { outline: "{tokens.color.primary}" }
      pressed: { scale: 0.98 }
      loading: { preserveWidth: true }
      disabled: { opacity: 0.56 }
  dataCard:
    background: "{tokens.color.surface}"
    radius: "{tokens.shape.card}"
    padding: "{tokens.spacing.card}"
    states:
      default: { elevation: "{tokens.elevation.card}" }
      hover: { elevation: "{tokens.elevation.cardHover}", lift: -2px }
      focus: { outline: "{tokens.color.primary}" }
      selected: { border: "{tokens.color.primary}" }

omissions: []
```

## 1. 产品概览与目标用户

- 首要用户：
- 首要任务：
- 用户进入后第一眼必须理解：
- 成功结果与衡量方式：
- 关键设备与使用环境：

## 2. 视觉性格与情绪目标

- 主情绪（只选一个）：
- 具体视觉隐喻：
- 辅助气质（最多两项）：
- 选择理由：
- 明确不采用的视觉语言：

## 3. 颜色

- 页面底色与表面关系：
- 主色只用于：
- 成功 / 警告 / 危险 / 信息色语义：
- 明亮与暗黑主题的对比策略：
- 透明表面的叠加底色：

## 4. 字体

| 角色 | 字号 / 行高 / 字重 | 用途 | 禁止 |
| --- | --- | --- | --- |
| Display |  |  |  |
| H1 |  |  |  |
| H2 |  |  |  |
| Body |  |  |  |
| Meta |  |  |  |

## 5. 布局与间距

- Desktop：12 列，最大宽度：
- Tablet：8 列，重排规则：
- Mobile：4 列，左右安全间距：
- 内部紧凑间距：
- 区域与页面留白：

## 6. 层级、材质与形状

- 深度来自：色调层 / 细边框 / 环境阴影 / 透明材质 / 实体投影
- 圆角或切角表达的性格：
- 页面 / 卡片 / 浮层的层级关系：
- 低性能与不支持透明效果时的降级：

## 7. 组件与状态

| 组件 | Default | Hover / Focus / Pressed | Loading | Empty / Error | Disabled | Selected / Success |
| --- | --- | --- | --- | --- | --- | --- |
| 主按钮 |  |  |  | - |  |  |
| 搜索 / 筛选 |  |  |  |  |  |  |
| 列表 / 数据卡片 |  |  |  |  | - |  |
| 表单 |  |  |  |  |  |  |
| 弹层 | 20–24px 大圆角、居中；图标 + 英文眉题 + 标题 + 副标题；连续柔和内容底 | 关闭按钮有可见底色；标题栏可拖动且四边留在视口 | 首个可操作控件获得焦点，Esc/关闭路径明确 | 拖动边界按真实尺寸钳制，窗口缩放后重新钳制 | 提交按钮显示进度并防重复 | 错误留在关联字段或底部操作区，可恢复 |

### 弹层

- 页头：左侧语义图标、英文眉题、大字标题、可选小字副标题；右上关闭按钮有独立背景并垂直居中。
- 内容：使用连续柔和背景和整齐栅格，不把普通字段拆成小卡片。
- 页脚：右侧大号关闭与保存按钮，均带语义图标。
- 行为：默认上下左右居中，PC 标题栏可拖动；按弹层真实宽高限制四边并在窗口缩放后重新限制。Teleport 到 `body` 时同步应用根标识与主题 token。

### 数据卡片

- 信息顺序：身份 → 标题/状态 → 关键字段 → 时间/辅助标签 → 操作。
- 缺图：40—44px 紧凑标记，不渲染大面积装饰占位图。
- 默认列数：桌面 4，平板 2—3，移动 1；显式业务配置优先。
- 操作：一个主动作、一至两个次动作，其余进入“更多”；危险动作降权。

## 8. 页面模式与信息架构

1. 首屏：
2. 核心任务：
3. 证据或数据：
4. 辅助内容：
5. 最终行动：

- 主模式：品牌叙事 / 真实产品流程 / 趋势构图 / 沉浸互动 / 动态首屏 / 数据工作台
- 辅助能力（最多两项）：

## 9. 动效与媒体

- 0—120ms：
- 120—360ms：
- 360—800ms：
- 循环动效存在理由：
- 图片比例与 `object-fit`：
- `prefers-reduced-motion` 与静态降级：

## 10. 响应式与安全区

| 宽度 | 栅格 | 导航 | 主操作 | 内容重排 |
| --- | --- | --- | --- | --- |
| 390 | 4 列 |  |  |  |
| 768 | 8 列 |  |  |  |
| 1440 | 12 列 |  |  |  |

## 11. 可访问性、性能与降级

- 键盘顺序与可见焦点：
- 正文、状态与交互对比度：
- 触控目标：移动端不小于 44px
- 首屏资源预算：
- 网络失败、媒体失败与离线策略：
- 骨架屏、空态、错误态与恢复路径：

## 12. 应当与禁止

### 应当

-

### 禁止

-

## 有意省略

| 规则 | 省略理由 | 替代方案 |
| --- | --- | --- |
|  |  |  |

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
