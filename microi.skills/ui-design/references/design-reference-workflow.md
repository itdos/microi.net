# Microi 参考驱动 UI 设计工作流

本参考用于把“做得高级、主流、像成熟产品”转换成可实现、可测试、可维护的 Microi UI 规则。六个网站都是研究入口，不是复制来源。

## 六类参考各自解决什么问题

| 参考来源 | 适用问题 | 应提取的证据 | 不应照搬的内容 |
| --- | --- | --- | --- |
| [Awwwards](https://www.awwwards.com/) | 品牌官网、产品发布页、叙事型首屏的视觉上限 | 首屏焦点、文案与画面比例、滚动叙事、品牌记忆点、转场节奏 | 获奖站的重资源、实验性导航、品牌素材与完整视觉外观 |
| [Mobbin](https://mobbin.com/) | 登录、注册、订阅、支付、设置、列表、详情等真实产品流程 | 任务路径、页面状态、表单密度、按钮优先级、空/错/加载/完成态 | 单张截图的表面样式、特定产品商标、专有插画和文案 |
| [Recent](https://recent.design/) | Web、产品、字体、品牌、动效、3D 等近期趋势雷达 | 当前常见构图、字体尺度、色彩方向、媒介组合、趋势持续性 | 为追逐趋势而叠加多个互相冲突的风格 |
| [Unicorn Studio](https://www.unicorn.studio/) | 局部 WebGL、粒子、流体、鼠标跟随、动态背景 | 动效层级、交互触发、降级画面、资源与帧率预算 | 把 WebGL 作为所有业务页背景、阻塞首屏或影响表单可读性 |
| [MotionSites](https://motionsites.ai/) | Hero 区、渐变、动态背景、按钮反馈、首秒停留 | 0-1 秒首屏节奏、标题入场、背景运动方向、CTA 反馈 | 无业务含义的连续大幅运动、复杂光球和动画模板拼贴 |
| [Refero Styles](https://styles.refero.design/) | 将参考转成 AI 可读的颜色、字体、间距和组件规范 | DESIGN.md、token、组件状态、布局密度、可复用规则 | 直接复制他人的 token 名称、品牌色值和组件实现 |

## 标准执行顺序

### 1. 先确定页面任务

用一句话写清页面的首要任务，例如“用户在 30 秒内完成预约”“管理员在第一屏看清房间和技师状态”“访客理解产品并进入 AI 应用”。没有首要任务时，不进入视觉设计。

### 2. 选择一主两辅参考

- 主参考决定信息架构和密度。
- 辅助参考一决定视觉气质。
- 辅助参考二只补充动效或设计 token。
- 真实业务产品必须至少有一个 Mobbin 或同等级真实产品流程参考，不能只参考营销站。

### 3. 建立参考拆解表

实现前至少记录以下字段：

```text
页面目标：
主参考与理由：
辅助参考与理由：
首屏视觉重心：
内容最大宽度 / 栅格：
标题 / 正文 / 辅助文字层级：
主色 / 强调色 / 背景 / 边框 / 状态色：
4/8 基础间距节奏：
卡片 / 输入 / 按钮圆角：
默认 / hover / focus / active / disabled 状态：
加载 / 空数据 / 错误 / 成功状态：
动效时间线与可关闭方案：
移动端重排与安全区：
```

### 4. 转换成 Microi 设计 token

参考色值、尺寸和节奏必须重命名并归一到 `--mci-*`。禁止在业务 CSS 中散落第三方 token 或无语义十六进制颜色。

```css
[data-mci-ui-root] {
  --mci-color-primary: #1769ff;
  --mci-color-accent: #16c6a3;
  --mci-surface-page: #0b1020;
  --mci-surface-card: #111a2c;
  --mci-text-primary: #f6f8fc;
  --mci-text-secondary: #9eabc0;
  --mci-border-subtle: rgba(148, 163, 184, .18);
  --mci-space-1: 4px;
  --mci-space-2: 8px;
  --mci-space-3: 12px;
  --mci-space-4: 16px;
  --mci-space-6: 24px;
  --mci-radius-card: 18px;
  --mci-motion-fast: 160ms;
  --mci-motion-base: 260ms;
}
```

具体项目应按品牌和内容重新取值；示例不是固定主题。

### 5. 先完整业务状态，再增加视觉效果

按以下顺序实现：默认态 -> 加载骨架 -> 空态 -> 错误态 -> 成功态 -> 权限态 -> hover/focus/active -> 入场动效 -> 装饰动效。任何关键操作链接或按钮都必须真实可执行，不能为了截图留下空壳。

### 6. 动效预算

- 首屏主要内容应尽快可读，装饰动效不能阻塞标题和主 CTA。
- 单页只保留一个主要运动方向；列表交错延迟一般 30-60ms。
- 业务页优先 `transform`、`opacity` 和 `background-position`，避免持续触发布局与重绘。
- WebGL 只放在 Hero、展示卡或背景局部，并提供静态海报、低性能设备降级和 `prefers-reduced-motion` 分支。
- 表单、表格、可读文本上方不得叠加高对比动态纹理。

```css
@media (prefers-reduced-motion: reduce) {
  [data-mci-ui-root] *,
  [data-mci-ui-root] *::before,
  [data-mci-ui-root] *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: .01ms !important;
  }
}
```

## 不同项目的参考组合

- 官网 / 品牌站：Awwwards 主参考 + Recent 视觉趋势 + MotionSites 首屏节奏。
- SaaS 后台 / 工具：Mobbin 主参考 + Refero Styles 设计系统；只在空态或欢迎区补少量 MotionSites 动效。
- C 端生活应用：Mobbin 主参考 + Recent 色彩/字体 + Refero Styles token。
- 数据仪表盘：Mobbin 信息结构 + Refero Styles 密度与组件状态；避免套用获奖营销站的低信息密度。
- 互动展示页：Awwwards 主参考 + Unicorn Studio 局部动效 + Refero Styles 降级规则。

## 截图与自动化验收

每个新页面至少覆盖：

1. 1440 或 1920 桌面首屏。
2. 390 左右移动首屏，并检查安全区和横向滚动。
3. 加载、空数据、错误、成功四类状态中的相关状态。
4. 至少一个表单或主要操作的 focus / active / disabled 状态。
5. 明暗主题（若项目支持）与 `prefers-reduced-motion`。

验收时检查：视觉重心是否在第一屏；列、基线和卡片是否对齐；正文对比度是否清晰；按钮文字是否水平垂直居中；内容是否真实；所有看起来可点击的元素是否有结果；移动端是否出现 PC 模拟器外框；动效停止后页面是否仍完整可用。

## AI 生成提示的合格格式

不要写“参考某站做高级一点”。应给出可验证约束：

```text
以真实产品流程为主，采用 12 列栅格和 1200px 内容上限；
首屏左侧完成价值说明与主 CTA，右侧展示可操作产品对象；
标题 48/56，正文 16/28，8px 间距体系；
卡片含默认、hover、focus、active、disabled；
入场只使用 opacity + translateY，列表间隔 40ms；
移动端重排为单列并取消非必要背景动效；
使用 --mci-* token 和 mci-* 命名，禁止复制第三方素材或代码。
```

这类提示能把参考转成 Microi 自有设计系统，而不是模板化复刻。
