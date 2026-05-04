# Microi 酷炫 UI 设计规范（DESIGN SYSTEM）

你正在为 Microi 吾码平台创建界面。所有页面、组件、弹窗必须遵循本规范，打造统一的赛博、炫技、科技感视觉体验。

> **适用平台**：PC 端（Vue 3 + Element Plus + SCSS）、移动端 H5/uni-app/原生 WebView（纯 CSS / 无第三方组件库）
> **核心理念**：酷炫但不卡顿，炫技但可维护，多端统一同时尊重平台差异
> **变量前缀**：所有 CSS 变量统一使用 `--mci-` 前缀（Microi Cool Interface）

---

## 整体风格定义

- **风格关键词**：明亮多彩、渐变流光、科技感、轻量精致、视觉张力
- **质感**：柔和多层阴影、玻璃拟态（Glassmorphism）、霓虹渐变光晕、极光光斑底图
- **氛围**：默认亮色多彩主题（colorful + gradient + soft shadow），暗黑主题作为可选切换；光影流动、精致微动效

---

## 颜色体系（CSS Variables — 支持主题切换）

所有颜色必须通过 CSS 变量引用，禁止硬编码色值。变量定义放在全局样式入口（PC 端 `src/styles/mci-design.scss`，移动端 `<style>` 内或独立 CSS 文件）。

### 暗黑主题（可选切换 — `data-theme="dark"`）

```css
:root[data-theme="dark"] {
  /* 主色 — 紫蓝霓虹 */
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

- **主色**用于核心交互元素（按钮、链接、选中态）
- **Accent Red / Danger** 用于危险操作、错误、热门标记
- **Accent Blue / Info** 用于信息提示、次要按钮
- **Accent Gold / Warning** 用于重要强调、VIP 标签、价格、警告
- **Accent Cyan / Success** 用于成功状态、在线标识
- 默认主题为亮色多彩，强调渐变和柔和阴影；暗黑主题作为用户可选项
- 用户主题偏好持久化到 `localStorage('mci-theme')`，初次访问跟随系统 `prefers-color-scheme`

---

## 阴影体系（酷炫的核心）

阴影是塑造层次感和酷炫感的关键。采用多层阴影叠加。

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

  /* 霓虹发光 */
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
| 霓虹强调元素 | `--mci-glow-*` |

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
- 顶部导航栏 padding-top 必须包含 `var(--mci-safe-top)`
- 底部 tab bar padding-bottom 必须包含 `var(--mci-safe-bottom)`
- 列表项之间最小间距 8px，避免误触

---

## 动效规范（拉满但不卡）

### 性能铁律

1. **只用 `transform` 和 `opacity` 做动画** — 走 GPU 合成层，不触发重排重绘
2. **禁止动画 `width/height/top/left/margin/padding`** — 会触发 Layout，导致卡顿
3. **禁止动画 `box-shadow`** — 改用伪元素 `::after` 的 `opacity` 切换预设阴影
4. **`will-change` 不要滥用** — 只在动画激活时添加，静态元素禁止使用
5. **动画时长控制**：微交互 150-250ms，转场 300-400ms，装饰动效 600ms-2s
6. **使用 `prefers-reduced-motion` 媒体查询**提供无动画回退
7. **移动端额外限制**：禁用 `backdrop-filter: blur()` 大面积使用（中低端机型严重掉帧），最多用于小型胶囊/标签
8. **移动端装饰背景**：使用 Aurora Orbs（4-5 个大尺寸模糊渐变光斑 + 慢速 `transform` 漂移），禁用 Canvas 粒子和密集星空

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

#### 4. 霓虹边框呼吸灯

```scss
.mci-neon-border {
  position: relative;
  border: 1px solid var(--mci-border-glow);
  border-radius: var(--mci-radius-lg);

  &::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    background: var(--mci-gradient-primary);
    z-index: -1;
    opacity: 0.5;
    filter: blur(8px);
    animation: mciNeonPulse 3s ease-in-out infinite;
  }
}

@keyframes mciNeonPulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
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
- ❌ JS 粒子（Canvas/WebGL）
- ❌ 实时阴影动画
- ❌ 复杂的 `filter` 动画（`blur`, `drop-shadow` 不要在动画中切换）
- ❌ 自动播放视频背景

---

## 装饰性背景（低性能消耗方案）

### 页面底层渐变光斑（PC 和高端移动端）

```scss
.mci-page-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  background: var(--mci-bg-base);

  &::before {
    content: '';
    position: absolute;
    top: -20%; left: -10%;
    width: 60%; height: 60%;
    background: radial-gradient(circle, rgba(114, 43, 255, 0.06) 0%, transparent 70%);
    filter: blur(80px);
    pointer-events: none;
  }
  &::after {
    content: '';
    position: absolute;
    bottom: -20%; right: -10%;
    width: 50%; height: 50%;
    background: radial-gradient(circle, rgba(41, 184, 255, 0.04) 0%, transparent 70%);
    filter: blur(80px);
    pointer-events: none;
  }
}
```

### Aurora Orbs（极光光斑 — 推荐的成熟大气背景）

取代细碎的 CSS 星空，使用 4 个大尺寸高斯模糊渐变光斑做缓慢漂移。视觉上更稳重、大气、有层次，性能上只走 GPU 合成层（`transform` + `opacity`），不触发重排重绘，移动端流畅运行。

```scss
.mci-aurora {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
  contain: strict;
}
.mci-aurora__orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.55;
  will-change: transform;
  animation: mciAuroraDrift var(--dur, 26s) ease-in-out infinite alternate;
}
.mci-aurora__orb--1 {
  width: 520px; height: 520px;
  top: -120px; left: -100px;
  background: radial-gradient(circle, var(--mci-color-primary) 0%, transparent 65%);
  --dur: 22s;
}
.mci-aurora__orb--2 {
  width: 460px; height: 460px;
  top: 28%; right: -140px;
  background: radial-gradient(circle, var(--mci-color-accent-blue) 0%, transparent 65%);
  --dur: 28s;
  animation-delay: -8s;
}
.mci-aurora__orb--3 {
  width: 580px; height: 580px;
  bottom: -180px; left: 18%;
  background: radial-gradient(circle, var(--mci-color-accent-pink) 0%, transparent 65%);
  opacity: 0.4;
  --dur: 32s;
  animation-delay: -14s;
}
.mci-aurora__orb--4 {
  width: 380px; height: 380px;
  top: 55%; left: -80px;
  background: radial-gradient(circle, var(--mci-color-accent-cyan) 0%, transparent 65%);
  opacity: 0.45;
  --dur: 26s;
  animation-delay: -4s;
}
@keyframes mciAuroraDrift {
  0%   { transform: translate3d(0, 0, 0) scale(1); }
  50%  { transform: translate3d(40px, -30px, 0) scale(1.08); }
  100% { transform: translate3d(-30px, 20px, 0) scale(0.95); }
}

/* 暗黑主题下光斑更浓 */
:root[data-theme="dark"] .mci-aurora__orb {
  opacity: 0.35;
  filter: blur(80px);
}
@media (prefers-reduced-motion: reduce) {
  .mci-aurora__orb { animation: none; }
}
```

HTML 结构（无需 JS，纯静态 4 个 div）：
```html
<div class="mci-aurora" aria-hidden="true">
  <span class="mci-aurora__orb mci-aurora__orb--1"></span>
  <span class="mci-aurora__orb mci-aurora__orb--2"></span>
  <span class="mci-aurora__orb mci-aurora__orb--3"></span>
  <span class="mci-aurora__orb mci-aurora__orb--4"></span>
</div>
```

> 性能预算：4 个 orb 各占一个合成层，移动端 60fps 稳定。GPU 显存占用约 12MB（基于 580×580 + 4×blur(60px)）。

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
- [ ] 移动端：星空粒子 ≤ 30 颗
- [ ] 移动端：使用 `env(safe-area-inset-*)` 适配安全区

---

## 主题切换实现

```js
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('mci-theme', theme); } catch(e) {}
}

const saved = (() => { try { return localStorage.getItem('mci-theme'); } catch(e) { return null; } })();
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
// 默认亮色多彩主题，仅当系统明确设置为深色或用户主动选择深色时启用 dark
setTheme(saved || (prefersDark ? 'dark' : 'light'));

// 监听系统主题变化
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  if (!localStorage.getItem('mci-theme')) setTheme(e.matches ? 'dark' : 'light');
});
```

### uni-app（H5/小程序通用）主题切换

uni-app 中没有 `document` 对象（小程序端），所以推荐两套方案并存：

**方案A · H5 直接操作 documentElement（最简单）**

```scss
/* 在 mci-design.scss 加暗色定义 */
.theme-dark, page.theme-dark {
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
// utils/theme.js
const KEY = 'mci_theme';
function applyClass(theme) {
  if (typeof document !== 'undefined' && document.documentElement) {
    const cls = document.documentElement.classList;
    cls.remove('theme-light', 'theme-dark', 'theme-auto');
    cls.add('theme-' + theme);
  }
}
export function getTheme() { try { return uni.getStorageSync(KEY) || 'light'; } catch (e) { return 'light'; } }
export function setTheme(theme) {
  if (!['light','dark','auto'].includes(theme)) theme = 'light';
  try { uni.setStorageSync(KEY, theme); } catch(e) {}
  applyClass(theme); return theme;
}
export function toggleTheme() { return setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }
export function initTheme() { applyClass(getTheme()); }
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
- 形式：图标 + 文案（🌙 暗色 / ☀️ 亮色 / 🌗 跟随系统），点击后立即生效，弹 Toast 反馈
- 切换后立刻持久化（uni.setStorageSync），下次启动 App 在 `onLaunch` 自动 `initTheme()` 应用

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
  transition: transform .2s ease, box-shadow .2s ease;
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

