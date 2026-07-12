<template>
  <section class="ai-summary" :class="{ compact }">
    <div class="summary-head">
      <div><h2>{{ labels.title }}</h2><p>{{ labels.desc }}</p></div>
      <button class="copy-button" type="button" :disabled="!apiKey" @click="$emit('copy')">{{ labels.copy }}</button>
    </div>
    <div class="key-grid">
      <label>{{ labels.apiBase }}</label><code>{{ endpoint }}</code>
      <label>{{ labels.apiKey }}</label><code>{{ apiKey || labels.generating }}</code>
    </div>
    <div class="token-grid">
      <article><span>{{ labels.total }}</span><strong>{{ format(total) }}</strong></article>
      <article><span>{{ labels.used }}</span><strong>{{ format(used) }}</strong></article>
      <article><span>{{ labels.remaining }}</span><strong>{{ format(remaining) }}</strong></article>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  apiKey: string
  endpoint: string
  total: number
  used: number
  remaining: number
  locale: string
  labels: Record<string, string>
  compact?: boolean
}>()

defineEmits<{ copy: [] }>()

function format(value: number) {
  return Number(value || 0).toLocaleString(props.locale === 'en-US' ? 'en-US' : 'zh-CN')
}
</script>

<style scoped>
.ai-summary { border: 1px solid #e6edf5; border-radius: 16px; padding: 20px; background: linear-gradient(135deg, #fff, #f8fbff); box-shadow: 0 10px 30px rgba(15,23,42,.045); }
.summary-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:16px; }
.summary-head h2 { margin:0 0 6px; font-size:18px; }
.summary-head p { margin:0; color:#64748b; line-height:1.6; }
.copy-button { min-height:34px; padding:0 14px; border:1px solid #d9e1ec; border-radius:10px; background:#fff; color:#334155; cursor:pointer; font-weight:700; white-space:nowrap; }
.copy-button:disabled { opacity:.5; cursor:not-allowed; }
.key-grid { display:grid; grid-template-columns:auto minmax(0,1fr); gap:10px 14px; align-items:center; }
.key-grid label { color:#64748b; }
.key-grid code { min-width:0; padding:10px 12px; overflow:auto; border:1px solid #e6edf5; border-radius:10px; background:#f8fafc; color:#0f172a; white-space:nowrap; }
.token-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:16px; }
.token-grid article { padding:14px; border:1px solid #edf1f6; border-radius:12px; background:#fff; }
.token-grid span { display:block; color:#64748b; font-size:13px; }
.token-grid strong { display:block; margin-top:8px; font-size:22px; }
.compact { margin-bottom:18px; }
@media (max-width:720px) { .summary-head { flex-direction:column; } .key-grid { grid-template-columns:1fr; } .token-grid { grid-template-columns:1fr; } }
</style>
