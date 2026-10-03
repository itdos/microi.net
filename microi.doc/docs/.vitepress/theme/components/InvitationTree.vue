<template>
  <div class="invitation-branch" :class="{ nested: depth > 0, deep: depth > 3 }" role="group">
    <p v-if="error" class="tree-error" role="alert">{{ error }} <button @click="load(page)">重试</button></p>
    <p v-if="loading && !nodes.length" class="tree-state">正在加载邀请关系…</p>
    <p v-if="!loading && !error && !nodes.length" class="tree-state">{{ depth ? '暂无下级邀请' : '还没有邀请记录。分享上方链接，邀请朋友加入吾码。' }}</p>
    <div v-for="node in nodes" :key="node.Id" class="tree-item">
      <div class="tree-person">
        <button class="tree-expand" :disabled="!node.HasChildren" :aria-expanded="!!node.expanded" :aria-label="`展开 ${node.Name || node.Account} 的下级`" @click="node.expanded = !node.expanded">{{ node.HasChildren ? (node.expanded ? '−' : '+') : '·' }}</button>
        <img v-if="node.Avatar" class="tree-avatar" :src="node.Avatar" alt="" loading="lazy" @error="node.Avatar = ''" />
        <span v-else class="tree-avatar fallback">{{ String(node.Name || node.Account || '?').slice(0, 1) }}</span>
        <div class="tree-identity"><strong>{{ node.Name || '未设置姓名' }}</strong><span>{{ node.Account }}</span></div>
        <div class="tree-date"><span>注册时间</span><time>{{ node.CreateTime || '—' }}</time></div>
        <div class="tree-date"><span>最后登录官网</span><time>{{ node.LastWebsiteLoginTime || '暂无记录' }}</time></div>
      </div>
      <InvitationTree v-if="node.expanded && depth < 50" :parent-id="node.Id" :load-children="loadChildren" :depth="depth + 1" />
    </div>
    <div v-if="total > 30" class="tree-pagination"><button :disabled="loading || page <= 1" @click="load(page - 1)">上一页</button><span>{{ page }} / {{ Math.ceil(total / 30) }}</span><button :disabled="loading || page * 30 >= total" @click="load(page + 1)">下一页</button></div>
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue'
defineOptions({ name: 'InvitationTree' })
const props = defineProps({ parentId: { type: String, required: true }, loadChildren: { type: Function, required: true }, depth: { type: Number, default: 0 } })
const nodes = ref([]), total = ref(0), page = ref(1), loading = ref(false), error = ref('')
async function load(nextPage = 1) {
  if (loading.value) return
  loading.value = true; error.value = ''
  try {
    const result = await props.loadChildren(props.parentId, nextPage)
    nodes.value = result.Nodes || []; total.value = result.Total || 0; page.value = nextPage
  } catch (e) { error.value = e.message || '邀请关系读取失败。' }
  finally { loading.value = false }
}
onMounted(() => load())
</script>
<style scoped>
.invitation-branch { min-width: 0; }
.invitation-branch.nested { margin-left: 24px; border-left: 1px solid var(--vp-c-divider); padding-left: 16px; }
.invitation-branch.deep { margin-left: 0; padding-left: 8px; }
.tree-person { display: grid; grid-template-columns: 28px 40px minmax(120px,1fr) minmax(135px,auto) minmax(135px,auto); align-items: center; gap: 12px; padding: 18px 0; border-bottom: 1px solid var(--vp-c-divider); }
.tree-expand { width: 26px; height: 26px; border: 1px solid var(--vp-c-divider); border-radius: 6px; color: inherit; background: var(--vp-c-bg); cursor: pointer; }
.tree-expand:disabled { border-color: transparent; cursor: default; opacity: .4; }
.tree-avatar { width: 40px; height: 40px; object-fit: cover; border-radius: 50%; background: var(--vp-c-bg-soft); }
.fallback { display: grid; place-items: center; color: var(--portal-text, var(--vp-c-text-1)); font-weight: 600; }
.tree-identity strong, .tree-identity span, .tree-date span, .tree-date time { display: block; }
.tree-identity strong { font-size: 14px; font-weight: 600; }
.tree-identity span, .tree-date { font-size: 12px; color: var(--vp-c-text-2); overflow-wrap: anywhere; }
.tree-date span { font-size: 11px; margin-bottom: 3px; }
.tree-state { padding: 28px 0; color: var(--vp-c-text-2); font-size: 14px; }
.tree-error { color: #dc2626; }
.tree-pagination { display: flex; justify-content: end; align-items: center; gap: 16px; padding: 20px 0; font-size: 13px; }
.tree-pagination button { padding: 6px 12px; border: 1px solid var(--vp-c-divider); border-radius: 6px; }
@media (max-width: 1000px) { .tree-person { grid-template-columns: 24px 36px minmax(0,1fr); gap: 8px; } .tree-date { grid-column: 3; } .invitation-branch.nested { margin-left: 10px; padding-left: 8px; } .invitation-branch.deep { margin-left: 0; } }
</style>
