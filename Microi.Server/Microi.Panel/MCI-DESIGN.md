# MCI-DESIGN

```yaml
contract:
  version: 1
  project: Microi.Panel
  mode: data-workspace
  intent: 安装服务、管理网站和恢复操作的独立服务器运维工作台
tokens:
  color:
    canvas: var(--mci-bg-page)
    surface: var(--mci-bg-surface)
    surfaceElevated: var(--mci-bg-elevated)
    textPrimary: var(--mci-text-primary)
    textSecondary: var(--mci-text-secondary)
    link: var(--mci-text-link)
    primary: var(--mci-color-primary)
    success: var(--mci-color-success)
    warning: var(--mci-color-warning)
    danger: var(--mci-color-danger)
  typography:
    display: { size: 48px, lineHeight: 1.3, weight: 800 }
    h1: { size: 30px, lineHeight: 1.3, weight: 750 }
    h2: { size: 19px, lineHeight: 1.4, weight: 700 }
    body: { size: 14px, lineHeight: 1.6, weight: 400 }
    meta: { size: 12px, lineHeight: 1.6, weight: 400 }
  spacing: { micro: 4px, compact: 8px, control: 12px, card: 18px, section: 22px, page: 32px }
  shape:
    input: var(--mci-shape-input)
    panel: var(--mci-shape-panel)
    card: var(--mci-shape-card)
    button: var(--mci-shape-button)
  elevation:
    card: var(--mci-shadow-card)
    cardHover: var(--mci-shadow-card-hover)
    float: var(--mci-shadow-dialog)
components:
  primaryButton:
    height: 44px
    states:
      default: { background: "{tokens.color.primary}" }
      hover: { lift: -1px }
      focus: { outline: "{tokens.color.link}" }
      pressed: { scale: 0.98 }
      loading: { preserveWidth: true }
      disabled: { opacity: 0.58 }
  dataCard:
    background: "{tokens.color.surface}"
    radius: "{tokens.shape.card}"
    padding: "{tokens.spacing.card}"
    states:
      default: { elevation: "{tokens.elevation.card}" }
      hover: { elevation: "{tokens.elevation.cardHover}" }
      focus: { outline: "{tokens.color.link}" }
      selected: { background: "{tokens.color.surfaceElevated}" }
omissions: []
```

## 1. 产品概览与目标用户

服务器管理员与客户交付人员使用独立运维账号完成安装、网站配置、故障查看与恢复。首屏回答当前主机、已安装服务和需要处理的任务。每个有副作用的动作必须能在服务端操作记录中回读；平台 API 停机时此面板仍可独立访问。

## 2. 视觉性格与情绪目标

主情绪为清晰、可控。使用工作台侧栏、明确字段、稳定表格与状态记录表达控制范围，主操作突出，次操作保持克制。品牌色来自主题系统；不使用彩虹装饰、动态光斑或强调色弧形包边。

## 3. 颜色

页面底色、卡片、浮层逐层使用语义表面。品牌填充与文字强调分开：按钮背景使用 primary，链接和描边按钮使用 link。成功表示已回读完成；警告表示等待或需核对；危险表示失败或中断影响。暗色渐变必须使用暗色表面，普通文字及按钮文字对比度至少 4.5:1。

## 4. 字体

| 角色 | 字号 / 行高 / 字重 | 用途 | 禁止 |
| --- | --- | --- | --- |
| Display | 32–48px / 1.3 / 800 | 登录主叙述 | 业务页重复大标题 |
| H1 | 30px / 1.3 / 750 | 当前页面 | 与品牌标题抢重心 |
| H2 | 19px / 1.4 / 700 | 区域标题 | 多层同义标题 |
| Body | 14px / 1.6 / 400 | 表单、说明与操作 | 极浅色文字 |
| Meta | 12px / 1.6 / 400 | 版本、时间、辅助状态 | 放置唯一关键行动 |

## 5. 布局与间距

桌面保留 210px 导航与最大 1550px 内容区域，内容侧边 32px；插件默认四列，1200px 以下两列，600px 以下单列。表单桌面两列，长文本与代码占整行。移动端左右 12–16px，控件之间至少 8px，段落与区块 18–22px。

## 6. 层级、材质与形状

层级来自表面、细边框与柔和阴影。圆角和扁平形态通过主题 token 切换。侧导航选中标识为上下留白的独立直线，移动横向导航只用选中表面。浮层覆盖整个页面，内容区滚动，页脚可见。低性能设备减少模糊和动画，信息与操作保持完整。

## 7. 组件与状态

| 组件 | 默认 | 交互 | 加载 | 空 / 错误 | 禁用 | 成功 |
| --- | --- | --- | --- | --- | --- | --- |
| 按钮 | 一主一次 | 悬停、焦点、按压 | 稳定尺寸与忙碌提示 | 居中可关闭反馈 | 阻止重复提交 | 回读后转到任务 |
| 表格 / 卡片 | 名称、版本、状态、操作 | 操作范围明确 | 贴合布局的骨架 | 原因与恢复入口 | 非归属资源只读 | 展示实际运行状态 |
| 表单 | 标签、默认值与约束 | 原生必填、版本冲突检查 | 保留输入 | 不丢弃未提交输入 | 提交期间保持一致 | 服务器校验并回读 |
| 弹窗 | 居中、可访问名称 | Tab 约束、Esc、桌面拖动 | 焦点留在弹窗 | 最上层反馈可见 | 背后页面 inert | 关闭恢复原焦点 |

## 8. 页面模式与信息架构

主模式为数据工作台，辅助采用真实产品流程。服务器总览 → 插件市场 / 网站 / 证书 / 文件 / 容器 → 确认作用范围 → 持久任务 → 回读结果。吾码平台升级与平台连接保留独立区域，平台会话不承担主机权限。

## 9. 动效与媒体

控件反馈 0–120ms，页面与弹层进入 120–360ms；长任务通过真实阶段表达进度，不用装饰动画替代结果。仅使用自有 SVG 和离线字体栈。尊重 prefers-reduced-motion，页面隐藏时暂停轮询或动效。

## 10. 响应式与安全区

| 宽度 | 栅格 | 导航 | 主操作 | 内容重排 |
| --- | --- | --- | --- | --- |
| 390 | 单列卡片 | 横向滚动 | 最小 44px | 表单单列，表格内部横滚 |
| 768 | 两列卡片 | 横向滚动 | 可换行按钮组 | 长字段独占行 |
| 1440 | 四列卡片 | 210px 侧栏 | 标题区与内容关联 | 双列表单 |

## 11. 可访问性、性能与降级

页面保留可见键盘焦点和明确字段名称；表单插槽避免把全部选项混入可访问名称。模态窗口锁定背后交互，多层弹窗逐级恢复。首屏 UI 随面板镜像交付，无需平台 API 或 CDN。Docker 断开时仍应显示持久账本和诊断信息，不能把空数据误报为成功。

## 12. 应当与禁止

应当保持主机归属、端口影响、配置版本和实际就绪结果可见；密码、平台 Token、证书私钥不进入 URL、浏览器存储或截图。禁止弧形强调侧框、全局泛化 CSS、原生 alert/confirm、以容器 Running 代替服务就绪、只截骨架就声称视觉验收通过。

## 有意省略

页面不使用图片营销首屏或持续背景动画：运维场景优先信息密度与操作效率，以图标、字段和真实状态呈现。

## 验收清单

契约随源码维护；自动化必须覆盖登录、有效表单提交、错误恢复、弹层键盘与拖动、所有新导航、390/768/1440 响应式和 18 组亮暗配色。截图使用实际已加载数据，计算对比度后仍需人工复核。当前证据与尚未完成的交付边界记录在项目测试回执中，不用本文件代替正式发布证明。
