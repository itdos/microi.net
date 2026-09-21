<template>
  <section class="microi-code-showcase" aria-labelledby="microi-code-title" @pointermove="trackPointer" @pointerleave="resetPointer">
    <div class="microi-code-ambient" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="microi-code-hero">
      <div class="microi-code-hero__copy">
        <p class="microi-code-kicker"><span></span>MICROI CODE <b>HARNESS</b></p>
        <h2 id="microi-code-title">让 AI 在<strong>完整业务底座</strong>上工作</h2>
        <p class="microi-code-lead">代码、吾码账号、AI 中转站、MCP 与 30+ 成熟引擎，在一个桌面工作台协同。</p>
        <div class="microi-code-actions">
          <a class="is-primary" :href="windows.latest"><DownloadIcon />下载 Windows</a>
          <a :href="mac.latest"><DownloadIcon />下载 macOS Intel</a>
          <a class="is-text" href="#版本记录">查看历史版本 <span aria-hidden="true">↓</span></a>
        </div>
        <ul class="microi-code-facts" aria-label="Microi Code 产品事实">
          <li><strong>官方账号</strong><span>登录即用 AI 中转站</span></li>
          <li><strong>多端桌面</strong><span>Windows 与 macOS</span></li>
          <li><strong>原生能力</strong><span>MCP · Skills · Harness</span></li>
        </ul>
      </div>
      <a class="microi-code-hero__visual" href="/images/product-screenshots/microi-code-ai-remove-light.png" data-fancybox="microi-code-gallery">
        <img src="/images/product-screenshots/microi-code-ai-remove-light.png" alt="Microi Code AI 图像处理工作台">
        <span><strong>29 项图像能力</strong><small>参数、上传、任务与结果都在桌面端完成</small></span>
      </a>
    </div>

    <div class="microi-code-platforms" aria-label="Microi Code 下载">
      <article>
        <header><span class="platform-mark"><WindowsIcon /></span><div><p>WINDOWS</p><h2>Windows x64</h2></div><em>v{{ windows.version }}</em></header>
        <p>适用于 Windows 10 / 11。安装包未签名，下载后可使用下方 SHA-256 校验完整性。</p>
        <div class="platform-actions"><a :href="windows.latest">下载 latest</a><a :href="windows.archive">不可变归档</a></div>
        <code>{{ windows.sha256 }}</code>
      </article>
      <article>
        <header><span class="platform-mark"><AppleIcon /></span><div><p>MACOS</p><h2>macOS Intel</h2></div><em>v{{ mac.version }}</em></header>
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
      <article><span>01</span><h3>登录与连接</h3><p>使用吾码账号，或连接自己的模型与业务租户。</p></article>
      <article><span>02</span><h3>选择能力</h3><p>对话、数据、图像、视频、音乐与应用统一进入。</p></article>
      <article><span>03</span><h3>完成交付</h3><p>Harness 执行任务，吾码引擎承接权限、数据与业务。</p></article>
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
import { h } from 'vue'

const svgIcon = (path, fill = 'none') => () => h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', fill }, [h('path', { d: path })])
const DownloadIcon = svgIcon('M12 4v10m0 0 4-4m-4 4-4-4M5 19h14')
const WindowsIcon = svgIcon('M3 5.5 10.7 4v7H3V5.5Zm9-.2L21 3.5V11h-9V5.3ZM3 12.3h7.7v7L3 18v-5.7Zm9 0h9v7.5L12 18v-5.7Z', 'currentColor')
const AppleIcon = svgIcon('M16.7 12.7c0-2.5 2-3.7 2.1-3.8a4.5 4.5 0 0 0-3.6-1.9c-1.5-.1-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.5 1.3 0 1.8-.8 3.4-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.2 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-3-.9-3-4.1ZM14.2 5.4A4.2 4.2 0 0 0 15.2 2a4.4 4.4 0 0 0-3 1.6 4 4 0 0 0-1 3.2 3.7 3.7 0 0 0 3-1.4Z', 'currentColor')

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
  version: '1.1.0',
  latest: 'https://static.itdos.com/itdos/microi-code/latest/202609/Microi-Code-latest-windows-x64-setup.exe?v=1.1.0',
  archive: 'https://static.itdos.com/itdos/microi-code/1.1.0/514bef357d0e/202609/Microi-Code-1_1_0-windows-x64-setup.exe',
  sha256: '514bef357d0e955c072ef05f097e4b8bba1c2cf1560a224bad6e0d3e440aaf34'
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
  { version: '1.1.0', platform: 'Windows x64', note: '安装程序 · 177.0 MiB · 未签名', url: windows.archive },
  { version: '1.0.9', platform: 'Windows x64', note: '安装程序 · 177.0 MiB · 未签名', url: 'https://static.itdos.com/itdos/microi-code/1.0.9/0f95ebfb898d/202609/Microi-Code-1_0_9-windows-x64-setup.exe' },
  { version: '1.0.8', platform: 'macOS Intel', note: 'x64 DMG · 197.4 MiB · 未签名', url: mac.archive },
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
.microi-code-history .microi-code-section-head { margin-inline: 0; }
.release-list article { grid-template-columns: 176px minmax(0,1fr) auto; padding: 14px 8px; }
.release-list a { display:inline-flex; min-height:32px; align-items:center; padding:0 11px; border:1px solid var(--vp-c-divider); border-radius:8px; }
.microi-code-credit { margin: 50px 30px 0; padding: 26px 0 8px; }
@media(max-width:1280px){.microi-code-showcase{width:calc(100% - 32px);margin-inline:auto;transform:none}.microi-code-hero{grid-template-columns:1fr}.microi-code-hero__visual{transform:none}.microi-code-gallery a:first-child{grid-row:auto}.microi-code-gallery a:first-child img{height:auto;aspect-ratio:1.72}.microi-code-gallery a:nth-child(4){grid-column:auto}.microi-code-gallery a:nth-child(4) img{aspect-ratio:1.72}}
@media(max-width:760px){.microi-code-showcase{width:calc(100% - 20px);padding:10px;border-radius:20px}.microi-code-hero{padding:32px 10px 36px}.microi-code-hero h2{font-size:38px!important}.microi-code-platforms,.microi-code-gallery{grid-template-columns:1fr;margin-inline:10px}.microi-code-section-head,.microi-code-flow,.microi-code-credit{margin-inline:10px}.microi-code-history{padding-inline:10px}.microi-code-facts{grid-template-columns:1fr;gap:12px}.microi-code-facts li{padding:0;border-left:0}.release-list article{grid-template-columns:1fr;gap:7px}}
@media(prefers-reduced-motion:reduce){.microi-code-hero__visual,.microi-code-gallery img{transition:none}.microi-code-showcase::before{display:none}}
</style>

<style>
.mci-microi-code-page .VPDoc .aside {
  display: none;
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
