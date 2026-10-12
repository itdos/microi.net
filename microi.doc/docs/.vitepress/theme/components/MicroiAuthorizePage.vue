<template>
  <main class="microi-authorization">
    <section class="authorization-card" aria-labelledby="authorization-title">
      <a class="authorization-brand" href="/">Microi<span>吾码</span></a>
      <p class="authorization-kicker">MICROI 官方帐号</p>
      <h1 id="authorization-title">{{ title }}</h1>
      <p v-if="phase === 'loading'" role="status">正在核验您的登录状态和目标系统…</p>
      <template v-else-if="phase === 'ready' && context">
        <p><strong>{{ context.ClientName }}</strong> 请求使用您的 Microi 官方帐号登录或绑定。</p>
        <div class="authorization-target">
          <span>当前官方帐号</span>
          <strong>{{ context.CurrentName || context.CurrentAccount }}</strong>
          <span v-if="context.CurrentName && context.CurrentAccount">{{ context.CurrentAccount }}</span>
        </div>
        <div class="authorization-target">
          <span>目标系统</span>
          <strong>{{ targetOrigin }}</strong>
        </div>
        <p>继续后，该系统将获得以下资料：</p>
        <ul>
          <li v-for="scope in context.Scopes" :key="scope">{{ scopeLabels[scope] }}</li>
        </ul>
        <p class="authorization-note">请确认这是您刚刚发起登录的系统。目标系统不会获得您的官方帐号密码或登录会话。</p>
        <div class="authorization-actions">
          <button type="button" class="authorization-primary" :disabled="busy" @click="authorize">{{ busy ? '正在授权…' : '授权并继续' }}</button>
          <button type="button" :disabled="busy" @click="cancel">取消</button>
        </div>
      </template>
      <template v-else>
        <p role="status">{{ message }}</p>
        <a class="authorization-home" href="/profile.html#/overview">返回个人中心</a>
      </template>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { readAuthorizationRequest, authorizationLoginUrl, createAuthorizationClient } from '../utils/site-authorization.js'

const phase = ref('loading'), context = ref(null), busy = ref(false), message = ref('')
const title = computed(() => phase.value === 'error' ? '无法完成授权' : phase.value === 'cancelled' ? '已取消授权' : '授权 Microi 登录')
const targetOrigin = computed(() => context.value ? new URL(context.value.RedirectUri).origin : '')
const scopeLabels = { openid: '用于绑定的唯一帐号标识', profile: '帐号名称与显示名称', email: '电子邮箱地址' }
let requestId = '', client

function fail(error) {
  if (error?.code === 'LOGIN_REQUIRED') {
    // 只跳回本站现有登录/注册页；官方会话始终放在 Header，不能进入返回地址。
    window.location.replace(authorizationLoginUrl(requestId))
    return
  }
  phase.value = 'error'
  message.value = error?.message || '授权服务暂时不可用，请从目标系统重新发起。'
}

onMounted(async () => {
  requestId = readAuthorizationRequest(window.location.search)
  if (!requestId) return fail(new Error('授权请求缺失或无效，请从目标系统重新发起 Microi 登录。'))
  client = createAuthorizationClient()
  try {
    context.value = await client.preview(requestId)
    phase.value = 'ready'
  } catch (error) { fail(error) }
})

async function authorize() {
  if (busy.value || !context.value || phase.value !== 'ready') return
  busy.value = true
  try {
    const redirect = await client.complete(requestId, context.value.RedirectUri, context.value.CurrentUserId)
    window.location.replace(redirect)
  } catch (error) { fail(error) }
  finally { busy.value = false }
}

function cancel() {
  phase.value = 'cancelled'
  message.value = '您已取消本次授权，可以关闭此窗口返回目标系统。'
  // 取消不访问任何外部回调；普通标签不能关闭时保留明确的取消结果。
  window.close()
}
</script>

<style scoped>
.microi-authorization{min-height:75vh;display:grid;place-items:center;padding:56px 20px;background:radial-gradient(ellipse at 20% 10%,#1668ff16,transparent 60%)}
.authorization-card{width:min(540px,100%);padding:36px;border:1px solid var(--vp-c-divider);border-radius:24px;background:var(--vp-c-bg);box-shadow:0 20px 64px #152e5412}
.authorization-brand{font-size:24px;font-weight:800;color:var(--vp-c-text-1);text-decoration:none}.authorization-brand span{margin-left:8px;font-size:18px;font-weight:600}.authorization-kicker{margin:24px 0 8px;font-size:12px;font-weight:700;letter-spacing:.12em;color:var(--vp-c-brand-1)}
.authorization-card h1{margin:0 0 24px;font-size:28px;line-height:1.3}.authorization-card p{color:var(--vp-c-text-2);line-height:1.8}.authorization-card strong{color:var(--vp-c-text-1);overflow-wrap:anywhere}.authorization-target{display:grid;gap:6px;padding:16px;margin:20px 0;border-radius:12px;background:var(--vp-c-bg-soft);font-size:14px}.authorization-target span{color:var(--vp-c-text-2)}.authorization-card ul{padding-left:22px;line-height:2;color:var(--vp-c-text-1)}.authorization-note{font-size:13px}.authorization-actions{display:flex;gap:12px;margin-top:26px}.authorization-actions button{padding:11px 22px;border:1px solid var(--vp-c-divider);border-radius:10px;font:inherit;cursor:pointer}.authorization-actions button.authorization-primary{background:var(--vp-c-brand-1);border-color:var(--vp-c-brand-1);color:white}:global(.dark .microi-authorization .authorization-actions button.authorization-primary){color:#14284d}.authorization-actions button:disabled{cursor:wait;opacity:.6}.authorization-actions button:focus-visible,.authorization-home:focus-visible{outline:3px solid var(--vp-c-brand-1);outline-offset:3px}.authorization-home{display:inline-block;margin-top:20px;color:var(--vp-c-brand-1)}
@media(max-width:560px){.microi-authorization{padding:24px 16px}.authorization-card{padding:28px 22px}.authorization-actions{flex-direction:column}.authorization-actions button{width:100%}}
</style>
