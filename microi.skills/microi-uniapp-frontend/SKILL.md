---
name: microi-uniapp-frontend
description: Microi 吾码 UniApp/H5 前端通用规范。用于构建或修复任何 Microi uni-app/移动端 H5 项目，覆盖上传资源渲染、头像、骨架屏、移动安全区、tabBar、固定底栏和明确业务素材选择。
---

# Microi UniApp 前端通用规范

本 Skill 适用于任何 Microi 吾码 UniApp/H5 项目，包括商城、OA、ERP、MES、CRM、互联网项目、预约项目等。不要把规则写成某一个业务应用专属规范。

## 移动端质量门禁必须先读

创建、重构或修复任何 Microi 移动端项目前，必须同时应用 `microi.skills/microi-mobile-app-quality/SKILL.md`。该 Skill 中的底部导航真实图标、重要按钮图标化、登录 API 校验、微信手机号快捷登录、后台二级菜单和页面动效要求，属于交付验收条件，不是可选优化。

## 登录页与手机号快捷登录

- 登录页必须是直接登录面，不要默认做“员工登录 / 客户登录”身份 Tab 切换，除非用户明确要求。默认展示系统账号密码登录，同时提供客户手机号快捷登录入口。
- 账号密码登录必须先检查项目本地 SDK 实际导出，常见是 `V8.Login(param)` 或 `/api/SysUser/Login`。禁止凭空写 `V8.Login.Login(...)` 这类未验证子对象。
- 登录、接口引擎、FormEngine、上传等所有请求头必须做大小写不敏感去重；`osclient` 只能发送一个规范值，例如 `lxwb`，禁止同时传 `OsClient` 与 `osclient` 导致网络面板出现 `lxwb, lxwb`。
- 账号密码登录只有在同时拿到成功码、有效 token 和有效用户 `Id` 时才算成功。Microi 登录 token 可能在响应头 `authorization`，用户信息可能在响应体 `Data`；两者任一缺失都要清理 SDK token、本地用户缓存和 session。
- 恢复本地会话时必须重新校验 token 和用户 `Id`，禁止出现页面显示 `admin` 但状态仍是“未登录”的半登录状态。
- 账号密码登录调用 `/api/SysUser/login`、`/api/SysUser/Login` 或 `V8.Login(param)` 前，必须读取 `/api/DiyTable/GetSysConfig` 或 `V8.GetSysConfig(true)`，并根据 `Sys_Config.EnableCaptcha` 决定是否显示图形验证码。判断函数必须兼容 `1`、`true`、`'1'`、`'true'`，不要直接 `!!cfg.EnableCaptcha`。
- 开启验证码时，页面必须通过 `GET /api/Captcha/GetCaptcha` 获取验证码图片，读取响应头 `captchaid`，提交账号登录时传 `_CaptchaId` 和 `_CaptchaValue`；登录失败后清空输入并刷新验证码。未开启验证码时不显示验证码，不传空验证码字段。
- 微信小程序手机号快捷登录必须使用 `<button open-type="getPhoneNumber">`，通过 `@getphonenumber` 获取 `detail.code`，并重新调用 `uni.login({ provider:'weixin' })` 获取新的 `LoginCode`。前端不能假设能直接拿到手机号明文。
- H5/App 可提供手机号输入兜底，但必须确认后端接口支持 `Phone` 登录；微信小程序优先走 `Code + LoginCode`。
- 登录按钮、去登录按钮、手机号授权按钮必须是图标 + 文案按钮，具备 loading、disabled/pressed 反馈，且原生 button 默认边框要清掉。

## 首屏 Hero 与浮动面板验收

- 移动端首屏 Hero 标题必须按真实中文文案调字号和行高，不能为了“震撼”把业务入口标题做得过大，导致一行半、孤字换行或压住按钮。
- Hero 下方如果有浮动快捷入口面板，必须给 Hero 底部预留按钮安全区，并控制面板负 margin；面板只能覆盖装饰留白，不能盖住“立即登录 / 查看报告 / 提交”等主按钮的圆角、阴影或点击区域。
- 交付前至少检查 375px 与 430px 宽度首屏截图，确认标题、主按钮、次按钮、浮动面板、第二块内容没有重叠、裁切或不美观换行。

## 资源 URL 必须集中解析

数据库中的图片、附件、头像、Logo、卡面图、单据图片等字段常见保存形式：

- 绝对地址：`https://...`
- API 本地文件路由：`/file/...`
- 对象存储相对路径：`/tenant/module/file.jpg` 或 `tenant/module/file.jpg`
- 上传组件 JSON：`[{"Path":"..."}]`、`{"Path":"..."}`、`{"FilePathName":"..."}`，也可能已经是对象/数组而不是字符串
- 历史脏数据或第三方占位图

页面模板不能直接写 `<image :src="row.Avatar">`、`<image :src="row.MainImg">`。必须在项目的 API/资源工具模块里提供统一解析函数，例如 `resolveAssetUrl`、`sanitizeAssetUrl`、`resolveFileUrl`、`resolveAvatarUrl`，并让页面只绑定已经归一化后的最终 URL。

资源解析函数必须先按 `microi.skills/v8-file-upload/SKILL.md` 的 `normalizeUploadValue` 思路处理 `ImgUpload` / `FileUpload` 字段：空值、`正在上传中...`、旧字符串路径、JSON 字符串对象、JSON 字符串数组、运行时对象、运行时数组都要兼容；取出 `Path` 后再进入 FileServer/API/私有签名 URL 逻辑。

推荐规则：

- `http(s)://`、`data:`、`blob:` 原样返回。
- `/file/...` 走 API 服务。
- `/tenant/...`、`tenant/...` 等对象存储路径走 `V8.SysConfig.FileServer` 对应的文件服务器/CDN。
- 私有文件使用后端签名 URL，例如 `V8.Method.GetPrivateFileUrl({ FilePathName })`，失败时再回退到公开文件服务器路径。
- 第三方占位图、已失效临时地址、空字符串统一清理为空，交给 UI 占位态。

## 头像必须异步统一解析

头像字段比普通图片更容易混合出现上传 JSON、私有路径、相对路径、历史字段名和脏数据。列表页、详情页、业务记录、审批记录、团队/会员卡片、聊天/消息等头像场景都必须走同一个头像解析入口。

正确模式：

```js
const rawAvatar = row.OwnerAvatar || row.UserAvatar || row.Avatar || member.Avatar || '';
row.OwnerAvatarUrl = await resolveAvatarUrl(rawAvatar);
```

模板只绑定最终字段：

```vue
<image v-if="row.OwnerAvatarUrl" :src="row.OwnerAvatarUrl" mode="aspectFill" />
```

禁止在模板中临时拼接文件服务器，禁止每个页面各写一套头像解析，禁止只在能查到关联用户时才解析接口已经返回的头像字段。

## 移动端富文本图文排版

商品详情、公告详情、活动说明、文章正文、协议说明等富文本在移动端渲染时，图片和文字不能使用同一套留白规则。

- 主图、详情长图、海报图可以 `width:100%` / `display:block` 满宽展示，不额外加左右 padding，避免图片显得缩小或边缘参差。
- 文字内容必须有独立容器，设置 `padding: 16px 18px`（或项目设计体系中的等价间距）、`box-sizing:border-box`、稳定 `line-height`，不能让标题、段落贴着卡片或屏幕边缘。
- 富文本生成器输出 HTML 时，推荐结构是“图片块 + 文本块”：图片块只包图片，文本块包标题、段落、规格说明、温馨提示。
- 段落使用 `margin:0 0 6px` 或相近节奏，最后一段可以去掉底部 margin；不要靠 `<br>` 堆间距。
- 移动端截图验收必须看文字是否贴边、是否横向溢出、是否被底部固定按钮遮挡。

参考结构：

```html
<section class="mci-rich-detail" style="background:#fff;overflow:hidden;">
  <p style="margin:0;text-align:center;">
    <img src="..." style="display:block;width:100%;max-width:100%;height:auto;" />
  </p>
  <div style="padding:16px 18px 18px;box-sizing:border-box;line-height:1.7;color:#1f2937;font-size:15px;">
    <h2 style="margin:0 0 10px;font-size:22px;line-height:1.28;">商品标题</h2>
    <p style="margin:0 0 6px;">所属专区：精选专区</p>
    <p style="margin:0;">商品图片与规格信息以实际维护为准。</p>
  </div>
</section>
```

## 移动端分类/双栏列表独立滚动

商品分类、知识库分类、通讯录分组、资产分类等“左侧分类 + 右侧列表”的移动端页面，根节点必须固定在一个视口内，不能让整页和内部列表同时滚动。

- 根页面使用 `height:100vh; overflow:hidden; display:flex; flex-direction:column;`。
- 分类主体使用 `flex:1; min-height:0; display:flex;`，并给底部 tabBar 预留 `padding-bottom: calc(tabBarHeight + env(safe-area-inset-bottom));`。
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
.page-category { height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
.cat-body { flex: 1; min-height: 0; display: flex; padding-bottom: calc(104rpx + env(safe-area-inset-bottom)); }
.cat-side { width: 176rpx; height: 100%; }
.cat-content { flex: 1; min-width: 0; height: 100%; }
```

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

## 移动端安全区必须兼容 iOS 与 Android

任何 UniApp/H5 移动端页面都必须同时适配 iPhone 刘海屏/Dynamic Island/Home Indicator、Android 状态栏/虚拟导航栏/手势条、微信/浏览器/WebView 容器差异。不要用固定 `20px/44px/64px` 直接硬编码顶部或底部间距。

- `manifest.json` / H5 模板必须确保 viewport 含 `viewport-fit=cover`，否则 iOS 的 `env(safe-area-inset-*)` 不会完整生效。
- 页面根节点使用 `min-height:100vh` 或固定视口布局时，顶部内容、底部固定栏和内部滚动容器必须一起考虑安全区，不能只给根节点加 padding。
- 顶部自定义导航栏应结合 `uni.getSystemInfoSync().statusBarHeight` 和 CSS `env(safe-area-inset-top)`：状态栏占位负责不同系统高度，导航按钮和标题整体下移，返回按钮触摸区不能压到刘海/状态栏。
- 底部 `tabBar`、购买栏、提交栏、批量操作栏等 fixed 元素必须使用 `padding-bottom: env(safe-area-inset-bottom)`，主体内容必须额外预留底部高度，避免最后一条数据被按钮或 tabBar 遮挡。
- 双栏分类页、聊天页、详情页带底部按钮时，内部 `scroll-view` 要用 `flex:1; min-height:0` 承载滚动，并在滚动容器底部预留 `calc(fixedBarHeight + env(safe-area-inset-bottom))`。
- H5 在 PC 手机壳模式下，fixed 顶栏/底栏仍要限制在手机壳宽度内；不能铺满整个桌面浏览器。
- 验收必须至少覆盖一个 iPhone 刘海/灵动岛尺寸、一个 Android 高状态栏或虚拟导航栏尺寸、一个 PC H5 手机壳尺寸，截图检查顶部不被遮挡、底部按钮不贴边、列表最后一项可见。

参考样式：

```scss
.page-mobile {
  min-height: 100vh;
  padding-bottom: calc(112rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.mci-navbar {
  padding-top: env(safe-area-inset-top);
}
.bottom-bar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
}
```

## 列表型资料页必须提供完整管理动作

地址、联系人、收款方式、发票抬头、车辆、设备、证照、银行卡等用户维护型资料页，不能只展示简略列表。除非业务明确只读，移动端必须提供：

- 查看完整信息：点击卡片或“详情”打开详情页/弹层，显示列表里省略的所有关键字段。
- 新增和编辑：新增与编辑可以复用同一表单，编辑时要带 Id 并回填现有值。
- 删除：必须有二次确认，并校验当前用户只能删除自己的资料；删除成功后刷新列表。
- 默认/启用类状态：同一用户只允许一个默认值时，后端保存接口要负责互斥清理，前端不能只改本地 UI。
- 权限与接口：后端接口必须用 token/当前用户校验所有权，不能信任前端传来的 MemberId/UserId。
- 跨会员但属于当前业务流程可见的数据（例如订单买家查看卖家收款方式、交易双方资料、售后处理信息）必须由订单/售后等业务 ApiEngine 在完成订单参与者权限校验后返回；前端不能用通用 `formEngineGet` 直接查对方会员表数据，因为移动端通用查询通常会自动追加当前会员隔离条件。
- 空态行动：没有数据时给出新增入口，但仍要遵守上面的加载态规则。

## 移动端资产/奖励流水展示

收益明细、积分明细、奖励明细、充值记录、订单流水等页面要面向用户展示“发生了什么”和“是否到账”，不要直接暴露后台调试字段。

- 每条记录必须显示完整时间（至少 `yyyy-MM-dd HH:mm:ss` 或同等精度），不能只显示日期加分钟片段。
- 有入账状态的记录必须用清晰标签展示，例如“待入账 / 已入账”；待入账金额颜色要与已入账区分，但仍保持可读。
- 推荐显示：类型、金额、完整时间、状态、贡献会员/交易对象、业务资产短码（如卡号/券码）和必要的标题。
- 不要在移动端直接显示内部 `RelOrderId`、服务费订单号、数据库 Id、调试来源操作、规则比例说明等后台字段，除非页面是面向运维的后台工具。
- 后端接口应先把 `TypeLabel`、`SettleStatusLabel`、`DisplayTime`、`ContributorName`、`CardNo` 等字段整理好，前端只做轻展示，避免多个页面各自拼接导致重复或口径不一致。

## H5 在 PC 浏览器必须自动模拟移动端

移动端 UniApp H5 被 PC 浏览器访问时，不能按桌面宽屏铺满。必须在全局样式里用媒体查询生成手机预览壳。

基础要求：

- `@media screen and (min-width: 768px)` 下把 `uni-app` 居中并限制到常见手机宽度，例如 `430px`。
- `html, body` 使用克制的桌面背景，`uni-app` 内保持移动端页面本身背景。
- 如果项目或主题给 `body.theme-light`、`body.theme-dark` 写了背景色，PC 媒体查询必须显式覆盖，避免手机壳外侧仍显示暗色或项目内装饰背景。
- 同步约束 `uni-page`、`uni-page-wrapper`、`uni-page-body` 的宽度。
- `uni-page-body` 给底部菜单和安全区预留 padding，避免内容或底部操作栏压住 tabBar。
- 所有 `position: fixed` 底部操作栏按同一手机壳宽度居中。
- 原生 `uni-tabbar` 和 `.uni-tabbar` 必须显式设置 `position: fixed`、`bottom: 0`、同宽居中和足够的 `z-index`，否则主体像手机壳但底部菜单可能丢失或铺满 PC 宽屏。
- 页面内 `position: fixed` 的装饰背景（如 aurora、粒子、全屏渐变）在 PC 壳模式下必须收回到 `uni-app/uni-page-body` 内，不能覆盖整块桌面背景。

参考样式：

```scss
@media screen and (min-width: 768px) {
  html,
  body {
    min-height: 100%;
    background:
      linear-gradient(135deg, rgba(255,255,255,.78), rgba(244,246,250,.92) 44%, rgba(236,239,245,.98)),
      radial-gradient(circle at 18% 16%, rgba(181,18,32,.07), transparent 32%),
      radial-gradient(circle at 84% 10%, rgba(216,162,58,.08), transparent 28%),
      #F3F5F9;
  }

  body { margin: 0; }

  uni-app {
    position: relative;
    display: block;
    width: min(430px, 100vw);
    min-height: 100vh;
    margin: 0 auto;
    overflow-x: hidden;
    background: var(--app-bg-base, #F7F8FB);
    box-shadow: 0 18px 54px rgba(28, 36, 52, .16);
  }

  uni-page,
  uni-page-wrapper,
  uni-page-body {
    width: 100% !important;
    max-width: 430px;
    margin: 0 auto;
  }

  uni-page-body {
    padding-bottom: calc(64px + env(safe-area-inset-bottom));
  }

  .bottom-bar {
    left: 50% !important;
    right: auto !important;
    width: calc(min(430px, 100vw) - 24px);
    transform: translateX(-50%);
  }

  uni-tabbar,
  uni-tabbar .uni-tabbar {
    position: fixed !important;
    left: 50% !important;
    right: auto !important;
    bottom: 0 !important;
    width: min(430px, 100vw) !important;
    transform: translateX(-50%);
    z-index: 99 !important;
  }
}
```

## 关键业务资产不得默认选中

凡是会扣减、消耗、转移、提交审批或触发财务后果的业务资产，都不能默认选中第一条。例如资产卡、余额账户、积分账户、优惠券、库存批次、付款账户、审批对象、设备工单等。

必须满足：

- 页面清楚提示需要手动选择。
- 用户主动点选后，提交按钮才可用。
- 已选资产刷新后失效时清空选择，不能自动换成第一条。
- 规则同时写在 UI 状态和提交前校验中。

## 账号角色与会话状态

- Microi 企业移动端默认要从 `sys_user.RoleIds`、`_Roles`、`Roles`、`RoleName`、`Level` 解析内部账号角色，不要只用“是否登录”控制界面。
- 角色能力必须集中在 Pinia/session store 中计算，例如 `isTechnician`、`isServiceAgent`、`isCustomerAccount`、`canAcceptOrders`、`canManageCustomers`、`canViewReports`。多角色账号取能力并集，`Level>=999` 或“超级管理员”给全权限。
- 客户账号判断要精确，只把“客户”“客户账号”“客户用户”或明确包含“客户账号”的角色当作客户侧账号；不要把“客户管理”等后台角色误判为客户。
- 所有页面、底部导航、按钮、未登录提示、头像姓名和角色文本都必须读同一个 session store。页面不能直接读取旧 storage 展示用户名。
- 客户小程序手机号登录得到的是业务 `CustomerToken`，与员工 `sys_user` token 是两条会话；客户数据必须通过绑定关系过滤，不要把客户账号塞进员工接口绕过权限。
- 登出、登录失败、token 缺失、用户 `Id` 缺失时要统一清理 `Token`、`staffUser/customerUser`、绑定信息和本地 session。

## 数字、主题、上传与消息

- 资产金额、积分、余额、库存值、累计充值、收益等数字要按空间自适应格式化。金额很大时显示为 `1.23万`、`123万`、`1.2亿` 等，不能撑破卡片。
- 主题切换必须全局生效：`html/body/page/uni-page-body` 与每个页面根节点都要能继承主题变量，不能只在“我的”一个页面生效。
- 自定义底部导航、固定提交栏、悬浮操作条等 fixed 组件在 H5 中优先使用 `--mci-*` 主题变量并继承 `html/body` 的主题状态，不要为了换主题让 fixed 组件自己订阅 theme store 后动态切换根 class。小程序端可以绑定稳定主题 class，但 H5 路由切换期间不要改 Vue/uni 托管根节点结构。
- H5 主题服务只允许修改 `html`、`body` 的 `data-*` 属性、主题 class 和 CSS 变量。不要用 `querySelectorAll('.mci-page')`、`MutationObserver`、定时扫描或手动补 class 去改 `.mci-page`、`uni-page-body`、`uni-page`、`RouterView` 下的节点；否则切主题后点击导航容易出现 `Cannot assign to read only property '_'`、`Cannot read properties of null (reading 'type')`、`parentNode`、`scheduler flush` 等错误。
- 彩色圆形快捷入口必须显式设置内部图标色。主题切换时要同时覆盖 `background` 与 `color`，尤其要检查 `.mci-bubble:nth-child(n)`、`.entry:nth-child(n)` 等高优先级基础样式，避免绿色圆底配绿色图标、灰色圆底配低对比图标。
- 如果项目有 H5 自动翻译/MutationObserver 兜底，中文模式下不得把文本节点或属性恢复为旧的 `originalText`；中文模式只刷新原文缓存并退出，英文模式才写入翻译文本。否则异步接口把状态从“未认证”改为“认证已通过”后，自动翻译可能把 DOM 又改回旧状态。
- iOS Safari 上传图片后必须验证表单其它字段不丢失；上传组件只更新文件字段，不得重置整张表单对象。
- 消息、待办、审批、约单、审核类入口必须支持未读角标；已读后角标消失。
- 会员头像、买家/卖家头像、审批人头像、团队成员头像都走 `resolveAvatarUrl`，列表页和详情页必须显示一致。
- 私有图片、身份证照片、支付凭证等禁止匿名访问的文件，前端必须先换取临时 URL；不能直接把私有路径给 `<image>`。

## 图片上传必须支持替换与预览

头像、支付凭证、实名认证、收款码、证照、商品图、富文本图片等移动端图片上传场景，选择图片后不能把入口锁死。所有上传入口必须统一做到：

- 已选择或已上传图片点击后可全屏预览，并能关闭返回原页面。
- 提交前可重新选择图片并替换上一张；替换时只更新当前图片字段，不重置整张表单。
- 图片卡片要有清晰操作层，例如“预览 / 重新上传”或图标按钮；预览点击与重新上传点击不能互相冒泡。
- 上传中、上传失败、可重试、已上传、本地待上传状态要分开；失败必须 toast 并恢复按钮。
- 所有上传入口使用项目统一 `uploadFile` / `V8.uploadFile`，保留 H5 `File/Blob` 对象，遵守上传路径与 Header 规范。
- 修改一个上传入口时，必须用 `rg "chooseImage|uploadFile|uni.uploadFile|previewImage|preview"` 扫描全项目同类入口，统一补齐替换与预览。
- 自动化或手工验收至少覆盖支付凭证、头像/实名认证/收款码中一个私有图场景，确认可替换、可预览、不会丢表单字段。

## 组件复用与页面去重

同一类 UniApp/H5 UI 在两个及以上页面出现时，必须抽成 `Mci*` 或项目级 `mci-*` 组件，不要复制模板和 scoped 样式到多个业务页面。常见必须复用的结构包括：未登录/授权提示、空态、错误态、骨架屏、列表卡片、商品卡、消息卡、筛选栏、Tab、底部操作栏、按钮组、头像/角标。

- 组件通过 props/slots/events 配置标题、说明、图标、按钮文案、按钮动作、路由、loading/empty/error 状态和少量视觉变体。
- 业务页只保留业务数据和事件处理；按钮居中、圆角、阴影、主题 token、安全区、按压态、暗色模式等视觉规则必须收口在组件内。
- 未登录/授权提示组件必须在页面可用内容区上下左右居中。若页面有 header/hero 和底部 tabBar，业务页要给组件外层加 `flex:1` 居中 wrapper，不能让组件贴在 header 下方。
- 如果修复一个页面的重复 UI 问题，必须搜索同类页面并一起替换，避免 message 修了、workspace 仍保留旧实现。
- 新增页面前先用 `rg` 搜索现有组件和相邻页面；发现相似代码块时优先复用或抽取组件，而不是继续复制。
- 对复用组件补充自动化检查：静态检查至少确认业务页使用同一个组件；视觉检查至少覆盖两个不同业务页实例。

## 验收要求

每次改动 UniApp/H5 前端后，至少做以下验证：

- 运行项目可用的窄范围诊断或构建命令。
- 用户要求“全自动化测试”“自动化验收”“跑完整测试”等时，若涉及 UI/前端改动，必须把截图验证或视觉断言接入自动化链路。仅运行构建、lint、静态检查不能代表 UI 已通过全自动化测试。
- 动态数据页面首屏必须截图确认显示骨架屏；接口结束后再显示数据或空态，不能闪现“暂无数据”。
- 至少用 iOS 刘海/灵动岛尺寸、Android 状态栏/虚拟导航栏尺寸、PC H5 手机壳尺寸检查安全区。
- PC 宽屏访问 H5，截图确认页面在手机壳内、底部 tabBar 可见、固定底栏没有铺满桌面。
- 对关键图片和头像页面截图，确认显示真实图片而不是空白、首字母占位或失效图。
- 对每个主题至少截图首页快捷入口和底部导航，确认选中态、未选中态、图标圆底和内部图标都已经随主题变化，并且对比度清晰。
- 对关键业务资产选择流程，验证首次进入不自动选中，刷新后无效选择会被清空。
- 截图复核 PC 手机壳、顶部安全区、底部安全区、底部 tabBar、主题背景、关键头像、私有图片、金额显示、未读角标、空态/未登录态和关键按钮文字上下左右居中。按钮文字偏上、偏下、偏左、偏右都算验收失败。
- 未登录/未授权态必须额外截图确认：提示卡片位于 header 与 tabBar/底栏之间的可用区域中心，不能只横向居中但纵向贴顶。

## Microi 前端 SDK 必须接入

任何 Microi UniApp/H5 Vue3 项目都必须优先使用 `microi.skills/microi.v8.js` 作为统一前端 SDK，并参考 `microi.skills/microi-frontend-sdk/SKILL.md`。新项目不得再手写分散的 `uni.request`、Token 存储、上传、私有文件 URL、头像解析、`ApiEngine` 或 `FormEngine` 包装。

- 项目内落地位置默认是 `src/utils/microi.v8.js`。
- 项目请求层只创建一个已配置的 `V8 = createMicroiV8({...})` 实例，并导出稳定的业务包装函数，例如 `callEngine`、`formEngineGet`、`uploadFile`、`sanitizeAssetUrl`。
- 项目请求层不得手写重复租户请求头；统一委托 SDK。最终网络请求头只允许一个小写 `osclient` 值，不能同时出现 `OsClient` / `osclient` 或 `Authorization` / `authorization` 大小写重复。
- `main.js` / `main.ts` 必须执行 `V8.install(app)`，让组件可通过 `$V8` / `$Microi` 使用统一 SDK。
- 已有页面导出的老函数名可以保留，但内部必须委托 SDK，不能继续复制请求、Token、上传和资源解析逻辑。
- SDK 不绑定任何 UI 库；页面 UI 仍遵守本 Skill 的骨架屏、安全区、移动端富文本和资源展示规范。

## MCI-UI Mobile 必须优先使用

新的 Microi UniApp/H5 Vue3 项目必须默认基于 `Microi.UI/src/uniapp` 建立页面基础组件，至少包括页面壳、导航栏、按钮、卡片、分段标签、指标卡、底部安全区操作栏、头像、商品卡、骨架屏、数据状态、富文本。用户未主动指定 UI 风格时，AI 必须自动采用 Microi吾码UI。项目可以使用 `uni-ui`、`uView`、`FirstUI` 等第三方组件，但应封装在 MCI-UI 或项目级 `mci-*` 组件后面，不要让业务页面直接散落多套视觉风格。

推荐接入顺序：

1. 拷贝或 alias `Microi.UI/src/theme` 与 `Microi.UI/src/uniapp` 到项目内。
2. 在 `main.js` 中 `app.use(MciUI)`，全局注册基础组件。
3. 分类、资产、订单、表单、筛选、上传、流程、时间线、商城、会员中心等常见页面优先使用 `MciTabs`、`MciMetricCard`、`MciAssetCard`、`MciActionBar`、`MciAvatar`、`MciProductCard`、`MciFormField`、`MciFilterBar`、`MciOrderCard`、`MciModal`、`MciUploader`、`MciTimeline`、`MciSteps`，避免重复写局部风格。
4. 动态数据页使用 `MciDataState`，首屏 loading 必须渲染 `MciSkeleton`。
5. 商品详情、公告、协议等富文本使用 `MciRichText` 或遵循同等结构。

## 登录、图标与主题补充规范

- 登录页不要同时铺开两套完整登录系统。H5/App 默认只做一个“账号/手机号 + 密码”表单；微信小程序默认展示 `<button open-type="getPhoneNumber">` 手机号授权登录，账号密码只能作为次级折叠/备用入口。
- 微信小程序手机号授权登录必须使用 `@getphonenumber` 的 `detail.code`，并重新调用 `uni.login({ provider:'weixin' })` 获取新的 `LoginCode`；不要假设前端能拿到手机号明文。
- 账号密码兜底入口必须跟随 `Sys_Config.EnableCaptcha`：开启时显示验证码图片和输入框，提交 `_CaptchaId/_CaptchaValue`；关闭时完全隐藏且不提交空字段。
- 登录页、我的页、设置页不要向终端用户展示“当前租户 / OsClient / 移动端版本 / API 地址 / 调试版本”等内部实现块。
- “当前租户、移动端版本、主题、账号、关于、绑定客户”等信息项如果确实要展示，图标必须是真实图标或 `mci-icon-*` 图形；禁止用 `租`、`版`、`客` 这类单字当图标。
- 客户要求新增视觉风格时，优先把已验收风格保留为命名主题，再新增客户偏好主题；除非用户明确要求删除旧主题。
- 产品有指定默认主题时，theme store 的 `DEFAULT_THEME` 必须与该主题一致；但用户切换过主题后，本地持久化选择优先生效，不能每次启动又强制回默认。
- 主题切换必须能在未登录状态使用，并持久化到本地存储；切换后要覆盖每个页面根节点、底部导航、按钮、卡片、空态、骨架屏、表单、H5 PC 手机壳背景。
- “我的/设置”页不要把所有主题选项直接铺在主页面。默认展示当前主题和“切换主题”按钮，点击后用底部弹层或模态层选择主题。
- 小程序端不能只依赖 `document.documentElement` 切主题；每个页面根节点必须有主题 class、主题变量或项目级主题 store，确保跨页面和重启后生效。
- H5 端主题切换后必须继续验证底部导航。若切换主题后点击导航出现 `parentNode`、`scheduler flush`、`updateSlots`、`read only property '_'`、`null (reading 'type')` 等 Vue/uni-app 路由补丁错误，不能交付；改用稳定页面 class + `html/body` 主题属性/变量驱动，停止 DOM 观察或延迟补 class，并给底部导航加当前页 no-op、重复点击防抖和短延迟跳转。
- scoped CSS 中的硬编码颜色必须补主题覆盖，或改为 `--mci-*` 变量。验收时至少切换主题后检查首页、登录页、列表页、详情页、表单页和我的页。
- 主题验收必须遍历 `pages.json` 的所有页面，在每个主题下做截图或视觉断言，重点检查“我的”快捷入口、报告卡片、报告详情、骨架屏、加载过渡、空态、按钮、底部导航、弹层文字是否高对比可读。报告详情要单独检查封面英文标识（如 `INSPECTION REPORT`）、状态胶囊、印章/水印、摘要卡和正文。
- 列表进入详情必须保持身份路径：员工列表点报告详情走员工 token/FormEngine 权限，客户列表点报告详情走 CustomerToken，分享链接走 ShareToken；禁止员工点击可见报告后因为传空 CustomerToken 被跳回登录。

## UniApp 上传路径与 Header 规则

任何移动端图片、头像、身份认证、付款凭证、富文本图片、收款码上传，都必须走项目统一的 `uploadFile` 包装，并最终委托 `microi.v8.js` 的 `V8.uploadFile`。页面里不得直接调用 `/api/HDFS/UniappUpload`，不得临时手写 `uni.uploadFile`。

- `uni.uploadFile` / `fetch(FormData)` 必须使用上传专用 header，严禁携带 `Content-Type: application/json`。multipart 的 boundary 应由运行时自动生成。
- 上传 `Path` 必须是后端允许的安全相对路径，例如 `mall/pay-proof`、`mall/member/avatar`、`module/business-scene`。
- 禁止上传路径写成 `/mall/pay-proof`、`https://...`、`C:\...`、`../x`、`mall//x`、`~xxx`，也不要把本地临时文件路径当作 HDFS `Path`。
- SDK 必须统一归一化 `options.path`、`formData.Path`、`formData.path`，并且不允许业务页通过 `formData` 把 `Path` 覆盖成非法值。
- 项目级 `uploadFile(filePath, options)` 只能做默认路径和业务语义包装，必须透传 `{ ...options }`，不能丢掉 `headers`、`action`、`anonymous`、`file`、`formData`、`silentError` 等 SDK 选项。
- H5 页面从 `uni.chooseImage` 得到 `tempFiles[0].file` 时必须保留下来；如果只拿到 `tempFiles[0]` 或 `blob:` / `data:` 临时路径，也要传给 SDK，不得只保存字符串后丢弃文件对象。上传时传 `file` 并设置 `preferFetch:true`，让线上浏览器优先走标准 `fetch + FormData`。SDK 必须识别 `File` / `Blob`、`file/raw/blob/originFileObj` 等嵌套字段以及 `blob:` / `data:` 临时路径，不能只依赖 `uni.uploadFile`，否则生产 H5 可能出现 `未找到 MicroiV8 上传适配器。`。
- 上传、提交、支付、凭证、认证等关键按钮严禁空 `catch`。失败必须 `toast` 展示 `Msg/message`，同时 `console.error` 记录，并在 `finally` 还原 loading/uploading 状态，不能让用户感觉点击后没有任何反应。
- 修改上传相关逻辑后，必须用 `rg "uploadFile\\(|uni.uploadFile|UniappUpload"` 检查所有上传入口，至少验证付款凭证、头像/证件/收款码等一个私有图场景。

如果接口返回“移动端文件上传路径不合法！”，优先检查实际 multipart formData 里是否存在合法 `Path`，以及请求 header 是否错误设置了 JSON Content-Type；不要只看页面代码里传入的 `path` 字面量。
