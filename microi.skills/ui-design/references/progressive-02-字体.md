# ui-design 详细参考 2

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=ui-design-009 sha256=3e553809ea501d359553ba0e78a1cf83c9fccc0cdc06a5d562d73af7ebc0c09d -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-010 sha256=06dccf8f187ce38d807057735f6b6acbf9a9037f37f64544fb933f16f28e58f0 -->
## 间距与触摸目标

### 界面引擎仪表盘密度与对齐

- 界面引擎首页和仪表盘默认采用单一外层滚动。单个卡片容器尽量完整展示内容，不设置独立纵向滚动条；固定高度不足时应压缩卡片、工具栏、表格行高与间距，或让容器自然增高。
- 同一层级的卡片必须统一外边距、内边距、圆角、标题高度和内容起始线；同排卡片应使用相同最小高度，左右边缘及底部视觉对齐。
- 表格容器以默认 15 条数据、表头、工具栏和分页全部可见为桌面端验收基准；日历与公告同样要完整显示头部操作、主体和底部区域。
- 页面编辑、快捷操作等悬浮按钮必须脱离文档流，不能通过额外空白行或页面顶部内边距占位；半透明悬浮元素需保证文字对比度和 hover 可识别性。
- 避免组件底部出现大片无信息空白。优先调整组件内部纵向分布、最小高度和网格密度；不得用内部滚动条或隐藏分页来伪装紧凑。
- 界面引擎移动端必须按真实视口自动改为单列容器；卡片内高频指标和短快捷入口可以采用两列紧凑网格，不能把桌面 4 列机械改成 4 个超高单列卡片。嵌入式列表的返回栏、全局 FAB、固定操作条必须降级为容器内操作，不能覆盖前后兄弟组件。
- 容器标题右侧存在“更多/进入/刷新/界面设计”等多个动作时，必须放入同一个 `display:flex; align-items:center` 操作区；窄屏允许整体换行并右对齐，禁止依赖 float 或绝对定位造成文字上下错位、互相遮挡。

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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-011 sha256=fba089e9a092efca57bfad2a34a4b9bada857c1072b09488e29b3cf28eefaba1 -->
## 骨架屏 Loading 设计规范

所有依赖接口、数据库、远程资源或异步计算的数据区域，首屏加载态必须使用骨架屏（Skeleton Screen），不能只显示 spinner、进度圈、空图标或“数据加载中...”文案。骨架屏属于基础体验规范，适用于 PC、移动端 H5、uni-app、小程序和 WebView。

- 覆盖范围包括菜单/路由切换、首页工作台、表格、卡片、表单与详情首开、右侧面板、弹窗、树、文件/文档/3D 等远程内容容器；不能只改某一个 `diy-table` 页面。
- 骨架屏形态必须接近最终内容版式：列表用行骨架，表格用表头+行骨架，卡片/商品用网格骨架，详情页用大图区+标题/段落骨架，仪表盘用指标卡骨架。
- 加载期间不能提前显示“暂无数据/暂无明细/空空如也”；空态只能在请求完成且确认无数据后出现。
- 骨架表面必须不透明，禁止复用 `.el-loading-mask` 的半透明黑/灰遮罩。颜色只引用语义令牌：`--mci-skeleton-surface/card/header/base/highlight/accent/border`；运行时从当前 `--mci-*` 表面与主题色低饱和派生，必须同时兼容 `data-theme="light|dark"`、`html.dark`、租户自定义主题色和系统主题切换。
- 主色只允许作为低占比边缘/高光染色，不能把高饱和主题色铺满骨架；切换亮色、暗色或任意自定义主题后，骨架层级要可辨认且不闪白、不变黑幕。
- 动画只允许使用 `background-position`、`opacity` 或 `transform`，节奏控制在 1.0s 到 1.4s；必须支持 `prefers-reduced-motion` 关闭或弱化动画。
- 分页加载下一页时，只在列表底部追加紧凑骨架，不覆盖已有内容；切换筛选/分类重载第一页时才显示首屏骨架。
- 骨架块必须有稳定尺寸、圆角和间距，加载前后不能造成明显布局跳动。
- 内容加载与操作反馈必须区分：查询/渲染内容使用骨架；保存、提交、删除、登录验证等短操作继续使用按钮内 `loading`；文件上传、后台任务、Unity/WebGL 等已有可信百分比时继续显示真实进度。禁止用骨架伪装可量化进度，也禁止用按钮 spinner 代替内容骨架。
- Microi.Client 内容区优先使用全局 `v-mci-loading:<table|cards|form|detail|page|stats|list|tree|compact>`；全屏内容切换使用 `openMciLoading()`。不得新增内容型 `v-loading` / `ElLoading.service`。第三方遗留 Loading 必须由主题骨架兜底，不能恢复暗色遮罩。
- 头像、验证码、私有图片/文件缩略图等局部远程资源使用消费同一主题令牌的圆形或媒体骨架；历史 `./static/img/loading.gif` 只能作为内部兼容哨兵，必须在渲染层拦截，禁止传给 `<img>`、`<el-image>` 或 CSS `url()` 发起真实请求。
- 自动验收至少扫描 `v-loading`、`ElLoading.service`、硬编码 `.el-loading-mask rgba(...)` 和加载期空态文案；浏览器截图覆盖 1440/1920 桌面、390 移动、亮色、暗色、至少一种非默认自定义主题，以及菜单切换、表格、表单详情、首页。检查控制台、404/5xx、`aria-busy` 和 reduced-motion。

参考样式：

```scss
.mci-skeleton {
  position: relative;
  overflow: hidden;
  background: var(--mci-skeleton-surface);
}
.mci-skeleton__block {
  background: linear-gradient(90deg, var(--mci-skeleton-base), var(--mci-skeleton-highlight), var(--mci-skeleton-base));
  background-size: 240% 100%;
  animation: mciSkeleton 1.15s ease-in-out infinite;
}
@keyframes mciSkeleton {
  0% { background-position: 120% 0; }
  100% { background-position: -120% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .mci-skeleton__block { animation: none; }
}
```

---

<!-- /microi-progressive:chunk -->
