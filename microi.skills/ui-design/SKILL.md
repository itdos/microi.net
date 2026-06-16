---
name: ui-design
description: Microi UI 设计系统指南。用于设计 PC Vue、Element Plus、uni-app H5、仪表盘、表单、卡片、渐变、响应式布局、骨架屏、移动安全区和视觉打磨。
---

# Microi吾码设计规范

你正在为 Microi 吾码平台创建界面。所有页面、组件、弹窗必须遵循本规范，打造高级、克制、具有科技感和品牌识别度的视觉体验。

> **适用平台**：PC 端（Vue 3 + Element Plus + SCSS）、移动端 H5/uni-app/原生 WebView（纯 CSS / 无第三方组件库）
> **核心理念**：高级但不浮夸，动效丰富但可维护，多端统一同时尊重平台差异
> **变量前缀**：所有 CSS 变量统一使用 `--mci-` 前缀（Microi Interface）

---

## 整体风格定义

- **风格关键词**：高级、通透、科技感、品牌化、轻量精致、视觉张力。
- **质感**：柔和多层阴影、清晰边界、结构化光影、细腻纹理、精致微动效。
- **氛围**：默认亮色多彩主题（colorful + gradient + soft shadow），暗黑主题作为可选切换；避免廉价装饰，优先用布局、层级、动效和真实内容建立高级感。
- **参考吸收**：可参考成熟移动端 UI 灵感库的组件完整度、色彩节奏、入场动效和模板化能力，但 Microi 视觉必须通过 `--mci-*` token 与 MCI-UI 组件形成自己的品牌系统，不照搬第三方外观，也不在吾码源码、文档或样式命名中保留外部 UI 品牌痕迹。

---

## 样式隔离与抗覆盖

- Microi.UI 页面或局部 UI 必须使用 `.mci-page`、`data-mci-ui-root` 或项目级 `.mci-*` 根容器包裹，避免被宿主项目、第三方组件库、Markdown 渲染器的全局 CSS 意外覆盖。
- 所有可复用组件必须使用 `mci-` 前缀和 BEM 风格类名；不要写全局 `button`、`input`、`img`、`table`、`div` 选择器。确实需要 reset 时必须限制在 `.mci-page` 或 `[data-mci-ui-root]` 内。
- 业务页面不得用高优先级全局选择器覆盖 MCI 组件，例如 `.card *`、`button {}`、`img {}`、`.page .mci-card {}`。需要定制时用组件 props、CSS 变量或项目级 wrapper。
- 第三方 UI 组件必须放在项目 wrapper 内，例如 `.mci-third-party-scope`，颜色、圆角、阴影、间距映射到 `--mci-*` token，而不是直接把第三方默认主题暴露到页面。
- Web 项目优先用 Vue `scoped` / CSS Modules / 明确命名空间；uni-app 项目优先用页面级 `mci-*` 根类和组件根类。新增全局样式前必须检查是否会影响其它项目页面。
- 文档站、官网、企业站这类 Markdown/VitePress 项目，应在主题层统一收口视觉，不要在每一篇文档里写互相竞争的散装 CSS。

---

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
- 同一类 UI 在两个及以上页面出现时，必须优先封装为 `Mci*` 或项目级 `mci-*` 组件，通过 props/slots/events 配置标题、说明、图标、按钮、路由、状态和少量变体；不要复制两份卡片、空态、登录提示、按钮组、筛选栏或底部操作栏。
- 卡片背景必须服务页面氛围：暗色科技背景上的展示卡、价格卡、聊天卡不应突然变成大面积灰白卡；浅色卡片只在整体页面转为浅色内容区时使用，并且要有过渡带或区块背景承接。

---

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

## 颜色体系（CSS Variables — 支持主题切换）

所有颜色必须通过 CSS 变量引用，禁止硬编码色值。变量定义放在全局样式入口（PC 端 `src/styles/mci-design.scss`，移动端 `<style>` 内或独立 CSS 文件）。

### 暗黑主题（可选切换 — `data-theme="dark"`）

```css
:root[data-theme="dark"] {
  /* 主色 — 科技紫蓝 */
  --mci-color-primary: #722BFF;
  --mci-color-primary-light: #9B5FFF;
  --mci-color-primary-dark: #5A1FCC;
  --mci-color-primary-glow: rgba(114, 43, 255, 0.35);

  /* 辅助色 */
  --mci-color-accent-red: #FF2E63;
  --mci-color-accent-blue: #29B8FF;
  --mci-color-accent-gold: #FFD100;
  --mci-color-accent-cyan: #00F5D4;
  --mci-color-accent-pink: #FF6EC7;

  /* 语义色（成功/警告/错误/信息） */
  --mci-color-success: #00F5D4;
  --mci-color-warning: #FFD100;
  --mci-color-danger: #FF2E63;
  --mci-color-info: #29B8FF;

  /* 背景 */
  --mci-bg-base: #0A0A0F;
  --mci-bg-elevated: #121218;
  --mci-bg-surface: #1A1A24;
  --mci-bg-card: rgba(255, 255, 255, 0.04);
  --mci-bg-card-hover: rgba(255, 255, 255, 0.08);
  --mci-bg-glass: rgba(255, 255, 255, 0.06);
  --mci-bg-glass-border: rgba(255, 255, 255, 0.1);
  --mci-bg-mask: rgba(0, 0, 0, 0.6);

  /* 文字 */
  --mci-text-primary: #FFFFFF;
  --mci-text-secondary: #A0A0B8;
  --mci-text-tertiary: #6B6B80;
  --mci-text-disabled: #4A4A5A;
  --mci-text-on-primary: #FFFFFF;

  /* 边框 */
  --mci-border-color: rgba(255, 255, 255, 0.08);
  --mci-border-color-hover: rgba(255, 255, 255, 0.15);
  --mci-border-glow: rgba(114, 43, 255, 0.3);

  /* 渐变 */
  --mci-gradient-primary: linear-gradient(135deg, #722BFF 0%, #29B8FF 100%);
  --mci-gradient-hot: linear-gradient(135deg, #FF2E63 0%, #FF6EC7 100%);
  --mci-gradient-gold: linear-gradient(135deg, #FFD100 0%, #FF8C00 100%);
  --mci-gradient-cyber: linear-gradient(135deg, #00F5D4 0%, #722BFF 50%, #FF2E63 100%);
  --mci-gradient-bg: radial-gradient(ellipse at 20% 50%, rgba(114, 43, 255, 0.08) 0%, transparent 60%);
}
```

### 亮色主题（默认）

```css
:root[data-theme="light"], :root {
  --mci-color-primary: #6C2BD9;
  --mci-color-primary-light: #8B5CF6;
  --mci-color-primary-dark: #5521B5;
  --mci-color-primary-glow: rgba(108, 43, 217, 0.15);

  --mci-color-accent-red: #E8294A;
  --mci-color-accent-blue: #2196F3;
  --mci-color-accent-gold: #F59E0B;
  --mci-color-accent-cyan: #06B6D4;
  --mci-color-accent-pink: #EC4899;

  --mci-color-success: #06B6D4;
  --mci-color-warning: #F59E0B;
  --mci-color-danger: #E8294A;
  --mci-color-info: #2196F3;

  --mci-bg-base: #F5F5FA;
  --mci-bg-elevated: #FFFFFF;
  --mci-bg-surface: #F0F0F8;
  --mci-bg-card: rgba(255, 255, 255, 0.9);
  --mci-bg-card-hover: rgba(255, 255, 255, 1);
  --mci-bg-glass: rgba(255, 255, 255, 0.7);
  --mci-bg-glass-border: rgba(0, 0, 0, 0.08);
  --mci-bg-mask: rgba(0, 0, 0, 0.4);

  --mci-text-primary: #1A1A2E;
  --mci-text-secondary: #64648C;
  --mci-text-tertiary: #9898B0;
  --mci-text-disabled: #C0C0D0;
  --mci-text-on-primary: #FFFFFF;

  --mci-border-color: rgba(0, 0, 0, 0.06);
  --mci-border-color-hover: rgba(0, 0, 0, 0.12);
  --mci-border-glow: rgba(108, 43, 217, 0.2);

  --mci-gradient-primary: linear-gradient(135deg, #6C2BD9 0%, #2196F3 100%);
  --mci-gradient-hot: linear-gradient(135deg, #E8294A 0%, #EC4899 100%);
  --mci-gradient-gold: linear-gradient(135deg, #F59E0B 0%, #EA580C 100%);
  --mci-gradient-cyber: linear-gradient(135deg, #06B6D4 0%, #6C2BD9 50%, #E8294A 100%);
  --mci-gradient-bg: radial-gradient(ellipse at 20% 50%, rgba(108, 43, 217, 0.04) 0%, transparent 60%);
}
```

### 颜色使用规则

- **主题模型分两层**：`data-theme="light|dark"` 控制明暗底色，`data-mci-palette="black|white|red|orange|yellow|green|cyan|blue|purple"` 控制品牌主色。
- **所有移动端与 PC 网站项目必须支持主流主色切换**：黑、白、红、橙、黄、绿、青、蓝、紫至少 9 个 palette。后台管理系统可由 Element Plus 主题承载，但也必须映射到 `--mci-*` token。
- **palette 不得只换按钮底色**：必须同步覆盖 `--mci-color-primary`、`--mci-color-primary-strong`、`--mci-text-on-primary`、`--mci-border-glow`、`--mci-gradient-primary`、`--mci-shadow-button`、`--mci-shadow-button-hover`。
- **白色/黄色主题必须单独处理文字颜色**：主按钮文字使用 `--mci-text-on-primary`，白色主题用深色字，黄色主题用深棕/深灰字，禁止固定白字。
- **主色**用于核心交互元素（按钮、链接、选中态）
- **Accent Red / Danger** 用于危险操作、错误、热门标记
- **Accent Blue / Info** 用于信息提示、次要按钮
- **Accent Gold / Warning** 用于重要强调、VIP 标签、价格、警告
- **Accent Cyan / Success** 用于成功状态、在线标识
- 默认主题为亮色 + 红色 palette；暗黑主题和主色 palette 都作为用户可选项。
- 用户主题偏好持久化到 `mci-theme`、`mci-palette`、`mci-shape`，初次访问可跟随系统 `prefers-color-scheme`。

### 主色 Palette 必备定义

```css
:root[data-mci-palette="black"]  { --mci-color-primary:#111827; --mci-text-on-primary:#fff; }
:root[data-mci-palette="white"]  { --mci-color-primary:#F8FAFC; --mci-text-on-primary:#111827; }
:root[data-mci-palette="red"]    { --mci-color-primary:#B51220; --mci-text-on-primary:#fff; }
:root[data-mci-palette="orange"] { --mci-color-primary:#EA580C; --mci-text-on-primary:#fff; }
:root[data-mci-palette="yellow"] { --mci-color-primary:#D9A23A; --mci-text-on-primary:#3A2500; }
:root[data-mci-palette="green"]  { --mci-color-primary:#16A34A; --mci-text-on-primary:#fff; }
:root[data-mci-palette="cyan"]   { --mci-color-primary:#0891B2; --mci-text-on-primary:#fff; }
:root[data-mci-palette="blue"]   { --mci-color-primary:#2563EB; --mci-text-on-primary:#fff; }
:root[data-mci-palette="purple"] { --mci-color-primary:#7C3AED; --mci-text-on-primary:#fff; }
```

实际项目优先直接使用 `Microi.UI/src/theme/tokens.css`，不要复制这段最小示例；新增 palette 时必须补充悬浮阴影、边框高光和渐变。

### 移动端可读性底线

- 移动端首页、商城、分享海报、资产页必须优先保证阅读清楚。浅色背景上的正文、占位文字、标签、金额、按钮文字不得使用低透明度浅灰或低对比金色。
- 移动端底部导航、首页快捷入口、个人中心快捷入口的图标对比度与文字同等重要。彩色圆底图标必须显式设定内部图标色，并在每个主题截图确认可见。
- 关键正文与背景对比度建议不低于 4.5:1；大标题、海报大字、促销卡标题不低于 3:1。金色渐变按钮默认使用深红/深棕文字，不使用白字。
- 在渐变、图片、红金背景上放文字时，文字必须是实色且有足够字重；不要依赖 `opacity: .6` 这类弱化文字承载业务信息。
- 完成移动端风格改造后，必须配合 Playwright、浏览器 DevTools、微信开发者工具自动化或项目已有 E2E 工具进行截图和关键文字对比度检查，复核首页第一屏、列表页、登录页、分享海报、空态/未登录态和关键按钮。
- 用户要求“全自动化测试”“自动化验收”“跑完整测试”等时，如果本次涉及 UI/前端改动，自动化链路必须包含截图验证或视觉断言；只运行构建、lint、静态检查不能宣称已完成全自动化 UI 验收。若当前环境无法启动浏览器/小程序开发者工具，必须明确说明未完成截图验证。

---

## 阴影体系（层次与质感）

阴影是塑造层次感、可点击性和高级质感的关键。采用多层阴影叠加，但不要做脏、糊、重的阴影。

```css
:root {
  /* 基础层级阴影 */
  --mci-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.25);
  --mci-shadow-md: 0 4px 16px rgba(0, 0, 0, 0.3),
                   0 0 12px var(--mci-color-primary-glow);
  --mci-shadow-lg: 0 8px 30px rgba(0, 0, 0, 0.35),
                   0 0 20px var(--mci-color-primary-glow);
  --mci-shadow-xl: 0 20px 60px rgba(0, 0, 0, 0.5),
                   0 0 40px var(--mci-color-primary-glow);

  /* 专用阴影 */
  --mci-shadow-card: 0 4px 20px rgba(0, 0, 0, 0.3),
                     0 0 15px rgba(114, 43, 255, 0.08);
  --mci-shadow-card-hover: 0 8px 30px rgba(0, 0, 0, 0.4),
                           0 0 25px rgba(114, 43, 255, 0.15),
                           0 0 60px rgba(114, 43, 255, 0.05);
  --mci-shadow-button: 0 4px 15px var(--mci-color-primary-glow);
  --mci-shadow-button-hover: 0 8px 25px var(--mci-color-primary-glow);
  --mci-shadow-dialog: 0 25px 80px rgba(0, 0, 0, 0.6),
                       0 0 50px rgba(114, 43, 255, 0.1);
  --mci-shadow-dropdown: 0 10px 40px rgba(0, 0, 0, 0.45),
                         0 0 20px rgba(114, 43, 255, 0.08);

  /* 强调发光 */
  --mci-glow-primary: 0 0 15px var(--mci-color-primary-glow),
                      0 0 45px rgba(114, 43, 255, 0.1);
  --mci-glow-red: 0 0 15px rgba(255, 46, 99, 0.3),
                  0 0 45px rgba(255, 46, 99, 0.1);
  --mci-glow-cyan: 0 0 15px rgba(0, 245, 212, 0.3),
                   0 0 45px rgba(0, 245, 212, 0.1);
}

/* 移动端阴影减半 — 移动端 GPU 较弱，且小屏幕不需要过强阴影 */
@media (max-width: 768px) {
  :root {
    --mci-shadow-card: 0 2px 12px rgba(0, 0, 0, 0.3),
                       0 0 8px rgba(114, 43, 255, 0.06);
    --mci-shadow-card-hover: 0 4px 18px rgba(0, 0, 0, 0.4),
                             0 0 12px rgba(114, 43, 255, 0.1);
    --mci-shadow-button: 0 2px 10px var(--mci-color-primary-glow);
    --mci-shadow-dialog: 0 12px 40px rgba(0, 0, 0, 0.6);
  }
}
```

### 阴影使用规则

| 场景 | 使用阴影 |
|------|---------|
| 卡片默认态 | `--mci-shadow-card` |
| 卡片悬浮态（PC） | `--mci-shadow-card-hover` |
| 按钮默认态 | `--mci-shadow-button` |
| 按钮按下态 | `--mci-shadow-button-hover`（移动端无 hover，只用按下/默认） |
| 弹窗/抽屉 | `--mci-shadow-dialog` |
| 下拉菜单 | `--mci-shadow-dropdown` |
| 强调元素 | `--mci-glow-*` |

---

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

## 字体

```css
:root {
  --mci-font-family: 'Inter', -apple-system, 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
  --mci-font-mono: 'JetBrains Mono', 'SF Mono', 'Consolas', monospace;

  /* 字号 — PC */
  --mci-text-xs: 12px;
  --mci-text-sm: 13px;
  --mci-text-base: 14px;
  --mci-text-lg: 16px;
  --mci-text-xl: 20px;
  --mci-text-2xl: 24px;
  --mci-text-3xl: 32px;
  --mci-text-4xl: 40px;

  /* 字重 */
  --mci-font-normal: 400;
  --mci-font-medium: 500;
  --mci-font-semibold: 600;
  --mci-font-bold: 700;
  --mci-font-black: 900;
}

/* 移动端字号略大，更适合小屏阅读 */
@media (max-width: 768px) {
  :root {
    --mci-text-xs: 11px;
    --mci-text-sm: 13px;
    --mci-text-base: 15px;
    --mci-text-lg: 17px;
    --mci-text-xl: 20px;
    --mci-text-2xl: 24px;
    --mci-text-3xl: 28px;
    --mci-text-4xl: 34px;
  }
}
```

### 字体规则

- **大标题**：`--mci-text-3xl` + `--mci-font-black`，可配合渐变色文字
- **小标题**：`--mci-text-xl` + `--mci-font-semibold`
- **正文**：`--mci-text-base` + `--mci-font-normal`
- **辅助文字**：`--mci-text-sm` + `--mci-text-secondary`
- **数据/价格**：`--mci-text-2xl` + `--mci-font-bold` + 渐变色

渐变文字写法：
```css
.mci-text-gradient {
  background: var(--mci-gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

> ⚠️ **渐变文字低对比陷阱（已反复踩坑）**：`background-clip:text + color/-webkit-text-fill-color:transparent` 在部分 H5 webview / 安卓内核下渲染会失败，导致文字**透明不可见**。
> 对**关键标题/品牌名/重要文案**优先使用实色高对比文字（如 `color:#8E0613`），或用 `@supports` 做降级：
> ```scss
> .mci-text-gradient { color: var(--mci-color-primary); -webkit-text-fill-color: var(--mci-color-primary); }
> @supports ((-webkit-background-clip:text) or (background-clip:text)) {
>   .mci-text-gradient { background: var(--mci-gradient-primary); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:transparent; }
> }
> ```

---

## 间距与触摸目标

```css
:root {
  --mci-space-1: 4px;
  --mci-space-2: 8px;
  --mci-space-3: 12px;
  --mci-space-4: 16px;
  --mci-space-5: 20px;
  --mci-space-6: 24px;
  --mci-space-8: 32px;
  --mci-space-10: 40px;
  --mci-space-12: 48px;

  /* 移动端最小触摸目标 — Apple HIG 44pt / Material 48dp */
  --mci-touch-target: 44px;

  /* 安全区域（移动端刘海/底部 home indicator） */
  --mci-safe-top: env(safe-area-inset-top, 0);
  --mci-safe-bottom: env(safe-area-inset-bottom, 0);
  --mci-safe-left: env(safe-area-inset-left, 0);
  --mci-safe-right: env(safe-area-inset-right, 0);
}
```

### 移动端规则
- 所有可点击元素（按钮、tab、列表项）**最小尺寸 44×44px**
- 顶部导航栏、沉浸式 header、返回按钮区域必须包含 `var(--mci-safe-top)`，不能假设状态栏固定 20px 或 44px。
- 底部 tab bar、底部固定操作栏、悬浮购买按钮必须包含 `var(--mci-safe-bottom)`，不能贴住 iPhone home indicator 或 Android 手势条。
- 左右全屏容器、横屏弹窗、沉浸式背景必须兼容 `var(--mci-safe-left/right)`，避免刘海横屏遮挡。
- 列表项之间最小间距 8px，避免误触

---

## 骨架屏 Loading 设计规范

所有依赖接口、数据库、远程资源或异步计算的数据区域，首屏加载态必须使用骨架屏（Skeleton Screen），不能只显示 spinner、进度圈、空图标或“数据加载中...”文案。骨架屏属于基础体验规范，适用于 PC、移动端 H5、uni-app、小程序和 WebView。

- 骨架屏形态必须接近最终内容版式：列表用行骨架，表格用表头+行骨架，卡片/商品用网格骨架，详情页用大图区+标题/段落骨架，仪表盘用指标卡骨架。
- 加载期间不能提前显示“暂无数据/暂无明细/空空如也”；空态只能在请求完成且确认无数据后出现。
- 骨架颜色使用主题变量或中性色阶，不要使用高饱和主色大面积闪烁；亮色主题推荐 `rgba(255,255,255,.72)` 与 `rgba(232,221,205,.9)`，暗色主题推荐低对比深灰阶。
- 动画只允许使用 `background-position`、`opacity` 或 `transform`，节奏控制在 1.0s 到 1.4s；必须支持 `prefers-reduced-motion` 关闭或弱化动画。
- 分页加载下一页时，只在列表底部追加紧凑骨架，不覆盖已有内容；切换筛选/分类重载第一页时才显示首屏骨架。
- 骨架块必须有稳定尺寸、圆角和间距，加载前后不能造成明显布局跳动。

参考样式：

```scss
.mci-skeleton {
  position: relative;
  overflow: hidden;
  background: linear-gradient(90deg, rgba(255,255,255,.72), rgba(232,221,205,.9), rgba(255,255,255,.72));
  background-size: 240% 100%;
  animation: mciSkeleton 1.15s ease-in-out infinite;
}
@keyframes mciSkeleton {
  0% { background-position: 120% 0; }
  100% { background-position: -120% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .mci-skeleton { animation: none; }
}
```

---

## 动效规范（丰富但不卡）

### 性能铁律

1. **只用 `transform` 和 `opacity` 做动画** — 走 GPU 合成层，不触发重排重绘
2. **禁止动画 `width/height/top/left/margin/padding`** — 会触发 Layout，导致卡顿
3. **禁止动画 `box-shadow`** — 改用伪元素 `::after` 的 `opacity` 切换预设阴影
4. **`will-change` 不要滥用** — 只在动画激活时添加，静态元素禁止使用
5. **动画时长控制**：微交互 150-250ms，转场 300-400ms，装饰动效 600ms-2s
6. **使用 `prefers-reduced-motion` 媒体查询**提供无动画回退
7. **移动端额外限制**：禁用 `backdrop-filter: blur()` 大面积使用（中低端机型严重掉帧），最多用于小型胶囊/标签
8. **移动端装饰背景**：优先使用结构化渐变、网格、细线、扫光和内容图片；禁用 Canvas 装饰点、密集散点、离散光球、模糊色块堆叠。

### Timing Functions

```css
:root {
  --mci-ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --mci-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --mci-ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --mci-ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

  --mci-duration-fast: 150ms;
  --mci-duration-base: 250ms;
  --mci-duration-slow: 400ms;
  --mci-duration-decorative: 800ms;
}
```

### 标准动效库

#### 1. 卡片悬浮 / 按下（高性能阴影切换）

```scss
.mci-card {
  position: relative;
  border-radius: var(--mci-radius-xl);
  background: var(--mci-bg-card);
  box-shadow: var(--mci-shadow-card);
  transition: transform var(--mci-duration-base) var(--mci-ease-out);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: var(--mci-shadow-card-hover);
    opacity: 0;
    transition: opacity var(--mci-duration-base) var(--mci-ease-out);
    pointer-events: none;
    z-index: -1;
  }

  /* PC: hover */
  @media (hover: hover) {
    &:hover {
      transform: translateY(-4px) scale(1.01);
      &::after { opacity: 1; }
    }
  }

  /* 移动端：active 按压反馈 */
  &:active {
    transform: scale(0.98);
    transition-duration: var(--mci-duration-fast);
  }
}
```

#### 2. 淡入上浮（列表/卡片进入）

```scss
.mci-fade-up-enter {
  opacity: 0;
  transform: translateY(20px);
}
.mci-fade-up-enter-active {
  animation: mciFadeUp var(--mci-duration-slow) var(--mci-ease-out) forwards;
}

@keyframes mciFadeUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 列表交错进入 */
.mci-stagger-item {
  opacity: 0;
  transform: translateY(16px);
  animation: mciFadeUp var(--mci-duration-slow) var(--mci-ease-out) forwards;
  animation-delay: calc(var(--mci-index, 0) * 60ms);
}
```

#### 3. 按钮渐变扫光

```scss
.mci-btn-glow {
  position: relative;
  overflow: hidden;
  background: var(--mci-gradient-primary);
  border: none;
  border-radius: var(--mci-radius-md);
  color: var(--mci-text-on-primary);
  box-shadow: var(--mci-shadow-button);
  transition: transform var(--mci-duration-fast) var(--mci-ease-out);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.2),
      transparent
    );
  }

  @media (hover: hover) {
    &:hover {
      transform: translateY(-2px);
      &::before {
        left: 100%;
        transition: left 0.5s var(--mci-ease-smooth);
      }
    }
  }

  &:active { transform: scale(0.97); }
}
```

#### 4. 焦点边框扫光

```scss
.mci-focus-border {
  position: relative;
  border: 1px solid var(--mci-border-glow);
  border-radius: var(--mci-radius-lg);
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.28), transparent);
    transform: translateX(-110%) skewX(-18deg);
    animation: mciFocusSweep 3.6s ease-in-out infinite;
    pointer-events: none;
  }
}

@keyframes mciFocusSweep {
  0%, 42% { transform: translateX(-110%) skewX(-18deg); opacity: 0; }
  58% { opacity: .85; }
  100% { transform: translateX(120%) skewX(-18deg); opacity: 0; }
}
```

#### 5. 玻璃拟态容器（PC 用，移动端慎用）

```scss
.mci-glass {
  background: var(--mci-bg-glass);
  backdrop-filter: blur(12px) saturate(1.5);
  -webkit-backdrop-filter: blur(12px) saturate(1.5);
  border: 1px solid var(--mci-bg-glass-border);
  border-radius: var(--mci-radius-xl);
  box-shadow: var(--mci-shadow-md);
}

/* 移动端降级：用半透明色块代替模糊 */
@media (max-width: 768px) {
  .mci-glass {
    background: var(--mci-bg-elevated);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
```

#### 6. 无障碍动效回退

```scss
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Vue 3 过渡动画

```scss
/* 淡入上浮 */
.mci-up-enter-active { transition: all var(--mci-duration-slow) var(--mci-ease-out); }
.mci-up-leave-active { transition: all var(--mci-duration-base) var(--mci-ease-smooth); }
.mci-up-enter-from { opacity: 0; transform: translateY(20px); }
.mci-up-leave-to { opacity: 0; transform: translateY(-10px); }

/* 缩放弹出 */
.mci-scale-enter-active { transition: all var(--mci-duration-base) var(--mci-ease-spring); }
.mci-scale-leave-active { transition: all var(--mci-duration-fast) var(--mci-ease-smooth); }
.mci-scale-enter-from { opacity: 0; transform: scale(0.92); }
.mci-scale-leave-to { opacity: 0; transform: scale(0.95); }

/* 列表交错 */
.mci-list-move,
.mci-list-enter-active { transition: all var(--mci-duration-slow) var(--mci-ease-out); }
.mci-list-leave-active { transition: all var(--mci-duration-base) var(--mci-ease-smooth); position: absolute; }
.mci-list-enter-from { opacity: 0; transform: translateX(-20px); }
.mci-list-leave-to { opacity: 0; transform: translateX(20px); }
```

---

## 组件风格速查

### 卡片（通用）

```scss
.mci-card {
  background: var(--mci-bg-card);
  border: 1px solid var(--mci-border-color);
  border-radius: var(--mci-radius-xl);
  padding: var(--mci-space-6);
  box-shadow: var(--mci-shadow-card);
}
```

### 渐变按钮（主要操作）

```scss
.mci-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--mci-space-2);
  min-height: var(--mci-touch-target);
  padding: 0 var(--mci-space-6);
  background: var(--mci-gradient-primary);
  color: var(--mci-text-on-primary);
  border: none;
  border-radius: var(--mci-radius-md);
  font-size: var(--mci-text-base);
  font-weight: var(--mci-font-semibold);
  cursor: pointer;
  box-shadow: var(--mci-shadow-button);
  transition: transform var(--mci-duration-fast) var(--mci-ease-out);

  &:active { transform: scale(0.97); }
  @media (hover: hover) {
    &:hover { transform: translateY(-2px); box-shadow: var(--mci-shadow-button-hover); }
  }

  &--outline {
    background: transparent;
    color: var(--mci-color-primary-light);
    border: 1.5px solid var(--mci-color-primary);
    box-shadow: none;
  }

  &--ghost {
    background: var(--mci-bg-card);
    color: var(--mci-text-primary);
    box-shadow: none;
  }
}
```

### 标签 / Badge

```scss
.mci-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--mci-radius-full);
  font-size: var(--mci-text-xs);
  font-weight: var(--mci-font-medium);

  &--hot {
    background: linear-gradient(135deg, rgba(255,46,99,0.15), rgba(255,110,199,0.15));
    color: var(--mci-color-accent-red);
    border: 1px solid rgba(255, 46, 99, 0.2);
  }
  &--new {
    background: linear-gradient(135deg, rgba(0,245,212,0.1), rgba(41,184,255,0.1));
    color: var(--mci-color-accent-cyan);
    border: 1px solid rgba(0, 245, 212, 0.2);
  }
  &--vip {
    background: var(--mci-gradient-gold);
    color: #1A1A2E;
    font-weight: var(--mci-font-bold);
  }
}
```

### 输入框

```scss
.mci-input {
  display: block;
  width: 100%;
  min-height: var(--mci-touch-target);
  background: var(--mci-bg-surface);
  border: 1px solid var(--mci-border-color);
  border-radius: var(--mci-radius-md);
  padding: 0 var(--mci-space-4);
  color: var(--mci-text-primary);
  font-size: var(--mci-text-base);
  transition: border-color var(--mci-duration-fast) var(--mci-ease-out),
              box-shadow var(--mci-duration-fast) var(--mci-ease-out);

  &:focus {
    border-color: var(--mci-color-primary);
    box-shadow: 0 0 0 3px var(--mci-color-primary-glow);
    outline: none;
  }
  &::placeholder { color: var(--mci-text-tertiary); }
}
```

### Element Plus 主题整合（PC）

```scss
:root {
  --el-color-primary: var(--mci-color-primary);
  --el-color-success: var(--mci-color-success);
  --el-color-warning: var(--mci-color-warning);
  --el-color-danger: var(--mci-color-danger);
  --el-color-info: var(--mci-color-info);

  --el-bg-color: var(--mci-bg-elevated);
  --el-bg-color-overlay: var(--mci-bg-surface);
  --el-text-color-primary: var(--mci-text-primary);
  --el-text-color-regular: var(--mci-text-secondary);
  --el-text-color-secondary: var(--mci-text-tertiary);
  --el-text-color-placeholder: var(--mci-text-disabled);

  --el-border-color: var(--mci-border-color);
  --el-border-color-light: var(--mci-border-color);
  --el-border-color-lighter: var(--mci-border-color);
  --el-border-radius-base: var(--mci-radius-md);

  --el-box-shadow: var(--mci-shadow-md);
  --el-box-shadow-light: var(--mci-shadow-sm);
  --el-font-family: var(--mci-font-family);
}

.el-dialog {
  border-radius: var(--mci-radius-2xl) !important;
  background: var(--mci-bg-elevated) !important;
  box-shadow: var(--mci-shadow-dialog) !important;
  border: 1px solid var(--mci-border-color) !important;
  overflow: hidden;
}
```

---

## 移动端专用规范

### 1. 视口设置

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover">
```

### 2. 状态栏 / 安全区适配

移动端页面必须同时考虑 iPhone 刘海屏/Dynamic Island/Home Indicator、Android 状态栏/虚拟导航栏/手势条、不同 WebView 容器和横竖屏差异。不要用固定像素硬顶或硬底来“凑”安全区。

```scss
.mci-mobile-page {
  min-height: 100vh;
  padding-top: var(--mci-safe-top);
  padding-bottom: var(--mci-safe-bottom);
  padding-left: var(--mci-safe-left);
  padding-right: var(--mci-safe-right);
  background: var(--mci-bg-base);
  background-image: var(--mci-gradient-bg);
}
```

落地要求：

- HTML/H5 必须设置 `viewport-fit=cover`，否则 iOS 的 `env(safe-area-inset-*)` 不会按预期生效。
- uni-app 页面需要结合 `uni.getSystemInfoSync().statusBarHeight` 或平台导航栏高度，状态栏高度用于占位，内容安全边距仍使用 `env(safe-area-inset-*)` 兜底。
- 顶部 fixed/sticky 导航使用 `padding-top: max(var(--mci-safe-top), statusBarHeight)` 的等价实现；返回按钮触摸区域要随顶部安全区整体下移。
- 底部 fixed 操作栏和 tabBar 使用 `padding-bottom: calc(var(--mci-safe-bottom) + 8px)` 或项目等价间距，页面主体同步预留底部高度，避免按钮遮挡列表最后一项。
- 安卓三键导航、手势导航和 iOS Safari/PWA/WebView 都要截图验收；不能只在 PC 模拟器或单一 iPhone 尺寸上看起来正常。

### 3. 底部 TabBar

```scss
.mci-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: var(--mci-bg-elevated);
  border-top: 1px solid var(--mci-border-color);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
  padding-bottom: var(--mci-safe-bottom);
  z-index: 100;
}

.mci-tabbar__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: var(--mci-touch-target);
  padding: 8px 0;
  color: var(--mci-text-tertiary);
  font-size: var(--mci-text-xs);
  transition: color var(--mci-duration-fast) var(--mci-ease-out);

  &--active {
    color: var(--mci-color-primary-light);
  }
  &:active {
    transform: scale(0.92);
  }
}
```

### 4. 顶部导航栏

```scss
.mci-navbar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  height: 48px;
  padding: 0 var(--mci-space-4);
  padding-top: var(--mci-safe-top);
  background: var(--mci-bg-elevated);
  box-shadow: var(--mci-shadow-sm);
}

.mci-navbar__title {
  flex: 1;
  text-align: center;
  font-size: var(--mci-text-lg);
  font-weight: var(--mci-font-semibold);
  color: var(--mci-text-primary);
}
```

### 5. 列表项（cell）

```scss
.mci-cell {
  display: flex;
  align-items: center;
  min-height: 56px;
  padding: var(--mci-space-3) var(--mci-space-4);
  background: var(--mci-bg-card);
  border-bottom: 1px solid var(--mci-border-color);
  transition: background var(--mci-duration-fast) var(--mci-ease-out);

  &:active { background: var(--mci-bg-card-hover); }

  &__title { flex: 1; color: var(--mci-text-primary); }
  &__value { color: var(--mci-text-secondary); margin-right: var(--mci-space-2); }
  &__arrow {
    color: var(--mci-text-tertiary);
    transition: transform var(--mci-duration-base) var(--mci-ease-out);
  }
}
```

### 6. 移动端禁用项清单

- ❌ `:hover` 单独使用（用 `@media (hover: hover)` 包裹）
- ❌ 大面积 `backdrop-filter: blur()`
- ❌ JS 随机装饰点（Canvas/WebGL）
- ❌ 实时阴影动画
- ❌ 复杂的 `filter` 动画（`blur`, `drop-shadow` 不要在动画中切换）
- ❌ 自动播放视频背景

---

## 装饰性背景（低性能消耗方案）

### 结构化背景

Microi 背景必须服务内容层级，不能喧宾夺主。优先使用网格、细线、低透明纹理、扫光和内容相关图片；不要使用离散光球、模糊色块堆叠、密集散点噪声作为主要视觉。

```scss
.mci-page-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  background:
    linear-gradient(135deg, rgba(181,18,32,.06), transparent 32%),
    linear-gradient(180deg, var(--mci-bg-base), var(--mci-bg-page));
}

.mci-page-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(31,41,55,.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(31,41,55,.06) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: linear-gradient(180deg, rgba(0,0,0,.75), transparent 78%);
}

.mci-page-bg::after {
  content: '';
  position: absolute;
  top: 0;
  left: -30%;
  width: 38%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.20), transparent);
  transform: skewX(-18deg);
  animation: mciBackgroundSweep 8s ease-in-out infinite;
}

@keyframes mciBackgroundSweep {
  0%, 18% { transform: translateX(0) skewX(-18deg); opacity: 0; }
  30% { opacity: .72; }
  54%, 100% { transform: translateX(360%) skewX(-18deg); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .mci-page-bg::after { animation: none; }
}
```

### 背景层级排查

- 装饰背景必须 `pointer-events:none` 且位于内容下方。全屏 `position:fixed` 背景如果 `z-index >= 0`，会覆盖无 z-index 的普通文字。
- 如果标题/副标题发灰、按钮文字却正常，先临时隐藏背景层验证，不要只改文字颜色。
- 推荐修复方式：背景 `z-index:-1`；页面根容器 `position:relative`；所有内容区域保持正常堆叠上下文。

### 网格背景

```scss
.mci-grid-bg {
  background-image:
    linear-gradient(var(--mci-border-color) 1px, transparent 1px),
    linear-gradient(90deg, var(--mci-border-color) 1px, transparent 1px);
  background-size: 60px 60px;
}
```

---

## 性能检查清单

- [ ] 动画只使用 `transform` / `opacity`
- [ ] `box-shadow` 变化用伪元素 opacity 切换
- [ ] `backdrop-filter` 仅用于小面积元素，移动端有降级
- [ ] `will-change` 未在静态元素上使用
- [ ] 装饰性动画使用 CSS 而非 JS
- [ ] 列表渲染使用虚拟滚动（超过 50 项时）
- [ ] 图片使用 `loading="lazy"`
- [ ] 复杂动画帧率 > 30fps
- [ ] 提供 `prefers-reduced-motion` 无动画回退
- [ ] 移动端：`:hover` 用 `@media (hover: hover)` 包裹
- [ ] 移动端：所有可点击元素 ≥ 44×44px
- [ ] 移动端：背景装饰不使用密集随机点或大面积模糊色块
- [ ] 动态数据页：首屏使用骨架屏，不用 spinner/“加载中”文案代替
- [ ] 移动端：使用 `env(safe-area-inset-*)` 适配安全区，顶部/底部 fixed 区域在 iOS 与 Android 均不遮挡内容
- [ ] 官网/网站首页：导航栏背景、文字、搜索框与首屏背景截图检查，不能出现浅灰导航压在深色英雄区上导致不协调
- [ ] 官网/网站首页：所有主按钮、胶囊按钮截图检查文字上下居中，长文字按钮不截断、不贴边、不漂移
- [ ] 官网/网站首页：产品卡、助手卡、价格卡等展示卡与页面主背景一致，不能出现孤立的灰白卡片破坏整体视觉
- [ ] 全自动化测试：涉及 UI/前端改动时必须生成并检查截图，覆盖关键按钮/胶囊按钮的上下左右居中、空态/未登录态、代表性卡片、安全区和底部栏；构建通过不等于视觉通过
- [ ] 组件复用：同类结构出现两处及以上时必须抽成 `Mci*` 或项目级 `mci-*` 组件，业务页只传文案、图标、状态、动作和少量变体

---

## 主题切换实现

### 首选：Microi.UI 运行时

```js
import { initMciDesign, setMciPalette, setMciShape, setMciTheme } from '@microi/mci-ui/runtime';

initMciDesign({
  theme: 'light',     // light | dark
  palette: 'red',     // black | white | red | orange | yellow | green | cyan | blue | purple
  shape: 'rounded',   // rounded | flat
  motion: 'full'      // full | reduced
});

setMciPalette('blue');
setMciShape('flat');
setMciTheme('dark');
```

业务页面只允许调用运行时或项目级主题服务，不要在页面里散写 `document.documentElement.setAttribute(...)`。

### 原生 Web 降级实现

```js
const PALETTES = ['black','white','red','orange','yellow','green','cyan','blue','purple'];
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('mci-theme', theme); } catch(e) {}
}
function setPalette(palette) {
  const next = PALETTES.includes(palette) ? palette : 'red';
  document.documentElement.setAttribute('data-mci-palette', next);
  try { localStorage.setItem('mci-palette', next); } catch(e) {}
}

const saved = (() => { try { return localStorage.getItem('mci-theme'); } catch(e) { return null; } })();
const savedPalette = (() => { try { return localStorage.getItem('mci-palette'); } catch(e) { return null; } })();
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
// 默认亮色多彩主题，仅当系统明确设置为深色或用户主动选择深色时启用 dark
setTheme(saved || (prefersDark ? 'dark' : 'light'));
setPalette(savedPalette || 'red');

// 监听系统主题变化
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  if (!localStorage.getItem('mci-theme')) setTheme(e.matches ? 'dark' : 'light');
});
```

### uni-app（H5/小程序通用）主题切换

uni-app 中没有 `document` 对象（小程序端），所以推荐两套方案并存：

**方案A · H5 只操作 html/body 安全外壳**

H5 端只能把主题状态写到 `html`、`body` 的 `data-*` 属性、主题 class 和 CSS 变量，再让 `uni-page-body`、页面根和 fixed 组件通过变量继承。不要用 `querySelectorAll('.mci-page')`、`MutationObserver`、定时扫描或“延迟补 class”去修改 `.mci-page`、`uni-page-body`、`uni-page`、`RouterView` 下的节点，这些节点由 Vue/uni-app 管理，切主题后导航时可能触发 `Cannot assign to read only property '_'`、`Cannot read properties of null (reading 'type')`、`parentNode`、`scheduler flush` 等错误。

```scss
/* 在 mci-design.scss 加暗色定义 */
html.theme-dark,
body.theme-dark,
html.theme-dark uni-page-body,
body.theme-dark uni-page-body,
page.theme-dark,
.theme-dark {
  --mci-color-primary: #8B5CF6;
  --mci-bg-base: #0B0B1F;
  --mci-bg-card: rgba(28, 28, 60, 0.85);
  --mci-text-primary: #F5F5FF;
  --mci-text-secondary: #B8B8D8;
  --mci-border-color: rgba(255, 255, 255, 0.08);
  --mci-shadow-md: 0 8rpx 24rpx rgba(0, 0, 0, 0.5);
}
@media (prefers-color-scheme: dark) {
  page.theme-auto, :root.theme-auto {
    /* 同上，跟随系统 */
  }
}
```

```js
// utils/theme.js（无 Microi.UI 运行时时的降级写法）
const THEME_KEY = 'mci_theme';
const PALETTE_KEY = 'mci_palette';
const PALETTES = ['black','white','red','orange','yellow','green','cyan','blue','purple'];
function applyClass(theme) {
  if (typeof document !== 'undefined' && document.documentElement) {
    [document.documentElement, document.body].forEach(function(el) {
      if (!el) return;
      el.classList.remove('theme-light', 'theme-dark', 'theme-auto');
      el.classList.add('theme-' + theme);
      el.setAttribute('data-mci-theme', theme);
    });
  }
}
function applyPalette(palette) {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-mci-palette', palette);
  }
}
export function getTheme() { try { return uni.getStorageSync(THEME_KEY) || 'light'; } catch (e) { return 'light'; } }
export function getPalette() { try { return uni.getStorageSync(PALETTE_KEY) || 'red'; } catch (e) { return 'red'; } }
export function setTheme(theme) {
  if (!['light','dark','auto'].includes(theme)) theme = 'light';
  try { uni.setStorageSync(THEME_KEY, theme); } catch(e) {}
  applyClass(theme); return theme;
}
export function setPalette(palette) {
  if (!PALETTES.includes(palette)) palette = 'red';
  try { uni.setStorageSync(PALETTE_KEY, palette); } catch(e) {}
  applyPalette(palette); return palette;
}
export function toggleTheme() { return setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }
export function initTheme() { applyClass(getTheme()); applyPalette(getPalette()); }
```

```vue
// App.vue
<script>
import { initTheme } from '@/utils/theme.js';
export default { onLaunch() { initTheme(); } };
</script>
```

```vue
// 页面里加切换按钮
<button @click="toggle">切换主题</button>
<script setup>
import { toggleTheme, getTheme } from '@/utils/theme.js';
const cur = ref(getTheme());
function toggle() { cur.value = toggleTheme(); uni.showToast({ title: '已切换为' + (cur.value==='dark'?'暗色':'亮色') }); }
</script>
```

**方案B · 小程序端通过 `<page-meta>` + `root-font-size`**（如需小程序原生暗色，否则推荐 wx 的 `themeChange` 事件）

```vue
<template>
  <page-meta :root-class="themeClass">
    <view class="content">...</view>
  </page-meta>
</template>
```

### 主题切换 UI 入口规范

- 入口位置：「我的」页面服务菜单 / 顶部状态栏图标 / 设置页第一项
- 形式：明暗模式用图标 + 文案（暗色 / 亮色 / 跟随系统），主色用色板按钮（黑、白、红、橙、黄、绿、青、蓝、紫），点击后立即生效，弹 Toast 反馈。
- 色板必须有选中态、无障碍名称和足够触摸面积；白色色板必须有边框，黄色色板文字必须深色。
- 切换后立刻持久化（uni.setStorageSync），下次启动 App 在 `onLaunch` 自动 `initTheme()` 应用
- H5 fixed 底部导航、固定提交栏和悬浮操作条优先吃 `--mci-*` CSS 变量，不要在主题切换时让组件自己订阅 store 后动态切换根 class。若切主题后点击导航报 Vue scheduler、`parentNode`、`read only property '_'` 或 `null (reading 'type')`，说明主题实现改动了 Vue/uni 托管节点，必须改为 html/body 变量方案。
- 骨架屏、加载过渡、报告详情、英文小标题、印章/水印、状态胶囊、摘要卡和富文本容器也属于主题范围。每个主题切换后都要重新触发 loading 态并打开至少一个详情页截图，不能只看首页。

### 主题颜色变量必须用 var(--mci-*) 而非硬编码

设计页面时所有颜色、阴影、边框 **强制用变量**，否则切到暗色后只换底色不换文字，会出现"白底白字"。常见违规：

```scss
/* ❌ 错误 */
.card { background: #fff; color: #333; box-shadow: 0 8rpx 20rpx rgba(0,0,0,0.05); }

/* ✅ 正确 */
.card {
  background: var(--mci-bg-card);
  color: var(--mci-text-primary);
  box-shadow: var(--mci-shadow-md);
}
```

### 渐变色处理

渐变色在暗色下需要重新调色（亮色用 #FF8A5C → 暗色 #B14CA0 之类），定义 `--mci-gradient-*` 变量并在 `.theme-dark` 下覆盖。

---


## 命名规范

- CSS 变量前缀：`--mci-`
- 组件类名前缀：`.mci-`
- 动画 keyframe 前缀：`mci`（如 `mciFadeUp`、`mciNeonPulse`）
- Vue Transition name 前缀：`mci-`
- 修饰符使用 BEM：`.mci-card--active`、`.mci-btn--outline`
- JS 全局变量前缀：`MCI_`（如 `MCI_THEME`）

---

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
      <a class="mci-tabbar__item mci-tabbar__item--active">首页</a>
      <a class="mci-tabbar__item">消息</a>
      <a class="mci-tabbar__item">我的</a>
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

## 🚨 移动端低代码项目落地踩坑（必�?- 2026.5�?

实战中频繁出现的 7 类问题，团队复盘后总结为强制规范：

### 1. 路由前缀不要硬编码租户名
- �?`manifest.json` �?`"router": { "base": "/lsg/" }`
- �?`"router": { "base": "/" }`，租户隔离通过 `OS_CLIENT` 常量 + 请求头完�?
- 任何形如 `https://api.itdos.com/{tenant}/...` �?URL 都是错误的，平台对外只暴�?`/`、`/api/...`、`/apiengine/...`

### 2. tabBar 必须�?PNG 图标
- uniapp / 微信小程序的 tabBar `iconPath` / `selectedIconPath` **只接受静�?PNG 文件路径**
- 不允许：emoji 字符、字体图标、SVG（部分平台不支持）、远�?URL
- 推荐尺寸�?0×60 ~ 81×81 px，未选中�?`#9898B0`，选中�?= 品牌主色
- 可用 PowerShell + System.Drawing 一次性生�?5×2 = 10 个图标，保证统一风格

### 3. font-size 严禁通配 `.parent text { ... }`
SCSS scoped �?`.qo text { font-size: 40rpx }` 会同时影�?emoji 图标 *�? 子标�?`<text class="fz-22">`，导致标签字体被强行放大�?
- �?`.qo text { font-size: 40rpx; }`
- �?`.qo .qo-emoji { font-size: 40rpx; } .qo .qo-label { font-size: 22rpx; }`
- 凡同一容器内同时含图标与文字，**必须**给图标和文字各自的具�?class

### 4. 我的�?/ 详情页菜单优先用网格单元格而非纵向列表
参�?"乐闪�?�?环球捕手"�?云集" 等线上商城：
- 5 列资产汇总条 �?4-5 列彩色图标网�?�?多行 4 列服务网�?
- 单元�?cell 结构：`80rpx 圆角图标背景�?+ 22rpx 标签`，间�?16~24rpx
- 不要�?"图标 �?文字 �?�?箭头" 的横排长列表（除非是设置类深层菜单）

### 5. 必备微动效（每个可点击元素都要有反馈�?
```scss
.cell, .entry-item, .product-card, .zone-card {
  position: relative;
  transition: transform .2s ease;
}
.cell::after, .entry-item::after, .product-card::after, .zone-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: var(--mci-shadow-card-hover);
  opacity: 0;
  transition: opacity .2s ease;
  pointer-events: none;
}
.cell:active, .entry-item:active { transform: scale(0.94); }

@keyframes fadein-up {
  from { opacity: 0; transform: translateY(16rpx); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fadein { animation: fadein-up .45s ease both; }
```

### 6. 品牌�?/ Logo 在所有标题位置统一替换
- `manifest.json`: `name`、`h5.title`
- `pages.json`: 每个页面 `navigationBarTitleText`、`globalStyle.navigationBarTitleText`
- 各页面顶�?brand 文本（首�?hero、登录页 logo 区、注册页标题�?
- 控制�?`console.log('[lsg-mall]')` 等技术代号可保留，但用户可见文案必须统一为产品名（如 `乐闪购`�?

### 7. 接口路径必须自动包含 ApiAddress（MCP 创建接口的硬规则�?
平台动态路�?`/apiengine/{key}` 通过 `sys_apiengine.ApiAddress` �?Redis 中查找�?*ApiAddress 为空 = 全部 404�?*
- MCP `microi_create_engine` 已自�?`ApiAddress = '/apiengine/{apiEngineKey}'`
- 手工 SQL / 直接 INSERT 创建的接口请补全 `ApiAddress` 字段，并写入缓存�?
  `Microi:{osClient}:FormData:sys_apiengine:{apiAddress.toLowerCase()}` �?整行模型对象
- 修复脚本可用一次�?V8 接口循环 `V8.FormEngine.UptFormData('sys_apiengine', { Id, ApiAddress })` �?`V8.Cache.Set` 三个键（key、Id、ApiAddress �?lowercase�?


## 🔗 外键字段必须使用 Id+Name 双控件设计（强制规范�?

> **错误做法**：只建一�?`XxxId` 字段并设�?Select 下拉，存的是 Id，列表中显示的也�?Id —�?用户根本看不懂�?
>
> **正确做法**：`XxxId`（隐�?Text�? `XxxName`（显�?Select+SQL 数据源）成对出现。Name 控件的值变�?V8 事件自动�?Id 控件赋值�?

### 字段对结�?

| 字段 | Component | Visible | 用�?|
|------|-----------|---------|------|
| `XxxId` | Text | **0**（隐藏） | 实际外键 Id（数据库索引 / 关联查询用） |
| `XxxName` | Select | 1 | 用户在表�?列表里看到的关联记录名称 |

### XxxName 字段 Config（Sql 数据源）

```jsonc
{
  "DataSource": "Sql",
  "Sql": "select Id, Name from <关联�? where Name like '%$Keyword$%' limit 0,20",
  "SelectLabel": "Name",          // 下拉显示字段
  "SelectSaveField": "Name",      // 保存�?XxxName 的字段（注意保存的是 Name 而非 Id�?
  "SelectSaveFormat": "Text",
  "EnableSearch": true,
  "DataSourceSqlRemote": true,    // 必须 true：每次输入关键字向后端查�?
  "V8Code": "if (V8.ThisValue && typeof V8.ThisValue === 'object') { V8.Form.XxxId = V8.ThisValue.Id || ''; } else if (!V8.ThisValue) { V8.Form.XxxId = ''; }"
}
```

**关键�?*�?
1. `SelectSaveField` �?**Name 而非 Id** —�?`XxxName` 存的是名称，列表直接显示就有意义
2. `DataSourceSqlRemote: true` —�?远程搜索，避免一次性把整张表拉到前�?
3. `V8Code` 中通过 `V8.ThisValue` 拿到完整选项对象（包�?Id �?Name），赋值给 `V8.Form.XxxId` 即可同步外键 Id
4. SQL �?`$Keyword$` 是占位符，会被替换为用户输入的关键字
5. 若关联表"name 字段"叫别的（�?`mall_member.NickName`、`mall_shop.ShopName`、`mall_product.Title`、`mall_address.Receiver`、`mall_pickup_apply.ApplyNo`），需�?SQL �?Config 中相应替�?

### 命名规范

| 关联场景 | baseName | 字段�?| joinTable.joinNameField |
|---------|---------|--------|------------------------|
| 商品分类 | Category | CategoryId / CategoryName | mall_category.Name |
| 会员（直推上�?/ 买家 / 卖家 / 持有�?/ 发起�?/ 目标人） | Parent / Buyer / Seller / Owner / Initiator / Target | XxxId / XxxName | mall_member.NickName |
| 店铺 | Shop / ShopOwner | ShopId / ShopName | mall_shop.ShopName |
| 商品 | Product / AnchorProduct | ProductId / ProductName | mall_product.Title |
| 收货地址 | Address | AddressId / AddressName | mall_address.Receiver |

### MCP 工具支持

#### 新建外键对：`microi_add_join_field`
```jsonc
{
  "tableId": "01XXX...",
  "baseName": "Category",
  "label": "分类",
  "joinTableName": "mall_category",
  "joinIdField": "Id",      // 默认 "Id"
  "joinNameField": "Name",  // 默认 "Name"
  "tab": "",
  "sort": 100
}
```

#### 修复存量字段：`microi_fix_join_field`（或直接调用 `_mcp_fix_join_field` 接口引擎�?
- 自动隐藏 `XxxId`（Visible=0/AppVisible=0�?
- 自动创建/更新 `XxxName` �?Select+SQL+V8Code 三件�?
- 自动回填：遍历目标表所有非�?`XxxId` 行，�?Id 查询关联表的 Name，UPDATE �?`XxxName`
- 幂等：重复调用不会重复创建字段，只会刷新 Config

调用示例（dryRun 先看计划）：
```jsonc
microi_run_engine "_mcp_fix_join_field" {
  "tableName": "mall_buy_order",
  "baseName": "Buyer",
  "label": "买家",
  "joinTableName": "mall_member",
  "joinNameField": "NickName",
  "dryRun": true
}
```

### 何时跳过 Name 字段

只在以下场景下保留单 `XxxId` 字段（不�?Name 对）�?
- 关联表完全没有可�?名称字段"（如�?Id 表）
- 多态关联（同一字段可能指向多张不同表，�?`RelOrderId`�?
- 高频写入的日志表外键，且管理后台不需要列表展�?

其他所有业务表的外�?**必须** �?Id+Name 对�?

---

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

## 接口引擎匿名访问

登录、注册、首页公共数据等接口必须 `AllowAnonymous=1`，否则未登录用户调用会拿到 `null`：

```jsonc
microi_set_engine_anonymous {
  "apiEngineKeys": ["mall_member_login", "mall_member_register", "mall_home_data"],
  "allowAnonymous": 1
}
```


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

## MCI-UI 源码落地位置

MCI-UI 已在吾码源码根目录落地：`Microi.UI/`。

- 新的移动端 UniApp/H5 项目应优先使用 `Microi.UI/src/uniapp` 中的 `MciPage`、`MciNavbar`、`MciButton`、`MciCard`、`MciCell`、`MciSection`、`MciTabs`、`MciMetricCard`、`MciActionBar`、`MciAvatar`、`MciProductCard`、`MciSkeleton`、`MciDataState`、`MciRichText`，再按业务补项目组件。
- 新的 PC 官网、产品站、文档站、响应式网站应优先使用 `Microi.UI/src/web` 和 `Microi.UI/src/theme`，不要直接套后台 Element Plus 风格。
- `Microi.UI/src/theme/tokens.css` 是品牌 token 源头；新组件颜色、圆角、阴影、间距、安全区、骨架屏都必须走 `--mci-*` 变量。
- `Microi.UI/src/theme/runtime.js` 是主题运行时入口；项目应通过 `initMciDesign()`、`setMciPalette()`、`setMciShape()`、`setMciTheme()` 统一设置黑白红橙黄绿青蓝紫主色、圆角/扁平、亮暗主题和动效偏好。
- `MciPage` 默认带页面入场动效；业务页如果有特殊路由转场，可以关闭 `animated` 后使用项目级转场，但不能让动态页面无反馈地直接闪现。
- `MciButton`、`MciCard` 必须保留 hover/pressed/focus/sheen 等基础反馈；业务组件可以封装样式，但不能删掉交互状态。
- 第三方 UI 库只能作为底层能力或局部补充，不能绕过 MCI-UI 直接决定产品视觉。
