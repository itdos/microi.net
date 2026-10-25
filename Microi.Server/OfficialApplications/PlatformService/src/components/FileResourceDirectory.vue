<template>
  <section class="mci-resources" data-mci-ui-root :aria-busy="state.loading">
    <header class="mci-resources__header">
      <div><h2>高流量资源目录</h2><p>在这里维护当前租户的公开文件，并查看分流所缺的条件。</p></div>
      <div class="mci-resources__actions"><button type="button" :disabled="pending" @click="refresh">刷新目录</button><button class="mci-resources__primary" type="button" :disabled="!canEdit || editor !== ''" @click="openRegister">＋ 登记资源</button></div>
    </header>
    <p class="mci-resources__scope">当前租户：<b>{{ tenant || '等待宿主会话' }}</b> · 仅登记单个公开资源。目录登记不会复制文件或改变下载地址。</p>

    <div v-if="state.loading && !state.loaded" class="mci-resources__skeleton" role="status" aria-label="正在读取目录与策略"><i v-for="n in 4" :key="n"></i></div>
    <template v-else-if="state.loaded">
      <dl class="mci-resources__policy">
        <div><dt>备用文件服务器</dt><dd>{{ state.policy?.FileServerBak || '未配置' }}</dd><small>当前系统设置</small></div>
        <div><dt>流量阈值</dt><dd>{{ formatResourceBytes(state.policy?.ThresholdBytes) }}</dd><small>{{ state.policy?.WindowHours ?? '未知' }} 小时完整窗口</small></div>
        <div><dt>实际下载量</dt><dd>待采集</dd><small>当前无可信完整窗口</small></div>
        <div><dt>自动分流</dt><dd>尚未接通</dd><small>继续使用原下载地址</small></div>
      </dl>
      <p v-if="state.policy?.Blockers?.length" class="mci-resources__hint">配置待完善：{{ state.policy.Blockers.map(blockerLabel).join('；') }}。阈值与备用地址在系统设置中维护。</p>
      <p class="mci-resources__hint">当前入口只管理资源信息。流量采集、副本校验与运行时分流尚未接通；私有文件、跨租户资源和依赖资源组尚不支持。</p>

      <section v-if="editor" class="mci-resources__editor" aria-labelledby="resource-editor-title">
        <header><h3 id="resource-editor-title">{{ editor === 'register' ? '登记公开资源' : '编辑目录信息' }}</h3><button type="button" :disabled="state.saving" @click="closeEditor">取消编辑</button></header>
        <form @submit.prevent="submit">
          <fieldset :disabled="!canEdit">
            <label>资源名称<input v-model="form.Name" name="resource-name" required maxlength="160" autocomplete="off" /></label>
            <label v-if="editor === 'register'">登记方式<select v-model="form.Kind"><option value="ApplicationPublicBuild">应用公开编译产物</option><option value="PlatformStatic">公开静态文件</option></select></label>
            <template v-if="editor === 'register' && form.Kind === 'ApplicationPublicBuild'">
              <label class="mci-resources__full">公开编译文件 Id<input v-model.trim="form.SourceFileId" name="source-file-id" required maxlength="36" autocomplete="off" /><small>填写当前租户应用文件清单中的公开编译文件 Id。路径、版本、大小和 SHA-256 由后端读取。</small></label>
            </template>
            <template v-if="editor === 'register' && form.Kind === 'PlatformStatic'">
              <label class="mci-resources__full">OSS 对象路径<input v-model.trim="form.ObjectKey" name="object-key" required maxlength="1024" :placeholder="`${tenant.toLowerCase() || 'tenant'}/目录/文件.glb`" autocomplete="off" /><small>填写当前租户的公开对象 Key，不含域名或签名参数。登记内容仍需独立验证。</small></label>
              <label class="mci-resources__full">内容 SHA-256<input v-model.trim="form.ContentHash" name="content-hash" required minlength="64" maxlength="64" pattern="[a-fA-F0-9]{64}" autocomplete="off" /></label>
              <label>文件大小（字节）<input v-model="form.Size" name="size" type="number" min="1" max="9007199254740991" step="1" required /></label>
              <label>MIME 类型<input v-model.trim="form.ContentType" name="content-type" required maxlength="128" placeholder="model/gltf-binary" autocomplete="off" /></label>
            </template>
            <label v-if="editor === 'edit'" class="mci-resources__checkbox"><input v-model="form.Enabled" name="enabled" type="checkbox" /><span>纳入评估（不会启用分流）</span></label>
          </fieldset>
          <p v-if="editor === 'edit'" class="mci-resources__hint">来源、版本、哈希及流量证据只读。保存将核对目录版本，其他人的更新不会被覆盖。</p>
          <footer><span>仅保存目录元数据</span><button class="mci-resources__primary" type="submit" :disabled="!canEdit">{{ state.saving ? '正在保存…' : '保存目录信息' }}</button></footer>
        </form>
      </section>

      <section v-if="state.evaluation" class="mci-resources__evaluation" aria-labelledby="resource-evaluation-title" tabindex="-1" ref="evaluationPanel">
        <header><div><h3 id="resource-evaluation-title">{{ evaluatedName }} · 条件检查</h3><p>当前结论：保持原下载地址</p></div><button type="button" @click="state.evaluation = null">收起</button></header>
        <dl><div><dt>完整窗口下载量</dt><dd>未知</dd></div><div><dt>达到阈值</dt><dd>尚无法判断</dd></div><div><dt>NAS 副本</dt><dd>未验证</dd></div></dl>
        <ul><li v-for="reason in state.evaluation.Blockers" :key="reason">{{ blockerLabel(reason) }}</li></ul>
      </section>

      <div class="mci-resources__list-heading"><h3>已登记文件 <span>{{ state.total === null ? '总数未知' : `${state.total} 项` }}</span></h3><label>每页<select :value="state.pageSize" :disabled="pending" @change="changePageSize"><option :value="20">20 项</option><option :value="50">50 项</option><option :value="100">100 项</option></select></label></div>
      <div v-if="state.rows.length" class="mci-resources__list">
        <article v-for="row in state.rows" :key="row.Id" class="mci-resources__row">
          <div class="mci-resources__identity"><h4 :title="row.Name">{{ row.Name }}</h4><p :title="row.ObjectKey">{{ row.ObjectKey }}</p><span>{{ row.Kind === 'ApplicationPublicBuild' ? '应用公开产物' : '静态文件' }} · {{ row.AuthorityState === 'MetadataBound' ? '已绑定文件元数据' : '已登记，内容待验证' }}</span></div>
          <div class="mci-resources__meta"><b>{{ formatResourceBytes(row.Size) }}</b><span>{{ Number(row.Enabled) === 1 ? '已纳入评估' : '暂停评估' }}</span><small>下载量待采集 · 副本未验证</small></div>
          <div class="mci-resources__row-actions"><button type="button" :disabled="pending || Boolean(editor)" @click="inspect(row)">检查条件</button><button type="button" :disabled="!canEdit || Boolean(editor)" @click="openEdit(row)">编辑</button></div>
          <details class="mci-resources__details"><summary>来源与版本</summary><dl><dt>来源租户</dt><dd>{{ row.SourceTenant }}</dd><dt>版本标识</dt><dd>{{ row.SourceRevision }}</dd><dt>SHA-256</dt><dd>{{ row.ContentHash }}</dd><dt>文件 Id</dt><dd>{{ row.SourceFileId || '静态文件登记' }}</dd><dt>目录版本</dt><dd>{{ row.RowVersion }}</dd></dl></details>
        </article>
      </div>
      <div v-else class="mci-resources__empty"><h3>当前页还没有资源</h3><p>从一个已知高流量的公开文件开始登记。文件正文不会在这里上传或下载。</p><button v-if="state.page === 1" type="button" :disabled="!canEdit || Boolean(editor)" @click="openRegister">登记首个资源</button></div>
      <footer class="mci-resources__pager"><span>第 {{ state.page }} 页{{ state.total === null ? ' · 总数未知' : ` · 共 ${state.total} 项` }}</span><button type="button" :disabled="pending || state.page <= 1" @click="model.refresh(state.page - 1)">上一页</button><button type="button" :disabled="pending || !hasNext" @click="model.refresh(state.page + 1)">下一页</button></footer>
    </template>
    <div v-else-if="!state.loading" class="mci-resources__empty"><h3>目录尚未读取</h3><p>需要当前租户的平台管理员会话及资源目录管理接口。</p><button type="button" :disabled="pending" @click="refresh">重新读取</button></div>
    <Teleport to="body"><div v-if="state.error || state.notice" class="mci-resource-feedback" data-mci-ui-root :style="feedbackTheme" :role="state.error ? 'alert' : 'status'"><p>{{ state.error || state.notice }}</p><button type="button" aria-label="关闭提示" @click="state.error = ''; state.notice = ''">关闭</button></div></Teleport>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { configureV8, getContext, subscribeContext } from '../microi'
import { blockerLabel, createResourceDirectory, directoryState, formatResourceBytes, pendingResourceWrites, resourceEnginePath, resourceSessionIdentity } from '../file-resource-directory.mjs'
const state = reactive(directoryState()), context = ref(getContext()), editor = ref(''), editingRow = ref(null), evaluatedName = ref(''), evaluationPanel = ref(null)
const blankForm = () => ({ Kind: 'ApplicationPublicBuild', Name: '', SourceFileId: '', ObjectKey: '', ContentHash: '', Size: '', ContentType: '', Enabled: true })
const form = reactive(blankForm()), tenant = computed(() => context.value.osClient || '')
const pending = computed(() => state.loading || state.saving), canEdit = computed(() => Boolean(state.capabilities) && !pending.value && !state.writeUncertain)
const hasNext = computed(() => state.total === null ? state.rows.length === state.pageSize : state.page * state.pageSize < state.total)
const feedbackTheme = computed(() => ({ '--mci-resource-feedback-bg': context.value.themeMode === 'dark' ? '#182231' : '#ffffff', '--mci-resource-feedback-fg': context.value.themeMode === 'dark' ? '#edf3fb' : '#1d2736', '--mci-resource-feedback-border': context.value.themeMode === 'dark' ? '#9eacbf' : '#6b778b' }))
const model = createResourceDirectory(async payload => {
  const v8 = configureV8()
  return v8.Http?.Post ? v8.Http.Post({ Url: resourceEnginePath, PostParam: payload }) : v8.post(resourceEnginePath, payload)
}, state, pendingResourceWrites)
let unsubscribe, identity = ''
function refresh() { return model.refresh() }
function closeEditor() { if (state.saving) return; editor.value = ''; editingRow.value = null; Object.assign(form, blankForm()) }
function openRegister() { if (!canEdit.value || editor.value) return; Object.assign(form, blankForm()); editor.value = 'register'; state.evaluation = null }
function openEdit(row) { if (!canEdit.value || editor.value) return; Object.assign(form, blankForm(), { Name: row.Name, Enabled: Number(row.Enabled) === 1 }); editingRow.value = { ...row }; editor.value = 'edit'; state.evaluation = null }
async function submit() { const ok = editor.value === 'register' ? await model.register(form) : await model.update(editingRow.value, form); if (ok) closeEditor() }
async function inspect(row) { evaluatedName.value = row.Name; await model.evaluate(row); if (state.evaluation) { await nextTick(); evaluationPanel.value?.focus(); evaluationPanel.value?.scrollIntoView({ block: 'nearest', behavior: 'instant' }) } }
function changePageSize(event) { state.pageSize = Number(event.target.value); void model.refresh(1) }
onMounted(() => {
  unsubscribe = subscribeContext(ctx => {
    context.value = ctx
    // This identity exists only in memory and is never rendered or persisted.
    const next = resourceSessionIdentity(ctx)
    if (next === identity) return
    identity = next; model.reset(next); editor.value = ''; editingRow.value = null; evaluatedName.value = ''; Object.assign(form, blankForm())
    if (ctx.apiBase && ctx.osClient && ctx.token) void refresh()
  }, true)
})
onBeforeUnmount(() => { unsubscribe?.(); model.dispose(); Object.assign(form, blankForm()); identity = '' })
defineExpose({ refresh })
</script>

<style scoped>
.mci-resources{--mci-resource-bg:var(--obs-bg);--mci-resource-panel:var(--obs-panel);--mci-resource-text:var(--obs-text);--mci-resource-muted:var(--obs-muted);--mci-resource-border:var(--obs-border);--mci-resource-radius:var(--mci-shape-panel,12px);color:var(--mci-resource-text);min-width:0;animation:mci-resource-enter .2s ease-out}.mci-resources__header,.mci-resources__editor>header,.mci-resources__evaluation>header,.mci-resources__list-heading,.mci-resources footer{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.mci-resources h2{font-size:22px;margin:0 0 8px}.mci-resources h3{font-size:16px;margin:0}.mci-resources h4{font-size:15px;margin:0 0 6px}.mci-resources p{margin:6px 0;line-height:1.6}.mci-resources__header p,.mci-resources__scope,.mci-resources small,.mci-resources__identity>span,.mci-resources__meta>span,.mci-resources__pager>span{color:var(--mci-resource-muted)}.mci-resources__actions,.mci-resources__row-actions{display:flex;gap:8px;flex-wrap:wrap}.mci-resources button,.mci-resources input,.mci-resources select{box-sizing:border-box;font:inherit;color:var(--mci-resource-text);background:var(--mci-resource-panel);border:1px solid var(--mci-resource-muted);border-radius:var(--mci-shape-input,8px);min-height:42px;padding:9px 12px}.mci-resources button{display:inline-flex;align-items:center;justify-content:center;line-height:1.2;cursor:pointer;transition:background .14s,transform .14s;color:var(--mci-resource-text);background:var(--mci-resource-panel)}.mci-resources button:hover:not(:disabled){background:var(--mci-resource-bg);color:var(--mci-resource-text);border-color:var(--mci-resource-text)}.mci-resources button:active:not(:disabled){transform:translateY(1px);background:var(--mci-resource-bg);color:var(--mci-resource-text)}.mci-resources button:disabled{opacity:.55;cursor:not-allowed;background:var(--mci-resource-panel);color:var(--mci-resource-text);border-color:var(--mci-resource-muted)}.mci-resources .mci-resources__primary{background:var(--mci-resource-text);color:var(--mci-resource-panel);border-color:var(--mci-resource-text);font-weight:650}.mci-resources .mci-resources__primary:hover:not(:disabled),.mci-resources .mci-resources__primary:active:not(:disabled){background:var(--mci-resource-text);color:var(--mci-resource-panel);filter:brightness(.92)}.mci-resources :focus-visible{outline:2px solid var(--mci-resource-text);outline-offset:3px}.mci-resources__scope{font-size:13px;padding:8px 0}.mci-resources__policy{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:12px;margin:16px 0}.mci-resources__policy>div{background:var(--mci-resource-panel);border:1px solid var(--mci-resource-border);border-radius:var(--mci-resource-radius);padding:18px;min-width:0}.mci-resources dt{font-size:12px;color:var(--mci-resource-muted)}.mci-resources dd{margin:8px 0;font-weight:650;overflow-wrap:anywhere}.mci-resources small{display:block;font-size:12px;line-height:1.5}.mci-resources__hint{font-size:13px;color:var(--mci-resource-muted);padding:10px 0}.mci-resources__editor,.mci-resources__evaluation{padding:20px;border:1px solid var(--mci-resource-border);border-radius:var(--mci-resource-radius);background:var(--mci-resource-panel);margin:16px 0}.mci-resources fieldset{border:0;padding:0;margin:20px 0;display:grid;grid-template-columns:1fr 1fr;gap:18px;min-width:0}.mci-resources label{display:flex;flex-direction:column;gap:8px;font-size:13px;min-width:0}.mci-resources input,.mci-resources select{width:100%;min-width:0}.mci-resources__full{grid-column:1/-1}.mci-resources .mci-resources__checkbox{flex-direction:row;align-items:center}.mci-resources__checkbox input{width:20px;min-height:20px;height:20px}.mci-resources__editor footer{justify-content:flex-end;font-size:13px;color:var(--mci-resource-muted)}.mci-resources__evaluation dl{display:flex;flex-wrap:wrap;gap:28px}.mci-resources__evaluation ul{padding-left:20px;line-height:1.8}.mci-resources__list-heading{margin:24px 0 12px}.mci-resources__list-heading h3>span{font-size:12px;font-weight:400;color:var(--mci-resource-muted);margin-left:8px}.mci-resources__list-heading label{flex-direction:row;align-items:center;white-space:nowrap}.mci-resources__row{display:grid;grid-template-columns:minmax(0,1fr) 190px auto;gap:16px;padding:18px 20px;background:var(--mci-resource-panel);border-bottom:1px solid var(--mci-resource-border);content-visibility:auto;contain-intrinsic-size:auto 140px}.mci-resources__row:first-child{border-radius:var(--mci-resource-radius) var(--mci-resource-radius) 0 0}.mci-resources__identity{min-width:0}.mci-resources__identity h4,.mci-resources__identity p{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere}.mci-resources__identity p{font-size:13px}.mci-resources__identity>span,.mci-resources__meta>span{font-size:12px}.mci-resources__meta{display:flex;flex-direction:column;gap:6px}.mci-resources__row-actions{align-self:start}.mci-resources__details{grid-column:1/-1;font-size:12px;min-width:0}.mci-resources summary{cursor:pointer;min-height:28px;display:list-item}.mci-resources__details dl{display:grid;grid-template-columns:100px minmax(0,1fr);gap:8px;margin:10px 0}.mci-resources__details dd{font-weight:400;margin:0;overflow-wrap:anywhere}.mci-resources__empty{text-align:center;padding:36px 20px;background:var(--mci-resource-panel);border-radius:var(--mci-resource-radius)}.mci-resources__empty p{color:var(--mci-resource-muted);margin:12px 0 18px}.mci-resources footer{position:static;bottom:auto;margin:0;background:transparent}.mci-resources__pager{justify-content:flex-end!important;padding:16px 0}.mci-resources__pager>span{margin-right:auto;font-size:13px}.mci-resources__skeleton{display:grid;gap:14px;padding:16px 0}.mci-resources__skeleton i{display:block;height:84px;border-radius:var(--mci-resource-radius);background:linear-gradient(100deg,var(--mci-resource-panel),var(--mci-resource-border),var(--mci-resource-panel));background-size:200% 100%;animation:mci-resource-skeleton 1.3s infinite}.mci-resource-feedback{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483000;display:flex;align-items:center;gap:16px;box-sizing:border-box;width:min(560px,calc(100vw - 32px));padding:20px;background:var(--mci-resource-feedback-bg);color:var(--mci-resource-feedback-fg);border:1px solid var(--mci-resource-feedback-border);border-radius:var(--mci-shape-panel,12px);box-shadow:0 12px 40px #0003;font:14px/1.6 system-ui}.mci-resource-feedback p{margin:0;flex:1;overflow-wrap:anywhere}.mci-resource-feedback button{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:8px 12px;font:inherit;cursor:pointer;color:var(--mci-resource-feedback-fg);background:var(--mci-resource-feedback-bg);border:1px solid var(--mci-resource-feedback-border);border-radius:8px}.mci-resource-feedback button:hover{border-color:var(--mci-resource-feedback-fg)}.mci-resource-feedback button:active{transform:translateY(1px)}.mci-resource-feedback button:focus-visible{outline:2px solid var(--mci-resource-feedback-fg);outline-offset:2px}@keyframes mci-resource-enter{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}@keyframes mci-resource-skeleton{to{background-position:-200% 0}}@media(max-width:900px){.mci-resources__policy{grid-template-columns:1fr 1fr}.mci-resources__row{grid-template-columns:minmax(0,1fr) auto}.mci-resources__meta{grid-column:1;grid-row:2}.mci-resources__row-actions{grid-column:2;grid-row:2}.mci-resources__identity{grid-column:1/-1}}@media(max-width:520px){.mci-resources__policy{grid-template-columns:1fr 1fr;gap:8px}.mci-resources__policy>div:first-child{grid-column:1/-1}.mci-resources__policy>div{padding:12px}.mci-resources__row{display:flex;flex-direction:column;padding:16px 12px}.mci-resources__editor,.mci-resources__evaluation{padding:14px}.mci-resources fieldset{grid-template-columns:1fr}.mci-resources button,.mci-resources input,.mci-resources select{min-height:44px}.mci-resources__header{align-items:start}.mci-resources__actions{width:100%}.mci-resources__actions>button{flex:1}.mci-resources__details dl{grid-template-columns:1fr}.mci-resources__details dd{margin-bottom:8px}.mci-resources__pager{gap:8px}.mci-resource-feedback{flex-direction:column;align-items:stretch}}@media(prefers-reduced-motion:reduce){.mci-resources,.mci-resources__skeleton i{animation:none}.mci-resources button{transition:none}}
</style>
