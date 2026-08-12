# ui-design 详细参考 3

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=ui-design-012 sha256=d59ae14c3991bb27949dcdcc0df3114ecbd1e627d6a69f5f78d1247ea2e02cd6 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-013 sha256=385528713388a28e0182e2df9e2ed828ddb7cccaf7a3a5e78354f46a588f6f1c -->
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

<!-- /microi-progressive:chunk -->
