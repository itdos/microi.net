# ui-design 详细参考 6

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=ui-design-018 sha256=c83c67d0a4520a52e8933e5b8785fe3a725e1b47b675cf1f5aa945187c9cfd2c -->
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


<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=ui-design-019 sha256=535f58f5173e164ebe23480d3a65ce894fcf0aab65dddc209dabd86c939cf9b6 -->
## 命名规范

- CSS 变量前缀：`--mci-`
- 组件类名前缀：`.mci-`
- 动画 keyframe 前缀：`mci`（如 `mciFadeUp`、`mciNeonPulse`）
- Vue Transition name 前缀：`mci-`
- 修饰符使用 BEM：`.mci-card--active`、`.mci-btn--outline`
- JS 全局变量前缀：`MCI_`（如 `MCI_THEME`）

---

<!-- /microi-progressive:chunk -->
