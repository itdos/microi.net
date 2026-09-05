<script setup>
import { computed, onMounted, ref } from 'vue'
const language = ref('zh')
// 服务器统一交付可读的静态错误页，挂载后按实际访问路径选择语言，不回显 URL 参数。
onMounted(() => {
  language.value = window.location.pathname.startsWith('/en/') ? 'en' : 'zh'
  document.getElementById('mci-not-found-static')?.remove()
})
const en = computed(() => language.value === 'en')
const text = computed(() => en.value ? {
  title: 'This page took a different path', description: 'The link may have changed, or this page is no longer available. Let’s get you back to the documentation.',
  docs: 'Explore the documentation', home: 'Go to homepage', hint: 'A useful place to continue',
  start: 'Getting started', startHint: 'Installation and your first application', v8: 'V8 API reference', v8Hint: 'Server-side methods and examples',
  language: '中文', docsUrl: '/en/doc/', homeUrl: '/en/', startUrl: '/en/doc/getting-started/start-use.html', v8Url: '/en/doc/v8-engine/v8-server.html'
} : {
  title: '这一页，暂时迷路了', description: '链接可能已更新，或你要找的页面已不在这里。别担心，可以从官方文档继续探索。',
  docs: '前往官方文档', home: '返回首页', hint: '也可以从这里继续',
  start: '快速开始', startHint: '安装部署与第一个应用', v8: 'V8 接口参考', v8Hint: '后端方法说明与代码示例',
  language: 'English', docsUrl: '/doc/', homeUrl: '/', startUrl: '/doc/getting-started/start-use.html', v8Url: '/doc/v8-engine/v8-server.html'
})
</script>

<template>
  <section class="mci-not-found" aria-labelledby="mci-not-found-title">
    <div class="mci-not-found-card">
      <div class="mci-not-found-top"><span>MICROI · PAGE NOT FOUND</span><button type="button" @click="language = en ? 'zh' : 'en'">{{ text.language }}</button></div>
      <p class="mci-not-found-code" aria-label="404">404<span aria-hidden="true">↗</span></p>
      <h1 id="mci-not-found-title">{{ text.title }}</h1>
      <p class="mci-not-found-description">{{ text.description }}</p>
      <div class="mci-not-found-actions">
        <a class="mci-not-found-primary" :href="text.docsUrl">{{ text.docs }} <span aria-hidden="true">→</span></a>
        <a :href="text.homeUrl">{{ text.home }}</a>
      </div>
      <div class="mci-not-found-suggestions">
        <p>{{ text.hint }}</p>
        <div>
          <a :href="text.startUrl"><strong>{{ text.start }}</strong><span>{{ text.startHint }}</span></a>
          <a :href="text.v8Url"><strong>{{ text.v8 }}</strong><span>{{ text.v8Hint }}</span></a>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.mci-not-found { padding: 54px 24px 72px; color: var(--mci-site-ink); }
.mci-not-found-card { max-width: 800px; margin: 0 auto; padding: 36px 48px; background: var(--mci-site-surface); border: 1px solid var(--mci-site-border-strong); border-radius: var(--mci-site-radius-card); box-shadow: var(--mci-site-shadow); }
.mci-not-found-top { display: flex; justify-content: space-between; align-items: center; gap: 16px; font-size: 11px; letter-spacing: .12em; color: var(--mci-site-muted); }
.mci-not-found-top button { padding: 8px 10px; border: 1px solid var(--mci-site-border-strong); border-radius: 8px; letter-spacing: 0; }
.mci-not-found-code { display: flex; align-items: center; gap: 20px; margin: 30px 0 12px; font-size: clamp(80px, 15vw, 132px); font-weight: 800; line-height: 1; letter-spacing: -.075em; }
.mci-not-found-code span { color: var(--vp-c-brand-1); font-size: .5em; letter-spacing: 0; }
.mci-not-found h1 { margin: 18px 0 14px; font-size: clamp(24px, 4vw, 34px); line-height: 1.35; font-weight: 700; }
.mci-not-found-description { max-width: 540px; color: var(--mci-site-muted); font-size: 16px; line-height: 1.85; }
.mci-not-found-actions { display: flex; flex-wrap: wrap; gap: 12px; margin: 28px 0 36px; }
.mci-not-found-actions a { display: inline-flex; justify-content: center; align-items: center; gap: 16px; min-height: 46px; padding: 11px 22px; border: 1px solid var(--mci-site-border-strong); border-radius: 12px; font-size: 14px; font-weight: 600; }
.mci-not-found-actions .mci-not-found-primary { background: var(--mci-site-red-strong); color: #fff; border-color: var(--mci-site-red-strong); }
.mci-not-found a, .mci-not-found button { transition: transform .18s ease, background-color .18s ease; }
.mci-not-found a:hover { transform: translateY(-2px); }
.mci-not-found :is(a, button):focus-visible { outline: 3px solid var(--vp-c-brand-1); outline-offset: 4px; }
.mci-not-found-suggestions { padding-top: 22px; border-top: 1px solid var(--mci-site-border-strong); }
.mci-not-found-suggestions > p { margin-bottom: 14px; font-size: 12px; color: var(--mci-site-muted); }
.mci-not-found-suggestions > div { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.mci-not-found-suggestions a { display: flex; flex-direction: column; gap: 5px; padding: 6px 0; }
.mci-not-found-suggestions strong { font-size: 14px; }
.mci-not-found-suggestions span { font-size: 12px; color: var(--mci-site-muted); }
@media (max-width: 600px) {
  .mci-not-found { padding: 28px 16px 40px; }
  .mci-not-found-card { padding: 24px; }
  .mci-not-found-top { font-size: 9px; gap: 8px; }
  .mci-not-found-suggestions > div { grid-template-columns: 1fr; gap: 12px; }
  .mci-not-found-actions a { flex: 1 1 100%; }
}
@media (prefers-reduced-motion: reduce) { .mci-not-found a, .mci-not-found button { transition: none; } .mci-not-found a:hover { transform: none; } }
</style>
