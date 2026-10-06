<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { configureV8, getContext, subscribeContext } from './microi.js'
import { normalizeOpsUrl } from './ops-url.js'
const context = ref(getContext()), loading = ref(true), error = ref(''), notice = ref(''), url = ref(''), override = ref(''), frameLoaded = ref(false)
const unsub = subscribeContext(data => { context.value = data })
const style = computed(() => ({ '--ops-primary': context.value.themePrimaryText || context.value.themeColor || '#337ecc', '--ops-action': context.value.themeColor || '#409eff', '--ops-on-primary': context.value.themeOnPrimary || '#ffffff', '--ops-text': context.value.themeTokens?.textPrimary || (context.value.themeMode === 'dark' ? '#edf1f7' : '#172133'), '--ops-surface': context.value.themeTokens?.surface || (context.value.themeMode === 'dark' ? '#19202b' : '#ffffff'), '--ops-border': context.value.themeTokens?.border || (context.value.themeMode === 'dark' ? '#354052' : '#e2e8f0'), '--ops-muted': context.value.themeTokens?.textSecondary || (context.value.themeMode === 'dark' ? '#aebace' : '#64748b') }))
async function load() {
  loading.value = true; error.value = ''; frameLoaded.value = false
  try {
    const V8 = configureV8()
    const result = await V8.ApiEngine.Run({ ApiEngineKey: 'platform-ops-entry' })
    if (Number(result?.Code) !== 1) throw new Error(result?.Msg || '无法读取运维入口配置。')
    url.value = normalizeOpsUrl(result.Data?.Url || '')
  } catch (e) { error.value = e.message }
  finally { loading.value = false }
}
function openTemporary() {
  try { url.value = normalizeOpsUrl(override.value); frameLoaded.value = false; error.value = '' }
  catch (e) { error.value = e.message }
}
async function copy() {
  try { await navigator.clipboard.writeText(url.value); notice.value = '独立运维地址已复制，请在更新前收藏。' }
  catch { notice.value = '请从上方链接复制独立运维地址。' }
}
onMounted(load)
onUnmounted(unsub)
</script>
<template>
  <main class="ops-entry" :style="style" data-mci-ui-root="microi-platform-service" :data-theme="context.themeMode || 'light'" :data-mci-palette="context.themePalette || 'custom'">
    <header><div><small>MICROI.PANEL</small><h1>吾码服务器运维面板</h1><p>管理 Docker 插件、Nginx 网站、证书、文件与备份，以及吾码 API / Web 升级任务。</p></div><button :disabled="loading" @click="load">刷新入口</button></header>
    <p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
    <section v-if="loading" class="entry-skeleton" aria-busy="true" aria-label="正在读取服务器面板入口"><span></span><span></span><span></span></section>
    <section v-else-if="!url" class="empty"><h2>配置独立面板地址</h2><p>部署 Microi.Panel 后，在 SaaS 引擎 → 当前租户 → 后端运行配置中填写“服务器运维面板地址”（旧版本名为“平台运维中心地址”）。面板使用部署时设置的独立账号登录。</p><p><a href="https://microi.net/doc/server-panel/overview.html" target="_blank" rel="noopener noreferrer">查看一键安装与使用文档 ↗</a></p><p>也可以临时打开一个已部署的服务器面板：</p><form @submit.prevent="openTemporary"><label>独立面板地址<input v-model="override" placeholder="https://panel.example.com:61890" type="url" required></label><button type="submit">打开服务器面板</button></form></section>
    <template v-else>
      <section class="entry-link"><div><strong>独立访问 URL</strong><a :href="url" target="_blank" rel="noopener noreferrer">{{ url }}</a></div><div class="actions"><button @click="copy">复制地址</button><a class="open" :href="url" target="_blank" rel="noopener noreferrer">在新窗口打开 ↗</a></div></section>
      <p class="hint">更新 API/Web 前，请打开独立窗口并收藏此地址。父页面无法访问时，独立服务器面板仍可查看同一更新任务。</p>
      <p v-if="!frameLoaded" class="hint">正在载入嵌入页面；如果登录受浏览器限制，请使用上方独立窗口。</p>
      <iframe :key="url" :src="url" title="Microi.Panel 独立服务器运维面板" referrerpolicy="no-referrer" @load="frameLoaded = true" />
      <p class="hint">嵌入页面需要面板的 OPS_ALLOWED_FRAME_ORIGINS 允许当前来源。页面载入不代表登录或操作成功，以面板内任务回执为准。</p>
    </template>
  </main>
</template>
<style scoped>
.ops-entry { color: var(--ops-text); background: var(--ops-surface); min-height: var(--micro-app-available-height, 100vh); padding: 24px; font: 14px/1.7 -apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif; box-sizing: border-box; }
.entry-skeleton { min-height: 170px; display: grid; align-content: center; gap: 20px; } .entry-skeleton span { height: 18px; max-width: 620px; background: var(--ops-border); border-radius: 4px; } .entry-skeleton span:first-child { width: 38%; height: 24px; } .entry-skeleton span:last-child { width: 68%; }
header { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 24px; } h1 { font-size: 26px; margin: 4px 0; } h2 { font-size: 20px; } p { color: var(--ops-muted); } header small { color: var(--ops-primary); font-weight: 750; letter-spacing: 2px; }
section { border: 1px solid var(--ops-border); padding: 22px; border-radius: 14px; } button,.open { min-height: 40px; padding: 8px 18px; border-radius: 8px; border: 1px solid var(--ops-border); background: var(--ops-surface); color: var(--ops-primary); font: inherit; cursor: pointer; text-decoration: none; }
.open { background: var(--ops-action); color: var(--ops-on-primary); } .entry-link { display: flex; align-items: center; justify-content: space-between; gap: 20px; } .entry-link strong,.entry-link a { display: block; } a { color: var(--ops-primary); overflow-wrap: anywhere; } .actions { display: flex; flex-shrink: 0; gap: 10px; }
.hint { font-size: 12px; } .error { color: #dc2626; } iframe { display: block; width: 100%; height: max(650px, 74vh); border: 1px solid var(--ops-border); border-radius: 12px; background: var(--ops-surface); }
form { display: flex; align-items: flex-end; gap: 16px; } label { flex: 1; } input { display: block; width: 100%; padding: 10px 12px; color: var(--ops-text); background: var(--ops-surface); border: 1px solid var(--ops-border); border-radius: 8px; font: inherit; box-sizing: border-box; }
:focus-visible { outline: 3px solid var(--ops-primary); outline-offset: 3px; } @media(max-width: 640px) { .ops-entry { padding: 14px; } .entry-link,form { align-items: stretch; flex-direction: column; } header { align-items: flex-start; } }
</style>
