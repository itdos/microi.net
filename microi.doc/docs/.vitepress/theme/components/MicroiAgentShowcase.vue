<template>
  <section class="microi-code-showcase" aria-labelledby="microi-code-title" @pointermove="trackPointer" @pointerleave="resetPointer">
    <div class="microi-code-ambient" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="microi-code-hero">
      <div class="microi-code-hero__copy">
        <p class="microi-code-kicker"><span></span>MICROI AGENT <b>HARNESS</b></p>
        <h2 id="microi-code-title">让 AI 在<strong>完整业务底座</strong>上工作</h2>
        <p class="microi-code-lead">代码、吾码账号、AI 中转站、MCP 与 30+ 成熟引擎，在一个桌面工作台协同。</p>
        <div class="microi-code-actions">
          <div class="microi-code-platform-download">
            <a class="is-primary" :href="downloadUrls.windows" target="_blank" rel="noopener"><DownloadIcon />下载 Windows 完整版 <small v-if="liveVersions.windows">v{{ liveVersions.windows }}</small></a>
            <a class="microi-code-store-link" href="https://apps.microsoft.com/detail/9NKCS76ZMFXR" target="_blank" rel="noopener noreferrer">Microsoft Store <small>已发布</small><span aria-hidden="true">↗</span></a>
          </div>
          <div class="microi-code-platform-download">
            <a :href="downloadUrls.mac" target="_blank" rel="noopener"><DownloadIcon />下载 macOS <small v-if="liveVersions.mac">v{{ liveVersions.mac }}</small></a>
            <a class="microi-code-store-link" href="https://apps.apple.com/app/id6818076490" target="_blank" rel="noopener noreferrer">Mac App Store <small>尚未开放下载</small><span aria-hidden="true">↗</span></a>
          </div>
        </div>
        <p class="microi-code-store-install"><a href="https://get.microsoft.com/installer/download/9NKCS76ZMFXR?referrer=appbadge" target="_blank" rel="noopener noreferrer">微软签名 EXE 在线安装器 <span aria-hidden="true">↗</span></a><span>商店版 1.3.3 · Windows 10 2004+ / 11 · x64 · 需联网</span></p>
        <p class="microi-code-store-note">官网 Windows 完整版 1.3.6 EXE 未签名；在线安装器安装微软签名商店版。macOS 1.3.6 DMG 已签名、公证，Mac 商店尚未开放下载。</p>
        <aside class="microi-code-repair-candidate" aria-label="Windows 安装修复候选">
          <strong>Windows 安装修复</strong>
          <p>1.3.6 升级目录切换失败时，可安装 1.3.7 候选复测。保留原目录与配置；Windows 真机验收待完成。</p>
          <div><a href="https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.8/requests/5bde0d6abbab6cd36fd0c79251a4413c475a90cd1b22cf394890b1027c2af593/assets/Microi-Agent-1.3.7-windows-x64-setup.exe" target="_blank" rel="noopener noreferrer">Windows 1.3.7 安装修复候选 ↗</a><a href="https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.8/requests/5bde0d6abbab6cd36fd0c79251a4413c475a90cd1b22cf394890b1027c2af593/assets/Microi-Agent-1.3.7-windows-native-acceptance.zip" target="_blank" rel="noopener noreferrer">一键原生验收工具 ↗</a></div>
        </aside>
        <ul class="microi-code-facts" aria-label="Microi Agent 产品事实">
          <li><strong>官方账号</strong><span>登录即用 AI 中转站</span></li>
          <li><strong>多端桌面</strong><span>Windows 与 macOS</span></li>
          <li><strong>原生能力</strong><span>MCP · Skills · Harness</span></li>
        </ul>
      </div>
      <a class="microi-code-hero__visual" href="/images/product-screenshots/microi-code-ai-remove-light.png" data-fancybox="microi-code-gallery">
        <img src="/images/product-screenshots/microi-code-ai-remove-light.png" alt="Microi Agent AI 图像处理工作台">
        <span><strong>29 项图像能力</strong><small>参数、上传、任务与结果都在桌面端完成</small></span>
      </a>
    </div>

    <div class="microi-code-section-head">
      <div><p>PRODUCT TOUR</p><h2>从对话到完整交付，都在一个工作台</h2></div>
      <span>浅色与深色主题 · 自适应宽屏 · 真实任务轨迹</span>
    </div>
    <div class="microi-code-gallery">
      <a v-for="shot in screenshots" :key="shot.src" :href="shot.src" data-fancybox="microi-code-gallery">
        <img :src="shot.src" :alt="shot.alt">
        <span><strong>{{ shot.title }}</strong><small>{{ shot.caption }}</small></span>
      </a>
    </div>

    <div class="microi-code-flow" aria-label="Microi Agent 工作流程">
      <article><span>01</span><h3>登录与连接</h3><p>使用吾码账号，或连接自己的模型与业务租户。</p></article>
      <article><span>02</span><h3>选择能力</h3><p>对话、数据、图像、视频、音乐与应用统一进入。</p></article>
      <article><span>03</span><h3>完成交付</h3><p>Harness 执行任务，吾码引擎承接权限、数据与业务。</p></article>
    </div>

    <section id="版本记录" class="microi-code-history" aria-labelledby="microi-code-history-title">
      <button class="microi-code-history-toggle" type="button" :aria-expanded="historyOpen" aria-controls="microi-code-history-content" @click="historyOpen = !historyOpen">
        <span><small>RELEASES</small><strong id="microi-code-history-title">版本记录</strong></span>
        <span class="microi-code-history-toggle__meta">{{ releases.length }} 个安装包 <span aria-hidden="true">{{ historyOpen ? '收起 −' : '展开 +' }}</span></span>
      </button>
      <div v-show="historyOpen" id="microi-code-history-content">
      <div class="release-list">
        <article v-for="release in visibleReleases" :key="`${release.version}-${release.platform}`">
          <div><strong>v{{ release.version }}</strong><span>{{ release.platform }}</span></div>
          <p>{{ release.note }}</p>
          <a :href="release.url">下载归档</a>
          <code v-if="release.sha256" class="release-checksum">SHA-256 {{ release.sha256 }}</code>
        </article>
      </div>
      <nav v-if="pageCount > 1" class="microi-code-history-pages" aria-label="版本记录分页">
        <button type="button" :disabled="historyPage === 1" @click="historyPage--">上一页</button>
        <span>第 {{ historyPage }} / {{ pageCount }} 页</span>
        <button type="button" :disabled="historyPage === pageCount" @click="historyPage++">下一页</button>
      </nav>
      </div>
    </section>

    <footer class="microi-code-credit">
      <div><span>OPEN SOURCE FOUNDATION</span><strong>尊重上游，持续演进</strong></div>
      <p>Microi Agent 基于 <a href="https://github.com/dataelement/dsh-desktop" target="_blank" rel="noopener noreferrer">dsh-desktop</a> 与 <a href="https://github.com/deepseek-ai/deepseek-harness" target="_blank" rel="noopener noreferrer">DeepSeek Harness</a> 二次开发，保留 DataElement 的 MIT 版权声明。</p>
    </footer>
  </section>
</template>

<script setup>
import { computed, h, onMounted, reactive, ref } from 'vue'
import { installerFromYaml } from '../utils/microi-agent-download.mjs'

const svgIcon = (path, fill = 'none') => () => h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', fill }, [h('path', { d: path })])
const DownloadIcon = svgIcon('M12 4v10m0 0 4-4m-4 4-4-4M5 19h14')

// 更新清单由 iTdos 接口引擎发布；版本发布后官网源码无需随之改动。
const liveVersions = reactive({ windows: '1.3.6', mac: '1.3.6' })
// 下载按钮始终使用永久入口；点击时由官方清单选择当前安装包，首屏不依赖异步请求。
const downloadUrls = reactive({
  windows: 'https://microi.net/download/microi-agent/latest.html?platform=windows',
  mac: 'https://microi.net/download/microi-agent/latest.html?platform=mac'
})
const UPDATE_BASE = 'https://api.itdos.com/microi-code/updates/latest/'
function versionFromYaml(yaml) {
  return /^version:\s*([0-9]+\.[0-9]+\.[0-9]+)\s*$/m.exec(yaml)?.[1] || ''
}
onMounted(async () => {
  await Promise.all([
    fetch(UPDATE_BASE + 'latest.yml', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text() }).then(yaml => { if (installerFromYaml(yaml, 'windows')) liveVersions.windows = versionFromYaml(yaml) || liveVersions.windows }).catch(() => {}),
    fetch(UPDATE_BASE + 'latest-mac.yml', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text() }).then(yaml => {
      liveVersions.mac = versionFromYaml(yaml) || liveVersions.mac
    }).catch(() => {})
  ])
})

function trackPointer(event) {
  const target = event.currentTarget
  const bounds = target.getBoundingClientRect()
  target.style.setProperty('--pointer-x', `${event.clientX - bounds.left}px`)
  target.style.setProperty('--pointer-y', `${event.clientY - bounds.top}px`)
  target.style.setProperty('--pointer-opacity', '1')
}

function resetPointer(event) {
  event.currentTarget.style.setProperty('--pointer-opacity', '.45')
}

const windows = {
  latest: 'https://static.itdos.com/itdos/microi-code/latest/Microi-Code-latest-windows-x64-setup.exe',
  archive: 'https://static.itdos.com/itdos/microi-code/1.1.3/29f4aef8fede/202609/Microi-Code-1_1_3-windows-x64-setup.exe',
  sha256: '29f4aef8fede578500da3557c3d8350129e035337e008f5e1aaa69162ddb0aee'
}

const mac = {
  archive: 'https://static.itdos.com/itdos/microi-code/1.1.3/3fedbfacdfe9/202609/Microi-Code-1_1_3-mac-x64.dmg',
  sha256: '3fedbfacdfe952bf33c8f406a783cb1af83255d621451f3c31e140d062ad6bfd'
}

const screenshots = [
  { src: '/images/product-screenshots/microi-code-ai-center-dark.jpg', alt: 'Microi Agent 深色 AI 能力中心', title: 'AI 能力中心', caption: '能力与来源清晰分层' },
  { src: '/images/product-screenshots/microi-code-home-light.jpg', alt: 'Microi Agent 浅色首页', title: '首页入口', caption: '7 项主能力与 29 项图像工具' },
  { src: '/images/product-screenshots/microi-code-task-workspace.png', alt: 'Microi Agent 任务工作区', title: '真实任务', caption: '轨迹、文件与后台任务统一查看' },
  { src: '/images/product-screenshots/microi-code-ai-remove-light.png', alt: 'Microi Agent AI 消除功能', title: '原生工作台', caption: '上传、参数、生成与下载闭环' }
]

const releases = [
  { version: '1.3.7', platform: "Windows x64 候选", note: "安装目录切换修复 · 未签名测试候选 · 六项 Wine NSIS 回归通过 · Windows 原生待验收", url: "https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.8/requests/5bde0d6abbab6cd36fd0c79251a4413c475a90cd1b22cf394890b1027c2af593/assets/Microi-Agent-1.3.7-windows-x64-setup.exe", sha256: "91a5ab8d9a29382347020a0ff3e43536c0ed26d800a5d192b11fef4317853ad2" },
  { version: '1.3.6', platform: "macOS Universal", note: "启动修复 · 签名公证 · Intel 完整应用启动、重启已验收 · macOS 13.5+", url: "https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.6/requests/5f22ed5595421f9c10db4bb5930d7df17b33dc6ba6ba54a70c366c374f00f247/assets/Microi-Agent-1.3.6-mac-universal.dmg", sha256: "5d1e38ae2e4ddadf460a880daf0f2b61f352779d9943e4f584cba6f07c6fc76c" },
  { version: '1.3.6', platform: "macOS Universal ZIP", note: "启动修复自动更新包 · 已签名公证 · macOS 13.5+", url: "https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.6/requests/5f22ed5595421f9c10db4bb5930d7df17b33dc6ba6ba54a70c366c374f00f247/assets/Microi-Agent-1.3.6-mac-universal.zip", sha256: "fa450561060efee3bc5ff660cd89397c1c8a508b892ede0776e1fec1f8d43831" },
  { version: '1.3.6', platform: "Windows x64", note: "启动链路修复 · 未签名公开测试 · Windows 10/11 x64 · 原生安装待验收", url: "https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.6/requests/5f22ed5595421f9c10db4bb5930d7df17b33dc6ba6ba54a70c366c374f00f247/assets/Microi-Agent-1.3.6-windows-x64-setup.exe", sha256: "a93cbb4b15472944f68cc8b42be67cbd358e7fc436dd046b941b8bf8807ebb16" },
  { version: '1.3.5', platform: "macOS Universal", note: "上游同步 · Developer ID 签名、Apple 公证与 Gatekeeper 通过 · macOS 13.5+", url: "https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.5/requests/6c74a2840b3e11a39779febb09e2a02889a97878b6b82b3cedeae89dbdaa9ff7/assets/Microi-Agent-1.3.5-mac-universal.dmg", sha256: "001df6d3a1695672c51cc04470cd441f260d22f152143e2b8b830a0bafb04ecc" },
  { version: '1.3.5', platform: "macOS Universal ZIP", note: "上游同步自动更新包 · 已签名、公证的 Universal App · macOS 13.5+", url: "https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.5/requests/6c74a2840b3e11a39779febb09e2a02889a97878b6b82b3cedeae89dbdaa9ff7/assets/Microi-Agent-1.3.5-mac-universal.zip", sha256: "51def793afbb8d01212dbda9ae0598eceac68c767d6123c90cc1af8f3b1e02d9" },
  { version: '1.3.5', platform: "Windows x64", note: "上游同步 · 未签名公开测试 · Windows 10/11 x64 · 客户原生安装待验收", url: "https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.5/requests/6c74a2840b3e11a39779febb09e2a02889a97878b6b82b3cedeae89dbdaa9ff7/assets/Microi-Agent-1.3.5-windows-x64-setup.exe", sha256: "ca57de4b654df5afa4d43909bddd7a4f03c9bf4f05da2277f1e1c28a8f6a3a08" },
  { version: '1.3.4', platform: "macOS Universal", note: "员工工作台与对话操作 · Developer ID 签名、Apple 公证与 Gatekeeper 通过 · macOS 13.5+", url: "https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.4/requests/36d7514bcc6974cc16784b436931668d866a26bc41aef185093c074d8dd04cdc/assets/Microi-Agent-1.3.4-mac-universal.dmg", sha256: "d54a27349627fd9015319d4239ddd120bb9a3d1b3960676be02bec2402d5c5c6" },
  { version: '1.3.4', platform: "macOS Universal ZIP", note: "员工工作台与对话操作 · Developer ID 签名、Apple 公证与 Gatekeeper 通过 · macOS 13.5+", url: "https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.4/requests/36d7514bcc6974cc16784b436931668d866a26bc41aef185093c074d8dd04cdc/assets/Microi-Agent-1.3.4-mac-universal.zip", sha256: "967739c2e8f72e81f6dfe6478c9a7f8dfff8dfa857e25caf22c0312ac4048f74" },
  { version: '1.3.4', platform: "Windows x64", note: "员工工作台与对话操作 · 未签名公开测试 · 客户原生安装待验收", url: "https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.4/requests/36d7514bcc6974cc16784b436931668d866a26bc41aef185093c074d8dd04cdc/assets/Microi-Agent-1.3.4-windows-x64-setup.exe", sha256: "f220d69e9f4cebc3f05c7e79a031a9cabbd71fce0ccad33d54c775dbadf3b7b3" },
  { version: '1.3.2', platform: 'Windows x64', note: '公开测试 · 安装程序 · 147.8 MiB · 私有管道启动恢复 · 未签名 · 客户电脑安装启动待验证', url: 'https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.3/requests/f111516a6830ae292ea8e9211a7f2ea764215983872309e25da56d054f9c3296/assets/Microi-Agent-1.3.2-windows-x64-setup.exe', sha256: 'e83b901c911d78e2e03d1feb018e51709f76ca20650ef7fd10cdcac7b8b4cf47' },
  { version: '1.3.2', platform: 'macOS Universal', note: 'Intel / Apple Silicon · DMG · 363.1 MiB · Developer ID 签名、Apple 公证与 Gatekeeper 校验通过 · macOS 13.5+', url: 'https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.2/requests/68e890672ce07a22a0296500c4ec88a6d62ee0d91729729279dc8348a6ee1e77/assets/Microi-Agent-1.3.2-mac-universal.dmg', sha256: '2bb4ba682de125cfefae90251527ff48b97d8ce504f0f1f4110998e661f9d675' },
  { version: '1.3.2', platform: 'macOS Universal ZIP', note: '自动更新包 · 405.3 MiB · 已签名、公证的 Universal App · macOS 13.5+', url: 'https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.2/requests/68e890672ce07a22a0296500c4ec88a6d62ee0d91729729279dc8348a6ee1e77/assets/Microi-Agent-1.3.2-mac-universal.zip', sha256: '7726972144f5b118faaf81fe1b023da174b67c92b789a131e2bc1aeb31ffef62' },
  { version: '1.3.1', platform: 'Windows x64', note: '安装程序 · 147.8 MiB · 回环恢复与浏览器端口修复 · 未签名', url: 'https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.1/requests/f9f26f0bea6edc7ca0113fcd90b06026d6ea61ba7138e25bfbed1502d7d34c87/assets/Microi-Agent-1.3.1-windows-x64-setup.exe', sha256: '2d76b5d148ea8d26da41d1877a95293837737cee36d95cc80df091befc1feb3c' },
  { version: '1.3.0', platform: 'Windows x64', note: '安装程序 · 147.8 MiB · 本地 Harness 启动恢复 · 未签名', url: 'https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.0/requests/4d8c1107cf309fa37a27405166cba140ef1d3f04011116badaa229f1580d206c/assets/Microi-Agent-1.3.0-windows-x64-setup.exe', sha256: '3a269fb188d526d33eb48334788e7c6a16bf20795d252ecfbace24e9d0956b63' },
  { version: '1.2.9', platform: 'Windows x64', note: '安装程序 · 145.4 MiB · 双通道启动探测 · 未签名', url: 'https://static.itdos.com/itdos/microi-code/1.2.9/3b30b1e7adb5/202610/Microi-Agent-1_2_9-windows-x64-setup.exe', sha256: '3b30b1e7adb57f8d7910dc500f977d0913937f88aa3852247379a181a5691a41' },
  { version: '1.2.2', platform: 'macOS Universal', note: 'Intel / Apple Silicon · DMG · 363.3 MiB · Developer ID 签名、Apple 公证与 Gatekeeper 校验通过 · macOS 13.5+', url: 'https://static.itdos.com/itdos/micro-app/microi-code-downloads/v1.2.2/Microi-Agent-1.2.2-mac-universal.dmg', sha256: '273cb60b06d032e9f3f7951ade0d50c96e978b160a3eee0de28efc9ed8c9a3e4' },
  { version: '1.2.2', platform: 'macOS Universal ZIP', note: '自动更新包 · 405.8 MiB · 已签名、公证的 Universal App · macOS 13.5+', url: 'https://static.itdos.com/itdos/micro-app/microi-code-downloads/v1.2.2/Microi-Agent-1.2.2-mac-universal.zip', sha256: '577f637fad51837b46f604edf09dafec09a6cccb0574e88bee35ae61875e9a24' },
  { version: '1.1.3', platform: 'macOS Intel', note: 'x64 DMG · 197.5 MiB · 未签名、未公证', url: mac.archive, sha256: mac.sha256 },
  { version: '1.1.3', platform: 'macOS Intel ZIP', note: '自动更新包 · 228.2 MiB', url: 'https://static.itdos.com/itdos/microi-code/1.1.3/f8056741d597/202609/Microi-Code-1_1_3-mac-x64.zip', sha256: 'f8056741d5972378317a05c31691e9c1f6c5a7bd3efbe483225611784544b2cb' },
  { version: '1.1.3', platform: 'Windows x64', note: '安装程序 · 177.0 MiB · 未签名', url: windows.archive, sha256: windows.sha256 },
  { version: '1.1.2', platform: 'Windows x64', note: '安装程序 · 177.0 MiB · 未签名', url: 'https://static.itdos.com/itdos/microi-code/1.1.2/9c74faa0a06b/202609/Microi-Code-1_1_2-windows-x64-setup.exe' },
  { version: '1.1.1', platform: 'Windows x64', note: '安装程序 · 177.0 MiB · 未签名', url: 'https://static.itdos.com/itdos/microi-code/1.1.1/8d6730cec534/202609/Microi-Code-1_1_1-windows-x64-setup.exe' },
  { version: '1.1.0', platform: 'Windows x64', note: '安装程序 · 177.0 MiB · 未签名', url: 'https://static.itdos.com/itdos/microi-code/1.1.0/514bef357d0e/202609/Microi-Code-1_1_0-windows-x64-setup.exe' },
  { version: '1.0.9', platform: 'Windows x64', note: '安装程序 · 177.0 MiB · 未签名', url: 'https://static.itdos.com/itdos/microi-code/1.0.9/0f95ebfb898d/202609/Microi-Code-1_0_9-windows-x64-setup.exe' },
  { version: '1.0.8', platform: 'macOS Intel', note: 'x64 DMG · 197.4 MiB · 未签名', url: 'https://static.itdos.com/itdos/microi-code/1.0.8/61546bc443f2/202609/Microi-Code-1_0_8-mac-x64.dmg' },
  { version: '1.0.7', platform: 'Windows x64', note: '历史版本', url: 'https://static.itdos.com/itdos/microi-code/1.0.7/297c04b0934c/202609/Microi-Code-1_0_7-windows-x64-setup.exe' },
  { version: '1.0.6', platform: 'Windows x64', note: '历史版本', url: 'https://static.itdos.com/itdos/microi-code/1.0.6/1bca07dfbeb2/202609/Microi-Code-1_0_6-windows-x64-setup.exe' },
  { version: '1.0.5', platform: 'Windows x64', note: '历史版本', url: 'https://static.itdos.com/itdos/microi-code/1.0.5/c5a26f363082/202609/Microi-Code-1_0_5-windows-x64-setup.exe' },
  { version: '1.0.4', platform: 'Windows x64', note: '历史版本', url: 'https://static.itdos.com/itdos/microi-code/1.0.4/2c96b8beeffd/202609/Microi-Code-1_0_4-windows-x64-setup.exe' },
  { version: '1.0.3', platform: 'Windows x64', note: '历史版本', url: 'https://static.itdos.com/itdos/microi-code/1.0.3/af3c3f50bdbe/202609/Microi-Code-1_0_3-windows-x64-setup.exe' },
  { version: '1.0.2', platform: 'Windows x64', note: '历史版本', url: 'https://static.itdos.com/itdos/microi-code/1.0.2/7b9b9dbaaa9f/202609/Microi-Code-1_0_2-windows-x64-setup.exe' },
  { version: '1.0.1', platform: 'Windows x64', note: '历史版本', url: 'https://static.itdos.com/itdos/microi-code/1.0.1/d381cf4fec34/202609/Microi-Code-1_0_1-windows-x64-setup.exe' },
  { version: '1.0.0', platform: 'Windows x64', note: '首个正式编号版本', url: 'https://static.itdos.com/itdos/microi-code/1.0.0/dd0f2e79e80b/202609/Microi-Code-1_0_0-windows-x64-setup.exe' },
  { version: '0.2.0', platform: 'Windows x64', note: '早期预览版本', url: 'https://static.itdos.com/itdos/microi-code/0.2.0/e991814b16a1/202609/Microi-Code-0_2_0-windows-x64-setup.exe' }
]

const historyOpen = ref(false)
const historyPage = ref(1)
const pageSize = 6
const pageCount = computed(() => Math.ceil(releases.length / pageSize))
const visibleReleases = computed(() => releases.slice((historyPage.value - 1) * pageSize, historyPage.value * pageSize))
</script>

<style scoped>
.microi-code-showcase{width:min(1120px,calc(100vw - 390px));margin:0 50% 58px;transform:translateX(-50%);color:var(--vp-c-text-1);font-family:var(--mci-font-family,-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif)}
.microi-code-showcase *{box-sizing:border-box}.microi-code-showcase a{text-decoration:none}.microi-code-hero{display:grid;grid-template-columns:minmax(0,.82fr) minmax(480px,1.18fr);align-items:center;gap:48px;padding:54px 0 48px;border-bottom:1px solid var(--vp-c-divider)}
.microi-code-kicker,.microi-code-section-head p{margin:0;color:var(--vp-c-brand-1);font-size:11px;font-weight:700;letter-spacing:.14em}.microi-code-kicker{display:flex;align-items:center;gap:9px}.microi-code-kicker span{width:8px;height:8px;border-radius:50%;background:var(--vp-c-brand-1);box-shadow:0 0 0 5px color-mix(in srgb,var(--vp-c-brand-1) 13%,transparent)}
.microi-code-hero h2{margin:18px 0 0;border:0;font-size:clamp(38px,3.2vw,54px);font-weight:620;line-height:1.08;letter-spacing:-.05em}.microi-code-hero h2 strong{color:var(--vp-c-brand-1);font-weight:680}.microi-code-lead{max-width:570px;margin:22px 0 0;color:var(--vp-c-text-2);font-size:16px;line-height:1.8}
.microi-code-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:28px}.microi-code-actions a,.platform-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 17px;border:1px solid var(--vp-c-divider);border-radius:10px;color:var(--vp-c-text-1);font-size:13px;font-weight:650}.microi-code-actions a.is-primary,.platform-actions a:first-child{border-color:var(--vp-c-brand-1);background:var(--vp-c-brand-1);color:#fff!important;-webkit-text-fill-color:#fff!important}.microi-code-actions a.is-primary *,.platform-actions a:first-child *{color:#fff!important;-webkit-text-fill-color:#fff!important}
.microi-code-facts{display:flex;flex-wrap:wrap;gap:8px 18px;margin:22px 0 0;padding:0;list-style:none;color:var(--vp-c-text-2);font-size:12px}.microi-code-facts li::before{content:"";display:inline-block;width:5px;height:5px;margin:0 7px 2px 0;border-radius:50%;background:#24a148}
.microi-code-hero__visual{position:relative;display:block;overflow:hidden;border:1px solid var(--vp-c-divider);border-radius:18px;background:var(--vp-c-bg-soft);box-shadow:0 24px 70px rgba(15,23,42,.13)}.microi-code-hero__visual img{display:block;width:100%;aspect-ratio:1.515;object-fit:cover}.microi-code-hero__visual>span,.microi-code-gallery a>span{position:absolute;inset:auto 12px 12px;display:flex;align-items:flex-end;justify-content:space-between;gap:14px;padding:12px 14px;border:1px solid rgba(255,255,255,.2);border-radius:11px;background:rgba(13,17,23,.78);color:#fff;backdrop-filter:blur(12px)}.microi-code-hero__visual strong,.microi-code-gallery strong{font-size:13px}.microi-code-hero__visual small,.microi-code-gallery small{color:rgba(255,255,255,.72);font-size:11px}
.microi-code-platforms{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:34px}.microi-code-platforms article{padding:24px;border:1px solid var(--vp-c-divider);border-radius:16px;background:var(--vp-c-bg-soft)}.microi-code-platforms header{display:flex;align-items:center;gap:13px}.platform-mark{width:42px;height:42px;display:grid;place-items:center;border-radius:11px;background:var(--vp-c-bg);color:var(--vp-c-brand-1);font-size:20px}.microi-code-platforms header div{min-width:0}.microi-code-platforms header p{margin:0;color:var(--vp-c-text-3);font-size:10px;letter-spacing:.13em}.microi-code-platforms h2{margin:2px 0 0;border:0;font-size:19px;font-weight:650;line-height:1.2}.microi-code-platforms em{margin-left:auto;padding:4px 8px;border:1px solid var(--vp-c-divider);border-radius:999px;color:var(--vp-c-text-2);font-size:11px;font-style:normal}.microi-code-platforms article>p{min-height:48px;margin:16px 0;color:var(--vp-c-text-2);font-size:13px;line-height:1.65}.platform-actions{display:flex;gap:8px}.platform-actions a{min-height:38px}.microi-code-platforms code{display:block;overflow:hidden;margin-top:15px;color:var(--vp-c-text-3);font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.microi-code-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:22px;margin:58px 0 22px}.microi-code-section-head h2{margin:7px 0 0;border:0;font-size:29px;font-weight:620;letter-spacing:-.025em}.microi-code-section-head>span{color:var(--vp-c-text-3);font-size:12px;text-align:right}.microi-code-gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.microi-code-gallery a{position:relative;display:block;overflow:hidden;border:1px solid var(--vp-c-divider);border-radius:14px;background:var(--vp-c-bg-soft)}.microi-code-gallery img{display:block;width:100%;aspect-ratio:1.48;object-fit:cover;transition:transform .2s ease}.microi-code-gallery a:hover img{transform:scale(1.015)}.microi-code-gallery a>span{inset:auto 10px 10px;padding:10px 12px}
.microi-code-flow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:46px;border-block:1px solid var(--vp-c-divider)}.microi-code-flow article{padding:25px 26px}.microi-code-flow article+article{border-left:1px solid var(--vp-c-divider)}.microi-code-flow span{color:var(--vp-c-brand-1);font-size:11px;font-weight:700}.microi-code-flow h3{margin:9px 0 7px;font-size:16px;font-weight:650}.microi-code-flow p{margin:0;color:var(--vp-c-text-2);font-size:12px;line-height:1.65}
.microi-code-history{scroll-margin-top:90px}.release-list{border-top:1px solid var(--vp-c-divider)}.release-list article{display:grid;grid-template-columns:190px minmax(0,1fr) auto;align-items:center;gap:20px;padding:15px 4px;border-bottom:1px solid var(--vp-c-divider)}.release-list article div{display:flex;align-items:center;gap:10px}.release-list strong{font-size:14px}.release-list span{color:var(--vp-c-text-3);font-size:11px}.release-list p{margin:0;color:var(--vp-c-text-2);font-size:12px}.release-list a{color:var(--vp-c-brand-1);font-size:12px;font-weight:650}.microi-code-credit{display:grid;grid-template-columns:220px minmax(0,1fr);gap:30px;margin-top:54px;padding:25px 0;border-top:1px solid var(--vp-c-divider)}.microi-code-credit span{display:block;color:var(--vp-c-text-3);font-size:9px;letter-spacing:.14em}.microi-code-credit strong{display:block;margin-top:6px;font-size:16px;font-weight:650}.microi-code-credit p{margin:0;color:var(--vp-c-text-2);font-size:12px;line-height:1.75}
@media(max-width:1100px){.microi-code-showcase{width:100%;margin-inline:0;transform:none}.microi-code-hero{grid-template-columns:1fr;gap:28px}.microi-code-platforms{grid-template-columns:1fr}.microi-code-flow{grid-template-columns:1fr}.microi-code-flow article+article{border-top:1px solid var(--vp-c-divider);border-left:0}}
@media(max-width:640px){.microi-code-hero{padding-top:32px}.microi-code-hero h2{font-size:36px}.microi-code-gallery{grid-template-columns:1fr}.microi-code-section-head{align-items:flex-start;flex-direction:column}.microi-code-section-head>span{text-align:left}.release-list article{grid-template-columns:1fr;gap:6px}.microi-code-credit{grid-template-columns:1fr}.platform-actions{flex-direction:column}.microi-code-actions a{width:100%}}
</style>

<style scoped>
.microi-code-showcase {
  --pointer-x: 50%;
  --pointer-y: 180px;
  --pointer-opacity: .45;
  --mc-card: color-mix(in srgb, var(--vp-c-bg) 88%, transparent);
  --mc-card-strong: color-mix(in srgb, var(--vp-c-bg-soft) 92%, transparent);
  position: relative;
  isolation: isolate;
  container-type: inline-size;
  width: min(1240px, calc(100vw - 360px));
  margin: 18px 50% 64px;
  padding: 30px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 17%, var(--vp-c-divider));
  border-radius: 28px;
  background:
    linear-gradient(var(--vp-c-bg), var(--vp-c-bg)) padding-box,
    linear-gradient(135deg, color-mix(in srgb, var(--vp-c-brand-1) 24%, transparent), transparent 35%, color-mix(in srgb, #22c55e 12%, transparent)) border-box;
  box-shadow: 0 30px 100px color-mix(in srgb, #07101f 16%, transparent);
}
.microi-code-showcase::before {
  content: "";
  position: absolute;
  z-index: -2;
  inset: 0;
  opacity: var(--pointer-opacity);
  background: radial-gradient(540px circle at var(--pointer-x) var(--pointer-y), color-mix(in srgb, var(--vp-c-brand-1) 15%, transparent), transparent 67%);
  transition: opacity .25s ease;
  pointer-events: none;
}
.microi-code-showcase::after {
  content: "";
  position: absolute;
  z-index: -3;
  inset: 0;
  opacity: .32;
  background-image: linear-gradient(color-mix(in srgb, var(--vp-c-divider) 55%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--vp-c-divider) 55%, transparent) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: linear-gradient(to bottom, #000 0, transparent 560px);
  pointer-events: none;
}
.microi-code-ambient { position: absolute; z-index: -1; inset: 0; overflow: hidden; pointer-events: none; }
.microi-code-ambient i { position: absolute; width: 240px; height: 240px; border-radius: 50%; filter: blur(80px); opacity: .11; }
.microi-code-ambient i:nth-child(1) { top: -100px; left: 8%; background: var(--vp-c-brand-1); }
.microi-code-ambient i:nth-child(2) { top: 260px; right: -110px; background: #22c55e; }
.microi-code-ambient i:nth-child(3) { top: 820px; left: 28%; background: #8b5cf6; }
.microi-code-hero { position: relative; grid-template-columns: minmax(340px,.95fr) minmax(380px,1.05fr); gap: 36px; padding: 42px 30px 48px; border-bottom: 1px solid var(--vp-c-divider); }
.microi-code-kicker { color: var(--vp-c-text-2); font-size: 10px; letter-spacing: .16em; }
.microi-code-kicker span { width: 7px; height: 7px; }
.microi-code-kicker b { margin-left: 2px; padding: 3px 6px; border: 1px solid var(--vp-c-divider); border-radius: 4px; color: var(--vp-c-text-1); font-size: 9px; letter-spacing: .1em; }
.microi-code-hero h2 { max-width: 530px; margin: 20px 0 0; border: 0; color: var(--vp-c-text-1); font-size: clamp(38px,3.2vw,54px) !important; font-weight: 570; line-height: 1.06; letter-spacing: -.05em; }
.microi-code-hero h2 strong { display: block; margin-top: 5px; color: var(--vp-c-brand-1); font-weight: 660; }
.microi-code-lead { max-width: 500px; margin-top: 20px; font-size: 15px; line-height: 1.75; }
.microi-code-actions { gap: 10px; margin-top: 26px; }
.microi-code-actions a { min-height: 44px; gap: 8px; padding: 0 16px; border-radius: 11px; background: var(--mc-card); backdrop-filter: blur(14px); }
.microi-code-actions a svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.microi-code-actions a.is-text { padding-inline: 8px; border-color: transparent; background: transparent; color: var(--vp-c-text-2); }
.microi-code-platform-download { display: flex; flex-direction: column; gap: 8px; min-width: 190px; }
.microi-code-actions a.microi-code-store-link { min-height: 36px; gap: 6px; padding: 0 9px; border: 0; background: transparent; font-size: 12px; color: var(--vp-c-brand-1); }
.microi-code-store-link small { padding: 2px 6px; border-radius: 5px; background: var(--vp-c-bg-soft); color: var(--vp-c-text-2); font-weight: 400; }
.microi-code-store-note { margin: 10px 0 0; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.7; }
.microi-code-store-install { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin: 12px 0 0; font-size: 12px; line-height: 1.7; }
.microi-code-store-install a { color: var(--vp-c-brand-1); font-weight: 600; }
.microi-code-store-install > span { color: var(--vp-c-text-2); }
@media (max-width: 640px) { .microi-code-platform-download { width: 100%; } }
.microi-code-facts { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 0; margin-top: 30px; }
.microi-code-facts li { min-width: 0; padding: 0 14px; border-left: 1px solid var(--vp-c-divider); }
.microi-code-facts li:first-child { padding-left: 0; border-left: 0; }
.microi-code-facts li::before { display: none; }
.microi-code-facts strong,.microi-code-facts span { display: block; }
.microi-code-facts strong { color: var(--vp-c-text-1); font-size: 11px; font-weight: 650; }
.microi-code-facts span { margin-top: 3px; overflow: hidden; color: var(--vp-c-text-3); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.microi-code-hero__visual { border-radius: 20px; background: var(--mc-card-strong); box-shadow: 0 28px 80px color-mix(in srgb, #030712 24%, transparent), inset 0 1px rgba(255,255,255,.12); transform: perspective(1000px) rotateY(-1.8deg) rotateX(.8deg); transition: transform .3s ease, box-shadow .3s ease; }
.microi-code-hero__visual:hover { transform: perspective(1000px) rotateY(0) rotateX(0) translateY(-3px); box-shadow: 0 34px 92px color-mix(in srgb, #030712 28%, transparent); }
.microi-code-hero__visual>span { inset: auto 14px 14px; padding: 12px 15px; }
.microi-code-platforms { gap: 14px; margin: 24px 30px 0; }
.microi-code-platforms article { position: relative; overflow: hidden; padding: 22px; border-color: color-mix(in srgb, var(--vp-c-divider) 86%, transparent); border-radius: 18px; background: var(--mc-card); backdrop-filter: blur(16px); }
.microi-code-platforms article::after { content:""; position:absolute; width:150px; height:150px; top:-100px; right:-80px; border-radius:50%; background:color-mix(in srgb,var(--vp-c-brand-1) 14%,transparent); filter:blur(30px); }
.platform-mark { background: color-mix(in srgb, var(--vp-c-brand-1) 10%, var(--vp-c-bg)); }
.platform-mark svg { width: 20px; height: 20px; }
.microi-code-platforms h2 { font-size: 19px !important; }
.microi-code-platforms article>p { min-height: 42px; margin: 14px 0; }
.platform-actions a { min-height: 36px; border-radius: 9px; }
.microi-code-platforms code { padding: 8px 10px; border: 1px solid var(--vp-c-divider); border-radius: 8px; background: color-mix(in srgb, var(--vp-c-bg) 68%, transparent); }
.microi-code-section-head { align-items: center; margin: 52px 30px 20px; }
.microi-code-section-head h2 { margin-top: 5px; font-size: 27px !important; font-weight: 580; }
.microi-code-gallery { grid-template-columns: 1.15fr .85fr; gap: 12px; margin: 0 30px; }
.microi-code-gallery a { border-radius: 16px; background: var(--mc-card); }
.microi-code-gallery a:first-child { grid-row: span 2; }
.microi-code-gallery a:first-child img { height: 100%; aspect-ratio: auto; }
.microi-code-gallery img { aspect-ratio: 1.72; }
.microi-code-gallery a:nth-child(4) { grid-column: 1 / -1; }
.microi-code-gallery a:nth-child(4) img { aspect-ratio: 2.1; object-position: top; }
.microi-code-flow { margin: 44px 30px 0; }
.microi-code-flow article { padding: 22px; }
.microi-code-flow h3 { font-weight: 580; }
.microi-code-history { padding: 1px 30px 0; }
.microi-code-history-toggle { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 20px; padding: 20px 0; border: 0; border-block: 1px solid var(--vp-c-divider); background: transparent; color: var(--vp-c-text-1); text-align: left; cursor: pointer; }
.microi-code-history-toggle > span:first-child { display: grid; gap: 4px; }
.microi-code-history-toggle small { color: var(--vp-c-brand-1); font-size: 11px; font-weight: 700; letter-spacing: .14em; }
.microi-code-history-toggle strong { font-size: 23px; font-weight: 620; }
.microi-code-history-toggle__meta { display: flex; gap: 18px; color: var(--vp-c-text-2); font-size: 12px; }
.microi-code-history-toggle__meta span { color: var(--vp-c-brand-1); font-weight: 650; }
.microi-code-history-pages { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 20px; color: var(--vp-c-text-2); font-size: 12px; }
.microi-code-history-pages button { padding: 7px 12px; border: 1px solid var(--vp-c-divider); border-radius: 8px; background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); cursor: pointer; }
.microi-code-history-pages button:disabled { opacity: .4; cursor: default; }
.release-checksum { grid-column: 1 / -1; overflow-wrap: anywhere; color: var(--vp-c-text-3); font-size: 10px; }
.release-list article { grid-template-columns: 176px minmax(0,1fr) auto; padding: 14px 8px; }
.release-list a { display:inline-flex; min-height:32px; align-items:center; padding:0 11px; border:1px solid var(--vp-c-divider); border-radius:8px; }
.microi-code-credit { margin: 50px 30px 0; padding: 26px 0 8px; }
@media(max-width:1280px){.microi-code-showcase{width:calc(100% - 32px);margin-inline:auto;transform:none}.microi-code-hero{grid-template-columns:1fr}.microi-code-hero__visual{transform:none}.microi-code-gallery a:first-child{grid-row:auto}.microi-code-gallery a:first-child img{height:auto;aspect-ratio:1.72}.microi-code-gallery a:nth-child(4){grid-column:auto}.microi-code-gallery a:nth-child(4) img{aspect-ratio:1.72}}
@media(max-width:760px){.microi-code-showcase{width:calc(100% - 20px);padding:10px;border-radius:20px}.microi-code-hero{padding:32px 10px 36px}.microi-code-hero h2{font-size:38px!important}.microi-code-platforms,.microi-code-gallery{grid-template-columns:1fr;margin-inline:10px}.microi-code-section-head,.microi-code-flow,.microi-code-credit{margin-inline:10px}.microi-code-history{padding-inline:10px}.microi-code-facts{grid-template-columns:1fr;gap:12px}.microi-code-facts li{padding:0;border-left:0}.release-list article{grid-template-columns:1fr;gap:7px}}
@media(prefers-reduced-motion:reduce){.microi-code-hero__visual,.microi-code-gallery img{transition:none}.microi-code-showcase::before{display:none}}
@container (max-width: 900px) {
  .microi-code-hero { grid-template-columns: minmax(0, 1fr); padding-inline: 10px; }
  .microi-code-hero__visual { transform: none; }
  .microi-code-section-head { align-items: start; flex-direction: column; }
}
</style>

<style>
@media (min-width: 1280px) {
  .mci-microi-code-page .VPDoc .aside { display: block; }
}
.mci-microi-code-page .VPDoc .container {
  max-width: 1520px;
}
.mci-microi-code-page .VPDoc .content {
  max-width: none;
}
.mci-microi-code-page .VPDoc .content-container {
  max-width: 1240px;
  margin-inline: auto;
  padding-inline: 32px !important;
}
.mci-microi-code-page .vp-doc > div > h1,
.mci-microi-code-page .vp-doc > div > h1 + p {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
.mci-microi-code-page .vp-doc > div > .microi-code-showcase {
  width: 100%;
  margin: 0 0 64px;
  transform: none;
}
@media (max-width: 760px) {
  .mci-microi-code-page .VPDoc .content-container {
    padding-inline: 12px !important;
  }
}
</style>

<style scoped>
.microi-code-repair-candidate{margin:18px 0 0;padding:15px 17px;border:1px solid color-mix(in srgb,var(--vp-c-brand-1) 30%,var(--vp-c-divider));border-radius:12px;background:var(--vp-c-bg-soft)}
.microi-code-repair-candidate strong{font-size:13px}.microi-code-repair-candidate p{margin:6px 0 10px;color:var(--vp-c-text-2);font-size:12px;line-height:1.7}.microi-code-repair-candidate div{display:flex;flex-wrap:wrap;gap:8px 16px}.microi-code-repair-candidate a{color:var(--vp-c-brand-1);font-size:12px;font-weight:650}
</style>
