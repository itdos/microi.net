# Microi.UI（MCI-UI）

Microi.UI（MCI-UI）是 Microi 吾码面向 **Vue 3 PC 网站、响应式网站、移动端 H5、uni-app 项目** 的统一 UI 基础库。它不是为了替代所有第三方组件库，而是为吾码生态提供稳定的品牌视觉、主题变量、基础组件、动效规则和 AI 生成前端时的统一落点。

> PC 后台管理系统仍然以 Element Plus 为主，不需要替换选型。Microi.UI 主要服务官网、企业站、产品站、文档站、移动端商城、会员中心、活动页、独立 Web 应用等非后台管理系统场景。

## 为什么要做 Microi.UI

市面上已经有 uni-ui、uView UI、TDesign、FirstUI、Element Plus、Naive UI、Arco Design Vue 等大量优秀 UI 库。Microi.UI 仍然有存在的必要，原因不是“重复造组件”，而是解决吾码生态自己的长期问题。

### 1. 统一吾码品牌视觉

第三方 UI 库各有自己的审美和交互语言。如果每个项目直接混用，页面会很快变成“哪个库都像一点，但不像 Microi”。Microi.UI 用 `--mci-*` 设计变量、统一阴影、圆角、骨架屏、动效、安全区规则，把不同项目收束到同一个品牌系统里。

### 2. 让 AI 生成的项目更稳定

AI 很容易根据当前页面临时写一套 CSS，短期能看，长期会散。Microi.UI 给 AI 一个固定答案：页面 shell 用 `MciPage`，按钮用 `MciButton`，卡片用 `MciCard`，动态数据用 `MciSkeleton`，富文本用 `MciRichText`，主题用 `initMciDesign()`。这样 AI 每次生成的项目会更一致，也更容易维护。

### 3. 兼容移动端和 PC 网站

Microi.UI 同时提供：

- `src/web`：Vue 3 PC 网站、响应式网站组件。
- `src/uniapp`：uni-app / H5 移动端组件。
- `src/theme`：Web 与移动端共用的 tokens、基础样式和主题运行时。

同一套品牌变量可以服务企业官网、产品站、移动端商城、活动页和独立 Web 应用，避免每个项目从零设计。

### 4. 主题能力是内建能力

所有移动端和 PC 网站项目都应该支持：

- 明暗模式：`light` / `dark`
- 主色 palette：黑、白、红、橙、黄、绿、青、蓝、紫
- 形态模式：圆角 / 扁平
- 动效偏好：完整动效 / 减弱动效

Microi.UI 通过 CSS token 与运行时统一完成这些能力，业务页面不需要散写颜色、阴影和圆角。

### 5. 第三方 UI 库仍然可以用

Microi.UI 不排斥第三方库。复杂表格、日期选择、上传、弹窗、表单校验等成熟能力，可以继续使用 Element Plus、uni-ui、TDesign、uView、FirstUI 等。但项目最终呈现出来的视觉，应该由 `--mci-*` token 和 `mci-*` 组件封装统一承载。

## 目录结构

```text
Microi.UI/
  src/theme/
    tokens.css      # 颜色、阴影、圆角、间距、安全区、骨架屏、palette
    index.css       # mci-page、mci-card、动效、hover/pressed、骨架屏等基础样式
    runtime.js      # initMciDesign / setMciTheme / setMciPalette / setMciShape
  src/web/
    index.js
    components/     # Vue 3 Web 组件
  src/uniapp/
    index.js
    components/     # uni-app 组件
```

## 安装与引入

当前源码目录已经包含 `Microi.UI/`。正式发布到 npm 前，可以通过 workspace、别名或复制源码目录的方式使用。

### Vue 3 Web

```js
import { createApp } from 'vue';
import MciUI, { initMciDesign } from '@microi/mci-ui/web';
import '@microi/mci-ui/theme';

initMciDesign({
  theme: 'light',
  palette: 'red',
  shape: 'rounded',
  motion: 'full'
});

createApp(App).use(MciUI).mount('#app');
```

### uni-app

```js
import { createSSRApp } from 'vue';
import App from './App.vue';
import MciUI, { initMciDesign } from '@/mci-ui/uniapp/index.js';
import '@/mci-ui/theme/index.css';

export function createApp() {
  const app = createSSRApp(App);
  initMciDesign({
    theme: 'light',
    palette: 'red',
    shape: 'rounded',
    motion: 'full'
  });
  app.use(MciUI);
  return { app };
}
```

uni-app 非 H5 端没有完整 DOM，`initMciDesign()` 仍可保存偏好；页面可以通过 `MciPage` 的 `shape`、`safeTop`、`safeBottom` 等 props 或项目级 class 继续承接样式。

## 主题运行时

```js
import {
  initMciDesign,
  setMciTheme,
  setMciPalette,
  setMciShape,
  setMciMotion
} from '@microi/mci-ui/runtime';

initMciDesign({
  theme: 'light',      // light | dark
  palette: 'red',      // black | white | red | orange | yellow | green | cyan | blue | purple
  shape: 'rounded',    // rounded | flat
  motion: 'full'       // full | reduced
});

setMciTheme('dark');
setMciPalette('blue');
setMciShape('flat');
setMciMotion('reduced');
```

主题切换会写入本地存储，并在支持 DOM 的环境中设置：

```html
<html data-theme="light" data-mci-palette="red" data-mci-shape="rounded" data-mci-motion="full">
```

## Palette 规范

Microi.UI 内置主流主色：

| Palette | 适合场景 |
| --- | --- |
| `black` | 高端企业站、技术产品、数据类页面 |
| `white` | 极简官网、轻品牌页面、留白型产品站 |
| `red` | 吾码默认品牌、商城、活动、重点转化 |
| `orange` | 运营活动、服务行业、效率工具 |
| `yellow` | 会员权益、积分、金融感、充值类 |
| `green` | 健康、环保、成功状态、农业类 |
| `cyan` | 科技、物联网、实时数据、轻量工具 |
| `blue` | 企业服务、SaaS、可信赖的 B 端产品 |
| `purple` | AI、创意工具、数字化产品 |

白色和黄色 palette 不能固定使用白字，必须通过 `--mci-text-on-primary` 控制按钮文字，确保对比度。

## 基础组件

### MciPage

页面 shell。默认带页面入场动效，可选安全区、窄版容器、结构化网格背景、形态模式。

```vue
<MciPage safe-area tech-grid shape="rounded">
  <section class="mci-stagger">
    <MciCard animated>...</MciCard>
    <MciCard animated>...</MciCard>
  </section>
</MciPage>
```

移动端底部固定按钮、tabBar、沉浸式顶部栏必须考虑 `safe-area-inset-*`。

### MciButton

品牌按钮。支持 `primary`、`gold`、`plain`、`cool`、`ghost`，并内置按压、hover、focus、sheen 等反馈。

```vue
<MciButton variant="primary" sheen>立即购买</MciButton>
<MciButton variant="plain">取消</MciButton>
```

### MciCard

通用内容卡片。支持 hover lift、入场动效、扫光、玻璃态、强调边框。

```vue
<MciCard interactive animated sheen>
  <h3>资产概览</h3>
  <p>¥ 12,800.00</p>
</MciCard>
```

### MciSkeleton

动态数据首屏必须使用骨架屏。列表、表格、卡片、商品、详情页都应该使用接近最终布局的骨架结构，不要用 spinner 或提前显示“暂无数据”。

### MciRichText

移动端富文本容器。图片允许 `width:100%`，文字必须有上下左右间距，避免商品详情、文章详情贴边难看。

## AI 用法

当使用 AI 开发 Microi 项目时，应明确要求：

```text
使用 Microi.UI / MCI-UI 开发此 Vue 3/uni-app 页面。
遵循 microi.skills/ui-design/SKILL.md 和 microi.skills/microi-ui/SKILL.md。
页面必须支持 light/dark、黑白红橙黄绿青蓝紫 palette、rounded/flat、骨架屏、安全区、页面入场和点击反馈。
业务页面不要硬编码颜色/阴影/圆角，必须使用 --mci-* token 或 MciPage/MciButton/MciCard 等组件。
```

AI 完成后应检查：

- 是否使用 `MciPage` 或等价页面 shell。
- 是否有骨架屏，而不是直接显示空态。
- 是否支持安全区。
- 是否通过 `initMciDesign()` 或项目主题服务设置主题。
- 是否没有硬编码主色、圆角、阴影。
- 是否跑过基础构建或至少 `node --check` / `npm pack --dry-run`。

## 与 Element Plus 的关系

`Microi.Client` 后台管理系统继续使用 Element Plus。Microi.UI 不替换后台管理系统的表格、表单、弹窗等成熟能力，但后台主题色、空态、骨架屏、安全区、动效密度和品牌变量仍应逐步向 `--mci-*` 对齐。

## 与 uni-ui / uView / TDesign / FirstUI 的关系

这些库可以作为底层能力，例如日历、上传、选择器、复杂表单组件。但业务页面不应该直接混杂多个库的视觉风格。推荐做法是：

1. 第三方组件只解决复杂交互能力。
2. 外层使用 `mci-*` wrapper 或项目级组件封装。
3. 颜色、圆角、阴影、间距、字体、骨架屏都走 `--mci-*` token。
4. 对用户可见的页面风格由 Microi.UI 统一控制。

## 后续建设方向

- 建立 Microi.UI 示例站和组件预览。
- 增加更多 Web/UniApp 业务组件：导航、Tab、表单项、列表项、商品卡、资产卡、统计卡、弹窗、底部操作栏。
- 为 `microi.doc` 增加可交互主题 palette 演示。
- 将常见行业模板沉淀为 MCI-UI 模板：商城、企业官网、维保平台、会员中心、数字资产、AI 产品页。
