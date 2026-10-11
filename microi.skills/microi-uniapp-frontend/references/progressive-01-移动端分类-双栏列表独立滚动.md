# microi-uniapp-frontend 详细参考 1

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=microi-uniapp-frontend-010 sha256=d662fcd325e57ad4ac1f0e1c5e1b988909b68b82e8d894493214227498db0c93 -->
## 移动端分类/双栏列表独立滚动

商品分类、知识库分类、通讯录分组、资产分类等“左侧分类 + 右侧列表”的移动端页面，根节点必须固定在一个视口内，不能让整页和内部列表同时滚动。

- 根页面使用有界视口高度、`overflow:hidden; display:flex; flex-direction:column;`；H5 使用 `100dvh` 或共享可见高度变量，保留 `100vh` 旧端兜底。
- 分类主体使用 `flex:1; min-height:0; display:flex;`。导航在根 flex 流内时不再加 tabBar 占位；导航覆盖正文时，才由共享壳预留一次实测总高度（已经包含安全区）。
- 左侧分类和右侧列表分别用 `scroll-view scroll-y`，高度来自父级 `height:100%` / `flex:1; min-height:0`，不要用整页滚动承载右侧商品列表。
- 右侧分页必须绑定 `@scrolltolower`，设置合理 `lower-threshold`，并维护 `pageIndex/pageSize/loading/finished`，第一页重置列表，后续页追加列表。
- 切换左侧分类或顶部专区时，必须重置分页状态并重新加载第一页；不能沿用旧分类的 `finished` 或 `pageIndex`。
- 验收截图要重点看底部：内容不能被 tabBar 压住，页面底部不能出现整页滚动留下的大块空隙。

参考结构：

```vue
<view class="page-category">
  <view class="area-tabs">...</view>
  <view class="cat-body">
    <scroll-view class="cat-side" scroll-y>...</scroll-view>
    <scroll-view class="cat-content" scroll-y lower-threshold="120" @scrolltolower="loadMore">...</scroll-view>
  </view>
</view>
```

```scss
.page-category { height: 100vh; height: var(--mci-visible-height, 100dvh); overflow: hidden; display: flex; flex-direction: column; }
.cat-body { flex: 1; min-height: 0; display: flex; }
.cat-side { width: 176rpx; height: 100%; }
.cat-content { flex: 1; min-width: 0; height: 100%; }
// 本示例采用流内导航，导航自己占高度并消费安全区；覆盖式导航另由共享壳预留实测高度。
.category-nav { flex-shrink: 0; padding-bottom: var(--mci-safe-bottom, env(safe-area-inset-bottom)); }
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-011 sha256=a28fba298274b738ef9039c6bd6a1707468687e2ae9644a819736374586749e9 -->
## 数据页必须使用骨架屏 Loading

任何依赖接口/数据库返回数据的移动端页面，都必须区分 `loading`、`data`、`empty`，并且首屏加载态必须使用骨架屏（Skeleton Screen）。接口请求结束前不能提前显示“暂无数据/暂无明细/空空如也”，也不能只用“图标 + 数据加载中...”或单独 spinner 作为页面级 loading。

- `loading` 初始值设为 `true`（或进入页面同步设为 `true`），请求 `finally` 中再置为 `false`；未登录、无权限、参数缺失等提前返回分支也必须关闭 `loading`。
- 首屏加载、切换 tab、筛选、搜索、分类、重新加载第一页时，应显示与最终版式接近的骨架：列表页用列表骨架，双列商品用网格骨架，详情页用详情骨架，首页 Banner/卡片区用对应区域骨架。
- 分页追加下一页时不能遮住已有数据，可在列表底部追加紧凑骨架行/骨架卡片；已有数据仍保持可阅读和可滚动。
- 空态必须使用 `!loading && list.length === 0`，不能直接写 `v-if="!list.length"`；空态可以用图标、文案和行动按钮，但只能在请求完成后出现。
- 请求失败时结束 loading，并给用户 toast、错误空态或可重试入口；不要静默失败后停在骨架屏，也不要把失败误显示成“暂无数据”。
- 通用组件可以保留 `DataState` 处理空态，但其 `loading` 分支必须渲染骨架屏，不得渲染加载文案作为主体。
- 骨架屏样式必须遵循 `microi.skills/ui-design/SKILL.md` 的骨架屏 Loading 设计规范：形态贴近最终内容、尺寸稳定、主题适配、动效克制，并支持弱化动效。

参考结构：

```vue
<SkeletonGrid v-if="loading && !list.length" :rows="6" />
<view v-for="item in list" :key="item.Id">...</view>
<SkeletonList v-if="loading && list.length" compact :rows="2" />
<DataState v-else-if="!list.length" empty-text="暂无数据" />
```

```js
const loading = ref(true);
const list = ref([]);

async function load() {
  loading.value = true;
  try {
    const r = await queryList();
    list.value = r.Code === 1 ? (r.Data || []) : [];
  } finally {
    loading.value = false;
  }
}
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-012 sha256=fe012b3e626a42152e6cbdb8df3f49f5ab71ed3d36dc4e145cc37d983624fc18 -->
## 移动端安全区必须兼容 iOS 与 Android

任何 UniApp/H5 移动端页面都必须同时适配 iPhone 刘海屏/Dynamic Island/Home Indicator、Android 状态栏/虚拟导航栏/手势条、微信/浏览器/WebView 容器差异。不要用固定 `20px/44px/64px` 直接硬编码顶部或底部间距。

- `manifest.json` / H5 模板必须确保 viewport 含 `viewport-fit=cover`，否则 iOS 的 `env(safe-area-inset-*)` 不会完整生效。
- 页面根节点使用最小高度或固定视口布局时，顶部内容、底部固定栏和内部滚动容器必须一起考虑安全区，不能只给根节点加 padding；有界 H5 壳优先动态可见高度，不能用 `min-height:100vh` 代替高度上限。
- 顶部自定义导航栏应结合 `uni.getSystemInfoSync().statusBarHeight` 和 CSS `env(safe-area-inset-top)`：状态栏占位负责不同系统高度，导航按钮和标题整体下移，返回按钮触摸区不能压到刘海/状态栏。
- 不能只依赖 `env(safe-area-inset-*)`。微信小程序、部分 Android WebView 或开发者工具中该值可能为 `0`；项目必须通过 `uni.getWindowInfo()`（旧端回退 `uni.getSystemInfoSync()`）读取 `statusBarHeight`、`safeArea` / `safeAreaInsets`，注入统一的 `--mci-safe-top`、`--mci-safe-bottom` 等页面壳变量。
- 微信小程序使用 `navigationStyle: custom` 时，必须读取 `uni.getMenuButtonBoundingClientRect()`（必要时回退 `wx.getMenuButtonBoundingClientRect()`），给顶部栏右侧预留 `windowWidth - capsule.left + gap`。登录、分享、状态角标、更多操作等任何按钮都不能进入右上角胶囊区域。
- 全屏弹层/工作台如果包含历史、新建、关闭等多个头部操作，必须先计算整组宽度；胶囊左侧不足时将整组放到胶囊底边以下，不得通过缩小触摸区、覆盖胶囊或截断标题硬塞。自动化测试应读取元素与胶囊 `boundingClientRect` 并断言不相交。
- 安全区实现必须集中在 `MciPage`、页面壳 composable/runtime 或全局布局中；禁止每页各自猜测 `20px/44px`。`pages.json` 中每个 `navigationStyle: custom` 页面都必须接入同一个页面壳，新增路由时同步纳入检查。
- 底部 `tabBar`、购买栏、提交栏、批量操作栏应在栏内消费统一的真实安全区。流内栏已经占据布局高度，正文不得再加整条栏占位；覆盖式 fixed 栏才预留一次栏的实测总高度，确保最后一条数据可见。
- 底部 fixed 元素应优先使用运行时 `--mci-safe-bottom`，以 CSS `env(safe-area-inset-bottom)` 作为 H5 兜底；底部导航、提交栏、弹出层和滚动容器必须引用同一变量，不能各算一套。
- 双栏分类页、聊天页、详情页带底部按钮时，内部 `scroll-view` 要用 `flex:1; min-height:0` 承载滚动。`fixedBarHeight` 若已经包含安全区，不再加一份 `env`；禁止根 padding、原生占位、正文 padding 和栏 padding 共同重复预留。
- H5 在 PC 手机壳模式下，fixed 顶栏/底栏仍要限制在手机壳宽度内；不能铺满整个桌面浏览器。
- 桌面预览没有真实手机手势区时底部安全区为 `0`；不能为了模仿手机外观硬塞 `34px/80rpx` 等假安全区。边框、阴影、装饰 Home Indicator 与系统安全区要分别处理。
- 验收必须至少覆盖一个 iPhone 刘海/灵动岛尺寸、一个 Android 高状态栏或虚拟导航栏尺寸、一个微信开发者工具真机模拟尺寸、一个 PC H5 手机壳尺寸；逐项截图检查顶部不被状态栏/胶囊遮挡、底部按钮不贴边、列表最后一项可见。不能只截图首页，必须按 `pages.json` 路由清单覆盖登录、Tab 页、详情、表单、弹层和管理页。
- 独占屏幕且需要支持手机侧滑返回的功能应使用独立页面路由。`onBackPress`/页面返回先消费当前页内部的键盘、对话框和抽屉状态；内部状态清空后才弹出当前页，不能让一次返回直接退出小程序或越过底层业务页。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-013 sha256=591a8e5a3e33cfcdb102abf56ebc6eeb5c5896d621442c30e734f455d625842c -->
## 微信自定义组件的点击与拖动事件必须真机链路验收

- UniApp 可拖动浮动入口等自定义组件，不要给 `touchstart/touchmove/touchend/tap` 整组无差别添加 `.stop/.prevent`。这些修饰符会生成微信 `catchtouch* / catchtap`，部分 UniApp 自定义组件中可能吞掉事件桥，出现节点可见但点击和触摸方法完全不执行。
- 优先使用可正常分发的 `bindtouch* / bindtap`，在方法内部通过 10-12px 位移阈值区分短触与拖动；短触应在 `touchend` 直接执行主动作，`tap` 仅作鼠标/H5 兜底，拖动结束不得误触主动作。
- 导航失败必须提供可见提示并记录错误，禁止让点击失败表现为毫无反应。
- H5 的 DOM `.click()`、CDP 触摸和微信预览编译都不能证明小程序组件事件桥正常。交付前必须使用微信开发者工具或 `miniprogram-automator` 对真实节点派发触摸，并断言目标页面进入页面栈；同时抽查一个普通按钮，排除自动化工具自身失效。

参考样式：

```scss
.page-mobile {
  min-height: 100vh;
  padding-top: calc(24rpx + var(--mci-safe-top, env(safe-area-inset-top)));
  padding-bottom: calc(112rpx + var(--mci-safe-bottom, env(safe-area-inset-bottom)));
  box-sizing: border-box;
}
.mci-navbar {
  padding-right: var(--mci-capsule-right, 0px);
}
.bottom-bar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(24rpx + var(--mci-safe-bottom, env(safe-area-inset-bottom)));
}
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-014 sha256=62f20b920f2365d9f2f5062218b10b17aa181ccb3ae5d2260f795e086355f678 -->
## 列表型资料页必须提供完整管理动作

地址、联系人、收款方式、发票抬头、车辆、设备、证照、银行卡等用户维护型资料页，不能只展示简略列表。除非业务明确只读，移动端必须提供：

- 查看完整信息：点击卡片或“详情”打开详情页/弹层，显示列表里省略的所有关键字段。
- 新增和编辑：新增与编辑可以复用同一表单，编辑时要带 Id 并回填现有值。
- 删除：必须有二次确认，并校验当前用户只能删除自己的资料；删除成功后刷新列表。
- 默认/启用类状态：同一用户只允许一个默认值时，后端保存接口要负责互斥清理，前端不能只改本地 UI。
- 权限与接口：后端接口必须用 token/当前用户校验所有权，不能信任前端传来的 MemberId/UserId。
- 跨会员但属于当前业务流程可见的数据（例如订单买家查看卖家收款方式、交易双方资料、售后处理信息）必须由订单/售后等业务 ApiEngine 在完成订单参与者权限校验后返回；前端不能用通用 `formEngineGet` 直接查对方会员表数据，因为移动端通用查询通常会自动追加当前会员隔离条件。
- 空态行动：没有数据时给出新增入口，但仍要遵守上面的加载态规则。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-015 sha256=d8e9280b5127d7dafd4dcb83b22bdb379fef39eac1e2e1b2e37f1c064cfe7fc6 -->
## 移动端资产/奖励流水展示

收益明细、积分明细、奖励明细、充值记录、订单流水等页面要面向用户展示“发生了什么”和“是否到账”，不要直接暴露后台调试字段。

- 每条记录必须显示完整时间（至少 `yyyy-MM-dd HH:mm:ss` 或同等精度），不能只显示日期加分钟片段。
- 有入账状态的记录必须用清晰标签展示，例如“待入账 / 已入账”；待入账金额颜色要与已入账区分，但仍保持可读。
- 推荐显示：类型、金额、完整时间、状态、贡献会员/交易对象、业务资产短码（如卡号/券码）和必要的标题。
- 不要在移动端直接显示内部 `RelOrderId`、服务费订单号、数据库 Id、调试来源操作、规则比例说明等后台字段，除非页面是面向运维的后台工具。
- 后端接口应先把 `TypeLabel`、`SettleStatusLabel`、`DisplayTime`、`ContributorName`、`CardNo` 等字段整理好，前端只做轻展示，避免多个页面各自拼接导致重复或口径不一致。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-uniapp-frontend-016 sha256=ef64ab9e559d2d0d29a125a0ba2d35296f6aebea0a898c86a6883f8987ad5a40 -->
## H5 在 PC 浏览器必须自动模拟移动端

移动端 UniApp H5 被 PC 浏览器访问时，不能按桌面宽屏铺满。必须在全局样式里用媒体查询生成手机预览壳。

基础要求：

- 桌面预览把内屏居中并限制到常见手机宽度，例如 `430px`；预览条件综合宽度、输入能力或项目运行时设备标记，不能仅按 `min-width:768px` 把手机横屏当桌面。下面媒体查询是精细指针桌面示例，项目还需验证移动设备仿真和真实设备判断。
- `html, body` 使用克制的桌面背景，`uni-app` 内保持移动端页面本身背景。
- 如果项目或主题给 `body.theme-light`、`body.theme-dark` 写了背景色，PC 媒体查询必须显式覆盖，避免手机壳外侧仍显示暗色或项目内装饰背景。
- 同步约束页面壳及 `uni-page / uni-page-wrapper / uni-page-body` 中实际参与布局的包装层：`min-height:0; min-width:0`。头部和导航不收缩，剩余高度留给正文；不能把 `uni-page-body` 写成整屏高后再追加导航。
- 先确定导航是流内还是覆盖式。流内栏使用 `flex-shrink:0`，正文不加整栏占位；覆盖式栏的宽、高、底边和唯一占位由共享壳负责。原生 `uni-tabbar` 的平台占位存在时不能再叠自定义占位。
- 有桌面外边距或矮屏壳时，栏必须贴壳内屏底边，不是外窗 `bottom:0`。为覆盖式栏建立属于内屏的定位包含块，或根据其真实矩形定位；不要同时给原生 tabBar 外层和内层重复 `fixed`。
- `rpx` 按设备宽度计算，不自动跟随 CSS 手机壳宽度。`pages.json.globalStyle` 的最大换算宽度和基准宽度应与预览策略一致，例如 767/430；检查 768、960 和 4K 外窗的实际换算结果。全宽使用 `100%` 或 flex，不能用 `750rpx`。参见 [DCloud 宽屏适配](https://uniapp.dcloud.io/tutorial/adapt.html)。
- 页面内 `position: fixed` 的装饰背景（如 aurora、粒子、全屏渐变）在 PC 壳模式下必须收回到 `uni-app/uni-page-body` 内，不能覆盖整块桌面背景。

自定义流内导航参考结构（选择该模式后，不再并列渲染原生导航）：

```html
<main class="mci-h5-viewport" data-app-viewport>
  <header class="mci-preview-header">移动端预览</header>
  <section class="mci-page-scroll" data-page-scroll>页面内容</section>
  <nav class="mci-bottom-nav" data-bottom-nav>图标与菜单触摸区</nav>
</main>
```

参考样式：

```scss
html, body { margin: 0; height: 100%; overflow: hidden; }
.mci-h5-viewport {
  box-sizing: border-box;
  width: 100%; height: 100vh;
  height: var(--mci-visible-height, 100dvh);
  min-height: 0;
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--app-bg-base, #F7F8FB);
}
.mci-preview-header { display: none; flex-shrink: 0; }
.mci-page-scroll { flex: 1; min-height: 0; min-width: 0; overflow-y: auto; }
.mci-bottom-nav {
  flex-shrink: 0; box-sizing: border-box;
  padding-bottom: var(--mci-safe-bottom, env(safe-area-inset-bottom, 0px));
}
@media screen and (min-width: 768px) and (hover: hover) and (pointer: fine) {
  body { display: grid; place-items: center; background: #F3F5F9; }
  .mci-h5-viewport {
    --mci-safe-bottom: 0px; // 桌面预览没有手机系统手势区，不伪造安全区。
    width: 430px;
    height: calc(100vh - 32px); height: calc(100dvh - 32px);
    max-height: 900px;
    border-radius: 24px;
    box-shadow: 0 18px 54px rgba(28, 36, 52, .16);
  }
  .mci-preview-header { display: block; }
}
```

真实 UniApp 页面还应检查框架包装层高度和原生 tabBar 占位。这个结构示例不授权业务页覆盖所有 `uni-*` 标签，也不适用于必须使用文档滚动的页面；文档滚动模式必须另行证明根滚动是唯一 owner、导航跟随可见视口且尾部占位仅一份。

### 导航贴底与剩余空间的真实断言

H5 安全区必须来自 CSS `env(safe-area-inset-bottom)` 等浏览器权威来源。`screenHeight - windowHeight` 与 `screen.height - innerHeight` 包含外窗、工具栏和缩放差异，禁止转换为安全区 padding。App/小程序的权威 inset 可以为 `0`，只能在值缺失时按明确平台契约处理，不能用 `inset || guessedFallback` 将零替换。桌面非最大化窗口和缩放必须纳入验收，物理屏幕与视口不同也应保持导航内栏高度有界。

下列例子测量自定义流内导航；选择器按项目真实结构替换，目标边界必须是**内屏**而不是带边框的装饰壳。设计值在测试开始前固定，不能根据异常画面扩大阈值：

```js
const geometry = await page.evaluate(() => {
  const rect = node => {
    const r = node.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
  };
  const screen = document.querySelector('[data-app-viewport]');
  const nav = document.querySelector('[data-bottom-nav]');
  const scroll = document.querySelector('[data-page-scroll]');
  if (!screen || !nav || !scroll) throw new Error('页面结构缺失');
  const items = [...nav.querySelectorAll('[data-nav-item]')];
  if (!items.length) throw new Error('导航菜单缺失');
  return {
    screen: rect(screen), nav: rect(nav), scroll: rect(scroll), items: items.map(rect),
    safeBottom: parseFloat(getComputedStyle(nav).paddingBottom) || 0,
    rootOverflow: document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight
  };
});
expect(Math.abs(geometry.nav.bottom - geometry.screen.bottom)).toBeLessThanOrEqual(2);
expect(geometry.nav.left).toBeGreaterThanOrEqual(geometry.screen.left - 2);
expect(geometry.nav.right).toBeLessThanOrEqual(geometry.screen.right + 2);
expect(geometry.scroll.bottom).toBeLessThanOrEqual(geometry.nav.top + 2);
expect(geometry.rootOverflow).toBeLessThanOrEqual(2);
expect(geometry.nav.height).toBeLessThanOrEqual(designNavContentHeight + geometry.safeBottom + 2);
const lastItemBottom = Math.max(...geometry.items.map(item => item.bottom));
expect(geometry.nav.bottom - lastItemBottom)
  .toBeLessThanOrEqual(geometry.safeBottom + designNavInnerBottomGap + 2);
await page.screenshot({ path: screenshotPath, fullPage: false });
```

`safeBottom` 在此示例是 CSS 计算结果，不代表系统安全区来源已经可信。测试仍须核对运行时安全值、同一个值的唯一消费位置和桌面为零；不能用一个错误的巨大 padding 放宽几何门禁。短内容允许正文留白，禁止的是**导航下方**无业务依据的大块剩余区域。

| 场景 | 必须断言 |
|---|---|
| 三个主 Tab、短内容/空态 | 导航底边贴内屏，内栏高度有界，图标文字可见且触摸区可点 |
| 长内容滚动中/到底、切回 Tab | 导航位置不漂移，最后一项可达且未遮挡，壳外根滚动不变化 |
| 桌面 1024×600 / 1366×768 / 1920×1080 / 4K | 内屏在视口内，导航贴壳底；rpx 不随外窗放大，正文只有一个 owner |
| 手机 375×812 / 430×932、767/768 断点、横屏与旋转 | 移动模式去壳，内屏铺满可见区域；旋转后重测安全区和底边 |
| 键盘打开/关闭、浏览器栏展开/收起 | 焦点与操作可见，关闭后恢复底边，无残留占位或第二条滚动条 |

H5 键盘可能改变 visual viewport 而不改变 layout viewport；`100dvh` 不是所有键盘模式的保证。共享壳按目标浏览器处理 `visualViewport` 尺寸/偏移与 resize/恢复，原生端按配置的键盘模式测量；真机 iOS/Android 另验。缩小 Playwright 视口只证明 resize 分支，不等于软键盘实测。参考 [W3C Viewport 交互部件规则](https://www.w3.org/TR/css-viewport-1/#interactive-widget-section)。

<!-- /microi-progressive:chunk -->
