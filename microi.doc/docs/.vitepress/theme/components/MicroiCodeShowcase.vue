<template>
  <section class="microi-code-showcase" aria-labelledby="microi-code-title">
    <div class="microi-code-hero">
      <div class="microi-code-hero__copy">
        <p class="microi-code-kicker"><span></span>MICROI CODE · HARNESS</p>
        <h2 id="microi-code-title">让 AI 在吾码的<br><strong>完整业务底座上工作</strong></h2>
        <p class="microi-code-lead">基于 dsh-desktop 与 DeepSeek Harness 二次开发。一个桌面端同时连接代码、吾码账号、AI 中转站、MCP 服务器和 30+ 成熟引擎。</p>
        <div class="microi-code-actions">
          <a class="is-primary" :href="windows.latest">下载 Windows</a>
          <a :href="mac.latest">下载 macOS Intel</a>
          <a href="#版本记录">历史版本</a>
        </div>
        <ul class="microi-code-facts" aria-label="Microi Code 产品事实">
          <li>吾码账号直接登录</li>
          <li>Windows / macOS</li>
          <li>MCP + Skills</li>
          <li>DSH 能力持续同步</li>
        </ul>
      </div>
      <a class="microi-code-hero__visual" href="/images/product-screenshots/microi-code-ai-remove-light.png" data-fancybox="microi-code-gallery">
        <img src="/images/product-screenshots/microi-code-ai-remove-light.png" alt="Microi Code AI 图像处理工作台">
        <span><strong>29 项图像能力</strong><small>参数、上传、任务与结果均在桌面端完成</small></span>
      </a>
    </div>

    <div class="microi-code-platforms" aria-label="Microi Code 下载">
      <article>
        <header><span class="platform-mark">⊞</span><div><p>WINDOWS</p><h2>Windows x64</h2></div><em>v{{ windows.version }}</em></header>
        <p>适用于 Windows 10 / 11。安装包未签名，下载后可使用下方 SHA-256 校验完整性。</p>
        <div class="platform-actions"><a :href="windows.latest">下载 latest</a><a :href="windows.archive">不可变归档</a></div>
        <code>{{ windows.sha256 }}</code>
      </article>
      <article>
        <header><span class="platform-mark">◆</span><div><p>MACOS</p><h2>macOS Intel</h2></div><em>v{{ mac.version }}</em></header>
        <p>Intel x64 原生包；Apple Silicon 可通过 Rosetta 2 运行。当前包未签名、未公证。</p>
        <div class="platform-actions"><a :href="mac.latest">下载 latest</a><a :href="mac.archive">不可变归档</a></div>
        <code>{{ mac.sha256 }}</code>
      </article>
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

    <div class="microi-code-flow" aria-label="Microi Code 工作流程">
      <article><span>01</span><h3>登录与连接</h3><p>使用吾码官方账号登录，也可添加自己的模型或业务租户 MCP。</p></article>
      <article><span>02</span><h3>选择能力</h3><p>对话、数据分析、图像、视频、音乐、AI 引擎与应用商城统一进入。</p></article>
      <article><span>03</span><h3>交付与回读</h3><p>让 Harness 执行代码与工具，让吾码引擎承接权限、数据和业务运行。</p></article>
    </div>

    <section id="版本记录" class="microi-code-history" aria-labelledby="microi-code-history-title">
      <div class="microi-code-section-head">
        <div><p>RELEASES</p><h2 id="microi-code-history-title">版本记录</h2></div>
        <span>latest 始终指向对应平台最新版，历史归档永久保留</span>
      </div>
      <div class="release-list">
        <article v-for="release in releases" :key="`${release.version}-${release.platform}`">
          <div><strong>v{{ release.version }}</strong><span>{{ release.platform }}</span></div>
          <p>{{ release.note }}</p>
          <a :href="release.url">下载归档</a>
        </article>
      </div>
    </section>

    <footer class="microi-code-credit">
      <div><span>OPEN SOURCE FOUNDATION</span><strong>尊重上游，持续演进</strong></div>
      <p>Microi Code 基于 <a href="https://github.com/dataelement/dsh-desktop" target="_blank" rel="noopener noreferrer">dsh-desktop</a> 与 <a href="https://github.com/deepseek-ai/deepseek-harness" target="_blank" rel="noopener noreferrer">DeepSeek Harness</a> 二次开发，保留 DataElement 的 MIT 版权声明。</p>
    </footer>
  </section>
</template>

<script setup>
const windows = {
  version: '1.0.7',
  latest: 'https://static.itdos.com/itdos/microi-code/latest/202609/Microi-Code-latest-windows-x64-setup.exe?v=1.0.7',
  archive: 'https://static.itdos.com/itdos/microi-code/1.0.7/297c04b0934c/202609/Microi-Code-1_0_7-windows-x64-setup.exe',
  sha256: '297c04b0934c7feb240c3d17300cc882e9742ad0c6c3dab96acb2819caea55f8'
}

const mac = {
  version: '1.0.8',
  latest: 'https://static.itdos.com/itdos/microi-code/latest/202609/Microi-Code-latest-mac-x64.dmg?v=1.0.8',
  archive: 'https://static.itdos.com/itdos/microi-code/1.0.8/61546bc443f2/202609/Microi-Code-1_0_8-mac-x64.dmg',
  sha256: '61546bc443f2aa16f0b8d1833c2359f94d37edddca3ab2e3541d87834c657a3f'
}

const screenshots = [
  { src: '/images/product-screenshots/microi-code-ai-center-dark.jpg', alt: 'Microi Code 深色 AI 能力中心', title: 'AI 能力中心', caption: '能力与来源清晰分层' },
  { src: '/images/product-screenshots/microi-code-home-light.jpg', alt: 'Microi Code 浅色首页', title: '首页入口', caption: '7 项主能力与 29 项图像工具' },
  { src: '/images/product-screenshots/microi-code-task-workspace.png', alt: 'Microi Code 任务工作区', title: '真实任务', caption: '轨迹、文件与后台任务统一查看' },
  { src: '/images/product-screenshots/microi-code-ai-remove-light.png', alt: 'Microi Code AI 消除功能', title: '原生工作台', caption: '上传、参数、生成与下载闭环' }
]

const releases = [
  { version: '1.0.8', platform: 'macOS Intel', note: 'x64 DMG · 197.4 MiB · 未签名', url: mac.archive },
  { version: '1.0.7', platform: 'Windows x64', note: '安装程序 · 177.0 MiB · 未签名', url: windows.archive },
  { version: '1.0.6', platform: 'Windows x64', note: '历史版本', url: 'https://static.itdos.com/itdos/microi-code/1.0.6/1bca07dfbeb2/202609/Microi-Code-1_0_6-windows-x64-setup.exe' },
  { version: '1.0.5', platform: 'Windows x64', note: '历史版本', url: 'https://static.itdos.com/itdos/microi-code/1.0.5/c5a26f363082/202609/Microi-Code-1_0_5-windows-x64-setup.exe' },
  { version: '1.0.4', platform: 'Windows x64', note: '历史版本', url: 'https://static.itdos.com/itdos/microi-code/1.0.4/2c96b8beeffd/202609/Microi-Code-1_0_4-windows-x64-setup.exe' },
  { version: '1.0.3', platform: 'Windows x64', note: '历史版本', url: 'https://static.itdos.com/itdos/microi-code/1.0.3/af3c3f50bdbe/202609/Microi-Code-1_0_3-windows-x64-setup.exe' },
  { version: '1.0.2', platform: 'Windows x64', note: '历史版本', url: 'https://static.itdos.com/itdos/microi-code/1.0.2/7b9b9dbaaa9f/202609/Microi-Code-1_0_2-windows-x64-setup.exe' },
  { version: '1.0.1', platform: 'Windows x64', note: '历史版本', url: 'https://static.itdos.com/itdos/microi-code/1.0.1/d381cf4fec34/202609/Microi-Code-1_0_1-windows-x64-setup.exe' },
  { version: '1.0.0', platform: 'Windows x64', note: '首个正式编号版本', url: 'https://static.itdos.com/itdos/microi-code/1.0.0/dd0f2e79e80b/202609/Microi-Code-1_0_0-windows-x64-setup.exe' },
  { version: '0.2.0', platform: 'Windows x64', note: '早期预览版本', url: 'https://static.itdos.com/itdos/microi-code/0.2.0/e991814b16a1/202609/Microi-Code-0_2_0-windows-x64-setup.exe' }
]
</script>

<style scoped>
.microi-code-showcase{width:min(1120px,calc(100vw - 390px));margin:0 50% 58px;transform:translateX(-50%);color:var(--vp-c-text-1);font-family:var(--mci-font-family,-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif)}
.microi-code-showcase *{box-sizing:border-box}.microi-code-showcase a{text-decoration:none}.microi-code-hero{display:grid;grid-template-columns:minmax(0,.82fr) minmax(480px,1.18fr);align-items:center;gap:48px;padding:54px 0 48px;border-bottom:1px solid var(--vp-c-divider)}
.microi-code-kicker,.microi-code-section-head p{margin:0;color:var(--vp-c-brand-1);font-size:11px;font-weight:700;letter-spacing:.14em}.microi-code-kicker{display:flex;align-items:center;gap:9px}.microi-code-kicker span{width:8px;height:8px;border-radius:50%;background:var(--vp-c-brand-1);box-shadow:0 0 0 5px color-mix(in srgb,var(--vp-c-brand-1) 13%,transparent)}
.microi-code-hero h2{margin:18px 0 0;border:0;font-size:clamp(38px,4vw,58px);font-weight:620;line-height:1.08;letter-spacing:-.055em}.microi-code-hero h2 strong{color:var(--vp-c-brand-1);font-weight:680}.microi-code-lead{max-width:570px;margin:22px 0 0;color:var(--vp-c-text-2);font-size:16px;line-height:1.8}
.microi-code-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:28px}.microi-code-actions a,.platform-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 17px;border:1px solid var(--vp-c-divider);border-radius:10px;color:var(--vp-c-text-1);font-size:13px;font-weight:650}.microi-code-actions a.is-primary,.platform-actions a:first-child{border-color:var(--vp-c-brand-1);background:var(--vp-c-brand-1);color:#fff}
.microi-code-facts{display:flex;flex-wrap:wrap;gap:8px 18px;margin:22px 0 0;padding:0;list-style:none;color:var(--vp-c-text-2);font-size:12px}.microi-code-facts li::before{content:"";display:inline-block;width:5px;height:5px;margin:0 7px 2px 0;border-radius:50%;background:#24a148}
.microi-code-hero__visual{position:relative;display:block;overflow:hidden;border:1px solid var(--vp-c-divider);border-radius:18px;background:var(--vp-c-bg-soft);box-shadow:0 24px 70px rgba(15,23,42,.13)}.microi-code-hero__visual img{display:block;width:100%;aspect-ratio:1.515;object-fit:cover}.microi-code-hero__visual>span,.microi-code-gallery a>span{position:absolute;inset:auto 12px 12px;display:flex;align-items:flex-end;justify-content:space-between;gap:14px;padding:12px 14px;border:1px solid rgba(255,255,255,.2);border-radius:11px;background:rgba(13,17,23,.78);color:#fff;backdrop-filter:blur(12px)}.microi-code-hero__visual strong,.microi-code-gallery strong{font-size:13px}.microi-code-hero__visual small,.microi-code-gallery small{color:rgba(255,255,255,.72);font-size:11px}
.microi-code-platforms{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:34px}.microi-code-platforms article{padding:24px;border:1px solid var(--vp-c-divider);border-radius:16px;background:var(--vp-c-bg-soft)}.microi-code-platforms header{display:flex;align-items:center;gap:13px}.platform-mark{width:42px;height:42px;display:grid;place-items:center;border-radius:11px;background:var(--vp-c-bg);color:var(--vp-c-brand-1);font-size:20px}.microi-code-platforms header div{min-width:0}.microi-code-platforms header p{margin:0;color:var(--vp-c-text-3);font-size:10px;letter-spacing:.13em}.microi-code-platforms h2{margin:2px 0 0;border:0;font-size:19px;font-weight:650;line-height:1.2}.microi-code-platforms em{margin-left:auto;padding:4px 8px;border:1px solid var(--vp-c-divider);border-radius:999px;color:var(--vp-c-text-2);font-size:11px;font-style:normal}.microi-code-platforms article>p{min-height:48px;margin:16px 0;color:var(--vp-c-text-2);font-size:13px;line-height:1.65}.platform-actions{display:flex;gap:8px}.platform-actions a{min-height:38px}.microi-code-platforms code{display:block;overflow:hidden;margin-top:15px;color:var(--vp-c-text-3);font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.microi-code-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:22px;margin:58px 0 22px}.microi-code-section-head h2{margin:7px 0 0;border:0;font-size:29px;font-weight:620;letter-spacing:-.025em}.microi-code-section-head>span{color:var(--vp-c-text-3);font-size:12px;text-align:right}.microi-code-gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.microi-code-gallery a{position:relative;display:block;overflow:hidden;border:1px solid var(--vp-c-divider);border-radius:14px;background:var(--vp-c-bg-soft)}.microi-code-gallery img{display:block;width:100%;aspect-ratio:1.48;object-fit:cover;transition:transform .2s ease}.microi-code-gallery a:hover img{transform:scale(1.015)}.microi-code-gallery a>span{inset:auto 10px 10px;padding:10px 12px}
.microi-code-flow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:46px;border-block:1px solid var(--vp-c-divider)}.microi-code-flow article{padding:25px 26px}.microi-code-flow article+article{border-left:1px solid var(--vp-c-divider)}.microi-code-flow span{color:var(--vp-c-brand-1);font-size:11px;font-weight:700}.microi-code-flow h3{margin:9px 0 7px;font-size:16px;font-weight:650}.microi-code-flow p{margin:0;color:var(--vp-c-text-2);font-size:12px;line-height:1.65}
.microi-code-history{scroll-margin-top:90px}.release-list{border-top:1px solid var(--vp-c-divider)}.release-list article{display:grid;grid-template-columns:190px minmax(0,1fr) auto;align-items:center;gap:20px;padding:15px 4px;border-bottom:1px solid var(--vp-c-divider)}.release-list article div{display:flex;align-items:center;gap:10px}.release-list strong{font-size:14px}.release-list span{color:var(--vp-c-text-3);font-size:11px}.release-list p{margin:0;color:var(--vp-c-text-2);font-size:12px}.release-list a{color:var(--vp-c-brand-1);font-size:12px;font-weight:650}.microi-code-credit{display:grid;grid-template-columns:220px minmax(0,1fr);gap:30px;margin-top:54px;padding:25px 0;border-top:1px solid var(--vp-c-divider)}.microi-code-credit span{display:block;color:var(--vp-c-text-3);font-size:9px;letter-spacing:.14em}.microi-code-credit strong{display:block;margin-top:6px;font-size:16px;font-weight:650}.microi-code-credit p{margin:0;color:var(--vp-c-text-2);font-size:12px;line-height:1.75}
@media(max-width:1100px){.microi-code-showcase{width:100%;margin-inline:0;transform:none}.microi-code-hero{grid-template-columns:1fr;gap:28px}.microi-code-platforms{grid-template-columns:1fr}.microi-code-flow{grid-template-columns:1fr}.microi-code-flow article+article{border-top:1px solid var(--vp-c-divider);border-left:0}}
@media(max-width:640px){.microi-code-hero{padding-top:32px}.microi-code-hero h2{font-size:36px}.microi-code-gallery{grid-template-columns:1fr}.microi-code-section-head{align-items:flex-start;flex-direction:column}.microi-code-section-head>span{text-align:left}.release-list article{grid-template-columns:1fr;gap:6px}.microi-code-credit{grid-template-columns:1fr}.platform-actions{flex-direction:column}.microi-code-actions a{width:100%}}
</style>
