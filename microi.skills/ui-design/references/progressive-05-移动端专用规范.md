# ui-design 详细参考 5

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=ui-design-015 sha256=18e252a8b3e87b6522a9f434e7332afc9be1a5ab0797d7bd9e5d639bdcc9d240 -->
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
- 微信小程序中 `env()` 可能返回 `0`，不得把它作为唯一安全区来源；优先读取 `uni.getWindowInfo()` 并把真实值注入页面壳变量。
- 自定义导航必须读取微信胶囊矩形并预留右侧空间，任何标题、登录、分享或状态按钮都不能与胶囊区域重叠。
- 全屏弹层、沉浸式工作台和独立工具页同样属于自定义导航场景。右侧存在两个以上操作按钮且无法在胶囊左侧完整容纳时，必须把整组标题与操作区放到 `capsule.top + capsule.height` 下方，禁止把关闭、新建、历史等按钮塞到胶囊背后。
- 顶部 fixed/sticky 导航使用 `padding-top: max(var(--mci-safe-top), statusBarHeight)` 的等价实现；返回按钮触摸区域要随顶部安全区整体下移。
- 底部 fixed 操作栏和 tabBar 使用 `padding-bottom: calc(var(--mci-safe-bottom) + 8px)` 或项目等价间距，页面主体同步预留底部高度，避免按钮遮挡列表最后一项。
- 多层页面必须定义返回优先级：先关闭键盘/确认框，再关闭抽屉/筛选层，再退出全屏工具页，最后才返回底层业务路由。需要支持手机侧滑返回的全屏功能优先实现为独立路由，不能只做覆盖当前页的普通 `fixed` 蒙层。
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-016 sha256=2c997040cef24fb5e8b6f2faab6d354473d4a962560fdaffd13f11294eb4cf1f -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-017 sha256=dfd5e3fe5ccef15772d0687dc031ce302cc9b2277e06f5c6dd0ad7113343f540 -->
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
- [ ] 提示与确认：源码不存在原生 `alert/confirm/prompt`；长弹窗滚到顶部、中部、底部时，错误提示和确认层都在当前视口正中央且不被宿主遮挡
- [ ] 组件复用：同类结构出现两处及以上时必须抽成 `Mci*` 或项目级 `mci-*` 组件，业务页只传文案、图标、状态、动作和少量变体

---

<!-- /microi-progressive:chunk -->
