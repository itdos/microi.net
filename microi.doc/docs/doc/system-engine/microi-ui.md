# 吾码UI（Microi.UI / MCI-UI）

<div class="mci-ui-doc">
  <section class="mci-ui-hero">
    <div class="mci-ui-hero__copy">
      <span class="mci-ui-kicker">Microi Design System</span>
      <h2>让每一个吾码前端项目，都有统一、先进、可持续的视觉底座。</h2>
      <p>
        吾码UI（Microi.UI / MCI-UI）面向 Vue 3 PC 网站、响应式网站、移动端 H5、uni-app 项目，
        提供品牌 token、主题运行时、跨端基础组件、骨架屏、安全区、动效和 AI 生成规范。
      </p>
      <div class="mci-ui-hero__actions">
        <a href="#快速接入">快速接入</a>
        <a href="#组件预览">组件预览</a>
        <a href="#ai-开发规则">AI 开发规则</a>
      </div>
    </div>
    <div class="mci-ui-console" aria-label="吾码UI主题能力预览">
      <div class="mci-ui-console__bar">
        <i></i><i></i><i></i>
        <span>Microi.UI Runtime</span>
      </div>
      <div class="mci-ui-console__grid">
        <span class="is-red"></span>
        <span class="is-orange"></span>
        <span class="is-yellow"></span>
        <span class="is-green"></span>
        <span class="is-cyan"></span>
        <span class="is-blue"></span>
        <span class="is-purple"></span>
        <span class="is-black"></span>
        <span class="is-white"></span>
      </div>
      <div class="mci-ui-console__panel">
        <strong>light / dark</strong>
        <span>rounded / flat</span>
        <span>skeleton / safe-area / motion</span>
      </div>
    </div>
  </section>

  <section class="mci-ui-value-grid">
    <article>
      <span>01</span>
      <h3>统一品牌</h3>
      <p>通过 <code>--mci-*</code> token 收束颜色、阴影、圆角、间距、骨架屏和动效。</p>
    </article>
    <article>
      <span>02</span>
      <h3>AI 可复用</h3>
      <p>AI 不再临时写散装 CSS，而是默认使用 MCI-UI 组件与项目级 mci-* 封装。</p>
    </article>
    <article>
      <span>03</span>
      <h3>跨端一致</h3>
      <p>同一套主题能力覆盖 PC 网站、企业站、产品站、移动端商城和 uni-app。</p>
    </article>
    <article>
      <span>04</span>
      <h3>商业级扩展</h3>
      <p>第三方库继续负责复杂能力，最终视觉由吾码UI统一承载。</p>
    </article>
  </section>
</div>

## 设计系统定位

<section class="mci-ui-showcase mci-ui-showcase--why">
  <div class="mci-ui-showcase__copy">
    <span class="mci-ui-kicker">Why Microi.UI</span>
    <h3>吾码UI不是重复造组件，而是统一产品气质、AI产出和商业交付标准。</h3>
    <p>
      Microi.UI 主要服务官网、企业站、产品站、文档站、移动端应用、会员中心、活动页、独立 Web 应用等非后台管理系统场景。
      PC 后台管理系统仍然以 Element Plus 为主，但主题变量、骨架屏、动效密度和品牌识别也应该逐步向 <code>--mci-*</code> 对齐。
    </p>
  </div>
  <div class="mci-ui-showcase__panel">
    <div class="mci-ui-flow-card"><b>统一品牌</b><span>颜色、阴影、圆角、动效、骨架屏全部收束到 token。</span></div>
    <div class="mci-ui-flow-card"><b>AI稳定生成</b><span>页面、按钮、卡片、富文本、数据状态都有固定组件答案。</span></div>
    <div class="mci-ui-flow-card"><b>跨端一致</b><span>Vue 3 Web、响应式网站、uni-app/H5 使用同一套设计语言。</span></div>
  </div>
</section>

## 主题能力

<section class="mci-ui-theme-lab">
  <div class="mci-ui-theme-lab__intro">
    <span class="mci-ui-kicker">Theme Runtime</span>
    <h3>主题切换是内建能力，不是项目后期补丁。</h3>
    <p>所有移动端和 PC 网站项目默认支持明暗模式、九套主色、圆角/扁平形态和动效偏好。白色与黄色主色必须使用 <code>--mci-text-on-primary</code>，避免文字对比度不足。</p>
  </div>
  <div class="mci-ui-theme-grid">
    <article><b>light / dark</b><span>明暗模式</span></article>
    <article><b>black / white</b><span>极简与高端企业感</span></article>
    <article><b>red / orange / yellow</b><span>品牌、活动、会员权益</span></article>
    <article><b>green / cyan / blue</b><span>健康、科技、企业服务</span></article>
    <article><b>purple</b><span>AI、创意、数字产品</span></article>
    <article><b>rounded / flat</b><span>圆角与扁平都保留层次</span></article>
  </div>
</section>

## 工程结构

<section class="mci-ui-structure">
  <div class="mci-ui-structure__tree">
    <span>Microi.UI/</span>
    <span>src/theme/tokens.css</span>
    <span>src/theme/index.css</span>
    <span>src/theme/runtime.js</span>
    <span>src/web/components</span>
    <span>src/uniapp/components</span>
  </div>
  <div class="mci-ui-structure__desc">
    <span class="mci-ui-kicker">Source Layout</span>
    <h3>主题、Web、UniApp 三层分离，业务页面只消费稳定出口。</h3>
    <p><code>src/theme</code> 是品牌 token 源头，<code>src/web</code> 服务 PC/响应式网站，<code>src/uniapp</code> 服务移动端项目。新增组件必须双端优先，颜色、圆角、阴影和安全区都走 <code>--mci-*</code> 变量。</p>
  </div>
</section>

## 快速接入

<section class="mci-ui-code-grid">
  <article>
    <span>Vue 3 Web</span>
    <pre><code>import { createApp } from 'vue';
import MciUI, { initMciDesign } from '@microi/mci-ui/web';
import '@microi/mci-ui/theme';
initMciDesign({ theme: 'light', palette: 'red', shape: 'rounded', motion: 'full' });
createApp(App).use(MciUI).mount('#app');</code></pre>
  </article>
  <article>
    <span>uni-app</span>
    <pre><code>import { createSSRApp } from 'vue';
import App from './App.vue';
import MciUI, { initMciDesign } from '@/mci-ui/uniapp/index.js';
import '@/mci-ui/theme/index.css';
export function createApp() {
  const app = createSSRApp(App);
  initMciDesign({ theme: 'light', palette: 'red', shape: 'rounded' });
  app.use(MciUI);
  return { app };
}</code></pre>
  </article>
</section>

## 主题运行时

<section class="mci-ui-runtime-panel">
  <div>
    <span class="mci-ui-kicker">Runtime API</span>
    <h3>一次初始化，统一控制主题、主色、形态和动效。</h3>
    <p>运行时会写入本地存储，并在支持 DOM 的环境中设置 <code>data-theme</code>、<code>data-mci-palette</code>、<code>data-mci-shape</code>、<code>data-mci-motion</code>。</p>
  </div>
  <pre><code>import { initMciDesign, setMciTheme, setMciPalette, setMciShape, setMciMotion, toggleMciTheme } from '@microi/mci-ui/runtime';
initMciDesign({ theme: 'light', palette: 'red', shape: 'rounded', motion: 'full' });
setMciTheme('dark');
setMciPalette('blue');
setMciShape('flat');
setMciMotion('reduced');
toggleMciTheme();</code></pre>
</section>

## 样式隔离

<section class="mci-ui-guard-panel">
  <div>
    <span class="mci-ui-kicker">Style Guard</span>
    <h3>吾码UI必须在复杂项目里保持自己的视觉边界。</h3>
    <p>官网、文档站、企业站、移动端应用经常混用第三方 UI、Markdown、富文本和项目老 CSS。MCI-UI 通过命名空间、根容器、token 和主题层收口，尽量避免样式被其它组件覆盖。</p>
  </div>
  <div class="mci-ui-guard-grid">
    <article><b>根容器</b><span>页面或局部 UI 使用 <code>.mci-page</code> 或 <code>data-mci-ui-root</code> 包裹。</span></article>
    <article><b>命名空间</b><span>共享类名统一 <code>mci-</code> 前缀，不写泛化 <code>button</code>、<code>.card</code>、<code>img</code>。</span></article>
    <article><b>token 收口</b><span>颜色、圆角、阴影、间距通过 <code>--mci-*</code> 控制，不直接改库内部样式。</span></article>
    <article><b>主题层</b><span>官网/文档站使用 VitePress theme 层统一美化，避免每篇文档散装 CSS。</span></article>
  </div>
</section>

## 组件预览

下面是按吾码UI设计 token 绘制的组件截图式预览。真实项目中组件会使用同一套 `--mci-*` 变量、主题 runtime、圆角/扁平模式、骨架屏和安全区规则，因此不同业务系统会保持统一的 Microi 品牌质感。

<div class="mci-ui-preview-grid">
  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-page">
      <div class="mci-shot-page__top"><span></span><b>Microi App</b><i></i></div>
      <div class="mci-shot-page__hero"></div>
      <div class="mci-shot-page__grid"><span></span><span></span><span></span></div>
    </div>
    <strong>MciPage</strong>
    <p>页面 shell、安全区、入场动效、结构化背景。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-phone">
      <div class="mci-shot-navbar"><i></i><b>页面标题</b><span></span></div>
      <div class="mci-shot-phone__body"><em></em><em></em><em></em></div>
    </div>
    <strong>MciNavbar</strong>
    <p>移动端顶部导航，兼容沉浸式状态栏和返回操作。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-buttons">
      <button>主按钮</button>
      <button>金色按钮</button>
      <button>朴素按钮</button>
      <button>冷色按钮</button>
    </div>
    <strong>MciButton</strong>
    <p>品牌按钮，内置 hover、focus、pressed、sheen 等反馈。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-card">
      <span>Surface</span>
      <strong>商业数据卡片</strong>
      <p>柔和阴影、清晰边界、扫光层次。</p>
    </div>
    <strong>MciCard</strong>
    <p>通用内容卡片，适合信息承载、入口、统计和商品容器。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-section">
      <label>SECTION</label>
      <h4>核心能力</h4>
      <div><span></span><span></span><span></span></div>
    </div>
    <strong>MciSection</strong>
    <p>统一区块标题、副标题、eyebrow 和操作区。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-cell">
      <div><i></i><span><b>账户设置</b><em>安全与偏好</em></span><strong>›</strong></div>
      <div><i></i><span><b>消息通知</b><em>系统与业务提醒</em></span><strong>›</strong></div>
    </div>
    <strong>MciCell</strong>
    <p>列表、菜单、设置、服务入口的标准单元格。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-tabs">
      <span class="is-active">全部</span><span>待处理</span><span>已完成</span>
    </div>
    <strong>MciTabs</strong>
    <p>分段标签，适合分类、状态、筛选和资产切换。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-metric">
      <small>累计收益</small>
      <b>¥ 9,489.70</b>
      <span>今日 +128.00</span>
    </div>
    <strong>MciMetricCard</strong>
    <p>资产、收益、积分、数据看板的强视觉指标卡。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-action">
      <div class="mci-shot-action__content"></div>
      <div class="mci-shot-action__bar"><button>次操作</button><button>主操作</button></div>
    </div>
    <strong>MciActionBar</strong>
    <p>底部固定操作栏，内置底部安全区和按钮布局。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-avatar">
      <span>吾</span><span>码</span><span>UI</span><span>AI</span>
    </div>
    <strong>MciAvatar</strong>
    <p>用户头像，图片失败时自动用昵称/首字兜底。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-product">
      <div></div>
      <b>标准商品卡</b>
      <span>¥ 299.00</span>
    </div>
    <strong>MciProductCard</strong>
    <p>商品、权益、内容、服务项目都可复用的商业卡片。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-skeleton">
      <i></i><span></span><span></span><i></i><span></span><span></span>
    </div>
    <strong>MciSkeleton</strong>
    <p>支持 list、grid、banner、detail、metric 的骨架屏。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-state">
      <i></i>
      <b>暂无数据</b>
      <span>完成请求后再显示空态</span>
    </div>
    <strong>MciDataState</strong>
    <p>loading、empty、error 的统一动态数据状态。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-richtext">
      <div></div>
      <h4>内容标题</h4>
      <p>文字内容保留舒适留白，图片保持满宽展示。</p>
    </div>
    <strong>MciRichText</strong>
    <p>文章、协议、商品详情、公告详情的移动端富文本容器。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-theme">
      <div><span></span><span></span><span></span><span></span><span></span></div>
      <b>rounded / flat</b>
      <button>切换主题</button>
    </div>
    <strong>MciThemePanel</strong>
    <p>主题、palette、圆角/扁平、动效偏好的统一设置面板。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-form">
      <label>联系人</label>
      <span>请输入姓名</span>
      <label>备注</label>
      <p>多行输入内容...</p>
    </div>
    <strong>MciFormField</strong>
    <p>表单项，统一 label、必填、帮助、错误和输入框状态。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-filter">
      <b>筛选</b>
      <span>关键词</span><span>状态</span><span>时间</span>
      <button>查询</button>
    </div>
    <strong>MciFilterBar</strong>
    <p>列表页筛选栏，适合搜索、状态过滤和批量动作。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-asset">
      <small>账户资产</small>
      <b>128,800</b>
      <span>本月增长 +12.8%</span>
    </div>
    <strong>MciAssetCard</strong>
    <p>余额、积分、资产、数据面板的通用资产卡。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-order">
      <div><span>订单 #20260607</span><em>已完成</em></div>
      <section><i></i><p><b>标准订单卡</b><small>服务项目 / 交易记录 / 审批事项</small></p><strong>¥299</strong></section>
    </div>
    <strong>MciOrderCard</strong>
    <p>订单、审批、工单、任务记录的业务列表卡片。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-modal">
      <section>
        <b>确认操作</b>
        <p>弹窗内容展示区</p>
        <div><button>取消</button><button>确认</button></div>
      </section>
    </div>
    <strong>MciModal</strong>
    <p>弹窗组件，支持遮罩、标题、内容区和底部操作。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-upload">
      <i></i>
      <b>上传文件</b>
      <span>点击选择或拖拽上传</span>
    </div>
    <strong>MciUploader</strong>
    <p>上传容器，统一选择、提示、文件列表和交互反馈。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-timeline">
      <div><i></i><span><b>提交申请</b><small>09:30</small></span></div>
      <div><i></i><span><b>审核通过</b><small>10:15</small></span></div>
      <div><i></i><span><b>完成归档</b><small>11:00</small></span></div>
    </div>
    <strong>MciTimeline</strong>
    <p>时间轴，适合状态流转、操作日志和活动记录。</p>
  </article>

  <article class="mci-ui-preview-card">
    <div class="mci-ui-shot mci-shot-steps">
      <div class="is-done">1<span>提交</span></div>
      <div class="is-active">2<span>审核</span></div>
      <div>3<span>完成</span></div>
    </div>
    <strong>MciSteps</strong>
    <p>步骤条，适合流程、订单、审批和新手引导。</p>
  </article>
</div>

## 组件代码示例

<section class="mci-ui-recipe-grid" v-pre>
  <article class="mci-ui-recipe-card">
    <div class="mci-ui-recipe-card__visual is-page">
      <div class="mci-recipe-browser">
        <span></span><span></span><span></span>
        <b>MciPage</b>
      </div>
      <div class="mci-recipe-hero"></div>
      <div class="mci-recipe-mini-grid"><i></i><i></i><i></i></div>
    </div>
    <div class="mci-ui-recipe-card__body">
      <span class="mci-ui-kicker">Layout Recipe</span>
      <h3>页面与区块</h3>
      <p>用 <code>MciPage</code> 做页面 shell，区块统一交给 <code>MciSection</code>，首屏、网格、入场动效和结构化背景一套成型。</p>
      <div class="mci-code-window">
        <span>&lt;MciPage safe-area tech-grid shape="rounded"&gt;</span>
        <span>  &lt;MciSection title="核心能力" description="统一品牌、主题、动效和组件体验" animated&gt;</span>
        <span>    &lt;div class="mci-grid mci-grid--3"&gt;</span>
        <span>      &lt;MciCard interactive animated sheen&gt;...&lt;/MciCard&gt;</span>
        <span>      &lt;MciCard interactive animated sheen&gt;...&lt;/MciCard&gt;</span>
        <span>      &lt;MciCard interactive animated sheen&gt;...&lt;/MciCard&gt;</span>
        <span>    &lt;/div&gt;</span>
        <span>  &lt;/MciSection&gt;</span>
        <span>&lt;/MciPage&gt;</span>
      </div>
    </div>
  </article>

  <article class="mci-ui-recipe-card">
    <div class="mci-ui-recipe-card__visual is-mobile">
      <div class="mci-recipe-phone">
        <div class="mci-recipe-tabs"><b>全部</b><span>内容</span><span>商品</span></div>
        <div class="mci-recipe-products"><i></i><i></i><i></i><i></i></div>
      </div>
    </div>
    <div class="mci-ui-recipe-card__body">
      <span class="mci-ui-kicker">List Recipe</span>
      <h3>移动端商品/内容列表</h3>
      <p>列表页必须有骨架屏、状态切换和稳定网格。接口未返回前不显示空态，商品/内容卡片保持统一比例。</p>
      <div class="mci-code-window">
        <span>&lt;MciTabs v-model="type" :options="typeOptions" /&gt;</span>
        <span>&nbsp;</span>
        <span>&lt;MciDataState :loading="loading" skeleton-type="grid" :empty="!items.length"&gt;</span>
        <span>  &lt;div class="mci-grid mci-grid--2"&gt;</span>
        <span>    &lt;MciProductCard</span>
        <span>      v-for="item in items"</span>
        <span>      :key="item.Id"</span>
        <span>      :title="item.Name"</span>
        <span>      :image="item.Cover"</span>
        <span>      :price="item.Price"</span>
        <span>      :tag="item.TagName"</span>
        <span>    /&gt;</span>
        <span>  &lt;/div&gt;</span>
        <span>&lt;/MciDataState&gt;</span>
      </div>
    </div>
  </article>

  <article class="mci-ui-recipe-card">
    <div class="mci-ui-recipe-card__visual is-asset">
      <div class="mci-recipe-metric"><small>累计收益</small><b>¥949.79</b><span>今日 +128.00</span></div>
      <div class="mci-recipe-action"><button>加入购物车</button><button>立即购买</button></div>
    </div>
    <div class="mci-ui-recipe-card__body">
      <span class="mci-ui-kicker">Action Recipe</span>
      <h3>资产与底部操作栏</h3>
      <p>资产指标用强视觉卡承载，底部操作栏必须兼容安全区，主次按钮层级明确，移动端点击有按压反馈。</p>
      <div class="mci-code-window">
        <span>&lt;MciMetricCard label="累计收益" value="949.79" suffix="元" trend="今日 +0.00" /&gt;</span>
        <span>&nbsp;</span>
        <span>&lt;MciActionBar&gt;</span>
        <span>  &lt;MciButton variant="plain" block&gt;加入购物车&lt;/MciButton&gt;</span>
        <span>  &lt;MciButton variant="primary" block sheen&gt;立即购买&lt;/MciButton&gt;</span>
        <span>&lt;/MciActionBar&gt;</span>
      </div>
    </div>
  </article>

  <article class="mci-ui-recipe-card">
    <div class="mci-ui-recipe-card__visual is-flow">
      <div class="mci-recipe-filter"><b>筛选</b><span>关键词</span><span>状态</span><button>查询</button></div>
      <div class="mci-recipe-flow"><i></i><span></span><i></i><span></span><i></i></div>
    </div>
    <div class="mci-ui-recipe-card__body">
      <span class="mci-ui-kicker">Flow Recipe</span>
      <h3>表单、筛选与流程</h3>
      <p>筛选、订单卡、步骤条、时间轴应该作为一个业务组合出现，既能承载查询，也能表达状态流转。</p>
      <div class="mci-code-window">
        <span>&lt;MciFilterBar title="高级筛选"&gt;</span>
        <span>  &lt;MciFormField v-model="keyword" placeholder="请输入关键词" /&gt;</span>
        <span>  &lt;MciTabs v-model="status" :options="statusOptions" /&gt;</span>
        <span>  &lt;template #actions&gt;</span>
        <span>    &lt;MciButton variant="primary"&gt;查询&lt;/MciButton&gt;</span>
        <span>  &lt;/template&gt;</span>
        <span>&lt;/MciFilterBar&gt;</span>
        <span>&nbsp;</span>
        <span>&lt;MciOrderCard title="服务工单" status="处理中" amount="¥299.00" /&gt;</span>
        <span>&lt;MciSteps :steps="steps" :current="1" /&gt;</span>
        <span>&lt;MciTimeline :items="timeline" /&gt;</span>
      </div>
    </div>
  </article>
</section>

## 通用业务场景适配

<section class="mci-ui-scenario-panel">
  <div class="mci-ui-scenario-panel__intro">
    <span class="mci-ui-kicker">Business Patterns</span>
    <h3>面向通用系统建设，不绑定任何定制项目。</h3>
    <p>无论是企业官网、移动端会员中心、服务平台、商品交易、资产数据、工单审批还是内容展示，都应该优先沉淀可复用的业务 UI 原子。</p>
  </div>
  <div class="mci-ui-scenario-grid">
    <article><i></i><b>企业官网 / 产品站</b><span><code>MciPage</code>、<code>MciSection</code>、<code>MciCard</code>、主题 palette、页面入场动效。</span></article>
    <article><i></i><b>移动端应用 / 会员中心</b><span><code>MciNavbar</code>、<code>MciCell</code>、<code>MciAvatar</code>、<code>MciThemePanel</code>、安全区。</span></article>
    <article><i></i><b>商品 / 权益 / 服务列表</b><span><code>MciTabs</code>、<code>MciProductCard</code>、<code>MciSkeleton</code>、筛选与分页加载。</span></article>
    <article><i></i><b>资产 / 数据看板</b><span><code>MciMetricCard</code>、<code>MciAssetCard</code>、<code>MciDataState</code>、状态标签。</span></article>
    <article><i></i><b>订单 / 审批 / 工单</b><span><code>MciOrderCard</code>、<code>MciSteps</code>、<code>MciTimeline</code>、头像信息行与状态流转。</span></article>
    <article><i></i><b>内容详情 / 协议公告</b><span><code>MciRichText</code>、<code>MciActionBar</code>、图片满宽与文字留白。</span></article>
    <article><i></i><b>活动 / 营销页面</b><span><code>MciSkeleton</code> banner、结构化背景、扫光动效、品牌按钮。</span></article>
    <article><i></i><b>项目级扩展</b><span>基础展示、数据状态、主题设置、表单、筛选、上传、弹窗、资产卡、时间轴和步骤条都已落地，实际业务项目优先组合这些组件。</span></article>
  </div>
</section>

## 系统模板预览

<section class="mci-ui-template-grid">
  <article>
    <div class="mci-template-shot is-site"><span></span><b>企业官网</b><em>Hero / Feature / CTA</em></div>
    <strong>企业官网 / 产品站</strong>
    <p>用 `MciPage`、`MciSection`、`MciCard`、主题 palette 构建品牌展示与转化路径。</p>
  </article>
  <article>
    <div class="mci-template-shot is-mobile"><span></span><b>会员中心</b><em>Profile / Asset / Menu</em></div>
    <strong>移动端会员中心</strong>
    <p>用 `MciNavbar`、`MciAvatar`、`MciAssetCard`、`MciCell`、`MciThemePanel` 组合。</p>
  </article>
  <article>
    <div class="mci-template-shot is-dashboard"><span></span><b>数据看板</b><em>Metric / Filter / State</em></div>
    <strong>资产与数据看板</strong>
    <p>用 `MciMetricCard`、`MciFilterBar`、`MciDataState`、`MciSkeleton` 统一数据体验。</p>
  </article>
  <article>
    <div class="mci-template-shot is-service"><span></span><b>服务工单</b><em>Order / Steps / Timeline</em></div>
    <strong>订单 / 审批 / 工单</strong>
    <p>用 `MciOrderCard`、`MciSteps`、`MciTimeline`、`MciModal` 承载流程与操作。</p>
  </article>
</section>

## 高级移动端视觉规范

Microi.UI 的移动端目标不是把后台页面缩小到手机里，而是让客户、员工、会员、师傅、运营人员打开后能立即感受到产品级体验。AI 在生成移动端或 H5/小程序/App 页面时，应默认把下面规则作为验收门槛，不需要用户额外提示。

<section class="mci-ui-check-panel">
  <span class="mci-ui-kicker">Mobile Premium</span>
  <h3>移动端页面必须先有场景蓝图，再写组件和样式。</h3>
  <div class="mci-ui-check-grid">
    <article><b>首屏锚点</b><span>首页、登录页、我的页、报表页必须有品牌 Hero、身份头、状态总览、搜索分类或 KPI 区块，不能只放标题和列表。</span></article>
    <article><b>底部导航</b><span>优先使用 <code>MciBottomNav</code> 或等价封装，必须包含真实图标、文字、激活态、角标和稳定点击区域。</span></article>
    <article><b>高级首屏</b><span>优先使用 <code>MciHeroPanel</code> 或 <code>.mci-mobile-hero</code>，标题需适配 375px / 430px 宽度，按钮不能被浮层遮挡。</span></article>
    <article><b>富卡片列表</b><span>工单、报告、商品、消息、新闻、活动、维修记录等列表使用业务卡片：标题、状态、摘要、时间、主操作缺一不可。</span></article>
    <article><b>表单上传</b><span>长表单分段展示，底部固定安全区提交；图片/文件上传必须有预览、替换、进度、失败反馈。</span></article>
    <article><b>动效反馈</b><span>页面入场、卡片错峰、按钮按压、骨架屏 shimmer 需要存在但克制，并尊重 reduced motion。</span></article>
    <article><b>按钮质感</b><span>登录、去登录、提交、接单、生成报告、上传照片等显眼按钮必须是图标+文字，并具备 loading/disabled/pressed 状态。</span></article>
    <article><b>后台联动</b><span>真实业务系统的后台菜单必须至少两级分组，移动端信息架构应与客户中心、设备中心、运营中心、报表中心等领域对应。</span></article>
  </div>
</section>

移动端常用公共样式包括 <code>.mci-mobile-hero</code>、<code>.mci-mobile-panel</code>、<code>.mci-mobile-bottom-nav</code>、<code>.mci-mobile-rich-card</code>、<code>.mci-mobile-meta-grid</code>、<code>.mci-mobile-option-grid</code>、<code>.mci-mobile-photo-grid</code>、<code>.mci-mobile-sheet</code>、<code>.mci-mobile-chart-card</code>、<code>.mci-mobile-kpi-strip</code> 和 <code>.mci-mobile-empty-result</code>。当同一结构出现在两个以上页面时，应沉淀为 <code>Mci*</code> 组件或项目级 <code>mci-*</code> 封装。

## AI 开发规则

<section class="mci-ui-ai-panel">
  <div class="mci-ui-ai-panel__copy">
    <span class="mci-ui-kicker">AI Usage</span>
    <h3>用户没有主动指定 UI 风格时，AI 必须默认采用 Microi.UI / MCI-UI。</h3>
    <p>这条规则让 AI 生成的页面从第一版开始就具备统一主题、骨架屏、安全区、动效和品牌 token，而不是每个项目临时拼装样式。</p>
  </div>
  <div class="mci-ui-ai-prompt">
    <span>默认识别规则</span>
    <pre><code>使用 Microi.UI / MCI-UI 开发此 Vue 3/uni-app 页面。
遵循 microi.skills/ui-design/SKILL.md 和 microi.skills/microi-ui/SKILL.md。
页面必须支持 light/dark、黑白红橙黄绿青蓝紫 palette、rounded/flat、骨架屏、安全区、页面入场和点击反馈。
业务页面不要硬编码颜色/阴影/圆角，必须使用 --mci-* token 或 MciPage/MciButton/MciCard 等组件。</code></pre>
  </div>
</section>

<section class="mci-ui-check-panel">
  <span class="mci-ui-kicker">Delivery Checklist</span>
  <h3>AI 完成后必须检查这些交付项。</h3>
  <div class="mci-ui-check-grid">
    <article><b>页面骨架</b><span>是否使用 <code>MciPage</code> 或等价页面 shell，内容区是否优先用 <code>MciSection</code>。</span></article>
    <article><b>入口与设置</b><span>设置、菜单、服务入口是否优先用 <code>MciCell</code>，主题设置是否可用 <code>MciThemePanel</code>。</span></article>
    <article><b>业务卡片</b><span>分类、资产、商城、会员页是否复用 <code>MciTabs</code>、<code>MciMetricCard</code>、<code>MciAssetCard</code>、<code>MciProductCard</code>。</span></article>
    <article><b>表单流程</b><span>表单、筛选、上传、弹窗、订单/工单、时间轴、步骤条是否优先使用对应 MCI 组件。</span></article>
    <article><b>数据状态</b><span>是否有骨架屏，而不是接口未返回时直接显示空态。</span></article>
    <article><b>移动兼容</b><span>是否支持 iPhone、Android 不同机型的顶部/底部安全区。</span></article>
    <article><b>主题运行时</b><span>是否通过 <code>initMciDesign()</code> 或项目主题服务设置主题。</span></article>
    <article><b>构建验收</b><span>是否没有硬编码主色、圆角、阴影，并跑过基础构建或至少 <code>node --check</code> / <code>npm pack --dry-run</code>。</span></article>
  </div>
</section>

## 与第三方 UI 的关系

<section class="mci-ui-third-panel">
  <div>
    <span class="mci-ui-kicker">Ecosystem</span>
    <h3>Microi.UI 不排斥第三方库，它负责最终呈现的统一质感。</h3>
    <p>复杂表格、日期选择、上传、弹窗、表单校验等成熟能力，可以继续使用 Element Plus、uni-ui、TDesign、uView、FirstUI 等。但项目最终呈现出来的视觉，应该由 <code>--mci-*</code> token 和 <code>mci-*</code> 组件封装统一承载。</p>
  </div>
  <div class="mci-ui-third-steps">
    <article><span>01</span><b>能力解耦</b><em>第三方组件只解决复杂交互能力。</em></article>
    <article><span>02</span><b>外层封装</b><em>外层使用 <code>mci-*</code> wrapper 或项目级组件封装。</em></article>
    <article><span>03</span><b>token 统一</b><em>颜色、圆角、阴影、间距、字体、骨架屏都走 <code>--mci-*</code>。</em></article>
    <article><span>04</span><b>体验收口</b><em>对用户可见的页面风格由 Microi.UI 统一控制。</em></article>
  </div>
</section>

<style>
.vp-doc._doc_system-engine_microi-ui {
  --mci-doc-red: #b51220;
  --mci-doc-red-dark: #8e0613;
  --mci-doc-gold: #d9a23a;
  --mci-doc-blue: #2563eb;
  --mci-doc-cyan: #0891b2;
  --mci-doc-ink: #171923;
  --mci-doc-muted: #64748b;
}

.mci-ui-doc {
  margin: 24px 0 36px;
}

.mci-ui-hero {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(280px, .9fr);
  gap: 28px;
  padding: clamp(28px, 5vw, 56px);
  border: 1px solid rgba(181, 18, 32, .16);
  border-radius: 28px;
  background:
    linear-gradient(115deg, rgba(181, 18, 32, .12), transparent 38%),
    linear-gradient(135deg, rgba(8, 145, 178, .12), transparent 42%),
    linear-gradient(180deg, #ffffff, #f8fafc);
  box-shadow: 0 28px 70px rgba(24, 32, 48, .14);
}

.mci-ui-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(31, 41, 55, .06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(31, 41, 55, .06) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: linear-gradient(90deg, rgba(0,0,0,.76), transparent 72%);
  pointer-events: none;
}

.mci-ui-hero::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: -28%;
  width: 22%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.65), transparent);
  transform: skewX(-18deg);
  animation: mciDocSweep 6s ease-in-out infinite;
  pointer-events: none;
}

.mci-ui-hero__copy,
.mci-ui-console {
  position: relative;
  z-index: 1;
}

.mci-ui-kicker {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: 28px;
  padding: 0 12px;
  border: 1px solid rgba(181, 18, 32, .18);
  border-radius: 999px;
  background: rgba(255,255,255,.78);
  color: var(--mci-doc-red-dark);
  font-size: 13px;
  font-weight: 800;
}

.mci-ui-hero h2 {
  margin: 18px 0 0;
  color: var(--mci-doc-ink);
  font-size: clamp(30px, 4.6vw, 56px);
  line-height: 1.08;
  letter-spacing: 0;
}

.mci-ui-hero p {
  max-width: 720px;
  margin: 18px 0 0;
  color: #475569;
  font-size: 17px;
  line-height: 1.8;
}

.mci-ui-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}

.mci-ui-hero__actions a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 18px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--mci-doc-red), #f04438);
  color: #fff;
  font-weight: 800;
  text-decoration: none;
  box-shadow: 0 14px 30px rgba(181, 18, 32, .22);
  transition: transform .2s ease, box-shadow .2s ease;
}

.mci-ui-hero__actions a:nth-child(2) {
  background: linear-gradient(135deg, var(--mci-doc-gold), #f7c65d);
  color: #3a2500;
  box-shadow: 0 14px 30px rgba(217, 162, 58, .22);
}

.mci-ui-hero__actions a:nth-child(3) {
  background: linear-gradient(135deg, var(--mci-doc-blue), var(--mci-doc-cyan));
  box-shadow: 0 14px 30px rgba(37, 99, 235, .20);
}

.mci-ui-hero__actions a:hover {
  transform: translateY(-2px);
  text-decoration: none;
}

.mci-ui-console {
  align-self: center;
  border: 1px solid rgba(31, 41, 55, .12);
  border-radius: 22px;
  background: rgba(255,255,255,.78);
  box-shadow: 0 22px 54px rgba(24, 32, 48, .16);
  backdrop-filter: blur(16px) saturate(1.25);
  overflow: hidden;
}

.mci-ui-console__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(31, 41, 55, .08);
  color: #475569;
  font-size: 13px;
  font-weight: 800;
}

.mci-ui-console__bar i {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #ef4444;
}

.mci-ui-console__bar i:nth-child(2) { background: #f59e0b; }
.mci-ui-console__bar i:nth-child(3) { background: #22c55e; }

.mci-ui-console__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 18px;
}

.mci-ui-console__grid span {
  min-height: 72px;
  border-radius: 18px;
  box-shadow: 0 12px 26px rgba(24, 32, 48, .12);
}

.mci-ui-console__grid .is-red { background: linear-gradient(135deg, #b51220, #f04438); }
.mci-ui-console__grid .is-orange { background: linear-gradient(135deg, #ea580c, #fb923c); }
.mci-ui-console__grid .is-yellow { background: linear-gradient(135deg, #f7c65d, #d9a23a); }
.mci-ui-console__grid .is-green { background: linear-gradient(135deg, #16a34a, #34d399); }
.mci-ui-console__grid .is-cyan { background: linear-gradient(135deg, #0891b2, #22d3ee); }
.mci-ui-console__grid .is-blue { background: linear-gradient(135deg, #2563eb, #60a5fa); }
.mci-ui-console__grid .is-purple { background: linear-gradient(135deg, #7c3aed, #a78bfa); }
.mci-ui-console__grid .is-black { background: linear-gradient(135deg, #111827, #374151); }
.mci-ui-console__grid .is-white { background: linear-gradient(135deg, #fff, #e5e7eb); border: 1px solid rgba(31,41,55,.10); }

.mci-ui-console__panel {
  display: grid;
  gap: 8px;
  margin: 0 18px 18px;
  padding: 16px;
  border-radius: 18px;
  background: #111827;
  color: #e5e7eb;
}

.mci-ui-console__panel strong {
  color: #fff;
  font-size: 18px;
}

.mci-ui-console__panel span {
  color: #cbd5e1;
  font-size: 13px;
}

.vp-doc._doc_system-engine_microi-ui h2 {
  position: relative;
  scroll-margin-top: 104px;
  margin-top: 52px;
  padding: 18px 0 10px;
  color: var(--mci-doc-ink);
  font-size: 30px;
  letter-spacing: 0;
}

.vp-doc._doc_system-engine_microi-ui h2::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  width: 86px;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--mci-doc-red), var(--mci-doc-gold), var(--mci-doc-cyan));
  box-shadow: 0 8px 22px rgba(181, 18, 32, .18);
}

.mci-ui-hero,
.mci-ui-value-grid,
.mci-ui-showcase,
.mci-ui-theme-lab,
.mci-ui-structure,
.mci-ui-runtime-panel,
.mci-ui-guard-panel,
.mci-ui-preview-grid,
.mci-ui-recipe-grid,
.mci-ui-scenario-panel,
.mci-ui-template-grid,
.mci-ui-ai-panel,
.mci-ui-check-panel,
.mci-ui-third-panel {
  scroll-margin-top: 96px;
}

.mci-ui-showcase,
.mci-ui-theme-lab,
.mci-ui-structure,
.mci-ui-runtime-panel,
.mci-ui-guard-panel,
.mci-ui-scenario-panel,
.mci-ui-ai-panel,
.mci-ui-check-panel,
.mci-ui-third-panel {
  position: relative;
  overflow: hidden;
  display: grid;
  gap: 24px;
  margin: 18px 0 36px;
  padding: clamp(22px, 4vw, 34px);
  border: 1px solid rgba(31,41,55,.10);
  border-radius: 26px;
  background:
    linear-gradient(120deg, rgba(181,18,32,.08), transparent 36%),
    linear-gradient(180deg, #fff, #f8fafc);
  box-shadow: 0 22px 56px rgba(24,32,48,.12);
}

.mci-ui-showcase::before,
.mci-ui-theme-lab::before,
.mci-ui-structure::before,
.mci-ui-runtime-panel::before,
.mci-ui-guard-panel::before,
.mci-ui-scenario-panel::before,
.mci-ui-ai-panel::before,
.mci-ui-check-panel::before,
.mci-ui-third-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(31,41,55,.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(31,41,55,.045) 1px, transparent 1px);
  background-size: 34px 34px;
  mask-image: linear-gradient(90deg, rgba(0,0,0,.58), transparent 78%);
  pointer-events: none;
}

.mci-ui-showcase {
  grid-template-columns: minmax(0, 1fr) minmax(280px, .8fr);
}

.mci-ui-showcase__copy,
.mci-ui-showcase__panel,
.mci-ui-theme-lab__intro,
.mci-ui-theme-grid,
.mci-ui-structure__tree,
.mci-ui-structure__desc,
.mci-ui-runtime-panel > *,
.mci-ui-guard-panel > *,
.mci-ui-scenario-panel > *,
.mci-ui-ai-panel > *,
.mci-ui-check-panel > *,
.mci-ui-third-panel > * {
  position: relative;
  z-index: 1;
}

.mci-ui-showcase h3,
.mci-ui-theme-lab h3,
.mci-ui-structure h3,
.mci-ui-runtime-panel h3,
.mci-ui-guard-panel h3,
.mci-ui-scenario-panel h3,
.mci-ui-ai-panel h3,
.mci-ui-check-panel h3,
.mci-ui-third-panel h3 {
  margin: 12px 0 0;
  color: var(--mci-doc-ink);
  font-size: clamp(24px, 3.4vw, 38px);
  line-height: 1.18;
  letter-spacing: 0;
}

.mci-ui-showcase p,
.mci-ui-theme-lab p,
.mci-ui-structure p,
.mci-ui-runtime-panel p,
.mci-ui-guard-panel p,
.mci-ui-scenario-panel p,
.mci-ui-ai-panel p,
.mci-ui-third-panel p {
  margin: 14px 0 0;
  color: #475569;
  font-size: 16px;
  line-height: 1.85;
}

.mci-ui-showcase__panel {
  display: grid;
  gap: 14px;
}

.mci-ui-flow-card {
  padding: 18px;
  border: 1px solid rgba(31,41,55,.10);
  border-radius: 18px;
  background: rgba(255,255,255,.88);
  box-shadow: 0 14px 34px rgba(24,32,48,.10);
}

.mci-ui-flow-card b {
  display: block;
  color: var(--mci-doc-ink);
  font-size: 18px;
  font-weight: 950;
}

.mci-ui-flow-card span {
  display: block;
  margin-top: 8px;
  color: var(--mci-doc-muted);
  font-size: 14px;
  line-height: 1.65;
}

.mci-ui-theme-lab {
  grid-template-columns: minmax(0, .9fr) minmax(360px, 1.1fr);
}

.mci-ui-theme-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.mci-ui-theme-grid article {
  min-height: 118px;
  padding: 18px;
  border: 1px solid rgba(255,255,255,.64);
  border-radius: 20px;
  background:
    linear-gradient(135deg, rgba(255,255,255,.78), rgba(255,255,255,.52)),
    linear-gradient(135deg, rgba(181,18,32,.10), rgba(8,145,178,.10));
  box-shadow: 0 14px 32px rgba(24,32,48,.10);
}

.mci-ui-theme-grid b {
  display: block;
  color: var(--mci-doc-ink);
  font-size: 18px;
  font-weight: 950;
}

.mci-ui-theme-grid span {
  display: block;
  margin-top: 8px;
  color: var(--mci-doc-muted);
  font-size: 14px;
}

.mci-ui-structure {
  grid-template-columns: minmax(280px, .8fr) minmax(0, 1fr);
}

.mci-ui-structure__tree {
  display: grid;
  gap: 10px;
  padding: 18px;
  border-radius: 20px;
  background: #111827;
  box-shadow: 0 22px 52px rgba(15,23,42,.28);
}

.mci-ui-structure__tree span {
  display: block;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255,255,255,.08);
  color: #e5e7eb;
  font-family: "SFMono-Regular", "Cascadia Code", Consolas, monospace;
  font-size: 13px;
}

.mci-ui-structure__tree span:first-child {
  color: #fff;
  background: linear-gradient(135deg, var(--mci-doc-red), #f04438);
  font-weight: 900;
}

.mci-ui-code-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin: 18px 0 36px;
}

.mci-ui-code-grid article,
.mci-ui-runtime-panel pre {
  overflow: hidden;
  border: 1px solid rgba(31,41,55,.10);
  border-radius: 22px;
  background: #111827;
  box-shadow: 0 22px 54px rgba(15,23,42,.22);
}

.mci-ui-code-grid article > span {
  display: block;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255,255,255,.10);
  color: #fff;
  font-size: 15px;
  font-weight: 900;
}

.mci-ui-code-grid pre,
.mci-ui-runtime-panel pre {
  margin: 0;
  padding: 18px;
  overflow: auto;
  color: #e5e7eb;
  font-size: 13px;
  line-height: 1.65;
}

.mci-ui-runtime-panel {
  grid-template-columns: minmax(0, .86fr) minmax(420px, 1.14fr);
  align-items: center;
}

.mci-ui-template-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
  margin: 20px 0 36px;
}

.mci-ui-template-grid article {
  position: relative;
  overflow: hidden;
  padding: 14px;
  border: 1px solid rgba(31,41,55,.10);
  border-radius: 24px;
  background: linear-gradient(180deg, #fff, #f8fafc);
  box-shadow: 0 18px 46px rgba(24,32,48,.12);
  transition: transform .22s ease, box-shadow .22s ease;
}

.mci-ui-template-grid article:hover {
  transform: translateY(-4px);
  box-shadow: 0 26px 62px rgba(24,32,48,.16);
}

.mci-ui-template-grid strong {
  display: block;
  margin: 14px 4px 0;
  color: var(--mci-doc-ink);
  font-size: 17px;
  font-weight: 950;
}

.mci-ui-template-grid p {
  margin: 8px 4px 4px;
  color: var(--mci-doc-muted);
  font-size: 14px;
  line-height: 1.65;
}

.mci-template-shot {
  min-height: 166px;
  display: grid;
  align-content: end;
  gap: 6px;
  padding: 16px;
  border-radius: 18px;
  color: #fff;
  background: linear-gradient(135deg, var(--mci-doc-red), #f04438);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 16px 32px rgba(181,18,32,.18);
}

.mci-template-shot span {
  width: 54px;
  height: 54px;
  border-radius: 18px;
  background: rgba(255,255,255,.22);
}

.mci-template-shot b {
  font-size: 20px;
  font-weight: 950;
}

.mci-template-shot em {
  color: rgba(255,255,255,.78);
  font-size: 12px;
  font-style: normal;
}

.mci-template-shot.is-mobile { background: linear-gradient(135deg, #d9a23a, #f7c65d); color: #3a2500; }
.mci-template-shot.is-mobile em { color: rgba(58,37,0,.72); }
.mci-template-shot.is-dashboard { background: linear-gradient(135deg, #2563eb, #0891b2); }
.mci-template-shot.is-service { background: linear-gradient(135deg, #111827, #374151); }

.mci-ui-guard-panel {
  grid-template-columns: minmax(0, .86fr) minmax(420px, 1.14fr);
  align-items: center;
}

.mci-ui-guard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.mci-ui-guard-grid article {
  position: relative;
  overflow: hidden;
  min-height: 142px;
  padding: 18px;
  border: 1px solid rgba(31,41,55,.10);
  border-radius: 20px;
  background:
    linear-gradient(145deg, rgba(255,255,255,.92), rgba(248,250,252,.72)),
    linear-gradient(135deg, rgba(181,18,32,.08), rgba(8,145,178,.08));
  box-shadow: 0 16px 38px rgba(24,32,48,.10);
  transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
}

.mci-ui-guard-grid article::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, var(--mci-doc-red), var(--mci-doc-gold), var(--mci-doc-cyan));
}

.mci-ui-guard-grid article:hover {
  transform: translateY(-4px);
  border-color: rgba(181,18,32,.22);
  box-shadow: 0 26px 58px rgba(24,32,48,.15);
}

.mci-ui-guard-grid b {
  display: block;
  color: var(--mci-doc-ink);
  font-size: 18px;
  font-weight: 950;
}

.mci-ui-guard-grid span {
  display: block;
  margin-top: 10px;
  color: var(--mci-doc-muted);
  font-size: 13px;
  line-height: 1.7;
}

.mci-ui-guard-grid code {
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(181,18,32,.08);
  color: var(--mci-doc-red-dark);
  font-size: .92em;
  font-weight: 800;
}

.mci-ui-recipe-grid {
  display: grid;
  gap: 22px;
  margin: 24px 0 42px;
}

.mci-ui-recipe-card {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(260px, .78fr) minmax(0, 1.22fr);
  gap: 22px;
  padding: clamp(18px, 3vw, 26px);
  border: 1px solid rgba(31,41,55,.10);
  border-radius: 28px;
  background:
    linear-gradient(120deg, rgba(181,18,32,.08), transparent 42%),
    linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,250,252,.92));
  box-shadow: 0 24px 62px rgba(24,32,48,.13);
  transition: transform .24s ease, box-shadow .24s ease, border-color .24s ease;
}

.mci-ui-recipe-card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 4px;
  background: linear-gradient(90deg, var(--mci-doc-red), var(--mci-doc-gold), var(--mci-doc-cyan));
}

.mci-ui-recipe-card::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: -32%;
  width: 22%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.56), transparent);
  transform: skewX(-18deg);
  animation: mciDocShotSweep 6.2s ease-in-out infinite;
  pointer-events: none;
}

.mci-ui-recipe-card:hover {
  transform: translateY(-4px);
  border-color: rgba(181,18,32,.22);
  box-shadow: 0 30px 76px rgba(24,32,48,.17);
}

.mci-ui-recipe-card__visual,
.mci-ui-recipe-card__body {
  position: relative;
  z-index: 1;
}

.mci-ui-recipe-card__visual {
  min-height: 310px;
  padding: 18px;
  border: 1px solid rgba(31,41,55,.10);
  border-radius: 22px;
  background:
    linear-gradient(rgba(31,41,55,.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(31,41,55,.05) 1px, transparent 1px),
    linear-gradient(135deg, #fff, #f4f7fb);
  background-size: 30px 30px, 30px 30px, 100% 100%;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.88), 0 16px 34px rgba(24,32,48,.08);
}

.mci-ui-recipe-card__body h3 {
  margin: 14px 0 0;
  color: var(--mci-doc-ink);
  font-size: clamp(24px, 3vw, 34px);
  line-height: 1.16;
  letter-spacing: 0;
}

.mci-ui-recipe-card__body p {
  margin: 12px 0 16px;
  color: var(--mci-doc-muted);
  font-size: 15px;
  line-height: 1.8;
}

.mci-ui-recipe-card__body code {
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(181,18,32,.08);
  color: var(--mci-doc-red-dark);
  font-size: .92em;
  font-weight: 800;
}

.mci-ui-recipe-card__body pre,
.mci-code-window {
  max-height: 310px;
  width: 100%;
  margin: 0;
  padding: 18px;
  overflow: auto;
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 18px;
  background:
    linear-gradient(135deg, rgba(37,99,235,.10), transparent 44%),
    #111827;
  box-shadow: 0 18px 42px rgba(15,23,42,.22);
  resize: vertical;
  color: #e5e7eb;
  font-family: var(--mci-doc-mono, "SFMono-Regular", "Cascadia Code", Consolas, monospace);
  font-size: 13px;
  line-height: 1.7;
  white-space: pre;
}

.mci-ui-recipe-card__body pre code {
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: #e5e7eb;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.mci-code-window span {
  display: block;
  min-height: 1.7em;
  color: inherit;
  white-space: pre-wrap;
  word-break: break-word;
}

.mci-recipe-browser {
  height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(255,255,255,.86);
  box-shadow: 0 12px 26px rgba(24,32,48,.08);
}

.mci-recipe-browser span {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--mci-doc-red);
}

.mci-recipe-browser span:nth-child(2) { background: var(--mci-doc-gold); }
.mci-recipe-browser span:nth-child(3) { background: var(--mci-doc-cyan); }

.mci-recipe-browser b {
  margin-left: auto;
  color: var(--mci-doc-ink);
  font-size: 13px;
}

.mci-recipe-hero {
  height: 92px;
  margin-top: 18px;
  border-radius: 22px;
  background: linear-gradient(135deg, var(--mci-doc-red), #f04438);
  box-shadow: 0 18px 42px rgba(181,18,32,.24);
}

.mci-recipe-mini-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.mci-recipe-mini-grid i {
  height: 92px;
  border-radius: 18px;
  background: rgba(255,255,255,.88);
  box-shadow: 0 12px 24px rgba(24,32,48,.08);
}

.mci-ui-recipe-card__visual.is-mobile {
  display: grid;
  place-items: center;
}

.mci-recipe-phone {
  width: min(220px, 100%);
  min-height: 286px;
  padding: 14px;
  border-radius: 30px;
  background: #111827;
  box-shadow: 0 24px 54px rgba(15,23,42,.25);
}

.mci-recipe-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  padding: 6px;
  border-radius: 999px;
  background: rgba(255,255,255,.12);
}

.mci-recipe-tabs b,
.mci-recipe-tabs span {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: #cbd5e1;
  font-size: 12px;
}

.mci-recipe-tabs b {
  color: #fff;
  background: linear-gradient(135deg, var(--mci-doc-red), #f04438);
}

.mci-recipe-products {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.mci-recipe-products i {
  height: 88px;
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.92) 0 54%, rgba(255,255,255,.78) 54% 100%),
    linear-gradient(135deg, rgba(181,18,32,.18), rgba(37,99,235,.12));
}

.mci-ui-recipe-card__visual.is-asset {
  display: grid;
  align-content: space-between;
  gap: 16px;
}

.mci-recipe-metric {
  min-height: 190px;
  display: grid;
  align-content: center;
  gap: 8px;
  padding: 24px;
  border-radius: 24px;
  color: #fff;
  background:
    linear-gradient(115deg, rgba(255,255,255,.22), transparent 36%),
    linear-gradient(135deg, var(--mci-doc-red), #f04438);
  box-shadow: 0 22px 48px rgba(181,18,32,.24);
}

.mci-recipe-metric small,
.mci-recipe-metric span {
  color: rgba(255,255,255,.82);
  font-weight: 800;
}

.mci-recipe-metric b {
  color: #fff;
  font-size: 38px;
  line-height: 1;
}

.mci-recipe-action {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 12px;
  border-radius: 20px;
  background: rgba(255,255,255,.88);
  box-shadow: 0 14px 30px rgba(24,32,48,.10);
}

.mci-recipe-action button,
.mci-recipe-filter button {
  min-height: 42px;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(135deg, var(--mci-doc-red), #f04438);
  box-shadow: 0 12px 26px rgba(181,18,32,.20);
  font-weight: 900;
}

.mci-recipe-action button:first-child {
  color: var(--mci-doc-red-dark);
  border: 1px solid rgba(181,18,32,.18);
  background: #fff;
  box-shadow: none;
}

.mci-ui-recipe-card__visual.is-flow {
  display: grid;
  align-content: center;
  gap: 18px;
}

.mci-recipe-filter {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 16px;
  border-radius: 20px;
  background: rgba(255,255,255,.90);
  box-shadow: 0 14px 30px rgba(24,32,48,.10);
}

.mci-recipe-filter b {
  grid-column: 1 / -1;
  color: var(--mci-doc-ink);
  font-size: 20px;
}

.mci-recipe-filter span {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #f1f5f9;
  color: var(--mci-doc-muted);
  font-size: 13px;
  font-weight: 850;
}

.mci-recipe-flow {
  display: grid;
  grid-template-columns: 20px 1fr;
  gap: 10px 12px;
  padding: 16px;
  border-radius: 20px;
  background: rgba(255,255,255,.90);
  box-shadow: 0 14px 30px rgba(24,32,48,.10);
}

.mci-recipe-flow i {
  width: 18px;
  height: 18px;
  border: 4px solid #fff;
  border-radius: 999px;
  background: var(--mci-doc-red);
  box-shadow: 0 0 0 4px rgba(181,18,32,.12);
}

.mci-recipe-flow span {
  height: 40px;
  border-radius: 14px;
  background: linear-gradient(90deg, #fff, #eef2f7);
}

.mci-ui-scenario-panel,
.mci-ui-check-panel,
.mci-ui-third-panel {
  align-items: start;
}

.mci-ui-scenario-panel__intro {
  max-width: 760px;
}

.mci-ui-scenario-grid,
.mci-ui-check-grid,
.mci-ui-third-steps {
  display: grid;
  gap: 14px;
}

.mci-ui-scenario-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.mci-ui-check-grid,
.mci-ui-third-steps {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.mci-ui-scenario-grid article,
.mci-ui-check-grid article,
.mci-ui-third-steps article {
  position: relative;
  overflow: hidden;
  min-height: 178px;
  padding: 18px;
  border: 1px solid rgba(31,41,55,.10);
  border-radius: 20px;
  background:
    linear-gradient(145deg, rgba(255,255,255,.92), rgba(248,250,252,.72)),
    linear-gradient(135deg, rgba(181,18,32,.08), rgba(8,145,178,.08));
  box-shadow: 0 16px 38px rgba(24,32,48,.10);
  transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
}

.mci-ui-scenario-grid article:hover,
.mci-ui-check-grid article:hover,
.mci-ui-third-steps article:hover {
  transform: translateY(-4px);
  border-color: rgba(181,18,32,.22);
  box-shadow: 0 26px 58px rgba(24,32,48,.15);
}

.mci-ui-scenario-grid article::after,
.mci-ui-check-grid article::after,
.mci-ui-third-steps article::after {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, var(--mci-doc-red), var(--mci-doc-gold), var(--mci-doc-cyan));
}

.mci-ui-scenario-grid i {
  width: 42px;
  height: 42px;
  display: block;
  margin-bottom: 16px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--mci-doc-red), #f04438);
  box-shadow: 0 14px 30px rgba(181,18,32,.20);
}

.mci-ui-scenario-grid article:nth-child(2n) i {
  background: linear-gradient(135deg, var(--mci-doc-blue), var(--mci-doc-cyan));
  box-shadow: 0 14px 30px rgba(37,99,235,.16);
}

.mci-ui-scenario-grid article:nth-child(3n) i {
  background: linear-gradient(135deg, var(--mci-doc-gold), #f7c65d);
  box-shadow: 0 14px 30px rgba(217,162,58,.18);
}

.mci-ui-scenario-grid b,
.mci-ui-check-grid b,
.mci-ui-third-steps b {
  display: block;
  color: var(--mci-doc-ink);
  font-size: 17px;
  font-weight: 950;
  line-height: 1.35;
}

.mci-ui-scenario-grid span,
.mci-ui-check-grid span,
.mci-ui-third-steps em {
  display: block;
  margin-top: 10px;
  color: var(--mci-doc-muted);
  font-size: 13px;
  font-style: normal;
  line-height: 1.7;
}

.mci-ui-scenario-panel code,
.mci-ui-check-panel code,
.mci-ui-third-panel code {
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(181,18,32,.08);
  color: var(--mci-doc-red-dark);
  font-size: .92em;
  font-weight: 800;
}

.mci-ui-ai-panel {
  grid-template-columns: minmax(0, .82fr) minmax(420px, 1.18fr);
  align-items: center;
}

.mci-ui-ai-prompt {
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 20px;
  background: #111827;
  box-shadow: 0 22px 54px rgba(15,23,42,.22);
  overflow: hidden;
}

.mci-ui-ai-prompt span {
  display: block;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255,255,255,.10);
  color: #fff;
  font-size: 14px;
  font-weight: 900;
}

.mci-ui-ai-prompt pre {
  margin: 0;
  padding: 18px;
  overflow: auto;
  color: #e5e7eb;
  font-size: 13px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.mci-ui-check-panel {
  gap: 18px;
}

.mci-ui-check-panel h3 {
  margin-top: 10px;
}

.mci-ui-third-panel {
  grid-template-columns: minmax(0, .82fr) minmax(420px, 1.18fr);
  align-items: center;
}

.mci-ui-third-steps {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.mci-ui-third-steps article {
  min-height: 142px;
}

.mci-ui-third-steps span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  margin-bottom: 14px;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(135deg, var(--mci-doc-red), #f04438);
  box-shadow: 0 14px 30px rgba(181,18,32,.20);
  font-size: 14px;
  font-weight: 950;
}

.mci-ui-value-grid,
.mci-ui-component-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.mci-ui-value-grid article,
.mci-ui-component-grid article {
  position: relative;
  overflow: hidden;
  min-height: 150px;
  padding: 20px;
  border: 1px solid rgba(31, 41, 55, .10);
  border-radius: 18px;
  background: linear-gradient(180deg, #fff, #f8fafc);
  box-shadow: 0 12px 30px rgba(24, 32, 48, .08);
  transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
}

.mci-ui-component-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 20px 0 32px;
}

.mci-ui-component-grid article {
  min-height: 120px;
}

.mci-ui-preview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin: 24px 0 36px;
}

.mci-ui-preview-card {
  position: relative;
  overflow: hidden;
  padding: 14px;
  border: 1px solid rgba(31, 41, 55, .10);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.96), rgba(248,250,252,.92)),
    linear-gradient(135deg, rgba(181,18,32,.08), transparent);
  box-shadow: 0 18px 46px rgba(24, 32, 48, .12);
  transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
}

.mci-ui-preview-card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, var(--mci-doc-red), var(--mci-doc-gold), var(--mci-doc-cyan));
}

.mci-ui-preview-card:hover {
  transform: translateY(-4px);
  border-color: rgba(181, 18, 32, .24);
  box-shadow: 0 26px 62px rgba(24, 32, 48, .16);
}

.mci-ui-preview-card > strong {
  display: block;
  margin: 14px 4px 0;
  color: var(--mci-doc-ink);
  font-size: 18px;
  font-weight: 900;
}

.mci-ui-preview-card > p {
  min-height: 50px;
  margin: 8px 4px 2px;
  color: var(--mci-doc-muted);
  font-size: 14px;
  line-height: 1.65;
}

.mci-ui-shot {
  position: relative;
  overflow: hidden;
  min-height: 220px;
  padding: 18px;
  border: 1px solid rgba(31, 41, 55, .10);
  border-radius: 18px;
  background:
    linear-gradient(rgba(31, 41, 55, .05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(31, 41, 55, .05) 1px, transparent 1px),
    linear-gradient(135deg, #fff, #f4f7fb);
  background-size: 28px 28px, 28px 28px, 100% 100%;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.88);
}

.mci-ui-shot::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: -34%;
  width: 28%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.50), transparent);
  transform: skewX(-18deg);
  animation: mciDocShotSweep 5.8s ease-in-out infinite;
  pointer-events: none;
}

.mci-shot-page__top,
.mci-shot-navbar {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255,255,255,.84);
  box-shadow: 0 10px 24px rgba(24, 32, 48, .08);
  color: var(--mci-doc-ink);
  font-size: 13px;
  font-weight: 900;
}

.mci-shot-page__top span,
.mci-shot-page__top i,
.mci-shot-navbar i,
.mci-shot-navbar span {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--mci-doc-red), #f04438);
}

.mci-shot-page__hero {
  height: 74px;
  margin-top: 18px;
  border-radius: 20px;
  background: linear-gradient(135deg, var(--mci-doc-red), #f04438);
  box-shadow: 0 18px 36px rgba(181,18,32,.24);
}

.mci-shot-page__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.mci-shot-page__grid span {
  height: 56px;
  border-radius: 16px;
  background: rgba(255,255,255,.86);
  box-shadow: 0 10px 22px rgba(24, 32, 48, .08);
}

.mci-shot-phone {
  width: min(172px, 100%);
  min-height: 240px;
  margin: 0 auto;
  padding: 12px;
  border-radius: 28px;
  background: #111827;
}

.mci-shot-phone__body {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.mci-shot-phone__body em {
  display: block;
  height: 42px;
  border-radius: 14px;
  background: linear-gradient(90deg, rgba(255,255,255,.92), rgba(255,255,255,.70));
}

.mci-shot-buttons {
  display: grid;
  align-content: center;
  gap: 12px;
}

.mci-shot-buttons button,
.mci-shot-action__bar button,
.mci-shot-theme button {
  min-height: 38px;
  border: 0;
  border-radius: 999px;
  color: #fff;
  font-weight: 900;
  background: linear-gradient(135deg, var(--mci-doc-red), #f04438);
  box-shadow: 0 12px 26px rgba(181, 18, 32, .20);
}

.mci-shot-buttons button:nth-child(2) {
  color: #3a2500;
  background: linear-gradient(135deg, #f7c65d, var(--mci-doc-gold));
}

.mci-shot-buttons button:nth-child(3) {
  color: var(--mci-doc-red-dark);
  border: 1px solid rgba(181, 18, 32, .18);
  background: #fff;
  box-shadow: 0 10px 20px rgba(24, 32, 48, .08);
}

.mci-shot-buttons button:nth-child(4) {
  background: linear-gradient(135deg, var(--mci-doc-blue), var(--mci-doc-cyan));
  box-shadow: 0 12px 26px rgba(37,99,235,.18);
}

.mci-shot-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
}

.mci-shot-card span,
.mci-shot-section label {
  width: fit-content;
  padding: 4px 10px;
  border-radius: 999px;
  color: var(--mci-doc-red-dark);
  background: rgba(181,18,32,.10);
  font-size: 12px;
  font-weight: 900;
}

.mci-shot-card strong,
.mci-shot-metric b,
.mci-shot-product b,
.mci-shot-theme b {
  color: var(--mci-doc-ink);
  font-size: 22px;
  font-weight: 950;
}

.mci-shot-card p {
  margin: 0;
  color: var(--mci-doc-muted);
}

.mci-shot-section h4,
.mci-shot-richtext h4 {
  margin: 10px 0 12px;
  color: var(--mci-doc-ink);
  font-size: 22px;
}

.mci-shot-section div {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.mci-shot-section div span {
  height: 82px;
  border-radius: 16px;
  background: linear-gradient(180deg, #fff, #eef2f7);
  box-shadow: 0 12px 26px rgba(24,32,48,.09);
}

.mci-shot-cell {
  display: grid;
  align-content: center;
  gap: 12px;
}

.mci-shot-cell div {
  min-height: 70px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  border-radius: 18px;
  background: rgba(255,255,255,.90);
  box-shadow: 0 12px 26px rgba(24,32,48,.08);
}

.mci-shot-cell i {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--mci-doc-red), #f04438);
}

.mci-shot-cell span {
  flex: 1;
  display: grid;
  gap: 4px;
}

.mci-shot-cell b {
  color: var(--mci-doc-ink);
  font-size: 14px;
}

.mci-shot-cell em {
  color: var(--mci-doc-muted);
  font-size: 12px;
  font-style: normal;
}

.mci-shot-cell strong {
  color: var(--mci-doc-red);
  font-size: 24px;
}

.mci-shot-tabs {
  min-height: 100px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px;
  border-radius: 999px;
  background: rgba(255,255,255,.88);
  box-shadow: 0 14px 28px rgba(24, 32, 48, .10);
}

.mci-shot-tabs span {
  flex: 1;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--mci-doc-muted);
  font-size: 13px;
  font-weight: 900;
}

.mci-shot-tabs .is-active {
  color: #fff;
  background: linear-gradient(135deg, var(--mci-doc-red), #f04438);
  box-shadow: 0 12px 24px rgba(181,18,32,.20);
}

.mci-shot-metric {
  display: grid;
  align-content: center;
  gap: 12px;
  color: #fff;
  background:
    linear-gradient(115deg, rgba(255,255,255,.24), transparent 35%),
    linear-gradient(135deg, var(--mci-doc-red), #f04438);
}

.mci-shot-metric small,
.mci-shot-metric span {
  color: rgba(255,255,255,.82);
  font-weight: 800;
}

.mci-shot-metric b {
  color: #fff;
  font-size: 34px;
}

.mci-shot-action {
  padding: 0;
  background: linear-gradient(180deg, #fff, #f4f7fb);
}

.mci-shot-action__content {
  height: 145px;
  margin: 16px;
  border-radius: 18px;
  background:
    linear-gradient(90deg, rgba(181,18,32,.10), transparent),
    linear-gradient(180deg, #fff, #eef2f7);
}

.mci-shot-action__bar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 12px;
  border-top: 1px solid rgba(31,41,55,.10);
  background: rgba(255,255,255,.92);
}

.mci-shot-action__bar button:first-child {
  color: var(--mci-doc-red-dark);
  border: 1px solid rgba(181,18,32,.18);
  background: #fff;
  box-shadow: none;
}

.mci-shot-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.mci-shot-avatar span {
  width: 54px;
  height: 54px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255,255,255,.76);
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(135deg, var(--mci-doc-red), #f04438);
  box-shadow: 0 14px 28px rgba(181,18,32,.20);
  font-weight: 950;
}

.mci-shot-avatar span:nth-child(2) { background: linear-gradient(135deg, var(--mci-doc-gold), #f7c65d); color: #3a2500; }
.mci-shot-avatar span:nth-child(3) { background: linear-gradient(135deg, var(--mci-doc-blue), var(--mci-doc-cyan)); }
.mci-shot-avatar span:nth-child(4) { background: linear-gradient(135deg, #7c3aed, #a78bfa); }

.mci-shot-product {
  display: grid;
  align-content: start;
  gap: 10px;
}

.mci-shot-product div {
  height: 104px;
  border-radius: 18px;
  background:
    linear-gradient(135deg, rgba(37,99,235,.14), transparent),
    linear-gradient(180deg, #fff, #eaf0f8);
  box-shadow: inset 0 0 0 1px rgba(31,41,55,.08);
}

.mci-shot-product b {
  font-size: 18px;
}

.mci-shot-product span {
  color: var(--mci-doc-red);
  font-size: 24px;
  font-weight: 950;
}

.mci-shot-skeleton {
  display: grid;
  grid-template-columns: 64px 1fr;
  align-content: center;
  gap: 14px;
}

.mci-shot-skeleton i,
.mci-shot-skeleton span {
  display: block;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(226,232,240,.72), rgba(255,255,255,.90), rgba(226,232,240,.72));
  background-size: 220% 100%;
  animation: mciDocSkeleton 1.2s ease-in-out infinite;
}

.mci-shot-skeleton i {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  grid-row: span 2;
}

.mci-shot-skeleton span {
  height: 14px;
}

.mci-shot-state {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
}

.mci-shot-state i {
  width: 62px;
  height: 62px;
  border: 2px solid rgba(181,18,32,.22);
  border-radius: 999px;
  position: relative;
}

.mci-shot-state i::after {
  content: "";
  position: absolute;
  left: 18px;
  right: 18px;
  top: 29px;
  height: 2px;
  background: rgba(181,18,32,.28);
}

.mci-shot-state b {
  color: var(--mci-doc-ink);
  font-size: 18px;
}

.mci-shot-state span {
  color: var(--mci-doc-muted);
  font-size: 13px;
}

.mci-shot-richtext {
  display: grid;
  align-content: start;
  gap: 8px;
}

.mci-shot-richtext div {
  height: 92px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--mci-doc-blue), var(--mci-doc-cyan));
}

.mci-shot-richtext h4,
.mci-shot-richtext p {
  margin: 0;
}

.mci-shot-richtext p {
  color: var(--mci-doc-muted);
  line-height: 1.65;
}

.mci-shot-theme {
  display: grid;
  align-content: center;
  gap: 16px;
}

.mci-shot-theme div {
  display: flex;
  gap: 8px;
}

.mci-shot-theme div span {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  box-shadow: 0 8px 18px rgba(24,32,48,.12);
}

.mci-shot-theme div span:nth-child(1) { background: linear-gradient(135deg, var(--mci-doc-red), #f04438); }
.mci-shot-theme div span:nth-child(2) { background: linear-gradient(135deg, var(--mci-doc-gold), #f7c65d); }
.mci-shot-theme div span:nth-child(3) { background: linear-gradient(135deg, #16a34a, #34d399); }
.mci-shot-theme div span:nth-child(4) { background: linear-gradient(135deg, var(--mci-doc-blue), #60a5fa); }
.mci-shot-theme div span:nth-child(5) { background: linear-gradient(135deg, #7c3aed, #a78bfa); }

.mci-ui-shot.mci-shot-metric,
.mci-ui-shot.mci-shot-asset {
  background:
    linear-gradient(115deg, rgba(255,255,255,.24), transparent 35%),
    linear-gradient(135deg, var(--mci-doc-red), #f04438) !important;
}

.mci-ui-shot.mci-shot-metric *,
.mci-ui-shot.mci-shot-asset * {
  color: #fff !important;
}

.mci-shot-form {
  display: grid;
  align-content: center;
  gap: 10px;
}

.mci-shot-form label {
  color: var(--mci-doc-muted);
  font-size: 13px;
  font-weight: 900;
}

.mci-shot-form span,
.mci-shot-form p {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid rgba(31,41,55,.10);
  border-radius: 12px;
  background: rgba(255,255,255,.88);
  color: #94a3b8;
  font-size: 14px;
}

.mci-shot-form p {
  min-height: 52px;
}

.mci-shot-filter {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-content: center;
  gap: 10px;
}

.mci-shot-filter b,
.mci-shot-filter button {
  grid-column: 1 / -1;
}

.mci-shot-filter b {
  color: var(--mci-doc-ink);
  font-size: 22px;
}

.mci-shot-filter span {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(255,255,255,.90);
  color: var(--mci-doc-muted);
  font-size: 13px;
  font-weight: 850;
  box-shadow: 0 8px 18px rgba(24,32,48,.08);
}

.mci-shot-filter button,
.mci-shot-modal button {
  min-height: 38px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--mci-doc-red), #f04438);
  color: #fff;
  font-weight: 900;
  box-shadow: 0 12px 26px rgba(181,18,32,.20);
}

.mci-shot-asset {
  display: grid;
  align-content: center;
  gap: 12px;
}

.mci-shot-asset small,
.mci-shot-asset span {
  color: rgba(255,255,255,.82);
  font-weight: 800;
}

.mci-shot-asset b {
  color: #fff;
  font-size: 36px;
  font-weight: 950;
}

.mci-shot-order {
  display: grid;
  align-content: center;
  gap: 12px;
}

.mci-shot-order > div,
.mci-shot-order section {
  padding: 12px;
  border-radius: 16px;
  background: rgba(255,255,255,.92);
  box-shadow: 0 10px 24px rgba(24,32,48,.08);
}

.mci-shot-order > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--mci-doc-muted);
  font-size: 12px;
  font-weight: 800;
}

.mci-shot-order em {
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(15,159,110,.12);
  color: #0f9f6e;
  font-style: normal;
}

.mci-shot-order section {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.mci-shot-order i {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--mci-doc-blue), var(--mci-doc-cyan));
}

.mci-shot-order p {
  display: grid;
  gap: 4px;
  margin: 0;
}

.mci-shot-order b {
  color: var(--mci-doc-ink);
  font-size: 14px;
}

.mci-shot-order small {
  color: var(--mci-doc-muted);
  font-size: 11px;
}

.mci-shot-order strong {
  color: var(--mci-doc-red);
  font-size: 18px;
}

.mci-shot-modal {
  display: grid;
  place-items: center;
  background:
    linear-gradient(135deg, rgba(15,23,42,.32), rgba(15,23,42,.18)),
    linear-gradient(135deg, #fff, #f4f7fb);
}

.mci-shot-modal section {
  width: min(100%, 230px);
  padding: 16px;
  border-radius: 18px;
  background: rgba(255,255,255,.95);
  box-shadow: 0 20px 48px rgba(24,32,48,.18);
}

.mci-shot-modal b {
  color: var(--mci-doc-ink);
  font-size: 18px;
}

.mci-shot-modal p {
  margin: 10px 0;
  color: var(--mci-doc-muted);
  font-size: 13px;
}

.mci-shot-modal div {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.mci-shot-modal button:first-child {
  color: var(--mci-doc-red-dark);
  border: 1px solid rgba(181,18,32,.16);
  background: #fff;
  box-shadow: none;
}

.mci-shot-upload {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  border-style: dashed;
}

.mci-shot-upload i {
  width: 62px;
  height: 62px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--mci-doc-red), #f04438);
  box-shadow: 0 14px 30px rgba(181,18,32,.22);
  position: relative;
}

.mci-shot-upload i::before,
.mci-shot-upload i::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 24px;
  height: 4px;
  border-radius: 999px;
  background: #fff;
  transform: translate(-50%, -50%);
}

.mci-shot-upload i::after {
  transform: translate(-50%, -50%) rotate(90deg);
}

.mci-shot-upload b {
  color: var(--mci-doc-ink);
  font-size: 18px;
}

.mci-shot-upload span {
  color: var(--mci-doc-muted);
  font-size: 13px;
}

.mci-shot-timeline {
  display: grid;
  align-content: center;
  gap: 12px;
}

.mci-shot-timeline div {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 10px;
  position: relative;
}

.mci-shot-timeline div:not(:last-child)::after {
  content: "";
  position: absolute;
  left: 9px;
  top: 22px;
  bottom: -13px;
  width: 2px;
  background: rgba(181,18,32,.18);
}

.mci-shot-timeline i {
  width: 18px;
  height: 18px;
  border: 4px solid #fff;
  border-radius: 999px;
  background: var(--mci-doc-red);
  box-shadow: 0 0 0 4px rgba(181,18,32,.12);
  z-index: 1;
}

.mci-shot-timeline span {
  display: grid;
  gap: 4px;
  padding: 10px;
  border-radius: 14px;
  background: rgba(255,255,255,.90);
  box-shadow: 0 8px 18px rgba(24,32,48,.08);
}

.mci-shot-timeline b {
  color: var(--mci-doc-ink);
  font-size: 13px;
}

.mci-shot-timeline small {
  color: var(--mci-doc-muted);
  font-size: 11px;
}

.mci-shot-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-content: center;
  gap: 10px;
}

.mci-shot-steps div {
  min-height: 92px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  border: 1px solid rgba(31,41,55,.10);
  border-radius: 16px;
  background: rgba(255,255,255,.90);
  color: var(--mci-doc-muted);
  font-size: 22px;
  font-weight: 950;
  box-shadow: 0 10px 22px rgba(24,32,48,.08);
}

.mci-shot-steps div span {
  color: inherit;
  font-size: 12px;
}

.mci-shot-steps .is-done,
.mci-shot-steps .is-active {
  color: #fff;
  background: linear-gradient(135deg, var(--mci-doc-red), #f04438);
  box-shadow: 0 14px 30px rgba(181,18,32,.20);
}

.mci-shot-steps .is-active {
  background: linear-gradient(135deg, var(--mci-doc-blue), var(--mci-doc-cyan));
}

.mci-ui-value-grid article::before,
.mci-ui-component-grid article::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, var(--mci-doc-red), var(--mci-doc-gold), var(--mci-doc-cyan));
}

.mci-ui-value-grid article:hover,
.mci-ui-component-grid article:hover {
  transform: translateY(-3px);
  border-color: rgba(181, 18, 32, .20);
  box-shadow: 0 20px 44px rgba(24, 32, 48, .13);
}

.mci-ui-value-grid span {
  color: rgba(181, 18, 32, .22);
  font-size: 34px;
  font-weight: 900;
  line-height: 1;
}

.mci-ui-value-grid h3,
.mci-ui-component-grid strong {
  display: block;
  margin: 10px 0 0;
  color: var(--mci-doc-ink);
  font-size: 18px;
  font-weight: 900;
}

.mci-ui-value-grid p,
.mci-ui-component-grid span {
  display: block;
  margin-top: 10px;
  color: var(--mci-doc-muted);
  font-size: 14px;
  line-height: 1.7;
}

@keyframes mciDocSweep {
  0%, 44% { transform: translateX(0) skewX(-18deg); opacity: 0; }
  58% { opacity: .72; }
  100% { transform: translateX(620%) skewX(-18deg); opacity: 0; }
}

@keyframes mciDocShotSweep {
  0%, 46% { transform: translateX(0) skewX(-18deg); opacity: 0; }
  58% { opacity: .72; }
  100% { transform: translateX(620%) skewX(-18deg); opacity: 0; }
}

@keyframes mciDocSkeleton {
  0% { background-position: 120% 0; }
  100% { background-position: -120% 0; }
}

.dark .mci-ui-hero {
  border-color: rgba(255,255,255,.12);
  background:
    linear-gradient(115deg, rgba(248,113,113,.18), transparent 38%),
    linear-gradient(135deg, rgba(34,211,238,.16), transparent 42%),
    linear-gradient(180deg, #111827, #0b1020);
}

.dark .mci-ui-hero h2,
.dark .mci-ui-preview-card > strong,
.dark .mci-shot-card strong,
.dark .mci-shot-metric b,
.dark .mci-shot-product b,
.dark .mci-shot-theme b,
.dark .mci-shot-state b,
.dark .mci-shot-section h4,
.dark .mci-shot-richtext h4 {
  color: #f8fafc;
}

.dark .mci-ui-hero p,
.dark .mci-ui-preview-card > p,
.dark .mci-shot-card p,
.dark .mci-shot-richtext p,
.dark .mci-shot-state span {
  color: #cbd5e1;
}

.dark .mci-ui-preview-card,
.dark .mci-ui-value-grid article,
.dark .mci-ui-component-grid article,
.dark .mci-ui-shot,
.dark .mci-ui-recipe-card,
.dark .mci-ui-recipe-card__visual,
.dark .mci-ui-showcase,
.dark .mci-ui-theme-lab,
.dark .mci-ui-structure,
.dark .mci-ui-runtime-panel,
.dark .mci-ui-guard-panel,
.dark .mci-ui-scenario-panel,
.dark .mci-ui-ai-panel,
.dark .mci-ui-check-panel,
.dark .mci-ui-third-panel,
.dark .mci-ui-template-grid article {
  border-color: rgba(255,255,255,.10);
  background:
    linear-gradient(180deg, rgba(30,41,59,.92), rgba(15,23,42,.92)),
    linear-gradient(135deg, rgba(248,113,113,.10), transparent);
  box-shadow: 0 18px 46px rgba(0,0,0,.30);
}

.dark .mci-ui-console,
.dark .mci-shot-page__top,
.dark .mci-shot-navbar,
.dark .mci-shot-cell div,
.dark .mci-shot-tabs,
.dark .mci-shot-action__bar {
  background: rgba(15,23,42,.86);
  border-color: rgba(255,255,255,.10);
}

.dark .mci-shot-cell b,
.dark .mci-shot-tabs span,
.dark .mci-shot-filter b,
.dark .mci-shot-form label,
.dark .mci-shot-order b,
.dark .mci-shot-modal b,
.dark .mci-shot-upload b,
.dark .mci-shot-timeline b,
.dark .mci-ui-showcase h3,
.dark .mci-ui-theme-lab h3,
.dark .mci-ui-structure h3,
.dark .mci-ui-runtime-panel h3,
.dark .mci-ui-flow-card b,
.dark .mci-ui-theme-grid b,
.dark .mci-ui-guard-grid b,
.dark .mci-ui-template-grid strong,
.dark .mci-ui-scenario-grid b,
.dark .mci-ui-check-grid b,
.dark .mci-ui-third-steps b,
.dark .mci-ui-recipe-card__body h3,
.dark .mci-recipe-browser b,
.dark .mci-recipe-filter b,
.dark .vp-doc._doc_system-engine_microi-ui h2 {
  color: #e2e8f0;
}

.dark .mci-ui-showcase p,
.dark .mci-ui-theme-lab p,
.dark .mci-ui-structure p,
.dark .mci-ui-runtime-panel p,
.dark .mci-ui-flow-card span,
.dark .mci-ui-theme-grid span,
.dark .mci-ui-guard-grid span,
.dark .mci-ui-template-grid p,
.dark .mci-ui-scenario-grid span,
.dark .mci-ui-check-grid span,
.dark .mci-ui-third-steps em,
.dark .mci-ui-recipe-card__body p,
.dark .mci-shot-filter span,
.dark .mci-shot-form span,
.dark .mci-shot-form p,
.dark .mci-shot-order small,
.dark .mci-shot-upload span,
.dark .mci-shot-timeline small {
  color: #cbd5e1;
}

.dark .mci-ui-flow-card,
.dark .mci-ui-theme-grid article,
.dark .mci-ui-guard-grid article,
.dark .mci-shot-form span,
.dark .mci-shot-form p,
.dark .mci-shot-filter span,
.dark .mci-shot-order > div,
.dark .mci-shot-order section,
.dark .mci-shot-modal section,
.dark .mci-shot-timeline span,
.dark .mci-shot-steps div,
.dark .mci-ui-scenario-grid article,
.dark .mci-ui-check-grid article,
.dark .mci-ui-third-steps article,
.dark .mci-recipe-browser,
.dark .mci-recipe-mini-grid i,
.dark .mci-recipe-action,
.dark .mci-recipe-filter,
.dark .mci-recipe-flow {
  background: rgba(15,23,42,.86);
  border-color: rgba(255,255,255,.10);
}

.dark .mci-ui-scenario-panel code,
.dark .mci-ui-check-panel code,
.dark .mci-ui-third-panel code,
.dark .mci-ui-guard-grid code,
.dark .mci-ui-recipe-card__body code {
  background: rgba(248,113,113,.12);
  color: #fecaca;
}

.dark .mci-ui-shot.mci-shot-metric,
.dark .mci-ui-shot.mci-shot-asset {
  background:
    linear-gradient(115deg, rgba(255,255,255,.20), transparent 35%),
    linear-gradient(135deg, #b51220, #f04438) !important;
}

@media (max-width: 960px) {
  .mci-ui-hero {
    grid-template-columns: 1fr;
  }

  .mci-ui-value-grid,
  .mci-ui-component-grid,
  .mci-ui-preview-grid,
  .mci-ui-code-grid,
  .mci-ui-template-grid,
  .mci-ui-scenario-grid,
  .mci-ui-check-grid,
  .mci-ui-third-steps,
  .mci-ui-recipe-card,
  .mci-ui-showcase,
  .mci-ui-theme-lab,
  .mci-ui-structure,
  .mci-ui-runtime-panel,
  .mci-ui-guard-panel,
  .mci-ui-ai-panel,
  .mci-ui-third-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mci-ui-showcase,
  .mci-ui-theme-lab,
  .mci-ui-structure,
  .mci-ui-runtime-panel,
  .mci-ui-guard-panel,
  .mci-ui-ai-panel,
  .mci-ui-third-panel {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .mci-ui-hero {
    padding: 24px;
    border-radius: 20px;
  }

  .mci-ui-hero h2 {
    font-size: 32px;
  }

  .mci-ui-value-grid,
  .mci-ui-component-grid,
  .mci-ui-preview-grid,
  .mci-ui-code-grid,
  .mci-ui-template-grid,
  .mci-ui-scenario-grid,
  .mci-ui-check-grid,
  .mci-ui-third-steps,
  .mci-ui-guard-grid,
  .mci-ui-theme-grid {
    grid-template-columns: 1fr;
  }

  .mci-ui-runtime-panel pre,
  .mci-ui-code-grid pre,
  .mci-ui-recipe-card__body pre,
  .mci-code-window {
    font-size: 12px;
  }

  .mci-ui-recipe-card {
    padding: 16px;
    border-radius: 22px;
  }

  .mci-ui-recipe-card__visual {
    min-height: 260px;
  }
}
</style>
